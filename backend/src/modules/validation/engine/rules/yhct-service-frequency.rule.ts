
import type {
  RuleResult,
  RuleValidator,
  ValidationRule,
} from "../rule.types.js";

type JsonObject = Record<string, unknown>;

interface ServiceConfig {
  code: string;
  maxPerDay: number | null;
}

interface ServiceEntry {
  stt: string;
  code: string;
  name: string;
  date: string;
  orderTime: string;
  performTime: string;
  quantity: number;
  performer: string;
}

interface Finding {
  type: string;
  date: string;
  code: string;
  name: string;
  rowCount: number;
  totalQuantity: number;
  maxPerDay?: number;
  stt: string[];
  times: string[];
  message: string;
}

function isObject(value: unknown): value is JsonObject {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function str(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function firstObject(value: unknown): JsonObject | null {
  const item = Array.isArray(value) ? value[0] : value;
  return isObject(item) ? item : null;
}

function getXml1(value: unknown): JsonObject | null {
  return firstObject(firstObject(value)?.TONG_HOP);
}

function getXml3Rows(value: unknown): JsonObject[] {
  const root = firstObject(value);

  const section = firstObject(
    root?.CHITIEU_CHITIET_DVKT_VTYT
  );

  const list = firstObject(
    section?.DSACH_CHI_TIET_DVKT
  );

  const raw = list?.CHI_TIET_DVKT;

  if (raw == null) return [];

  const rows = Array.isArray(raw) ? raw : [raw];

  return rows.filter(isObject);
}

function parseDate(value: unknown): string | null {
  const raw = str(value);

  if (!/^\d{12}(\d{2})?$/.test(raw)) {
    return null;
  }

  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const hour = Number(raw.slice(8, 10));
  const minute = Number(raw.slice(10, 12));
  const second =
    raw.length === 14
      ? Number(raw.slice(12, 14))
      : 0;

  const timestamp = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  );

  const date = new Date(timestamp);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    return null;
  }

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function parseQuantity(value: unknown): number | null {
  const raw = str(value);

  if (!raw || !/^\d+(\.\d+)?$/.test(raw)) {
    return null;
  }

  const number = Number(raw);

  return Number.isFinite(number) && number > 0
    ? number
    : null;
}

function getServiceConfigs(
  rule: ValidationRule
): ServiceConfig[] {
  const raw = rule.config?.serviceLimits;

  if (!Array.isArray(raw)) return [];

  const configs: ServiceConfig[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (!isObject(item)) continue;

    const code = str(item.code).toUpperCase();

    if (!code || seen.has(code)) continue;

    const rawLimit = item.maxPerDay;

    let maxPerDay: number | null = null;

    if (
      typeof rawLimit === "number" &&
      Number.isFinite(rawLimit) &&
      rawLimit > 0
    ) {
      maxPerDay = rawLimit;
    }

    configs.push({ code, maxPerDay });
    seen.add(code);
  }

  return configs;
}

function makeResult(
  rule: ValidationRule,
  status: RuleResult["status"],
  message: string,
  details: Record<string, unknown>,
  issueCount = 0
): RuleResult {
  return {
    ruleId: rule.id,
    ruleCode: rule.code,
    status,
    severity: rule.severity,
    message,
    issueCount,
    details,
  };
}

export const yhctServiceFrequencyRule:
  RuleValidator = {
  async evaluate(context, rule) {
    const xml1 = getXml1(context.xml1);

    if (!xml1) {
      return makeResult(
        rule,
        "SKIP",
        "Không đọc được XML1.",
        { reason: "XML1_UNAVAILABLE" }
      );
    }

    const maLoaiKcb = str(
      xml1.MA_LOAI_KCB
    ).padStart(2, "0");

    if (maLoaiKcb !== "02") {
      return makeResult(
        rule,
        "SKIP",
        `Rule tần suất YHCT ngoại trú không áp dụng cho mã KCB ${maLoaiKcb}.`,
        { maLoaiKcb }
      );
    }

    const maLk = str(xml1.MA_LK);
    const configs = getServiceConfigs(rule);
    const configMap = new Map(
      configs.map((config) => [config.code, config])
    );

    if (configs.length === 0) {
      return makeResult(
        rule,
        "SKIP",
        "Chưa cấu hình mã DVKT YHCT để kiểm tra tần suất.",
        { maLk, reason: "SERVICE_CONFIG_EMPTY" }
      );
    }

    const xml3Rows = getXml3Rows(context.xml3);

    if (xml3Rows.length === 0) {
      return makeResult(
        rule,
        "SKIP",
        "Không có dữ liệu XML3.",
        { maLk, reason: "XML3_UNAVAILABLE" }
      );
    }

    const services: ServiceEntry[] = [];

    const unclassifiedRows: Array<{
      stt: string;
      code: string;
      performTime: string;
      quantity: string;
      reason: string;
    }> = [];

    let configuredRows = 0;

    for (const row of xml3Rows) {
      const code = str(row.MA_DICH_VU).toUpperCase();

      if (!configMap.has(code)) continue;

      configuredRows++;

      const stt = str(row.STT);
      const performTime = str(row.NGAY_TH_YL);
      const quantityRaw = str(row.SO_LUONG);

      const date = parseDate(performTime);
      const quantity = parseQuantity(quantityRaw);

      if (!date || quantity === null) {
        unclassifiedRows.push({
          stt,
          code,
          performTime,
          quantity: quantityRaw,
          reason: !date
            ? "INVALID_PERFORM_TIME"
            : "INVALID_QUANTITY",
        });

        continue;
      }

      services.push({
        stt,
        code,
        name: str(row.TEN_DICH_VU),
        date,
        orderTime: str(row.NGAY_YL),
        performTime,
        quantity,
        performer: str(row.NGUOI_THUC_HIEN),
      });
    }

    if (configuredRows === 0) {
      return makeResult(
        rule,
        "SKIP",
        "Hồ sơ không có mã DVKT YHCT thuộc danh mục cấu hình.",
        {
          maLk,
          reason: "NO_CONFIGURED_YHCT_SERVICE",
        }
      );
    }

    const groups = new Map<string, ServiceEntry[]>();

    for (const service of services) {
      const key = JSON.stringify([
        service.date,
        service.code,
      ]);

      const group = groups.get(key) ?? [];

      group.push(service);
      groups.set(key, group);
    }

    const findings: Finding[] = [];

    const dailySummary = Array.from(groups.values())
      .map((items) => {
        const first = items[0];

        const totalQuantity = items.reduce(
          (sum, item) => sum + item.quantity,
          0
        );

        const limit =
          configMap.get(first.code)?.maxPerDay ?? null;

        const summary = {
          date: first.date,
          code: first.code,
          name: first.name,
          rowCount: items.length,
          totalQuantity,
          maxPerDay: limit,
          stt: items.map((item) => item.stt),
          times: items.map(
            (item) => item.performTime
          ),
          performers: items.map(
            (item) => item.performer
          ),
        };

        if (items.length > 1) {
          findings.push({
            type: "MULTIPLE_SERVICE_ROWS_SAME_DAY",
            date: first.date,
            code: first.code,
            name: first.name,
            rowCount: items.length,
            totalQuantity,
            stt: summary.stt,
            times: summary.times,
            message:
              "Cùng mã DVKT xuất hiện nhiều dòng trong một ngày. Cần đối chiếu số lượt thực hiện, chưa kết luận sai.",
          });
        }

        // Chỉ đối chiếu giới hạn khi được
        // xác nhận và cấu hình riêng cho mã DVKT.
        if (
          limit !== null &&
          totalQuantity > limit
        ) {
          findings.push({
            type: "CONFIGURED_DAILY_LIMIT_EXCEEDED",
            date: first.date,
            code: first.code,
            name: first.name,
            rowCount: items.length,
            totalQuantity,
            maxPerDay: limit,
            stt: summary.stt,
            times: summary.times,
            message:
              `Tổng số lượng ${totalQuantity} vượt ngưỡng cấu hình ${limit} trong ngày. Cần đối chiếu căn cứ áp dụng.`,
          });
        }

        return summary;
      })
      .sort((a, b) =>
        a.date.localeCompare(b.date) ||
        a.code.localeCompare(b.code)
      );

    const details: Record<string, unknown> = {
      maLk,
      maLoaiKcb,
      totalXml3Rows: xml3Rows.length,
      configuredServiceRows: configuredRows,
      checkedServiceRows: services.length,
      unclassifiedServiceRows: unclassifiedRows.length,
      treatmentDaysWithService:
        new Set(services.map((item) => item.date)).size,
      configuredCodes: configs,
      dailySummary,
      unclassifiedRows,
      findings,
    };

    if (findings.length > 0) {
      return makeResult(
        rule,
        "FAIL",
        `Phát hiện ${findings.length} dấu hiệu tần suất DVKT YHCT cần rà soát.`,
        details,
        findings.length
      );
    }

    if (unclassifiedRows.length > 0) {
      return makeResult(
        rule,
        "SKIP",
        `Đã thống kê ${services.length} dòng DVKT YHCT, nhưng còn ${unclassifiedRows.length} dòng thiếu hoặc sai thời gian/số lượng.`,
        details
      );
    }

    return makeResult(
      rule,
      "PASS",
      `Đã kiểm tra ${services.length} dòng DVKT YHCT trong ${dailySummary.length} nhóm mã dịch vụ/ngày. Chưa phát hiện bất thường theo tiêu chí hiện tại.`,
      details
    );
  },
};
