import type { RuleValidator } from "../rule.types.js";

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

    const exams = rows.map((row, index) => ({ row, index })).filter(({ row }) => isExam(row));

    // Mặc định nhóm 1–3: xét nghiệm, siêu âm, chẩn đoán
    // hình ảnh/thăm dò chức năng. Có thể cấu hình thêm.
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
    let checkedExamCount = 0;

    const intervals = services.flatMap(({ row, index }) => {
      const start = parseTime(row.NGAY_TH_YL);
      const end = parseTime(row.NGAY_KQ);

      if (start === null || end === null || end <= start) {
        invalidServiceCount++;
        return [];
      }

      return [{ row, index, start, end }];
    });

    for (const { row: exam, index: examIndex } of exams) {
      const examStart = parseTime(exam.NGAY_TH_YL) ?? parseTime(exam.NGAY_YL);

      if (examStart === null) {
        invalidExamCount++;
        continue;
      }

      checkedExamCount++;

      const doctor = text(exam.MA_BAC_SI);

      // Theo logic đang có: CLS thuộc lần khám khi cùng bác sĩ,
      // y lệnh từ lúc khám đến trước lần khám tiếp theo của bác sĩ.
      const nextExamStart = exams
        .filter(
          ({ row, index }) =>
            index !== examIndex && doctor !== "" && text(row.MA_BAC_SI) === doctor,
        )
        .map(({ row }) => parseTime(row.NGAY_TH_YL) ?? parseTime(row.NGAY_YL))
        .filter((time): time is number => time !== null && time > examStart)
        .sort((a, b) => a - b)[0];

      const hasCls =
        doctor !== "" &&
        services.some(({ row }) => {
          const order = parseTime(row.NGAY_YL);

          return (
            text(row.MA_BAC_SI) === doctor &&
            order !== null &&
            order >= examStart &&
            (nextExamStart === undefined || order < nextExamStart)
          );
        });

      const examEnd = hasCls ? examStart : examStart + examMinutes * 60_000;

      for (const service of intervals) {
        // Công khám dạng mốc: chỉ bắt khi nằm trong khoảng CLS.
        // Hai khoảng chỉ chạm đầu/cuối không tính chồng thời gian.
        const overlaps =
          examEnd === examStart
            ? service.start <= examStart && examStart < service.end
            : examStart < service.end && service.start < examEnd;

        if (!overlaps) continue;

        const examName = text(exam.TEN_DICH_VU) || "Công khám";
        const serviceName = text(service.row.TEN_DICH_VU) || "Dịch vụ CLS";

        const examTime =
          examEnd === examStart
            ? formatTime(examStart)
            : `${formatTime(examStart)} → ${formatTime(examEnd)}`;

        violations.push({
          sourceEventId: `xml3-${examIndex}`,
          conflictEventId: `xml3-${service.index}`,
          sourceCaseId: context.medicalCase.id,
          conflictCaseId: context.medicalCase.id,
          sourceItemName: examName,
          conflictItemName: serviceName,
          doctorCode: doctor,
          performerCode: text(service.row.NGUOI_THUC_HIEN),
          sourceStart: formatTime(examStart),
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

    const details = {
      violations,
      invalidExamCount,
      invalidServiceCount,
      checkedExamCount,
      validServiceCount: intervals.length,
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
      checkedExamCount === 0 ||
      intervals.length === 0;

    return {
      ...base,
      status: incomplete ? "SKIP" : "PASS",
      issueCount: 0,
      message: incomplete
        ? "Chưa đủ khoảng thời gian hợp lệ để kết luận toàn bộ hồ sơ."
        : "Không phát hiện khám và CLS trùng thời gian trong cùng hồ sơ.",
      details,
    };
  },
};
