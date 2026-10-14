
import type { PoolClient } from "pg";

export type TreatmentGroup = "GENERAL" | "YHCT";

type ImportMeta = {
  fileName: string;
  facilityCode: string;
  createdDate: string;
  dataDate: string;
  declaredTotal: number;
  treatmentGroup: TreatmentGroup;
};

function normalizeDate(value: unknown): string {
  const raw = String(value ?? "").trim();

  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }

  throw new Error(`Ngày không hợp lệ: ${raw}`);
}

async function clearExistingBatchData(
  client: PoolClient,
  batchId: string,
  group: TreatmentGroup
): Promise<number> {
  // Không xóa batch chứa hồ sơ chưa rõ nhóm
  // hoặc chứa hồ sơ của nhóm khác.
  const mixed = await client.query(
    `
    SELECT 1
    FROM core.medical_cases
    WHERE import_batch_id = $1
      AND treatment_group IS DISTINCT FROM $2
    LIMIT 1
    `,
    [batchId, group]
  );

  if (mixed.rowCount) {
    throw new Error(
      "Batch chứa hồ sơ khác nhóm hoặc chưa phân loại. " +
      "Đã chặn thao tác thay thế để bảo vệ dữ liệu."
    );
  }

  await client.query(
    `
    DELETE FROM validation.rule_results
    WHERE medical_case_id IN (
      SELECT id FROM core.medical_cases
      WHERE import_batch_id = $1
        AND treatment_group = $2
    )
    `,
    [batchId, group]
  );

  await client.query(
    `
    DELETE FROM validation.case_errors
    WHERE medical_case_id IN (
      SELECT id FROM core.medical_cases
      WHERE import_batch_id = $1
        AND treatment_group = $2
    )
    OR conflict_case_id IN (
      SELECT id FROM core.medical_cases
      WHERE import_batch_id = $1
        AND treatment_group = $2
    )
    OR source_event_id IN (
      SELECT e.id
      FROM core.medical_events e
      JOIN core.medical_cases c
        ON c.id = e.medical_case_id
      WHERE c.import_batch_id = $1
        AND c.treatment_group = $2
    )
    OR conflict_event_id IN (
      SELECT e.id
      FROM core.medical_events e
      JOIN core.medical_cases c
        ON c.id = e.medical_case_id
      WHERE c.import_batch_id = $1
        AND c.treatment_group = $2
    )
    `,
    [batchId, group]
  );

  await client.query(
    `
    DELETE FROM core.medical_xml_files
    WHERE medical_case_id IN (
      SELECT id FROM core.medical_cases
      WHERE import_batch_id = $1
        AND treatment_group = $2
    )
    `,
    [batchId, group]
  );

  await client.query(
    `
    DELETE FROM core.medical_events
    WHERE medical_case_id IN (
      SELECT id FROM core.medical_cases
      WHERE import_batch_id = $1
        AND treatment_group = $2
    )
    `,
    [batchId, group]
  );

  const deleted = await client.query(
    `
    DELETE FROM core.medical_cases
    WHERE import_batch_id = $1
      AND treatment_group = $2
    RETURNING id
    `,
    [batchId, group]
  );

  return deleted.rowCount ?? 0;
}

