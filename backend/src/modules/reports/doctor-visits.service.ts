import { db } from "../../config/database.js";

export interface DoctorVisitParams {
  branchId: string;
  staffId?: string;
  year?: number;
  month?: number;
  paymentDate?: string;
  page: number;
  pageSize: number;
}

export async function listDoctorVisits(params: DoctorVisitParams) {
  if (!params.branchId) {
    throw new Error("Chưa xác định chi nhánh.");
  }

  const result = await db.query(
    `
    WITH exam_events AS (
      SELECT DISTINCT
        e.medical_case_id,
        e.doctor_code,
        e.start_time::date AS exam_date

      FROM core.medical_events e

      JOIN core.medical_cases mc
        ON mc.id = e.medical_case_id

      WHERE
        e.branch_id = $1
        AND mc.branch_id = $1
        AND e.start_time IS NOT NULL
        AND NULLIF(BTRIM(e.doctor_code), '') IS NOT NULL

        AND (
          UPPER(COALESCE(e.event_type, '')) = 'EXAM'
          OR LOWER(COALESCE(e.item_name, '')) LIKE 'khám%'
        )
    ),

    grouped AS (
      SELECT
        ms.id AS staff_id,
        ms.full_name,
        ms.social_insurance_code,
        ms.license_number,
        ee.exam_date,

        COUNT(
          DISTINCT ee.medical_case_id
        )::integer AS visit_count

      FROM exam_events ee

      JOIN catalog.medical_staff ms
        ON ms.branch_id = $1
        AND (
          LOWER(
            REGEXP_REPLACE(
              BTRIM(COALESCE(ms.license_number, '')),
              '\\s+', '', 'g'
            )
          ) = LOWER(
            REGEXP_REPLACE(
              BTRIM(ee.doctor_code),
              '\\s+', '', 'g'
            )
          )

          OR LOWER(
            REGEXP_REPLACE(
              BTRIM(COALESCE(ms.social_insurance_code, '')),
              '\\s+', '', 'g'
            )
          ) = LOWER(
            REGEXP_REPLACE(
              BTRIM(ee.doctor_code),
              '\\s+', '', 'g'
            )
          )
        )

      JOIN core.medical_cases mc
        ON mc.id = ee.medical_case_id
        AND mc.branch_id = $1

      WHERE
        ms.active = TRUE

        AND (
          $2::uuid IS NULL
          OR ms.id = $2::uuid
        )

        AND (
          $3::integer IS NULL
          OR EXTRACT(YEAR FROM ee.exam_date)::integer = $3
        )

        AND (
          $4::integer IS NULL
          OR EXTRACT(MONTH FROM ee.exam_date)::integer = $4
        )

        AND (
          $5::date IS NULL
          OR mc.ngay_ttoan::date = $5::date
        )

      GROUP BY
        ms.id,
        ms.full_name,
        ms.social_insurance_code,
        ms.license_number,
        ee.exam_date
    )

    SELECT
      (
        SELECT COUNT(*)::integer
        FROM grouped
      ) AS total,

      COALESCE(
        (
          SELECT jsonb_agg(
            p ORDER BY
              p."examDate",
              p."fullName",
              p."staffId"
          )

          FROM (
            SELECT
              staff_id::text AS "staffId",
              full_name AS "fullName",

              NULLIF(
                social_insurance_code, ''
              ) AS "socialInsuranceCode",

              NULLIF(
                license_number, ''
              ) AS "licenseNumber",

              EXTRACT(
                MONTH FROM exam_date
              )::integer AS month,

              EXTRACT(
                YEAR FROM exam_date
              )::integer AS year,

              TO_CHAR(
                exam_date, 'YYYY-MM-DD'
              ) AS "examDate",

              visit_count AS "visitCount"

            FROM grouped

            ORDER BY
              exam_date,
              full_name,
              staff_id

            LIMIT $6
            OFFSET $7
          ) p
        ),
        '[]'::jsonb
      ) AS items
    `,
    [
      params.branchId,
      params.staffId || null,
      params.year ?? null,
      params.month ?? null,
      params.paymentDate || null,
      params.pageSize,
      (params.page - 1) * params.pageSize,
    ],
  );

  return {
    items: result.rows[0].items,
    total: Number(result.rows[0].total),
  };
}
