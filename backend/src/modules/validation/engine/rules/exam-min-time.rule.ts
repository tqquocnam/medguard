import type {
  RuleValidator,
} from "../rule.types.js";

import {
  formatDateTime,
  parseDate,
} from "../date-utils.js";


// ======================================================
// NHẬN DIỆN CÔNG KHÁM
// ======================================================

function isExam(
  event: any
): boolean {
  const type =
    String(
      event.event_type ??
      ""
    )
      .trim()
      .toUpperCase();


  const name =
    String(
      event.item_name ??
      ""
    )
      .trim()
      .toLowerCase();


  return (
    type === "EXAM" ||
    name.startsWith(
      "khám"
    ) ||
    name.startsWith(
      "kham"
    )
  );
}


// ======================================================
// NHẬN DIỆN CLS / XÉT NGHIỆM / DVKT
//
// Công khám KHÔNG tính là CLS.
// ======================================================

function isClinicalService(
  event: any
): boolean {

  if (
    isExam(
      event
    )
  ) {
    return false;
  }


  const type =
    String(
      event.event_type ??
      ""
    )
      .trim()
      .toUpperCase();


  const sourceType =
    String(
      event.source_type ??
      ""
    )
      .trim()
      .toUpperCase();


  return (
    type === "SERVICE" ||
    type === "LAB" ||
    type === "CLS" ||
    type === "DVKT" ||

    (
      sourceType === "XML3" &&
      type !== "EXAM"
    )
  );
}


// ======================================================
// RULE
// ======================================================

