
import type { RuleValidator } from "../rule.types.js";

const TOPIC_CODE = "TINH.DV.107";
const REJECTION_CODE = "S.005.655";

const DEFAULT_ENDOSCOPY_CODES = [
  "20.0013.0933",
  "20.0013.2048",
];

const DEFAULT_FOREIGN_BODY_CODES = [
  "15.0143.0907",
  "15.0143.0906",
  "15.0212.0900",
  "03.2117.0903",
  "15.0054.0903",
  "03.2117.0902",
  "03.2117.0901",
  "15.0054.0902",
];

type Config = {
  topicCode?: string;
  rejectionCode?: string;
  treatmentGroup?: string;
  endoscopyCodes?: string[];
  foreignBodyCodes?: string[];
};

type ServiceRow = {
  item_code: string | null;
  item_name: string | null;
};

type MatchedService = {
  code: string;
  name: string;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function readCodes(
  value: unknown,
  defaults: string[]
): string[] {
  if (!Array.isArray(value)) {
    return [...defaults];
  }

  return Array.from(
    new Set(
      value
        .filter((item) => typeof item === "string")
        .map(normalize)
        .filter(Boolean)
    )
  );
}

function pickServices(
  rows: ServiceRow[],
  codes: Set<string>
): MatchedService[] {
  const found = new Map<string, MatchedService>();

  for (const row of rows) {
    const code = normalize(row.item_code);

    if (!codes.has(code)) {
      continue;
    }

    if (!found.has(code)) {
      found.set(code, {
        code,
        name: String(row.item_name ?? "").trim() || code,
      });
    }
  }

  return Array.from(found.values()).sort((a, b) =>
    a.code.localeCompare(b.code)
  );
}

export const entForeignBodyCombinedPaymentRule:
  RuleValidator = {
  async evaluate(context, rule, runtime) {
    const config = (rule.config ?? {}) as Config;

    const topicCode =
      config.topicCode || TOPIC_CODE;

    const rejectionCode =
      config.rejectionCode || REJECTION_CODE;

    const endoscopyCodes = readCodes(
      config.endoscopyCodes,
      DEFAULT_ENDOSCOPY_CODES
    );

    const foreignBodyCodes = readCodes(
      config.foreignBodyCodes,
      DEFAULT_FOREIGN_BODY_CODES
    );

    const groupFromContext = normalize(
      (
        context.medicalCase as
          typeof context.medicalCase & {
            treatment_group?: string | null;
          }
      ).treatment_group
    );

    const caseId = context.medicalCase?.id;

    const baseDetails = {
      topicCode,
      rejectionCode,
      treatmentGroup: "GENERAL",
      endoscopyCodes,
      foreignBodyCodes,
      violations: [],
    };

    const result = (
      status: "PASS" | "FAIL" | "SKIP",
      issueCount: number,
      message: string,
      details: Record<string, unknown>
    ) => ({
      ruleId: rule.id,
      ruleCode: rule.code,
      status,
      severity: rule.severity,
      issueCount,
      message,
      details,
    });

    // Không tác động tới YHCT.
    if (groupFromContext === "YHCT") {
      return result(
        "SKIP",
        0,
        "Quy luật nội soi TMH và lấy dị vật không áp dụng cho YHCT.",
        {
          ...baseDetails,
          skipReason: "NOT_GENERAL",
        }
      );
    }

    if (!caseId) {
      return result(
        "SKIP",
        0,
        "Không xác định được mã hồ sơ.",
        {
          ...baseDetails,
          skipReason: "MISSING_CASE_ID",
        }
      );
    }

    // Hai danh sách không được trống.
    if (
      endoscopyCodes.length === 0 ||
      foreignBodyCodes.length === 0
    ) {
      return result(
        "SKIP",
        0,
        "Chưa cấu hình đầy đủ hai nhóm DVKT.",
        {
          ...baseDetails,
          skipReason: "EMPTY_SERVICE_CODES",
        }
      );
    }

    const configuredCodes = Array.from(
      new Set([
        ...endoscopyCodes,
        ...foreignBodyCodes,
      ])
    );

    // Đọc đúng sự kiện XML3 trong cùng một hồ sơ GENERAL.
    // Không so sánh dịch vụ giữa hai hồ sơ khác nhau.
    const query = await runtime.client.query<{
      treatment_group: string;
      item_code: string | null;
      item_name: string | null;
    }>(
      `
      SELECT
        mc.treatment_group,
        me.item_code,
        me.item_name

      FROM core.medical_cases mc

      LEFT JOIN core.medical_events me
        ON me.medical_case_id = mc.id
       AND UPPER(TRIM(me.source_type)) = 'XML3'
       AND UPPER(TRIM(me.item_code)) =
           ANY($2::text[])

      WHERE mc.id = $1

      ORDER BY me.item_code, me.item_name
      `,
      [caseId, configuredCodes]
    );

    if (query.rows.length === 0) {
      return result(
        "SKIP",
        0,
        "Không tìm thấy hồ sơ trong database.",
        {
          ...baseDetails,
          skipReason: "CASE_NOT_FOUND",
        }
      );
    }

    const databaseGroup = normalize(
      query.rows[0].treatment_group
    );

    if (databaseGroup !== "GENERAL") {
      return result(
        "SKIP",
        0,
        "Hồ sơ không thuộc nhóm GENERAL.",
        {
          ...baseDetails,
          skipReason: "NOT_GENERAL",
          databaseGroup,
        }
      );
    }

    const eventRows: ServiceRow[] = query.rows;

    const endoscopyServices = pickServices(
      eventRows,
      new Set(endoscopyCodes)
    );

    const foreignBodyServices = pickServices(
      eventRows,
      new Set(foreignBodyCodes)
    );

    const details = {
      ...baseDetails,
      matchedEndoscopy: endoscopyServices,
      matchedForeignBody: foreignBodyServices,
    };

    // Chỉ có một nhóm DVKT: không vi phạm.
    if (
      endoscopyServices.length === 0 ||
      foreignBodyServices.length === 0
    ) {
      return result(
        "PASS",
        0,
        "Không phát hiện thanh toán đồng thời nội soi TMH và lấy dị vật.",
        details
      );
    }

    const violations = [];

    // Một cảnh báo cho mỗi cặp mã DVKT khác nhau.
    for (const endoscopy of endoscopyServices) {
      for (const foreignBody of foreignBodyServices) {
        violations.push({
          type: "ENT_FOREIGN_BODY_COMBINED_PAYMENT",

          topicCode,
          rejectionCode,

          endoscopyCode: endoscopy.code,
          endoscopyName: endoscopy.name,

          foreignBodyCode: foreignBody.code,
          foreignBodyName: foreignBody.name,

          message:
            "Phát hiện thanh toán đồng thời nội soi TMH và lấy dị vật.",

          displayMessage:
            `[${topicCode} - ${rejectionCode}] ` +
            `Nội soi TMH: ${endoscopy.name} ` +
            `(${endoscopy.code}) ` +
            `thanh toán đồng thời với ` +
            `Lấy dị vật: ${foreignBody.name} ` +
            `(${foreignBody.code}). ` +
            `Cần rà soát điều kiện thanh toán BHYT.`,
        });
      }
    }

    return result(
      "FAIL",
      violations.length,
      `Phát hiện ${violations.length} cặp nội soi TMH và lấy dị vật cần rà soát.`,
      {
        ...details,
        violations,
      }
    );
  },
};
