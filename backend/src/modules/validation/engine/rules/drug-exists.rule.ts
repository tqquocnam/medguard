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
// DRUG EXISTS
//
// Kiểm tra MA_THUOC trong XML2
//
// đối chiếu:
//
// catalog.drugs.code
//
// Không tồn tại:
// DRUG_NOT_FOUND
//
// Đã ngừng sử dụng:
// DRUG_INACTIVE
//
// ======================================================

export const drugExistsRule:
  RuleValidator = {

  async evaluate(
    context,
    rule,
    runtime
  ) {

    const client =
      runtime.client;


    // ==================================================
    // 1. THU THẬP THUỐC TRONG HỒ SƠ
    // ==================================================

    const usages:
      Array<{
        drugCode: string;

        drugName:
          string |
          null;

        sourceType: string;

        eventId:
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


      const drugCode =
        normalizeText(
          raw?.MA_THUOC
        );


      if (
        !drugCode
      ) {
        continue;
      }


      const drugName =
        normalizeText(
          raw?.TEN_THUOC
        ) ||
        normalizeText(
          event?.item_name
        ) ||
        null;


      usages.push({
        drugCode,

        drugName,

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
      });
    }


    // ==================================================
    // 2. KHÔNG CÓ THUỐC
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
          "Hồ sơ không có thuốc để kiểm tra.",

        issueCount:
          0,

        details: {
          checkedCodes:
            0,

          violations:
            [],
        },
      };
    }


    // ==================================================
    // 3. UNIQUE DRUG CODES
    // ==================================================

    const drugCodes =
      [
        ...new Set(
          usages.map(
            (
              usage
            ) =>
              usage.drugCode
                .trim()
                .toLowerCase()
          )
        ),
      ];


    // ==================================================
    // 4. LOAD CATALOG
    // ==================================================

    const drugResult =
      await client.query(
        `
        SELECT
          code,
          name,
          active

        FROM
          catalog.drugs

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
          drugCodes,
        ]
      );


    const drugMap =
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
      of drugResult.rows
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


      drugMap.set(
        code.toLowerCase(),

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
    // Chỉ báo 1 lỗi / mã thuốc.
    // ==================================================

    const violations:
      Array<{
        type:
          | "DRUG_NOT_FOUND"
          | "DRUG_INACTIVE";

        drugCode: string;

        drugName:
          string |
          null;

        catalogName:
          string |
          null;

        sourceType: string;

        eventId:
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
        usage.drugCode
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


      const drug =
        drugMap.get(
          normalizedCode
        );


      // ================================================
      // KHÔNG TỒN TẠI
      // ================================================

      if (
        !drug
      ) {

        violations.push({
          type:
            "DRUG_NOT_FOUND",

          drugCode:
            usage.drugCode,

          drugName:
            usage.drugName,

          catalogName:
            null,

          sourceType:
            usage.sourceType,

          eventId:
            usage.eventId,

          message:
            usage.drugName
              ? `Mã thuốc "${usage.drugCode}" - "${usage.drugName}" không tồn tại trong Danh mục Thuốc.`
              : `Mã thuốc "${usage.drugCode}" không tồn tại trong Danh mục Thuốc.`,
        });


        continue;
      }


      // ================================================
      // INACTIVE
      // ================================================

      if (
        !drug.active
      ) {

        violations.push({
          type:
            "DRUG_INACTIVE",

          drugCode:
            drug.code,

          drugName:
            usage.drugName,

          catalogName:
            drug.name ||
            null,

          sourceType:
            usage.sourceType,

          eventId:
            usage.eventId,

          message:
            `Thuốc "${drug.code} - ${drug.name}" đã ngừng sử dụng trong Danh mục Thuốc.`,
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
          `Phát hiện ${violations.length} mã thuốc không hợp lệ.`,

        issueCount:
          violations.length,

        details: {
          totalUsages:
            usages.length,

          checkedCodes:
            drugCodes.length,

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
        "Các mã thuốc đều tồn tại và đang hoạt động trong Danh mục Thuốc.",

      issueCount:
        0,

      details: {
        totalUsages:
          usages.length,

        checkedCodes:
          drugCodes.length,

        violations:
          [],
      },
    };
  },
};