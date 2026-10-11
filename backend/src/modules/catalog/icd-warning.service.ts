import {
  db,
} from "../../config/database.js";


// ======================================================
// TYPES
// ======================================================

export interface GetIcdWarningsParams {
  page?: number;

  pageSize?: number;

  icdCode?: string;

  errorCode?: string;

  diseaseName?: string;
}


export interface IcdWarningInput {
  icdCode: string;

  errorCode: string;

  diseaseName?:
    | string
    | null;

  errorMessage: string;

  active?: boolean;

  note?:
    | string
    | null;
}


// ======================================================
// HELPERS
// ======================================================

function normalizeRequiredCode(
  value:
    unknown
) {

  return String(
    value ??
    ""
  )
    .trim()
    .toUpperCase();
}


function normalizeRequiredText(
  value:
    unknown
) {

  return String(
    value ??
    ""
  ).trim();
}


function normalizeOptionalText(
  value:
    unknown
) {

  const text =
    String(
      value ??
      ""
    ).trim();


  return text ||
    null;
}


// ======================================================
// GET ICD WARNING LIST
// ======================================================

export async function getIcdWarnings(
  params:
    GetIcdWarningsParams
) {

  const page =
    Math.max(
      Number(
        params.page ??
        1
      ),
      1
    );


  const pageSize =
    Math.min(
      Math.max(
        Number(
          params.pageSize ??
          10
        ),
        1
      ),
      100
    );


  const conditions:
    string[] =
    [];


  const values:
    unknown[] =
    [];


  // ====================================================
  // FILTER ICD
  // ====================================================

  if (
    params.icdCode
      ?.trim()
  ) {

    values.push(
      `%${params.icdCode.trim()}%`
    );


    conditions.push(
      `icd_code ILIKE $${values.length}`
    );
  }


  // ====================================================
  // FILTER ERROR CODE
  // ====================================================

  if (
    params.errorCode
      ?.trim()
  ) {

    values.push(
      `%${params.errorCode.trim()}%`
    );


    conditions.push(
      `error_code ILIKE $${values.length}`
    );
  }


  // ====================================================
  // FILTER DISEASE NAME
  // ====================================================

  if (
    params.diseaseName
      ?.trim()
  ) {

    values.push(
      `%${params.diseaseName.trim()}%`
    );


    conditions.push(
      `disease_name ILIKE $${values.length}`
    );
  }


  const whereSql =
    conditions.length >
    0
      ? `WHERE ${conditions.join(
          " AND "
        )}`
      : "";


  // ====================================================
  // COUNT
  // ====================================================

  const countResult =
    await db.query(
      `
      SELECT
        COUNT(*)::int AS total

      FROM
        catalog.icd_warning_rules

      ${whereSql}
      `,
      values
    );


  const total =
    Number(
      countResult.rows[0]
        ?.total ??
      0
    );


  // ====================================================
  // PAGINATION
  // ====================================================

  const offset =
    (
      page -
      1
    ) *
    pageSize;


  const limitIndex =
    values.length +
    1;


  const offsetIndex =
    values.length +
    2;


  const dataValues = [
    ...values,
    pageSize,
    offset,
  ];


  // ====================================================
  // DATA
  // ====================================================

  const result =
    await db.query(
      `
      SELECT
        id,

        icd_code AS "icdCode",

        error_code AS "errorCode",

        disease_name AS "diseaseName",

        error_message AS "errorMessage",

        active,

        note,

        created_at AS "createdAt",

        updated_at AS "updatedAt"

      FROM
        catalog.icd_warning_rules

      ${whereSql}

      ORDER BY
        icd_code ASC,
        error_code ASC

      LIMIT
        $${limitIndex}

      OFFSET
        $${offsetIndex}
      `,
      dataValues
    );


  return {
    items:
      result.rows,

    total,

    page,

    pageSize,
  };
}


// ======================================================
// CREATE ICD WARNING
// ======================================================

export async function createIcdWarning(
  input:
    IcdWarningInput
) {

  const icdCode =
    normalizeRequiredCode(
      input.icdCode
    );


  const errorCode =
    normalizeRequiredCode(
      input.errorCode
    );


  const diseaseName =
    normalizeOptionalText(
      input.diseaseName
    );


  const errorMessage =
    normalizeRequiredText(
      input.errorMessage
    );


  const note =
    normalizeOptionalText(
      input.note
    );


  const active =
    input.active ??
    true;


  // ====================================================
  // VALIDATE
  // ====================================================

  if (
    !icdCode
  ) {

    throw new Error(
      "Mã ICD không được để trống."
    );
  }


  if (
    !errorCode
  ) {

    throw new Error(
      "Mã lỗi không được để trống."
    );
  }


  if (
    !errorMessage
  ) {

    throw new Error(
      "Nội dung cảnh báo không được để trống."
    );
  }


  // ====================================================
  // CHECK DUPLICATE
  // ====================================================

  const duplicateResult =
    await db.query(
      `
      SELECT
        id

      FROM
        catalog.icd_warning_rules

      WHERE
        UPPER(
          TRIM(icd_code)
        ) =
        UPPER(
          TRIM($1)
        )

        AND

        UPPER(
          TRIM(error_code)
        ) =
        UPPER(
          TRIM($2)
        )

      LIMIT 1
      `,
      [
        icdCode,
        errorCode,
      ]
    );


  if (
    duplicateResult.rows.length >
    0
  ) {

    throw new Error(
      `ICD ${icdCode} với mã lỗi ${errorCode} đã tồn tại.`
    );
  }


  // ====================================================
  // INSERT
  // ====================================================

  const result =
    await db.query(
      `
      INSERT INTO
        catalog.icd_warning_rules
        (
          icd_code,
          error_code,
          disease_name,
          error_message,
          active,
          note,
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
          NOW(),
          NOW()
        )

      RETURNING
        id,

        icd_code AS "icdCode",

        error_code AS "errorCode",

        disease_name AS "diseaseName",

        error_message AS "errorMessage",

        active,

        note,

        created_at AS "createdAt",

        updated_at AS "updatedAt"
      `,
      [
        icdCode,
        errorCode,
        diseaseName,
        errorMessage,
        active,
        note,
      ]
    );


  return result.rows[0];
}


