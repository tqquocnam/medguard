import type {
  PoolClient,
} from "pg";

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


interface MedicalCaseRow {
 id: string;

  ma_lk?: string;
  ma_bn?: string;
  ho_ten?: string;

  ngay_vao?: Date | string;
  ngay_ra?: Date | string;

  status?: string;
}


interface XmlFileRow {
  xml_type: string;
  parsed_data: any;
}


export async function loadEnabledRules(
  client: PoolClient
): Promise<ValidationRule[]> {
  const result =
    await client.query(
      `
      SELECT
        id,
        code,
        name,
        description,

        validator_key,

        source_xml,
        target_xml,

        category,

        enabled,
        required,
        blocks_ok,

        severity,
        priority,

        config

      FROM validation.rules

      WHERE enabled = true

      ORDER BY
        priority ASC,
        code ASC
      `
    );

  return result.rows;
}


async function loadCaseContext(
  client: PoolClient,
  medicalCaseId: string
): Promise<MedicalCaseContext> {
  // =====================================
  // Hồ sơ
  // =====================================

  const caseResult =
    await client.query<MedicalCaseRow>(
      `
      SELECT
        id,
        ma_lk,
        ma_bn,
        ho_ten,
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


  // =====================================
  // XML1 → XML5
  // =====================================

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
    Record<string, any> =
    {};

  for (
    const xml
    of xmlResult.rows
  ) {
    xmlMap[
      String(xml.xml_type)
        .toUpperCase()
    ] =
      xml.parsed_data;
  }


  // =====================================
  // Events chuẩn hóa
  // =====================================

  const eventsResult =
    await client.query(
      `
      SELECT *

      FROM core.medical_events

      WHERE medical_case_id = $1

      ORDER BY
        start_time ASC NULLS LAST
      `,
      [medicalCaseId]
    );


  return {
    medicalCase,

    xml1:
      xmlMap.XML1,

    xml2:
      xmlMap.XML2,

    xml3:
      xmlMap.XML3,

    xml4:
      xmlMap.XML4,

    xml5:
      xmlMap.XML5,

    events:
      eventsResult.rows,

    catalog:
      {},
  };
}


function createSkipResult(
  rule: ValidationRule,
  message: string
): RuleResult {
  return {
    ruleId:
      rule.id,

    ruleCode:
      rule.code,

    status:
      "SKIP",

    severity:
      rule.severity,

    message,

    details: {},
  };
}


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


  // =====================================
  // Hồ sơ bắt đầu kiểm tra
  // =====================================

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


  for (
    const rule
    of rules
  ) {
    let ruleResult:
      RuleResult;


    try {
      // =====================================
      // Tìm validator tương ứng
      // =====================================

      const validatorKey =
        rule.validator_key;

      if (!validatorKey) {
        ruleResult =
          createSkipResult(
            rule,
            "Quy luật chưa khai báo validator."
          );
      } else {
        const validator =
          ruleRegistry[
            validatorKey
          ];

        if (!validator) {
          ruleResult =
            createSkipResult(
              rule,
              `Validator ${validatorKey} chưa được triển khai.`
            );
        } else {
          // =================================
          // Chạy validator
          // =================================

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
      console.error(
        `Rule ${rule.code} error:`,
        error
      );

      ruleResult =
        createSkipResult(
          rule,
          error instanceof Error
            ? error.message
            : "Không thể thực thi quy luật."
        );
    }


    // =====================================
    // Lưu PASS / FAIL / SKIP
    // =====================================

    await saveRuleResult(
      client,
      checkRunId,
      medicalCaseId,
      rule,
      ruleResult
    );
  }


  // =====================================
  // Tất cả rule chạy xong
  // mới được tính status
  // =====================================

  return await updateCaseStatus(
    client,
    checkRunId,
    medicalCaseId
  );
}

