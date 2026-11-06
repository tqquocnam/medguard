import type {
  RuleValidator,
  ValidationRule,
  RuleResult,
} from "../rule.types.js";

type Row = Record<string, unknown>;
type DayStatus = "BOTH" | "XML3_ONLY" | "XML5_ONLY" | "NEITHER";
type Technique = "ELECTRO" | "MANUAL";

interface StaffActivity {
  staffCode: string;
  staffName: string | null;
  role: string;
  source: "XML3" | "XML5";
  at: string;
  stt: string;
  serviceCode: string;
  serviceName: string;
  lookupStatus: "FOUND" | "NOT_FOUND" | "AMBIGUOUS";
}

interface ServiceEntry {
  stt: string;
  code: string;
  name: string;
  orderAt: string;
  orderDay: number | null;
  performedAt: string;
  performedDay: number;
  staffCodes: string[];
}

interface ServiceDay {
  count: number;
  codes: Set<string>;
  services: ServiceEntry[];
}

interface ProgressEntry {
  stt: string;
  at: string;
  day: number;
  description: string;
  procedure: string;
  staffCodes: string[];
}

interface TreatmentDay {
  date: string;
  serviceCount: number;
  serviceCodes: string[];
  progressCount: number;
  hasXml3Service: boolean;
  hasXml5Progress: boolean;
  status: DayStatus;
  orderDayProgressCandidates: number;
  staffActivities: StaffActivity[];
}

interface Gap {
  type: "TREATMENT_GAP" | "NO_EVIDENCE_GAP";
  fromServiceDate: string;
  toServiceDate: string;
  missingDays: string[];
  gapDays: number;
}

interface Finding {
  type:
    | "XML3_WITHOUT_XML5"
    | "TREATMENT_GAP"
    | "NO_EVIDENCE_GAP";
  date?: string;
  serviceCount?: number;
  serviceCodes?: string[];
  fromServiceDate?: string;
  toServiceDate?: string;
  missingDays?: string[];
  gapDays?: number;
  threshold?: number;
  exceededBy?: number;
  message: string;
}

const DAY_MS = 86400000;
const MAX_DAYS = 366;

const DEFAULT_CODES = [
  "08.0313.0230",
  "08.0278.0230",
  "08.0432.0280",
  "08.0392.0280",
];

const TECHNIQUE_GROUPS: Record<string, Technique> = {
  "08.0313.0230": "ELECTRO",
  "08.0278.0230": "ELECTRO",
  "08.0432.0280": "MANUAL",
  "08.0392.0280": "MANUAL",
};

// ======================================================
// HELPERS
// ======================================================

function obj(value: unknown): Row | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Row)
    : null;
}

function first(value: unknown): Row | null {
  return obj(Array.isArray(value) ? value[0] : value);
}

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function rows(value: unknown): Row[] {
  const items = Array.isArray(value)
    ? value
    : value == null
      ? []
      : [value];

  return items.filter((item): item is Row => obj(item) !== null);
}

function getXml3Rows(xml: unknown): Row[] {
  const root = first(xml);
  const section = first(root?.CHITIEU_CHITIET_DVKT_VTYT);
  const list = first(section?.DSACH_CHI_TIET_DVKT);

  return rows(list?.CHI_TIET_DVKT);
}

function getXml5Rows(xml: unknown): Row[] {
  const root = first(xml);
  const section = first(root?.CHITIEU_CHITIET_DIENBIENLAMSANG);
  const list = first(section?.DSACH_CHI_TIET_DIEN_BIEN_BENH);

  return rows(list?.CHI_TIET_DIEN_BIEN_BENH);
}

function normalizeStaff(value: unknown): string {
  return text(value).replace(/\s+/g, "").toLowerCase();
}

function parseStaff(value: unknown): string[] {
  return [
    ...new Set(
      text(value)
        .split(/[;|,]+/)
        .map(normalizeStaff)
        .filter(Boolean),
    ),
  ];
}

