
import type { PoolClient } from "pg";

import type {
  RuleResult,
  ValidationRule,
} from "./rule.types.js";

// ======================================================
// TYPES
// ======================================================

export type MedicalCaseCheckStatus =
  | "OK"
  | "WARNING"
  | "ERROR"
  | "INCOMPLETE";

export interface CaseStatusResult {
  status: MedicalCaseCheckStatus;
  errorCount: number;
  warningCount: number;
  incompleteCount: number;
  passedRules: number;
  failedRules: number;
  skippedRules: number;
  totalRules: number;
}

interface RuleResultRow {
  result: string;
  severity: string;
  issue_count: number | string | null;
  required: boolean | null;
  blocks_ok: boolean | null;
  details: unknown;
}

// ======================================================
// HELPERS
// ======================================================

function getIssueCount(
  value: unknown
): number {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 1
  ) {
    return 1;
  }

  return Math.floor(parsed);
}

function isExecutionFailure(
  details: unknown
): boolean {
  if (
    !details ||
    typeof details !== "object" ||
    Array.isArray(details)
  ) {
    return false;
  }

  const data = details as Record<
    string,
    unknown
  >;

  return (
    data.executionError === true ||
    data.execution_error === true ||
    data.validatorError === true
  );
}

// ======================================================
// SAVE RULE RESULT
// ======================================================

export async function saveRuleResult(
  client: PoolClient,
  checkRunId: string,
  medicalCaseId: string,
  rule: ValidationRule,
  result: RuleResult
): Promise<void> {
  const issueCount =
    result.status === "FAIL"
      ? getIssueCount(
          result.issueCount
        )
      : 0;

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

// ======================================================
// CALCULATE CASE STATUS
// ======================================================

export async function calculateCaseStatus(
  client: PoolClient,
  checkRunId: string,
  medicalCaseId: string
): Promise<CaseStatusResult> {
  // Lấy kết quả rule cùng cấu hình bắt buộc.
  //
  // LEFT JOIN để vẫn đọc được kết quả cũ
  // nếu metadata của rule thay đổi.

  const resultQuery =
    await client.query<RuleResultRow>(
      `
      SELECT
        rr.result,
        rr.severity,
        COALESCE(
          rr.issue_count,
          0
        ) AS issue_count,
        COALESCE(
          r.required,
          FALSE
        ) AS required,
        COALESCE(
          r.blocks_ok,
          FALSE
        ) AS blocks_ok,
        rr.details
      FROM validation.rule_results rr
      LEFT JOIN validation.branch_rules r
        ON r.id = rr.rule_id
      WHERE
        rr.check_run_id = $1
        AND rr.medical_case_id = $2
      `,
      [
        checkRunId,
        medicalCaseId,
      ]
    );

  let errorCount = 0;
  let warningCount = 0;
  let incompleteCount = 0;

  let passedRules = 0;
  let failedRules = 0;
  let skippedRules = 0;

  for (
    const row of resultQuery.rows
  ) {
    const result = String(
      row.result ?? ""
    ).toUpperCase();

    const severity = String(
      row.severity ?? ""
    ).toUpperCase();

    const required =
      row.required === true;

    const executionFailure =
      isExecutionFailure(
        row.details
      );

    // ================================================
    // PASS
    // ================================================

    if (result === "PASS") {
      passedRules++;
      continue;
    }

    // ================================================
    // SKIP
    // ================================================

    if (result === "SKIP") {
      skippedRules++;

      // SKIP không mặc nhiên là lỗi.
      //
      // Chỉ đánh dấu chưa đủ cấu hình nếu:
      // - rule bắt buộc không thực thi được; hoặc
      // - validator báo lỗi thực thi.
      //
      // Rule không áp dụng cho hồ sơ vẫn
      // được phép SKIP bình thường.

      if (
        required &&
        executionFailure
      ) {
        incompleteCount++;
      }

      continue;
    }

    // ================================================
    // FAIL
    // ================================================

    if (result === "FAIL") {
      failedRules++;

      const count = getIssueCount(
        row.issue_count
      );

      if (severity === "ERROR") {
        errorCount += count;
      } else if (
        severity === "WARNING"
      ) {
        warningCount += count;
      } else if (
        severity === "INFO"
      ) {
        // FAIL INFO chỉ cung cấp thông tin.
        // Không chuyển thành ERROR/WARNING.
      }

      continue;
    }

    // Trạng thái không hợp lệ từ validator.
    incompleteCount++;
  }

  // ====================================================
  // FINAL STATUS
  //
  // Mức ưu tiên:
  // ERROR > INCOMPLETE > WARNING > OK
  // ====================================================

  let status: MedicalCaseCheckStatus =
    "OK";

  if (errorCount > 0) {
    status = "ERROR";
  } else if (
    incompleteCount > 0 ||
    resultQuery.rows.length === 0
  ) {
    status = "INCOMPLETE";
  } else if (
    warningCount > 0
  ) {
    status = "WARNING";
  }

  return {
    status,
    errorCount,
    warningCount,
    incompleteCount,
    passedRules,
    failedRules,
    skippedRules,
    totalRules: resultQuery.rows.length,
  };
}

// ======================================================
// UPDATE CASE STATUS
// ======================================================

export async function updateCaseStatus(
  client: PoolClient,
  checkRunId: string,
  medicalCaseId: string
): Promise<CaseStatusResult> {
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
