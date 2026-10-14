
import type { PoolClient } from "pg";

import {
  ruleRegistry,
} from "./rule-registry.js";

import type {
  MedicalCaseContext,
  RuleResult,
  ValidationRule,
} from "./rule.types.js";

import {
  saveRuleResult,
  updateCaseStatus,
} from "./result.service.js";

// ======================================================
// TYPES
// ======================================================

interface MedicalCaseRow {
  id: string;

  ma_lk?: string | null;
  ma_bn?: string | null;
  ho_ten?: string | null;

  ma_loai_kcb?: string | null;
  treatment_group?: string | null;

  ma_benh_chinh?: string | null;
  ma_benh_kt?: string | null;

  ngay_vao?: Date | string | null;
  ngay_ra?: Date | string | null;

  status?: string | null;
}

interface XmlFileRow {
  xml_type: string;
  parsed_data: unknown;
}

type ExtendedMedicalCaseContext =
  MedicalCaseContext & {
    xml7?: unknown;
  };

// ======================================================
// HELPERS
// ======================================================

function normalizeText(
  value: unknown
): string {
  return String(value ?? "").trim();
}

function isYhctRule(
  rule: ValidationRule
): boolean {
  const code = normalizeText(
    rule.code
  ).toUpperCase();

  return code.startsWith("YHCT_");
}

function isYhctCase(
  context: MedicalCaseContext
): boolean {
  const medicalCase =
    context.medicalCase as MedicalCaseRow;

  return (
    normalizeText(
      medicalCase.treatment_group
    ).toUpperCase() === "YHCT"
  );
}

function createSkipResult(
  rule: ValidationRule,
  message: string,
  details: Record<string, unknown> = {}
): RuleResult {
  return {
    ruleId: rule.id,
    ruleCode: rule.code,

    status: "SKIP",
    severity: rule.severity,

    message,
    issueCount: 0,

    details,
  };
}

function createExecutionErrorResult(
  rule: ValidationRule,
  message: string,
  details: Record<string, unknown> = {}
): RuleResult {
  return createSkipResult(
    rule,
    message,
    {
      executionError: true,
      validatorCode: rule.code,
      ...details,
    }
  );
}

// ======================================================
// LOAD ENABLED RULES
// ======================================================

export async function loadEnabledRules(
  client: PoolClient
): Promise<ValidationRule[]> {
  const result =
    await client.query<ValidationRule>(
      `
      SELECT
        id,
        code,
        name,
        description,
        rule_type,
        enabled,
        severity,
        priority,
        config,
        required,
        blocks_ok,
        validator_key,
        source_xml,
        target_xml,
        category
      FROM validation.rules
      WHERE enabled = TRUE
      ORDER BY
        priority ASC,
        code ASC
      `
    );

  return result.rows;
}

// ======================================================
// LOAD CASE CONTEXT
// ======================================================

async function loadCaseContext(
  client: PoolClient,
  medicalCaseId: string
): Promise<MedicalCaseContext> {
  // ----------------------------------------------------
  // 1. THÔNG TIN HỒ SƠ
  // ----------------------------------------------------

  const caseResult =
    await client.query<MedicalCaseRow>(
      `
      
SELECT
  id,
  ma_lk,
  ma_bn,
  ho_ten,
  ma_loai_kcb,
  treatment_group,
  ngay_vao,
  ngay_ra,
  status
FROM core.medical_cases
WHERE id = $1
LIMIT 1

      `,
      [medicalCaseId]
    );

  const medicalCase =
    caseResult.rows[0];

  if (!medicalCase) {
    throw new Error(
      `Không tìm thấy hồ sơ ${medicalCaseId}`
    );
  }

  // ----------------------------------------------------
  // 2. ĐỌC TOÀN BỘ XML ĐƯỢC LƯU
  // ----------------------------------------------------

  const xmlResult =
    await client.query<XmlFileRow>(
      `
      SELECT
        xml_type,
        parsed_data
      FROM core.medical_xml_files
      WHERE medical_case_id = $1
      ORDER BY xml_type
      `,
      [medicalCaseId]
    );

  const xmlMap:
    Record<string, unknown> = {};

  for (const xml of xmlResult.rows) {
    const xmlType =
      normalizeText(
        xml.xml_type
      ).toUpperCase();

    if (!xmlType) {
      continue;
    }

    xmlMap[xmlType] =
      xml.parsed_data;
  }

  // ----------------------------------------------------
  // 3. EVENTS CHUẨN HÓA
  // ----------------------------------------------------

  const eventsResult =
    await client.query(
      `
      SELECT *
      FROM core.medical_events
      WHERE medical_case_id = $1
      ORDER BY start_time ASC NULLS LAST
      `,
      [medicalCaseId]
    );

  const context:
    ExtendedMedicalCaseContext = {
      medicalCase: medicalCase as
        MedicalCaseContext["medicalCase"],

      xml1: xmlMap.XML1,
      xml2: xmlMap.XML2,
      xml3: xmlMap.XML3,
      xml4: xmlMap.XML4,
      xml5: xmlMap.XML5,
      xml7: xmlMap.XML7,

      events:
        eventsResult.rows,

      catalog: {},
    };

  return context;
}

