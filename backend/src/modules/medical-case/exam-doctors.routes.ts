
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
      console.error(
        "[Exam Doctors] GET error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Không tải được danh sách bác sĩ công khám.",
      });
    }
  });

  return router;
}
