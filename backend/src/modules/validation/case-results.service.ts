import {
  db,
} from "../../config/database.js";


// ======================================================
// LẤY KẾT QUẢ KIỂM TRA MỚI NHẤT CỦA 1 HỒ SƠ
// ======================================================

export async function getCaseResults(
  medicalCaseId: string
) {

  // ====================================================
  // 1. TÌM LẦN KIỂM TRA MỚI NHẤT
  // ====================================================

  const latestRun =
    await db.query(
      `
      SELECT
        check_run_id,
        checked_at

      FROM
        validation.rule_results

      WHERE
        medical_case_id = $1

      ORDER BY
        checked_at DESC

      LIMIT 1
      `,
      [
        medicalCaseId,
      ]
    );


  // Chưa từng kiểm tra
  if (
    latestRun.rows.length === 0
  ) {
    return {
      checkRunId: null,
      checkedAt: null,
      results: [],
    };
  }


  const checkRunId =
    latestRun.rows[0]
      .check_run_id;


  const checkedAt =
    latestRun.rows[0]
      .checked_at;


  // ====================================================
  // 2. LẤY TOÀN BỘ RULE CỦA LẦN KIỂM TRA ĐÓ
  // ====================================================

  const result =
    await db.query(
      `
      SELECT
        rr.id,

        rr.check_run_id,

        rr.medical_case_id,

        rr.result,

        rr.severity,

        rr.message,

        rr.issue_count,

        rr.details,

        rr.checked_at,

        r.code AS rule_code,

        r.name AS rule_name,

        r.priority

      FROM
        validation.rule_results rr

      INNER JOIN
        validation.rules r

        ON
          r.id = rr.rule_id

      WHERE
        rr.medical_case_id = $1

        AND
        rr.check_run_id = $2

      ORDER BY
        r.priority ASC,
        r.code ASC
      `,
      [
        medicalCaseId,
        checkRunId,
      ]
    );


  // ====================================================
  // 3. THỐNG KÊ
  // ====================================================

  let passCount = 0;
  let failCount = 0;
  let skipCount = 0;
  let issueCount = 0;


  for (
    const row
    of result.rows
  ) {
    if (
      row.result === "PASS"
    ) {
      passCount++;
    }

    if (
      row.result === "FAIL"
    ) {
      failCount++;
    }

    if (
      row.result === "SKIP"
    ) {
      skipCount++;
    }


    issueCount +=
      Number(
        row.issue_count ??
        0
      );
  }


  return {
    checkRunId,

    checkedAt,

    summary: {
      totalRules:
        result.rows.length,

      passCount,

      failCount,

      skipCount,

      issueCount,
    },

    results:
      result.rows,
  };
}