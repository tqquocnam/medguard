import {
  db,
} from "../../config/database.js";


// ======================================================
// GET CASE RESULTS OF ONE CHECK RUN
// ======================================================
//
// Lấy kết quả của:
//
// check_run_id + medical_case_id
//
// Không lấy kết quả lần kiểm tra mới nhất.
//
// ======================================================

export async function getCheckRunCaseResults(
  checkRunId: string,
  medicalCaseId: string
) {

  // ====================================================
  // 1. KIỂM TRA CHECK RUN
  // ====================================================

  const checkRunResult =
    await db.query(
      `
      SELECT
        id,
        finished_at,
        started_at

      FROM
        validation.check_runs

      WHERE
        id = $1

      LIMIT 1
      `,
      [
        checkRunId,
      ]
    );


  if (
    checkRunResult.rows.length ===
    0
  ) {

    return null;
  }


  // ====================================================
  // 2. KẾT QUẢ RULE CỦA ĐÚNG HỒ SƠ + ĐÚNG RUN
  // ====================================================

  const result =
    await db.query(
      `
      SELECT

        rr.id,

        rr.result,

        rr.severity,

        rr.message,

        rr.issue_count,

        rr.details,

        rr.checked_at,

        r.code
          AS rule_code,

        r.name
          AS rule_name

      FROM
        validation.rule_results rr

      INNER JOIN
        validation.rules r

      ON
        r.id =
        rr.rule_id

      WHERE
        rr.check_run_id =
          $1

        AND rr.medical_case_id =
          $2

      ORDER BY
        CASE
          WHEN rr.result = 'FAIL'
            AND rr.severity = 'ERROR'
            THEN 1

          WHEN rr.result = 'FAIL'
            AND rr.severity = 'WARNING'
            THEN 2

          WHEN rr.result = 'FAIL'
            THEN 3

          WHEN rr.result = 'PASS'
            THEN 4

          ELSE 5
        END,

        r.code ASC
      `,
      [
        checkRunId,
        medicalCaseId,
      ]
    );


  // ====================================================
  // 3. CHECKED AT
  // ====================================================

  const run =
    checkRunResult.rows[0];


  const checkedAt =
    run.finished_at ??
    run.started_at ??
    null;


  // ====================================================
  // 4. RETURN
  // ====================================================

  return {

    checkRunId,

    checkedAt:
      checkedAt
        ? new Date(
            checkedAt
          ).toISOString()
        : null,

    results:
      result.rows.map(
        (
          row
        ) => ({

          id:
            String(
              row.id
            ),

          result:
            String(
              row.result
            ),

          severity:
            String(
              row.severity
            ),

          message:
            row.message
              ? String(
                  row.message
                )
              : undefined,

          issue_count:
            Number(
              row.issue_count ??
              0
            ),

          details:
            row.details ??
            null,

          checked_at:
            row.checked_at
              ? new Date(
                  row.checked_at
                ).toISOString()
              : undefined,

          rule_code:
            String(
              row.rule_code
            ),

          rule_name:
            String(
              row.rule_name
            ),
        })
      ),
  };
}