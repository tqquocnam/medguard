import { requireBranch } from "../../config/branch-context.js";

function progressKey(id: string): string { return `${requireBranch()}:${id}`; }

export type ImportProgressStatus =
  | "PROCESSING"
  | "DONE"
  | "ERROR";


export interface ImportProgress {
  id: string;

  status:
    ImportProgressStatus;

  current: number;

  total: number;

  percent: number;

  message: string;

  result?: unknown;

  error?: string;
}


const jobs =
  new Map<
    string,
    ImportProgress
  >();


// ======================================================
// CREATE
// ======================================================

export function createImportProgress(
  id: string,
  total: number
) {

  const progress:
    ImportProgress = {

    id,

    status:
      "PROCESSING",

    current:
      0,

    total,

    percent:
      0,

    message:
      `Đang chuẩn bị import 0/${total} hồ sơ...`,
  };


  jobs.set(
    progressKey(id),
    progress
  );


  return progress;
}


// ======================================================
// UPDATE
// ======================================================

export function updateImportProgress(
  id: string,

  current: number,

  total: number
) {

  const job =
    jobs.get(
      progressKey(id)
    );


  if (!job) {
    return;
  }


  let percent =
    total > 0

      ? Math.floor(
          (
            current /
            total
          ) *
          100
        )

      : 0;


  // ==========================================
  // Khi transaction chưa COMMIT
  // không cho frontend thấy 100%.
  //
  // 100% chỉ được set ở finishImportProgress().
  // ==========================================

  if (
    percent >= 100
  ) {
    percent =
      99;
  }


  job.current =
    current;

  job.total =
    total;

  job.percent =
    percent;

  job.message =
    `Đang import ${current}/${total} hồ sơ...`;
}


// ======================================================
// DONE
// ======================================================

export function finishImportProgress(
  id: string,

  result: unknown
) {

  const job =
    jobs.get(
      progressKey(id)
    );


  if (!job) {
    return;
  }


  job.status =
    "DONE";

  job.current =
    job.total;

  job.percent =
    100;

  job.message =
    `Import thành công ${job.total}/${job.total} hồ sơ.`;

  job.result =
    result;
}


// ======================================================
// ERROR
// ======================================================

export function failImportProgress(
  id: string,

  error: unknown
) {

  const job =
    jobs.get(
      progressKey(id)
    );


  if (!job) {
    return;
  }


  job.status =
    "ERROR";

  job.message =
    "Import dữ liệu thất bại.";

  job.error =
    error instanceof Error
      ? error.message
      : String(
          error
        );
}


// ======================================================
// GET
// ======================================================

export function getImportProgress(
  id: string
) {

  return (
    jobs.get(
      progressKey(id)
    ) ??
    null
  );
}