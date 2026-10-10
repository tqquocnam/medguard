import type {
  RuleValidator,
} from "../rule.types.js";

import {
  formatDateTime,
  getEventTimes,
  parseDate,
} from "../date-utils.js";


export const eventInsideVisitRule:
  RuleValidator = {

  async evaluate(
    context,
    rule
  ) {
    const visitStart =
      parseDate(
        context.medicalCase.ngay_vao
      );

    const visitEnd =
      parseDate(
        context.medicalCase.ngay_ra
      );


    // Rule VISIT_TIME_VALID
    // sẽ xử lý lỗi ngày vào/ra.
    if (
      !visitStart ||
      !visitEnd
    ) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,

        status: "SKIP",
        severity: rule.severity,

        message:
          "Không thể kiểm tra vì hồ sơ chưa có thời gian vào/ra hợp lệ.",

        details: {},
      };
    }


    const violations: any[] = [];

    let checkedTimes = 0;


    const checkTime = (
      event: any,
      type: string,
      date: Date | null
    ) => {
      if (!date) {
        return;
      }

      checkedTimes++;


      if (
        date.getTime() <
          visitStart.getTime() ||

        date.getTime() >
          visitEnd.getTime()
      ) {
        violations.push({
          eventId:
            event.id,

          xml:
            event.source_type,

          eventType:
            event.event_type,

          itemCode:
            event.item_code,

          itemName:
            event.item_name,

          doctorCode:
            event.doctor_code,

          timeType:
            type,

          time:
            formatDateTime(date),
        });
      }
    };


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


      checkTime(
        event,
        "ORDER_TIME",
        orderTime
      );

      checkTime(
        event,
        "PERFORM_TIME",
        performTime
      );

      checkTime(
        event,
        "RESULT_TIME",
        resultTime
      );
    }


    if (violations.length > 0) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,

        status: "FAIL",
        severity: rule.severity,

        message:
          `Có ${violations.length} thời điểm y lệnh/thực hiện/kết quả nằm ngoài thời gian KCB.`,

        details: {
          visitStart:
            formatDateTime(
              visitStart
            ),

          visitEnd:
            formatDateTime(
              visitEnd
            ),

          violations,
        },
      };
    }


    if (checkedTimes === 0) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,

        status: "SKIP",
        severity: rule.severity,

        message:
          "Không có dữ liệu thời gian hoạt động để kiểm tra.",

        details: {},
      };
    }


    return {
      ruleId: rule.id,
      ruleCode: rule.code,

      status: "PASS",
      severity: rule.severity,

      message:
        `Đã kiểm tra ${checkedTimes} thời điểm, tất cả nằm trong thời gian KCB.`,

      details: {
        checkedTimes,
      },
    };
  },
};