import type {
  RuleValidator,
} from "../rule.types.js";


// ======================================================
// TYPES
// ======================================================

interface StaffRow {
  id: string;

  full_name:
    string;

  social_insurance_code:
    string |
    null;

  license_number:
    string |
    null;

  active:
    boolean;

  department_codes:
    unknown;
}


interface StaffInfo {
  id:
    string;

  fullName:
    string;

  licenseNumber:
    string;

  socialInsuranceCode:
    string;

  active:
    boolean;

  departmentCodes:
    string[];
}


interface StaffUsage {
  staffCode:
    string;

  departmentCode:
    string;

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
}


// ======================================================
// NORMALIZE TEXT
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
// Bỏ toàn bộ khoảng trắng + lowercase
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
// NORMALIZE MÃ KHOA
//
// 02.03 -> 2.03
// 03.18 -> 3.18
//
// K01, K39... giữ nguyên logic chữ,
// chỉ lowercase để so sánh.
// ======================================================

function normalizeDepartmentCode(
  value:
    unknown
): string {

  const text =
    normalizeText(
      value
    )
      .toLowerCase();


  if (
    !text
  ) {

    return "";
  }


  const numericMatch =
    text.match(
      /^0*(\d+)\.(\d+)$/
    );


  if (
    numericMatch
  ) {

    return (
      `${Number(
        numericMatch[1]
      )}.${numericMatch[2]}`
    );

  }


  return text;

}


// ======================================================
// SPLIT STAFF CODE
//
// A;B
// A,B
// A|B
//
// =>
//
// ["A", "B"]
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
          (
            item
          ):
            item is string =>
              item.length >
              0
        )
    ),
  ];

}


// ======================================================
// STAFF DEPARTMENT MISMATCH
//
// Trách nhiệm:
//
// STAFF_EXISTS:
// - nhân viên không tồn tại
// - nhân viên inactive
//
// DEPARTMENT_EXISTS:
// - khoa không tồn tại
// - khoa inactive
//
// STAFF_DEPARTMENT_MISMATCH:
// - nhân viên tồn tại + active
// - khoa tồn tại + active
// - nhưng nhân viên không thuộc khoa đó
//
//
// ĐẶC BIỆT:
//
// K01 = khoa khám bệnh chung.
//
// Hồ sơ ngoại trú có thể ghi:
// MA_KHOA = K01
//
// trong khi bác sĩ được khai báo:
//
// 02.03
// 10.19
// 15.28
// ...
//
// => K01 KHÔNG dùng để kết luận sai khoa.
// ======================================================

