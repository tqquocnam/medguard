import ExcelJS from "exceljs";

import {
  db,
} from "../../config/database.js";


// ======================================================
// EXCEL HEADERS
//
// File iT Generic.xlsx thực tế có:
// DEN_NGAY
// DENNGAY
// MA_THUOC
// TEN_HOAT_CHAT
// TEN_THUOC
// ...
//
// DEN_NGAY và DENNGAY không dùng để lưu catalog.drugs.
// ======================================================

const DRUG_HEADERS = [
  "MA_THUOC",
  "TEN_HOAT_CHAT",
  "TEN_THUOC",
  "DON_VI_TINH",
  "HAM_LUONG",
  "DUONG_DUNG",
  "MA_DUONG_DUNG",
  "DANG_BAO_CHE",
  "SO_DANG_KY",
  "SO_LUONG",
  "DON_GIA",
  "DON_GIA_BH",
  "QUY_CACH",
  "NHA_SX",
  "NUOC_SX",
  "NHA_THAU",
  "TT_THAU",
  "LOAI_THUOC",
  "TEN_KHOA_HOC",
  "NGUON_GOC",
  "PP_CHEBIEN",
  "MA_DL_NHAP",
  "MA_DL_CB",
  "TLHH_CB",
  "TLHH_BQ",
  "TCCL",
] as const;


type DrugHeader =
  typeof DRUG_HEADERS[number];


// ======================================================
// TYPES
// ======================================================

interface DrugImportRow {
  rowNumber:
    number;

  code:
    string;

  activeIngredient:
    string |
    null;

  name:
    string;

  unit:
    string |
    null;

  strength:
    string |
    null;

  route:
    string |
    null;

  routeCode:
    string |
    null;

  dosageForm:
    string |
    null;

  registrationNumber:
    string |
    null;

  quantity:
    number |
    null;

  unitPrice:
    number;

  insuranceUnitPrice:
    number |
    null;

  packaging:
    string |
    null;

  manufacturer:
    string |
    null;

  country:
    string |
    null;

  contractor:
    string |
    null;

  tenderInfo:
    string |
    null;

  drugType:
    string |
    null;

  scientificName:
    string |
    null;

  origin:
    string |
    null;

  processingMethod:
    string |
    null;

  importedMaterialCode:
    string |
    null;

  processedMaterialCode:
    string |
    null;

  processingLossRate:
    number |
    null;

  preservationLossRate:
    number |
    null;

  qualityStandard:
    string |
    null;
}


export interface DrugImportError {
  row:
    number;

  field:
    string;

  message:
    string;
}


