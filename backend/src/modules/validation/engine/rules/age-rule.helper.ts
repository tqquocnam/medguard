
import type { RuleValidator } from "../rule.types.js";

type XmlObject = Record<string, unknown>;

type AgeCatalog = "drug" | "service";

interface AgeItem {
  code: string;
  time: string;
  stt: string;
  name: string;
}

interface AgeRuleRow {
  id: string;
  code: string;
  min_age: number | null;
  max_age: number | null;
  allowed: boolean;
  note: string | null;
}

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function object(value: unknown): XmlObject {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as XmlObject;
  }
  return {};
}

function array(value: unknown): XmlObject[] {
  if (Array.isArray(value)) {
    return value
      .filter(
        (v) => v && typeof v === "object" &&
          !Array.isArray(v)
      )
      .map((v) => v as XmlObject);
  }

  if (value && typeof value === "object") {
    return [object(value)];
  }

  return [];
}

// Tìm một trường trong JSON XML đã được parse.
// Hỗ trợ cả JSON có hoặc không có wrapper.
function findField(
  value: unknown,
  field: string,
  depth = 0
): unknown {
  if (!value || depth > 7) return undefined;

  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findField(child, field, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  if (typeof value !== "object") return undefined;

  const data = value as XmlObject;

  if (Object.prototype.hasOwnProperty.call(data, field)) {
    return data[field];
  }

  for (const child of Object.values(data)) {
    const found = findField(child, field, depth + 1);
    if (found !== undefined) return found;
  }

  return undefined;
}

function xmlRows(
  xml: unknown,
  rowTag: string
): XmlObject[] {
  return array(findField(xml, rowTag));
}

function validDate(value: unknown): Date | null {
  const raw = str(value);

  if (!/^\d{8}(\d{4}(\d{2})?)?$/.test(raw)) {
    return null;
  }

  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function yearAge(
  birthValue: unknown,
  serviceValue: unknown
): number | null {
  const birth = validDate(birthValue);
  const service = validDate(serviceValue);

  if (!birth || !service || service < birth) {
    return null;
  }

  let age =
    service.getUTCFullYear() -
    birth.getUTCFullYear();

  const hasHadBirthday =
    service.getUTCMonth() > birth.getUTCMonth() ||
    (
      service.getUTCMonth() === birth.getUTCMonth() &&
      service.getUTCDate() >= birth.getUTCDate()
    );

  if (!hasHadBirthday) age--;

  return age;
}


function normalizeDateValue(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return "";
    }

    const year = value.getFullYear();
    const month = String(
      value.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      value.getDate()
    ).padStart(2, "0");

    return `${year}${month}${day}`;
  }

  const raw = str(value);

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10).replace(/-/g, "");
  }

  return raw;
}


function inRange(
  age: number,
  min: number | null,
  max: number | null
): boolean {
  return (
    (min === null || age >= min) &&
    (max === null || age <= max)
  );
}

