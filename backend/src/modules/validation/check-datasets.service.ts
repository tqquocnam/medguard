import { db } from "../../config/database.js";

export interface GetCheckDatasetsParams { year:number; month:number; treatmentGroup?:"GENERAL"|"YHCT"; }
export interface CheckDatasetItem {
  importBatchId:string;
  treatmentGroup:"GENERAL"|"YHCT"|null;
  fileName:string;
  facilityCode:string|null;
  dataDate:string;
  year:number;
  month:number;
  totalCases:number;
  importStatus:string;
  importStartedAt:string|null;
  importFinishedAt:string|null;
  checkStatus:"READY"|"RUNNING"|"DONE"|"ERROR";
  checkRunId:string|null;
  checkStartedAt:string|null;
  checkFinishedAt:string|null;
  errorCases:number;
  okCases:number;
}
function formatTimestamp(value:unknown):string|null {
  if (!value) return null;
  const date=new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}
export async function getCheckDatasets(params:GetCheckDatasetsParams) {
  const result=await db.query(`
    SELECT ib.id AS import_batch_id, ib.treatment_group, ib.file_name, ib.facility_code,
      TO_CHAR(ib.data_date,'YYYY-MM-DD') AS data_date,
      COALESCE(counts.case_total,0)::integer AS actual_total,
      ib.status AS import_status, ib.started_at AS import_started_at,
      ib.finished_at AS import_finished_at,
      cr.id AS check_run_id,cr.status AS check_status,
      cr.total_cases,cr.total_errors,
      cr.started_at AS check_started_at,cr.finished_at AS check_finished_at
    FROM core.import_batches ib
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS case_total FROM core.medical_cases mc
      WHERE mc.import_batch_id=ib.id
    ) counts ON TRUE
    LEFT JOIN LATERAL (
      SELECT r.id,r.status,r.total_cases,r.total_errors,r.started_at,r.finished_at
      FROM validation.check_runs r
      WHERE r.import_batch_id = ib.id
        AND r.treatment_group = ib.treatment_group
      ORDER BY r.started_at DESC, r.id DESC LIMIT 1
    ) cr ON TRUE
    WHERE ib.data_date IS NOT NULL
      AND EXTRACT(YEAR FROM ib.data_date)::integer=$1
      AND EXTRACT(MONTH FROM ib.data_date)::integer=$2
      AND ($3::text IS NULL OR ib.treatment_group=$3)
    ORDER BY ib.data_date DESC, ib.started_at DESC, ib.id DESC
  `,[params.year,params.month,params.treatmentGroup??null]);
  const items:CheckDatasetItem[]=result.rows.map(row=>{
    const totalCases=Number(row.actual_total??0);
    const errorCases=Number(row.total_errors??0);
    const rawStatus=String(row.check_status??"");
    const checkStatus:CheckDatasetItem["checkStatus"] = rawStatus==="RUNNING" || rawStatus==="PROCESSING" ? "RUNNING" : rawStatus==="DONE" ? "DONE" : rawStatus==="ERROR" ? "ERROR" : "READY";
    const dataDate=String(row.data_date);
    const [y,m]=dataDate.split("-");
    return {
      importBatchId:String(row.import_batch_id),
      treatmentGroup:row.treatment_group==="YHCT" ? "YHCT" : row.treatment_group==="GENERAL" ? "GENERAL" : null,
      fileName:String(row.file_name??""),facilityCode:row.facility_code?String(row.facility_code):null,
      dataDate,year:Number(y??params.year),month:Number(m??params.month),totalCases,
      importStatus:String(row.import_status??""),importStartedAt:formatTimestamp(row.import_started_at),
      importFinishedAt:formatTimestamp(row.import_finished_at),checkStatus,
      checkRunId:row.check_run_id?String(row.check_run_id):null,
      checkStartedAt:formatTimestamp(row.check_started_at),checkFinishedAt:formatTimestamp(row.check_finished_at),
      errorCases,okCases:checkStatus==="DONE"?Math.max(0,totalCases-errorCases):0
    };
  });
  return {items,total:items.length};
}
