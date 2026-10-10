import type {
  RuleValidator,
} from "../rule.types.js";


// ======================================================
// HELPERS
// ======================================================

function normalizeText(
  value: unknown
): string {

  return String(
    value ??
    ""
  ).trim();
}


// ======================================================
// PARSE DATETIME XML BHYT
//
// Hỗ trợ:
//
// 202610040837
// YYYYMMDDHHmm
//
// 20261004083730
// YYYYMMDDHHmmss
//
// ======================================================

function parseBhytDateTime(
  value: unknown
): Date | null {

  const text =
    normalizeText(
      value
    );


  if (!text) {

    return null;
  }


  if (
    !/^\d{12}(\d{2})?$/.test(
      text
    )
  ) {

    return null;
  }


  const year =
    Number(
      text.slice(
        0,
        4
      )
    );


  const month =
    Number(
      text.slice(
        4,
        6
      )
    );


  const day =
    Number(
      text.slice(
        6,
        8
      )
    );


  const hour =
    Number(
      text.slice(
        8,
        10
      )
    );


  const minute =
    Number(
      text.slice(
        10,
        12
      )
    );


  const second =
    text.length >= 14
      ? Number(
          text.slice(
            12,
            14
          )
        )
      : 0;


  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {

    return null;
  }


  const date =
    new Date(
      year,
      month - 1,
      day,
      hour,
      minute,
      second,
      0
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return null;
  }


  return date;
}


// ======================================================
// FORMAT DATETIME
// ======================================================

function formatDateTime(
  date: Date
): string {

  const pad =
    (
      value: number
    ) =>
      String(
        value
      ).padStart(
        2,
        "0"
      );


  return (
    `${pad(
      date.getDate()
    )}/${pad(
      date.getMonth() + 1
    )}/${date.getFullYear()} ` +
    `${pad(
      date.getHours()
    )}:${pad(
      date.getMinutes()
    )}`
  );
}


// ======================================================
// SERVICE DURATION
// ======================================================
//
// NGHIỆP VỤ:
//
// Các DVKT/cận lâm sàng:
//
// - Điện tim
// - Siêu âm
// - X-quang
// - Nội soi
// - Xét nghiệm
// - ...
//
// Không hard-code tên dịch vụ.
//
// DVKT nào được cấu hình:
//
// min_duration_minutes > 0
// hoặc
// max_duration_minutes > 0
//
// thì được kiểm tra:
//
// XML3.NGAY_TH_YL
//          ↓
// XML3.NGAY_KQ
//
// actualMinutes =
// NGAY_KQ - NGAY_TH_YL
//
// actual < min
//      => FAIL
//
// actual > max
//      => FAIL
//
// min <= actual <= max
//      => PASS
//
// ======================================================

