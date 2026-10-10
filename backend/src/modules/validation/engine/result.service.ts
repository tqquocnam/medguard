import type { PoolClient } from "pg";

import type {
  RuleResult,
  ValidationRule,
} from "./rule.types.js";


export async function saveRuleResult(
  client: PoolClient,
  checkRunId: string,
  medicalCaseId: string,
  rule: ValidationRule,
  result: RuleResult
) {
  const issueCount =
    result.issueCount ??
    (
      result.status === "FAIL"
        ? 1
        : 0
    );

  await client.query(
    `
    INSERT INTO validation.rule_results (
      check_run_id,
      rule_id,
      medical_case_id,

      result,
      severity,
      issue_count,

      message,
      details,

      checked_at
    )
    VALUES (
      $1,
      $2,
      $3,

      $4,
      $5,
      $6,

      $7,
      $8::jsonb,

      NOW()
    )

    ON CONFLICT (
      check_run_id,
      rule_id,
      medical_case_id
    )

    DO UPDATE SET
      result = EXCLUDED.result,
      severity = EXCLUDED.severity,
      issue_count = EXCLUDED.issue_count,
      message = EXCLUDED.message,
      details = EXCLUDED.details,
      checked_at = NOW()
    `,
    [
      checkRunId,
      rule.id,
      medicalCaseId,

      result.status,
      result.severity,
      issueCount,

      result.message,

      JSON.stringify(
        result.details ?? {}
      ),
    ]
  );
}
export async function calculateCaseStatus(
  client: PoolClient,
  checkRunId: string,
  medicalCaseId: string
) {

  // ==========================================
  // LẤY TẤT CẢ KẾT QUẢ RULE CỦA HỒ SƠ
  // TRONG LẦN CHECK HIỆN TẠI
  // ==========================================

  const resultQuery =
    await client.query(
      `
      SELECT
        result,
        severity,
        COALESCE(
          issue_count,
          0
        ) AS issue_count

      FROM
        validation.rule_results

      WHERE
        check_run_id = $1

        AND

        medical_case_id = $2
      `,
      [
        checkRunId,
        medicalCaseId,
      ]
    );


  let errorCount =
    0;

  let warningCount =
    0;


  // ==========================================
  // ĐẾM LỖI THẬT
  // ==========================================

  for (
    const row
    of resultQuery.rows
  ) {

    const issueCount =
      Number(
        row.issue_count ??
        0
      );


    // ========================================
    // ERROR
    // ========================================

    if (
      row.result === "FAIL" &&
      row.severity === "ERROR"
    ) {

      errorCount +=
        issueCount > 0
          ? issueCount
          : 1;
    }


    // ========================================
    // WARNING
    // ========================================

    if (
      row.result === "FAIL" &&
      row.severity === "WARNING"
    ) {

      warningCount +=
        issueCount > 0
          ? issueCount
          : 1;
    }
  }


  // ==========================================
  // CÓ LỖI THẬT
  // ==========================================

  if (
    errorCount > 0
  ) {

    return {
      status:
        "ERROR",

      errorCount,

      warningCount,
    };
  }


  // ==========================================
  // KHÔNG CÓ LỖI
  //
  // PASS hoặc SKIP đều không làm hồ sơ lỗi.
  //
  // => TỐT
  // ==========================================

  return {
    status:
      "OK",

    errorCount:
      0,

    warningCount,
  };
}

export async function updateCaseStatus(
  client: PoolClient,
  checkRunId: string,
  medicalCaseId: string
) {
  const result =
    await calculateCaseStatus(
      client,
      checkRunId,
      medicalCaseId
    );

  await client.query(
    `
    UPDATE core.medical_cases

    SET
      status = $2,
      error_count = $3,
      updated_at = NOW()

    WHERE id = $1
    `,
    [
      medicalCaseId,
      result.status,
      result.errorCount,
    ]
  );

  return result;
}