import ExcelJS from "exceljs";

import {
  db,
} from "../../config/database.js";


// ======================================================
// TYPES
// ======================================================

interface IcdWarningImportRow {
  rowNumber: number;

  icdCode: string;

  errorCode: string;

  diseaseName:
    | string
    | null;

  errorMessage: string;

  active: boolean;

  note:
    | string
    | null;
}


export interface IcdWarningImportError {
  row: number;

  field: string;

  message: string;
}


export interface IcdWarningImportResult {
  totalRows: number;

  inserted: number;

  updated: number;

  skipped: number;
}


// ======================================================
// VALIDATION ERROR
// ======================================================

export class IcdWarningImportValidationError
  extends Error {

  errors:
    IcdWarningImportError[];


  constructor(
    message: string,

    errors:
      IcdWarningImportError[]
  ) {

    super(
      message
    );

    this.name =
      "IcdWarningImportValidationError";

    this.errors =
      errors;
  }
}


// ======================================================
// NORMALIZE
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


function normalizeCode(
  value:
    unknown
): string {

  return normalizeText(
    value
  ).toUpperCase();
}


// ======================================================
// EXCEL CELL
// ======================================================

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
// NORMALIZE HEADER
//
// Hỗ trợ:
// ICD
// MA_LOI
// Mã lỗi
// TEN_BENH
// Tên bệnh
// NOI_DUNG_LOI
// Nội dung lỗi
// TRANG_THAI
// Trạng thái
// GHI_CHU
// Ghi chú
// ======================================================

function normalizeHeader(
  value:
    string
): string {

  return value
    .replace(
      /^\uFEFF/,
      ""
    )
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /đ/gi,
      "d"
    )
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    );
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
      normalizeHeader(
        getCellText(
          headerRow.getCell(
            columnIndex
          )
        )
      );


    if (
      !header
    ) {

      continue;
    }


    result.set(
      header,
      columnIndex
    );
  }


  return result;
}


// ======================================================
// READ HEADER
// ======================================================

function readText(
  row:
    ExcelJS.Row,

  headerIndexes:
    Map<
      string,
      number
    >,

  ...headers:
    string[]
): string {

  for (
    const header
    of headers
  ) {

    const columnIndex =
      headerIndexes.get(
        normalizeHeader(
          header
        )
      );


    if (
      !columnIndex
    ) {

      continue;
    }


    const value =
      getCellText(
        row.getCell(
          columnIndex
        )
      );


    if (
      value
    ) {

      return value;
    }
  }


  return "";
}


// ======================================================
// FIND SHEET
// ======================================================

function findWorksheet(
  workbook:
    ExcelJS.Workbook
):
{
  worksheet:
    ExcelJS.Worksheet;

  headerIndexes:
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

    const headerIndexes =
      buildHeaderMap(
        worksheet
      );


    if (
      headerIndexes.has(
        "ICD"
      ) &&
      headerIndexes.has(
        "MA_LOI"
      )
    ) {

      return {
        worksheet,
        headerIndexes,
      };
    }
  }


  return null;
}


// ======================================================
// ACTIVE
// ======================================================

function parseActive(
  value:
    string
): boolean {

  const text =
    normalizeHeader(
      value
    );


  if (
    !text
  ) {

    return true;
  }


  return ![
    "0",
    "FALSE",
    "INACTIVE",
    "KHONG_HOAT_DONG",
    "NGUNG_HOAT_DONG",
  ].includes(
    text
  );
}


// ======================================================
// PARSE ERROR
//
// Hỗ trợ 2 kiểu:
//
// MA_LOI = ERR-26
// NOI_DUNG_LOI = MÃ KHÔNG...
//
// hoặc:
//
// MA_LOI = ERR-26: MÃ KHÔNG...
// ======================================================

function parseError(
  rawError:
    string,

  rawMessage:
    string,

  note:
    string
) {

  let errorCode =
    normalizeCode(
      rawError
    );

  let errorMessage =
    normalizeText(
      rawMessage
    );


  const match =
    rawError.match(
      /^\s*(ERR-\d+)\s*[:\-]\s*(.+)$/i
    );


  if (
    match
  ) {

    errorCode =
      normalizeCode(
        match[1]
      );


    if (
      !errorMessage
    ) {

      errorMessage =
        normalizeText(
          match[2]
        );
    }
  }


  if (
    !errorMessage &&
    note
  ) {

    errorMessage =
      normalizeText(
        note
      );
  }


  return {
    errorCode,
    errorMessage,
  };
}


// ======================================================
// IMPORT ICD WARNING EXCEL
// ======================================================

