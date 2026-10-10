import type {
  RuleValidator,
} from "../rule.types.js";


// ======================================================
// HELPERS
// ======================================================

function normalizeText(
  value:
    unknown
): string {

  return String(
    value ??
    ""
  ).trim();
}


// ======================================================
// NORMALIZE STAFF CODE
//
// Ví dụ:
//
// 005769/ST-CCHN
// 005769 /ST-CCHN
// 005769/ST-CCHN
//
// => cùng một mã.
//
// Chỉ dùng cho việc SO SÁNH.
// Khi báo lỗi vẫn hiển thị mã gốc trong XML.
// ======================================================

function normalizeStaffCode(
  value:
    unknown
): string {

  return normalizeText(
    value
  )
    .toLowerCase()
    .replace(
      /\s+/g,
      ""
    );
}


// ======================================================
// SPLIT STAFF CODES
//
// Hỗ trợ:
//
// 005618/CM-CCHN
//
// 005618/CM-CCHN;005769/ST-CCHN
//
// 005618/CM-CCHN|005769/ST-CCHN
//
// 005618/CM-CCHN,005769/ST-CCHN
// ======================================================

function splitStaffCodes(
  value:
    unknown
): string[] {

  const text =
    normalizeText(
      value
    );


  if (
    !text
  ) {

    return [];
  }


  return [
    ...new Set(
      text
        .split(
          /[;|,]+/
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
// STAFF EXISTS RULE
//
// Kiểm tra:
//
// XML2.MA_BAC_SI
// XML3.MA_BAC_SI
// XML3.NGUOI_THUC_HIEN
//
// Đối chiếu với:
//
// 1. catalog.medical_staff.license_number
//    = Mã CCHN / GPHN
//
// HOẶC
//
// 2. catalog.medical_staff.social_insurance_code
//    = Mã BHXH
//
//
// KHÔNG dùng:
//
// position
// full_name
// professional_title
//
// vì những trường đó không phải mã định danh duy nhất.
//
//
// Không tìm thấy:
// STAFF_NOT_FOUND
//
// Có nhưng active = false:
// STAFF_INACTIVE
// ======================================================

export const staffExistsRule:
  RuleValidator = {

  async evaluate(
    context,
    rule,
    runtime
  ) {

    const client =
      runtime.client;


    // ==================================================
    // 1. THU THẬP MÃ NHÂN VIÊN
    // ==================================================

    const staffUsages:
      Array<{
        code: string;

        field: string;

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

        departmentCode:
          string |
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


      const eventId =
        event?.id
          ? String(
              event.id
            )
          : null;


      const itemCode =
        normalizeText(
          event?.item_code
        ) ||
        normalizeText(
          rawData?.MA_DICH_VU
        ) ||
        normalizeText(
          rawData?.MA_THUOC
        ) ||
        null;


      const itemName =
        normalizeText(
          event?.item_name
        ) ||
        normalizeText(
          rawData?.TEN_DICH_VU
        ) ||
        normalizeText(
          rawData?.TEN_THUOC
        ) ||
        null;


      const departmentCode =
        normalizeText(
          rawData?.MA_KHOA
        ) ||
        null;


      // ================================================
      // MA_BAC_SI
      // ================================================

      const doctorCodes =
        splitStaffCodes(
          rawData?.MA_BAC_SI
        );


      for (
        const code
        of doctorCodes
      ) {

        staffUsages.push({
          code,

          field:
            "MA_BAC_SI",

          sourceType,

          eventId,

          itemCode,

          itemName,

          departmentCode,
        });
      }


      // ================================================
      // NGUOI_THUC_HIEN
      //
      // Chủ yếu XML3.
      //
      // Người thực hiện có thể khác bác sĩ ra y lệnh.
      // ================================================

      const performerCodes =
        splitStaffCodes(
          rawData?.NGUOI_THUC_HIEN
        );


      for (
        const code
        of performerCodes
      ) {

        staffUsages.push({
          code,

          field:
            "NGUOI_THUC_HIEN",

          sourceType,

          eventId,

          itemCode,

          itemName,

          departmentCode,
        });
      }
    }


    // ==================================================
    // 2. KHÔNG CÓ MÃ NHÂN VIÊN
    // ==================================================

    if (
      staffUsages.length ===
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
          "Hồ sơ không có mã bác sĩ/nhân viên để kiểm tra.",

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
    // 3. UNIQUE STAFF CODES
    //
    // Normalize trước khi query.
    // ==================================================

    const staffCodes =
      [
        ...new Set(
          staffUsages
            .map(
              (
                item
              ) =>
                normalizeStaffCode(
                  item.code
                )
            )
            .filter(
              Boolean
            )
        ),
      ];


    if (
      staffCodes.length ===
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
          "Hồ sơ không có mã bác sĩ/nhân viên hợp lệ để kiểm tra.",

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
    // 4. ĐỌC DANH MỤC NHÂN VIÊN
    //
    // Match bằng:
    //
    // - Mã CCHN / GPHN
    // HOẶC
    // - Mã BHXH
    //
    // Đồng thời bỏ toàn bộ khoảng trắng trước khi so.
    //
    // Ví dụ DB:
    //
    // 005769 /ST-CCHN
    //
    // XML:
    //
    // 005769/ST-CCHN
    //
    // vẫn match.
    // ==================================================

    const staffResult =
      await client.query(
        `
        SELECT
          id,

          full_name,

          license_number,

          social_insurance_code,

          active

        FROM
          catalog.medical_staff

        WHERE

          REGEXP_REPLACE(
            LOWER(
              BTRIM(
                COALESCE(
                  license_number,
                  ''
                )
              )
            ),
            '[[:space:]]+',
            '',
            'g'
          )
          =
          ANY(
            $1::text[]
          )

          OR

          REGEXP_REPLACE(
            LOWER(
              BTRIM(
                COALESCE(
                  social_insurance_code,
                  ''
                )
              )
            ),
            '[[:space:]]+',
            '',
            'g'
          )
          =
          ANY(
            $1::text[]
          )
        `,
        [
          staffCodes,
        ]
      );


    // ==================================================
    // 5. STAFF MAP
    //
    // Một nhân viên được map bằng cả:
    //
    // - license_number
    // - social_insurance_code
    //
    // để XML sử dụng loại mã nào cũng tìm được.
    // ==================================================

    type StaffMapItem = {
      id:
        string;

      fullName:
        string;

      licenseNumber:
        string |
        null;

      socialInsuranceCode:
        string |
        null;

      active:
        boolean;
    };


    const staffMap =
      new Map<
        string,
        StaffMapItem
      >();


    for (
      const row
      of staffResult.rows
    ) {

      const licenseNumber =
        normalizeText(
          row.license_number
        ) ||
        null;


      const socialInsuranceCode =
        normalizeText(
          row.social_insurance_code
        ) ||
        null;


      const staff:
        StaffMapItem = {

        id:
          String(
            row.id
          ),

        fullName:
          normalizeText(
            row.full_name
          ),

        licenseNumber,

        socialInsuranceCode,

        active:
          Boolean(
            row.active
          ),
      };


      // ================================================
      // MAP MÃ CCHN / GPHN
      // ================================================

      if (
        licenseNumber
      ) {

        const key =
          normalizeStaffCode(
            licenseNumber
          );


        if (
          key
        ) {

          staffMap.set(
            key,
            staff
          );
        }
      }


      // ================================================
      // MAP MÃ BHXH
      // ================================================

      if (
        socialInsuranceCode
      ) {

        const key =
          normalizeStaffCode(
            socialInsuranceCode
          );


        if (
          key
        ) {

          staffMap.set(
            key,
            staff
          );
        }
      }
    }


    // ==================================================
    // 6. VIOLATIONS
    // ==================================================

    const violations:
      Array<{
        type:
          | "STAFF_NOT_FOUND"
          | "STAFF_INACTIVE";

        staffCode:
          string;

        staffName:
          string |
          null;

        field:
          string;

        sourceType:
          string;

        eventId:
          string |
          null;

        itemCode:
          string |
          null;

        itemName:
          string |
          null;

        departmentCode:
          string |
          null;

        message:
          string;
      }> = [];


    // ==================================================
    // Tránh báo cùng lỗi quá nhiều lần.
    //
    // Ví dụ:
    //
    // 04259/ST-CCHN
    //
    // xuất hiện ở 75 DVKT thì chỉ báo 1 lần cho
    // NGUOI_THUC_HIEN.
    // ==================================================

    const violationKeys =
      new Set<string>();


    for (
      const usage
      of staffUsages
    ) {

      const normalizedCode =
        normalizeStaffCode(
          usage.code
        );


      if (
        !normalizedCode
      ) {

        continue;
      }


      const staff =
        staffMap.get(
          normalizedCode
        );


      // ================================================
      // KHÔNG TỒN TẠI
      // ================================================

      if (
        !staff
      ) {

        const violationKey =
          [
            "NOT_FOUND",

            normalizedCode,

            usage.field,
          ].join(
            "|"
          );


        if (
          violationKeys.has(
            violationKey
          )
        ) {

          continue;
        }


        violationKeys.add(
          violationKey
        );


        violations.push({
          type:
            "STAFF_NOT_FOUND",

          staffCode:
            usage.code,

          staffName:
            null,

          field:
            usage.field,

          sourceType:
            usage.sourceType,

          eventId:
            usage.eventId,

          itemCode:
            usage.itemCode,

          itemName:
            usage.itemName,

          departmentCode:
            usage.departmentCode,

          message:
            `Mã nhân viên "${usage.code}" tại trường ${usage.field} không tồn tại trong Danh mục Nhân viên y tế. Hãy kiểm tra Mã CCHN/GPHN hoặc Mã BHXH của nhân viên.`,
        });


        continue;
      }


      // ================================================
      // ĐÃ NGỪNG SỬ DỤNG
      // ================================================

      if (
        !staff.active
      ) {

        const violationKey =
          [
            "INACTIVE",

            normalizedCode,

            usage.field,
          ].join(
            "|"
          );


        if (
          violationKeys.has(
            violationKey
          )
        ) {

          continue;
        }


        violationKeys.add(
          violationKey
        );


        const displayCode =
          staff.licenseNumber ||
          staff.socialInsuranceCode ||
          usage.code;


        violations.push({
          type:
            "STAFF_INACTIVE",

          staffCode:
            usage.code,

          staffName:
            staff.fullName ||
            null,

          field:
            usage.field,

          sourceType:
            usage.sourceType,

          eventId:
            usage.eventId,

          itemCode:
            usage.itemCode,

          itemName:
            usage.itemName,

          departmentCode:
            usage.departmentCode,

          message:
            `Nhân viên "${staff.fullName}" (${displayCode}) đã ngừng sử dụng trong Danh mục Nhân viên y tế.`,
        });
      }
    }


    // ==================================================
    // 7. FAIL
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
          `Phát hiện ${violations.length} mã bác sĩ/nhân viên không hợp lệ.`,

        issueCount:
          violations.length,

        details: {
          checkedCodes:
            staffCodes.length,

          matchedCodes:
            staffCodes.filter(
              (
                code
              ) =>
                staffMap.has(
                  code
                )
            ).length,

          violations,
        },
      };
    }


    // ==================================================
    // 8. PASS
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
        "Các mã bác sĩ/nhân viên đều tồn tại và đang hoạt động trong danh mục.",

      issueCount:
        0,

      details: {
        checkedCodes:
          staffCodes.length,

        matchedCodes:
          staffCodes.length,

        violations:
          [],
      },
    };
  },
};