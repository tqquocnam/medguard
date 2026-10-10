import ExcelJS from "exceljs";

import {
  db,
} from "../../config/database.js";


// ======================================================
// TYPES
// ======================================================

interface MedicalStaffImportRow {
  rowNumber:
    number;

  fullName:
    string;

  socialInsuranceCode:
    string;

  licenseNumber:
    string;

  gender:
    string |
    null;

  licenseIssueDate:
    string |
    null;

  professionalTitle:
    string |
    null;

  licenseIssuer:
    string |
    null;

  professionalScope:
    string |
    null;

  registrationTime:
    string |
    null;

  dailyTime:
    string |
    null;

  weeklyTime:
    string |
    null;

  position:
    string |
    null;

  departmentCodes:
    string[];
}


export interface MedicalStaffImportError {
  row:
    number;

  field:
    string;

  message:
    string;
}


export interface MedicalStaffImportResult {
  totalRows:
    number;

  inserted:
    number;

  updated:
    number;

  skipped:
    number;
}


// ======================================================
// VALIDATION ERROR
// ======================================================

export class MedicalStaffImportValidationError
  extends Error {

  errors:
    MedicalStaffImportError[];


  constructor(
    message:
      string,

    errors:
      MedicalStaffImportError[]
  ) {

    super(
      message
    );


    this.name =
      "MedicalStaffImportValidationError";


    this.errors =
      errors;
  }
}


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


function optionalText(
  value:
    unknown
):
string |
null {

  const text =
    normalizeText(
      value
    );


  return (
    text ||
    null
  );
}


function normalizeKey(
  value:
    unknown
): string {

  return normalizeText(
    value
  ).toLowerCase();
}


function getCellText(
  cell:
    ExcelJS.Cell
): string {

  return String(
    cell.text ??
    ""
  ).trim();
}


// ======================================================
// BUILD HEADER MAP
// ======================================================

function buildHeaderMap(
  worksheet:
    ExcelJS.Worksheet
):
Map<
  string,
  number
> {

  const result =
    new Map<
      string,
      number
    >();


  const headerRow =
    worksheet.getRow(
      1
    );


  const columnCount =
    Math.max(
      worksheet.columnCount,
      headerRow.cellCount
    );


  for (
    let columnIndex =
      1;

    columnIndex <=
      columnCount;

    columnIndex++
  ) {

    const header =
      getCellText(
        headerRow.getCell(
          columnIndex
        )
      )
        .replace(
          /^\uFEFF/,
          ""
        )
        .toUpperCase()
        .trim();


    if (
      header
    ) {

      result.set(
        header,
        columnIndex
      );
    }
  }


  return result;
}


// ======================================================
// FIND SHEET
//
// Không bắt buộc sheet phải tên NhanVienYTe.
//
// Chỉ cần có:
// MA_BHXH
// HO_TEN
// MACCHN
// ======================================================

function findMedicalStaffWorksheet(
  workbook:
    ExcelJS.Workbook
):
{
  worksheet:
    ExcelJS.Worksheet;

  headers:
    Map<
      string,
      number
    >;
} |
null {

  for (
    const worksheet
    of workbook.worksheets
  ) {

    const headers =
      buildHeaderMap(
        worksheet
      );


    if (
      headers.has(
        "MA_BHXH"
      ) &&
      headers.has(
        "HO_TEN"
      ) &&
      headers.has(
        "MACCHN"
      )
    ) {

      return {
        worksheet,
        headers,
      };
    }
  }


  return null;
}


// ======================================================
// READ TEXT
// ======================================================

function readText(
  row:
    ExcelJS.Row,

  headers:
    Map<
      string,
      number
    >,

  header:
    string
): string {

  const columnIndex =
    headers.get(
      header
    );


  if (
    !columnIndex
  ) {

    return "";
  }


  return getCellText(
    row.getCell(
      columnIndex
    )
  );
}


// ======================================================
// YYYYMMDD -> YYYY-MM-DD
// ======================================================