export interface DrugImportResult {
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

export class DrugImportValidationError
  extends Error {

  errors:
    DrugImportError[];


  constructor(
    message:
      string,

    errors:
      DrugImportError[]
  ) {

    super(
      message
    );


    this.name =
      "DrugImportValidationError";


    this.errors =
      errors;
  }
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
// OPTIONAL TEXT
// ======================================================

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


// ======================================================
// GET CELL TEXT
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
// AUTO FIND DRUG SHEET
//
// KHÔNG bắt buộc sheet phải tên "Thuoc".
//
// File thực tế:
// Generic 324
//
// Chỉ cần có:
// MA_THUOC
// TEN_THUOC
// ======================================================

function findDrugWorksheet(
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


    const hasDrugCode =
      headerIndexes.has(
        "MA_THUOC"
      );


    const hasDrugName =
      headerIndexes.has(
        "TEN_THUOC"
      );


    if (
      hasDrugCode &&
      hasDrugName
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
// READ TEXT BY HEADER
// ======================================================

function readText(
  row:
    ExcelJS.Row,

  headerIndexes:
    Map<
      string,
      number
    >,

  header:
    DrugHeader
): string {

  const columnIndex =
    headerIndexes.get(
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
// NORMALIZE NUMBER TEXT
// ======================================================

function normalizeNumberText(
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


  // ====================================================
  // Trường hợp:
  // 1.234,56
  // => 1234.56
  //
  // 1,234.56
  // => 1234.56
  // ====================================================

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


  // ====================================================
  // 123,45
  // => 123.45
  // ====================================================

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


// ======================================================
// READ NUMBER
// ======================================================

function readNumber(
  row:
    ExcelJS.Row,

  headerIndexes:
    Map<
      string,
      number
    >,

  header:
    DrugHeader,

  rowNumber:
    number,

  errors:
    DrugImportError[]
):
number |
null {

  const columnIndex =
    headerIndexes.get(
      header
    );


  if (
    !columnIndex
  ) {

    return null;
  }


  const cell =
    row.getCell(
      columnIndex
    );


  const rawValue =
    cell.value;


  // Excel lưu trực tiếp dạng number.

  if (
    typeof rawValue ===
    "number"
  ) {

    if (
      !Number.isFinite(
        rawValue
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


    return rawValue;
  }


  const rawText =
    getCellText(
      cell
    );


  if (
    !rawText
  ) {

    return null;
  }


  const normalized =
    normalizeNumberText(
      rawText
    );


  const parsed =
    Number(
      normalized
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
        `${header} không phải số hợp lệ: "${rawText}".`,
    });


    return null;
  }


  return parsed;
}


// ======================================================
// VALIDATE NON NEGATIVE
// ======================================================

function validateNonNegative(
  value:
    number |
    null,

  field:
    string,

  rowNumber:
    number,

  errors:
    DrugImportError[]
) {

  if (
    value !==
      null &&
    value <
      0
  ) {

    errors.push({
      row:
        rowNumber,

      field,

      message:
        `${field} không được nhỏ hơn 0.`,
    });
  }
}


// ======================================================
// IMPORT
// ======================================================

export async function importDrugsFromExcel(
  buffer:
    Buffer
):
Promise<
  DrugImportResult
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
  // 2. AUTO DETECT SHEET
  // ====================================================

  const sheetInfo =
    findDrugWorksheet(
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


    throw new DrugImportValidationError(
      "Không tìm thấy sheet Danh mục Thuốc.",
      [
        {
          row:
            1,

          field:
            "SHEET",

          message:
            `Không tìm thấy sheet có cột MA_THUOC và TEN_THUOC. Sheet trong file: ${sheetNames || "(không có)"}.`,
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
  // 3. KIỂM TRA CỘT BẮT BUỘC
  // ====================================================

  const requiredHeaders = [
    "MA_THUOC",
    "TEN_THUOC",
  ];


  const missingHeaders =
    requiredHeaders.filter(
      (
        header
      ) =>
        !headerIndexes.has(
          header
        )
    );


  if (
    missingHeaders.length >
    0
  ) {

    throw new DrugImportValidationError(
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
  // 4. READ ROWS
  // ====================================================

  const rows:
    DrugImportRow[] =
    [];


  const errors:
    DrugImportError[] =
    [];


  // Các mã MA_THUOC lặp được chấp nhận nếu khác sản phẩm.
  // Không loại trùng chỉ theo mã thuốc.

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


    // ==================================================
    // XÁC ĐỊNH DÒNG CÓ DỮ LIỆU THUỐC
    // ==================================================

    const code =
      readText(
        excelRow,
        headerIndexes,
        "MA_THUOC"
      );


    const name =
      readText(
        excelRow,
        headerIndexes,
        "TEN_THUOC"
      );


    const hasAnyDrugData =
      DRUG_HEADERS.some(
        (
          header
        ) =>
          readText(
            excelRow,
            headerIndexes,
            header
          ) !==
          ""
      );


    if (
      !hasAnyDrugData
    ) {

      continue;
    }


    totalRows++;


    // ==================================================
    // REQUIRED VALUES
    // ==================================================

    if (
      !code
    ) {

      errors.push({
        row:
          rowNumber,

        field:
          "MA_THUOC",

        message:
          "Thiếu MA_THUOC.",
      });
    }


    if (
      !name
    ) {

      errors.push({
        row:
          rowNumber,

        field:
          "TEN_THUOC",

        message:
          "Thiếu TEN_THUOC.",
      });
    }


    if (
      !code ||
      !name
    ) {

      continue;
    }


    // ==================================================
    // NUMBERS
    // ==================================================

    const errorCountBefore =
      errors.length;


    const quantity =
      readNumber(
        excelRow,
        headerIndexes,
        "SO_LUONG",
        rowNumber,
        errors
      );


    const rawUnitPrice =
      readNumber(
        excelRow,
        headerIndexes,
        "DON_GIA",
        rowNumber,
        errors
      );


    const unitPrice =
      rawUnitPrice ??
      0;


    const insuranceUnitPrice =
      readNumber(
        excelRow,
        headerIndexes,
        "DON_GIA_BH",
        rowNumber,
        errors
      );


    const processingLossRate =
      readNumber(
        excelRow,
        headerIndexes,
        "TLHH_CB",
        rowNumber,
        errors
      );


    const preservationLossRate =
      readNumber(
        excelRow,
        headerIndexes,
        "TLHH_BQ",
        rowNumber,
        errors
      );


    validateNonNegative(
      quantity,
      "SO_LUONG",
      rowNumber,
      errors
    );


    validateNonNegative(
      unitPrice,
      "DON_GIA",
      rowNumber,
      errors
    );


    validateNonNegative(
      insuranceUnitPrice,
      "DON_GIA_BH",
      rowNumber,
      errors
    );


    validateNonNegative(
      processingLossRate,
      "TLHH_CB",
      rowNumber,
      errors
    );


    validateNonNegative(
      preservationLossRate,
      "TLHH_BQ",
      rowNumber,
      errors
    );


    // Có lỗi số ở dòng này thì không thêm row,
    // nhưng tiếp tục đọc hết file để trả tất cả lỗi.

    if (
      errors.length >
      errorCountBefore
    ) {

      continue;
    }


    // ==================================================
    // VALID ROW
    // ==================================================

    rows.push({
      rowNumber,

      code,

      activeIngredient:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "TEN_HOAT_CHAT"
          )
        ),

      name,

      unit:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "DON_VI_TINH"
          )
        ),

      strength:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "HAM_LUONG"
          )
        ),

      route:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "DUONG_DUNG"
          )
        ),

      routeCode:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "MA_DUONG_DUNG"
          )
        ),

      dosageForm:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "DANG_BAO_CHE"
          )
        ),

      registrationNumber:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "SO_DANG_KY"
          )
        ),

