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


function splitMachineCodes(
  value: unknown
): string[] {

  const text =
    normalizeText(
      value
    );


  if (!text) {

    return [];
  }


  return [
    ...new Set(
      text
        .split(
          /[;|]+/
        )
        .map(
          (
            item
          ) =>
            item.trim()
        )
        .filter(
          Boolean
        )
    ),
  ];
}


// ======================================================
// SERVICE MACHINE MISMATCH
// ======================================================
//
// Rule:
//
// XML3:
//   MA_DICH_VU
//   MA_MAY
//
// catalog.services:
//   requires_machine = true
//
// catalog.service_machines:
//   service_code <-> machine_code
//
// Nếu:
// - MA_MAY tồn tại trong catalog.machines
// - máy đang active
// - nhưng máy KHÔNG được gán cho DVKT
//
// => FAIL
//
// Không xử lý:
// - thiếu MA_MAY
//      SERVICE_MACHINE_REQUIRED xử lý
//
// - MA_MAY không tồn tại
//      MACHINE_EXISTS xử lý
//
// ======================================================

export const serviceMachineMismatchRule:
  RuleValidator = {

  async evaluate(
    context,
    rule,
    runtime
  ) {

    const client =
      runtime.client;


    // ==================================================
    // 1. LẤY DVKT CÓ MA_MAY
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


      if (!serviceCode) {

        continue;
      }


      const machineCodes =
        splitMachineCodes(
          rawData?.MA_MAY
        );


      // Thiếu MA_MAY:
      // rule REQUIRED xử lý.
      if (
        machineCodes.length ===
        0
      ) {

        continue;
      }


      for (
        const machineCode
        of machineCodes
      ) {

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

          machineCode,
        });
      }
    }


    // ==================================================
    // 2. KHÔNG CÓ DỮ LIỆU
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
          "Không có DVKT có mã máy để kiểm tra liên kết.",

        issueCount:
          0,

        details: {
          violations:
            [],
        },
      };
    }


    // ==================================================
    // 3. SERVICE CODES
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
    // 4. ĐỌC DVKT ĐANG YÊU CẦU MÁY
    // ==================================================

    const serviceResult =
      await client.query(
        `
        SELECT
          code,
          name,
          requires_machine

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
    // 5. MACHINE CODES
    // ==================================================

    const machineCodes =
      [
        ...new Set(
          serviceEvents.map(
            (
              item
            ) =>
              item.machineCode
          )
        ),
      ];


    // ==================================================
    // 6. ĐỌC MÁY TỒN TẠI
    // ==================================================
    //
    // Máy không tồn tại sẽ KHÔNG lỗi ở rule này.
    // MACHINE_EXISTS xử lý.
    //
    // ==================================================

    const machineResult =
      await client.query(
        `
        SELECT
          code,
          name,
          active

        FROM
          catalog.machines

        WHERE
          code =
          ANY(
            $1::varchar[]
          )
        `,
        [
          machineCodes,
        ]
      );


    const machineMap =
      new Map<
        string,
        {
          code:
            string;

          name:
            string |
            null;

          active:
            boolean;
        }
      >();


    for (
      const row
      of machineResult.rows
    ) {

      machineMap.set(
        String(
          row.code
        ),
        {

          code:
            String(
              row.code
            ),

          name:
            row.name
              ? String(
                  row.name
                )
              : null,

          active:
            Boolean(
              row.active
            ),
        }
      );
    }


    // ==================================================
    // 7. ĐỌC LIÊN KẾT DVKT <-> MÁY
    // ==================================================

    const linkResult =
      await client.query(
        `
        SELECT
          service_code,
          machine_code

        FROM
          catalog.service_machines

        WHERE
          service_code =
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


    const allowedMap =
      new Map<
        string,
        Set<string>
      >();


    for (
      const row
      of linkResult.rows
    ) {

      const serviceCode =
        String(
          row.service_code
        );


      const machineCode =
        String(
          row.machine_code
        );


      if (
        !allowedMap.has(
          serviceCode
        )
      ) {

        allowedMap.set(
          serviceCode,
          new Set()
        );
      }


      allowedMap
        .get(
          serviceCode
        )
        ?.add(
          machineCode
        );
    }


    // ==================================================
    // 8. CHECK
    // ==================================================

    const violations:
      Array<{
        type:
          "SERVICE_MACHINE_MISMATCH";

        eventId:
          string |
          null;

        serviceCode:
          string;

        serviceName:
          string;

        machineCode:
          string;

        machineName:
          string |
          null;

        allowedMachineCodes:
          string[];

        message:
          string;
      }> = [];


    for (
      const item
      of serviceEvents
    ) {

      const service =
        serviceMap.get(
          item.serviceCode
        );


      // DVKT chưa cấu hình.
      if (!service) {

        continue;
      }


      // Chỉ kiểm tra DVKT được cấu hình bắt buộc máy.
      if (
        !service.requiresMachine
      ) {

        continue;
      }


      const machine =
        machineMap.get(
          item.machineCode
        );


      // Máy không tồn tại hoặc inactive:
      // MACHINE_EXISTS xử lý.
      if (
        !machine ||
        !machine.active
      ) {

        continue;
      }


      const allowedMachines =
        allowedMap.get(
          service.code
        ) ??
        new Set<string>();


      if (
        allowedMachines.has(
          machine.code
        )
      ) {

        continue;
      }


      const allowedMachineCodes =
        [
          ...allowedMachines,
        ];


      violations.push({

        type:
          "SERVICE_MACHINE_MISMATCH",

        eventId:
          item.eventId,

        serviceCode:
          service.code,

        serviceName:
          service.name,

        machineCode:
          machine.code,

        machineName:
          machine.name,

        allowedMachineCodes,

        message:
          `Mã máy "${machine.code}" không được cấu hình cho DVKT "${service.name}" (${service.code}).`,
      });
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
          `Phát hiện ${violations.length} trường hợp mã máy không phù hợp DVKT.`,

        issueCount:
          violations.length,

        details: {
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
        "Các mã máy đều phù hợp với DVKT đã cấu hình.",

      issueCount:
        0,

      details: {
        violations:
          [],
      },
    };
  },
};