export async function prepareImportBatch(
  client: PoolClient,
  meta: ImportMeta
) {
  const fileName = String(meta.fileName ?? "").trim();
  const facilityCode = String(
    meta.facilityCode ?? ""
  ).trim();

  const createdDate = normalizeDate(meta.createdDate);
  const dataDate = normalizeDate(meta.dataDate);
  const treatmentGroup = meta.treatmentGroup;
  const declaredTotal = Number(meta.declaredTotal ?? 0);

  if (!fileName || !facilityCode) {
    throw new Error("Thiếu tên file hoặc mã cơ sở KCB.");
  }

  if (
    treatmentGroup !== "GENERAL" &&
    treatmentGroup !== "YHCT"
  ) {
    throw new Error("Nhóm điều trị không hợp lệ.");
  }

  // Cùng cơ sở, cùng ngày nhưng khác nhóm
  // sẽ có khóa xử lý khác nhau.
  const lockKey =
    `${facilityCode}:${dataDate}:${treatmentGroup}`;

  await client.query(
    `SELECT pg_advisory_xact_lock(hashtext($1))`,
    [lockKey]
  );

  // Chỉ tìm batch của đúng nhóm.
  // Batch cũ chưa phân loại (NULL) được giữ nguyên.
  const existing = await client.query<{
    id: string;
    file_name: string;
    actual_total: number | null;
  }>(
    `
    SELECT
      id,
      file_name,
      actual_total
    FROM core.import_batches
    WHERE BTRIM(facility_code::text) = $1
      AND data_date = $2::date
      AND treatment_group = $3
    ORDER BY
      started_at DESC NULLS LAST,
      id DESC
    FOR UPDATE
    `,
    [facilityCode, dataDate, treatmentGroup]
  );

  if (existing.rows.length === 0) {
    const inserted = await client.query<{ id: string }>(
      `
      INSERT INTO core.import_batches (
        file_name,
        facility_code,
        created_date,
        data_date,
        treatment_group,
        declared_total,
        actual_total,
        status,
        error_message,
        started_at,
        finished_at
      )
      VALUES (
        $1, $2, $3, $4::date, $5,
        $6, 0, 'PROCESSING',
        NULL, NOW(), NULL
      )
      RETURNING id
      `,
      [
        fileName,
        facilityCode,
        createdDate,
        dataDate,
        treatmentGroup,
        declaredTotal,
      ]
    );

    return {
      batchId: inserted.rows[0].id,
      replaced: false,
      deletedCases: 0,
      previousFileName: null,
      previousActualTotal: 0,
    };
  }

  // Kiểm tra tất cả batch trước khi xóa.
  for (const batch of existing.rows) {
    const mixed = await client.query(
      `
      SELECT 1
      FROM core.medical_cases
      WHERE import_batch_id = $1
        AND treatment_group IS DISTINCT FROM $2
      LIMIT 1
      `,
      [batch.id, treatmentGroup]
    );

    if (mixed.rowCount) {
      throw new Error(
        `Batch ${batch.id} chứa dữ liệu không thuộc ` +
        `${treatmentGroup}. Không thể thay thế.`
      );
    }
  }

  const keeper = existing.rows[0];

  let deletedCases = 0;
  let previousActualTotal = 0;

  for (const batch of existing.rows) {
    previousActualTotal += Number(
      batch.actual_total ?? 0
    );

    deletedCases += await clearExistingBatchData(
      client,
      batch.id,
      treatmentGroup
    );
  }

  // Xóa các batch trùng thuộc cùng nhóm.
  for (const batch of existing.rows.slice(1)) {
    await client.query(
      `
      DELETE FROM core.import_batches
      WHERE id = $1
        AND treatment_group = $2
      `,
      [batch.id, treatmentGroup]
    );
  }

  await client.query(
    `
    UPDATE core.import_batches
    SET
      file_name = $1,
      facility_code = $2,
      created_date = $3,
      data_date = $4::date,
      treatment_group = $5,
      declared_total = $6,
      actual_total = 0,
      status = 'PROCESSING',
      error_message = NULL,
      started_at = NOW(),
      finished_at = NULL
    WHERE id = $7
      AND treatment_group = $5
    `,
    [
      fileName,
      facilityCode,
      createdDate,
      dataDate,
      treatmentGroup,
      declaredTotal,
      keeper.id,
    ]
  );

  return {
    batchId: keeper.id,
    replaced: true,
    deletedCases,
    previousFileName: keeper.file_name ?? null,
    previousActualTotal,
  };
}

export async function finishImportBatch(
  client: PoolClient,
  batchId: string,
  actualTotal: number
) {
  await client.query(
    `
    UPDATE core.import_batches
    SET
      actual_total = $1,
      status = 'COMPLETED',
      error_message = NULL,
      finished_at = NOW()
    WHERE id = $2
    `,
    [actualTotal, batchId]
  );
}

export async function failImportBatch(
  client: PoolClient,
  batchId: string,
  error: unknown
) {
  const text =
    error instanceof Error ? error.message : String(error);

  await client.query(
    `
    UPDATE core.import_batches
    SET
      status = 'FAILED',
      error_message = $1,
      finished_at = NOW()
    WHERE id = $2
    `,
    [text, batchId]
  );
}
