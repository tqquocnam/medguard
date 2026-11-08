import type { RuleValidator } from "../rule.types.js";

import { formatDateTime, parseDate } from "../date-utils.js";

// ======================================================
// NHẬN DIỆN CÔNG KHÁM
// ======================================================

function isExam(event: any): boolean {
  const type = String(event.event_type ?? "")
    .trim()
    .toUpperCase();

  const name = String(event.item_name ?? "")
    .trim()
    .toLowerCase();

  return type === "EXAM" || name.startsWith("khám") || name.startsWith("kham");
}

// ======================================================
// NHẬN DIỆN CLS / XÉT NGHIỆM / DVKT
// ======================================================

function isClinicalService(event: any): boolean {
  if (isExam(event)) {
    return false;
  }

  const type = String(event.event_type ?? "")
    .trim()
    .toUpperCase();

  const sourceType = String(event.source_type ?? "")
    .trim()
    .toUpperCase();

  return (
    type === "SERVICE" ||
    type === "LAB" ||
    type === "CLS" ||
    type === "DVKT" ||
    (sourceType === "XML3" && type !== "EXAM")
  );
}

// ======================================================
// KHOẢNG CÁCH GIỜ Y LỆNH HAI CÔNG KHÁM
//
// Trong cùng hồ sơ:
// - Đúng 2 công khám.
// - So sánh XML3.NGAY_YL.
// - Không phụ thuộc cùng hay khác bác sĩ.
// - Khoảng cách <= 5 phút: ERROR.
// - Khoảng cách > 5 phút: đạt.
// ======================================================

function examOrderGapViolation(xml3: any): Record<string, unknown> | null {
  const first = (value: any): any => (Array.isArray(value) ? value[0] : value);

  const root = first(xml3);

  const container = first(root?.CHITIEU_CHITIET_DVKT_VTYT ?? root);

  const list = first(container?.DSACH_CHI_TIET_DVKT);
  const rawRows = list?.CHI_TIET_DVKT;

  const rows = Array.isArray(rawRows) ? rawRows : rawRows ? [rawRows] : [];

  const exams = rows.filter((row: any) => {
    const group = String(row.MA_NHOM ?? "").trim();

    // Ưu tiên mã nhóm công khám.
    if (group) {
      return /^\d+$/.test(group) && Number(group) === 13;
    }

    // Chỉ nhận diện theo tên khi thiếu MA_NHOM.
    return isExam({
      item_name: row.TEN_DICH_VU,
    });
  });

  if (exams.length !== 2) {
    return null;
  }

  const times = exams.map((row: any) => {
    const raw = String(row.NGAY_YL ?? "").trim();

    // Chỉ nhận ngày giờ XML đủ phút hoặc đủ giây.
    if (!/^\d{12}(\d{2})?$/.test(raw)) {
      return null;
    }

    const full = raw.length === 12 ? `${raw}00` : raw;

    const parts = [
      full.slice(0, 4),
      full.slice(4, 6),
      full.slice(6, 8),
      full.slice(8, 10),
      full.slice(10, 12),
      full.slice(12, 14),
    ].map(Number);

    const [year, month, day, hour, minute, second] = parts;

    // Dùng UTC để tính chênh lệch từ các thành phần giờ XML.
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

    // Không để ngày sai tự chuyển sang ngày khác.
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

    const display =
      `${full.slice(6, 8)}/${full.slice(4, 6)}/` +
      `${full.slice(0, 4)} ` +
      `${full.slice(8, 10)}:${full.slice(10, 12)}:` +
      `${full.slice(12, 14)}`;

    return {
      row,
      timestamp: date.getTime(),
      display,
    };
  });

  const a = times[0];
  const b = times[1];

  if (!a || !b) {
    return null;
  }

  const [earlier, later] = a.timestamp <= b.timestamp ? [a, b] : [b, a];

  const gapSeconds = (later.timestamp - earlier.timestamp) / 1000;

  const gapMinutes = gapSeconds / 60;

  // Chỉ đạt khi TRÊN 5 phút.
  if (gapMinutes > 5) {
    return null;
  }

  const displayedMinutes = Number(gapMinutes.toFixed(4));

  const message =
    "Thời gian khám bệnh giữa các lần nhỏ hơn 5 phút: " +
    `${earlier.display} → ${later.display} ` +
    `(${displayedMinutes} phút).`;

  return {
    type: "EXAM_ORDER_GAP_TOO_SHORT",

    itemName: "Khoảng cách hai công khám",

    itemCode: earlier.row.MA_DICH_VU,
    otherItemCode: later.row.MA_DICH_VU,

    examName: earlier.row.TEN_DICH_VU,
    otherExamName: later.row.TEN_DICH_VU,

    doctorCode: earlier.row.MA_BAC_SI,
    otherDoctorCode: later.row.MA_BAC_SI,

    startTime: earlier.display,
    endTime: later.display,

    durationMinutes: displayedMinutes,
    gapSeconds,
    thresholdMinutes: 5,

    displayMessage: message,
  };
}