function parseDate(
  value:
    string,

  rowNumber:
    number,

  errors:
    MedicalStaffImportError[]
):
string |
null {

  const text =
    normalizeText(
      value
    );


  if (
    !text
  ) {

    return null;
  }


  let year:
    number;

  let month:
    number;

  let day:
    number;


  // ====================================================
  // 20121130
  // ====================================================

  if (
    /^\d{8}$/.test(
      text
    )
  ) {

    year =
      Number(
        text.substring(
          0,
          4
        )
      );


    month =
      Number(
        text.substring(
          4,
          6
        )
      );


    day =
      Number(
        text.substring(
          6,
          8
        )
      );

  } else {

    // ==================================================
    // YYYY-MM-DD
    // ==================================================

    const match =
      text.match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );


    if (
      !match
    ) {

      errors.push({
        row:
          rowNumber,

        field:
          "NGAYCAP_CCHN",

        message:
          `Ngày cấp CCHN không hợp lệ: "${text}".`,
      });


      return null;
    }


    year =
      Number(
        match[1]
      );


    month =
      Number(
        match[2]
      );


    day =
      Number(
        match[3]
      );
  }


  const date =
    new Date(
      Date.UTC(
        year,
        month -
          1,
        day
      )
    );


  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month -
        1 ||
    date.getUTCDate() !==
      day
  ) {

    errors.push({
      row:
        rowNumber,

      field:
        "NGAYCAP_CCHN",

      message:
        `Ngày cấp CCHN không hợp lệ: "${text}".`,
    });


    return null;
  }


  return (
    `${String(
      year
    ).padStart(
      4,
      "0"
    )}-${String(
      month
    ).padStart(
      2,
      "0"
    )}-${String(
      day
    ).padStart(
      2,
      "0"
    )}`
  );
}


// ======================================================
// DEPARTMENT CODES
//
// "02.03;03.18"
// =>
// ["02.03", "03.18"]
// ======================================================

