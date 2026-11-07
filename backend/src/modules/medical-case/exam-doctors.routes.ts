import { Router } from "express";
import type { Pool } from "pg";

interface ExamDoctorRow {
  doctor_code: string;
  doctor_name: string | null;
  ma_lks: string[];
  case_count: number;
  exam_count: number;
}

export function createExamDoctorRouter(pool: Pool) {
  const router = Router();

  // ==================================================
  // GET /api/medical-cases/exam-doctors
  // ==================================================
  // Danh sách bác sĩ thực hiện công khám.
  // Chỉ đọc dữ liệu được trích xuất từ XML3.
  // ==================================================
  // GET /api/medical-cases/:caseId/xml-details
  router.get("/:caseId/xml-details", async (req, res) => {
    const { caseId } = req.params;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId)) {
      res.status(400).json({
        success: false,
        message: "ID hồ sơ không hợp lệ.",
      });
      return;
    }

    type StaffLookup = {
      name: string | null;
      status: "FOUND" | "NOT_FOUND" | "AMBIGUOUS";
    };

    function normalizeCode(value: unknown): string {
      return String(value ?? "")
        .toLowerCase()
        .replace(/\s+/g, "");
    }

    function splitCodes(value: unknown): string[] {
      return String(value ?? "")
        .split(/[;|,]+/)
        .map((code) => normalizeCode(code))
        .filter(Boolean);
    }

    function collectStaffCodes(value: unknown, codes: Set<string>): void {
      if (Array.isArray(value)) {
        for (const item of value) {
          collectStaffCodes(item, codes);
        }
        return;
      }

      if (typeof value !== "object" || value === null) return;

      for (const [key, child] of Object.entries(value)) {
        if (key === "MA_BAC_SI" || key === "NGUOI_THUC_HIEN" || key === "MA_BS_DOC_KQ") {
          for (const code of splitCodes(child)) {
            codes.add(code);
          }
        } else {
          collectStaffCodes(child, codes);
        }
      }
    }

    try {
      const result = await pool.query(
        `
        SELECT
          c.id,
          c.branch_id,
          c.ma_lk,
          c.ma_bn,
          c.ho_ten,
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'type', f.xml_type,
                  'data', f.parsed_data
                )
                ORDER BY f.xml_type
              )
              FROM core.medical_xml_files f
              WHERE f.medical_case_id = c.id
                AND f.branch_id = c.branch_id
                AND UPPER(TRIM(f.xml_type)) IN (
                  'XML1', 'XML2', 'XML3', 'XML4', 'XML5'
                )
            ),
            '[]'::jsonb
          ) AS files
        FROM core.medical_cases c
        WHERE c.id = $1
        `,
        [caseId],
      );

      const medicalCase = result.rows[0];

      if (!medicalCase) {
        res.status(404).json({
          success: false,
          message: "Không tìm thấy hồ sơ.",
        });
        return;
      }

      const codes = new Set<string>();

      collectStaffCodes(medicalCase.files, codes);

      const staffLookup: Record<string, StaffLookup> = {};

      for (const code of codes) {
        staffLookup[code] = {
          name: null,
          status: "NOT_FOUND",
        };
      }

      if (codes.size > 0) {
        const staffResult = await pool.query<{
          id: string;
          full_name: string | null;
          license_number: string | null;
          social_insurance_code: string | null;
        }>(
          `
          SELECT
            id,
            full_name,
            license_number,
            social_insurance_code
          FROM catalog.medical_staff
          WHERE branch_id = $2
            AND (
              REGEXP_REPLACE(
                LOWER(COALESCE(license_number, '')),
                '[[:space:]]+', '', 'g'
              ) = ANY($1::text[])
              OR
              REGEXP_REPLACE(
                LOWER(COALESCE(social_insurance_code, '')),
                '[[:space:]]+', '', 'g'
              ) = ANY($1::text[])
            )
          `,
          [[...codes], medicalCase.branch_id],
        );

        const matches = new Map<string, Map<string, string | null>>();

        for (const staff of staffResult.rows) {
          const staffCodes = new Set([
            normalizeCode(staff.license_number),
            normalizeCode(staff.social_insurance_code),
          ]);

          for (const code of staffCodes) {
            if (!code || !codes.has(code)) continue;

            const people = matches.get(code) ?? new Map<string, string | null>();

            people.set(String(staff.id), staff.full_name?.trim() || null);

            matches.set(code, people);
          }
        }

        for (const code of codes) {
          const people = matches.get(code);

          if (!people?.size) continue;

          if (people.size > 1) {
            staffLookup[code] = {
              name: null,
              status: "AMBIGUOUS",
            };
          } else {
            staffLookup[code] = {
              name: [...people.values()][0] ?? null,
              status: "FOUND",
            };
          }
        }
      }

      res.json({
        success: true,
        data: {
          id: medicalCase.id,
          ma_lk: medicalCase.ma_lk,
          ma_bn: medicalCase.ma_bn,
          ho_ten: medicalCase.ho_ten,
          files: medicalCase.files,
          staffLookup,
        },
      });
    } catch (error) {
      console.error("[Medical Case XML Details]", error);

      res.status(500).json({
        success: false,
        message: "Không tải được chi tiết hồ sơ.",
      });
    }
  });

  router.get("/exam-doctors", async (_req, res) => {
    try {
      const result = await pool.query<ExamDoctorRow>(`
        WITH doctor_catalog AS (
          SELECT DISTINCT ON (
            UPPER(TRIM(license_number))
          )
            UPPER(TRIM(license_number)) AS code,
            full_name
          FROM catalog.medical_staff
          WHERE NULLIF(TRIM(license_number), '') IS NOT NULL
          ORDER BY
            UPPER(TRIM(license_number)),
            active DESC NULLS LAST,
            updated_at DESC NULLS LAST
        )
        SELECT
          d.doctor_code,

          s.full_name AS doctor_name,

          ARRAY_AGG(
            DISTINCT d.ma_lk
            ORDER BY d.ma_lk
          ) AS ma_lks,

          COUNT(DISTINCT d.ma_lk)::int
            AS case_count,

          COUNT(*)::int
            AS exam_count

        FROM core.medical_case_exam_doctors d

        LEFT JOIN doctor_catalog s
          ON s.code = UPPER(TRIM(d.doctor_code))

        GROUP BY
          d.doctor_code,
          s.full_name

        ORDER BY
          case_count DESC,
          doctor_name NULLS LAST
      `);

      const doctors = result.rows.map((row) => ({
        code: row.doctor_code,
        name: row.doctor_name,
        maLks: row.ma_lks,
        caseCount: Number(row.case_count),
        examCount: Number(row.exam_count),
      }));

      res.json({
        success: true,
        data: doctors,
      });
    } catch (error) {
      console.error("[Exam Doctors] GET error:", error);

      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Không tải được danh sách bác sĩ công khám.",
      });
    }
  });

  return router;
}
