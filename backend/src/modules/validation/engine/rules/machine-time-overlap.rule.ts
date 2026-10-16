import type { RuleValidator } from "../rule.types.js";
import { formatDateTime } from "../date-utils.js";

interface MachineOverlapRow {
  source_event_id: string;
  conflict_event_id: string;
  conflict_case_id: string;
  conflict_ma_bn: string | null;
  conflict_patient_name: string | null;
  machine_code: string;
  source_item_code: string | null;
  source_item_name: string | null;
  conflict_item_code: string | null;
  conflict_item_name: string | null;
  source_start: Date;
  source_end: Date;
  conflict_start: Date;
  conflict_end: Date;
  overlap_minutes: number;
}

/**
 * MACHINE_TIME_OVERLAP
 * Kiểm tra hai hồ sơ sử dụng cùng một máy điện tim trong khoảng thời gian giao nhau.
 * Bắt đầu: XML3.NGAY_TH_YL. Kết thúc: XML3.NGAY_KQ.
 * Không dùng medical_events.start_time/end_time vì chúng có thể mang ý nghĩa khác.
 * Không dùng doctor_code / performer_code làm khóa máy.
 */
export const machineTimeOverlapRule: RuleValidator = {
  async evaluate(context, rule, runtime) {
    const caseId = context.medicalCase.id;
    const config = rule.config ?? {};
    const minOverlapMinutes = Math.max(0, Number(config.minOverlapMinutes ?? 0));
    if (!Number.isFinite(minOverlapMinutes)) {
      throw new Error("MACHINE_TIME_OVERLAP: minOverlapMinutes không hợp lệ");
    }

    const query = await runtime.client.query<MachineOverlapRow>(
      `
      WITH source_payment AS MATERIALIZED (
        SELECT ngay_ttoan::date AS payment_day
        FROM core.medical_cases WHERE id = $1::uuid
      ),
      -- Giới hạn theo ngày thanh toán để tránh quét toàn bộ bảng.
      scoped_events AS MATERIALIZED (
        SELECT e.id, e.medical_case_id, e.item_code, e.item_name, e.raw_data
        FROM core.medical_events e
        JOIN core.medical_cases mc ON mc.id = e.medical_case_id
        CROSS JOIN source_payment p
        WHERE (
          (mc.ngay_ttoan >= p.payment_day - INTERVAL '1 day'
           AND mc.ngay_ttoan < p.payment_day + INTERVAL '2 days')
          OR mc.id = $1::uuid
        )
          AND UPPER(COALESCE(e.source_type, '')) = 'XML3'
          AND LOWER(COALESCE(e.item_name, '')) LIKE '%điện tim%'
          AND NULLIF(BTRIM(e.raw_data ->> 'MA_MAY'), '') IS NOT NULL
      ),
      raw_times AS MATERIALIZED (
        SELECT e.*,
               BTRIM(e.raw_data ->> 'MA_MAY') AS machine_code,
               BTRIM(COALESCE(e.raw_data ->> 'NGAY_TH_YL', '')) AS raw_start,
               BTRIM(COALESCE(e.raw_data ->> 'NGAY_KQ', '')) AS raw_end
        FROM scoped_events e
      ),
      time_values AS MATERIALIZED (
        SELECT r.*,
          CASE
            WHEN raw_start ~ '^[0-9]{12}$' THEN to_timestamp(raw_start, 'YYYYMMDDHH24MI')::timestamp
            WHEN raw_start ~ '^[0-9]{14}$' THEN to_timestamp(raw_start, 'YYYYMMDDHH24MISS')::timestamp
            ELSE NULL
          END AS activity_start,
          CASE
            WHEN raw_end ~ '^[0-9]{12}$' THEN to_timestamp(raw_end, 'YYYYMMDDHH24MI')::timestamp
            WHEN raw_end ~ '^[0-9]{14}$' THEN to_timestamp(raw_end, 'YYYYMMDDHH24MISS')::timestamp
            ELSE NULL
          END AS activity_end
        FROM raw_times r
      ),
      valid_events AS MATERIALIZED (
        SELECT * FROM time_values
        WHERE activity_start IS NOT NULL
          AND activity_end IS NOT NULL
          AND activity_end > activity_start
      ),
      machine_conflicts AS (
        SELECT
          a.id AS source_event_id,
          b.id AS conflict_event_id,
          b.medical_case_id AS conflict_case_id,
          mc.ma_bn AS conflict_ma_bn,
          mc.ho_ten AS conflict_patient_name,
          a.machine_code,
          a.item_code AS source_item_code,
          a.item_name AS source_item_name,
          b.item_code AS conflict_item_code,
          b.item_name AS conflict_item_name,
          a.activity_start AS source_start,
          a.activity_end AS source_end,
          b.activity_start AS conflict_start,
          b.activity_end AS conflict_end,
          EXTRACT(EPOCH FROM (
            LEAST(a.activity_end, b.activity_end)
            - GREATEST(a.activity_start, b.activity_start)
          )) / 60.0 AS overlap_minutes
        FROM valid_events a
        JOIN valid_events b
          ON a.machine_code = b.machine_code
         AND a.medical_case_id <> b.medical_case_id
         AND a.activity_start < b.activity_end
         AND b.activity_start < a.activity_end
        JOIN core.medical_cases mc ON mc.id = b.medical_case_id
        WHERE a.medical_case_id = $1::uuid
      )
      SELECT * FROM machine_conflicts
      WHERE overlap_minutes > $2::numeric
      ORDER BY source_start, conflict_start, source_event_id, conflict_event_id
      `,
      [caseId, minOverlapMinutes],
    );

    const rows = query.rows;
    if (rows.length === 0) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,
        status: "PASS",
        severity: rule.severity,
        issueCount: 0,
        message: "Không phát hiện trùng thời gian sử dụng máy điện tim giữa các hồ sơ.",
        details: { conflictCount: 0, violations: [] },
      };
    }

    const conflicts = new Map<string, { caseId: string; maBn: string | null; hoTen: string | null }>();
    const violations = rows.map((row, index) => {
      conflicts.set(row.conflict_case_id, {
        caseId: row.conflict_case_id,
        maBn: row.conflict_ma_bn,
        hoTen: row.conflict_patient_name,
      });
      const overlapMinutes = Number(row.overlap_minutes);
      const displayMessage =
        `${row.machine_code} [${row.source_item_name ?? "Dịch vụ"}: ` +
        `${formatDateTime(row.source_start)} -> ${formatDateTime(row.source_end)} ` +
        `(Trùng máy ${overlapMinutes.toFixed(2)} phút) ` +
        `${row.conflict_patient_name ?? "Không rõ bệnh nhân"} - ` +
        `${row.conflict_item_name ?? "Dịch vụ"}: ` +
        `${formatDateTime(row.conflict_start)} -> ${formatDateTime(row.conflict_end)}]`;
      return {
        index: index + 1,
        type: "MACHINE_TIME_OVERLAP",
        sourceEventId: row.source_event_id,
        conflictEventId: row.conflict_event_id,
        sourceCaseId: caseId,
        conflictCaseId: row.conflict_case_id,
        conflictPatientCode: row.conflict_ma_bn,
        conflictPatientName: row.conflict_patient_name,
        machineCode: row.machine_code,
        sourceActivity: "MACHINE_EXECUTION",
        conflictActivity: "MACHINE_EXECUTION",
        sourceItemCode: row.source_item_code,
        sourceItemName: row.source_item_name,
        conflictItemCode: row.conflict_item_code,
        conflictItemName: row.conflict_item_name,
        sourceStart: formatDateTime(row.source_start),
        sourceEnd: formatDateTime(row.source_end),
        conflictStart: formatDateTime(row.conflict_start),
        conflictEnd: formatDateTime(row.conflict_end),
        overlapMinutes,
        displayMessage,
      };
    });
    const conflictCases = [...conflicts.values()];
    return {
      ruleId: rule.id,
      ruleCode: rule.code,
      status: "FAIL",
      severity: rule.severity,
      issueCount: violations.length,
      message: `Phát hiện ${violations.length} lần trùng thời gian máy điện tim với ${conflictCases.length} hồ sơ khác.`,
      details: {
        conflictCount: violations.length,
        conflictCaseCount: conflictCases.length,
        conflictCases,
        violations,
      },
    };
  },
};
