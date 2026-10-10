import type {
  RuleValidator,
} from "../rule.types.js";


// ======================================================
// HELPER
// ======================================================

function text(
  value: unknown
): string {

  return String(
    value ??
    ""
  ).trim();
}


// ======================================================
// SERVICE MACHINE REQUIRED
// ======================================================
//
// catalog.services.requires_machine = true
//
// nhưng XML3 không có MA_MAY
//
// => FAIL
//
// Rule này KHÔNG kiểm tra:
// - mã máy có tồn tại hay không
// - máy có đúng với DVKT hay không
//
// Hai việc đó do rule khác xử lý.
//
// ======================================================

export const serviceMachineRequiredRule:
  RuleValidator = {

  async evaluate(
    context,
    rule,
    runtime
  ) {

    const client =
      runtime.client;


    // ==================================================
    // 1. LẤY EVENT XML3 / SERVICE
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

        machineCode:
          string;
      }> = [];


    for (
      const event
      of context.events ??
      []
    ) {

      const rawData =
        event?.raw_data ??
        {};


      const serviceCode =
        text(
          event?.item_code
        ) ||
        text(
          rawData?.MA_DICH_VU
        );


      if (
        !serviceCode
      ) {

        continue;
      }


      // Chỉ quan tâm XML3 / DVKT
      const sourceType =
        text(
          event?.source_type
        );


      if (
        sourceType &&
        sourceType !==
          "XML3"
      ) {

        continue;
      }


      serviceEvents.push({

        eventId:
          event?.id
            ? String(
                event.id
              )
            : null,

        serviceCode,

        serviceName:
          text(
            event?.item_name
          ) ||
          text(
            rawData?.TEN_DICH_VU
          ) ||
          null,

        machineCode:
          text(
            rawData?.MA_MAY
          ),
      });
    }


    // ==================================================
    // 2. KHÔNG CÓ DVKT
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
          "Hồ sơ không có DVKT để kiểm tra mã máy bắt buộc.",

        issueCount:
          0,

        details: {
          violations:
            [],
        },
      };
    }


    // ==================================================
    // 3. LẤY DANH SÁCH MÃ DVKT
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
    // 4. ĐỌC CẤU HÌNH DVKT
    // ==================================================

    const serviceResult =
      await client.query(
        `
        SELECT
          code,
          name,
          requires_machine,
          active

        FROM
          catalog.services

        WHERE
          code =
          ANY(
            $1::varchar[]
          )

          AND active =
          true
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

          requiresMachine:
            boolean;
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

          requiresMachine:
            Boolean(
              row.requires_machine
            ),
        }
      );
    }


    // ==================================================
    // 5. CHECK
    // ==================================================

    const violations:
      Array<{
        type:
          "SERVICE_MACHINE_REQUIRED";

        eventId:
          string |
          null;

        serviceCode:
          string;

        serviceName:
          string;

        machineCode:
          string |
          null;

        message:
          string;
      }> = [];


    for (
      const event
      of serviceEvents
    ) {

      const service =
        serviceMap.get(
          event.serviceCode
        );


      // DVKT chưa được cấu hình trong catalog.services
      // thì rule này không xử lý.
      if (
        !service
      ) {

        continue;
      }


      // DVKT không bắt buộc máy
      if (
        !service.requiresMachine
      ) {

        continue;
      }


      // Có MA_MAY => hợp lệ với rule này
      if (
        event.machineCode
      ) {

        continue;
      }


      violations.push({

        type:
          "SERVICE_MACHINE_REQUIRED",

        eventId:
          event.eventId,

        serviceCode:
          service.code,

        serviceName:
          service.name,

        machineCode:
          null,

        message:
          `DVKT "${service.name}" (${service.code}) yêu cầu mã máy nhưng XML không có MA_MAY.`,
      });
    }


    // ==================================================
    // 6. FAIL
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
          `Phát hiện ${violations.length} DVKT thiếu mã máy bắt buộc.`,

        issueCount:
          violations.length,

        details: {
          violations,
        },
      };
    }


    // ==================================================
    // 7. PASS
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
        "Các DVKT yêu cầu máy đều có MA_MAY.",

      issueCount:
        0,

      details: {
        violations:
          [],
      },
    };
  },
};