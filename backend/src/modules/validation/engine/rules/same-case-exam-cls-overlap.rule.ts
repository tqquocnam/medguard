import type { RuleValidator } from "../rule.types.js";

type Row = Record<string, unknown>;

interface Exam {
  row: Row;
  index: number;
  start: number;
  doctor: string;
}

function object(value: unknown): Row {
  if (Array.isArray(value)) return object(value[0]);

  return value !== null && typeof value === "object" ? (value as Row) : {};
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function parseTime(value: unknown): number | null {
  const raw = text(value);

  if (!/^\d{12}(\d{2})?$/.test(raw)) return null;

  const y = Number(raw.slice(0, 4));
  const m = Number(raw.slice(4, 6));
  const d = Number(raw.slice(6, 8));
  const h = Number(raw.slice(8, 10));
  const minute = Number(raw.slice(10, 12));
  const second = Number(raw.slice(12, 14) || "0");

  if (y < 1900) return null;

  const time = Date.UTC(y, m - 1, d, h, minute, second);
  const date = new Date(time);

  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d ||
    date.getUTCHours() !== h ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    return null;
  }

  return time;
}

function formatTime(time: number): string {
  const date = new Date(time);
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/` +
    `${date.getUTCFullYear()} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
  );
}

function isExam(row: Row): boolean {
  const group = text(row.MA_NHOM);

  if (group) return Number(group) === 13;

  return /^khám(?:\s|$)/i.test(text(row.TEN_DICH_VU).normalize("NFC"));
}

function isLab(row: Row): boolean {
  return Number(row.MA_NHOM) === 1;
}

function getRows(xml: unknown): Row[] {
  const root = object(xml);
  const container = object(root.CHITIEU_CHITIET_DVKT_VTYT ?? root);
  const list = object(container.DSACH_CHI_TIET_DVKT);
  const value = list.CHI_TIET_DVKT;

  return (Array.isArray(value) ? value : value ? [value] : [])
    .filter((item) => item !== null && typeof item === "object" && !Array.isArray(item))
    .map(object);
}

// Xác định công khám chỉ định dựa trên:
// - Cùng MA_BAC_SI.
// - Công khám bắt đầu không muộn hơn NGAY_YL.
// - Chọn lần khám gần NGAY_YL nhất của bác sĩ đó.
//
// Không dùng NGAY_TH_YL / NGAY_KQ của xét nghiệm để gán công khám.
function findOrderingExam(service: Row, exams: Exam[]): Exam | null {
  const doctor = text(service.MA_BAC_SI);
  const orderTime = parseTime(service.NGAY_YL);

  if (!doctor || orderTime === null) return null;

  const candidates = exams
    .filter((exam) => exam.doctor === doctor && exam.start <= orderTime)
    .sort((a, b) => b.start - a.start);

  if (candidates.length === 0) return null;

  // Hai công khám cùng bác sĩ, cùng giờ:
  // không tự chọn một công khám khi dữ liệu chưa phân biệt được.
  if (candidates.length > 1 && candidates[0].start === candidates[1].start) {
    return null;
  }

  return candidates[0];
}

