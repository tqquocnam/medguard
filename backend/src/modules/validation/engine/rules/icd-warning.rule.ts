import type {
  RuleValidator,
} from "../rule.types.js";


// ======================================================
// TÌM GIÁ TRỊ THEO KEY TRONG XML/JSON
// ======================================================

function collectValuesByKeys(
  data: unknown,
  keys: string[],
  result: string[] = []
): string[] {

  if (
    data === null ||
    data === undefined ||
    typeof data !== "object"
  ) {
    return result;
  }

  const normalizedKeys =
    keys.map(
      (key) =>
        key.toUpperCase()
    );


  for (
    const [key, value]
    of Object.entries(
      data as Record<string, unknown>
    )
  ) {

    const upperKey =
      key.toUpperCase();


    if (
      normalizedKeys.includes(
        upperKey
      )
    ) {

      if (
        value !== null &&
        value !== undefined &&
        typeof value !== "object"
      ) {

        const text =
          String(value).trim();

        if (text) {
          result.push(text);
        }
      }
    }


    if (
      value &&
      typeof value === "object"
    ) {

      collectValuesByKeys(
        value,
        normalizedKeys,
        result
      );
    }
  }


  return result;
}


// ======================================================
// TÁCH DANH SÁCH ICD
//
// Ví dụ:
//
// "M62.9;I10;E11.9"
// =>
// ["M62.9", "I10", "E11.9"]
// ======================================================

function extractIcdCodes(
  values: string[]
): string[] {

  const codes =
    new Set<string>();


  for (
    const value
    of values
  ) {

    const parts =
      String(value)
        .split(/[;,|\n\r]+/)
        .map(
          (item) =>
            item
              .trim()
              .toUpperCase()
        )
        .filter(Boolean);


    for (
      const code
      of parts
    ) {

      codes.add(code);
    }
  }


  return Array.from(
    codes
  );
}


// ======================================================
// RULE
// ======================================================

export const icdWarningRule:
  RuleValidator = {

  async evaluate(
    context,
    rule,
    runtime
  ) {

    const client =
      runtime.client;


    // ==================================================
    // 1. PHẢI CÓ XML1
    // ==================================================

    if (!context.xml1) {

      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "SKIP",

        severity:
          rule.severity,

        issueCount:
          0,

        message:
          "Không có XML1 để kiểm tra ICD cảnh báo.",

        details: {
          violations: [],
        },
      };
    }


    // ==================================================
    // 2. LẤY ICD TRONG HỒ SƠ
    //
    // Kiểm:
    // - bệnh chính
    // - bệnh kèm theo
    // ==================================================

    const rawValues =
      collectValuesByKeys(
        context.xml1,
        [
          "MA_BENH_CHINH",
          "MA_BENH_KT",
        ]
      );


    const icdCodes =
      extractIcdCodes(
        rawValues
      );


    // ==================================================
    // KHÔNG CÓ ICD
    // ==================================================

    if (
      icdCodes.length ===
      0
    ) {

      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "PASS",

        severity:
          rule.severity,

        issueCount:
          0,

        message:
          "Không có ICD để kiểm tra cảnh báo.",

        details: {
          icdCodes: [],
          violations: [],
        },
      };
    }


    // ==================================================
    // 3. ĐỐI CHIẾU DANH MỤC ICD CẢNH BÁO
    // ==================================================

    const result =
      await client.query(
        `
        SELECT
          icd_code,
          error_code,
          disease_name,
          error_message,
          note

        FROM
          catalog.icd_warning_rules

        WHERE
          active = true

          AND

          UPPER(TRIM(icd_code)) =
            ANY($1::varchar[])

        ORDER BY
          icd_code,
          error_code
        `,
        [
          icdCodes,
        ]
      );


    // ==================================================
    // 4. TẠO DANH SÁCH LỖI
    // ==================================================

    const violations =
      result.rows.map(
        (row) => {

          const icdCode =
            String(
              row.icd_code
            ).trim();

          const errorCode =
            String(
              row.error_code
            ).trim();

          const errorMessage =
            String(
              row.error_message
            ).trim();


          return {

            type:
              "ICD_WARNING",

            icdCode,

            errorCode,

            diseaseName:
              row.disease_name,

            message:
              errorMessage,

            note:
              row.note,

            displayMessage:
              `${icdCode} - ` +
              `[${errorCode}]: ` +
              `${errorMessage}`,
          };
        }
      );


    // ==================================================
    // 5. CÓ ICD CẢNH BÁO
    // ==================================================

    if (
      violations.length >
      0
    ) {

      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "FAIL",

        severity:
          rule.severity,

        issueCount:
          violations.length,

        message:
          `Phát hiện ${violations.length} mã ICD thuộc danh mục cảnh báo.`,

        details: {

          icdCodes,

          violations,
        },
      };
    }


    // ==================================================
    // 6. PASS
    // ==================================================

    return {
      ruleId:
        rule.id,

      ruleCode:
        rule.code,

      status:
        "PASS",

      severity:
        rule.severity,

      issueCount:
        0,

      message:
        "Không phát hiện ICD thuộc danh mục cảnh báo.",

      details: {

        icdCodes,

        violations: [],
      },
    };
  },
};