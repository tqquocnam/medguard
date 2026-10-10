import {
  db,
} from "../../config/database.js";


// ======================================================
// TYPES
// ======================================================

export interface GetCheckRunsParams {

  year:
    number;

  month:
    number;

  limit:
    number;

  offset:
    number;
}


export interface CheckRunItem {

  id:
    string;

  paymentDate:
    string |
    null;

  year:
    number |
    null;

  month:
    number |
    null;

  startedAt:
    string |
    null;

  finishedAt:
    string |
    null;

  status:
    string;

  totalCases:
    number;

  okCases:
    number;

  errorCases:
    number;

  errorMessage:
    string |
    null;
}


export interface CheckRunErrorCase {

  id:
    string;

  maLk:
    string |
    null;

  maBn:
    string |
    null;

  hoTen:
    string |
    null;

  maTheBhyt:
    string |
    null;

  errorCount:
    number;
}


// ======================================================
// NORMALIZE STATUS
// ======================================================

function normalizeStatus(
  value:
    unknown
) {

  const status =
    String(
      value ??
      "PENDING"
    );


  // Lịch sử cũ từng dùng PROCESSING.
  if (
    status ===
    "PROCESSING"
  ) {

    return "RUNNING";
  }


  return status;
}


// ======================================================
// FORMAT TIMESTAMP
// ======================================================

function formatTimestamp(
  value:
    unknown
):
string | null {

  if (!value) {

    return null;
  }


  const date =
    new Date(
      String(
        value
      )
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return String(
      value
    );
  }


  return date.toISOString();
}


// ======================================================
// GET CHECK RUNS
// ======================================================