export async function importIcdWarningsFromExcel(
  buffer:
    Buffer
):
Promise<
  IcdWarningImportResult
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
    findWorksheet(
      workbook
    );


  if (
    !sheetInfo
  ) {

    throw new IcdWarningImportValidationError(
      "Không tìm thấy sheet ICD cảnh báo.",
      [
        {
          row:
            1,

          field:
            "SHEET",

          message:
            "Không tìm thấy sheet có cột ICD và MA_LOI.",
        },
      ]
    );
  }


  const {
    worksheet,
    headerIndexes,
  } =
    sheetInfo;


  // ====================================================
  // 3. READ ROWS
  // ====================================================

  const rows:
    IcdWarningImportRow[] =
    [];


  const errors:
    IcdWarningImportError[] =
    [];


  const seen =
    new Set<
      string
    >();


  let totalRows =
    0;


  let skipped =
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


    const icdCode =
      normalizeCode(
        readText(
          excelRow,
          headerIndexes,
          "ICD"
        )
      );


    const rawError =
      readText(
        excelRow,
        headerIndexes,
        "MA_LOI",
        "MÃ LỖI"
      );


    const diseaseName =
      readText(
        excelRow,
        headerIndexes,
        "TEN_BENH",
        "TÊN BỆNH"
      );


    const rawMessage =
      readText(
        excelRow,
        headerIndexes,
        "NOI_DUNG_LOI",
        "NỘI DUNG LỖI"
      );


    const status =
      readText(
        excelRow,
        headerIndexes,
        "TRANG_THAI",
        "TRẠNG THÁI"
      );


    const note =
      readText(
        excelRow,
        headerIndexes,
        "GHI_CHU",
        "GHI CHÚ"
      );


    const hasAnyData =
      Boolean(
        icdCode ||
        rawError ||
        diseaseName ||
        rawMessage ||
        status ||
        note
      );


    if (
      !hasAnyData
    ) {

      continue;
    }


    totalRows++;


    if (
      !icdCode
    ) {

      errors.push({
        row:
          rowNumber,

        field:
          "ICD",

        message:
          "Thiếu mã ICD.",
      });
    }


    if (
      !rawError
    ) {

      errors.push({
        row:
          rowNumber,

        field:
          "MA_LOI",

        message:
          "Thiếu mã lỗi.",
      });
    }


    if (
      !icdCode ||
      !rawError
    ) {

      continue;
    }


    const {
      errorCode,
      errorMessage,
    } =
      parseError(
        rawError,
        rawMessage,
        note
      );


    if (
      !errorMessage
    ) {

      errors.push({
        row:
          rowNumber,

        field:
          "NOI_DUNG_LOI",

        message:
          "Thiếu nội dung cảnh báo.",
      });

      continue;
    }


    const duplicateKey =
      `${icdCode}|${errorCode}`;


    if (
      seen.has(
        duplicateKey
      )
    ) {

      skipped++;

      continue;
    }


    seen.add(
      duplicateKey
    );


    rows.push({
      rowNumber,

      icdCode,

      errorCode,

      diseaseName:
        optionalText(
          diseaseName
        ),

      errorMessage,

      active:
        parseActive(
          status
        ),

      note:
        optionalText(
          note
        ),
    });
  }


  // ====================================================
  // 4. VALIDATE
  // ====================================================

  if (
    totalRows ===
    0
  ) {

    throw new IcdWarningImportValidationError(
      "File Excel không có dữ liệu ICD cảnh báo.",
      [
        {
          row:
            2,

          field:
            "DATA",

          message:
            "Không tìm thấy dòng dữ liệu ICD cảnh báo.",
        },
      ]
    );
  }


  if (
    errors.length >
    0
  ) {

    throw new IcdWarningImportValidationError(
      `File Excel có ${errors.length} lỗi. Không có dữ liệu nào được import.`,
      errors
    );
  }


  // ====================================================
  // 5. DB TRANSACTION
  // ====================================================

  const client =
    await db.connect();


  try {

    await client.query(
      "BEGIN"
    );


    let inserted =
      0;


    let updated =
      0;


    for (
      const row
      of rows
    ) {

      // Không phụ thuộc UNIQUE constraint.
      // Tìm và update trước.

      const updateResult =
        await client.query(
          `
          UPDATE
            catalog.icd_warning_rules

          SET
            disease_name = $3,

            error_message = $4,

            active = $5,

            note = $6,

            updated_at = NOW()

          WHERE
            UPPER(
              BTRIM(
                icd_code
              )
            ) = $1

            AND

            UPPER(
              BTRIM(
                error_code
              )
            ) = $2

          RETURNING
            id
          `,
          [
            row.icdCode,
            row.errorCode,
            row.diseaseName,
            row.errorMessage,
            row.active,
            row.note,
          ]
        );


      if (
        updateResult.rowCount &&
        updateResult.rowCount >
          0
      ) {

        updated++;

        continue;
      }


      await client.query(
        `
        INSERT INTO
          catalog.icd_warning_rules
        (
          icd_code,
          error_code,
          disease_name,
          error_message,
          active,
          note
        )

        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6
        )
        `,
        [
          row.icdCode,
          row.errorCode,
          row.diseaseName,
          row.errorMessage,
          row.active,
          row.note,
        ]
      );


      inserted++;
    }


    await client.query(
      "COMMIT"
    );


    return {
      totalRows,

      inserted,

      updated,

      skipped,
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