import type {
  RuleValidator,
  ValidationRule,
  RuleResult,
} from "../rule.types.js";

type JsonRow = Record<string, unknown>;
type FindingType =
  | "MISSING_CLINICAL_PROGRESS"
  | "SHORT_CLINICAL_PROGRESS"
  | "TECHNIQUE_WITHOUT_PROGRESS"
  | "REPEATED_PROGRESS_ACROSS_DAYS";

type Finding = {
  type: FindingType;
  date?: string;
  stt?: string;
  stts?: string[];
  dates?: string[];
  entryCount?: number;
  normalizedLength?: number;
  preview?: string;
  message: string;
};

type Uncertain = {
  type: "MISSING_PROGRESS_TIME" | "INVALID_PROGRESS_TIME" | "OUTSIDE_TREATMENT_WINDOW";
  stt: string;
  value: string;
};

type ProgressEntry = {
  stt: string;
  date: string;
  normalizedText: string;
  originalText: string;
  hasTechniqueDescription: boolean;
};

const DAY_MS = 86_400_000;
const DEFAULT_CODES = [
  "08.0313.0230",
  "08.0278.0230",
  "08.0432.0280",
  "08.0392.0280",
];

function object(value: unknown): JsonRow | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRow)
    : null;
}

function first(value: unknown): JsonRow | null {
  return object(Array.isArray(value) ? value[0] : value);
}

function rows(value: unknown): JsonRow[] {
  const array = Array.isArray(value) ? value : value == null ? [] : [value];
  return array.filter((item): item is JsonRow => object(item) !== null);
}

function asText(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function xml3Rows(value: unknown): JsonRow[] {
  const root = first(value);
  const section = first(root?.CHITIEU_CHITIET_DVKT_VTYT);
  const list = first(section?.DSACH_CHI_TIET_DVKT);
  return rows(list?.CHI_TIET_DVKT);
}

function xml5Rows(value: unknown): JsonRow[] {
  const root = first(value);
  const section = first(root?.CHITIEU_CHITIET_DIENBIENLAMSANG);
  const list = first(section?.DSACH_CHI_TIET_DIEN_BIEN_BENH);
  return rows(list?.CHI_TIET_DIEN_BIEN_BENH);
}

// Date.UTC is only used for timezone-neutral arithmetic over local BHYT clock values.
function parseMedicalTimestamp(value: string): number | null {
  if (!/^\d{12}(\d{2})?$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(8, 10));
  const minute = Number(value.slice(10, 12));
  const second = value.length === 14 ? Number(value.slice(12, 14)) : 0;
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  if (!Number.isFinite(ms)) return null;
  const check = new Date(ms);
  return check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day &&
    check.getUTCHours() === hour &&
    check.getUTCMinutes() === minute &&
    check.getUTCSeconds() === second ? ms : null;
}

function dateFromMedicalTimestamp(value: string): string | null {
  const time = parseMedicalTimestamp(value);
  if (time === null) return null;
  return new Date(Math.floor(time / DAY_MS) * DAY_MS)
    .toISOString().slice(0, 10);
}

function normalizeClinicalText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("vi-VN");
}

function threshold(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1
    ? value
    : fallback;
}

function result(
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
    details,
    issueCount,
  };
}