// ======================================================
// RULE
// ======================================================

export const examMinTimeRule: RuleValidator = {
  async evaluate(context, rule) {
    // Ngưỡng thời lượng từng công khám theo cấu hình cũ.
    const minMinutes = Number(rule.config?.minMinutes ?? 5);

    // Kiểm tra mới: khoảng cách hai giờ y lệnh.
    const gapViolation = examOrderGapViolation(context.xml3);

    const events = context.events ?? [];

    const hasClinicalService = events.some(isClinicalService);

    const examEvents = events
      .filter(isExam)
      .map((event: any) => ({
        event,
        start: parseDate(event.start_time),
        end: parseDate(event.end_time),
      }))
      .filter((item) => item.start !== null);

    if (examEvents.length === 0 && !gapViolation) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,
        status: "PASS",
        severity: rule.severity,
        issueCount: 0,
        message: "Hồ sơ không có công khám cần kiểm tra.",
        details: {
          minMinutes,
          examCount: 0,
          hasClinicalService,
        },
      };
    }

    const violations: Record<string, unknown>[] = [];

    const skippedExams: Record<string, unknown>[] = [];

    if (gapViolation) {
      violations.push(gapViolation);
    }

    // ==================================================
    // KIỂM TRA THỜI LƯỢNG TỪNG CÔNG KHÁM
    // ==================================================

    for (const item of examEvents) {
      const { event, start, end } = item;

      if (!start) {
        continue;
      }

      const hasRealEnd = end !== null && end.getTime() > start.getTime();

      // Có giờ kết thúc thật: tính thời lượng thực tế.
      if (hasRealEnd && end) {
        const duration = (end.getTime() - start.getTime()) / 60000;

        if (duration < minMinutes) {
          const roundedDuration = Math.round(duration * 100) / 100;

          violations.push({
            type: "EXAM_DURATION_TOO_SHORT",

            eventId: event.id,
            itemCode: event.item_code,
            itemName: event.item_name ?? "Công khám",
            doctorCode: event.doctor_code,

            startTime: formatDateTime(start),
            endTime: formatDateTime(end),

            durationMinutes: roundedDuration,
            minMinutes,
            synthetic: false,

            displayMessage:
              `${event.item_name ?? "Công khám"}: ` +
              `${roundedDuration} phút` +
              " - thời gian khám không đủ",
          });
        }

        continue;
      }

      // Hồ sơ chỉ có công khám, không có giờ kết thúc thật:
      // giữ cách xử lý thời lượng mặc định của rule cũ.
      // Kiểm tra khoảng cách hai NGAY_YL đã chạy riêng ở trên.
      if (!hasClinicalService) {
        const syntheticEnd = new Date(start.getTime() + minMinutes * 60000);

        skippedExams.push({
          type: "EXAM_SYNTHETIC_DURATION",

          eventId: event.id,
          itemCode: event.item_code,
          itemName: event.item_name ?? "Công khám",
          doctorCode: event.doctor_code,

          startTime: formatDateTime(start),
          endTime: formatDateTime(syntheticEnd),

          durationMinutes: minMinutes,

          reason: "Hồ sơ chỉ có công khám nên áp dụng thời gian khám mặc định.",

          synthetic: true,
        });

        continue;
      }

      // Có CLS/DVKT nhưng thiếu giờ kết thúc thật:
      // không suy diễn thành công khám có thời lượng 0 phút.
      skippedExams.push({
        type: "EXAM_DURATION_NOT_AVAILABLE",

        eventId: event.id,
        itemCode: event.item_code,
        itemName: event.item_name ?? "Công khám",
        doctorCode: event.doctor_code,

        startTime: formatDateTime(start),
        endTime: null,

        reason: "Hồ sơ có CLS/DVKT nhưng không có thời gian kết thúc công khám hợp lệ.",

        synthetic: false,
      });
    }

    if (violations.length > 0) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,

        status: "FAIL",

        // Lỗi khoảng cách hai công khám luôn là ERROR.
        severity: gapViolation ? "ERROR" : rule.severity,

        issueCount: violations.length,

        message: `Phát hiện ${violations.length} lỗi thời gian công khám.`,

        details: {
          minMinutes,
          examCount: examEvents.length,
          hasClinicalService,

          violationCount: violations.length,
          skippedCount: skippedExams.length,

          violations,
          skippedExams,
        },
      };
    }

    return {
      ruleId: rule.id,
      ruleCode: rule.code,

      status: "PASS",
      severity: rule.severity,
      issueCount: 0,

      message: "Không phát hiện lỗi thời gian công khám.",

      details: {
        minMinutes,
        examCount: examEvents.length,
        hasClinicalService,

        violationCount: 0,
        skippedCount: skippedExams.length,

        skippedExams,
      },
    };
  },
};