function parseDepartmentCodes(
  value:
    string
): string[] {

  return [
    ...new Set(
      normalizeText(
        value
      )
        .split(
          ";"
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
// IMPORT
// ======================================================

export async function importMedicalStaffFromExcel(
  buffer:
    Buffer
):
Promise<
  MedicalStaffImportResult
> {

  // ====================================================
  // 1. LOAD EXCEL
  // ====================================================

  const workbook =
    new ExcelJS.Workbook();


  await workbook.xlsx.load(
    buffer as any
  );


  // ====================================================
  // 2. FIND SHEET
  // ====================================================

  const sheetInfo =
    findMedicalStaffWorksheet(
      workbook
    );


  if (
    !sheetInfo
  ) {

    const sheetNames =
      workbook.worksheets
        .map(
          (
            worksheet
          ) =>
            worksheet.name
        )
        .join(
          ", "
        );


    throw new MedicalStaffImportValidationError(
      "Không tìm thấy sheet Danh mục Nhân viên y tế.",
      [
        {
          row:
            1,

          field:
            "SHEET",

          message:
            `Không tìm thấy sheet có MA_BHXH, HO_TEN và MACCHN. Sheet hiện có: ${sheetNames || "(không có)"}.`,
        },
      ]
    );
  }


  const {
    worksheet,
    headers,
  } =
    sheetInfo;


  // ====================================================
  // 3. REQUIRED HEADERS
  // ====================================================

  const requiredHeaders = [
    "MA_KHOA",
    "MA_BHXH",
    "HO_TEN",
    "MACCHN",
  ];


  const missingHeaders =
    requiredHeaders.filter(
      (
        header
      ) =>
        !headers.has(
          header
        )
    );


  if (
    missingHeaders.length >
    0
  ) {

    throw new MedicalStaffImportValidationError(
      "File Excel thiếu cột bắt buộc.",
      missingHeaders.map(
        (
          header
        ) => ({
          row:
            1,

          field:
            header,

          message:
            `Thiếu cột ${header}.`,
        })
      )
    );
  }


  // ====================================================
  // 4. PARSE ALL ROWS
  // ====================================================

  const rows:
    MedicalStaffImportRow[] =
    [];


  const errors:
    MedicalStaffImportError[] =
    [];


  const seenSocialInsuranceCodes =
    new Map<
      string,
      number
    >();


  const seenLicenseNumbers =
    new Map<
      string,
      number
    >();


  let totalRows =
    0;


  for (
    let rowNumber =
      2;

    rowNumber <=
      worksheet.rowCount;

    rowNumber++
  ) {

    const excelRow =
      worksheet.getRow(
        rowNumber
      );


    const fullName =
      readText(
        excelRow,
        headers,
        "HO_TEN"
      );


    const socialInsuranceCode =
      readText(
        excelRow,
        headers,
        "MA_BHXH"
      );


    const licenseNumber =
      readText(
        excelRow,
        headers,
        "MACCHN"
      );


    const departmentText =
      readText(
        excelRow,
        headers,
        "MA_KHOA"
      );


    // ==================================================
    // EMPTY ROW
    // ==================================================

    if (
      !fullName &&
      !socialInsuranceCode &&
      !licenseNumber &&
      !departmentText
    ) {

      continue;
    }


    totalRows++;


    const rowErrorStart =
      errors.length;


    // ==================================================
    // REQUIRED
    // ==================================================

    if (
      !fullName
    ) {

      errors.push({
        row:
          rowNumber,

        field:
          "HO_TEN",

        message:
          "Thiếu họ tên nhân viên y tế.",
      });
    }


    if (
      !socialInsuranceCode
    ) {

      errors.push({
        row:
          rowNumber,

        field:
          "MA_BHXH",

        message:
          "Thiếu MA_BHXH.",
      });
    }


    if (
      !licenseNumber
    ) {

      errors.push({
        row:
          rowNumber,

        field:
          "MACCHN",

        message:
          "Thiếu MACCHN.",
      });
    }


    const departmentCodes =
      parseDepartmentCodes(
        departmentText
      );


    if (
      departmentCodes.length ===
      0
    ) {

      errors.push({
        row:
          rowNumber,

        field:
          "MA_KHOA",

        message:
          "Nhân viên phải có ít nhất một MA_KHOA.",
      });
    }


    // ==================================================
    // DUPLICATE MA_BHXH IN FILE
    // ==================================================

    if (
      socialInsuranceCode
    ) {

      const key =
        normalizeKey(
          socialInsuranceCode
        );


      const previousRow =
        seenSocialInsuranceCodes.get(
          key
        );


      if (
        previousRow !==
        undefined
      ) {

        errors.push({
          row:
            rowNumber,

          field:
            "MA_BHXH",

          message:
            `MA_BHXH "${socialInsuranceCode}" bị trùng với dòng ${previousRow}.`,
        });

      } else {

        seenSocialInsuranceCodes.set(
          key,
          rowNumber
        );
      }
    }


    // ==================================================
    // DUPLICATE MACCHN IN FILE
    // ==================================================

    if (
      licenseNumber
    ) {

      const key =
        normalizeKey(
          licenseNumber
        );


      const previousRow =
        seenLicenseNumbers.get(
          key
        );


      if (
        previousRow !==
        undefined
      ) {

        errors.push({
          row:
            rowNumber,

          field:
            "MACCHN",

          message:
            `MACCHN "${licenseNumber}" bị trùng với dòng ${previousRow}.`,
        });

      } else {

        seenLicenseNumbers.set(
          key,
          rowNumber
        );
      }
    }


    // ==================================================
    // DATE
    // ==================================================

    const licenseIssueDate =
      parseDate(
        readText(
          excelRow,
          headers,
          "NGAYCAP_CCHN"
        ),
        rowNumber,
        errors
      );


    if (
      errors.length >
      rowErrorStart
    ) {

      continue;
    }


    // ==================================================
    // ADD ROW
    // ==================================================

    rows.push({
      rowNumber,

      fullName,

      socialInsuranceCode,

      licenseNumber,

      gender:
        optionalText(
          readText(
            excelRow,
            headers,
            "GIOI_TINH"
          )
        ),

      licenseIssueDate,

      professionalTitle:
        optionalText(
          readText(
            excelRow,
            headers,
            "CHUCDANH_NN"
          )
        ),

      licenseIssuer:
        optionalText(
          readText(
            excelRow,
            headers,
            "NOICAP_CCHN"
          )
        ),

      professionalScope:
        optionalText(
          readText(
            excelRow,
            headers,
            "PHAMVI_CM"
          )
        ),

      registrationTime:
        optionalText(
          readText(
            excelRow,
            headers,
            "THOIGIAN_DK"
          )
        ),

      dailyTime:
        optionalText(
          readText(
            excelRow,
            headers,
            "THOIGIAN_NGAY"
          )
        ),

      weeklyTime:
        optionalText(
          readText(
            excelRow,
            headers,
            "THOIGIAN_TUAN"
          )
        ),

      position:
        optionalText(
          readText(
            excelRow,
            headers,
            "VI_TRI"
          )
        ),

      departmentCodes,
    });
  }


  // ====================================================
  // 5. NO DATA
  // ====================================================

  if (
    totalRows ===
    0
  ) {

    throw new MedicalStaffImportValidationError(
      "File Excel không có dữ liệu nhân viên y tế.",
      [
        {
          row:
            2,

          field:
            "DATA",

          message:
            "Không tìm thấy nhân viên y tế để import.",
        },
      ]
    );
  }


  // ====================================================
  // 6. VALIDATION ERRORS
  // ====================================================

  if (
    errors.length >
    0
  ) {

    throw new MedicalStaffImportValidationError(
      `File Excel có ${errors.length} lỗi. Không có nhân viên nào được import.`,
      errors
    );
  }


  const client =
    await db.connect();


  try {

    await client.query(
      "BEGIN"
    );


    // ==================================================
    // 7. VALIDATE DEPARTMENTS
    // ==================================================

    const allDepartmentCodes =
      [
        ...new Set(
          rows.flatMap(
            (
              row
            ) =>
              row.departmentCodes
          )
        ),
      ];


    const departmentResult =
      await client.query<{
        code:
          string;
      }>(
        `
        SELECT
          code

        FROM
          catalog.departments

        WHERE
          active =
          true
        `
      );


    const departmentMap =
      new Map<
        string,
        string
      >();


    for (
      const department
      of departmentResult.rows
    ) {

      departmentMap.set(
        normalizeKey(
          department.code
        ),
        String(
          department.code
        )
      );
    }


    const missingDepartmentCodes =
      allDepartmentCodes.filter(
        (
          code
        ) =>
          !departmentMap.has(
            normalizeKey(
              code
            )
          )
      );


    if (
      missingDepartmentCodes.length >
      0
    ) {

      const departmentErrors:
        MedicalStaffImportError[] =
        [];


      for (
        const row
        of rows
      ) {

        for (
          const code
          of row.departmentCodes
        ) {

          if (
            missingDepartmentCodes.some(
              (
                missing
              ) =>
                normalizeKey(
                  missing
                ) ===
                normalizeKey(
                  code
                )
            )
          ) {

            departmentErrors.push({
              row:
                row.rowNumber,

              field:
                "MA_KHOA",

              message:
                `Không tìm thấy khoa đang hoạt động "${code}" trong Danh mục Khoa.`,
            });
          }
        }
      }


      throw new MedicalStaffImportValidationError(
        `Có ${missingDepartmentCodes.length} mã khoa chưa tồn tại. Không có nhân viên nào được import.`,
        departmentErrors
      );
    }


    // ==================================================
    // 8. NORMALIZE DEPARTMENT CODE TO DATABASE CODE
    // ==================================================

    for (
      const row
      of rows
    ) {

      row.departmentCodes =
        row.departmentCodes.map(
          (
            code
          ) =>
            departmentMap.get(
              normalizeKey(
                code
              )
            ) ??
            code
        );
    }


    let inserted =
      0;


    let updated =
      0;


    // ==================================================
    // 9. IMPORT EACH STAFF
    // ==================================================

    for (
      const row
      of rows
    ) {

      // =================================================
      // FIND EXISTING
      //
      // Match bằng:
      // 1. MA_BHXH
      // hoặc
      // 2. MACCHN
      // =================================================

      const current =
        await client.query<{
          id:
            string;

          social_insurance_code:
            string |
            null;

          license_number:
            string |
            null;
        }>(
          `
          SELECT
            id,
            social_insurance_code,
            license_number

          FROM
            catalog.medical_staff

          WHERE
            LOWER(
              BTRIM(
                COALESCE(
                  social_insurance_code,
                  ''
                )
              )
            )
            =
            LOWER(
              BTRIM(
                $1
              )
            )

            OR

            LOWER(
              BTRIM(
                COALESCE(
                  license_number,
                  ''
                )
              )
            )
            =
            LOWER(
              BTRIM(
                $2
              )
            )
          `,
          [
            row.socialInsuranceCode,
            row.licenseNumber,
          ]
        );


      // =================================================
      // AMBIGUOUS DATABASE DATA
      // =================================================

      if (
        current.rows.length >
        1
      ) {

        throw new MedicalStaffImportValidationError(
          "Dữ liệu nhân viên hiện tại bị trùng.",
          [
            {
              row:
                row.rowNumber,

              field:
                "MA_BHXH / MACCHN",

              message:
                `Tìm thấy nhiều nhân viên trong database trùng MA_BHXH "${row.socialInsuranceCode}" hoặc MACCHN "${row.licenseNumber}".`,
            },
          ]
        );
      }


      let staffId:
        string;


      if (
        current.rows.length ===
        1
      ) {

        // ===============================================
        // UPDATE
        //
        // Không đụng:
        // note
        // active
        // ===============================================

        staffId =
          String(
            current.rows[0]
              .id
          );


        await client.query(
          `
          UPDATE
            catalog.medical_staff

          SET
            full_name =
              $2,

            social_insurance_code =
              $3,

            license_number =
              $4,

            gender =
              $5,

            license_issue_date =
              $6,

            professional_title =
              $7,

            license_issuer =
              $8,

            professional_scope =
              $9,

            registration_time =
              $10,

            daily_time =
              $11,

            weekly_time =
              $12,

            position =
              $13,

            updated_at =
              NOW()

          WHERE
            id =
            $1::uuid
          `,
          [
            staffId,

            row.fullName,

            row.socialInsuranceCode,

            row.licenseNumber,

            row.gender,

            row.licenseIssueDate,

            row.professionalTitle,

            row.licenseIssuer,

            row.professionalScope,

            row.registrationTime,

            row.dailyTime,

            row.weeklyTime,

            row.position,
          ]
        );


        updated++;

      } else {

        // ===============================================
        // INSERT
        // ===============================================

        const insertedResult =
          await client.query<{
            id:
              string;
          }>(
            `
            INSERT INTO
              catalog.medical_staff
            (
              full_name,
              social_insurance_code,
              license_number,
              gender,
              license_issue_date,
              professional_title,
              license_issuer,
              professional_scope,
              registration_time,
              daily_time,
              weekly_time,
              position,
              note,
              active,
              created_at,
              updated_at
            )

            VALUES
            (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11,
              $12,
              NULL,
              true,
              NOW(),
              NOW()
            )

            RETURNING
              id
            `,
            [
              row.fullName,

              row.socialInsuranceCode,

              row.licenseNumber,

              row.gender,

              row.licenseIssueDate,

              row.professionalTitle,

              row.licenseIssuer,

              row.professionalScope,

              row.registrationTime,

              row.dailyTime,

              row.weeklyTime,

              row.position,
            ]
          );


        staffId =
          String(
            insertedResult.rows[0]
              .id
          );


        inserted++;
      }


      // =================================================
      // 10. DISABLE OLD STAFF ↔ DEPARTMENT LINKS
      // =================================================

      await client.query(
        `
        UPDATE
          catalog.medical_staff_departments

        SET
          active =
            false,

          updated_at =
            NOW()

        WHERE
          staff_id =
          $1::uuid

          AND active =
          true
        `,
        [
          staffId,
        ]
      );


      // =================================================
      // 11. INSERT / REACTIVATE CURRENT DEPARTMENTS
      // =================================================

      await client.query(
        `
        INSERT INTO
          catalog.medical_staff_departments
        (
          staff_id,
          department_code,
          active,
          created_at,
          updated_at
        )

        SELECT
          $1::uuid,
          department_code,
          true,
          NOW(),
          NOW()

        FROM
          unnest(
            $2::varchar[]
          )
          AS department_code

        ON CONFLICT
        (
          staff_id,
          department_code
        )

        DO UPDATE SET
          active =
            true,

          updated_at =
            NOW()
        `,
        [
          staffId,
          row.departmentCodes,
        ]
      );
    }


    // ==================================================
    // 12. COMMIT
    // ==================================================

    await client.query(
      "COMMIT"
    );


    return {
      totalRows,

      inserted,

      updated,

      skipped:
        0,
    };

  } catch (
    error
  ) {

    await client.query(
      "ROLLBACK"
    );


    throw error;

  } finally {

    client.release();
  }
}