export async function getCheckRuns(
  params:
    GetCheckRunsParams
) {

  const {
    year,
    month,
    limit,
    offset,
  } =
    params;


  // ====================================================
  // DATA
  // ====================================================

  const result =
    await db.query(
      `
      SELECT

        id,

        year,

        month,

        TO_CHAR(
          payment_date,
          'YYYY-MM-DD'
        ) AS payment_date,

        status,

        total_cases,

        total_errors,

        started_at,

        finished_at,

        created_at

      FROM
        validation.check_runs

      WHERE
        year = $1
        AND month = $2

      ORDER BY
        created_at DESC

      LIMIT $3
      OFFSET $4
      `,
      [
        year,
        month,
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
        validation.check_runs

      WHERE
        year = $1
        AND month = $2
      `,
      [
        year,
        month,
      ]
    );


  // ====================================================
  // MAP
  // ====================================================

  const items:
    CheckRunItem[] =
    result.rows.map(
      (
        row
      ) => {

        const totalCases =
          Number(
            row.total_cases ??
            0
          );


        const errorCases =
          Number(
            row.total_errors ??
            0
          );


        return {

          id:
            String(
              row.id
            ),


          paymentDate:
            row.payment_date
              ? String(
                  row.payment_date
                )
              : null,


          year:
            row.year !==
            null
              ? Number(
                  row.year
                )
              : null,


          month:
            row.month !==
            null
              ? Number(
                  row.month
                )
              : null,


          startedAt:
            formatTimestamp(
              row.started_at
            ),


          finishedAt:
            formatTimestamp(
              row.finished_at
            ),


          status:
            normalizeStatus(
              row.status
            ),


          totalCases,


          errorCases,


          okCases:
            Math.max(
              0,
              totalCases -
              errorCases
            ),


          errorMessage:
            null,
        };
      }
    );


  return {

    items,

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
// GET ONE CHECK RUN + ERROR CASES
// ======================================================
//
// Quan trọng:
//
// Không lấy status/error_count hiện tại của medical_cases.
//
// Ta lấy từ:
//
// validation.rule_results
// WHERE check_run_id = runId
//
// Như vậy nếu hồ sơ được kiểm tra lại về sau,
// lịch sử lần kiểm tra cũ vẫn chính xác.
//
// ======================================================

export async function getCheckRunResults(
  runId:
    string
) {

  // ====================================================
  // 1. CHECK RUN
  // ====================================================

  const runResult =
    await db.query(
      `
      SELECT

        id,

        year,

        month,

        TO_CHAR(
          payment_date,
          'YYYY-MM-DD'
        ) AS payment_date,

        status,

        total_cases,

        total_errors,

        started_at,

        finished_at,

        created_at

      FROM
        validation.check_runs

      WHERE
        id = $1

      LIMIT 1
      `,
      [
        runId,
      ]
    );


  // ====================================================
  // KHÔNG TỒN TẠI
  // ====================================================

  if (
    runResult.rows.length ===
    0
  ) {

    return null;
  }


  const row =
    runResult.rows[0];


  const totalCases =
    Number(
      row.total_cases ??
      0
    );


  const errorCasesCount =
    Number(
      row.total_errors ??
      0
    );


  // ====================================================
  // 2. DANH SÁCH HỒ SƠ CÓ ERROR
  // ====================================================
  //
  // Một hồ sơ được tính là lỗi khi:
  //
  // result   = FAIL
  // severity = ERROR
  //
  // Chỉ lấy rule_results của đúng check_run này.
  //
  // ====================================================

  const errorResult =
    await db.query(
      `
      SELECT

        mc.id,

        mc.ma_lk,

        mc.ma_bn,

        mc.ho_ten,

        mc.ma_the_bhyt,


        SUM(
          CASE

            WHEN
              COALESCE(
                rr.issue_count,
                0
              ) > 0

            THEN
              rr.issue_count

            ELSE
              1

          END
        )::integer
          AS error_count


      FROM
        validation.rule_results rr


      INNER JOIN
        core.medical_cases mc

      ON
        mc.id =
        rr.medical_case_id


      WHERE

        rr.check_run_id =
          $1

        AND rr.result =
          'FAIL'

        AND rr.severity =
          'ERROR'


      GROUP BY

        mc.id,

        mc.ma_lk,

        mc.ma_bn,

        mc.ho_ten,

        mc.ma_the_bhyt


      ORDER BY

        mc.ho_ten ASC,

        mc.ma_bn ASC
      `,
      [
        runId,
      ]
    );


  // ====================================================
  // 3. MAP ERROR CASES
  // ====================================================

  const errorCases:
    CheckRunErrorCase[] =
    errorResult.rows.map(
      (
        errorRow
      ) => ({

        id:
          String(
            errorRow.id
          ),


        maLk:
          errorRow.ma_lk
            ? String(
                errorRow.ma_lk
              )
            : null,


        maBn:
          errorRow.ma_bn
            ? String(
                errorRow.ma_bn
              )
            : null,


        hoTen:
          errorRow.ho_ten
            ? String(
                errorRow.ho_ten
              )
            : null,


        maTheBhyt:
          errorRow.ma_the_bhyt
            ? String(
                errorRow.ma_the_bhyt
              )
            : null,


        errorCount:
          Number(
            errorRow.error_count ??
            0
          ),
      })
    );


  // ====================================================
  // 4. RETURN
  // ====================================================

  return {

    run: {

      id:
        String(
          row.id
        ),


      paymentDate:
        row.payment_date
          ? String(
              row.payment_date
            )
          : null,


      year:
        row.year !==
        null
          ? Number(
              row.year
            )
          : null,


      month:
        row.month !==
        null
          ? Number(
              row.month
            )
          : null,


      startedAt:
        formatTimestamp(
          row.started_at
        ),


      finishedAt:
        formatTimestamp(
          row.finished_at
        ),


      status:
        normalizeStatus(
          row.status
        ),


      totalCases,


      errorCases:
        errorCasesCount,


      okCases:
        Math.max(
          0,
          totalCases -
          errorCasesCount
        ),
    },


    errorCases,
  };
}