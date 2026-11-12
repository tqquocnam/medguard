import type { MedicalCaseContext } from "../rule.types.js";

type Row = Record<string, unknown>;

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

function getRows(xml: unknown): Row[] {
  const root = object(xml);
  const container = object(root.CHITIEU_CHITIET_DVKT_VTYT ?? root);
  const list = object(container.DSACH_CHI_TIET_DVKT);
  const value = list.CHI_TIET_DVKT;

  return (Array.isArray(value) ? value : value ? [value] : [])
    .filter((item) => item !== null && typeof item === "object" && !Array.isArray(item))
    .map(object);
}


// Match this ordering doctor's exams on the same XML calendar day.
// A preceding exam is valid; do not choose a later repeat examination instead.
export function serviceOrderBeforeExamViolations(context: MedicalCaseContext) {
  const rows = getRows(context.xml3);
  const exams = rows.filter(isExam).map((row) => ({
    row,
    doctor: text(row.MA_BAC_SI).toUpperCase(),
    time: parseTime(row.NGAY_YL),
  }));
  const violations: Record<string, unknown>[] = [];

  for (const row of rows) {
    if (isExam(row) || !text(row.MA_DICH_VU)) continue;
    const doctor = text(row.MA_BAC_SI).toUpperCase();
    const time = parseTime(row.NGAY_YL);
    if (!doctor || time === null) continue;
    const candidates = exams.filter((exam) =>
      exam.doctor === doctor && exam.time !== null &&
      Math.floor(exam.time / 86_400_000) === Math.floor(time / 86_400_000),
    );
    if (!candidates.length || candidates.some((exam) => exam.time! <= time)) continue;
    const exam = candidates.reduce((a, b) => a.time! <= b.time! ? a : b);
    const itemName = text(row.TEN_DICH_VU) || text(row.MA_DICH_VU);
    const orderTime = formatTime(time);
    const examTime = formatTime(exam.time!);
    violations.push({
      type: "SERVICE_ORDER_BEFORE_EXAM",
      sourceType: "XML3",
      itemCode: text(row.MA_DICH_VU),
      itemName,
      doctorCode: text(row.MA_BAC_SI),
      examName: text(exam.row.TEN_DICH_VU),
      examCode: text(exam.row.MA_DICH_VU),
      orderTime,
      examTime,
      displayMessage: `${itemName}: thời gian y lệnh ${orderTime} < thời gian khám bệnh ${examTime} - Mã bác sĩ: ${text(row.MA_BAC_SI)}.`,
    });
  }
  return violations;
}