export function createAgeValidator(
  catalogType: AgeCatalog
): RuleValidator {
  const isDrug = catalogType === "drug";

  const table = isDrug
    ? "catalog.drug_age_rules"
    : "catalog.service_age_rules";

  const codeColumn = isDrug
    ? "drug_code"
    : "service_code";

  return {
    async evaluate(context, rule, runtime) {
      const base = {
        ruleId: rule.id,
        ruleCode: rule.code,
        severity: rule.severity,
      };

      // XML2: thuốc
      // XML3: DVKT
      const xml = isDrug
        ? context.xml2
        : context.xml3;

      const rawRows = xmlRows(
        xml,
        isDrug ? "CHI_TIET_THUOC" : "CHI_TIET_DVKT"
      );

      if (rawRows.length === 0) {
        return {
          ...base,
          status: "SKIP",
          message: isDrug
            ? "Hồ sơ không có thuốc XML2 để kiểm tra tuổi."
            : "Hồ sơ không có DVKT XML3 để kiểm tra tuổi.",
          issueCount: 0,
          details: {
            skipReason: "NO_ITEMS",
            violations: [],
          },
        };
      }

      const items: AgeItem[] = rawRows.map((row) => ({
        code: str(
          isDrug ? row.MA_THUOC : row.MA_DICH_VU
        ),
        name: str(
          isDrug ? row.TEN_THUOC : row.TEN_DICH_VU
        ),
        stt: str(row.STT),
        time: str(
          isDrug
            ? (
                row.NGAY_TH_YL ||
                row.NGAY_YL
              )
            : (
                row.NGAY_TH_YL ||
                row.NGAY_YL
              )
        ),
      }));

      const codes = [
        ...new Set(
          items.map((x) => x.code).filter(Boolean)
        ),
      ];

      if (codes.length === 0) {
        return {
          ...base,
          status: "SKIP",
          message: "Không có mã thuốc/DVKT để đối chiếu tuổi.",
          issueCount: 0,
          details: {
            skipReason: "NO_ITEM_CODES",
            totalItems: items.length,
            violations: [],
          },
        };
      }

      // Chỉ lấy quy tắc đang hoạt động.
      // Tên bảng và cột là hằng số trong code,
      // không nhận từ input bên ngoài.
      const query = await runtime.client.query<AgeRuleRow>(
        `
        SELECT
          id,
          ${codeColumn} AS code,
          min_age,
          max_age,
          allowed,
          note
        FROM ${table}
        WHERE active = TRUE
          AND ${codeColumn} = ANY($1::varchar[])
        `,
        [codes]
      );

      const rulesByCode = new Map<string, AgeRuleRow[]>();

      for (const ageRule of query.rows) {
        const key = str(ageRule.code);
        const list = rulesByCode.get(key) ?? [];

        list.push(ageRule);
        rulesByCode.set(key, list);
      }

      // Chưa cấu hình quy tắc nào cho các mã
      // trong hồ sơ thì tuyệt đối không PASS.
      if (query.rows.length === 0) {
        return {
          ...base,
          status: "SKIP",
          message:
            `Chưa cấu hình quy tắc độ tuổi cho ` +
            `${isDrug ? "thuốc" : "DVKT"} của hồ sơ.`,
          issueCount: 0,
          details: {
            skipReason: "NO_AGE_RULES",
            totalItems: items.length,
            checkedCodes: codes,
            violations: [],
          },
        };
      }

      const birth = findField(
        context.xml1,
        "NGAY_SINH"
      );

      const caseDate =
        context.medicalCase.ngay_vao;

      const fallbackDate = caseDate instanceof Date
        ? [
            caseDate.getFullYear(),
            String(caseDate.getMonth() + 1).padStart(2, "0"),
            String(caseDate.getDate()).padStart(2, "0"),
          ].join("")
        : normalizeDateValue(caseDate);

      const violations: Array<{
        type: string;
        code: string;
        name: string;
        stt: string;
        age: number;
        time: string;
        message: string;
        matchedRuleIds: string[];
      }> = [];

      const uncoveredItems: Array<{
        code: string;
        stt: string;
        reason: string;
      }> = [];

      let evaluatedItems = 0;

      for (const item of items) {
        const candidates =
          rulesByCode.get(item.code) ?? [];

        if (candidates.length === 0) {
          uncoveredItems.push({
            code: item.code,
            stt: item.stt,
            reason: "NO_RULE_FOR_CODE",
          });
          continue;
        }

        const when = item.time || fallbackDate;
        const age = yearAge(birth, when);

        if (age === null) {
          uncoveredItems.push({
            code: item.code,
            stt: item.stt,
            reason: "INVALID_BIRTH_OR_SERVICE_DATE",
          });
          continue;
        }

        // Chỉ xử lý quy tắc có giới hạn tuổi.
        // Tránh allowed=false với hai ngưỡng NULL
        // vô tình cấm mọi độ tuổi.
        const usable = candidates.filter(
          (r) =>
            r.min_age !== null ||
            r.max_age !== null
        );

        if (usable.length === 0) {
          uncoveredItems.push({
            code: item.code,
            stt: item.stt,
            reason: "AGE_RANGE_NOT_CONFIGURED",
          });
          continue;
        }

        // Bỏ qua cấu hình khoảng tuổi ngược,
        // không tự coi là bệnh nhân vi phạm.
        const valid = usable.filter(
          (r) =>
            r.min_age === null ||
            r.max_age === null ||
            Number(r.min_age) <= Number(r.max_age)
        );

        if (valid.length !== usable.length) {
          uncoveredItems.push({
            code: item.code,
            stt: item.stt,
            reason: "INVALID_AGE_RULE_CONFIGURATION",
          });
          continue;
        }

        evaluatedItems++;

        const matchingForbidden = valid.filter(
          (r) =>
            r.allowed === false &&
            inRange(
              age,
              r.min_age,
              r.max_age
            )
        );

        const positiveRules = valid.filter(
          (r) => r.allowed === true
        );

        const allowedByPositiveRule =
          positiveRules.length === 0 ||
          positiveRules.some(
            (r) =>
              inRange(age, r.min_age, r.max_age)
          );

        if (
          matchingForbidden.length > 0 ||
          !allowedByPositiveRule
        ) {
          const type =
            matchingForbidden.length > 0
              ? "AGE_FORBIDDEN"
              : "AGE_OUTSIDE_ALLOWED_RANGE";

          violations.push({
            type,
            code: item.code,
            name: item.name,
            stt: item.stt,
            age,
            time: when,
            matchedRuleIds: (
              matchingForbidden.length > 0
                ? matchingForbidden
                : positiveRules
            ).map((r) => String(r.id)),
            message:
              `${isDrug ? "Thuốc" : "DVKT"} ` +
              `"${item.code}", bệnh nhân ${age} tuổi: ` +
              (
                type === "AGE_FORBIDDEN"
                  ? "nằm trong khoảng tuổi không được phép."
                  : "nằm ngoài các khoảng tuổi được phép."
              ),
          });
        }
      }

      if (violations.length > 0) {
        return {
          ...base,
          status: "FAIL",
          message:
            `Phát hiện ${violations.length} lượt ` +
            `${isDrug ? "sử dụng thuốc" : "thực hiện DVKT"} ` +
            "không phù hợp quy tắc độ tuổi đã cấu hình.",
          issueCount: violations.length,
          details: {
            totalItems: items.length,
            evaluatedItems,
            uncoveredItems,
            violations,
          },
        };
      }

      if (uncoveredItems.length > 0) {
        return {
          ...base,
          status: "SKIP",
          message:
            `Đã đánh giá ${evaluatedItems}/${items.length} dòng; ` +
            `${uncoveredItems.length} dòng chưa đủ ` +
            "quy tắc hoặc dữ liệu để kết luận.",
          issueCount: 0,
          details: {
            skipReason: "PARTIAL_COVERAGE",
            totalItems: items.length,
            evaluatedItems,
            uncoveredItems,
            violations: [],
          },
        };
      }

      return {
        ...base,
        status: "PASS",
        message:
          `Kiểm tra tuổi đạt: ${evaluatedItems} ` +
          `${isDrug ? "dòng thuốc" : "dòng DVKT"}.`,
        issueCount: 0,
        details: {
          totalItems: items.length,
          evaluatedItems,
          uncoveredItems: [],
          violations: [],
        },
      };
    },
  };
}
