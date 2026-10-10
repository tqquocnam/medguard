import {
  db,
} from "../../config/database.js";


// ======================================================
// TYPES
// ======================================================

export interface GetCheckDatasetsParams {
  year: number;
  month: number;
}


export interface CheckDatasetItem {
  importBatchId: string;

  fileName: string;

  facilityCode:
    string |
    null;

  dataDate: string;

  year: number;

  month: number;

  totalCases: number;

  importStatus: string;

  importStartedAt:
    string |
    null;

  importFinishedAt:
    string |
    null;

  checkStatus:
    "READY" |
    "RUNNING" |
    "DONE" |
    "ERROR";

  checkRunId:
    string |
    null;

  checkStartedAt:
    string |
    null;

  checkFinishedAt:
    string |
    null;

  errorCases: number;

  okCases: number;
}


// ======================================================
// FORMAT TIMESTAMP
// ======================================================

function formatTimestamp(
  value: unknown
):
string | null {

  if (!value) {
    return null;
  }


  const date =
    new Date(
      String(value)
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }


  return date.toISOString();
}


// ======================================================
// GET DATASETS
// ======================================================
//
// Mỗi import batch = 1 bộ dữ liệu.
//
// Ghép với check_run mới nhất theo:
//
// check_runs.payment_date = import_batches.data_date
//
// ======================================================

export async function getCheckDatasets(
  params:
    GetCheckDatasetsParams
) {

  const {
    year,
    month,
  } =
    params;


  const result =
    await db.query(
      `
      SELECT

        ib.id
          AS import_batch_id,

        ib.file_name,

        ib.facility_code,

        TO_CHAR(
          ib.data_date,
          'YYYY-MM-DD'
        ) AS data_date,

        ib.actual_total,

        ib.status
          AS import_status,

        ib.started_at
          AS import_started_at,

        ib.finished_at
          AS import_finished_at,


        cr.id
          AS check_run_id,

        cr.status
          AS check_status,

        cr.total_cases,

        cr.total_errors,

        cr.started_at
          AS check_started_at,

        cr.finished_at
          AS check_finished_at


      FROM
        core.import_batches ib


      LEFT JOIN LATERAL (

        SELECT

          r.id,

          r.status,

          r.total_cases,

          r.total_errors,

          r.started_at,

          r.finished_at

        FROM
          validation.check_runs r

        WHERE

          r.year =
            EXTRACT(
              YEAR
              FROM ib.data_date
            )::integer

          AND r.month =
            EXTRACT(
              MONTH
              FROM ib.data_date
            )::integer

          AND r.payment_date =
            ib.data_date

        ORDER BY
          r.created_at DESC

        LIMIT 1

      ) cr
      ON TRUE


      WHERE

        ib.data_date IS NOT NULL

        AND EXTRACT(
          YEAR
          FROM ib.data_date
        )::integer = $1

        AND EXTRACT(
          MONTH
          FROM ib.data_date
        )::integer = $2


      ORDER BY
        ib.data_date DESC
      `,
      [
        year,
        month,
      ]
    );


  const items:
    CheckDatasetItem[] =
    result.rows.map(
      (
        row
      ) => {

        const totalCases =
          Number(
            row.actual_total ??
            row.total_cases ??
            0
          );


        const errorCases =
          Number(
            row.total_errors ??
            0
          );


        let rawCheckStatus =
          row.check_status
            ? String(
                row.check_status
              )
            : "";


        // Lịch sử cũ từng dùng PROCESSING.
        if (
          rawCheckStatus ===
          "PROCESSING"
        ) {
          rawCheckStatus =
            "RUNNING";
        }


        let checkStatus:
          CheckDatasetItem[
            "checkStatus"
          ];


        if (
          rawCheckStatus ===
          "RUNNING"
        ) {

          checkStatus =
            "RUNNING";

        } else if (
          rawCheckStatus ===
          "DONE"
        ) {

          checkStatus =
            "DONE";

        } else if (
          rawCheckStatus ===
          "ERROR"
        ) {

          checkStatus =
            "ERROR";

        } else {

          checkStatus =
            "READY";
        }


        const dataDate =
          String(
            row.data_date
          );


        const dateParts =
          dataDate.split(
            "-"
          );


        return {

          importBatchId:
            String(
              row.import_batch_id
            ),


          fileName:
            String(
              row.file_name ??
              ""
            ),


          facilityCode:
            row.facility_code
              ? String(
                  row.facility_code
                )
              : null,


          dataDate,


          year:
            Number(
              dateParts[0] ??
              year
            ),


          month:
            Number(
              dateParts[1] ??
              month
            ),


          totalCases,


          importStatus:
            String(
              row.import_status ??
              ""
            ),


          importStartedAt:
            formatTimestamp(
              row.import_started_at
            ),


          importFinishedAt:
            formatTimestamp(
              row.import_finished_at
            ),


          checkStatus,


          checkRunId:
            row.check_run_id
              ? String(
                  row.check_run_id
                )
              : null,


          checkStartedAt:
            formatTimestamp(
              row.check_started_at
            ),


          checkFinishedAt:
            formatTimestamp(
              row.check_finished_at
            ),


          errorCases,


          okCases:
            checkStatus ===
              "DONE"
              ? Math.max(
                  0,
                  totalCases -
                  errorCases
                )
              : 0,
        };
      }
    );


  return {
    items,

    total:
      items.length,
  };
}