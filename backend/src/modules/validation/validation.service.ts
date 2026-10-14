import { db } from "../../config/database.js";
import { loadEnabledRules, runRulesForCase } from "./engine/rule-engine.js";

export type TreatmentGroup = "GENERAL" | "YHCT";
export interface ValidationScope {
  year: number;
  month?: number;
  paymentDate?: string;
  treatmentGroup?: TreatmentGroup;
  importBatchId?: string;
}
interface MedicalCaseForValidation { id: string; }
interface CaseValidationResult { status: string; }
type LoadedRules = Awaited<ReturnType<typeof loadEnabledRules>>;
const VALIDATION_CONCURRENCY = 5;

async function runSingleCase(checkRunId: string, medicalCaseId: string, rules: LoadedRules): Promise<CaseValidationResult> {
  const worker = await db.connect();
  try {
    await worker.query("BEGIN");
    const result = await runRulesForCase(worker, checkRunId, medicalCaseId, rules);
    await worker.query("COMMIT");
    return result;
  } catch (error) {
    try { await worker.query("ROLLBACK"); } catch (rollbackError) {
      console.error(`Rollback hồ sơ ${medicalCaseId}:`, rollbackError);
    }
    console.error(`Kiểm tra hồ sơ ${medicalCaseId}:`, error);
    throw error;
  } finally { worker.release(); }
}

async function processValidation(checkRunId: string, medicalCases: MedicalCaseForValidation[], rules: LoadedRules) {
  let errorCases = 0;
  let warningCases = 0;
  let incompleteCases = 0;
  let okCases = 0;
  try {
    for (let i = 0; i < medicalCases.length; i += VALIDATION_CONCURRENCY) {
      const batch = medicalCases.slice(i, i + VALIDATION_CONCURRENCY);
      const batchResults = await Promise.all(batch.map(c => runSingleCase(checkRunId, c.id, rules)));
      for (const result of batchResults) {
        switch (result.status) {
          case "ERROR": errorCases++; break;
          case "WARNING": warningCases++; break;
          case "INCOMPLETE": incompleteCases++; break;
          case "OK": okCases++; break;
        }
      }
    }
    await db.query(`UPDATE validation.check_runs SET status='DONE', total_cases=$2, total_errors=$3, finished_at=NOW() WHERE id=$1`, [checkRunId, medicalCases.length, errorCases]);
    return {checkRunId, totalCases:medicalCases.length, totalRules:rules.length, errorCases, warningCases, incompleteCases, okCases, status:"DONE"};
  } catch (error) {
    try { await db.query(`UPDATE validation.check_runs SET status='ERROR', finished_at=NOW() WHERE id=$1`, [checkRunId]); }
    catch (updateError) { console.error("Không thể cập nhật check run ERROR:", updateError); }
    console.error("processValidation error:", error);
    throw error;
  }
}

