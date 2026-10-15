
import type { RuleValidator } from "../rule.types.js";

// ======================================================
// RULE: KHÔNG THANH TOÁN ĐỒNG THỜI
// ĐỊNH LƯỢNG CANXI TOÀN PHẦN VÀ ĐIỆN GIẢI ĐỒ
//
// Phạm vi: GENERAL
// Nguồn dữ liệu: XML3
// Mức mặc định: WARNING
// ======================================================

const DEFAULT_SERVICE_A = "23.0029.1473";
const DEFAULT_SERVICE_B = "23.0058.1487";

type RuleConfig = {
  serviceACode?: string;
  serviceBCode?: string;
  treatmentGroup?: string;
};

type ServiceRow = {
  item_code: string | null;
  item_name: string | null;
};

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

export const serviceCalciumElectrolyteExclusionRule:
  RuleValidator = {

  async evaluate(context, rule, runtime) {
    const config = (rule.config ?? {}) as RuleConfig;

    const serviceACode = normalize(
      config.serviceACode ?? DEFAULT_SERVICE_A
    );

    const serviceBCode = normalize(
      config.serviceBCode ?? DEFAULT_SERVICE_B
    );

    const caseId = context.medicalCase?.id;

    const treatmentGroup = normalize(
      (
        context.medicalCase as
          typeof context.medicalCase & {
            treatment_group?: string | null;
          }
      ).treatment_group
    );

    const baseDetails = {
      serviceACode,
      serviceBCode,
      checkedScope: "GENERAL",
      ruleType: "MUTUALLY_EXCLUSIVE_SERVICES",
      violations: [],
    };

    const createResult = (
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

    // ==================================================
    // 1. CHỈ KIỂM TRA GENERAL
    // ==================================================

    if (treatmentGroup === "YHCT") {
      return createResult(
        "SKIP",
        0,
        "Quy luật Canxi - Điện giải đồ không áp dụng cho YHCT.",
        {
          ...baseDetails,
          skipReason: "NOT_GENERAL",
        }
      );
    }

    if (!caseId) {
      return createResult(
        "SKIP",
        0,
        "Không xác định được hồ sơ.",
        {
          ...baseDetails,
          skipReason: "MISSING_CASE_ID",
        }
      );
    }

    // ==================================================
    // 2. KIỂM TRA CẤU HÌNH
    // ==================================================

    if (
      !serviceACode ||
      !serviceBCode ||
      serviceACode === serviceBCode
    ) {
      return createResult(
        "SKIP",
        0,
        "Cấu hình hai mã DVKT không hợp lệ.",
        {
          ...baseDetails,
          skipReason: "INVALID_CONFIG",
        }
      );
    }

    // ==================================================
    // 3. LẤY HAI DVKT TỪ XML3
    //
    // Chỉ đối chiếu trong cùng một medical_case_id.
    // Không yêu cầu thời gian thực hiện giao nhau.
    // ==================================================

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
      ORDER BY
        me.item_code,
        me.item_name
      `,
      [
        caseId,
        [serviceACode, serviceBCode],
      ]
    );

    if (query.rows.length === 0) {
      return createResult(
        "SKIP",
        0,
        "Không tìm thấy hồ sơ trong database.",
        {
          ...baseDetails,
          skipReason: "CASE_NOT_FOUND",
        }
      );
    }

    const dbGroup = normalize(
      query.rows[0].treatment_group
    );

    if (dbGroup !== "GENERAL") {
      return createResult(
        "SKIP",
        0,
        "Hồ sơ không thuộc nhóm GENERAL.",
        {
          ...baseDetails,
          skipReason: "NOT_GENERAL",
        }
      );
    }

    // ==================================================
    // 4. TÌM DVKT A VÀ B
    // ==================================================

    const rows: ServiceRow[] = query.rows;

    const serviceA = rows.find(
      (row) =>
        normalize(row.item_code) === serviceACode
    );

    const serviceB = rows.find(
      (row) =>
        normalize(row.item_code) === serviceBCode
    );

    const serviceAName = String(
      serviceA?.item_name ??
      "Định lượng Canxi toàn phần [Máu]"
    ).trim();

    const serviceBName = String(
      serviceB?.item_name ??
      "Điện giải đồ (Na, K, Cl) [Máu]"
    ).trim();

    const sharedDetails = {
      ...baseDetails,
      hasServiceA: Boolean(serviceA),
      hasServiceB: Boolean(serviceB),
      serviceA: serviceA
        ? {
            code: serviceACode,
            name: serviceAName,
          }
        : null,
      serviceB: serviceB
        ? {
            code: serviceBCode,
            name: serviceBName,
          }
        : null,
    };

    // ==================================================
    // 5. CHỈ CÓ MỘT TRONG HAI HOẶC KHÔNG CÓ CẢ HAI
    // ==================================================

    if (!serviceA || !serviceB) {
      return createResult(
        "PASS",
        0,
        "Không phát hiện chỉ định đồng thời Canxi toàn phần và Điện giải đồ.",
        {
          ...sharedDetails,
          violations: [],
        }
      );
    }

    // ==================================================
    // 6. CÓ CẢ HAI TRONG CÙNG HỒ SƠ
    // ==================================================

    const displayMessage =
      `Không thanh toán đồng thời hai DVKT: ` +
      `${serviceAName} (${serviceACode}) ` +
      `và ${serviceBName} (${serviceBCode}). ` +
      `Hồ sơ có cả hai dịch vụ, cần rà soát ` +
      `điều kiện thanh toán.`;

    const violations = [
      {
        type: "SERVICE_CALCIUM_ELECTROLYTE_EXCLUSION",

        serviceACode,
        serviceAName,

        serviceBCode,
        serviceBName,

        message:
          "Phát hiện đồng thời hai DVKT chỉ được lựa chọn một.",

        displayMessage,
      },
    ];

    return createResult(
      "FAIL",
      1,
      "Phát hiện đồng thời Định lượng Canxi toàn phần và Điện giải đồ trong cùng hồ sơ.",
      {
        ...sharedDetails,
        violations,
      }
    );
  },
};
