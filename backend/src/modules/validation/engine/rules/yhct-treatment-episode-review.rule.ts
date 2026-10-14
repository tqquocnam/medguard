import type { RuleValidator, ValidationRule, RuleResult } from "../rule.types.js";

type JsonRow = Record<string, unknown>;
type CalendarDay = {
  date: string;
  status: "BOTH" | "XML3_ONLY" | "XML5_ONLY" | "NEITHER";
  serviceCount: number;
  serviceCodes: string[];
  progressCount: number;
};
type Gap = {
  fromDate: string;
  toDate: string;
  gapDays: number;
  dates: string[];
};
type BadTimestamp = {
  source: "XML3" | "XML5";
  stt: string;
  rawTime: string;
  reason: "MISSING" | "INVALID" | "OUTSIDE_WINDOW";
};

const DAY_MS = 86_400_000;
const MAX_DAYS = 366;
const DEFAULT_CODES = ["08.0313.0230", "08.0278.0230", "08.0432.0280", "08.0392.0280"];

function object(value: unknown): JsonRow | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRow) : null;
}
function first(value: unknown): JsonRow | null {
  return object(Array.isArray(value) ? value[0] : value);
}
function rows(value: unknown): JsonRow[] {
  const list = Array.isArray(value) ? value : value == null ? [] : [value];
  return list.filter((item): item is JsonRow => object(item) !== null);
}
function str(value: unknown): string {
  return value == null ? "" : String(value).trim();
}
function xml3Rows(value: unknown): JsonRow[] {
  const root = first(value);
  return rows(first(first(root?.CHITIEU_CHITIET_DVKT_VTYT)?.DSACH_CHI_TIET_DVKT)?.CHI_TIET_DVKT);
}
function xml5Rows(value: unknown): JsonRow[] {
  const root = first(value);
  return rows(first(first(root?.CHITIEU_CHITIET_DIENBIENLAMSANG)?.DSACH_CHI_TIET_DIEN_BIEN_BENH)?.CHI_TIET_DIEN_BIEN_BENH);
}
// Treat BHYT timestamps as local calendar fields. UTC is only a timezone-neutral calendar arithmetic helper.
function timestamp(value: string): number | null {
  if (!/^\d{12}(\d{2})?$/.test(value)) return null;
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(4, 6));
  const d = Number(value.slice(6, 8));
  const h = Number(value.slice(8, 10));
  const min = Number(value.slice(10, 12));
  const s = value.length === 14 ? Number(value.slice(12, 14)) : 0;
  const ms = Date.UTC(y, m - 1, d, h, min, s);
  if (!Number.isFinite(ms)) return null;
  const check = new Date(ms);
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 &&
    check.getUTCDate() === d && check.getUTCHours() === h &&
    check.getUTCMinutes() === min && check.getUTCSeconds() === s ? ms : null;
}
function day(value: string): number | null {
  const ms = timestamp(value);
  return ms == null ? null : Math.floor(ms / DAY_MS) * DAY_MS;
}
function dateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
function gapList(days: number[]): Gap[] {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const result: Gap[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const next = sorted[i];
    const gapDays = (next - previous) / DAY_MS - 1;
    if (gapDays < 1) continue;
    const dates: string[] = [];
    for (let d = previous + DAY_MS; d < next; d += DAY_MS) dates.push(dateString(d));
    result.push({ fromDate: dateString(previous), toDate: dateString(next), gapDays, dates });
  }
  return result;
}
function result(rule: ValidationRule, message: string, details: Record<string, unknown>): RuleResult {
  return {
    ruleId: rule.id,
    ruleCode: rule.code,
    status: "SKIP",
    severity: rule.severity,
    message,
    details,
    issueCount: 0,
  };
}

/**
 * Episode-level informational summary. Never generates findings or FAIL:
 * granular alerts belong to Rules 14-18, so the iCheck-style modal cannot double-count.
 */
