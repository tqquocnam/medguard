import {
  db,
} from "../../config/database.js";

import {
  loadEnabledRules,
  runRulesForCase,
} from "./engine/rule-engine.js";


export interface ValidationScope {
  year: number;

  month?: number;

  paymentDate?: string;
}


interface MedicalCaseForValidation {
  id: string;
}


interface CaseValidationResult {
  status: string;
}


const VALIDATION_CONCURRENCY =
  5;


type LoadedRules =
  Awaited<
    ReturnType<
      typeof loadEnabledRules
    >
  >;


async function runSingleCase(
  checkRunId: string,
  medicalCaseId: string,
  rules: LoadedRules
): Promise<CaseValidationResult> {
  const workerClient =
    await db.connect();

  let transactionStarted =
    false;

  try {
    await workerClient.query(
      "BEGIN"
    );

    transactionStarted =
      true;


    const result =
      await runRulesForCase(
        workerClient,
        checkRunId,
        medicalCaseId,
        rules
      );


    await workerClient.query(
      "COMMIT"
    );

    transactionStarted =
      false;


    return result;

  } catch (
    error
  ) {
    if (
      transactionStarted
    ) {
      try {
        await workerClient.query(
          "ROLLBACK"
        );
      } catch (
        rollbackError
      ) {
        console.error(
          `Rollback hồ sơ ${medicalCaseId} lỗi:`,
          rollbackError
        );
      }
    }


    console.error(
      `Kiểm tra hồ sơ ${medicalCaseId} lỗi:`,
      error
    );


    throw error;

  } finally {
    workerClient.release();
  }
}


async function processValidation(
  checkRunId: string,
  medicalCases:
    MedicalCaseForValidation[],
  rules: LoadedRules
) {
  let errorCases =
    0;

  let warningCases =
    0;

  let incompleteCases =
    0;

  let okCases =
    0;


  try {
    for (
      let index = 0;
      index <
      medicalCases.length;
      index +=
      VALIDATION_CONCURRENCY
    ) {
      const batch =
        medicalCases.slice(
          index,
          index +
            VALIDATION_CONCURRENCY
        );


      const batchResults =
        await Promise.all(
          batch.map(
            (
              medicalCase
            ) =>
              runSingleCase(
                checkRunId,
                medicalCase.id,
                rules
              )
          )
        );


      for (
        const result
        of batchResults
      ) {
        switch (
          result.status
        ) {
          case "ERROR":
            errorCases++;
            break;

          case "WARNING":
            warningCases++;
            break;

          case "INCOMPLETE":
            incompleteCases++;
            break;

          case "OK":
            okCases++;
            break;

          default:
            break;
        }
      }
    }


    await db.query(
      `
      UPDATE
        validation.check_runs

      SET
        status =
          'DONE',

        total_cases =
          $2,

        total_errors =
          $3,

        finished_at =
          NOW()

      WHERE
        id =
          $1
      `,
      [
        checkRunId,
        medicalCases.length,
        errorCases,
      ]
    );


    return {
      checkRunId,

      totalCases:
        medicalCases.length,

      totalRules:
        rules.length,

      errorCases,

      warningCases,

      incompleteCases,

      okCases,

      status:
        "DONE",
    };

  } catch (
    error
  ) {
    try {
      await db.query(
        `
        UPDATE
          validation.check_runs

        SET
          status =
            'ERROR',

          finished_at =
            NOW()

        WHERE
          id =
            $1
        `,
        [
          checkRunId,
        ]
      );

    } catch (
      updateError
    ) {
      console.error(
        "Không thể cập nhật check run ERROR:",
        updateError
      );
    }


    console.error(
      "processValidation error:",
      error
    );


    throw error;
  }
}