export const examMinTimeRule:
  RuleValidator = {

  async evaluate(
    context,
    rule
  ) {

    // ==================================================
    // THỜI GIAN KHÁM TỐI THIỂU
    // ==================================================

    const minMinutes =
      Number(
        rule.config
          ?.minMinutes ??
        5
      );


    const events =
      context.events ??
      [];


    // ==================================================
    // HỒ SƠ CÓ CLS / XN / DVKT KHÔNG?
    // ==================================================

    const hasClinicalService =
      events.some(
        isClinicalService
      );


    // ==================================================
    // LẤY CÔNG KHÁM
    // ==================================================

    const examEvents =
      events
        .filter(
          isExam
        )
        .map(
          (event: any) => {

            const start =
              parseDate(
                event.start_time
              );


            const end =
              parseDate(
                event.end_time
              );


            return {
              event,
              start,
              end,
            };
          }
        )
        .filter(
          (item) =>
            item.start !== null
        );


    // ==================================================
    // KHÔNG CÓ CÔNG KHÁM
    // ==================================================

    if (
      examEvents.length ===
      0
    ) {

      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "PASS",

        severity:
          rule.severity,

        issueCount:
          0,

        message:
          "Hồ sơ không có công khám cần kiểm tra.",

        details: {
          minMinutes,

          examCount:
            0,

          hasClinicalService,
        },
      };
    }


    const violations:
      Record<
        string,
        unknown
      >[] = [];


    const skippedExams:
      Record<
        string,
        unknown
      >[] = [];


    // ==================================================
    // KIỂM TRA TỪNG CÔNG KHÁM
    // ==================================================

    for (
      const item
      of examEvents
    ) {

      const {
        event,
        start,
        end,
      } = item;


      if (!start) {
        continue;
      }


      // =================================================
      // CÓ END_TIME THẬT
      //
      // end > start
      //
      // => tính thời lượng thực tế.
      // =================================================

      const hasRealEnd =
        end !== null &&
        end.getTime() >
          start.getTime();


      if (
        hasRealEnd &&
        end
      ) {

        const duration =
          (
            end.getTime() -
            start.getTime()
          ) /
          60000;


        // ===============================================
        // DƯỚI THỜI GIAN TỐI THIỂU
        // ===============================================

        if (
          duration <
          minMinutes
        ) {

          const roundedDuration =
            Math.round(
              duration *
              100
            ) /
            100;


          violations.push({
            type:
              "EXAM_DURATION_TOO_SHORT",

            eventId:
              event.id,

            itemCode:
              event.item_code,

            itemName:
              event.item_name ??
              "Công khám",

            doctorCode:
              event.doctor_code,

            startTime:
              formatDateTime(
                start
              ),

            endTime:
              formatDateTime(
                end
              ),

            durationMinutes:
              roundedDuration,

            minMinutes,

            synthetic:
              false,

            displayMessage:
              `${
                event.item_name ??
                "Công khám"
              }: ` +
              `${roundedDuration} phút` +
              ` - thời gian khám không đủ`,
          });
        }


        continue;
      }


      // =================================================
      // KHÔNG CÓ END_TIME THẬT
      //
      // Có hai trường hợp.
      // =================================================


      // =================================================
      // TRƯỜNG HỢP 1:
      //
      // HỒ SƠ CHỈ CÓ CÔNG KHÁM
      //
      // VD:
      // 07:24
      //
      // => quy ước:
      // 07:24 -> 07:29
      //
      // => đủ 5 phút
      // => KHÔNG BÁO LỖI.
      // =================================================

      if (
        !hasClinicalService
      ) {

        const syntheticEnd =
          new Date(
            start.getTime() +
            minMinutes *
              60 *
              1000
          );


        skippedExams.push({
          type:
            "EXAM_SYNTHETIC_DURATION",

          eventId:
            event.id,

          itemCode:
            event.item_code,

          itemName:
            event.item_name ??
            "Công khám",

          doctorCode:
            event.doctor_code,

          startTime:
            formatDateTime(
              start
            ),

          endTime:
            formatDateTime(
              syntheticEnd
            ),

          durationMinutes:
            minMinutes,

          reason:
            "Hồ sơ chỉ có công khám nên áp dụng thời gian khám mặc định.",

          synthetic:
            true,
        });


        continue;
      }


      // =================================================
      // TRƯỜNG HỢP 2:
      //
      // HỒ SƠ CÓ CLS / XN / DVKT
      //
      // Nhưng công khám không có end_time thật.
      //
      // KHÔNG ĐƯỢC:
      //
      // start = end
      // => duration = 0
      // => báo lỗi
      //
      // Vì không đủ dữ liệu để khẳng định khám 0 phút.
      //
      // Rule trùng giờ sẽ xử lý công khám này như POINT.
      // =================================================

      skippedExams.push({
        type:
          "EXAM_DURATION_NOT_AVAILABLE",

        eventId:
          event.id,

        itemCode:
          event.item_code,

        itemName:
          event.item_name ??
          "Công khám",

        doctorCode:
          event.doctor_code,

        startTime:
          formatDateTime(
            start
          ),

        endTime:
          null,

        reason:
          "Hồ sơ có CLS/DVKT nhưng không có thời gian kết thúc công khám hợp lệ.",

        synthetic:
          false,
      });
    }


    // ==================================================
    // CÓ LỖI THẬT
    // ==================================================

    if (
      violations.length >
      0
    ) {

      return {
        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "FAIL",

        severity:
          rule.severity,

        issueCount:
          violations.length,

        message:
          `Phát hiện ${violations.length} công khám dưới ${minMinutes} phút.`,

        details: {
          minMinutes,

          examCount:
            examEvents.length,

          hasClinicalService,

          violationCount:
            violations.length,

          skippedCount:
            skippedExams.length,

          violations,

          skippedExams,
        },
      };
    }


    // ==================================================
    // PASS
    // ==================================================

    return {
      ruleId:
        rule.id,

      ruleCode:
        rule.code,

      status:
        "PASS",

      severity:
        rule.severity,

      issueCount:
        0,

      message:
        `Không phát hiện công khám dưới ${minMinutes} phút.`,

      details: {
        minMinutes,

        examCount:
          examEvents.length,

        hasClinicalService,

        violationCount:
          0,

        skippedCount:
          skippedExams.length,

        skippedExams,
      },
    };
  },
};