export const staffDepartmentMismatchRule:
  RuleValidator = {

  async evaluate(
    context,
    rule,
    runtime
  ) {

    const client =
      runtime.client;


    // ==================================================
    // 1. THU THẬP USAGE
    // ==================================================

    const usages:
      StaffUsage[] =
      [];


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


      // Không có MA_KHOA
      // => rule này không xử lý.
      if (
        !departmentCode
      ) {

        continue;
      }


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
          raw?.MA_DICH_VU
        ) ||

        normalizeText(
          raw?.MA_THUOC
        ) ||

        null;


      const itemName =
        normalizeText(
          event?.item_name
        ) ||

        normalizeText(
          raw?.TEN_DICH_VU
        ) ||

        normalizeText(
          raw?.TEN_THUOC
        ) ||

        null;


      // ================================================
      // MA_BAC_SI
      // ================================================

      for (
        const staffCode
        of splitStaffCodes(
          raw?.MA_BAC_SI
        )
      ) {

        usages.push({

          staffCode,

          departmentCode,

          field:
            "MA_BAC_SI",

          sourceType,

          eventId,

          itemCode,

          itemName,

        });

      }


      // ================================================
      // NGUOI_THUC_HIEN
      // ================================================

      for (
        const staffCode
        of splitStaffCodes(
          raw?.NGUOI_THUC_HIEN
        )
      ) {

        usages.push({

          staffCode,

          departmentCode,

          field:
            "NGUOI_THUC_HIEN",

          sourceType,

          eventId,

          itemCode,

          itemName,

        });

      }


      // ================================================
      // MA_BS_DOC_KQ
      //
      // Nếu XML có bác sĩ đọc kết quả thì cũng kiểm.
      // ================================================

      for (
        const staffCode
        of splitStaffCodes(
          raw?.MA_BS_DOC_KQ
        )
      ) {

        usages.push({

          staffCode,

          departmentCode,

          field:
            "MA_BS_DOC_KQ",

          sourceType,

          eventId,

          itemCode,

          itemName,

        });

      }

    }


    // ==================================================
    // 2. KHÔNG CÓ USAGE
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
          "Không có mã nhân viên kèm mã khoa để kiểm tra.",

        issueCount:
          0,

        details: {

          totalUsages:
            0,

          checkedUsages:
            0,

          skippedK01:
            0,

          skippedInvalidDepartment:
            0,

          violations:
            [],

        },

      };

    }


    // ==================================================
    // 3. LOAD TOÀN BỘ KHOA ACTIVE
    //
    // Không query theo mã XML trước vì:
    //
    // DB: 02.03
    // XML: 2.03
    //
    // Phải normalize sau khi SELECT.
    // ==================================================

    const departmentResult =
      await client.query(
        `
        SELECT
          code

        FROM
          catalog.departments

        WHERE
          active = true
        `
      );


    const validDepartments =
      new Set<
        string
      >(
        departmentResult.rows
          .map(
            (
              row:
                {
                  code:
                    unknown;
                }
            ) =>
              normalizeDepartmentCode(
                row.code
              )
          )
          .filter(
            (
              code
            ):
              code is string =>
                code.length >
                0
          )
      );


    // ==================================================
    // 4. UNIQUE STAFF CODES
    // ==================================================

    const staffCodes =
      [
        ...new Set(
          usages
            .map(
              (
                usage
              ) =>
                normalizeStaffCode(
                  usage.staffCode
                )
            )
            .filter(
              (
                code
              ):
                code is string =>
                  code.length >
                  0
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
          "Không có mã nhân viên hợp lệ để kiểm tra.",

        issueCount:
          0,

        details: {

          totalUsages:
            usages.length,

          checkedUsages:
            0,

          skippedK01:
            0,

          skippedInvalidDepartment:
            0,

          violations:
            [],

        },

      };

    }


    // ==================================================
    // 5. LOAD NHÂN VIÊN + DANH SÁCH KHOA
    //
    // Match bằng:
    //
    // 1. license_number
    // 2. social_insurance_code
    //
    // để đồng bộ với STAFF_EXISTS.
    // ==================================================

    const staffResult =
      await client.query<
        StaffRow
      >(
        `
        SELECT

          ms.id,

          ms.full_name,

          ms.social_insurance_code,

          ms.license_number,

          ms.active,

          COALESCE(
            ARRAY_AGG(
              msd.department_code
            )
            FILTER (
              WHERE
                msd.department_code IS NOT NULL
                AND msd.active = true
            ),

            ARRAY[]::varchar[]
          ) AS department_codes

        FROM
          catalog.medical_staff ms

        LEFT JOIN
          catalog.medical_staff_departments msd

          ON
            msd.staff_id =
            ms.id

        WHERE

          LOWER(
            REGEXP_REPLACE(
              BTRIM(
                COALESCE(
                  ms.license_number,
                  ''
                )
              ),
              '\\s+',
              '',
              'g'
            )
          )
          =
          ANY(
            $1::text[]
          )

          OR

          LOWER(
            REGEXP_REPLACE(
              BTRIM(
                COALESCE(
                  ms.social_insurance_code,
                  ''
                )
              ),
              '\\s+',
              '',
              'g'
            )
          )
          =
          ANY(
            $1::text[]
          )

        GROUP BY

          ms.id,

          ms.full_name,

          ms.social_insurance_code,

          ms.license_number,

          ms.active
        `,
        [
          staffCodes,
        ]
      );


    // ==================================================
    // 6. STAFF MAP
    //
    // Một nhân viên có thể được tìm bằng:
    //
    // license_number
    //
    // hoặc
    //
    // social_insurance_code
    // ==================================================

    const staffMap =
      new Map<
        string,
        StaffInfo
      >();


    for (
      const row
      of staffResult.rows
    ) {

      const licenseNumber =
        normalizeText(
          row.license_number
        );


      const socialInsuranceCode =
        normalizeText(
          row.social_insurance_code
        );


      const departmentCodes:
        string[] =
        Array.isArray(
          row.department_codes
        )

          ? (
              row.department_codes as
                unknown[]
            )
              .map(
                (
                  code
                ) =>
                  normalizeDepartmentCode(
                    code
                  )
              )
              .filter(
                (
                  code
                ):
                  code is string =>
                    code.length >
                    0
              )

          : [];


      const staff:
        StaffInfo = {

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

        departmentCodes,

      };


      // ================================================
      // MAP THEO CCHN / GPHN
      // ================================================

      const normalizedLicenseNumber =
        normalizeStaffCode(
          licenseNumber
        );


      if (
        normalizedLicenseNumber
      ) {

        staffMap.set(
          normalizedLicenseNumber,
          staff
        );

      }


      // ================================================
      // MAP THEO MÃ BHXH
      // ================================================

      const normalizedSocialInsuranceCode =
        normalizeStaffCode(
          socialInsuranceCode
        );


      if (
        normalizedSocialInsuranceCode
      ) {

        staffMap.set(
          normalizedSocialInsuranceCode,
          staff
        );

      }

    }


    // ==================================================
    // 7. CHECK MISMATCH
    // ==================================================

    const violations:
      Array<{

        type:
          "STAFF_DEPARTMENT_MISMATCH";

        staffCode:
          string;

        staffName:
          string;

        xmlDepartmentCode:
          string;

        configuredDepartments:
          string[];

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

        message:
          string;

      }> =
      [];


    // ==================================================
    // CHỐNG DUPLICATE
    //
    // Cùng nhân viên + cùng khoa
    // chỉ báo 1 lần.
    // ==================================================

    const violationKeys =
      new Set<
        string
      >();


    let checkedUsages =
      0;


    let skippedK01 =
      0;


    let skippedInvalidDepartment =
      0;


    for (
      const usage
      of usages
    ) {

      const normalizedDepartment =
        normalizeDepartmentCode(
          usage.departmentCode
        );


      if (
        !normalizedDepartment
      ) {

        continue;
      }


      // ================================================
      // K01 = KHOA KHÁM BỆNH CHUNG
      //
      // Không dùng để kết luận bác sĩ sai khoa.
      // ================================================

      if (
        normalizedDepartment ===
        "k01"
      ) {

        skippedK01++;

        continue;
      }


      // ================================================
      // KHOA KHÔNG TỒN TẠI / INACTIVE
      //
      // DEPARTMENT_EXISTS chịu trách nhiệm.
      // ================================================

      if (
        !validDepartments.has(
          normalizedDepartment
        )
      ) {

        skippedInvalidDepartment++;

        continue;
      }


      // ================================================
      // NORMALIZE STAFF CODE
      // ================================================

      const normalizedStaffCode =
        normalizeStaffCode(
          usage.staffCode
        );


      if (
        !normalizedStaffCode
      ) {

        continue;
      }


      const staff =
        staffMap.get(
          normalizedStaffCode
        );


      // ================================================
      // STAFF KHÔNG TỒN TẠI / INACTIVE
      //
      // STAFF_EXISTS chịu trách nhiệm.
      // ================================================

      if (
        !staff ||
        !staff.active
      ) {

        continue;
      }


      // Đây mới là usage thuộc trách nhiệm
      // STAFF_DEPARTMENT_MISMATCH.
      checkedUsages++;


      // ================================================
      // ĐÚNG KHOA
      // ================================================

      if (
        staff.departmentCodes.includes(
          normalizedDepartment
        )
      ) {

        continue;
      }


      // ================================================
      // TRÁNH DUPLICATE
      // ================================================

      const violationKey =
        [
          normalizedStaffCode,
          normalizedDepartment,
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
        usage.staffCode;


      violations.push({

        type:
          "STAFF_DEPARTMENT_MISMATCH",

        staffCode:
          usage.staffCode,

        staffName:
          staff.fullName,

        xmlDepartmentCode:
          usage.departmentCode,

        configuredDepartments:
          staff.departmentCodes,

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

        message:
          `Nhân viên "${staff.fullName}" (${displayCode}) không được cấu hình thuộc khoa "${usage.departmentCode}" trong Danh mục Nhân viên y tế.`,

      });

    }


    // ==================================================
    // 8. KHÔNG CÓ USAGE NÀO THUỘC RULE
    //
    // Ví dụ:
    //
    // - tất cả MA_KHOA = K01
    // - khoa không tồn tại
    // - nhân viên không tồn tại
    // ==================================================

    if (
      checkedUsages ===
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
          skippedK01 >
          0

            ? "Các trường hợp MA_KHOA = K01 được bỏ qua khi đối chiếu khoa chuyên môn của nhân viên."

            : "Không có trường hợp nhân viên và khoa hợp lệ để đối chiếu quan hệ.",

        issueCount:
          0,

        details: {

          totalUsages:
            usages.length,

          checkedUsages:
            0,

          skippedK01,

          skippedInvalidDepartment,

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
          `Phát hiện ${violations.length} trường hợp nhân viên không thuộc đúng khoa.`,

        issueCount:
          violations.length,

        details: {

          totalUsages:
            usages.length,

          checkedUsages,

          skippedK01,

          skippedInvalidDepartment,

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
        "Nhân viên y tế được cấu hình đúng khoa.",

      issueCount:
        0,

      details: {

        totalUsages:
          usages.length,

        checkedUsages,

        skippedK01,

        skippedInvalidDepartment,

        violations:
          [],

      },

    };

  },

};