import type {
  RuleValidator,
} from "../rule.types.js";

type Row = Record<string, unknown>;

function first(value: unknown): Row {
  if (Array.isArray(value)) {
    return first(value[0]);
  }

  return value !== null && typeof value === "object"
    ? (value as Row)
    : {};
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function rows(value: unknown): Row[] {
  if (Array.isArray(value)) {
    return value
      .filter(
        (item) =>
          item !== null &&
          typeof item === "object" &&
          !Array.isArray(item)
      )
      .map(first);
  }

  if (value !== null && typeof value === "object") {
    return [first(value)];
  }

  return [];
}

// Chỉ nhận thời điểm XML có đủ ngày, giờ, phút.
// Kiểm tra lịch hợp lệ để tránh ngày sai bị tự chuyển sang ngày khác.
function normalizeTime(value: unknown): string | null {
  const raw = text(value);

  if (!/^\d{12}(\d{2})?$/.test(raw)) {
    return null;
  }

  const normalized = raw.length === 12 ? `${raw}00` : raw;

  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(4, 6));
  const day = Number(normalized.slice(6, 8));
  const hour = Number(normalized.slice(8, 10));
  const minute = Number(normalized.slice(10, 12));
  const second = Number(normalized.slice(12, 14));

  if (year < 1900 || year > 9999) return null;

  const date = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    return null;
  }

  return normalized;
}

function displayTime(value: string): string {
  return (
    `${value.slice(6, 8)}/${value.slice(4, 6)}/` +
    `${value.slice(0, 4)} ` +
    `${value.slice(8, 10)}:${value.slice(10, 12)}` +
    `:${value.slice(12, 14)}`
  );
}

function getXml3Rows(value: unknown): Row[] {
  const root = first(value);

  const container = first(
    root.CHITIEU_CHITIET_DVKT_VTYT ?? root
  );

  const list = first(container.DSACH_CHI_TIET_DVKT);

  return rows(list.CHI_TIET_DVKT);
}

function isExam(row: Row): boolean {
  // Ưu tiên mã nhóm công khám.
  const group = text(row.MA_NHOM);

  if (group) {
    return /^\d+$/.test(group) && Number(group) === 13;
  }

  // Chỉ nhận diện theo tên khi XML thiếu MA_NHOM.
  const name = text(row.TEN_DICH_VU)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return /^kham(?:\s|$)/.test(name);
}

// Compare only the exact ordering doctor and calendar day. Never use a
// different doctor's exam or a later repeat exam when an earlier exam exists.
export const serviceOrderBeforeExamRule: RuleValidator = {
  async evaluate(context, rule) {
    const base = { ruleId: rule.id, ruleCode: rule.code, severity: "ERROR" as const };
    const root = first(context.xml1);
    const kcb = text(first(root.TONG_HOP ?? root).MA_LOAI_KCB).padStart(2, "0");
    if (!["01", "02"].includes(kcb)) {
      return { ...base, status: "SKIP", issueCount: 0,
        message: "Chỉ kiểm tra hồ sơ khám và điều trị ngoại trú.", details: { violations: [] } };
    }
    const indexed = getXml3Rows(context.xml3).map((row, index) => ({ row, index }));
    const exams = indexed.filter(({ row }) => isExam(row)).map(({ row, index }) => ({
      row, index, doctor: text(row.MA_BAC_SI),
      time: normalizeTime(row.NGAY_TH_YL) ?? normalizeTime(row.NGAY_YL),
    }));
    const violations: Row[] = [];
    let checkedServices = 0;
    let unresolvedServices = 0;
    for (const { row, index } of indexed.filter(({ row }) => !isExam(row))) {
      const doctor = text(row.MA_BAC_SI);
      const order = normalizeTime(row.NGAY_YL);
      if (!doctor || !order) { unresolvedServices++; continue; }
      const matching = exams.filter(exam => exam.doctor === doctor);
      // Missing exam timestamps must not cause a false accusation.
      if (matching.some(exam => !exam.time)) { unresolvedServices++; continue; }
      const sameDay = matching.filter(exam => exam.time!.slice(0, 8) === order.slice(0, 8))
        .sort((a, b) => a.time!.localeCompare(b.time!));
      if (!sameDay.length) { unresolvedServices++; continue; }
      checkedServices++;
      const exam = sameDay[0];
      if (order >= exam.time!) continue;
      const serviceName = text(row.TEN_DICH_VU) || "Dịch vụ kỹ thuật";
      violations.push({
        type: "SERVICE_ORDER_BEFORE_EXAM",
        sourceEventId: `xml3-${index}`, conflictEventId: `xml3-${exam.index}`,
        sourceCaseId: context.medicalCase.id, conflictCaseId: context.medicalCase.id,
        itemCode: text(row.MA_DICH_VU), itemName: serviceName,
        doctorCode: doctor, examName: text(exam.row.TEN_DICH_VU),
        orderTime: displayTime(order), examTime: displayTime(exam.time!),
        displayMessage: `${serviceName}: thời gian y lệnh ${displayTime(order)} trước thời gian khám bệnh ${displayTime(exam.time!)} — Mã bác sĩ: ${doctor}.`,
      });
    }
    return {
      ...base,
      status: violations.length ? "FAIL" : unresolvedServices > 0 || !checkedServices ? "SKIP" : "PASS",
      issueCount: violations.length,
      message: violations.length
        ? `Có ${violations.length} dịch vụ có y lệnh trước giờ công khám của bác sĩ chỉ định.`
        : unresolvedServices > 0 || !checkedServices
          ? "Chưa đủ dữ liệu để đối chiếu toàn bộ y lệnh với công khám cùng bác sĩ, cùng ngày."
          : `Đã đối chiếu ${checkedServices} dịch vụ với công khám cùng bác sĩ, cùng ngày.`,
      details: { violations, checkedServices, unresolvedServices },
    };
  },
};
