import type { RuleValidator, ValidationRule, RuleResult } from "../rule.types.js";

type JsonRow = Record<string, unknown>;
type Technique = "ELECTRO" | "MANUAL";

type DailyBucket = {
  serviceCount: number;
  serviceCodes: Set<string>;
  serviceStts: Set<string>;
};

type Xml5Day = {
  entries: number;
  describedTechniques: Set<Technique>;
  descriptionSamples: string[];
};

type Finding = {
  type: "TECHNIQUE_NOT_DESCRIBED_IN_XML5";
  date: string;
  technique: Technique;
  techniqueName: string;
  serviceCount: number;
  serviceCodes: string[];
  xml3Stts: string[];
  xml5ProgressCount: number;
  xml5DescribedTechniques: Technique[];
  message: string;
};

const DAY_MS = 86_400_000;
const DEFAULT_TECHNIQUES: Record<Technique, string[]> = {
  ELECTRO: ["08.0313.0230", "08.0278.0230"],
  MANUAL: ["08.0432.0280", "08.0392.0280"],
};

function object(value: unknown): JsonRow | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRow : null;
}
function first(value: unknown): JsonRow | null {
  return object(Array.isArray(value) ? value[0] : value);
}
function rows(value: unknown): JsonRow[] {
  const a = Array.isArray(value) ? value : value == null ? [] : [value];
  return a.filter((x): x is JsonRow => object(x) !== null);
}
function value(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}
function xml3Rows(xml: unknown): JsonRow[] {
  const root = first(xml);
  const section = first(root?.CHITIEU_CHITIET_DVKT_VTYT);
  return rows(first(section?.DSACH_CHI_TIET_DVKT)?.CHI_TIET_DVKT);
}
function xml5Rows(xml: unknown): JsonRow[] {
  const root = first(xml);
  const section = first(root?.CHITIEU_CHITIET_DIENBIENLAMSANG);
  return rows(first(section?.DSACH_CHI_TIET_DIEN_BIEN_BENH)?.CHI_TIET_DIEN_BIEN_BENH);
}
function medicalDay(raw: unknown): string | null {
  const s = value(raw);
  if (!/^\d{12}(?:\d{2})?$/.test(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  const h = Number(s.slice(8, 10));
  const min = Number(s.slice(10, 12));
  const sec = s.length === 14 ? Number(s.slice(12, 14)) : 0;
  const ms = Date.UTC(y, m - 1, d, h, min, sec);
  if (!Number.isFinite(ms)) return null;
  const t = new Date(ms);
  if (t.getUTCFullYear() !== y || t.getUTCMonth() + 1 !== m ||
      t.getUTCDate() !== d || t.getUTCHours() !== h ||
      t.getUTCMinutes() !== min || t.getUTCSeconds() !== sec) return null;
  return t.toISOString().slice(0, 10);
}
function normalizeText(raw: unknown): string {
  // Normalize accents without making assumptions about the number of procedures.
  return value(raw).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/\s+/g, " ");
}
function techniquesInDescription(raw: unknown): Set<Technique> {
  const t = normalizeText(raw);
  const result = new Set<Technique>();
  if (/\bdien\s*cham\b/.test(t)) result.add("ELECTRO");
  if (/\bxoa\s*bop\s*bam\s*huyet\b/.test(t)) result.add("MANUAL");
  return result;
}
function configuredGroups(config: JsonRow): Record<Technique, string[]> {
  const raw = object(config.techniqueGroups);
  const group = (key: Technique): string[] => {
    const source = raw && Object.prototype.hasOwnProperty.call(raw, key) ? raw[key] : DEFAULT_TECHNIQUES[key];
    return Array.isArray(source)
      ? [...new Set(source.map(value).filter(Boolean))] : [];
  };
  return { ELECTRO: group("ELECTRO"), MANUAL: group("MANUAL") };
}
function makeResult(
  rule: ValidationRule,
  status: RuleResult["status"],
  message: string,
  details: Record<string, unknown>,
  issueCount = 0
): RuleResult {
  return { ruleId: rule.id, ruleCode: rule.code, status,
    severity: rule.severity, message, details, issueCount };
}

export const yhctXml3Xml5TechniqueMatchRule: RuleValidator = {
  async evaluate(context, rule, _runtime) {
    const xml1 = first(first(context.xml1)?.TONG_HOP);
    const kcb = value(xml1?.MA_LOAI_KCB).padStart(2, "0");
    if (!xml1 || kcb !== "02") {
      return makeResult(rule, "SKIP", "Chỉ áp dụng hồ sơ ngoại trú (02).", { kcb });
    }
    const rawConfig = object(rule.config) ?? {};
    const groups = configuredGroups(rawConfig);
    const mapping = new Map<string, Technique>();
    for (const technique of ["ELECTRO", "MANUAL"] as const) {
      for (const code of groups[technique]) {
        const previous = mapping.get(code);
        if (previous && previous !== technique) {
          return makeResult(rule, "SKIP", "Mã DVKT xuất hiện ở nhiều nhóm kỹ thuật, cần sửa cấu hình.",
            { reason: "OVERLAPPING_TECHNIQUE_GROUPS", code, groups });
        }
        mapping.set(code, technique);
      }
    }
    if (mapping.size === 0) {
      return makeResult(rule, "SKIP", "Chưa cấu hình mã DVKT cần đối chiếu.",
        { reason: "NO_TECHNIQUE_CODES", groups });
    }

    const start = medicalDay(xml1.NGAY_VAO);
    const end = medicalDay(xml1.NGAY_RA);
    if (!start || !end || start > end) {
      return makeResult(rule, "SKIP", "Ngày vào/ra XML1 không hợp lệ.",
        { reason: "INVALID_TREATMENT_WINDOW", ngayVao: xml1.NGAY_VAO, ngayRa: xml1.NGAY_RA });
    }
    const windowDays = (Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / DAY_MS + 1;
    if (windowDays > 366) {
      return makeResult(rule, "SKIP", "Khoảng điều trị vượt 366 ngày.",
        { reason: "TREATMENT_WINDOW_TOO_LARGE", windowDays });
    }

    const serviceDays = new Map<string, Map<Technique, DailyBucket>>();
    const invalidXml3: Array<Record<string, unknown>> = [];
    let totalSelectedXml3 = 0;
    for (const item of xml3Rows(context.xml3)) {
      const code = value(item.MA_DICH_VU);
      const technique = mapping.get(code);
      if (!technique) continue;
      totalSelectedXml3++;
      const date = medicalDay(item.NGAY_TH_YL);
      if (!date || date < start || date > end) {
        invalidXml3.push({ stt: value(item.STT), serviceCode: code,
          performedAt: value(item.NGAY_TH_YL), reason: date ? "OUTSIDE_XML1" : "INVALID_TIME" });
        continue;
      }
      let dayGroups = serviceDays.get(date);
      if (!dayGroups) {
        dayGroups = new Map();
        serviceDays.set(date, dayGroups);
      }
      let bucket = dayGroups.get(technique);
      if (!bucket) {
        bucket = { serviceCount: 0, serviceCodes: new Set(), serviceStts: new Set() };
        dayGroups.set(technique, bucket);
      }
      bucket.serviceCount++;
      bucket.serviceCodes.add(code);
      if (value(item.STT)) bucket.serviceStts.add(value(item.STT));
    }
    if (totalSelectedXml3 === 0) {
      return makeResult(rule, "SKIP", "Không có DVKT trong nhóm kỹ thuật cần đối chiếu.",
        { totalSelectedXml3: 0, techniqueGroups: groups });
    }

    // XML5 PHAU_THUAT describes procedures, while DIEN_BIEN_LS describes clinical progress.
    // Repeated XML5 rows at the same minute may share a procedure note: count presence per day only.
    const hasXml5File = context.xml5 !== null && context.xml5 !== undefined;
    const progressRows = xml5Rows(context.xml5);
    const progressDays = new Map<string, Xml5Day>();
    const invalidXml5: Array<Record<string, unknown>> = [];
    for (const item of progressRows) {
      const date = medicalDay(item.THOI_DIEM_DBLS);
      if (!date || date < start || date > end) {
        invalidXml5.push({ stt: value(item.STT), time: value(item.THOI_DIEM_DBLS),
          reason: date ? "OUTSIDE_XML1" : "INVALID_TIME" });
        continue;
      }
      let progress = progressDays.get(date);
      if (!progress) {
        progress = { entries: 0, describedTechniques: new Set(), descriptionSamples: [] };
        progressDays.set(date, progress);
      }
      progress.entries++;
      const description = value(item.PHAU_THUAT);
      if (description && progress.descriptionSamples.length < 3 &&
          !progress.descriptionSamples.includes(description.slice(0, 120))) {
        progress.descriptionSamples.push(description.slice(0, 120));
      }
      for (const technique of techniquesInDescription(description)) {
        progress.describedTechniques.add(technique);
      }
    }

    const warnPartialMismatch = rawConfig.warnPartialMismatch !== false;
    const warnMissingAllDescriptions = rawConfig.warnMissingAllDescriptions === true;
    const xml5TimeReliable = hasXml5File && progressRows.length > 0 && invalidXml5.length === 0;
    // Conservative: if XML5 timestamps are invalid, don't produce a finding for missing descriptions.
    const canWarn = xml5TimeReliable && invalidXml3.length === 0;
    const findings: Finding[] = [];
    const dailyStats: Array<Record<string, unknown>> = [];
    let daysWithoutXml5 = 0;
    let daysWithoutTechniqueDescriptions = 0;
    let matchedTechniqueGroups = 0;
    let unmatchedTechniqueGroups = 0;

    for (const [date, dayGroups] of [...serviceDays.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const progress = progressDays.get(date);
      const hasProgress = !!progress;
      const described = progress?.describedTechniques ?? new Set<Technique>();
      const compared = [] as Array<Record<string, unknown>>;
      if (!hasProgress) daysWithoutXml5++;
      else if (described.size === 0) daysWithoutTechniqueDescriptions++;
      for (const [technique, bucket] of dayGroups) {
        const matched = described.has(technique);
        if (hasProgress && described.size > 0) {
          if (matched) matchedTechniqueGroups++;
          else unmatchedTechniqueGroups++;
        }
        compared.push({ technique, serviceCount: bucket.serviceCount,
          serviceCodes: [...bucket.serviceCodes].sort(), matched,
          assessment: !hasProgress ? "NO_XML5_SAME_DAY" : described.size === 0
            ? "XML5_WITHOUT_TECHNIQUE_DESCRIPTION" : matched ? "MATCHED" : "NOT_DESCRIBED" });
        const shouldWarn = canWarn && hasProgress && !matched &&
          ((described.size > 0 && warnPartialMismatch) ||
           (described.size === 0 && warnMissingAllDescriptions));
        if (shouldWarn) {
          const label = technique === "ELECTRO" ? "Điện châm" : "Xoa bóp bấm huyệt";
          findings.push({ type: "TECHNIQUE_NOT_DESCRIBED_IN_XML5", date,
            technique, techniqueName: label, serviceCount: bucket.serviceCount,
            serviceCodes: [...bucket.serviceCodes].sort(),
            xml3Stts: [...bucket.serviceStts].sort(),
            xml5ProgressCount: progress?.entries ?? 0,
            xml5DescribedTechniques: [...described].sort(),
            message: `Ngày ${date} có ${bucket.serviceCount} DVKT ${label} trong XML3 nhưng không tìm thấy mô tả kỹ thuật tương ứng ở trường PHAU_THUAT của XML5 cùng ngày; cần đối chiếu hồ sơ, chưa kết luận sai.` });
        }
      }
      dailyStats.push({ date, xml5ProgressCount: progress?.entries ?? 0,
        xml5DescribedTechniques: [...described].sort(),
        techniqueGroups: compared });
    }

    const details = {
      scope: "MA_LOAI_KCB=02", timeSourceXml3: "NGAY_TH_YL",
      timeSourceXml5: "THOI_DIEM_DBLS", descriptionSource: "XML5.PHAU_THUAT",
      techniqueGroups: groups, warnPartialMismatch, warnMissingAllDescriptions,
      hasXml5File, totalXml5Rows: progressRows.length, totalSelectedXml3,
      daysWithXml3: serviceDays.size, daysWithXml5: progressDays.size,
      daysWithoutXml5, daysWithoutTechniqueDescriptions,
      matchedTechniqueGroups, unmatchedTechniqueGroups,
      invalidXml3Count: invalidXml3.length, invalidXml5Count: invalidXml5.length,
      invalidXml3, invalidXml5, xml5TimeReliable, canWarn,
      dailyStats, findings,
      note: "Đối chiếu theo nhóm kỹ thuật và ngày, không theo số dòng mô tả XML5. " +
        "Không có XML5 cùng ngày được để Rule 14 xử lý. " +
        "Không có mô tả kỹ thuật hoặc mô tả khác nhau không tự chứng minh vi phạm BHYT.",
    };
    if (findings.length > 0) {
      return makeResult(rule, "FAIL",
        `Có ${findings.length} nhóm kỹ thuật XML3 chưa tìm thấy mô tả tương ứng trong XML5 cùng ngày; cần rà soát.`,
        details, findings.length);
    }
    if (!canWarn) {
      return makeResult(rule, "SKIP",
        "Đã thống kê nhưng XML3/XML5 có dữ liệu thời gian không đủ tin cậy để kết luận đối chiếu kỹ thuật.", details);
    }
    if (daysWithoutXml5 > 0 || daysWithoutTechniqueDescriptions > 0) {
      return makeResult(rule, "SKIP",
        "Đã đối chiếu kỹ thuật; còn ngày không có XML5 hoặc không có mô tả kỹ thuật, cần rà soát dữ liệu. ", details);
    }
    return makeResult(rule, "PASS",
      "Các nhóm DVKT XML3 được tìm thấy trong mô tả kỹ thuật XML5 cùng ngày theo phạm vi cấu hình.", details);
  },
};