export const serviceDurationRule:
  RuleValidator = {

  async evaluate(
    context,
    rule,
    runtime
  ) {

    const client =
      runtime.client;


    // ==================================================
    // 1. LẤY CÁC EVENT XML3
    // ==================================================

    const serviceEvents:
      Array<{
        eventId:
          string |
          null;

        serviceCode:
          string;

        serviceName:
          string |
          null;

        rawStart:
          string;

        rawEnd:
          string;

        startTime:
          Date |
          null;

        endTime:
          Date |
          null;
      }> = [];


    for (
      const event
      of context.events ??
      []
    ) {

      const rawData =
        event?.raw_data ??
        {};


      const sourceType =
        normalizeText(
          event?.source_type
        );


      if (
        sourceType &&
        sourceType !==
          "XML3"
      ) {

        continue;
      }


      const serviceCode =
        normalizeText(
          event?.item_code
        ) ||
        normalizeText(
          rawData?.MA_DICH_VU
        );


      if (
        !serviceCode
      ) {

        continue;
      }


      // ==================================================
      // QUAN TRỌNG
      //
      // Thời gian thực hiện DVKT:
      //
      // NGAY_TH_YL → NGAY_KQ
      //
      // KHÔNG dùng NGAY_YL.
      // ==================================================

      const rawStart =
        normalizeText(
          rawData?.NGAY_TH_YL
        );


      const rawEnd =
        normalizeText(
          rawData?.NGAY_KQ
        );


      serviceEvents.push({

        eventId:
          event?.id
            ? String(
                event.id
              )
            : null,


        serviceCode,


        serviceName:
          normalizeText(
            event?.item_name
          ) ||
          normalizeText(
            rawData?.TEN_DICH_VU
          ) ||
          null,


        rawStart,


        rawEnd,


        startTime:
          parseBhytDateTime(
            rawStart
          ),


        endTime:
          parseBhytDateTime(
            rawEnd
          ),
      });
    }


    // ==================================================
    // 2. KHÔNG CÓ XML3
    // ==================================================

    if (
      serviceEvents.length ===
      0
    ) {

      return {

        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "SKIP",

        severity:
          rule.severity,

        message:
          "Hồ sơ không có DVKT để kiểm tra thời gian thực hiện.",

        issueCount:
          0,

        details: {
          violations:
            [],
        },
      };
    }


    // ==================================================
    // 3. DANH SÁCH MÃ DVKT
    // ==================================================

    const serviceCodes =
      [
        ...new Set(
          serviceEvents.map(
            (
              item
            ) =>
              item.serviceCode
          )
        ),
      ];


    // ==================================================
    // 4. ĐỌC CẤU HÌNH DANH MỤC DVKT
    // ==================================================

    const serviceResult =
      await client.query(
        `
        SELECT
          code,
          name,
          min_duration_minutes,
          max_duration_minutes

        FROM
          catalog.services

        WHERE
          code =
          ANY(
            $1::varchar[]
          )

          AND active =
          true

          AND (
            min_duration_minutes > 0
            OR
            max_duration_minutes > 0
          )
        `,
        [
          serviceCodes,
        ]
      );


    const serviceMap =
      new Map<
        string,
        {
          code:
            string;

          name:
            string;

          minMinutes:
            number;

          maxMinutes:
            number;
        }
      >();


    for (
      const row
      of serviceResult.rows
    ) {

      serviceMap.set(
        String(
          row.code
        ),
        {

          code:
            String(
              row.code
            ),


          name:
            String(
              row.name ??
              row.code
            ),


          minMinutes:
            Number(
              row.min_duration_minutes ??
              0
            ),


          maxMinutes:
            Number(
              row.max_duration_minutes ??
              0
            ),
        }
      );
    }


    // ==================================================
    // 5. KHÔNG CÓ DVKT NÀO ĐƯỢC CẤU HÌNH MIN/MAX
    // ==================================================

    if (
      serviceMap.size ===
      0
    ) {

      return {

        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "SKIP",

        severity:
          rule.severity,

        message:
          "Hồ sơ không có DVKT được cấu hình Min/Max thời gian thực hiện.",

        issueCount:
          0,

        details: {
          violations:
            [],
        },
      };
    }


    // ==================================================
    // 6. VIOLATIONS
    // ==================================================

    const violations:
      Array<{
        type:
          | "SERVICE_DURATION_TOO_SHORT"
          | "SERVICE_DURATION_TOO_LONG";

        eventId:
          string |
          null;

        serviceCode:
          string;

        serviceName:
          string;

        ngayThYl:
          string;

        ngayKq:
          string;

        startTime:
          string;

        endTime:
          string;

        actualMinutes:
          number;

        minMinutes:
          number;

        maxMinutes:
          number;

        message:
          string;
      }> = [];


    let configuredCount =
      0;


    let checkedCount =
      0;


    let missingTimeCount =
      0;


    let invalidSequenceCount =
      0;


    // ==================================================
    // 7. CHECK TỪNG DVKT
    // ==================================================

    for (
      const event
      of serviceEvents
    ) {

      const service =
        serviceMap.get(
          event.serviceCode
        );


      // DVKT không cấu hình Min/Max
      if (
        !service
      ) {

        continue;
      }


      configuredCount++;


      // ==================================================
      // THIẾU NGAY_TH_YL HOẶC NGAY_KQ
      //
      // Chưa báo lỗi SERVICE_DURATION.
      // Có thể làm rule riêng sau.
      // ==================================================

      if (
        !event.startTime ||
        !event.endTime
      ) {

        missingTimeCount++;

        continue;
      }


      const milliseconds =
        event.endTime.getTime() -
        event.startTime.getTime();


      // ==================================================
      // NGAY_KQ < NGAY_TH_YL
      //
      // Đây là lỗi thứ tự thời gian.
      // Không để SERVICE_DURATION báo trùng.
      // ==================================================

      if (
        milliseconds <
        0
      ) {

        invalidSequenceCount++;

        continue;
      }


      checkedCount++;


      const actualMinutes =
        milliseconds /
        60000;


      const displayMinutes =
        Number(
          actualMinutes.toFixed(
            2
          )
        );


      // ==================================================
      // NHỎ HƠN MIN
      // ==================================================

      if (
        service.minMinutes >
          0 &&
        actualMinutes <
          service.minMinutes
      ) {

        violations.push({

          type:
            "SERVICE_DURATION_TOO_SHORT",


          eventId:
            event.eventId,


          serviceCode:
            service.code,


          serviceName:
            service.name,


          ngayThYl:
            event.rawStart,


          ngayKq:
            event.rawEnd,


          startTime:
            formatDateTime(
              event.startTime
            ),


          endTime:
            formatDateTime(
              event.endTime
            ),


          actualMinutes:
            displayMinutes,


          minMinutes:
            service.minMinutes,


          maxMinutes:
            service.maxMinutes,


          message:
            `DVKT "${service.name}" (${service.code}) thực hiện ${displayMinutes} phút, nhỏ hơn thời gian tối thiểu ${service.minMinutes} phút.`,
        });


        continue;
      }


      // ==================================================
      // LỚN HƠN MAX
      // ==================================================

      if (
        service.maxMinutes >
          0 &&
        actualMinutes >
          service.maxMinutes
      ) {

        violations.push({

          type:
            "SERVICE_DURATION_TOO_LONG",


          eventId:
            event.eventId,


          serviceCode:
            service.code,


          serviceName:
            service.name,


          ngayThYl:
            event.rawStart,


          ngayKq:
            event.rawEnd,


          startTime:
            formatDateTime(
              event.startTime
            ),


          endTime:
            formatDateTime(
              event.endTime
            ),


          actualMinutes:
            displayMinutes,


          minMinutes:
            service.minMinutes,


          maxMinutes:
            service.maxMinutes,


          message:
            `DVKT "${service.name}" (${service.code}) thực hiện ${displayMinutes} phút, vượt thời gian tối đa ${service.maxMinutes} phút.`,
        });
      }
    }


    // ==================================================
    // 8. CÓ DVKT CONFIG NHƯNG KHÔNG DÒNG NÀO ĐỦ THỜI GIAN
    // ==================================================

    if (
      configuredCount >
        0 &&
      checkedCount ===
        0
    ) {

      return {

        ruleId:
          rule.id,

        ruleCode:
          rule.code,

        status:
          "SKIP",

        severity:
          rule.severity,

        message:
          "DVKT có cấu hình Min/Max nhưng không đủ NGAY_TH_YL và NGAY_KQ để kiểm tra.",

        issueCount:
          0,

        details: {

          configuredCount,

          checkedCount,

          missingTimeCount,

          invalidSequenceCount,

          violations:
            [],
        },
      };
    }


    // ==================================================
    // 9. FAIL
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

        message:
          `Phát hiện ${violations.length} DVKT có thời gian thực hiện không đúng cấu hình.`,

        issueCount:
          violations.length,

        details: {

          configuredCount,

          checkedCount,

          missingTimeCount,

          invalidSequenceCount,

          violations,
        },
      };
    }


    // ==================================================
    // 10. PASS
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

      message:
        "Thời gian thực hiện DVKT nằm trong giới hạn cấu hình.",

      issueCount:
        0,

      details: {

        configuredCount,

        checkedCount,

        missingTimeCount,

        invalidSequenceCount,

        violations:
          [],
      },
    };
  },
};