export const yhctTreatmentEpisodeReviewRule: RuleValidator = {
  async evaluate(context, rule, _runtime) {
    const xml1 = first(first(context.xml1)?.TONG_HOP);
    const kcb = str(xml1?.MA_LOAI_KCB).padStart(2, "0");
    if (!xml1 || kcb !== "02") {
      return result(rule, "Chỉ tổng hợp hồ sơ điều trị ngoại trú (02).", { reason: "OUT_OF_SCOPE", kcb });
    }

    const config = rule.config ?? {};
    const serviceCodes = Array.isArray(config.serviceCodes)
      ? (config.serviceCodes as unknown[]).map(str).filter(Boolean)
      : DEFAULT_CODES;
    const selected = new Set(serviceCodes);
    if (selected.size === 0) {
      return result(rule, "Chưa cấu hình mã DVKT YHCT để tổng hợp.", { reason: "NO_SERVICE_CODES" });
    }

    const treatmentStart = str(xml1.NGAY_VAO);
    const treatmentEnd = str(xml1.NGAY_RA);
    const start = day(treatmentStart);
    const end = day(treatmentEnd);
    if (start == null || end == null || end < start) {
      return result(rule, "Ngày vào/ra XML1 chưa hợp lệ để lập lịch.", {
        reason: "INVALID_TREATMENT_WINDOW", treatmentStart, treatmentEnd,
      });
    }
    const totalTreatmentDays = (end - start) / DAY_MS + 1;
    if (totalTreatmentDays > MAX_DAYS) {
      return result(rule, "Khoảng điều trị vượt giới hạn 366 ngày để tổng hợp.", {
        reason: "TREATMENT_WINDOW_TOO_LARGE", totalTreatmentDays,
      });
    }

    const servicesByDay = new Map<number, { count: number; codes: Set<string> }>();
    const progressByDay = new Map<number, number>();
    const invalidTimestamps: BadTimestamp[] = [];
    let totalSelectedXml3 = 0;
    let validXml3 = 0;
    let totalXml5Rows = 0;
    let validXml5 = 0;

    for (const row of xml3Rows(context.xml3)) {
      const code = str(row.MA_DICH_VU);
      if (!selected.has(code)) continue;
      totalSelectedXml3++;
      const rawTime = str(row.NGAY_TH_YL);
      const d = day(rawTime);
      if (d == null || d < start || d > end) {
        invalidTimestamps.push({
          source: "XML3", stt: str(row.STT), rawTime,
          reason: !rawTime ? "MISSING" : d == null ? "INVALID" : "OUTSIDE_WINDOW",
        });
        continue;
      }
      validXml3++;
      const current = servicesByDay.get(d) ?? { count: 0, codes: new Set<string>() };
      current.count++;
      current.codes.add(code);
      servicesByDay.set(d, current);
    }

    const hasXml5File = context.xml5 != null;
    for (const row of xml5Rows(context.xml5)) {
      totalXml5Rows++;
      const rawTime = str(row.THOI_DIEM_DBLS);
      const d = day(rawTime);
      if (d == null || d < start || d > end) {
        invalidTimestamps.push({
          source: "XML5", stt: str(row.STT), rawTime,
          reason: !rawTime ? "MISSING" : d == null ? "INVALID" : "OUTSIDE_WINDOW",
        });
        continue;
      }
      validXml5++;
      progressByDay.set(d, (progressByDay.get(d) ?? 0) + 1);
    }

    const calendar: CalendarDay[] = [];
    const datesWithBoth: string[] = [];
    const datesOnlyXml3: string[] = [];
    const datesOnlyXml5: string[] = [];
    const datesWithNeither: string[] = [];
    for (let d = start; d <= end; d += DAY_MS) {
      const date = dateString(d);
      const services = servicesByDay.get(d);
      const progressCount = progressByDay.get(d) ?? 0;
      const status: CalendarDay["status"] = services && progressCount > 0 ? "BOTH"
        : services ? "XML3_ONLY" : progressCount > 0 ? "XML5_ONLY" : "NEITHER";
      if (status === "BOTH") datesWithBoth.push(date);
      else if (status === "XML3_ONLY") datesOnlyXml3.push(date);
      else if (status === "XML5_ONLY") datesOnlyXml5.push(date);
      else datesWithNeither.push(date);
      calendar.push({
        date, status, serviceCount: services?.count ?? 0,
        serviceCodes: [...(services?.codes ?? new Set<string>())].sort(), progressCount,
      });
    }

    const xml3Gaps = gapList([...servicesByDay.keys()]);
    const evidenceGaps = gapList([...servicesByDay.keys(), ...progressByDay.keys()]);
    const maxGap = (gaps: Gap[]) => gaps.reduce((max, gap) => Math.max(max, gap.gapDays), 0);
    const details: Record<string, unknown> = {
      mode: "EPISODE_SUMMARY_ONLY",
      sources: ["XML1.NGAY_VAO/NGAY_RA", "XML3.NGAY_TH_YL", "XML5.THOI_DIEM_DBLS"],
      maLk: str(xml1.MA_LK),
      startDate: dateString(start), endDate: dateString(end), treatmentStart, treatmentEnd,
      serviceCodes, totalTreatmentDays,
      totalSelectedXml3, validXml3, totalXml5Rows, validXml5, hasXml5File,
      daysWithXml3Service: servicesByDay.size,
      daysWithXml5Progress: progressByDay.size,
      daysWithBoth: datesWithBoth.length,
      daysWithServiceOnly: datesOnlyXml3.length,
      daysWithProgressOnly: datesOnlyXml5.length,
      daysWithNeither: datesWithNeither.length,
      datesWithBoth, datesOnlyXml3, datesOnlyXml5, datesWithNeither,
      longestXml3Gap: maxGap(xml3Gaps), longestNoEvidenceGap: maxGap(evidenceGaps),
      xml3Gaps, noEvidenceGaps: evidenceGaps, calendar,
      invalidTimestampCount: invalidTimestamps.length, invalidTimestamps,
      findings: [],
      note: "Chỉ tổng hợp từ XML1, XML3 và XML5 trong context. Không đọc rule_results " +
        "của các rule khác, không tạo cảnh báo và không đánh giá vi phạm BHYT. " +
        "Ngày không có XML3 trong nhóm DVKT hoặc XML5 không chứng minh không có chăm sóc thực tế.",
    };
    return result(
      rule,
      `Tổng hợp đợt điều trị: ${servicesByDay.size}/${totalTreatmentDays} ngày có DVKT YHCT, ` +
        `${progressByDay.size}/${totalTreatmentDays} ngày có diễn biến XML5; chỉ thống kê, không cộng lỗi.`,
      details,
    );
  },
};
