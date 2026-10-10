import ExcelJS from "exceljs";

import {
  db,
} from "../../config/database.js";


const ALLOWED_TYPES =
  new Set([
    "CONGKHAM",
    "THUCHIEN_CDHA",
    "KETQUA_CDHA",
    "THUCHIEN_PTTT",
    "THUCHIEN_XN",
    "KETQUAXN",
  ]);


export interface ServiceStaffImportRow {
  row:
    number;

  status:
    "VALID" |
    "ERROR" |
    "DUPLICATE";

  serviceCode:
    string;

  staffCode:
    string;

  activityType:
    string;

  message:
    string;
}


export interface ServiceStaffImportPreview {
  totalRows:
    number;

  valid:
    number;

  invalid:
    number;

  duplicate:
    number;

  rows:
    ServiceStaffImportRow[];
}


export interface ServiceStaffImportResult {
  totalRows:
    number;

  inserted:
    number;

  updated:
    number;

  skipped:
    number;

  invalid:
    number;

  rows:
    ServiceStaffImportRow[];
}


function normalizeText(
  value:
    unknown
) {
  return String(
    value ??
    ""
  ).trim();
}


function normalizeCode(
  value:
    unknown
) {
  return normalizeText(
    value
  ).toUpperCase();
}


function getCellText(
  value:
    ExcelJS.CellValue
) {
  if (
    value ===
    null ||
    value ===
    undefined
  ) {
    return "";
  }


  if (
    typeof value ===
    "string" ||
    typeof value ===
    "number" ||
    typeof value ===
    "boolean"
  ) {
    return String(
      value
    ).trim();
  }


  if (
    value instanceof Date
  ) {
    return String(
      value
    ).trim();
  }


  if (
    typeof value ===
      "object" &&
    "text" in value
  ) {
    return String(
      value.text ??
      ""
    ).trim();
  }


  if (
    typeof value ===
      "object" &&
    "result" in value
  ) {
    return String(
      value.result ??
      ""
    ).trim();
  }


  return String(
    value
  ).trim();
}


async function readExcel(
  buffer:
    Buffer
) {
  const workbook =
    new ExcelJS.Workbook();


  await workbook.xlsx.load(
    buffer as any
  );


  const worksheet =
    workbook.getWorksheet(
      "DVKT - Nhân viên"
    ) ??
    workbook.worksheets[0];


  if (
    !worksheet
  ) {
    throw new Error(
      "File Excel không có sheet dữ liệu."
    );
  }


  const headerService =
    normalizeCode(
      getCellText(
        worksheet.getCell(
          1,
          1
        ).value
      )
    );


  const headerStaff =
    normalizeCode(
      getCellText(
        worksheet.getCell(
          1,
          2
        ).value
      )
    );


  const headerType =
    normalizeCode(
      getCellText(
        worksheet.getCell(
          1,
          3
        ).value
      )
    );


  if (
    headerService !==
      "MA_DVKT" ||
    headerStaff !==
      "MA_BACSI" ||
    headerType !==
      "LOAI"
  ) {
    throw new Error(
      "File Excel không đúng mẫu. Cần 3 cột: MA_DVKT, MA_BACSI, LOAI."
    );
  }


  const rows:
    Array<{
      row:
        number;

      serviceCode:
        string;

      staffCode:
        string;

      activityType:
        string;
    }> =
    [];


  for (
    let rowNumber =
      2;

    rowNumber <=
    worksheet.rowCount;

    rowNumber++
  ) {
    const row =
      worksheet.getRow(
        rowNumber
      );


    const serviceCode =
      normalizeText(
        getCellText(
          row.getCell(
            1
          ).value
        )
      );


    const staffCode =
      normalizeText(
        getCellText(
          row.getCell(
            2
          ).value
        )
      );


    const activityType =
      normalizeCode(
        getCellText(
          row.getCell(
            3
          ).value
        )
      );


    if (
      !serviceCode &&
      !staffCode &&
      !activityType
    ) {
      continue;
    }


    rows.push({
      row:
        rowNumber,

      serviceCode,

      staffCode,

      activityType,
    });
  }


  if (
    rows.length ===
    0
  ) {
    throw new Error(
      "File Excel không có dữ liệu để import."
    );
  }


  return rows;
}


