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
// MACHINE EXISTS
// ======================================================
//
// Mục đích:
//
// XML có MA_MAY
//      ↓
// catalog.machines.code
//
// Không tồn tại:
//      FAIL
//
// Máy active = false:
//      FAIL
//
// XML không có MA_MAY:
//      SKIP
//
// Việc DVKT "bắt buộc phải có máy"
// sẽ do rule khác xử lý sau.
//
// ======================================================

export const machineExistsRule:
  RuleValidator = {

  async evaluate(
    context,
    rule,
    runtime
  ) {

    const client =
      runtime.client;


    // ==================================================
    // 1. LẤY CÁC EVENT CÓ MA_MAY
    // ==================================================

    const machineEvents:
      Array<{
        eventId: string | null;
        eventType: string | null;
        serviceCode: string | null;
        serviceName: string | null;
        machineCode: string;
      }> = [];


    for (
      const event
      of context.events ??
      []
    ) {

      const rawData =
        event?.raw_data ??
        {};


      const rawMachineCode =
        normalizeText(
          rawData?.MA_MAY
        );


      // Không có MA_MAY
      // Rule này không xử lý.
      if (
        !rawMachineCode
      ) {

        continue;
      }


      // ==================================================
      // Một số XML có thể chứa nhiều mã máy
      //
      // Ví dụ:
      // MAY001;MAY002
      // MAY001|MAY002
      //
      // Không split dấu "." vì mã máy thường chứa "."
      // ==================================================

      const machineCodes =
        rawMachineCode
          .split(
            /[;|]+/
          )
          .map(
            (
              value
            ) =>
              value.trim()
          )
          .filter(
            Boolean
          );


      for (
        const machineCode
        of machineCodes
      ) {

        machineEvents.push({

          eventId:
            event?.id
              ? String(
                  event.id
                )
              : null,

          eventType:
            event?.event_type
              ? String(
                  event.event_type
                )
              : null,

          serviceCode:
            event?.item_code
              ? String(
                  event.item_code
                )
              : (
                  rawData?.MA_DICH_VU
                    ? String(
                        rawData.MA_DICH_VU
                      )
                    : null
                ),

          serviceName:
            event?.item_name
              ? String(
                  event.item_name
                )
              : (
                  rawData?.TEN_DICH_VU
                    ? String(
                        rawData.TEN_DICH_VU
                      )
                    : null
                ),

          machineCode,
        });
      }
    }


    // ==================================================
    // 2. KHÔNG CÓ MA_MAY
    // ==================================================

    if (
      machineEvents.length ===
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
          "Hồ sơ không có mã máy để kiểm tra.",

        issueCount:
          0,

        details: {
          violations:
            [],
        },
      };
    }


    // ==================================================
    // 3. DANH SÁCH MÃ MÁY DUY NHẤT
    // ==================================================

    const machineCodes =
      [
        ...new Set(
          machineEvents.map(
            (
              item
            ) =>
              item.machineCode
          )
        ),
      ];


    // ==================================================
    // 4. ĐỌC DANH MỤC MÁY
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


    // ==================================================
    // 5. MAP MACHINE
    // ==================================================

    const catalogMap =
      new Map<
        string,
        {
          code: string;
          name: string | null;
          active: boolean;
        }
      >();


    for (
      const row
      of machineResult.rows
    ) {

      catalogMap.set(
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
    // 6. KIỂM TRA TỪNG MA_MAY
    // ==================================================

    const violations:
      Array<{
        type:
          "MACHINE_NOT_FOUND" |
          "MACHINE_INACTIVE";

        machineCode:
          string;

        machineName:
          string | null;

        serviceCode:
          string | null;

        serviceName:
          string | null;

        eventId:
          string | null;

        message:
          string;
      }> = [];


    for (
      const item
      of machineEvents
    ) {

      const machine =
        catalogMap.get(
          item.machineCode
        );


      // ==================================================
      // KHÔNG CÓ TRONG DANH MỤC
      // ==================================================

      if (
        !machine
      ) {

        violations.push({

          type:
            "MACHINE_NOT_FOUND",

          machineCode:
            item.machineCode,

          machineName:
            null,

          serviceCode:
            item.serviceCode,

          serviceName:
            item.serviceName,

          eventId:
            item.eventId,

          message:
            `Mã máy "${item.machineCode}" không tồn tại trong Danh mục máy.`,
        });


        continue;
      }


      // ==================================================
      // CÓ NHƯNG ĐÃ NGỪNG SỬ DỤNG
      // ==================================================

      if (
        !machine.active
      ) {

        violations.push({

          type:
            "MACHINE_INACTIVE",

          machineCode:
            item.machineCode,

          machineName:
            machine.name,

          serviceCode:
            item.serviceCode,

          serviceName:
            item.serviceName,

          eventId:
            item.eventId,

          message:
            `Mã máy "${item.machineCode}" đã ngừng sử dụng trong Danh mục máy.`,
        });
      }
    }


    // ==================================================
    // 7. PASS
    // ==================================================

    if (
      violations.length ===
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

        message:
          "Tất cả mã máy đều tồn tại trong Danh mục máy.",

        issueCount:
          0,

        details: {

          checkedMachineCodes:
            machineCodes,

          violations:
            [],
        },
      };
    }


    // ==================================================
    // 8. FAIL
    // ==================================================

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
        `Phát hiện ${violations.length} mã máy không hợp lệ.`,

      issueCount:
        violations.length,

      details: {

        checkedMachineCodes:
          machineCodes,

        violations,
      },
    };
  },
};