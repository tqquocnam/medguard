import type {
  RuleValidator,
} from "../rule.types.js";

import {
  formatDateTime,
  getEventTimes,
} from "../date-utils.js";


export const orderTimeRule:
  RuleValidator = {

  async evaluate(
    context,
    rule
  ) {
    const violations: any[] = [];

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
        severity: rule.severity,

        message:
          `Có ${violations.length} hoạt động sai logic thời gian y lệnh/thực hiện/kết quả.`,

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