export const sameCaseExamClsOverlapRule: RuleValidator = {
  async evaluate(context, rule) {
    const base = {
      ruleId: rule.id,
      ruleCode: rule.code,
      severity: "ERROR" as const,
    };

    const xml1Root = object(context.xml1);
    const xml1 = object(xml1Root.TONG_HOP ?? xml1Root);
    const kcbType = text(xml1.MA_LOAI_KCB).padStart(2, "0");

    if (!["01", "02"].includes(kcbType)) {
      return {
        ...base,
        status: "SKIP",
        issueCount: 0,
        message: "Chỉ kiểm tra hồ sơ khám và điều trị ngoại trú.",
        details: { violations: [] },
      };
    }

    const rows = getRows(context.xml3);

    const examRows = rows.map((row, index) => ({ row, index })).filter(({ row }) => isExam(row));

    const configuredGroups = rule.config?.clsGroups;
    const clsGroups = new Set(
      (Array.isArray(configuredGroups) ? configuredGroups : [1, 2, 3]).map(Number),
    );

    const services = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !isExam(row) && clsGroups.has(Number(row.MA_NHOM)));

    const configuredMinutes = Number(rule.config?.examWindowMinutes ?? 5);

    const examMinutes =
      Number.isFinite(configuredMinutes) && configuredMinutes > 0 ? configuredMinutes : 5;

    const violations: Row[] = [];

    let invalidExamCount = 0;
    let invalidServiceCount = 0;
    let skippedOtherExamLabPairCount = 0;

    const unresolvedLabIndexes = new Set<number>();
    const exams: Exam[] = [];

    for (const { row, index } of examRows) {
      const start = parseTime(row.NGAY_TH_YL) ?? parseTime(row.NGAY_YL);

      if (start === null) {
        invalidExamCount++;
        continue;
      }

      exams.push({
        row,
        index,
        start,
        doctor: text(row.MA_BAC_SI),
      });
    }

    // Tính trước công khám chỉ định cho từng dịch vụ.
    const mappedServices = services.map(({ row, index }) => ({
      row,
      index,
      orderingExam: findOrderingExam(row, exams),
    }));

    const intervals = mappedServices.flatMap((service) => {
      const start = parseTime(service.row.NGAY_TH_YL);
      const end = parseTime(service.row.NGAY_KQ);

      if (start === null || end === null || end <= start) {
        invalidServiceCount++;
        return [];
      }

      return [{ ...service, start, end }];
    });

    for (const exam of exams) {
      const hasCls = mappedServices.some((service) => service.orderingExam?.index === exam.index);

      // Giữ logic hiện tại:
      // Có CLS do công khám này chỉ định: mốc bắt đầu.
      // Không có CLS: khoảng khám mặc định 5 phút.
      const examEnd = hasCls ? exam.start : exam.start + examMinutes * 60_000;

      for (const service of intervals) {
        const overlaps =
          examEnd === exam.start
            ? service.start <= exam.start && exam.start < service.end
            : exam.start < service.end && service.start < examEnd;

        if (!overlaps) continue;

        if (isLab(service.row) && examRows.length > 1) {
          if (service.orderingExam === null) {
            // Chưa xác định được xét nghiệm thuộc công khám nào.
            // Không quy lỗi cho công khám đang xét.
            unresolvedLabIndexes.add(service.index);
            continue;
          }

          if (service.orderingExam.index !== exam.index) {
            // Xét nghiệm thuộc công khám khác.
            // Ví dụ: xét nghiệm công khám 1 thực hiện trong
            // khoảng khám Tai Mũi Họng của công khám 2.
            skippedOtherExamLabPairCount++;
            continue;
          }
        }

        const examName = text(exam.row.TEN_DICH_VU) || "Công khám";

        const serviceName = text(service.row.TEN_DICH_VU) || "Dịch vụ CLS";

        const examTime =
          examEnd === exam.start
            ? formatTime(exam.start)
            : `${formatTime(exam.start)} → ${formatTime(examEnd)}`;

        violations.push({
          sourceEventId: `xml3-${exam.index}`,
          conflictEventId: `xml3-${service.index}`,
          sourceCaseId: context.medicalCase.id,
          conflictCaseId: context.medicalCase.id,
          sourceItemName: examName,
          conflictItemName: serviceName,
          doctorCode: exam.doctor,
          performerCode: text(service.row.NGUOI_THUC_HIEN),
          orderingExamEventId:
            service.orderingExam === null ? null : `xml3-${service.orderingExam.index}`,
          sourceStart: formatTime(exam.start),
          sourceEnd: formatTime(examEnd),
          conflictStart: formatTime(service.start),
          conflictEnd: formatTime(service.end),
          displayMessage:
            `${examName}: ${examTime} trùng thời gian ` +
            `${serviceName}: ${formatTime(service.start)} → ` +
            `${formatTime(service.end)}.`,
        });
      }
    }

    const unresolvedLabCount = unresolvedLabIndexes.size;

    const details = {
      violations,
      invalidExamCount,
      invalidServiceCount,
      checkedExamCount: exams.length,
      validServiceCount: intervals.length,
      skippedOtherExamLabPairCount,
      unresolvedLabCount,
    };

    if (violations.length > 0) {
      return {
        ...base,
        status: "FAIL",
        issueCount: violations.length,
        message:
          `Phát hiện ${violations.length} cặp khám và CLS ` + "trùng thời gian trong cùng hồ sơ.",
        details,
      };
    }

    const incomplete =
      invalidExamCount > 0 ||
      invalidServiceCount > 0 ||
      unresolvedLabCount > 0 ||
      exams.length === 0 ||
      intervals.length === 0;

    return {
      ...base,
      status: incomplete ? "SKIP" : "PASS",
      issueCount: 0,
      message: incomplete
        ? "Chưa đủ dữ liệu thời gian hoặc công khám chỉ định xét nghiệm để kết luận toàn bộ hồ sơ."
        : "Không phát hiện khám và CLS trùng thời gian trong cùng hồ sơ.",
      details,
    };
  },
};
