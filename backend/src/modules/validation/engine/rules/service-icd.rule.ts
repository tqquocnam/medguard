
import type {
  RuleValidator,
  RuleResult,
  ValidationRule,
} from "../rule.types.js";

// ======================================================
// TYPES
// ======================================================

interface ServiceIcdConfig {
  service_code: string;
  icd_code: string;
  allowed: boolean;
  active: boolean;
  note: string | null;
}

interface MedicalEvent {
  id?: string;
  source_type?: string;
  event_type?: string;
  item_code?: string;
  item_name?: string;
}

interface IcdViolation {
  type: string;
  eventId: string | null;
  serviceCode: string;
  serviceName: string | null;
  patientIcds: string[];
  configuredIcds: string[];
  matchedIcd?: string;
  reason: string;
}

// ======================================================
// HELPERS
// ======================================================

function normalizeCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function normalizeIcd(value: unknown): string {
  return normalizeCode(value)
    .replace(/\s+/g, "");
}

// ======================================================
// LẤY GIÁ TRỊ TỪ XML
// ======================================================

function collectValuesByKeys(
  data: unknown,
  keys: string[],
  result: string[] = []
): string[] {
  if (!data || typeof data !== "object") {
    return result;
  }

  const normalizedKeys = keys.map((key) =>
    key.toUpperCase()
  );

  if (Array.isArray(data)) {
    for (const item of data) {
      collectValuesByKeys(
        item,
        normalizedKeys,
        result
      );
    }

    return result;
  }

  for (const [key, value] of Object.entries(data)) {
    if (normalizedKeys.includes(key.toUpperCase())) {
      if (
        value !== null &&
        value !== undefined &&
        typeof value !== "object"
      ) {
        const text = String(value).trim();

        if (text) {
          result.push(text);
        }
      }
    }

    if (value && typeof value === "object") {
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
// TÁCH MÃ ICD
// ======================================================

function splitIcdValues(values: string[]): string[] {
  const result = values
    .flatMap((value) =>
      value.split(/[;,|]/)
    )
    .map(normalizeIcd)
    .filter(Boolean);

  return [...new Set(result)];
}

// ======================================================
// SO KHỚP ICD
//
// Mặc định EXACT để tránh cảnh báo sai.
// Có thể cấu hình icdMatchMode = PREFIX
// trong validation.branch_rules.config.
//
// Không tự động dùng CONTAINS.
// ======================================================

function matchIcd(
  patientIcd: string,
  configuredIcd: string,
  matchMode: string
): boolean {
  const patient = normalizeIcd(patientIcd);
  const configured = normalizeIcd(configuredIcd);

  if (!patient || !configured) {
    return false;
  }

  if (matchMode === "PREFIX") {
    return patient.startsWith(configured);
  }

  return patient === configured;
}

// ======================================================
// RULE RESULT
// ======================================================

function makeResult(
  rule: ValidationRule,
  status: "PASS" | "FAIL" | "SKIP",
  message: string,
  issueCount: number,
  details: Record<string, unknown> = {}
): RuleResult {
  return {
    ruleId: rule.id,
    ruleCode: rule.code,
    status,
    severity: rule.severity,
    issueCount,
    message,
    details,
  };
}

// ======================================================
// MAIN RULE
// ======================================================

export const serviceIcdRule: RuleValidator = {
  async evaluate(context, rule, runtime) {
    const client = runtime.client;

    // ================================================
    // 1. KIỂM TRA XML1
    // ================================================

    if (!context.xml1) {
      return makeResult(
        rule,
        "SKIP",
        "Chưa có XML1 để đối chiếu DVKT–ICD.",
        0,
        {
          skipReason: "MISSING_XML1",
        }
      );
    }

    // ================================================
    // 2. LẤY ICD CHÍNH VÀ ICD KÈM THEO
    // ================================================

    const rawIcdValues = collectValuesByKeys(
      context.xml1,
      [
        "MA_BENH_CHINH",
        "MA_BENH_KT",
        "MA_BENH_KEM_THEO",
        "MA_BENH",
      ]
    );

    const patientIcds = splitIcdValues(
      rawIcdValues
    );

    if (patientIcds.length === 0) {
      return makeResult(
        rule,
        "FAIL",
        "Hồ sơ không có mã ICD để đối chiếu DVKT.",
        1,
        {
          errorType: "MISSING_ICD",
          sourceXml: "XML1",
        }
      );
    }

    // ================================================
    // 3. LẤY DỊCH VỤ TỪ EVENTS / XML3
    // ================================================

    const services = (
      context.events as MedicalEvent[]
    ).filter((event) => {
      const sourceType = normalizeCode(
        event.source_type
      );

      const eventType = normalizeCode(
        event.event_type
      );

      const serviceCode = normalizeCode(
        event.item_code
      );

      if (!serviceCode) {
        return false;
      }

      return (
        sourceType === "XML3" ||
        eventType === "SERVICE" ||
        eventType === "LAB"
      );
    });

    if (services.length === 0) {
      return makeResult(
        rule,
        "SKIP",
        "Hồ sơ không có DVKT để đối chiếu ICD.",
        0,
        {
          skipReason: "NO_SERVICES",
          patientIcds,
        }
      );
    }

    // ================================================
    // 4. DANH SÁCH MÃ DVKT
    // ================================================

    const serviceCodes = [
      ...new Set(
        services
          .map((event) =>
            normalizeCode(event.item_code)
          )
          .filter(Boolean)
      ),
    ];

    // ================================================
    // 5. ĐỌC CẤU HÌNH DVKT–ICD
    //
    // ĐÚNG CẤU TRÚC POSTGRESQL HIỆN TẠI
    // ================================================

    const configResult =
      await client.query<ServiceIcdConfig>(
        `
        SELECT
          service_code,
          icd_code,
          allowed,
          active,
          note
        FROM catalog.service_icd_rules
        WHERE active = TRUE
          AND UPPER(TRIM(service_code)) =
              ANY($1::text[])
        ORDER BY
          service_code,
          icd_code
        `,
        [serviceCodes]
      );

    const configs = configResult.rows;

    if (configs.length === 0) {
      return makeResult(
        rule,
        "SKIP",
        "Không có cấu hình DVKT–ICD đang kích hoạt cho hồ sơ.",
        0,
        {
          skipReason: "NO_ACTIVE_CONFIG",
          patientIcds,
          serviceCodes,
        }
      );
    }

    // ================================================
    // 6. CHẾ ĐỘ ĐỐI CHIẾU ICD
    // ================================================

    const configuredMode = String(
      rule.config?.icdMatchMode ?? "EXACT"
    ).toUpperCase();

    const matchMode =
      configuredMode === "PREFIX"
        ? "PREFIX"
        : "EXACT";

    // ================================================
    // 7. GOM CẤU HÌNH THEO DVKT
    // ================================================

    const configMap = new Map<
      string,
      ServiceIcdConfig[]
    >();

    for (const config of configs) {
      const code = normalizeCode(
        config.service_code
      );

      const list = configMap.get(code) ?? [];

      list.push(config);

      configMap.set(code, list);
    }

    // ================================================
    // 8. KIỂM TRA TỪNG DVKT
    // ================================================

    const violations: IcdViolation[] = [];

    const passedServices:
      Record<string, unknown>[] = [];

    const checkedEventIds = new Set<string>();

    let skippedCount = 0;

    for (const service of services) {
      const serviceCode = normalizeCode(
        service.item_code
      );

      const rules = configMap.get(serviceCode);

      // DVKT không có cấu hình:
      // không tự động kết luận sai.
      if (!rules || rules.length === 0) {
        skippedCount++;
        continue;
      }

      const eventId = String(
        service.id ?? ""
      );

      if (
        eventId &&
        checkedEventIds.has(eventId)
      ) {
        continue;
      }

      if (eventId) {
        checkedEventIds.add(eventId);
      }

      // ==============================================
      // TÁCH DANH SÁCH CHO PHÉP / HẠN CHẾ
      // ==============================================

      const allowRules = rules.filter(
        (r) => r.allowed === true
      );

      const denyRules = rules.filter(
        (r) => r.allowed === false
      );

      // ==============================================
      // KIỂM TRA DANH SÁCH HẠN CHẾ TRƯỚC
      // ==============================================

      const deniedMatch = denyRules.find(
        (config) =>
          patientIcds.some((icd) =>
            matchIcd(
              icd,
              config.icd_code,
              matchMode
            )
          )
      );

      if (deniedMatch) {
        violations.push({
          type: "SERVICE_ICD_DENIED",
          eventId: eventId || null,
          serviceCode,
          serviceName:
            service.item_name ?? null,
          patientIcds,
          configuredIcds:
            denyRules.map((r) => r.icd_code),
          matchedIcd: deniedMatch.icd_code,
          reason:
            "Mã ICD của hồ sơ trùng với danh sách hạn chế của DVKT.",
        });

        continue;
      }

      // ==============================================
      // KIỂM TRA DANH SÁCH CHO PHÉP
      //
      // Nếu không cấu hình allow:
      // không áp dụng kiểm tra whitelist.
      // ==============================================

      if (allowRules.length > 0) {
        const allowedMatch = allowRules.find(
          (config) =>
            patientIcds.some((icd) =>
              matchIcd(
                icd,
                config.icd_code,
                matchMode
              )
            )
        );

        if (!allowedMatch) {
          violations.push({
            type: "SERVICE_ICD_NOT_ALLOWED",
            eventId: eventId || null,
            serviceCode,
            serviceName:
              service.item_name ?? null,
            patientIcds,
            configuredIcds:
              allowRules.map(
                (r) => r.icd_code
              ),
            reason:
              "Không tìm thấy ICD của hồ sơ trong danh sách ICD được phép cho DVKT.",
          });

          continue;
        }
      }

      // ==============================================
      // DVKT HỢP LỆ THEO CẤU HÌNH
      // ==============================================

      passedServices.push({
        eventId: eventId || null,
        serviceCode,
        serviceName:
          service.item_name ?? null,
        patientIcds,
        matchMode,
        allowRuleCount: allowRules.length,
        denyRuleCount: denyRules.length,
      });
    }

    // ================================================
    // 9. CÓ VI PHẠM
    // ================================================

    if (violations.length > 0) {
      return makeResult(
        rule,
        "FAIL",
        `Phát hiện ${violations.length} DVKT không phù hợp quy tắc ICD đã cấu hình.`,
        violations.length,
        {
          patientIcds,
          matchMode,
          checkedCount:
            passedServices.length +
            violations.length,
          skippedCount,
          passedServices,
          violations,
        }
      );
    }

    // ================================================
    // 10. KHÔNG CÓ DVKT NÀO ĐƯỢC ĐỐI CHIẾU
    // ================================================

    if (passedServices.length === 0) {
      return makeResult(
        rule,
        "SKIP",
        "Không có DVKT phù hợp cấu hình để thực hiện đối chiếu ICD.",
        0,
        {
          patientIcds,
          skippedCount,
        }
      );
    }

    // ================================================
    // 11. PASS
    // ================================================

    return makeResult(
      rule,
      "PASS",
      `Đã đối chiếu ${passedServices.length} DVKT theo ICD, không phát hiện vi phạm cấu hình.`,
      0,
      {
        patientIcds,
        matchMode,
        checkedCount: passedServices.length,
        skippedCount,
        passedServices,
      }
    );
  },
};
