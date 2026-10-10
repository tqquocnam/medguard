import {
  db,
} from "../../config/database.js";


export interface DoctorVisitParams {
  staffId?: string;
  year?: number;
  month?: number;
  paymentDate?: string;
  page: number;
  pageSize: number;
}


function normalizeText(
  value:
    unknown
): string {

  return String(
    value ??
    ""
  ).trim();
}


export async function listDoctorVisits(
  params:
    DoctorVisitParams
) {

  const {
    staffId,
    year,
    month,
    paymentDate,
    page,
    pageSize,
  } =
    params;


  const values:
    unknown[] =
    [];


  const conditions:
    string[] =
    [];


  if (
    staffId
  ) {

    values.push(
      staffId
    );

    conditions.push(
      `ms.id = $${values.length}::uuid`
    );

  }


  if (
    year
  ) {

    values.push(
      year
    );

 conditions.push(
  `EXTRACT(YEAR FROM ee.exam_date)::integer = $${values.length}`
);

  }


  if (
    month
  ) {

    values.push(
      month
    );

   conditions.push(
  `EXTRACT(MONTH FROM ee.exam_date)::integer = $${values.length}`
);

  }


  if (
    paymentDate
  ) {

    values.push(
      paymentDate
    );

    conditions.push(
      `mc.ngay_ttoan::date = $${values.length}::date`
    );

  }


  const whereSql =
    conditions.length >
    0

      ? `AND ${conditions.join(
          " AND "
        )}`

      : "";


  const offset =
    (
      page -
      1
    ) *
    pageSize;


  const limitIndex =
    values.length +
    1;


  const offsetIndex =
    values.length +
    2;


  const result =
    await db.query(
      `
      WITH exam_events AS (

        SELECT DISTINCT

          e.medical_case_id,

          e.doctor_code,

          e.start_time::date
            AS exam_date

        FROM
          core.medical_events e

        INNER JOIN
          core.medical_cases mc

          ON
            mc.id =
            e.medical_case_id

        WHERE

          e.start_time
          IS NOT NULL

          AND

          NULLIF(
            BTRIM(
              e.doctor_code
            ),
            ''
          )
          IS NOT NULL

          AND
          (
            UPPER(
              COALESCE(
                e.event_type,
                ''
              )
            )
            =
            'EXAM'

            OR

            LOWER(
              COALESCE(
                e.item_name,
                ''
              )
            )
            LIKE
            'khám%'
          )

      ),

      matched AS (

        SELECT

          ms.id
            AS staff_id,

          ms.full_name,

          ms.social_insurance_code,

          ms.license_number,

          ee.exam_date,

          ee.medical_case_id

        FROM
          exam_events ee

        INNER JOIN
          catalog.medical_staff ms

          ON
          (
            LOWER(
              REGEXP_REPLACE(
                BTRIM(
                  COALESCE(
                    ms.license_number,
                    ''
                  )
                ),
                '\\s+',
                '',
                'g'
              )
            )

            =

            LOWER(
              REGEXP_REPLACE(
                BTRIM(
                  ee.doctor_code
                ),
                '\\s+',
                '',
                'g'
              )
            )

            OR

            LOWER(
              REGEXP_REPLACE(
                BTRIM(
                  COALESCE(
                    ms.social_insurance_code,
                    ''
                  )
                ),
                '\\s+',
                '',
                'g'
              )
            )

            =

            LOWER(
              REGEXP_REPLACE(
                BTRIM(
                  ee.doctor_code
                ),
                '\\s+',
                '',
                'g'
              )
            )
          )

        INNER JOIN
          core.medical_cases mc

          ON
            mc.id =
            ee.medical_case_id

        WHERE
          ms.active =
          true

          ${whereSql}

      ),

      grouped AS (

        SELECT

          staff_id,

          full_name,

          social_insurance_code,

          license_number,

          exam_date,

          COUNT(
            DISTINCT
            medical_case_id
          )::integer
            AS visit_count

        FROM
          matched

        GROUP BY

          staff_id,

          full_name,

          social_insurance_code,

          license_number,

          exam_date

      )

      SELECT

        staff_id,

        full_name,

        social_insurance_code,

        license_number,

        EXTRACT(
          MONTH
          FROM exam_date
        )::integer
          AS month,

        EXTRACT(
          YEAR
          FROM exam_date
        )::integer
          AS year,

        exam_date,

        visit_count

      FROM
        grouped

      ORDER BY

        exam_date ASC,

        full_name ASC

      LIMIT
        $${limitIndex}

      OFFSET
        $${offsetIndex}
      `,
      [
        ...values,
        pageSize,
        offset,
      ]
    );


  const countResult =
    await db.query(
      `
      WITH exam_events AS (

        SELECT DISTINCT

          e.medical_case_id,

          e.doctor_code,

          e.start_time::date
            AS exam_date

        FROM
          core.medical_events e

        INNER JOIN
          core.medical_cases mc

          ON
            mc.id =
            e.medical_case_id

        WHERE

          e.start_time
          IS NOT NULL

          AND

          NULLIF(
            BTRIM(
              e.doctor_code
            ),
            ''
          )
          IS NOT NULL

          AND
          (
            UPPER(
              COALESCE(
                e.event_type,
                ''
              )
            )
            =
            'EXAM'

            OR

            LOWER(
              COALESCE(
                e.item_name,
                ''
              )
            )
            LIKE
            'khám%'
          )

      ),

      matched AS (

        SELECT

          ms.id
            AS staff_id,

          ms.full_name,

          ee.exam_date,

          ee.medical_case_id

        FROM
          exam_events ee

        INNER JOIN
          catalog.medical_staff ms

          ON
          (
            LOWER(
              REGEXP_REPLACE(
                BTRIM(
                  COALESCE(
                    ms.license_number,
                    ''
                  )
                ),
                '\\s+',
                '',
                'g'
              )
            )

            =

            LOWER(
              REGEXP_REPLACE(
                BTRIM(
                  ee.doctor_code
                ),
                '\\s+',
                '',
                'g'
              )
            )

            OR

            LOWER(
              REGEXP_REPLACE(
                BTRIM(
                  COALESCE(
                    ms.social_insurance_code,
                    ''
                  )
                ),
                '\\s+',
                '',
                'g'
              )
            )

            =

            LOWER(
              REGEXP_REPLACE(
                BTRIM(
                  ee.doctor_code
                ),
                '\\s+',
                '',
                'g'
              )
            )
          )

        INNER JOIN
          core.medical_cases mc

          ON
            mc.id =
            ee.medical_case_id

        WHERE
          ms.active =
          true

          ${whereSql}

      ),

      grouped AS (

        SELECT

          staff_id,

          exam_date

        FROM
          matched

        GROUP BY

          staff_id,

          exam_date

      )

      SELECT
        COUNT(*)::integer
          AS total

      FROM
        grouped
      `,
      values
    );


  return {

    items:
      result.rows.map(
        (
          row
        ) => ({

          staffId:
            String(
              row.staff_id
            ),

          fullName:
            String(
              row.full_name
            ),

          socialInsuranceCode:
            row.social_insurance_code
              ? String(
                  row.social_insurance_code
                )
              : null,

          licenseNumber:
            row.license_number
              ? String(
                  row.license_number
                )
              : null,

          month:
            Number(
              row.month
            ),

          year:
            Number(
              row.year
            ),

          examDate:
            String(
              row.exam_date
            ).slice(
              0,
              10
            ),

          visitCount:
            Number(
              row.visit_count
            ),

        })
      ),

    total:
      Number(
        countResult
          .rows[0]
          ?.total ??
        0
      ),

  };

}