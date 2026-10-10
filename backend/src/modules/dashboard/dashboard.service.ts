import {
  db,
} from "../../config/database.js";


export interface DashboardMonthSummary {

  month: number;

  year: number;

  totalCases: number;

  goodCases: number;

  errorCases: number;

  uncheckedCases: number;
}


// ======================================================
// DASHBOARD SUMMARY
// ======================================================
//
// Ưu tiên:
//
// NAM_QT + THANG_QT
//
// Nếu hồ sơ cũ không có NAM_QT / THANG_QT
// thì fallback:
//
// NGAY_TTOAN
// → NGAY_RA
// → NGAY_VAO
//
// Trạng thái:
//
// OK      = Hồ sơ đúng
// ERROR   = Hồ sơ lỗi
// còn lại = Chưa kiểm tra
//
// ======================================================

export async function getDashboardSummary():
Promise<DashboardMonthSummary[]> {

  const result =
    await db.query(
      `
      WITH case_month AS (

        SELECT

          CASE

            WHEN
              nam_qt IS NOT NULL
              AND thang_qt IS NOT NULL
            THEN nam_qt::integer

            ELSE EXTRACT(
              YEAR FROM
              COALESCE(
                ngay_ttoan,
                ngay_ra,
                ngay_vao
              )
            )::integer

          END AS year,


          CASE

            WHEN
              nam_qt IS NOT NULL
              AND thang_qt IS NOT NULL
            THEN thang_qt::integer

            ELSE EXTRACT(
              MONTH FROM
              COALESCE(
                ngay_ttoan,
                ngay_ra,
                ngay_vao
              )
            )::integer

          END AS month,


          status

        FROM
          core.medical_cases

      )

      SELECT

        year,

        month,

        COUNT(*)::integer
          AS total_cases,


        COUNT(*) FILTER (
          WHERE
            status = 'OK'
        )::integer
          AS good_cases,


        COUNT(*) FILTER (
          WHERE
            status = 'ERROR'
        )::integer
          AS error_cases,


        COUNT(*) FILTER (
          WHERE
            status IS NULL
            OR status NOT IN (
              'OK',
              'ERROR'
            )
        )::integer
          AS unchecked_cases

      FROM
        case_month

      WHERE
        year IS NOT NULL
        AND month IS NOT NULL

      GROUP BY
        year,
        month

      ORDER BY
        year DESC,
        month DESC

      LIMIT 12
      `
    );


  return result.rows.map(
    (
      row
    ) => ({

      month:
        Number(
          row.month
        ),

      year:
        Number(
          row.year
        ),

      totalCases:
        Number(
          row.total_cases ??
          0
        ),

      goodCases:
        Number(
          row.good_cases ??
          0
        ),

      errorCases:
        Number(
          row.error_cases ??
          0
        ),

      uncheckedCases:
        Number(
          row.unchecked_cases ??
          0
        ),
    })
  );
}