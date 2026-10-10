import type {
  PoolClient,
} from "pg";


type PrepareImportMeta = {
  fileName: string;

  facilityCode: string;

  // Ngày lập/xuất file XML
  createdDate: string;

  // Ngày dữ liệu khám bệnh thực tế
  // Ví dụ hồ sơ khám ngày 04/10/2026
  dataDate: string;

  declaredTotal: number;
};


// ======================================================
// NORMALIZE DATE
//
// Hỗ trợ:
// 20261004
// 202610040840
// 2026-10-04
// 2026-10-04 08:40:00
// 04/10/2026
//
// Kết quả:
// 2026-10-04
// ======================================================

function normalizeDate(
  value: unknown
): string {

  const raw =
    String(
      value ?? ""
    ).trim();


  if (!raw) {
    return "";
  }


  // ==========================================
  // dd/MM/yyyy
  // ==========================================

  const dmy =
    raw.match(
      /^(\d{2})\/(\d{2})\/(\d{4})/
    );


  if (dmy) {

    return (
      `${dmy[3]}-` +
      `${dmy[2]}-` +
      `${dmy[1]}`
    );
  }


  // ==========================================
  // yyyy-MM-dd...
  // ==========================================

  const iso =
    raw.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );


  if (iso) {

    return (
      `${iso[1]}-` +
      `${iso[2]}-` +
      `${iso[3]}`
    );
  }


  // ==========================================
  // yyyyMMdd...
  // ==========================================

  const digits =
    raw.replace(
      /\D/g,
      ""
    );


  if (
    digits.length >= 8
  ) {

    return (
      `${digits.slice(0, 4)}-` +
      `${digits.slice(4, 6)}-` +
      `${digits.slice(6, 8)}`
    );
  }


  return raw;
}


// ======================================================
// LOCK
//
// QUAN TRỌNG:
//
// Khóa theo:
// facilityCode + dataDate
//
// KHÔNG khóa theo createdDate.
//
// Ví dụ:
// 96230 + 2026-10-04
//
// dù file được xuất ngày 06/10, 07/10, 08/10...
// vẫn chỉ xử lý một snapshot ngày 04/10.
// ======================================================

async function lockImportKey(
  client: PoolClient,

  facilityCode: string,

  dataDate: string
) {

  const lockKey =
    `${facilityCode}:${dataDate}`;


  await client.query(
    `
    SELECT
      pg_advisory_xact_lock(
        hashtext($1)
      )
    `,
    [
      lockKey,
    ]
  );
}


// ======================================================
// XÓA TOÀN BỘ DATA CỦA 1 BATCH
// ======================================================

async function clearExistingBatchData(
  client: PoolClient,

  batchId: string
): Promise<number> {

  // ====================================================
  // RULE RESULTS
  // ====================================================

  await client.query(
    `
    DELETE FROM
      validation.rule_results

    WHERE
      medical_case_id IN (
        SELECT
          id

        FROM
          core.medical_cases

        WHERE
          import_batch_id = $1
      )
    `,
    [
      batchId,
    ]
  );


  // ====================================================
  // CASE ERRORS
  //
  // Xóa trước events/cases.
  // ====================================================

  await client.query(
    `
    DELETE FROM
      validation.case_errors

    WHERE

      medical_case_id IN (
        SELECT
          id

        FROM
          core.medical_cases

        WHERE
          import_batch_id = $1
      )

      OR

      conflict_case_id IN (
        SELECT
          id

        FROM
          core.medical_cases

        WHERE
          import_batch_id = $1
      )

      OR

      source_event_id IN (
        SELECT
          e.id

        FROM
          core.medical_events e

        INNER JOIN
          core.medical_cases c
          ON
            c.id =
            e.medical_case_id

        WHERE
          c.import_batch_id = $1
      )

      OR

      conflict_event_id IN (
        SELECT
          e.id

        FROM
          core.medical_events e

        INNER JOIN
          core.medical_cases c
          ON
            c.id =
            e.medical_case_id

        WHERE
          c.import_batch_id = $1
      )
    `,
    [
      batchId,
    ]
  );


  // ====================================================
  // XML FILES
  // ====================================================

  await client.query(
    `
    DELETE FROM
      core.medical_xml_files

    WHERE
      medical_case_id IN (
        SELECT
          id

        FROM
          core.medical_cases

        WHERE
          import_batch_id = $1
      )
    `,
    [
      batchId,
    ]
  );


  // ====================================================
  // MEDICAL EVENTS
  // ====================================================

  await client.query(
    `
    DELETE FROM
      core.medical_events

    WHERE
      medical_case_id IN (
        SELECT
          id

        FROM
          core.medical_cases

        WHERE
          import_batch_id = $1
      )
    `,
    [
      batchId,
    ]
  );


  // ====================================================
  // MEDICAL CASES
  // ====================================================

  const deleted =
    await client.query(
      `
      DELETE FROM
        core.medical_cases

      WHERE
        import_batch_id = $1

      RETURNING id
      `,
      [
        batchId,
      ]
    );


  return (
    deleted.rowCount ??
    0
  );
}