export const yhctClinicalProgressQualityRule: RuleValidator = {
  async evaluate(context, rule, _runtime) {
    const xml1 = first(first(context.xml1)?.TONG_HOP);
    const kcb = asText(xml1?.MA_LOAI_KCB).padStart(2, "0");
    if (!xml1 || kcb !== "02") {
      return result(rule, "SKIP", "Chỉ áp dụng cho hồ sơ ngoại trú (02).", { kcb });
    }

    const config = rule.config ?? {};
    const serviceCodes = Array.isArray(config.serviceCodes)
      ? (config.serviceCodes as unknown[]).map(asText).filter(Boolean)
      : DEFAULT_CODES;
    const selectedCodes = new Set(serviceCodes);
    if (!selectedCodes.size) {
      return result(rule, "SKIP", "Chưa cấu hình mã DVKT YHCT.", {
        reason: "SERVICE_CODES_NOT_CONFIGURED",
      });
    }

    // Limit this rule to records containing the configured YHCT techniques.
    const selectedXml3 = xml3Rows(context.xml3).filter(
      (row) => selectedCodes.has(asText(row.MA_DICH_VU))
    );
    if (!selectedXml3.length) {
      return result(rule, "SKIP", "Không có DVKT YHCT thuộc phạm vi kiểm tra.", {
        serviceCodes,
        selectedXml3Count: 0,
      });
    }

    const warnMissingProgress = config.warnMissingProgress === true;
    const warnShortProgress = config.warnShortProgress === true;
    const warnTechniqueWithoutProgress = config.warnTechniqueWithoutProgress === true;
    const warnRepeatedAcrossDays = config.warnRepeatedAcrossDays === true;
    const minMeaningfulChars = threshold(config.minMeaningfulChars, 80);
    const minRepeatedDays = Math.max(2, threshold(config.minRepeatedDays, 2));

    const treatmentStart = asText(xml1.NGAY_VAO);
    const treatmentEnd = asText(xml1.NGAY_RA);
    const startMs = parseMedicalTimestamp(treatmentStart);
    const endMs = parseMedicalTimestamp(treatmentEnd);
    if (startMs === null || endMs === null || endMs < startMs) {
      return result(rule, "SKIP", "Ngày vào/ra XML1 thiếu hoặc không hợp lệ.", {
        treatmentStart,
        treatmentEnd,
        reason: "INVALID_TREATMENT_WINDOW",
      });
    }

    const startDate = dateFromMedicalTimestamp(treatmentStart)!;
    const endDate = dateFromMedicalTimestamp(treatmentEnd)!;

    if (context.xml5 == null) {
      return result(rule, "SKIP", "Không có XML5 để đánh giá chất lượng diễn biến.", {
        reason: "XML5_NOT_AVAILABLE",
        selectedXml3Count: selectedXml3.length,
      });
    }

    const rawEntries = xml5Rows(context.xml5);
    if (!rawEntries.length) {
      return result(rule, "SKIP", "XML5 không có dòng diễn biến để đánh giá.", {
        reason: "XML5_EMPTY",
        selectedXml3Count: selectedXml3.length,
      });
    }

    const uncertain: Uncertain[] = [];
    const entries: ProgressEntry[] = [];
    let missingTimeCount = 0;
    let invalidTimeCount = 0;
    let outsideWindowCount = 0;

    for (const row of rawEntries) {
      const stt = asText(row.STT);
      const time = asText(row.THOI_DIEM_DBLS);
      if (!time) {
        missingTimeCount++;
        uncertain.push({ type: "MISSING_PROGRESS_TIME", stt, value: time });
        continue;
      }
      const date = dateFromMedicalTimestamp(time);
      if (!date) {
        invalidTimeCount++;
        uncertain.push({ type: "INVALID_PROGRESS_TIME", stt, value: time });
        continue;
      }
      if (date < startDate || date > endDate) {
        outsideWindowCount++;
        uncertain.push({ type: "OUTSIDE_TREATMENT_WINDOW", stt, value: time });
        continue;
      }
      const originalText = asText(row.DIEN_BIEN_LS);
      entries.push({
        stt,
        date,
        originalText,
        normalizedText: normalizeClinicalText(originalText),
        hasTechniqueDescription: asText(row.PHAU_THUAT).length > 0,
      });
    }

    // Treat repeated identical narratives on the same day as one clinical
    // observation; XML5 can contain one row per technique for a single visit.
    const observations = new Map<string, ProgressEntry[]>();
    for (const entry of entries) {
      const key = JSON.stringify([entry.date, entry.normalizedText]);
      const members = observations.get(key) ?? [];
      members.push(entry);
      observations.set(key, members);
    }

    const emptyObservations: Array<{ date: string; stts: string[]; hasTechniqueDescription: boolean }> = [];
    const shortObservations: Array<{ date: string; stts: string[]; length: number; preview: string }> = [];
    const techniqueWithoutProgress: Array<{ date: string; stts: string[] }> = [];
    const narrativesAcrossDays = new Map<string, Map<string, ProgressEntry[]>>();

    for (const members of observations.values()) {
      const sample = members[0];
      const stts = members.map((item) => item.stt);
      const anyTechnique = members.some((item) => item.hasTechniqueDescription);
      const length = sample.normalizedText.length;

      if (!length) {
        emptyObservations.push({ date: sample.date, stts, hasTechniqueDescription: anyTechnique });
        if (anyTechnique) techniqueWithoutProgress.push({ date: sample.date, stts });
        continue;
      }
      if (length < minMeaningfulChars) {
        shortObservations.push({
          date: sample.date,
          stts,
          length,
          preview: sample.originalText.slice(0, 120),
        });
      }

      // Short/empty narratives are excluded from across-day comparisons.
      if (length >= minMeaningfulChars) {
        const dates = narrativesAcrossDays.get(sample.normalizedText) ?? new Map();
        dates.set(sample.date, members);
        narrativesAcrossDays.set(sample.normalizedText, dates);
      }
    }

    const repeatedAcrossDays = [...narrativesAcrossDays.entries()]
      .filter(([, dates]) => dates.size >= minRepeatedDays)
      .map(([text, dates]) => ({
        dates: [...dates.keys()].sort(),
        stts: [...dates.values()].flatMap((items) => items.map((item) => item.stt)),
        uniqueDays: dates.size,
        textLength: text.length,
        preview: text.slice(0, 160),
      }))
      .sort((a, b) => b.uniqueDays - a.uniqueDays);

    const findings: Finding[] = [];
    const safeToFlagAcrossDays = uncertain.length === 0;

    if (warnMissingProgress) {
      for (const item of emptyObservations) {
        findings.push({
          type: "MISSING_CLINICAL_PROGRESS",
          date: item.date,
          stts: item.stts,
          message: `Ngày ${item.date}: ${item.stts.length} dòng XML5 không có DIEN_BIEN_LS (STT: ${item.stts.join(", ")}); cần rà soát.`,
        });
      }
    }
    if (warnShortProgress) {
      for (const item of shortObservations) {
        findings.push({
          type: "SHORT_CLINICAL_PROGRESS",
          date: item.date,
          stts: item.stts,
          normalizedLength: item.length,
          preview: item.preview,
          message: `Ngày ${item.date}: diễn biến XML5 ngắn ${item.length} ký tự, dưới ngưỡng nội bộ ${minMeaningfulChars}; cần rà soát, không tự kết luận thiếu nội dung bắt buộc.`,
        });
      }
    }
    if (warnTechniqueWithoutProgress && !warnMissingProgress) {
      for (const item of techniqueWithoutProgress) {
        findings.push({
          type: "TECHNIQUE_WITHOUT_PROGRESS",
          date: item.date,
          stts: item.stts,
          message: `Ngày ${item.date}: XML5 có PHAU_THUAT nhưng DIEN_BIEN_LS trống (STT: ${item.stts.join(", ")}); cần rà soát.`,
        });
      }
    }
    if (warnRepeatedAcrossDays && safeToFlagAcrossDays) {
      for (const item of repeatedAcrossDays) {
        findings.push({
          type: "REPEATED_PROGRESS_ACROSS_DAYS",
          dates: item.dates,
          stts: item.stts,
          entryCount: item.stts.length,
          normalizedLength: item.textLength,
          preview: item.preview,
          message: `Nội dung DIEN_BIEN_LS giống nhau trên ${item.uniqueDays} ngày (${item.dates.join(", ")}); cần đối chiếu diễn biến thực tế, chưa kết luận sao chép sai.`,
        });
      }
    }

    const details = {
      source: "XML5.CHI_TIET_DIEN_BIEN_BENH",
      selectedXml3Count: selectedXml3.length,
      serviceCodes,
      totalXml5Rows: rawEntries.length,
      validXml5Rows: entries.length,
      uniqueProgressDays: new Set(entries.map((item) => item.date)).size,
      uniqueObservations: observations.size,
      sameDayRepeatedRows: entries.length - observations.size,
      emptyProgressGroups: emptyObservations.length,
      shortProgressGroups: shortObservations.length,
      techniqueWithoutProgressGroups: techniqueWithoutProgress.length,
      repeatedAcrossDaysGroups: repeatedAcrossDays.length,
      emptyObservations,
      shortObservations,
      repeatedAcrossDays,
      missingTimeCount,
      invalidTimeCount,
      outsideWindowCount,
      uncertain,
      warnMissingProgress,
      warnShortProgress,
      warnTechniqueWithoutProgress,
      warnRepeatedAcrossDays,
      minMeaningfulChars,
      minRepeatedDays,
      findings,
      note: "Các phát hiện chỉ là dấu hiệu cần rà soát nội dung XML5. Trùng diễn biến không tự động là vi phạm BHYT; nhiều dòng cùng ngày có thể dùng chung diễn biến cho nhiều kỹ thuật.",
    };

    if (findings.length) {
      return result(
        rule,
        "FAIL",
        `Có ${findings.length} nhóm nội dung diễn biến XML5 cần rà soát; chưa kết luận vi phạm.`,
        details,
        findings.length
      );
    }

    if (
      !warnMissingProgress &&
      !warnShortProgress &&
      !warnTechniqueWithoutProgress &&
      !warnRepeatedAcrossDays
    ) {
      return result(
        rule,
        "SKIP",
        `Đã thống kê ${entries.length} dòng XML5 hợp lệ trên ${details.uniqueProgressDays} ngày; chưa bật cảnh báo chất lượng nội dung.`,
        details
      );
    }

    if (uncertain.length || (warnRepeatedAcrossDays && !safeToFlagAcrossDays)) {
      return result(
        rule,
        "SKIP",
        "Đã thống kê XML5 nhưng còn mốc thời gian chưa đủ tin cậy để đánh giá toàn bộ điều kiện.",
        details
      );
    }

    return result(
      rule,
      "PASS",
      "Không phát hiện vấn đề theo các tiêu chí chất lượng XML5 đã bật.",
      details
    );
  },
};
