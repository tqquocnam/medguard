
import type { Pool, PoolClient } from 'pg';

import {
  extractExamDoctors,
  type Xml3Service,
} from './exam-doctor.extractor';

export async function replaceCaseExamDoctors(
  client: PoolClient,
  maLk: string,
  xml3Rows: Xml3Service[]
): Promise<number> {
  const records = extractExamDoctors(maLk, xml3Rows);

  await client.query(
    `DELETE FROM core.medical_case_exam_doctors
     WHERE ma_lk = $1`,
    [maLk]
  );

  for (const r of records) {
    await client.query(
      `INSERT INTO core.medical_case_exam_doctors
       (
         ma_lk,
         doctor_code,
         service_code,
         service_name,
         order_time
       )
       VALUES ($1, $2, $3, $4, $5)`,
      [
        r.maLk,
        r.doctorCode,
        r.serviceCode,
        r.serviceName,
        r.orderTime,
      ]
    );
  }

  return records.length;
}

export async function listExamDoctorCodes(pool: Pool) {
  const result = await pool.query<{
    doctor_code: string;
    case_count: string;
  }>(
    `SELECT
       doctor_code,
       COUNT(DISTINCT ma_lk)::text AS case_count
     FROM core.medical_case_exam_doctors
     GROUP BY doctor_code
     ORDER BY doctor_code`
  );

  return result.rows.map((x) => ({
    code: x.doctor_code,
    caseCount: Number(x.case_count),
  }));
}

export const doctorExistsSql = (
  paramIndex: number,
  caseAlias = 'mc'
) => `
  EXISTS (
    SELECT 1
    FROM core.medical_case_exam_doctors ed
    WHERE ed.ma_lk = ${caseAlias}.ma_lk
      AND ed.doctor_code = $${paramIndex}
  )
`;