function normalizeContent(value: unknown): string {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/&lt;|&gt;|&amp;/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesTechnique(
  service: ServiceEntry,
  procedure: string,
): boolean {
  const content = normalizeContent(procedure);

  if (!content) return false;

  const group = TECHNIQUE_GROUPS[service.code.toUpperCase()];

  if (group === "ELECTRO") {
    return content.includes("dien cham");
  }

  if (group === "MANUAL") {
    return (
      content.includes("xoa bop") ||
      content.includes("bam huyet")
    );
  }

  return false;
}

function staffRelation(
  xml3Staff: string[],
  xml5Staff: string[],
): "MATCH" | "MISMATCH" | "UNKNOWN" {
  if (!xml3Staff.length || !xml5Staff.length) {
    return "UNKNOWN";
  }

  const codes = new Set(xml5Staff);

  return xml3Staff.some(code => codes.has(code))
    ? "MATCH"
    : "MISMATCH";
}

// Date.UTC chỉ dùng tạo trục so sánh.
// Không chuyển thời gian XML sang múi giờ khác.
function parseMedicalTime(value: string): number | null {
  if (!/^\d{12}(\d{2})?$/.test(value)) {
    return null;
  }

  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(4, 6));
  const d = Number(value.slice(6, 8));
  const h = Number(value.slice(8, 10));
  const min = Number(value.slice(10, 12));
  const sec = value.length === 14
    ? Number(value.slice(12, 14))
    : 0;

  const ms = Date.UTC(y, m - 1, d, h, min, sec);

  if (!Number.isFinite(ms)) return null;

  const dt = new Date(ms);

  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d ||
    dt.getUTCHours() !== h ||
    dt.getUTCMinutes() !== min ||
    dt.getUTCSeconds() !== sec
  ) {
    return null;
  }

  return ms;
}