      quantity,

      unitPrice,

      insuranceUnitPrice,

      packaging:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "QUY_CACH"
          )
        ),

      manufacturer:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "NHA_SX"
          )
        ),

      country:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "NUOC_SX"
          )
        ),

      contractor:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "NHA_THAU"
          )
        ),

      tenderInfo:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "TT_THAU"
          )
        ),

      drugType:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "LOAI_THUOC"
          )
        ),

      scientificName:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "TEN_KHOA_HOC"
          )
        ),

      origin:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "NGUON_GOC"
          )
        ),

      processingMethod:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "PP_CHEBIEN"
          )
        ),

      importedMaterialCode:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "MA_DL_NHAP"
          )
        ),

      processedMaterialCode:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "MA_DL_CB"
          )
        ),

      processingLossRate,

      preservationLossRate,

      qualityStandard:
        optionalText(
          readText(
            excelRow,
            headerIndexes,
            "TCCL"
          )
        ),
    });
  }


  // ====================================================
  // 5. EMPTY FILE
  // ====================================================

  if (
    totalRows ===
    0
  ) {

    throw new DrugImportValidationError(
      "File Excel không có dữ liệu thuốc.",
      [
        {
          row:
            2,

          field:
            "DATA",

          message:
            "Không tìm thấy dòng dữ liệu thuốc.",
        },
      ]
    );
  }


  // ====================================================
  // 6. ALL OR NOTHING
  //
  // Chỉ cần 1 lỗi thật => không ghi DB.
  // ====================================================

  if (
    errors.length >
    0
  ) {

    throw new DrugImportValidationError(
      `File Excel có ${errors.length} lỗi. Không có dữ liệu nào được import.`,
      errors
    );
  }


  if (
    rows.length ===
    0
  ) {

    throw new DrugImportValidationError(
      "Không có mã thuốc hợp lệ để import.",
      [
        {
          row:
            2,

          field:
            "DATA",

          message:
            "Không có mã thuốc hợp lệ để import.",
        },
      ]
    );
  }


  // ====================================================
  // TRANSACTION - REQUIRE PRIMARY KEY (id)
  // ====================================================
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Khoá đồng thời các đợt import, tránh ghi trùng do 2 import song song.
    await client.query("SELECT pg_advisory_xact_lock(91234, 2026)");

    // Không được import khi code vẫn là PRIMARY KEY.
    const pkResult = await client.query<{ column_name: string }>(`
      SELECT a.attname AS column_name
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'catalog.drugs'::regclass
        AND c.contype = 'p'
    `);
    if (
      pkResult.rows.length !== 1 ||
      pkResult.rows[0]?.column_name !== "id"
    ) {
      throw new Error(
        "Chưa chuyển PRIMARY KEY catalog.drugs sang id. Không thể import thuốc trùng mã an toàn."
      );
    }

    let inserted = 0;
    let updated = 0;

    // Matching theo code + tên thuốc + hoạt chất + số đăng ký.
    // Tên khác => hai thuốc khác nhau, kể cả cùng MA_THUOC và hoạt chất.
    // Số đăng ký khác => cũng coi là hai bản ghi riêng.
    for (const row of rows) {
      const values: unknown[] = [
        row.code,
        row.activeIngredient,
        row.name,
        row.unit,
        row.strength,
        row.route,
        row.routeCode,
        row.dosageForm,
        row.registrationNumber,
        row.quantity,
        row.unitPrice,
        row.insuranceUnitPrice,
        row.packaging,
        row.manufacturer,
        row.country,
        row.contractor,
        row.tenderInfo,
        row.drugType,
        row.scientificName,
        row.origin,
        row.processingMethod,
        row.importedMaterialCode,
        row.processedMaterialCode,
        row.processingLossRate,
        row.preservationLossRate,
        row.qualityStandard
      ];

      const existing = await client.query<{ id: string }>(
        `
        SELECT id
        FROM catalog.drugs
        WHERE LOWER(BTRIM(code)) = LOWER(BTRIM($1::text))
          AND LOWER(BTRIM(name)) = LOWER(BTRIM($2::text))
          AND LOWER(BTRIM(COALESCE(active_ingredient, '')))
              = LOWER(BTRIM(COALESCE($3::text, '')))
          AND LOWER(BTRIM(COALESCE(registration_number, '')))
              = LOWER(BTRIM(COALESCE($4::text, '')))
        ORDER BY id
        LIMIT 1
        FOR UPDATE
        `,
        [row.code, row.name, row.activeIngredient, row.registrationNumber]
      );

      if (existing.rows[0]) {
        await client.query(
          `
          UPDATE catalog.drugs
          SET code = $1,
              active_ingredient = $2,
              name = $3,
              unit = $4,
              strength = $5,
              route = $6,
              route_code = $7,
              dosage_form = $8,
              registration_number = $9,
              quantity = $10,
              unit_price = $11,
              insurance_unit_price = $12,
              packaging = $13,
              manufacturer = $14,
              country = $15,
              contractor = $16,
              tender_info = $17,
              drug_type = $18,
              scientific_name = $19,
              origin = $20,
              processing_method = $21,
              imported_material_code = $22,
              processed_material_code = $23,
              processing_loss_rate = $24,
              preservation_loss_rate = $25,
              quality_standard = $26,
              updated_at = NOW()
          WHERE id = $27::uuid
          `,
          [...values, existing.rows[0].id]
        );
        updated++;
      } else {
        await client.query(
          `
          INSERT INTO catalog.drugs (
            code,
            active_ingredient,
            name,
            unit,
            strength,
            route,
            route_code,
            dosage_form,
            registration_number,
            quantity,
            unit_price,
            insurance_unit_price,
            packaging,
            manufacturer,
            country,
            contractor,
            tender_info,
            drug_type,
            scientific_name,
            origin,
            processing_method,
            imported_material_code,
            processed_material_code,
            processing_loss_rate,
            preservation_loss_rate,
            quality_standard
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
          `,
          values
        );
        inserted++;
      }
    }

    await client.query("COMMIT");
    return { totalRows, inserted, updated, skipped: 0 };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