async function validateRows(
  rows:
    Array<{
      row:
        number;

      serviceCode:
        string;

      staffCode:
        string;

      activityType:
        string;
    }>
) {
  const serviceCodes =
    [
      ...new Set(
        rows
          .map(
            (
              item
            ) =>
              item.serviceCode
          )
          .filter(
            Boolean
          )
      ),
    ];


  const staffCodes =
    [
      ...new Set(
        rows
          .map(
            (
              item
            ) =>
              normalizeCode(
                item.staffCode
              )
          )
          .filter(
            Boolean
          )
      ),
    ];


  const serviceResult =
    serviceCodes.length >
    0
      ? await db.query<{
          code:
            string;
        }>(
          `
          SELECT
            code

          FROM
            catalog.services

          WHERE
            active =
            true

            AND code =
            ANY($1::varchar[])
          `,
          [
            serviceCodes,
          ]
        )
      : {
          rows: [],
        };


  const staffResult =
    staffCodes.length >
    0
      ? await db.query<{
          license_number:
            string |
            null;

          social_insurance_code:
            string |
            null;
        }>(
          `
          SELECT
            license_number,
            social_insurance_code

          FROM
            catalog.medical_staff

          WHERE
            active =
            true

            AND (
              UPPER(
                TRIM(
                  COALESCE(
                    license_number,
                    ''
                  )
                )
              ) =
              ANY($1::varchar[])

              OR

              UPPER(
                TRIM(
                  COALESCE(
                    social_insurance_code,
                    ''
                  )
                )
              ) =
              ANY($1::varchar[])
            )
          `,
          [
            staffCodes,
          ]
        )
      : {
          rows: [],
        };


  const existingResult =
    await db.query<{
      service_code:
        string;

      staff_code:
        string;

      activity_type:
        string;
    }>(
      `
      SELECT
        service_code,
        staff_code,
        activity_type

      FROM
        catalog.service_staff_rules
      `
    );


  const validServices =
    new Set(
      serviceResult.rows.map(
        (
          item
        ) =>
          item.code
      )
    );


  const validStaffCodes =
    new Set<string>();


  for (
    const staff
    of staffResult.rows
  ) {
    const license =
      normalizeCode(
        staff.license_number
      );


    const insurance =
      normalizeCode(
        staff.social_insurance_code
      );


    if (
      license
    ) {
      validStaffCodes.add(
        license
      );
    }


    if (
      insurance
    ) {
      validStaffCodes.add(
        insurance
      );
    }
  }


  const existingKeys =
    new Set(
      existingResult.rows.map(
        (
          item
        ) =>
          [
            normalizeCode(
              item.service_code
            ),

            normalizeCode(
              item.staff_code
            ),

            normalizeCode(
              item.activity_type
            ),
          ].join(
            "::"
          )
      )
    );


  const fileKeys =
    new Set<string>();


  const result:
    ServiceStaffImportRow[] =
    [];


  for (
    const item
    of rows
  ) {
    const serviceCode =
      normalizeText(
        item.serviceCode
      );


    const staffCode =
      normalizeCode(
        item.staffCode
      );


    const activityType =
      normalizeCode(
        item.activityType
      );


    let status:
      ServiceStaffImportRow["status"] =
      "VALID";


    let message =
      "Hợp lệ";


    if (
      !serviceCode
    ) {
      status =
        "ERROR";

      message =
        "Thiếu MA_DVKT.";
    } else if (
      !staffCode
    ) {
      status =
        "ERROR";

      message =
        "Thiếu MA_BACSI.";
    } else if (
      !activityType
    ) {
      status =
        "ERROR";

      message =
        "Thiếu LOAI.";
    } else if (
      !ALLOWED_TYPES.has(
        activityType
      )
    ) {
      status =
        "ERROR";

      message =
        `LOAI không hợp lệ: ${activityType}.`;
    } else if (
      !validServices.has(
        serviceCode
      )
    ) {
      status =
        "ERROR";

      message =
        `Không tìm thấy DVKT ${serviceCode} trong danh mục.`;
    } else if (
      !validStaffCodes.has(
        staffCode
      )
    ) {
      status =
        "ERROR";

      message =
        `Không tìm thấy nhân viên ${staffCode} trong danh mục.`;
    }


    const key =
      [
        normalizeCode(
          serviceCode
        ),

        staffCode,

        activityType,
      ].join(
        "::"
      );


    if (
      status ===
        "VALID" &&
      fileKeys.has(
        key
      )
    ) {
      status =
        "DUPLICATE";

      message =
        "Trùng dữ liệu trong file Excel.";
    }


    if (
      status ===
      "VALID"
    ) {
      fileKeys.add(
        key
      );


      if (
        existingKeys.has(
          key
        )
      ) {
        message =
          "Đã tồn tại, khi import sẽ cập nhật.";
      }
    }


    result.push({
      row:
        item.row,

      status,

      serviceCode,

      staffCode,

      activityType,

      message,
    });
  }


  return {
    rows:
      result,

    existingKeys,
  };
}