export async function startValidation(scope: ValidationScope) {
  if (!Number.isInteger(scope.year) || scope.year < 2000 || scope.year > 2100) throw new Error("Năm không hợp lệ.");
  if (scope.month != null && (!Number.isInteger(scope.month) || scope.month < 1 || scope.month > 12)) throw new Error("Tháng không hợp lệ.");
  if (scope.treatmentGroup != null && !["GENERAL", "YHCT"].includes(scope.treatmentGroup)) throw new Error("Nhóm hồ sơ không hợp lệ.");
  if (scope.importBatchId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(scope.importBatchId)) throw new Error("Mã batch không hợp lệ.");
  const client = await db.connect();
  try {
    // Nếu người dùng chọn batch cụ thể, không được phép chọn nhầm nhóm.
    // Ngày và nhóm được kiểm tra lại ngay trong SQL, không tin vào giá trị frontend.
    if (scope.importBatchId) {
      const batch = await client.query<{ treatment_group: string | null }>(
        `SELECT treatment_group FROM core.import_batches WHERE id=$1::uuid LIMIT 1`, [scope.importBatchId]
      );
      if (!batch.rows.length) throw new Error("Không tìm thấy batch import.");
      if (!batch.rows[0].treatment_group) throw new Error("Batch chưa phân nhóm, không thể chạy kiểm tra riêng.");
      if (scope.treatmentGroup && batch.rows[0].treatment_group !== scope.treatmentGroup) throw new Error("Batch không thuộc nhóm đã chọn.");
    }
    const caseResult = await client.query<MedicalCaseForValidation>(`
      SELECT mc.id
      FROM core.medical_cases mc
      WHERE COALESCE(mc.nam_qt, EXTRACT(YEAR FROM COALESCE(mc.ngay_ttoan, mc.ngay_ra, mc.ngay_vao))::integer) = $1
        AND ($2::integer IS NULL OR COALESCE(mc.thang_qt, EXTRACT(MONTH FROM COALESCE(mc.ngay_ttoan, mc.ngay_ra, mc.ngay_vao))::integer) = $2)
        AND ($3::date IS NULL OR mc.ngay_ttoan::date = $3::date)
        AND ($4::text IS NULL OR mc.treatment_group = $4)
        AND ($5::uuid IS NULL OR mc.import_batch_id = $5::uuid)
      ORDER BY mc.created_at ASC, mc.id ASC
    `, [scope.year, scope.month ?? null, scope.paymentDate ?? null, scope.treatmentGroup ?? null, scope.importBatchId ?? null]);
    const medicalCases = caseResult.rows;
    if (!medicalCases.length) throw new Error("Không có hồ sơ thuộc phạm vi kiểm tra đã chọn.");
    const rules = await loadEnabledRules(client);
    const run = await client.query<{id:string}>(`
      INSERT INTO validation.check_runs (
        year, month, payment_date, import_batch_id, treatment_group,
        status, total_cases, total_errors, started_at, finished_at, rule_snapshot
      ) VALUES ($1,$2,$3,$4::uuid,$5,'RUNNING',$6,0,NOW(),NULL,$7::jsonb)
      RETURNING id
    `, [scope.year, scope.month ?? null, scope.paymentDate ?? null, scope.importBatchId ?? null, scope.treatmentGroup ?? null, medicalCases.length, JSON.stringify(rules)]);
    const checkRunId = String(run.rows[0].id);
    void processValidation(checkRunId, medicalCases, rules).catch(error => {
      console.error(`Validation background job ${checkRunId}:`, error);
    });
    return {
      checkRunId, year: scope.year, month: scope.month ?? null,
      paymentDate: scope.paymentDate ?? null,
      importBatchId: scope.importBatchId ?? null,
      treatmentGroup: scope.treatmentGroup ?? null,
      totalCases: medicalCases.length, totalRules: rules.length, status: "RUNNING"
    };
  } finally { client.release(); }
}

export async function getValidationProgress(checkRunId: string) {
  const result = await db.query(`
    SELECT cr.id, cr.status, cr.total_cases, cr.total_errors, cr.started_at, cr.finished_at,
      COALESCE(progress.processed_cases, 0)::integer AS processed_cases
    FROM validation.check_runs cr
    LEFT JOIN (
      SELECT check_run_id, COUNT(DISTINCT medical_case_id)::integer AS processed_cases
      FROM validation.rule_results WHERE check_run_id = $1::uuid GROUP BY check_run_id
    ) progress ON progress.check_run_id=cr.id
    WHERE cr.id=$1::uuid LIMIT 1
  `, [checkRunId]);
  if (!result.rows.length) throw new Error("Không tìm thấy phiên kiểm tra.");
  const row=result.rows[0];
  const totalCases=Number(row.total_cases??0);
  const processedCases=Number(row.processed_cases??0);
  const percent=totalCases>0 ? Math.min(100,Math.round(processedCases/totalCases*100)) : 0;
  return {checkRunId:row.id,status:row.status,totalCases,processedCases,
    remainingCases:Math.max(0,totalCases-processedCases),
    percent:row.status==="DONE"?100:percent,
    errorCases:Number(row.total_errors??0),startedAt:row.started_at,finishedAt:row.finished_at};
}
