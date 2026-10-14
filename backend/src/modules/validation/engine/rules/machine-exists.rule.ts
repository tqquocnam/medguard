
import type { RuleValidator } from "../rule.types.js";

interface MachineUsage {
  eventId: string | null;
  eventType: string | null;
  sourceType: string | null;
  serviceCode: string | null;
  serviceName: string | null;
}

interface MachineEntry {
  machineCode: string;
  normalizedCode: string;
  usages: MachineUsage[];
}

interface CatalogMachine {
  code: string;
  name: string | null;
  active: boolean;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeMachineCode(value: unknown): string {
  return text(value)
    .toLowerCase()
    .replace(/\s+/g, "");
}

function splitMachineCodes(value: unknown): string[] {
  const parts = text(value)
    .split(/[;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const unique = new Map<string, string>();

  for (const part of parts) {
    const key = normalizeMachineCode(part);

    if (key && !unique.has(key)) {
      unique.set(key, part);
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

export const machineExistsRule: RuleValidator = {
  async evaluate(context, rule, runtime) {
    const entries = new Map<string, MachineEntry>();

    // 1. Thu thập MA_MAY đã khai báo trong XML3.
    // Không yêu cầu tất cả DVKT đều phải có MA_MAY.
    for (const event of context.events ?? []) {
      const raw = getRawData(event?.raw_data);

      const sourceType =
        text(event?.source_type).toUpperCase();

      if (sourceType && sourceType !== "XML3") {
        continue;
      }

      const codes = splitMachineCodes(raw.MA_MAY);

      for (const machineCode of codes) {
        const key = normalizeMachineCode(machineCode);

        const usage: MachineUsage = {
          eventId: text(event?.id) || null,
          eventType: text(event?.event_type) || null,
          sourceType: sourceType || null,
          serviceCode:
            text(event?.item_code) ||
            text(raw.MA_DICH_VU) ||
            null,
          serviceName:
            text(event?.item_name) ||
            text(raw.TEN_DICH_VU) ||
            null,
        };

        const existing = entries.get(key);

        if (existing) {
          const duplicate = existing.usages.some(
            (item) =>
              item.eventId === usage.eventId &&
              item.serviceCode === usage.serviceCode
          );

          if (!duplicate) {
            existing.usages.push(usage);
          }
        } else {
          entries.set(key, {
            machineCode,
            normalizedCode: key,
            usages: [usage],
          });
        }
      }
    }

    const machineCodes = [...entries.keys()];

    if (machineCodes.length === 0) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,
        status: "SKIP",
        severity: rule.severity,
        message:
          "Hồ sơ không khai báo mã máy để đối chiếu. " +
          "Việc bắt buộc có mã máy do rule khác kiểm tra.",
        issueCount: 0,
        details: {
          checkedMachineCodes: [],
          violations: [],
        },
      };
    }

    // 2. Tra cứu danh mục máy.
    const result = await runtime.client.query<{
      code: string;
      name: string | null;
      active: boolean | null;
    }>(
      `
      SELECT
        code,
        name,
        active
      FROM catalog.machines
      WHERE
        REGEXP_REPLACE(
          LOWER(BTRIM(COALESCE(code, ''))),
          '[[:space:]]+', '', 'g'
        ) = ANY($1::text[])
      `,
      [machineCodes]
    );

    const catalog =
      new Map<string, CatalogMachine[]>();

    for (const row of result.rows) {
      const key = normalizeMachineCode(row.code);

      if (!key || !entries.has(key)) {
        continue;
      }

      const machine: CatalogMachine = {
        code: text(row.code),
        name: text(row.name) || null,
        active: row.active === true,
      };

      const list = catalog.get(key) ?? [];

      list.push(machine);
      catalog.set(key, list);
    }

    type MachineViolationType =
      | "MACHINE_NOT_FOUND"
      | "MACHINE_INACTIVE"
      | "MACHINE_AMBIGUOUS";

    const violations: Array<{
      type: MachineViolationType;
      machineCode: string;
      machineName: string | null;
      serviceCode: string | null;
      serviceName: string | null;
      eventId: string | null;
      usageCount: number;
      usages: MachineUsage[];
      message: string;
    }> = [];

    let matchedCodes = 0;

    // 3. Đối chiếu từng mã máy duy nhất.
    for (const entry of entries.values()) {
      const matches =
        catalog.get(entry.normalizedCode) ?? [];

      let type: MachineViolationType | null = null;
      let description = "";

      if (matches.length === 0) {
        type = "MACHINE_NOT_FOUND";
        description =
          `Mã máy "${entry.machineCode}" chưa tìm thấy ` +
          "trong danh mục máy nội bộ. Cần xác minh danh mục.";
      } else if (matches.length > 1) {
        type = "MACHINE_AMBIGUOUS";
        description =
          `Mã máy "${entry.machineCode}" khớp với ` +
          `${matches.length} bản ghi trong danh mục.`;
      } else if (!matches[0].active) {
        type = "MACHINE_INACTIVE";
        description =
          `Mã máy "${entry.machineCode}" được đánh dấu ` +
          "ngừng sử dụng. Cần đối chiếu thời điểm thực hiện.";
      } else {
        matchedCodes++;
      }

      if (!type) {
        continue;
      }

      const first = entry.usages[0];

      violations.push({
        type,
        machineCode: entry.machineCode,
        machineName: matches[0]?.name ?? null,
        serviceCode: first.serviceCode,
        serviceName: first.serviceName,
        eventId: first.eventId,
        usageCount: entry.usages.length,
        usages: entry.usages,
        message: description,
      });
    }

    // 4. Tất cả mã máy đã khớp.
    if (violations.length === 0) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,
        status: "PASS",
        severity: rule.severity,
        message:
          "Tất cả mã máy đã đối chiếu được với " +
          "danh mục máy và đang hoạt động.",
        issueCount: 0,
        details: {
          checkedMachineCodes:
            [...entries.values()].map(
              (entry) => entry.machineCode
            ),
          matchedCodes,
          violations: [],
        },
      };
    }

    // 5. Cảnh báo đối chiếu danh mục.
    // strictCatalog=true sẽ dùng severity của rule trong DB.
    const strictCatalog =
      rule.config?.strictCatalog === true;

    return {
      ruleId: rule.id,
      ruleCode: rule.code,
      status: "FAIL",
      severity: strictCatalog ? rule.severity : "WARNING",
      message:
        `Có ${violations.length} mã máy cần xác minh ` +
        `trong danh mục (${machineCodes.length} mã đã kiểm tra).`,
      issueCount: violations.length,
      details: {
        strictCatalog,
        checkedMachineCodes:
          [...entries.values()].map(
            (entry) => entry.machineCode
          ),
        matchedCodes,
        violations,
      },
    };
  },
};