// ======================================================
// UPDATE ICD WARNING
// ======================================================

export async function updateIcdWarning(
  id:
    string,

  input:
    IcdWarningInput
) {

  const warningId =
    String(
      id ??
      ""
    ).trim();


  const icdCode =
    normalizeRequiredCode(
      input.icdCode
    );


  const errorCode =
    normalizeRequiredCode(
      input.errorCode
    );


  const diseaseName =
    normalizeOptionalText(
      input.diseaseName
    );


  const errorMessage =
    normalizeRequiredText(
      input.errorMessage
    );


  const note =
    normalizeOptionalText(
      input.note
    );


  // ====================================================
  // VALIDATE
  // ====================================================

  if (
    !warningId
  ) {

    throw new Error(
      "Thiếu ID ICD cảnh báo."
    );
  }


  if (
    !icdCode
  ) {

    throw new Error(
      "Mã ICD không được để trống."
    );
  }


  if (
    !errorCode
  ) {

    throw new Error(
      "Mã lỗi không được để trống."
    );
  }


  if (
    !errorMessage
  ) {

    throw new Error(
      "Nội dung cảnh báo không được để trống."
    );
  }


  // ====================================================
  // CHECK EXISTS
  // ====================================================

  const existsResult =
    await db.query(
      `
      SELECT
        id

      FROM
        catalog.icd_warning_rules

      WHERE
        id = $1

      LIMIT 1
      `,
      [
        warningId,
      ]
    );


  if (
    existsResult.rows.length ===
    0
  ) {

    throw new Error(
      "Không tìm thấy ICD cảnh báo."
    );
  }


  // ====================================================
  // CHECK DUPLICATE
  // ====================================================

  const duplicateResult =
    await db.query(
      `
      SELECT
        id

      FROM
        catalog.icd_warning_rules

      WHERE
        id <> $1

        AND

        UPPER(
          TRIM(icd_code)
        ) =
        UPPER(
          TRIM($2)
        )

        AND

        UPPER(
          TRIM(error_code)
        ) =
        UPPER(
          TRIM($3)
        )

      LIMIT 1
      `,
      [
        warningId,
        icdCode,
        errorCode,
      ]
    );


  if (
    duplicateResult.rows.length >
    0
  ) {

    throw new Error(
      `ICD ${icdCode} với mã lỗi ${errorCode} đã tồn tại.`
    );
  }


  // ====================================================
  // UPDATE
  //
  // Nếu active không truyền lên thì giữ trạng thái cũ.
  // ====================================================

  const active =
    typeof input.active ===
    "boolean"
      ? input.active
      : null;


  const result =
    await db.query(
      `
      UPDATE
        catalog.icd_warning_rules

      SET
        icd_code =
          $2,

        error_code =
          $3,

        disease_name =
          $4,

        error_message =
          $5,

        active =
          COALESCE(
            $6::boolean,
            active
          ),

        note =
          $7,

        updated_at =
          NOW()

      WHERE
        id = $1

      RETURNING
        id,

        icd_code AS "icdCode",

        error_code AS "errorCode",

        disease_name AS "diseaseName",

        error_message AS "errorMessage",

        active,

        note,

        created_at AS "createdAt",

        updated_at AS "updatedAt"
      `,
      [
        warningId,
        icdCode,
        errorCode,
        diseaseName,
        errorMessage,
        active,
        note,
      ]
    );


  return result.rows[0];
}


// ======================================================
// TOGGLE ACTIVE
// ======================================================

export async function toggleIcdWarningActive(
  id:
    string
) {

  const warningId =
    String(
      id ??
      ""
    ).trim();


  if (
    !warningId
  ) {

    throw new Error(
      "Thiếu ID ICD cảnh báo."
    );
  }


  const result =
    await db.query(
      `
      UPDATE
        catalog.icd_warning_rules

      SET
        active =
          NOT active,

        updated_at =
          NOW()

      WHERE
        id = $1

      RETURNING
        id,

        icd_code AS "icdCode",

        error_code AS "errorCode",

        disease_name AS "diseaseName",

        error_message AS "errorMessage",

        active,

        note,

        created_at AS "createdAt",

        updated_at AS "updatedAt"
      `,
      [
        warningId,
      ]
    );


  if (
    result.rows.length ===
    0
  ) {

    throw new Error(
      "Không tìm thấy ICD cảnh báo."
    );
  }


  return result.rows[0];
}