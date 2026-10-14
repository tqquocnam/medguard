
import type { RuleValidator } from "../rule.types.js";

type StaffField = "MA_BAC_SI" | "NGUOI_THUC_HIEN";

interface StaffUsage {
  field: StaffField;
  sourceType: string;
  eventId: string | null;
  itemCode: string | null;
  itemName: string | null;
  departmentCode: string | null;
}

interface StaffEntry {
  code: string;
  normalizedCode: string;
  usages: StaffUsage[];
}

interface CatalogStaff {
  id: string;
  fullName: string | null;
  licenseNumber: string | null;
  socialInsuranceCode: string | null;
  active: boolean;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeCode(value: unknown): string {
  return text(value)
    .toLowerCase()
    .replace(/\s+/g, "");
}

function splitCodes(value: unknown): string[] {
  const codes = text(value)
    .split(/[;|,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const unique = new Map<string, string>();

  for (const code of codes) {
    const key = normalizeCode(code);

    if (key && !unique.has(key)) {
      unique.set(key, code);
    }
  }

  return [...unique.values()];
}

function getRawData(value: unknown): Record<string, unknown> {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

function isStrict(rule: {
  config?: Record<string, unknown>;
}): boolean {
  return rule.config?.strictCatalog === true;
}

export const staffExistsRule: RuleValidator = {
  async evaluate(context, rule, runtime) {
    const entries = new Map<string, StaffEntry>();

    // 1. Thu thập mã nhân viên từ các event XML2/XML3.
    for (const event of context.events ?? []) {
      const raw = getRawData(event?.raw_data);

      const sourceType = text(event?.source_type).toUpperCase();

      if (
        sourceType &&
        sourceType !== "XML2" &&
        sourceType !== "XML3"
      ) {
        continue;
      }

      const usageBase = {
        sourceType,
        eventId: text(event?.id) || null,
        itemCode:
          text(event?.item_code) ||
          text(raw.MA_DICH_VU) ||
          text(raw.MA_THUOC) ||
          null,
        itemName:
          text(event?.item_name) ||
          text(raw.TEN_DICH_VU) ||
          text(raw.TEN_THUOC) ||
          null,
        departmentCode: text(raw.MA_KHOA) || null,
      };

      const fields: StaffField[] = [
        "MA_BAC_SI",
        "NGUOI_THUC_HIEN",
      ];

      for (const field of fields) {
        const codes = splitCodes(raw[field]);

        for (const code of codes) {
          const key = normalizeCode(code);
          const existing = entries.get(key);

          const usage: StaffUsage = {
            ...usageBase,
            field,
          };

          if (existing) {
            // Cùng một mã, cùng event và cùng trường:
            // không lưu thành nhiều lỗi.
            const alreadyAdded = existing.usages.some(
              (item) =>
                item.field === usage.field &&
                item.eventId === usage.eventId &&
                item.sourceType === usage.sourceType
            );

            if (!alreadyAdded) {
              existing.usages.push(usage);
            }
          } else {
            entries.set(key, {
              code,
              normalizedCode: key,
              usages: [usage],
            });
          }
        }
      }
    }

    const staffCodes = [...entries.keys()];

    if (staffCodes.length === 0) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,
        status: "SKIP",
        severity: rule.severity,
        message: "Không có mã nhân viên để đối chiếu.",
        issueCount: 0,
        details: {
          checkedCodes: 0,
          violations: [],
        },
      };
    }

    // 2. Tìm theo mã CCHN/GPHN hoặc mã BHXH.
    const result = await runtime.client.query<{
      id: string;
      full_name: string | null;
      license_number: string | null;
      social_insurance_code: string | null;
      active: boolean | null;
    }>(
      `
      SELECT
        id,
        full_name,
        license_number,
        social_insurance_code,
        active
      FROM catalog.medical_staff
      WHERE
        REGEXP_REPLACE(
          LOWER(COALESCE(license_number, '')),
          '[[:space:]]+', '', 'g'
        ) = ANY($1::text[])
        OR
        REGEXP_REPLACE(
          LOWER(COALESCE(social_insurance_code, '')),
          '[[:space:]]+', '', 'g'
        ) = ANY($1::text[])
      `,
      [staffCodes]
    );

    // 3. Một mã có thể khớp nhiều bản ghi danh mục.
    const catalog = new Map<string, CatalogStaff[]>();

    for (const row of result.rows) {
      const staff: CatalogStaff = {
        id: String(row.id),
        fullName: text(row.full_name) || null,
        licenseNumber: text(row.license_number) || null,
        socialInsuranceCode:
          text(row.social_insurance_code) || null,
        active: row.active === true,
      };

      const keys = new Set(
        [
          normalizeCode(staff.licenseNumber),
          normalizeCode(staff.socialInsuranceCode),
        ].filter(Boolean)
      );

      for (const key of keys) {
        if (!entries.has(key)) continue;

        const list = catalog.get(key) ?? [];

        if (!list.some((item) => item.id === staff.id)) {
          list.push(staff);
        }

        catalog.set(key, list);
      }
    }

    type ViolationType =
      | "STAFF_NOT_FOUND"
      | "STAFF_INACTIVE"
      | "STAFF_AMBIGUOUS";

    const violations: Array<{
      type: ViolationType;
      staffCode: string;
      staffName: string | null;
      field: string;
      sourceType: string;
      eventId: string | null;
      itemCode: string | null;
      itemName: string | null;
      departmentCode: string | null;
      usageCount: number;
      usages: StaffUsage[];
      matchedStaffIds: string[];
      message: string;
    }> = [];

    let matchedCodes = 0;

    for (const entry of entries.values()) {
      const matches = catalog.get(entry.normalizedCode) ?? [];

      let type: ViolationType | null = null;
      let description = "";

      if (matches.length === 0) {
        type = "STAFF_NOT_FOUND";
        description =
          `Mã nhân viên "${entry.code}" chưa tìm thấy ` +
          "trong danh mục nội bộ. Cần kiểm tra dữ liệu danh mục.";
      } else if (matches.length > 1) {
        type = "STAFF_AMBIGUOUS";
        description =
          `Mã nhân viên "${entry.code}" khớp với ` +
          `${matches.length} bản ghi danh mục. Cần xác minh mã.`;
      } else if (!matches[0].active) {
        type = "STAFF_INACTIVE";
        description =
          `Mã nhân viên "${entry.code}" đang được đánh dấu ` +
          "ngừng sử dụng. Cần đối chiếu thời điểm thực hiện.";
      } else {
        matchedCodes++;
      }

      if (!type) continue;

      const first = entry.usages[0];

      violations.push({
        type,
        staffCode: entry.code,
        staffName: matches[0]?.fullName ?? null,
        field: first.field,
        sourceType: first.sourceType,
        eventId: first.eventId,
        itemCode: first.itemCode,
        itemName: first.itemName,
        departmentCode: first.departmentCode,
        usageCount: entry.usages.length,
        usages: entry.usages,
        matchedStaffIds: matches.map((item) => item.id),
        message: description,
      });
    }

    if (violations.length === 0) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,
        status: "PASS",
        severity: rule.severity,
        message:
          "Tất cả mã nhân viên đã đối chiếu được " +
          "với danh mục và đang hoạt động.",
        issueCount: 0,
        details: {
          checkedCodes: staffCodes.length,
          matchedCodes,
          violations: [],
        },
      };
    }

    const strictCatalog = isStrict(rule);

    return {
      ruleId: rule.id,
      ruleCode: rule.code,
      status: "FAIL",
      severity: strictCatalog ? rule.severity : "WARNING",
      message:
        `Có ${violations.length} mã nhân viên cần xác minh ` +
        `trong danh mục (${staffCodes.length} mã đã kiểm tra).`,
      issueCount: violations.length,
      details: {
        strictCatalog,
        checkedCodes: staffCodes.length,
        matchedCodes,
        violations,
      },
    };
  },
};