export async function previewServiceStaffImport(
  buffer:
    Buffer
):
  Promise<ServiceStaffImportPreview> {

  const parsed =
    await readExcel(
      buffer
    );


  const validated =
    await validateRows(
      parsed
    );


  const valid =
    validated.rows.filter(
      (
        item
      ) =>
        item.status ===
        "VALID"
    ).length;


  const invalid =
    validated.rows.filter(
      (
        item
      ) =>
        item.status ===
        "ERROR"
    ).length;


  const duplicate =
    validated.rows.filter(
      (
        item
      ) =>
        item.status ===
        "DUPLICATE"
    ).length;


  return {
    totalRows:
      validated.rows.length,

    valid,

    invalid,

    duplicate,

    rows:
      validated.rows,
  };
}


export async function importServiceStaffExcel(
  buffer:
    Buffer
):
  Promise<ServiceStaffImportResult> {

  const parsed =
    await readExcel(
      buffer
    );


  const validated =
    await validateRows(
      parsed
    );


  const validRows =
    validated.rows.filter(
      (
        item
      ) =>
        item.status ===
        "VALID"
    );


  const invalid =
    validated.rows.filter(
      (
        item
      ) =>
        item.status ===
        "ERROR"
    ).length;


  const duplicate =
    validated.rows.filter(
      (
        item
      ) =>
        item.status ===
        "DUPLICATE"
    ).length;


  const client =
    await db.connect();


  let inserted =
    0;


  let updated =
    0;


  try {
    await client.query(
      "BEGIN"
    );


    for (
      const item
      of validRows
    ) {
      const existing =
        await client.query<{
          id:
            string;
        }>(
          `
          SELECT
            id

          FROM
            catalog.service_staff_rules

          WHERE
            UPPER(
              TRIM(
                service_code
              )
            ) =
            UPPER(
              TRIM(
                $1
              )
            )

            AND UPPER(
              TRIM(
                staff_code
              )
            ) =
            UPPER(
              TRIM(
                $2
              )
            )

            AND UPPER(
              TRIM(
                activity_type
              )
            ) =
            UPPER(
              TRIM(
                $3
              )
            )

          LIMIT 1
          `,
          [
            item.serviceCode,
            item.staffCode,
            item.activityType,
          ]
        );


      if (
        existing.rowCount &&
        existing.rowCount >
        0
      ) {
        await client.query(
          `
          UPDATE
            catalog.service_staff_rules

          SET
            staff_code =
              $2,

            activity_type =
              $3,

            allowed =
              true,

            active =
              true,

            updated_at =
              NOW()

          WHERE
            id =
            $1
          `,
          [
            existing.rows[0]
              .id,

            item.staffCode,

            item.activityType,
          ]
        );


        updated++;
      } else {
        await client.query(
          `
          INSERT INTO
            catalog.service_staff_rules
          (
            service_code,
            staff_code,
            specialty_code,
            activity_type,
            allowed,
            active,
            note,
            created_at,
            updated_at
          )

          VALUES
          (
            $1,
            $2,
            NULL,
            $3,
            true,
            true,
            NULL,
            NOW(),
            NOW()
          )
          `,
          [
            item.serviceCode,
            item.staffCode,
            item.activityType,
          ]
        );


        inserted++;
      }
    }


    await client.query(
      "COMMIT"
    );

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


  return {
    totalRows:
      validated.rows.length,

    inserted,

    updated,

    skipped:
      duplicate,

    invalid,

    rows:
      validated.rows,
  };
}


export async function createServiceStaffTemplate() {
  const workbook =
    new ExcelJS.Workbook();


  const worksheet =
    workbook.addWorksheet(
      "DVKT - Nhân viên"
    );


  worksheet.columns = [
    {
      header:
        "MA_DVKT",

      key:
        "serviceCode",

      width:
        22,
    },

    {
      header:
        "MA_BACSI",

      key:
        "staffCode",

      width:
        26,
    },

    {
      header:
        "LOAI",

      key:
        "activityType",

      width:
        26,
    },
  ];


  worksheet.addRow({
    serviceCode:
      "21.0014.1778",

    staffCode:
      "007768/BD-CCHN",

    activityType:
      "THUCHIEN_CDHA",
  });


  worksheet.getRow(
    1
  ).font = {
    bold:
      true,
  };


  worksheet.views = [
    {
      state:
        "frozen",

      ySplit:
        1,
    },
  ];


  const buffer =
    await workbook.xlsx
      .writeBuffer();


  return Buffer.from(
    buffer
  );
}