// ======================================================
// PREPARE IMPORT
//
// QUY TẮC CHÍNH:
//
// facility_code + data_date
//
// chỉ được có 1 snapshot.
//
// Ví dụ:
//
// 96230 + 04/10/2026
//
// Import lần 1:
// 231 hồ sơ
//
// Import lần 2:
// xóa 231 cũ
// import 231 mới
//
// Kết quả:
// vẫn 231.
//
// Nếu DB trước đây đã có:
// 231 x 4 = 924
//
// Hàm này sẽ:
// - tìm cả 4 batch
// - xóa hồ sơ của cả 4
// - xóa 3 batch dư
// - giữ lại 1 batch
// - import bộ mới
// ======================================================

export async function prepareImportBatch(
  client: PoolClient,

  meta: PrepareImportMeta
) {

  // ====================================================
  // META
  // ====================================================

  const fileName =
    String(
      meta.fileName ??
      ""
    ).trim();


  const facilityCode =
    String(
      meta.facilityCode ??
      ""
    ).trim();


  const createdDate =
    normalizeDate(
      meta.createdDate
    );


  const dataDate =
    normalizeDate(
      meta.dataDate
    );


  const declaredTotal =
    Number(
      meta.declaredTotal ??
      0
    );


  // ====================================================
  // VALIDATE
  // ====================================================

  if (!fileName) {

    throw new Error(
      "Thiếu tên file XML."
    );
  }


  if (!facilityCode) {

    throw new Error(
      "Thiếu mã CSKCB."
    );
  }


  if (!createdDate) {

    throw new Error(
      "Thiếu ngày lập dữ liệu XML."
    );
  }


  if (!dataDate) {

    throw new Error(
      "Không xác định được ngày dữ liệu KCB."
    );
  }


  // ====================================================
  // LOCK
  //
  // PHẢI khóa theo dataDate.
  // ====================================================

  await lockImportKey(
    client,
    facilityCode,
    dataDate
  );


  // ====================================================
  // TÌM TẤT CẢ BATCH CŨ CÙNG NGÀY DỮ LIỆU
  //
  // Có 2 cách nhận diện:
  //
  // 1. data_date của batch
  //
  // 2. batch cũ chưa có data_date nhưng bên trong
  //    medical_cases có ngay_vao đúng ngày đó.
  //
  // Dùng EXISTS để tránh duplicate row do JOIN.
  // ====================================================

  const existingResult =
    await client.query(
      `
      SELECT
        ib.id,
        ib.file_name,
        ib.facility_code,
        ib.created_date,
        ib.data_date,
        ib.declared_total,
        ib.actual_total,
        ib.status,
        ib.started_at,
        ib.finished_at

      FROM
        core.import_batches ib

      WHERE
        TRIM(
          ib.facility_code::text
        ) = $1

        AND
        (
          ib.data_date = $2::date

          OR

          EXISTS (
            SELECT
              1

            FROM
              core.medical_cases mc

            WHERE
              mc.import_batch_id =
              ib.id

              AND

              mc.ngay_vao::date =
              $2::date
          )
        )

      ORDER BY
        ib.started_at DESC NULLS LAST,
        ib.id DESC

      FOR UPDATE
      `,
      [
        facilityCode,
        dataDate,
      ]
    );


  // ====================================================
  // CHƯA CÓ BATCH NGÀY NÀY
  //
  // Tạo mới và PHẢI lưu data_date.
  // ====================================================

  if (
    existingResult.rows.length ===
    0
  ) {

    const inserted =
      await client.query(
        `
        INSERT INTO
          core.import_batches
        (
          file_name,

          facility_code,

          created_date,

          data_date,

          declared_total,

          actual_total,

          status,

          error_message,

          started_at,

          finished_at
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          0,
          'PROCESSING',
          NULL,
          NOW(),
          NULL
        )

        RETURNING id
        `,
        [
          fileName,

          facilityCode,

          createdDate,

          dataDate,

          declaredTotal,
        ]
      );


    return {

      batchId:
        inserted
          .rows[0]
          .id,

      replaced:
        false,

      deletedCases:
        0,

      previousFileName:
        null,

      previousActualTotal:
        0,
    };
  }


  // ====================================================
  // ĐÃ CÓ BATCH
  //
  // Có thể đang có:
  // 1 batch
  // 2 batch
  // 3 batch
  // 4 batch...
  //
  // Ta xử lý hết.
  // ====================================================

  const existingRows =
    existingResult.rows;


  // Giữ batch mới nhất.
  const keeper =
    existingRows[0];


  let deletedCases =
    0;


  let previousActualTotal =
    0;


  // ====================================================
  // XÓA DATA CỦA TẤT CẢ BATCH CŨ
  // ====================================================

  for (
    const batch
    of existingRows
  ) {

    previousActualTotal +=
      Number(
        batch.actual_total ??
        0
      );


    const deleted =
      await clearExistingBatchData(
        client,
        batch.id
      );


    deletedCases +=
      deleted;
  }


  // ====================================================
  // XÓA BATCH TRÙNG
  //
  // Giữ existingRows[0].
  // ====================================================

  for (
    let index = 1;
    index <
    existingRows.length;
    index++
  ) {

    const duplicateBatch =
      existingRows[
        index
      ];


    await client.query(
      `
      DELETE FROM
        core.import_batches

      WHERE
        id = $1
      `,
      [
        duplicateBatch.id,
      ]
    );
  }


  // ====================================================
  // RESET KEEPER
  //
  // QUAN TRỌNG:
  // PHẢI update data_date.
  // ====================================================

  await client.query(
    `
    UPDATE
      core.import_batches

    SET
      file_name =
        $1,

      facility_code =
        $2,

      created_date =
        $3,

      data_date =
        $4,

      declared_total =
        $5,

      actual_total =
        0,

      status =
        'PROCESSING',

      error_message =
        NULL,

      started_at =
        NOW(),

      finished_at =
        NULL

    WHERE
      id = $6
    `,
    [
      fileName,

      facilityCode,

      createdDate,

      dataDate,

      declaredTotal,

      keeper.id,
    ]
  );


  return {

    batchId:
      keeper.id,

    replaced:
      true,

    deletedCases,

    previousFileName:
      keeper.file_name ??
      null,

    previousActualTotal,
  };
}


// ======================================================
// FINISH IMPORT
// ======================================================

export async function finishImportBatch(
  client: PoolClient,

  batchId: string,

  actualTotal: number
) {

  await client.query(
    `
    UPDATE
      core.import_batches

    SET
      actual_total =
        $1,

      status =
        'COMPLETED',

      error_message =
        NULL,

      finished_at =
        NOW()

    WHERE
      id = $2
    `,
    [
      actualTotal,

      batchId,
    ]
  );
}


// ======================================================
// FAIL IMPORT
// ======================================================

export async function failImportBatch(
  client: PoolClient,

  batchId: string,

  error: unknown
) {

  const message =
    error instanceof Error

      ? error.message

      : String(
          error
        );


  await client.query(
    `
    UPDATE
      core.import_batches

    SET
      status =
        'FAILED',

      error_message =
        $1,

      finished_at =
        NOW()

    WHERE
      id = $2
    `,
    [
      message,

      batchId,
    ]
  );
}