// ======================================================
// RUN RULES FOR CASE
// ======================================================

export async function runRulesForCase(
  client: PoolClient,
  checkRunId: string,
  medicalCaseId: string,
  rules: ValidationRule[]
) {
  const context =
    await loadCaseContext(
      client,
      medicalCaseId
    );

  const yhctCase =
    isYhctCase(context);

  // ----------------------------------------------------
  // 1. ĐÁNH DẤU ĐANG KIỂM TRA
  // ----------------------------------------------------

  await client.query(
    `
    UPDATE core.medical_cases
    SET
      status = 'CHECKING',
      error_count = 0,
      updated_at = NOW()
    WHERE id = $1
    `,
    [medicalCaseId]
  );

  // ----------------------------------------------------
  // 2. THỰC THI RULE
  // ----------------------------------------------------

  for (const rule of rules) {
    let ruleResult: RuleResult;

    const validatorKey =
      normalizeText(
        rule.code
      );

    try {
      // ================================================
      // RULE YHCT KHÔNG ÁP DỤNG CHO GENERAL
      // ================================================

      if (
        isYhctRule(rule) &&
        !yhctCase
      ) {
        ruleResult =
          createSkipResult(
            rule,
            "Rule YHCT không áp dụng cho hồ sơ KCB thông thường.",
            {
              skipReason:
                "NOT_APPLICABLE",
              treatmentGroup:
                "GENERAL",
            }
          );
      }

      // ================================================
      // THIẾU MÃ RULE
      // ================================================

      else if (!validatorKey) {
        ruleResult =
          createExecutionErrorResult(
            rule,
            "Rule chưa có mã code.",
            {
              errorType:
                "MISSING_RULE_CODE",
            }
          );
      }

      // ================================================
      // TÌM VÀ CHẠY VALIDATOR
      // ================================================

      else {
        const validator =
          ruleRegistry[
            validatorKey
          ];

        if (!validator) {
          ruleResult =
            createExecutionErrorResult(
              rule,
              `Validator ${validatorKey} chưa được triển khai.`,
              {
                errorType:
                  "VALIDATOR_NOT_FOUND",
              }
            );

          console.warn(
            `[RULE ENGINE] Validator not found: ${validatorKey}`
          );
        } else {
          ruleResult =
            await validator.evaluate(
              context,
              rule,
              {
                client,
                checkRunId,
              }
            );
        }
      }
    } catch (error) {
      // ================================================
      // LỖI KỸ THUẬT
      // ================================================

      console.error(
        `[RULE ENGINE] Rule ${rule.code} error:`,
        error
      );

      ruleResult =
        createExecutionErrorResult(
          rule,
          error instanceof Error
            ? `Không thể thực thi rule: ${error.message}`
            : "Không thể thực thi rule do lỗi kỹ thuật.",
          {
            errorType:
              "VALIDATOR_EXECUTION_ERROR",
          }
        );
    }

    // ------------------------------------------------
    // 3. LƯU KẾT QUẢ RULE
    // ------------------------------------------------

    await saveRuleResult(
      client,
      checkRunId,
      medicalCaseId,
      rule,
      ruleResult
    );
  }

  // ----------------------------------------------------
  // 4. CẬP NHẬT TRẠNG THÁI HỒ SƠ
  // ----------------------------------------------------

  return await updateCaseStatus(
    client,
    checkRunId,
    medicalCaseId
  );
}
