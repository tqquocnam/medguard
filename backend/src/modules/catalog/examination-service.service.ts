import {
  db,
} from "../../config/database.js";


// ======================================================
// TYPES
// ======================================================

export interface ListExaminationServicesParams {
  code?: string;

  name?: string;

  active?: boolean;

  limit: number;

  offset: number;
}


export interface ExaminationServiceInput {
  code?: string;

  name?: string;

  unitPrice?:
    number |
    null;

  note?:
    string |
    null;

  active?:
    boolean;
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


function normalizeOptionalText(
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


function mapExaminationServiceRow(
  row:
    any
) {

  return {
    id:
      String(
        row.id
      ),

    code:
      String(
        row.code
      ),

    name:
      String(
        row.name
      ),

    unitPrice:
      Number(
        row.unit_price ??
        0
      ),

    note:
      row.note !==
        null &&
      row.note !==
        undefined
        ? String(
            row.note
          )
        : null,

    active:
      Boolean(
        row.active
      ),

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


// ======================================================
// VALIDATE CREATE
// ======================================================

function validateCreateInput(
  data:
    ExaminationServiceInput
) {

  const code =
    normalizeText(
      data.code
    );


  const name =
    normalizeText(
      data.name
    );


  if (
    !code
  ) {

    throw new Error(
      "Vui lòng nhập mã công khám."
    );
  }


  if (
    !name
  ) {

    throw new Error(
      "Vui lòng nhập tên công khám."
    );
  }


  const unitPrice =
    Number(
      data.unitPrice ??
      0
    );


  if (
    !Number.isFinite(
      unitPrice
    ) ||
    unitPrice <
      0
  ) {

    throw new Error(
      "Đơn giá công khám không hợp lệ."
    );
  }


  return {
    code,

    name,

    unitPrice,

    note:
      normalizeOptionalText(
        data.note
      ),

    active:
      data.active ??
      true,
  };
}


// ======================================================
// VALIDATE UPDATE
// ======================================================

function validateUpdateInput(
  data:
    ExaminationServiceInput
) {

  const name =
    normalizeText(
      data.name
    );


  if (
    !name
  ) {

    throw new Error(
      "Vui lòng nhập tên công khám."
    );
  }


  const unitPrice =
    Number(
      data.unitPrice ??
      0
    );


  if (
    !Number.isFinite(
      unitPrice
    ) ||
    unitPrice <
      0
  ) {

    throw new Error(
      "Đơn giá công khám không hợp lệ."
    );
  }


  return {
    name,

    unitPrice,

    note:
      normalizeOptionalText(
        data.note
      ),

    active:
      data.active ??
      true,
  };
}


// ======================================================
// LIST
// ======================================================

export async function listExaminationServices(
  params:
    ListExaminationServicesParams
) {

  const {
    code,
    name,
    active,
    limit,
    offset,
  } =
    params;


  const conditions:
    string[] =
    [];


  const values:
    unknown[] =
    [];


  // ====================================================
  // CODE
  // ====================================================

  if (
    code
  ) {

    values.push(
      `%${normalizeText(
        code
      )}%`
    );


    conditions.push(
      `e.code ILIKE $${values.length}`
    );
  }


  // ====================================================
  // NAME
  // ====================================================

  if (
    name
  ) {

    values.push(
      `%${normalizeText(
        name
      )}%`
    );


    conditions.push(
      `e.name ILIKE $${values.length}`
    );
  }


  // ====================================================
  // ACTIVE
  // ====================================================

  if (
    active !==
    undefined
  ) {

    values.push(
      active
    );


    conditions.push(
      `e.active = $${values.length}`
    );
  }


  const whereSql =
    conditions.length >
    0
      ? `WHERE ${conditions.join(
          " AND "
        )}`
      : "";


  const limitIndex =
    values.length +
    1;


  const offsetIndex =
    values.length +
    2;


  // ====================================================
  // DATA
  // ====================================================

  const result =
    await db.query(
      `
      SELECT
        e.id,
        e.code,
        e.name,
        e.unit_price,
        e.note,
        e.active,
        e.created_at,
        e.updated_at

      FROM
        catalog.examination_services e

      ${whereSql}

      ORDER BY
        e.name ASC,
        e.code ASC

      LIMIT
        $${limitIndex}

      OFFSET
        $${offsetIndex}
      `,
      [
        ...values,
        limit,
        offset,
      ]
    );


  // ====================================================
  // TOTAL
  // ====================================================

  const countResult =
    await db.query(
      `
      SELECT
        COUNT(*)::integer
          AS total

      FROM
        catalog.examination_services e

      ${whereSql}
      `,
      values
    );


  return {
    items:
      result.rows.map(
        (
          row
        ) =>
          mapExaminationServiceRow(
            row
          )
      ),

    total:
      Number(
        countResult
          .rows[0]
          ?.total ??
        0
      ),
  };
}


// ======================================================
// GET ONE
// ======================================================

export async function getExaminationService(
  code:
    string
) {

  const normalizedCode =
    normalizeText(
      code
    );


  if (
    !normalizedCode
  ) {

    throw new Error(
      "Thiếu mã công khám."
    );
  }


  const result =
    await db.query(
      `
      SELECT
        e.id,
        e.code,
        e.name,
        e.unit_price,
        e.note,
        e.active,
        e.created_at,
        e.updated_at

      FROM
        catalog.examination_services e

      WHERE
        e.code =
        $1

      LIMIT 1
      `,
      [
        normalizedCode,
      ]
    );


  if (
    result.rowCount ===
    0
  ) {

    return null;
  }


  return mapExaminationServiceRow(
    result.rows[0]
  );
}


// ======================================================
// CREATE
// ======================================================

export async function createExaminationService(
  data:
    ExaminationServiceInput
) {

  const validated =
    validateCreateInput(
      data
    );


  // ====================================================
  // DUPLICATE CODE
  //
  // Kiểm tra không phân biệt hoa thường.
  // ====================================================

  const duplicate =
    await db.query(
      `
      SELECT
        code

      FROM
        catalog.examination_services

      WHERE
        LOWER(
          BTRIM(
            code
          )
        )
        =
        LOWER(
          BTRIM(
            $1
          )
        )

      LIMIT 1
      `,
      [
        validated.code,
      ]
    );


  if (
    duplicate.rowCount &&
    duplicate.rowCount >
      0
  ) {

    throw new Error(
      `Mã công khám "${validated.code}" đã tồn tại.`
    );
  }


  await db.query(
    `
    INSERT INTO
      catalog.examination_services
    (
      code,
      name,
      unit_price,
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
      NOW(),
      NOW()
    )
    `,
    [
      validated.code,
      validated.name,
      validated.unitPrice,
      validated.note,
      validated.active,
    ]
  );


  return await getExaminationService(
    validated.code
  );
}


// ======================================================
// UPDATE
//
// Mã công khám không đổi khi cập nhật.
// ======================================================

export async function updateExaminationService(
  code:
    string,

  data:
    ExaminationServiceInput
) {

  const normalizedCode =
    normalizeText(
      code
    );


  if (
    !normalizedCode
  ) {

    throw new Error(
      "Thiếu mã công khám cần cập nhật."
    );
  }


  const validated =
    validateUpdateInput(
      data
    );


  const result =
    await db.query(
      `
      UPDATE
        catalog.examination_services

      SET
        name =
          $2,

        unit_price =
          $3,

        note =
          $4,

        active =
          $5,

        updated_at =
          NOW()

      WHERE
        code =
          $1

      RETURNING
        code
      `,
      [
        normalizedCode,
        validated.name,
        validated.unitPrice,
        validated.note,
        validated.active,
      ]
    );


  if (
    result.rowCount ===
    0
  ) {

    throw new Error(
      "Không tìm thấy công khám."
    );
  }


  return await getExaminationService(
    normalizedCode
  );
}


// ======================================================
// DISABLE
//
// Không DELETE vật lý.
// active = false
// ======================================================

export async function deleteExaminationService(
  code:
    string
) {

  const normalizedCode =
    normalizeText(
      code
    );


  if (
    !normalizedCode
  ) {

    throw new Error(
      "Thiếu mã công khám."
    );
  }


  const result =
    await db.query(
      `
      UPDATE
        catalog.examination_services

      SET
        active =
          false,

        updated_at =
          NOW()

      WHERE
        code =
          $1

      RETURNING
        code
      `,
      [
        normalizedCode,
      ]
    );


  if (
    result.rowCount ===
    0
  ) {

    throw new Error(
      "Không tìm thấy công khám."
    );
  }


  return true;
}