export async function startValidation(
  scope: ValidationScope
) {
  const client =
    await db.connect();

  try {
    const caseResult =
      await client.query<MedicalCaseForValidation>(
        `
        SELECT
          id

        FROM
          core.medical_cases

        WHERE
          COALESCE(
            nam_qt,
            EXTRACT(
              YEAR
              FROM COALESCE(
                ngay_ttoan,
                ngay_ra,
                ngay_vao
              )
            )::integer
          ) = $1

          AND (
            $2::integer IS NULL

            OR

            COALESCE(
              thang_qt,
              EXTRACT(
                MONTH
                FROM COALESCE(
                  ngay_ttoan,
                  ngay_ra,
                  ngay_vao
                )
              )::integer
            ) = $2
          )

          AND (
            $3::date IS NULL

            OR

            ngay_ttoan::date =
              $3::date
          )

        ORDER BY
          created_at ASC
        `,
        [
          scope.year,

          scope.month ??
            null,

          scope.paymentDate ??
            null,
        ]
      );


    const medicalCases =
      caseResult.rows;


    if (
      medicalCases.length ===
      0
    ) {
      let description =
        `năm ${scope.year}`;


      if (
        scope.month !==
        undefined
      ) {
        description =
          `tháng ${String(
            scope.month
          ).padStart(
            2,
            "0"
          )}/${scope.year}`;
      }


      if (
        scope.paymentDate
      ) {
        description =
          `ngày thanh toán ${scope.paymentDate}`;
      }


      throw new Error(
        `Không có hồ sơ đã import cho ${description}.`
      );
    }


    const rules =
      await loadEnabledRules(
        client
      );


    const checkRunResult =
      await client.query(
        `
        INSERT INTO
          validation.check_runs
        (
          year,
          month,
          payment_date,
          status,
          total_cases,
          total_errors,
          started_at,
          finished_at,
          rule_snapshot
        )

        VALUES
        (
          $1,
          $2,
          $3,
          'RUNNING',
          $4,
          0,
          NOW(),
          NULL,
          $5::jsonb
        )

        RETURNING
          id
        `,
        [
          scope.year,

          scope.month ??
            null,

          scope.paymentDate ??
            null,

          medicalCases.length,

          JSON.stringify(
            rules
          ),
        ]
      );


    const checkRunId =
      String(
        checkRunResult
          .rows[0]
          .id
      );


    void processValidation(
      checkRunId,
      medicalCases,
      rules
    ).catch(
      (
        error
      ) => {
        console.error(
          `Validation background job ${checkRunId} error:`,
          error
        );
      }
    );


    return {
      checkRunId,

      year:
        scope.year,

      month:
        scope.month ??
        null,

      paymentDate:
        scope.paymentDate ??
        null,

      totalCases:
        medicalCases.length,

      totalRules:
        rules.length,

      status:
        "RUNNING",
    };

  } finally {
    client.release();
  }
}


export async function getValidationProgress(
  checkRunId: string
) {
  const result =
    await db.query(
      `
      SELECT

        cr.id,

        cr.status,

        cr.total_cases,

        cr.total_errors,

        cr.started_at,

        cr.finished_at,

        COALESCE(
          progress.processed_cases,
          0
        )::integer
          AS processed_cases

      FROM
        validation.check_runs cr

      LEFT JOIN
      (
        SELECT
          check_run_id,

          COUNT(
            DISTINCT medical_case_id
          )::integer
            AS processed_cases

        FROM
          validation.rule_results

        WHERE
          check_run_id =
            $1::uuid

        GROUP BY
          check_run_id

      ) progress
        ON
          progress.check_run_id =
          cr.id

      WHERE
        cr.id =
          $1::uuid

      LIMIT 1
      `,
      [
        checkRunId,
      ]
    );


  if (
    result.rowCount ===
    0
  ) {
    throw new Error(
      "Không tìm thấy phiên kiểm tra."
    );
  }


  const row =
    result.rows[0];


  const totalCases =
    Number(
      row.total_cases ??
      0
    );


  const processedCases =
    Number(
      row.processed_cases ??
      0
    );


  const percent =
    totalCases >
    0
      ? Math.min(
          100,
          Math.round(
            (
              processedCases /
              totalCases
            ) *
            100
          )
        )
      : 0;


  return {
    checkRunId:
      row.id,

    status:
      row.status,

    totalCases,

    processedCases,

    remainingCases:
      Math.max(
        0,
        totalCases -
          processedCases
      ),

    percent:
      row.status ===
      "DONE"
        ? 100
        : percent,

    errorCases:
      Number(
        row.total_errors ??
        0
      ),

    startedAt:
      row.started_at,

    finishedAt:
      row.finished_at,
  };
}