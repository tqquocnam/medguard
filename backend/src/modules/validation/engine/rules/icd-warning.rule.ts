
import type { RuleValidator } from "../rule.types.js";

// ======================================================
// HELPERS
// ======================================================

function collectValuesByKeys(
  data: unknown,
  keys: string[],
  result: string[] = []
): string[] {
  if (data === null || data === undefined) {
    return result;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      collectValuesByKeys(item, keys, result);
    }
    return result;
  }

  if (typeof data !== "object") {
    return result;
  }

  const keySet = new Set(
    keys.map((key) => key.toUpperCase())
  );

  for (const [key, value] of Object.entries(data)) {
    if (
      keySet.has(key.toUpperCase()) &&
      value !== null &&
      value !== undefined &&
      typeof value !== "object"
    ) {
      const text = String(value).trim();

      if (text) {
        result.push(text);
      }
    }

    if (value && typeof value === "object") {
      collectValuesByKeys(value, keys, result);
    }
  }

  return result;
}

function extractIcdCodes(values: string[]): string[] {
  const codes = new Set<string>();

  for (const value of values) {
    const parts = value
      .split(/[;,|\n\r]+/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    for (const code of parts) {
      codes.add(code);
    }
  }

  return Array.from(codes);
}

type Gender = "MALE" | "FEMALE" | "UNKNOWN";

function resolveGender(xml1: unknown): Gender {
  const values = collectValuesByKeys(
    xml1,
    ["GIOI_TINH"]
  );

  const genders = new Set<Gender>();

  for (const value of values) {
    const normalized = value
      .trim()
      .toUpperCase();

    if (normalized === "1" || normalized === "NAM") {
      genders.add("MALE");
    } else if (
      normalized === "2" ||
      normalized === "NỮ" ||
      normalized === "NU"
    ) {
      genders.add("FEMALE");
    } else {
      genders.add("UNKNOWN");
    }
  }

  if (genders.size !== 1) {
    return "UNKNOWN";
  }

  return Array.from(genders)[0];
}

// ======================================================
// ICD WARNING RULE
// ======================================================

export const icdWarningRule: RuleValidator = {
  async evaluate(context, rule, runtime) {
    const client = runtime.client;

    if (!context.xml1) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,
        status: "SKIP",
        severity: rule.severity,
        issueCount: 0,
        message: "Không có XML1 để kiểm tra ICD.",
        details: {
          violations: [],
          skipReason: "MISSING_XML1",
        },
      };
    }

    // 1. Lấy ICD từ XML1
    const rawValues = collectValuesByKeys(
      context.xml1,
      ["MA_BENH_CHINH", "MA_BENH_KT"]
    );

    const icdCodes = extractIcdCodes(rawValues);

    // 2. Lấy giới tính từ XML1
    const gender = resolveGender(context.xml1);

    if (icdCodes.length === 0) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,
        status: "PASS",
        severity: rule.severity,
        issueCount: 0,
        message: "Không có ICD để kiểm tra cảnh báo.",
        details: {
          icdCodes: [],
          gender,
          violations: [],
        },
      };
    }

    // 3. Đối chiếu danh mục ICD cảnh báo
    const result = await client.query<{
      icd_code: string;
      error_code: string;
      disease_name: string | null;
      error_message: string | null;
      note: string | null;
    }>(
      `
      SELECT
        icd_code,
        error_code,
        disease_name,
        error_message,
        note
      FROM catalog.icd_warning_rules
      WHERE active = TRUE
        AND UPPER(TRIM(icd_code)) =
            ANY($1::varchar[])
      ORDER BY icd_code, error_code
      `,
      [icdCodes]
    );

    const violations = [];
    const unresolvedGenderRules = [];
    const excludedGenderRules = [];

    // 4. Kiểm tra điều kiện riêng từng cảnh báo
    for (const row of result.rows) {
      const icdCode = String(
        row.icd_code ?? ""
      ).trim().toUpperCase();

      const errorCode = String(
        row.error_code ?? ""
      ).trim().toUpperCase();

      const errorMessage = String(
        row.error_message ?? ""
      ).trim();
      
      // ================================================
      // ERR-28: Mã bệnh chỉ có/chủ yếu ở nữ giới
      // ================================================

      if (errorCode === "ERR-28") {
        if (gender === "FEMALE") {
          excludedGenderRules.push({
            icdCode,
            errorCode,
            reason: "PATIENT_IS_FEMALE",
          });
          continue;
        }

        if (gender === "UNKNOWN") {
          unresolvedGenderRules.push({
            icdCode,
            errorCode,
            message:
              "Không xác định được giới tính XML1 để đối chiếu ERR-28.",
          });
          continue;
        }

        // MALE: giữ cảnh báo ERR-28
      }


      // ERR-29: Mã bệnh chỉ có/chủ yếu ở nam giới
      if (errorCode === "ERR-29") {
        if (gender === "MALE") {
          excludedGenderRules.push({
            icdCode,
            errorCode,
            reason: "PATIENT_IS_MALE",
          });
          continue;
        }

        if (gender === "UNKNOWN") {
          unresolvedGenderRules.push({
            icdCode,
            errorCode,
            message:
              "Không xác định được giới tính XML1 để đối chiếu ERR-29.",
          });
          continue;
        }

        // FEMALE: giữ cảnh báo ERR-29
      }

      violations.push({
        type: "ICD_WARNING",
        icdCode,
        errorCode,
        diseaseName: row.disease_name,
        message: errorMessage,
        note: row.note,
        displayMessage:
          `${icdCode} - [${errorCode}]: ${errorMessage}`,
      });
    }

    const details = {
      icdCodes,
      gender,
      violations,
      excludedGenderRules,
      unresolvedGenderRules,
    };

    if (violations.length > 0) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,
        status: "FAIL",
        severity: rule.severity,
        issueCount: violations.length,
        message:
          `Phát hiện ${violations.length} mã ICD ` +
          "thuộc danh mục cảnh báo.",
        details,
      };
    }

    if (unresolvedGenderRules.length > 0) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,
        status: "SKIP",
        severity: rule.severity,
        issueCount: 0,
        message:
          "Chưa đủ dữ liệu giới tính để kết luận cảnh báo ICD.",
        details,
      };
    }

    return {
      ruleId: rule.id,
      ruleCode: rule.code,
      status: "PASS",
      severity: rule.severity,
      issueCount: 0,
      message:
        "Không phát hiện ICD vi phạm điều kiện cảnh báo.",
      details,
    };
  },
};