function dayStart(value: string): number | null {
  const ms = parseMedicalTime(value);

  return ms === null
    ? null
    : Math.floor(ms / DAY_MS) * DAY_MS;
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function threshold(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function createResult(
  rule: ValidationRule,
  status: RuleResult["status"],
  message: string,
  details: Record<string, unknown>,
  issueCount = 0,
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

// ======================================================
// KHOẢNG TRỐNG ĐIỀU TRỊ
// ======================================================

function buildGaps(
  dates: number[],
  type: Gap["type"],
): Gap[] {
  const sorted = [...new Set(dates)].sort((a, b) => a - b);
  const result: Gap[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const next = sorted[i];
    const gapDays =
      Math.round((next - previous) / DAY_MS) - 1;

    if (gapDays <= 0) continue;

    const missingDays: string[] = [];

    for (
      let day = previous + DAY_MS;
      day < next;
      day += DAY_MS
    ) {
      missingDays.push(isoDate(day));
    }

    result.push({
      type,
      fromServiceDate: isoDate(previous),
      toServiceDate: isoDate(next),
      missingDays,
      gapDays,
    });
  }

  return result;
}

function longestGap(gaps: Gap[]): number {
  return gaps.reduce(
    (max, gap) => Math.max(max, gap.gapDays),
    0,
  );
}

function gapFindings(
  gaps: Gap[],
  limit: number | null,
  name: string,
): Finding[] {
  if (limit === null) return [];

  return gaps
    .filter(gap => gap.gapDays > limit)
    .map(gap => ({
      ...gap,
      threshold: limit,
      exceededBy: gap.gapDays - limit,
      message:
        `${name}: ${gap.gapDays} ngày ` +
        "không ghi nhận dữ liệu giữa hai ngày " +
        `có hoạt động, vượt ngưỡng ${limit} ngày.`,
    }));
}

// ======================================================
// RULE CHÍNH
// ======================================================

export const yhctDailyTreatmentContinuityRule: RuleValidator = {
  async evaluate(context, rule, runtime) {
    // 1. Chỉ áp dụng ngoại trú YHCT.
    const medicalCase = context.medicalCase as
      typeof context.medicalCase & {
        treatment_group?: string | null;
      };

    const treatmentGroup = text(
      medicalCase.treatment_group,
    ).toUpperCase();

    const xml1 = first(first(context.xml1)?.TONG_HOP);
    const kcb = text(xml1?.MA_LOAI_KCB).padStart(2, "0");

    if (
      treatmentGroup !== "YHCT" ||
      !xml1 ||
      kcb !== "02"
    ) {
      return createResult(
        rule,
        "SKIP",
        "Chỉ áp dụng kiểm tra liên tục điều trị ngoại trú YHCT.",
        {
          skipReason: "NOT_APPLICABLE",
          treatmentGroup,
          kcb,
        },
      );
    }

    // 2. Cấu hình.
    const config = rule.config ?? {};

    const serviceCodes = Array.isArray(config.serviceCodes)
      ? (config.serviceCodes as unknown[])
          .map(text)
          .filter(Boolean)
      : DEFAULT_CODES;

    const selectedCodes = new Set(serviceCodes);

    if (!selectedCodes.size) {
      return createResult(
        rule,
        "SKIP",
        "Chưa cấu hình DVKT YHCT.",
        { skipReason: "NO_SERVICE_CODES" },
      );
    }

    const maxGapDays = threshold(config.maxGapDays);

    const maxNoEvidenceGapDays = threshold(
      config.maxNoEvidenceGapDays,
    );

    const warnXml3WithoutXml5 =
      config.warnXml3WithoutXml5 === true;

    // 3. Khoảng ngày điều trị XML1.
    const treatmentStart = text(xml1.NGAY_VAO);
    const treatmentEnd = text(xml1.NGAY_RA);
    const startDay = dayStart(treatmentStart);
    const endDay = dayStart(treatmentEnd);

    if (
      startDay === null ||
      endDay === null ||
      endDay < startDay
    ) {
      return createResult(
        rule,
        "SKIP",
        "Khoảng ngày điều trị XML1 không hợp lệ.",
        {
          treatmentStart,
          treatmentEnd,
          skipReason: "INVALID_TREATMENT_WINDOW",
        },
      );
    }

    const totalTreatmentDays =
      Math.round((endDay - startDay) / DAY_MS) + 1;

    if (totalTreatmentDays > MAX_DAYS) {
      return createResult(
        rule,
        "SKIP",
        "Đợt điều trị vượt giới hạn 366 ngày.",
        { totalTreatmentDays },
      );
    }

    const xml3Rows = getXml3Rows(context.xml3);
    const progressRows = getXml5Rows(context.xml5);

    // 4. Đọc XML3.
    const serviceDays = new Map<number, ServiceDay>();
    const uncertain: Array<Record<string, unknown>> = [];

    let totalServices = 0;
    let validServices = 0;
    let missingTime = 0;
    let invalidTime = 0;
    let outsideTreatment = 0;
    let missingOrderTime = 0;
    let invalidOrderTime = 0;

    for (const row of xml3Rows) {
      const code = text(row.MA_DICH_VU);

      if (!selectedCodes.has(code)) continue;

      totalServices++;

      const stt = text(row.STT);
      const performedAt = text(row.NGAY_TH_YL);
      const orderAt = text(row.NGAY_YL);

      if (!performedAt) {
        missingTime++;

        uncertain.push({
          type: "MISSING_PERFORM_TIME",
          source: "XML3",
          stt,
          serviceCode: code,
          performedAt,
          message: "Thiếu NGAY_TH_YL.",
        });

        continue;
      }

      const performedDay = dayStart(performedAt);

      if (performedDay === null) {
        invalidTime++;

        uncertain.push({
          type: "INVALID_PERFORM_TIME",
          source: "XML3",
          stt,
          serviceCode: code,
          performedAt,
          message: "NGAY_TH_YL không hợp lệ.",
        });

        continue;
      }

      if (
        performedDay < startDay ||
        performedDay > endDay
      ) {
        outsideTreatment++;

        uncertain.push({
          type: "OUTSIDE_TREATMENT_DATES",
          source: "XML3",
          stt,
          serviceCode: code,
          performedAt,
          message: "DVKT ngoài khoảng ngày điều trị XML1.",
        });

        continue;
      }

      let orderDay: number | null = null;

      if (!orderAt) {
        missingOrderTime++;
      } else {
        orderDay = dayStart(orderAt);

        if (orderDay === null) {
          invalidOrderTime++;
        }
      }

      if (
        orderDay !== null &&
        orderDay > performedDay
      ) {
        uncertain.push({
          type: "ORDER_AFTER_PERFORM_DAY",
          source: "XML3",
          stt,
          serviceCode: code,
          orderAt,
          performedAt,
          message: "Ngày y lệnh sau ngày thực hiện.",
        });

        orderDay = null;
      }

      validServices++;

      const dayData = serviceDays.get(performedDay) ?? {
        count: 0,
        codes: new Set<string>(),
        services: [] as ServiceEntry[],
      };

      dayData.count++;
      dayData.codes.add(code);

      dayData.services.push({
        stt,
        code,
        name: text(row.TEN_DICH_VU),
        orderAt,
        orderDay,
        performedAt,
        performedDay,
        staffCodes: parseStaff(row.NGUOI_THUC_HIEN),
      });

      serviceDays.set(performedDay, dayData);
    }

    // 5. Đọc XML5.
    const hasXml5 = context.xml5 != null;
    const progressDays = new Map<number, number>();
    const progressByDay = new Map<number, ProgressEntry[]>();

    let totalProgressEntries = 0;
    let validProgressEntries = 0;
    let missingProgressTime = 0;
    let invalidProgressTime = 0;
    let outsideProgressTime = 0;

    for (const row of progressRows) {
      totalProgressEntries++;

      const stt = text(row.STT);
      const progressAt = text(row.THOI_DIEM_DBLS);

      if (!progressAt) {
        missingProgressTime++;

        uncertain.push({
          type: "MISSING_PROGRESS_TIME",
          source: "XML5",
          stt,
          performedAt: "",
          message: "Thiếu THOI_DIEM_DBLS.",
        });

        continue;
      }

      const date = dayStart(progressAt);

      if (date === null) {
        invalidProgressTime++;

        uncertain.push({
          type: "INVALID_PROGRESS_TIME",
          source: "XML5",
          stt,
          performedAt: progressAt,
          message: "THOI_DIEM_DBLS không hợp lệ.",
        });

        continue;
      }

      if (date < startDay || date > endDay) {
        outsideProgressTime++;

        uncertain.push({
          type: "PROGRESS_OUTSIDE_TREATMENT",
          source: "XML5",
          stt,
          performedAt: progressAt,
          message: "Diễn biến ngoài khoảng điều trị XML1.",
        });

        continue;
      }

      validProgressEntries++;

      progressDays.set(
        date,
        (progressDays.get(date) ?? 0) + 1,
      );

      const entry: ProgressEntry = {
        stt,
        at: progressAt,
        day: date,
        description: text(row.DIEN_BIEN_LS),
        procedure: text(row.PHAU_THUAT),
        staffCodes: parseStaff(row.NGUOI_THUC_HIEN),
      };

      const list = progressByDay.get(date) ?? [];

      list.push(entry);
      progressByDay.set(date, list);
    }

    // 6. Thu thập nhân sự theo ngày.
    // Đọc toàn bộ XML3 của hồ sơ để bao gồm dịch vụ khám.
    // Người chỉ định theo NGAY_YL.
    // Người thực hiện theo NGAY_TH_YL.
    // Người ghi nhận XML5 theo THOI_DIEM_DBLS.
    const staffByDay = new Map<number, StaffActivity[]>();

    function addStaffActivity(
      row: Row,
      source: StaffActivity["source"],
      staffField: string,
      timeField: string,
      role: string,
    ) {
      const at = text(row[timeField]);
      const day = dayStart(at);

      if (
        day === null ||
        day < startDay! ||
        day > endDay!
      ) {
        return;
      }

      const codes = new Map<string, string>();

      for (const rawCode of text(row[staffField]).split(/[;|,]+/)) {
        const code = rawCode.trim();
        const normalized = normalizeStaff(code);

        if (normalized && !codes.has(normalized)) {
          codes.set(normalized, code);
        }
      }

      const activities = staffByDay.get(day) ?? [];

      for (const staffCode of codes.values()) {
        activities.push({
          staffCode,
          staffName: null,
          role,
          source,
          at,
          stt: text(row.STT),
          serviceCode: source === "XML3"
            ? text(row.MA_DICH_VU)
            : "",
          serviceName: source === "XML3"
            ? text(row.TEN_DICH_VU)
            : "",
          lookupStatus: "NOT_FOUND",
        });
      }

      staffByDay.set(day, activities);
    }

    for (const row of xml3Rows) {
      addStaffActivity(
        row,
        "XML3",
        "MA_BAC_SI",
        "NGAY_YL",
        "Bác sĩ chỉ định",
      );

      addStaffActivity(
        row,
        "XML3",
        "NGUOI_THUC_HIEN",
        "NGAY_TH_YL",
        "Người thực hiện DVKT",
      );
    }

    for (const row of progressRows) {
      addStaffActivity(
        row,
        "XML5",
        "NGUOI_THUC_HIEN",
        "THOI_DIEM_DBLS",
        "Người ghi nhận diễn biến XML5",
      );
    }

    const allActivities = [...staffByDay.values()].flat();

    const lookupCodes = [
      ...new Set(
        allActivities.map(item =>
          normalizeStaff(item.staffCode),
        ),
      ),
    ];

    type StaffLookup = {
      code: string;
      staff_id: string;
      full_name: string | null;
    };

    const staffLookup = new Map<string, StaffLookup>();
    const ambiguousCodes = new Set<string>();

    if (lookupCodes.length > 0) {
      const found = await runtime.client.query<StaffLookup>(
        `
          WITH staff_codes AS (
            SELECT
              ms.id::text AS staff_id,
              ms.full_name,
              ms.license_number AS raw_code
            FROM catalog.medical_staff ms

            UNION ALL

            SELECT
              ms.id::text AS staff_id,
              ms.full_name,
              ms.social_insurance_code AS raw_code
            FROM catalog.medical_staff ms

            UNION ALL

            SELECT
              ms.id::text AS staff_id,
              ms.full_name,
              a.alias_code AS raw_code
            FROM catalog.medical_staff_aliases a
            JOIN catalog.medical_staff ms
              ON ms.id = a.staff_id
          ),
          normalized AS (
            SELECT
              staff_id,
              full_name,
              LOWER(
                REGEXP_REPLACE(
                  COALESCE(raw_code, ''),
                  '[[:space:]]+',
                  '',
                  'g'
                )
              ) AS code
            FROM staff_codes
          )
          SELECT DISTINCT
            code,
            staff_id,
            full_name
          FROM normalized
          WHERE code <> ''
            AND code = ANY($1::text[])
        `,
        [lookupCodes],
      );

      for (const person of found.rows) {
        const previous = staffLookup.get(person.code);

        if (
          previous &&
          previous.staff_id !== person.staff_id
        ) {
          ambiguousCodes.add(person.code);
        } else {
          staffLookup.set(person.code, person);
        }
      }
    }

    for (const activity of allActivities) {
      const key = normalizeStaff(activity.staffCode);

      if (ambiguousCodes.has(key)) {
        activity.lookupStatus = "AMBIGUOUS";
        continue;
      }

      const person = staffLookup.get(key);

      if (person) {
        activity.staffName = text(person.full_name) || null;
        activity.lookupStatus = "FOUND";
      }
    }

    for (const activities of staffByDay.values()) {
      activities.sort((a, b) =>
        a.at.padEnd(14, "0").localeCompare(
          b.at.padEnd(14, "0"),
        ) ||
        a.role.localeCompare(b.role) ||
        a.staffCode.localeCompare(b.staffCode),
      );
    }

    // 7. Đối chiếu ngày y lệnh và kỹ thuật.
    const calendar: TreatmentDay[] = [];
    const missingDays: string[] = [];
    const daysWithBothDates: string[] = [];
    const daysWithProgressOnlyDates: string[] = [];
    const daysWithServiceOnlyDates: string[] = [];
    const daysWithNeitherDates: string[] = [];

    const orderDayReviews: Array<Record<string, unknown>> = [];
    const techniqueMatches: Array<Record<string, unknown>> = [];

    const unsupportedByDay =
      new Map<number, ServiceEntry[]>();

    for (
      let day = startDay;
      day <= endDay;
      day += DAY_MS
    ) {
      const date = isoDate(day);
      const service = serviceDays.get(day);
      const progressCount = progressDays.get(day) ?? 0;

      const hasXml3Service = service !== undefined;
      const hasXml5Progress = progressCount > 0;

      let status: DayStatus;

      if (hasXml3Service && hasXml5Progress) {
        status = "BOTH";
        daysWithBothDates.push(date);
      } else if (hasXml3Service) {
        status = "XML3_ONLY";
        daysWithServiceOnlyDates.push(date);
      } else if (hasXml5Progress) {
        status = "XML5_ONLY";
        daysWithProgressOnlyDates.push(date);
      } else {
        status = "NEITHER";
        daysWithNeitherDates.push(date);
      }

      if (!hasXml3Service) {
        missingDays.push(date);
      }

      let candidates = 0;

      if (hasXml3Service && !hasXml5Progress) {
        const unsupported: ServiceEntry[] = [];

        for (const item of service?.services ?? []) {
          const orderDay = item.orderDay;

          if (orderDay === null || orderDay >= day) {
            unsupported.push(item);
            continue;
          }

          const progressEntries =
            progressByDay.get(orderDay) ?? [];

          if (!progressEntries.length) {
            unsupported.push(item);
            continue;
          }

          candidates++;

          const matches = progressEntries
            .filter(progress =>
              matchesTechnique(item, progress.procedure),
            )
            .map(progress => ({
              progress,
              staffRelation: staffRelation(
                item.staffCodes,
                progress.staffCodes,
              ),
            }));

          // Người ghi diễn biến và người thực hiện
          // có thể là hai người khác nhau.
          const supported = matches;

          const reviewBase = {
            stt: item.stt,
            serviceCode: item.code,
            serviceName: item.name,
            orderAt: item.orderAt,
            orderDate: isoDate(orderDay),
            performedAt: item.performedAt,
            performedDate: date,
          };

          if (supported.length > 0) {
            const evidence = supported[0];

            const matched = {
              ...reviewBase,
              type: "ORDER_DAY_TECHNIQUE_MATCH",
              xml5Stt: evidence.progress.stt,
              xml5Date: isoDate(evidence.progress.day),
              xml5Field: "PHAU_THUAT",
              matchedTechnique:
                TECHNIQUE_GROUPS[item.code.toUpperCase()],
              staffRelation: evidence.staffRelation,
              requiresReview: true,
              message:
                "XML5 ngày y lệnh có mô tả kỹ thuật liên quan. " +
                "Chưa chứng minh đầy đủ diễn biến ngày thực hiện.",
            };

            techniqueMatches.push(matched);
            orderDayReviews.push(matched);

            uncertain.push({
              ...matched,
              source: "XML3",
            });

            continue;
          }

          const review = {
            ...reviewBase,
            type: "ORDER_DAY_TECHNIQUE_NOT_FOUND",
            xml5Stt: matches.map(match => match.progress.stt),
            requiresReview: true,
            message:
              "XML5 có diễn biến ngày y lệnh nhưng chưa tìm thấy " +
              "mô tả kỹ thuật tương ứng trong PHAU_THUAT.",
          };

          orderDayReviews.push(review);

          uncertain.push({
            ...review,
            source: "XML3",
          });

          unsupported.push(item);
        }

        if (unsupported.length > 0) {
          unsupportedByDay.set(day, unsupported);
        }
      }

      calendar.push({
        date,
        serviceCount: service?.count ?? 0,
        serviceCodes: [...(service?.codes ?? [])].sort(),
        progressCount,
        hasXml3Service,
        hasXml5Progress,
        status,
        orderDayProgressCandidates: candidates,
        staffActivities: staffByDay.get(day) ?? [],
      });
    }

    // 8. Tính khoảng trống.
    const performedDays = [...serviceDays.keys()]
      .sort((a, b) => a - b);

    const evidenceDays = [
      ...new Set([
        ...serviceDays.keys(),
        ...progressDays.keys(),
      ]),
    ].sort((a, b) => a - b);

    const gaps = buildGaps(
      performedDays,
      "TREATMENT_GAP",
    );

    const noEvidenceGaps = buildGaps(
      evidenceDays,
      "NO_EVIDENCE_GAP",
    );

    const firstServiceDay = performedDays[0] ?? null;

    const lastServiceDay = performedDays.length > 0
      ? performedDays[performedDays.length - 1]
      : null;

    const leadingDaysWithoutService =
      firstServiceDay === null
        ? totalTreatmentDays
        : Math.round(
            (firstServiceDay - startDay) / DAY_MS,
          );

    const trailingDaysWithoutService =
      lastServiceDay === null
        ? totalTreatmentDays
        : Math.round(
            (endDay - lastServiceDay) / DAY_MS,
          );

    // 9. Đánh giá cảnh báo.
    const xml5Reliable =
      hasXml5 &&
      totalProgressEntries > 0 &&
      missingProgressTime === 0 &&
      invalidProgressTime === 0 &&
      outsideProgressTime === 0;

    const xml3Reliable =
      missingTime === 0 &&
      invalidTime === 0 &&
      outsideTreatment === 0;

    const findings: Finding[] = [];

    if (warnXml3WithoutXml5 && xml5Reliable) {
      for (const day of calendar) {
        if (day.status !== "XML3_ONLY") continue;

        const dayMs = dayStart(
          day.date.replace(/-/g, "") + "0000",
        );

        if (dayMs === null) continue;

        const unsupported =
          unsupportedByDay.get(dayMs) ?? [];

        if (!unsupported.length) continue;

        findings.push({
          type: "XML3_WITHOUT_XML5",
          date: day.date,
          serviceCount: unsupported.length,
          serviceCodes: [
            ...new Set(
              unsupported.map(item => item.code),
            ),
          ].sort(),
          message:
            `Ngày ${day.date} có ` +
            `${unsupported.length} DVKT YHCT ` +
            "chưa tìm thấy diễn biến cùng ngày " +
            "hoặc mô tả kỹ thuật liên quan " +
            "vào ngày y lệnh; cần rà soát.",
        });
      }
    }

    if (xml3Reliable) {
      findings.push(
        ...gapFindings(
          gaps,
          maxGapDays,
          "Khoảng trống DVKT XML3",
        ),
      );
    }

    if (xml3Reliable && xml5Reliable) {
      findings.push(
        ...gapFindings(
          noEvidenceGaps,
          maxNoEvidenceGapDays,
          "Khoảng trống cả XML3 và XML5",
        ),
      );
    }

    // 10. Chi tiết kết quả.
    const details = {
      scope: "YHCT_MA_LOAI_KCB_02",
      source: {
        start: "XML1.NGAY_VAO",
        end: "XML1.NGAY_RA",
        ordered: "XML3.NGAY_YL",
        performed: "XML3.NGAY_TH_YL",
        progress: "XML5.THOI_DIEM_DBLS",
        technique: "XML5.PHAU_THUAT",
        performer: "XML3/XML5.NGUOI_THUC_HIEN",
        orderingDoctor: "XML3.MA_BAC_SI",
      },
      treatmentStart,
      treatmentEnd,
      startDate: isoDate(startDay),
      endDate: isoDate(endDay),
      totalTreatmentDays,
      serviceCodes,
      daysWithService: serviceDays.size,
      daysWithoutService:
        totalTreatmentDays - serviceDays.size,
      totalServices,
      validServices,
      missingTime,
      invalidTime,
      outsideTreatment,
      missingOrderTime,
      invalidOrderTime,
      leadingDaysWithoutService,
      trailingDaysWithoutService,
      maxGapDays,
      missingDays,
      gaps,
      longestInternalGap: longestGap(gaps),
      daysWithXml3Service: serviceDays.size,
      daysWithXml5Progress: progressDays.size,
      daysWithBoth: daysWithBothDates.length,
      daysWithProgressOnly:
        daysWithProgressOnlyDates.length,
      daysWithServiceOnly:
        daysWithServiceOnlyDates.length,
      daysWithNeither: daysWithNeitherDates.length,
      daysWithBothDates,
      daysWithProgressOnlyDates,
      daysWithServiceOnlyDates,
      daysWithNeitherDates,
      totalProgressEntries,
      validProgressEntries,
      missingProgressTime,
      invalidProgressTime,
      outsideProgressTime,
      hasXml5,
      xml3Reliable,
      xml5Reliable,
      maxNoEvidenceGapDays,
      warnXml3WithoutXml5,
      noEvidenceGaps,
      longestNoEvidenceGap:
        longestGap(noEvidenceGaps),
      orderDayReviewCount: orderDayReviews.length,
      orderDayReviews,
      techniqueMatchCount: techniqueMatches.length,
      techniqueMatches,
      calendar,
      staffActivityCount: allActivities.length,
      unresolvedStaffCodes: lookupCodes.filter(
        code =>
          !staffLookup.has(code) ||
          ambiguousCodes.has(code),
      ),
      unresolvedCount: uncertain.length,
      uncertain,
      findings,
      issueCount: findings.length,
      note:
        "XML5.PHAU_THUAT được dùng để " +
        "tìm mô tả kỹ thuật liên quan vào ngày " +
        "ra y lệnh. Người ghi diễn biến và người thực hiện " +
        "kỹ thuật có thể khác nhau. Đây không phải bằng chứng " +
        "đã hoàn thành kỹ thuật hoặc ghi đủ " +
        "diễn biến ngày thực hiện. Các trường " +
        "hợp này vẫn cần xác minh.",
    };

    // 11. Trả kết quả.
    if (findings.length > 0) {
      return createResult(
        rule,
        "FAIL",
        `Có ${findings.length} vấn đề ` +
          "về tính liên tục điều trị YHCT " +
          "cần rà soát, chưa kết luận vi phạm.",
        details,
        findings.length,
      );
    }

    if (
      totalServices === 0 &&
      totalProgressEntries === 0
    ) {
      return createResult(
        rule,
        "SKIP",
        "Không có DVKT YHCT hoặc XML5 để đối chiếu.",
        details,
      );
    }

    if (
      validServices === 0 &&
      validProgressEntries === 0
    ) {
      return createResult(
        rule,
        "SKIP",
        "Không có dữ liệu ngày XML3/XML5 hợp lệ.",
        details,
      );
    }

    if (
      maxGapDays === null &&
      maxNoEvidenceGapDays === null &&
      !warnXml3WithoutXml5
    ) {
      return createResult(
        rule,
        "SKIP",
        "Đã thống kê XML3/XML5 nhưng chưa bật điều kiện cảnh báo.",
        details,
      );
    }

    const cannotVerifyXml5 =
      (
        warnXml3WithoutXml5 ||
        maxNoEvidenceGapDays !== null
      ) &&
      !xml5Reliable;

    const cannotVerifyXml3 =
      (
        maxGapDays !== null ||
        maxNoEvidenceGapDays !== null
      ) &&
      !xml3Reliable;

    if (
      cannotVerifyXml5 ||
      cannotVerifyXml3 ||
      uncertain.length > 0
    ) {
      return createResult(
        rule,
        "SKIP",
        "Đã đối chiếu XML3, XML5 và mô tả kỹ thuật; " +
          "còn dữ liệu cần xác minh trước khi kết luận.",
        details,
      );
    }

    return createResult(
      rule,
      "PASS",
      "Đã đối chiếu XML3 và XML5; " +
        "không phát hiện vấn đề theo cấu hình.",
      details,
    );
  },
};