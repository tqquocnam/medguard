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
// DEPARTMENT EXISTS
//
// Kiểm tra MA_KHOA trong events
//
// Không tồn tại:
// DEPARTMENT_NOT_FOUND
//
// Có nhưng active = false:
// DEPARTMENT_INACTIVE
//
// ======================================================

export const departmentExistsRule:
  RuleValidator = {

  async evaluate(
    context,
    rule,
    runtime
  ) {

    const client =
      runtime.client;


    // ==================================================
    // 1. THU THẬP MÃ KHOA
    // ==================================================

    const usages:
      Array<{
        departmentCode: string;

        sourceType: string;

        eventId:
          string |
          null;

        itemCode:
          string |
          null;

        itemName:
          string |
          null;
      }> = [];


    for (
      const event
      of context.events ??
      []
    ) {

      const raw =
        event?.raw_data ??
        {};


      const departmentCode =
        normalizeText(
          raw?.MA_KHOA
        );


      if (
        !departmentCode
      ) {
        continue;
      }


      usages.push({
        departmentCode,

        sourceType:
          normalizeText(
            event?.source_type
          ),

        eventId:
          event?.id
            ? String(
                event.id
              )
            : null,

        itemCode:
          normalizeText(
            event?.item_code
          ) ||
          normalizeText(
            raw?.MA_DICH_VU
          ) ||
          normalizeText(
            raw?.MA_THUOC
          ) ||
          null,

        itemName:
          normalizeText(
            event?.item_name
          ) ||
          normalizeText(
            raw?.TEN_DICH_VU
          ) ||
          normalizeText(
            raw?.TEN_THUOC
          ) ||
          null,
      });
    }


    // ==================================================
    // 2. KHÔNG CÓ MA_KHOA
    // ==================================================

    if (
      usages.length ===
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
          "Hồ sơ không có mã khoa để kiểm tra.",

        issueCount:
          0,

        details: {
          violations:
            [],
        },
      };
    }


    // ==================================================
    // 3. UNIQUE CODES
    // ==================================================

    const departmentCodes =
      [
        ...new Set(
          usages.map(
            (
              usage
            ) =>
              usage.departmentCode
                .trim()
                .toLowerCase()
          )
        ),
      ];


    // ==================================================
    // 4. LOAD CATALOG
    // ==================================================

    const departmentResult =
      await client.query(
        `
        SELECT
          code,
          name,
          active

        FROM
          catalog.departments

        WHERE
          LOWER(
            BTRIM(
              code
            )
          )
          =
          ANY(
            $1::text[]
          )
        `,
        [
          departmentCodes,
        ]
      );


    const departmentMap =
      new Map<
        string,
        {
          code: string;

          name: string;

          active: boolean;
        }
      >();


    for (
      const row
      of departmentResult.rows
    ) {

      const code =
        normalizeText(
          row.code
        );


      if (
        !code
      ) {
        continue;
      }


      departmentMap.set(
        code
          .toLowerCase(),

        {
          code,

          name:
            normalizeText(
              row.name
            ),

          active:
            Boolean(
              row.active
            ),
        }
      );
    }


    // ==================================================
    // 5. CHECK
    //
    // Chỉ báo 1 lần / mã khoa.
    // ==================================================

    const violations:
      Array<{
        type:
          | "DEPARTMENT_NOT_FOUND"
          | "DEPARTMENT_INACTIVE";

        departmentCode: string;

        departmentName:
          string |
          null;

        sourceType: string;

        eventId:
          string |
          null;

        itemCode:
          string |
          null;

        itemName:
          string |
          null;

        message: string;
      }> = [];


    const checked =
      new Set<string>();


    for (
      const usage
      of usages
    ) {

      const normalizedCode =
        usage.departmentCode
          .trim()
          .toLowerCase();


      if (
        checked.has(
          normalizedCode
        )
      ) {
        continue;
      }


      checked.add(
        normalizedCode
      );


      const department =
        departmentMap.get(
          normalizedCode
        );


      // ================================================
      // NOT FOUND
      // ================================================

      if (
        !department
      ) {

        violations.push({
          type:
            "DEPARTMENT_NOT_FOUND",

          departmentCode:
            usage.departmentCode,

          departmentName:
            null,

          sourceType:
            usage.sourceType,

          eventId:
            usage.eventId,

          itemCode:
            usage.itemCode,

          itemName:
            usage.itemName,

          message:
            `Mã khoa "${usage.departmentCode}" không tồn tại trong Danh mục Khoa.`,
        });


        continue;
      }


      // ================================================
      // INACTIVE
      // ================================================

      if (
        !department.active
      ) {

        violations.push({
          type:
            "DEPARTMENT_INACTIVE",

          departmentCode:
            department.code,

          departmentName:
            department.name ||
            null,

          sourceType:
            usage.sourceType,

          eventId:
            usage.eventId,

          itemCode:
            usage.itemCode,

          itemName:
            usage.itemName,

          message:
            `Khoa "${department.code} - ${department.name}" đã ngừng sử dụng trong Danh mục Khoa.`,
        });
      }
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
          `Phát hiện ${violations.length} mã khoa không hợp lệ.`,

        issueCount:
          violations.length,

        details: {
          checkedCodes:
            departmentCodes.length,

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
        "Các mã khoa đều tồn tại và đang hoạt động trong danh mục.",

      issueCount:
        0,

      details: {
        checkedCodes:
          departmentCodes.length,

        violations:
          [],
      },
    };
  },
};