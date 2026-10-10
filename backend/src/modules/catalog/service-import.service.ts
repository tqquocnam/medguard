import ExcelJS from "exceljs";

import {
  db,
} from "../../config/database.js";


// ======================================================
// TYPES
// ======================================================

interface ServiceImportRow {
  rowNumber:
    number;

  code:
    string;

  name:
    string;

  unitPrice:
    number;

  decisionNo:
    string |
    null;
}


export interface ServiceImportError {
  row:
    number;

  field:
    string;

  message:
    string;
}


export interface ServiceImportResult {
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

export class ServiceImportValidationError
  extends Error {

  errors:
    ServiceImportError[];


  constructor(
    message:
      string,

    errors:
      ServiceImportError[]
  ) {

    super(
      message
    );


    this.name =
      "ServiceImportValidationError";


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


function normalizeCode(
  value:
    unknown
): string {

  return normalizeText(
    value
  ).toLowerCase();
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
// HEADER MAP
// ======================================================

function buildHeaderMap(
  worksheet:
    ExcelJS.Worksheet
):
Map<
  string,
  number
> {

  const map =
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

      map.set(
        header,
        columnIndex
      );
    }
  }


  return map;
}


// ======================================================
// AUTO FIND SHEET
//
// Không bắt buộc sheet phải tên gì.
//
// Chỉ cần có:
// MA_TUONG_DUONG
// và 1 trong 2 tên DVKT.
// ======================================================

function findServiceWorksheet(
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


    const hasCode =
      headers.has(
        "MA_TUONG_DUONG"
      );


    const hasName =
      headers.has(
        "TEN_DVKT_PHEDUYET"
      ) ||
      headers.has(
        "TEN_DVKT_GIA"
      );


    if (
      hasCode &&
      hasName
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
// PARSE NUMBER
// ======================================================

function parseNumberText(
  value:
    string
): string {

  let text =
    value
      .trim()
      .replace(
        /\s+/g,
        ""
      );


  if (
    !text
  ) {

    return "";
  }


  if (
    text.includes(
      "."
    ) &&
    text.includes(
      ","
    )
  ) {

    const lastDot =
      text.lastIndexOf(
        "."
      );


    const lastComma =
      text.lastIndexOf(
        ","
      );


    if (
      lastComma >
      lastDot
    ) {

      text =
        text
          .replace(
            /\./g,
            ""
          )
          .replace(
            /,/g,
            "."
          );

    } else {

      text =
        text.replace(
          /,/g,
          ""
        );
    }


    return text;
  }


  if (
    text.includes(
      ","
    )
  ) {

    text =
      text.replace(
        /,/g,
        "."
      );
  }


  return text;
}


function readRequiredNumber(
  row:
    ExcelJS.Row,

  headers:
    Map<
      string,
      number
    >,

  header:
    string,

  rowNumber:
    number,

  errors:
    ServiceImportError[]
):
number |
null {

  const columnIndex =
    headers.get(
      header
    );


  if (
    !columnIndex
  ) {

    errors.push({
      row:
        1,

      field:
        header,

      message:
        `Thiếu cột ${header}.`,
    });


    return null;
  }


  const cell =
    row.getCell(
      columnIndex
    );


  if (
    typeof cell.value ===
    "number"
  ) {

    if (
      !Number.isFinite(
        cell.value
      )
    ) {

      errors.push({
        row:
          rowNumber,

        field:
          header,

        message:
          `${header} không phải số hợp lệ.`,
      });


      return null;
    }


    return cell.value;
  }


  const text =
    getCellText(
      cell
    );


  if (
    !text
  ) {

    errors.push({
      row:
        rowNumber,

      field:
        header,

      message:
        `Thiếu ${header}.`,
    });


    return null;
  }


  const parsed =
    Number(
      parseNumberText(
        text
      )
    );


  if (
    !Number.isFinite(
      parsed
    )
  ) {

    errors.push({
      row:
        rowNumber,

      field:
        header,

      message:
        `${header} không phải số hợp lệ: "${text}".`,
    });


    return null;
  }


  return parsed;
}


// ======================================================
// IMPORT DVKT
// ======================================================

export async function importServicesFromExcel(
  buffer:
    Buffer
):
Promise<
  ServiceImportResult
> {

  // ====================================================
  // 1. LOAD FILE
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
    findServiceWorksheet(
      workbook
    );


  if (
    !sheetInfo
  ) {

    const sheetNames =
      workbook.worksheets
        .map(
          (
            item
          ) =>
            item.name
        )
        .join(
          ", "
        );


    throw new ServiceImportValidationError(
      "Không tìm thấy sheet Danh mục DVKT.",
      [
        {
          row:
            1,

          field:
            "SHEET",

          message:
            `Không tìm thấy sheet có MA_TUONG_DUONG và TEN_DVKT_PHEDUYET/TEN_DVKT_GIA. Sheet hiện có: ${sheetNames || "(không có)"}.`,
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
    "MA_TUONG_DUONG",
    "DON_GIA",
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
    !headers.has(
      "TEN_DVKT_PHEDUYET"
    ) &&
    !headers.has(
      "TEN_DVKT_GIA"
    )
  ) {

    missingHeaders.push(
      "TEN_DVKT_PHEDUYET / TEN_DVKT_GIA"
    );
  }


  if (
    missingHeaders.length >
    0
  ) {

    throw new ServiceImportValidationError(
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
  // 4. READ ALL ROWS
  // ====================================================

  const rows:
    ServiceImportRow[] =
    [];


  const errors:
    ServiceImportError[] =
    [];


  const seenCodes =
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


    const code =
      readText(
        excelRow,
        headers,
        "MA_TUONG_DUONG"
      );


    const approvedName =
      readText(
        excelRow,
        headers,
        "TEN_DVKT_PHEDUYET"
      );


    const priceName =
      readText(
        excelRow,
        headers,
        "TEN_DVKT_GIA"
      );


    const name =
      approvedName ||
      priceName;


    const decisionNo =
      optionalText(
        readText(
          excelRow,
          headers,
          "QUYET_DINH"
        )
      );


    // ==================================================
    // EMPTY ROW
    // ==================================================

    if (
      !code &&
      !name &&
      !readText(
        excelRow,
        headers,
        "DON_GIA"
      )
    ) {

      continue;
    }


    totalRows++;


    // ==================================================
    // REQUIRED CODE
    // ==================================================

    if (
      !code
    ) {

      errors.push({
        row:
          rowNumber,

        field:
          "MA_TUONG_DUONG",

        message:
          "Thiếu MA_TUONG_DUONG.",
      });
    }


    // ==================================================
    // REQUIRED NAME
    // ==================================================

    if (
      !name
    ) {

      errors.push({
        row:
          rowNumber,

        field:
          "TEN_DVKT_PHEDUYET",

        message:
          "Thiếu tên DVKT.",
      });
    }


    // ==================================================
    // DUPLICATE CODE
    // ==================================================

    if (
      code
    ) {

      const normalizedCode =
        normalizeCode(
          code
        );


      const previousRow =
        seenCodes.get(
          normalizedCode
        );


      if (
        previousRow !==
        undefined
      ) {

        errors.push({
          row:
            rowNumber,

          field:
            "MA_TUONG_DUONG",

          message:
            `Mã DVKT "${code}" bị trùng với dòng ${previousRow}.`,
        });

      } else {

        seenCodes.set(
          normalizedCode,
          rowNumber
        );
      }
    }


    // ==================================================
    // PRICE
    // ==================================================

    const errorCountBefore =
      errors.length;


    const unitPrice =
      readRequiredNumber(
        excelRow,
        headers,
        "DON_GIA",
        rowNumber,
        errors
      );


    if (
      unitPrice !==
        null &&
      unitPrice <
        0
    ) {

      errors.push({
        row:
          rowNumber,

        field:
          "DON_GIA",

        message:
          "Đơn giá không được nhỏ hơn 0.",
      });
    }


    if (
      !code ||
      !name ||
      unitPrice ===
        null ||
      errors.length >
        errorCountBefore
    ) {

      continue;
    }


    rows.push({
      rowNumber,

      code,

      name,

      unitPrice,

      decisionNo,
    });
  }


  // ====================================================
  // 5. EMPTY FILE
  // ====================================================

  if (
    totalRows ===
    0
  ) {

    throw new ServiceImportValidationError(
      "File Excel không có dữ liệu DVKT.",
      [
        {
          row:
            2,

          field:
            "DATA",

          message:
            "Không tìm thấy dòng DVKT nào.",
        },
      ]
    );
  }


  // ====================================================
  // 6. ALL OR NOTHING
  // ====================================================

  if (
    errors.length >
    0
  ) {

    throw new ServiceImportValidationError(
      `File Excel có ${errors.length} lỗi. Không có DVKT nào được import.`,
      errors
    );
  }


  if (
    rows.length ===
    0
  ) {

    throw new ServiceImportValidationError(
      "Không có DVKT hợp lệ để import.",
      [
        {
          row:
            2,

          field:
            "DATA",

          message:
            "Không có DVKT hợp lệ.",
        },
      ]
    );
  }


  // ====================================================
  // 7. DATABASE
  // ====================================================

  const client =
    await db.connect();


  try {

    await client.query(
      "BEGIN"
    );


    // ==================================================
    // EXISTING SERVICES
    // ==================================================

    const normalizedCodes =
      rows.map(
        (
          row
        ) =>
          normalizeCode(
            row.code
          )
      );


    const existingResult =
      await client.query<{
        code:
          string;
      }>(
        `
        SELECT
          code

        FROM
          catalog.services

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
          normalizedCodes,
        ]
      );


    const existingMap =
      new Map<
        string,
        string
      >();


    for (
      const existing
      of existingResult.rows
    ) {

      existingMap.set(
        normalizeCode(
          existing.code
        ),
        existing.code
      );
    }


    let inserted =
      0;


    let updated =
      0;


    for (
      const row
      of rows
    ) {

      const existingCode =
        existingMap.get(
          normalizeCode(
            row.code
          )
        );


      if (
        existingCode
      ) {

        // Giữ đúng code hiện tại trong database.

        row.code =
          existingCode;


        updated++;

      } else {

        inserted++;
      }
    }


    // ==================================================
    // 8. BATCH UPSERT
    //
    // Import chỉ cập nhật:
    // name
    // unit_price
    // decision_no
    //
    // KHÔNG đụng:
    // group_code
    // requires_result
    // requires_machine
    // service_machines
    // allow_simultaneous
    // min/max duration
    // next_execution_days
    // note
    // active
    // ==================================================

    const batchSize =
      300;


    const columnCount =
      13;


    for (
      let start =
        0;

      start <
        rows.length;

      start +=
        batchSize
    ) {

      const batch =
        rows.slice(
          start,
          start +
          batchSize
        );


      const placeholders =
        batch
          .map(
            (
              _,
              rowIndex
            ) => {

              const base =
                rowIndex *
                columnCount;


              return (
                `(${Array.from(
                  {
                    length:
                      columnCount,
                  },
                  (
                    __,
                    columnIndex
                  ) =>
                    `$${base + columnIndex + 1}`
                ).join(", ")})`
              );
            }
          )
          .join(
            ",\n"
          );


      const values:
        unknown[] =
        [];


      for (
        const row
        of batch
      ) {

        values.push(
          row.code,          // 1
          row.name,          // 2
          null,              // group_code
          row.unitPrice,     // unit_price
          row.decisionNo,    // decision_no
          false,             // requires_result
          false,             // requires_machine
          false,             // allow_simultaneous
          0,                 // min_duration_minutes
          0,                 // max_duration_minutes
          0,                 // next_execution_days
          null,              // note
          true               // active
        );
      }


      await client.query(
        `
        INSERT INTO
          catalog.services
        (
          code,
          name,
          group_code,
          unit_price,
          decision_no,
          requires_result,
          requires_machine,
          allow_simultaneous,
          min_duration_minutes,
          max_duration_minutes,
          next_execution_days,
          note,
          active
        )

        VALUES
          ${placeholders}

        ON CONFLICT
          (code)

        DO UPDATE SET

          name =
            EXCLUDED.name,

          unit_price =
            EXCLUDED.unit_price,

          decision_no =
            EXCLUDED.decision_no,

          updated_at =
            NOW()
        `,
        values
      );
    }


    // ==================================================
    // 9. COMMIT
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