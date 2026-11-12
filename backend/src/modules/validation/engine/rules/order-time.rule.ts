import type {
  RuleValidator,
} from "../rule.types.js";

import {
  formatDateTime,
  getEventTimes,
} from "../date-utils.js";


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


function ordersBeforeExam(xml3: unknown): Row[] {
  const rows = getRows(xml3);
  const doctor = (row: Row) => text(row.MA_BAC_SI).toUpperCase();
  const day = (time: number) => Math.floor(time / 86_400_000);
  const exams = rows.filter(isExam).map(row => ({row, time: parseTime(row.NGAY_YL)}));
  const violations: Row[] = [];
  rows.forEach((row, index) => {
    if (isExam(row) || !doctor(row)) return;
    const order = parseTime(row.NGAY_YL);
    if (order === null) return;
    // Use the earliest exam of the ordering doctor on the same day;
    // a later follow-up exam must not invalidate an earlier valid order.
    const candidates = exams.filter(exam => exam.time !== null &&
      doctor(exam.row) === doctor(row) && day(exam.time) === day(order));
    candidates.sort((a, b) => a.time! - b.time!);
    const exam = candidates[0];
    if (!exam || exam.time === null || order >= exam.time) return;
    const itemName = text(row.TEN_DICH_VU) || "Dịch vụ";
    const orderTime = formatTime(order);
    const examTime = formatTime(exam.time);
    violations.push({
      type: "ORDER_BEFORE_EXAM", eventId: `xml3-${index}`,
      sourceType: "XML3", itemCode: row.MA_DICH_VU, itemName,
      doctorCode: doctor(row), orderTime, examTime,
      examName: exam.row.TEN_DICH_VU, examTimeField: "NGAY_YL",
      displayMessage: `${itemName}: thời gian y lệnh ${orderTime} < thời gian y lệnh công khám ${examTime} - Mã bác sĩ: ${doctor(row)}.`,
    });
  });
  return violations;
}

export const orderTimeRule:
  RuleValidator = {

  async evaluate(
    context,
    rule
  ) {
    const examOrderViolations = ordersBeforeExam(context.xml3);
    const violations: any[] = [...examOrderViolations];

    let checkedEvents = 0;


    for (
      const event
      of context.events
    ) {
      const {
        orderTime,
        performTime,
        resultTime,
      } =
        getEventTimes(event);


      // Không có đủ dữ liệu để
      // kiểm tra trình tự thời gian.
      const availableTimes =
        [
          orderTime,
          performTime,
          resultTime,
        ].filter(Boolean);


      if (
        availableTimes.length < 2
      ) {
        continue;
      }


      checkedEvents++;


      // =================================
      // Y lệnh > thực hiện
      // =================================

      if (
        orderTime &&
        performTime &&
        performTime.getTime() <
        orderTime.getTime()
      ) {
        violations.push({
          type:
            "PERFORM_BEFORE_ORDER",

          eventId:
            event.id,

          sourceType:
            event.source_type,

          itemCode:
            event.item_code,

          itemName:
            event.item_name,

          doctorCode:
            event.doctor_code,

          orderTime:
            formatDateTime(
              orderTime
            ),

          performTime:
            formatDateTime(
              performTime
            ),
        });
      }


      // =================================
      // Thực hiện > kết quả
      // nghĩa là kết quả có trước
      // =================================

      if (
        performTime &&
        resultTime &&
        resultTime.getTime() <
        performTime.getTime()
      ) {
        violations.push({
          type:
            "RESULT_BEFORE_PERFORM",

          eventId:
            event.id,

          sourceType:
            event.source_type,

          itemCode:
            event.item_code,

          itemName:
            event.item_name,

          performerCode:
            event.performer_code,

          performTime:
            formatDateTime(
              performTime
            ),

          resultTime:
            formatDateTime(
              resultTime
            ),
        });
      }


      // =================================
      // Có y lệnh + kết quả nhưng
      // không có giờ thực hiện
      // =================================

      if (
        orderTime &&
        !performTime &&
        resultTime &&
        resultTime.getTime() <
        orderTime.getTime()
      ) {
        violations.push({
          type:
            "RESULT_BEFORE_ORDER",

          eventId:
            event.id,

          itemCode:
            event.item_code,

          itemName:
            event.item_name,

          orderTime:
            formatDateTime(
              orderTime
            ),

          resultTime:
            formatDateTime(
              resultTime
            ),
        });
      }
    }


    if (violations.length > 0) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,

        status: "FAIL",
        issueCount: violations.length,
        severity: examOrderViolations.length > 0 ? "ERROR" : rule.severity,

        message:
          `Có ${violations.length} lỗi thời gian y lệnh/công khám/thực hiện/kết quả.`,

        details: {
          violations,
        },
      };
    }


    if (checkedEvents === 0) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,

        status: "SKIP",
        severity: rule.severity,

        message:
          "Không có đủ dữ liệu thời gian để kiểm tra logic y lệnh/thực hiện/kết quả.",

        details: {},
      };
    }


    return {
      ruleId: rule.id,
      ruleCode: rule.code,

      status: "PASS",
      severity: rule.severity,

      message:
        `Đã kiểm tra ${checkedEvents} hoạt động, logic thời gian hợp lệ.`,

      details: {
        checkedEvents,
      },
    };
  },
};