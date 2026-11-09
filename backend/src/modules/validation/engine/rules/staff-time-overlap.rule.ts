import type { RuleValidator } from "../rule.types.js";
import { formatDateTime } from "../date-utils.js";

interface ConflictRow {
  source_event_id: string;
  conflict_event_id: string;
  conflict_case_id: string;
  conflict_ma_bn: string | null;
  conflict_patient_name: string | null;
  staff_code: string;
  source_activity: string;
  conflict_activity: string;
  source_item_code: string | null;
  source_item_name: string | null;
  conflict_item_code: string | null;
  conflict_item_name: string | null;
  source_start: Date;
  source_end: Date;
  conflict_start: Date;
  conflict_end: Date;
}

function formatActivityTime(start: Date, end: Date): string {
  const startText = formatDateTime(start);

  if (start.getTime() === end.getTime()) {
    return startText;
  }

  return `${startText} -> ${formatDateTime(end)}`;
}

function formatActivityName(activityType: string, itemName: string | null): string {
  const name = itemName?.trim() || "Hoạt động";

  switch (activityType) {
    case "SERVICE_ORDER":
      return `Thời gian y lệnh ${name}`;

    case "ECG_RESULT_DOCTOR_EXAM":
      return `Thời gian đọc kết quả ${name}`;

    default:
      return name;
  }
}

export const staffTimeOverlapRule: RuleValidator = {
  async evaluate(context, rule, runtime) {
    const { client } = runtime;
    const caseId = context.medicalCase.id;

    const examWindowMinutes = Number(rule.config?.examWindowMinutes ?? 5);

    const query = await client.query<ConflictRow>(
      `
        WITH

        -- Giới hạn hồ sơ đối chiếu quanh ngày thanh toán.
        source_day AS MATERIALIZED (
          SELECT ngay_ttoan::date AS payment_day
          FROM core.medical_cases
          WHERE id = $1::uuid
        ),

        scope_cases AS MATERIALIZED (
          SELECT mc.id
          FROM core.medical_cases mc
          CROSS JOIN source_day sd
          WHERE mc.ngay_ttoan >=
                sd.payment_day - INTERVAL '1 day'
            AND mc.ngay_ttoan <
                sd.payment_day + INTERVAL '2 day'

          UNION

          SELECT $1::uuid
        ),

        -- Đọc riêng từng mốc thời gian từ XML3/XML2.
        event_times AS MATERIALIZED (
          SELECT
            e.*,

            CASE
              WHEN TRIM(
                COALESCE(e.raw_data ->> 'NGAY_YL', '')
              ) ~ '^[0-9]{14}$'
              THEN TO_TIMESTAMP(
                TRIM(e.raw_data ->> 'NGAY_YL'),
                'YYYYMMDDHH24MISS'
              )::timestamp without time zone

              WHEN TRIM(
                COALESCE(e.raw_data ->> 'NGAY_YL', '')
              ) ~ '^[0-9]{12}$'
              THEN TO_TIMESTAMP(
                TRIM(e.raw_data ->> 'NGAY_YL'),
                'YYYYMMDDHH24MI'
              )::timestamp without time zone

              ELSE NULL
            END AS order_time,

            CASE
              WHEN TRIM(
                COALESCE(e.raw_data ->> 'NGAY_TH_YL', '')
              ) ~ '^[0-9]{14}$'
              THEN TO_TIMESTAMP(
                TRIM(e.raw_data ->> 'NGAY_TH_YL'),
                'YYYYMMDDHH24MISS'
              )::timestamp without time zone

              WHEN TRIM(
                COALESCE(e.raw_data ->> 'NGAY_TH_YL', '')
              ) ~ '^[0-9]{12}$'
              THEN TO_TIMESTAMP(
                TRIM(e.raw_data ->> 'NGAY_TH_YL'),
                'YYYYMMDDHH24MI'
              )::timestamp without time zone

              ELSE NULL
            END AS execution_start,

            CASE
              WHEN TRIM(
                COALESCE(e.raw_data ->> 'NGAY_KQ', '')
              ) ~ '^[0-9]{14}$'
              THEN TO_TIMESTAMP(
                TRIM(e.raw_data ->> 'NGAY_KQ'),
                'YYYYMMDDHH24MISS'
              )::timestamp without time zone

              WHEN TRIM(
                COALESCE(e.raw_data ->> 'NGAY_KQ', '')
              ) ~ '^[0-9]{12}$'
              THEN TO_TIMESTAMP(
                TRIM(e.raw_data ->> 'NGAY_KQ'),
                'YYYYMMDDHH24MI'
              )::timestamp without time zone

              ELSE NULL
            END AS execution_end

          FROM core.medical_events e

          INNER JOIN scope_cases sc
            ON sc.id = e.medical_case_id
        ),

        -- Công khám tiếp theo của cùng bác sĩ,
        -- trong cùng hồ sơ.
        exam_windows AS MATERIALIZED (
          SELECT
            ex.id AS exam_event_id,
            ex.medical_case_id,
            NULLIF(TRIM(ex.doctor_code), '') AS doctor_code,
            ex.start_time,

            LEAD(ex.start_time) OVER (
              PARTITION BY
                ex.medical_case_id,
                NULLIF(TRIM(ex.doctor_code), '')
              ORDER BY ex.start_time, ex.id
            ) AS next_exam_start

          FROM event_times ex

          WHERE ex.start_time IS NOT NULL
            AND (
              UPPER(COALESCE(ex.event_type, '')) = 'EXAM'
              OR LOWER(
                TRIM(COALESCE(ex.item_name, ''))
              ) LIKE 'khám%'
            )
        ),

        -- Xác định CLS riêng cho từng công khám.
        -- Thuốc XML2 không tính là CLS.
        exam_flags AS MATERIALIZED (
          SELECT
            ex.exam_event_id,
            COUNT(svc.id) > 0 AS has_cls

          FROM exam_windows ex

          LEFT JOIN event_times svc
            ON svc.medical_case_id = ex.medical_case_id

           AND NULLIF(TRIM(svc.doctor_code), '') =
               ex.doctor_code

           AND UPPER(COALESCE(svc.event_type, ''))
               IN ('SERVICE', 'LAB', 'CLS', 'DVKT')

           AND LOWER(
                 TRIM(COALESCE(svc.item_name, ''))
               ) NOT LIKE 'khám%'

           AND svc.order_time >= ex.start_time

           AND (
             ex.next_exam_start IS NULL
             OR svc.order_time < ex.next_exam_start
           )

          GROUP BY ex.exam_event_id
        ),

        -- Đọc danh sách kết quả XML4 một lần
        -- cho các hồ sơ nằm trong phạm vi đối chiếu.
        xml4_result_rows AS MATERIALIZED (
          SELECT
            xf.medical_case_id,
            results.result_row

          FROM core.medical_xml_files xf

          INNER JOIN scope_cases sc
            ON sc.id = xf.medical_case_id

          CROSS JOIN LATERAL (
            SELECT COALESCE(
              xf.parsed_data::jsonb
                #> '{CHITIEU_CHITIET_DICHVUCANLAMSANG,DSACH_CHI_TIET_CLS,CHI_TIET_CLS}',

              xf.parsed_data::jsonb
                #> '{DSACH_CHI_TIET_CLS,CHI_TIET_CLS}',

              '[]'::jsonb
            ) AS result_rows
          ) payload

          CROSS JOIN LATERAL jsonb_array_elements(
            CASE jsonb_typeof(payload.result_rows)
              WHEN 'array'
                THEN payload.result_rows
              WHEN 'object'
                THEN jsonb_build_array(payload.result_rows)
              ELSE '[]'::jsonb
            END
          ) AS results(result_row)

          WHERE UPPER(TRIM(xf.xml_type)) = 'XML4'
        ),

        -- Chuẩn hóa khóa ghép và người đọc kết quả.
        xml4_result_values AS MATERIALIZED (
          SELECT
            medical_case_id,

            NULLIF(
              TRIM(result_row ->> 'MA_DICH_VU'),
              ''
            ) AS service_code,

            CASE
              WHEN TRIM(
                COALESCE(result_row ->> 'NGAY_KQ', '')
              ) ~ '^[0-9]{12}([0-9]{2})?$'

              THEN RPAD(
                TRIM(result_row ->> 'NGAY_KQ'),
                14,
                '0'
              )

              ELSE NULL
            END AS result_time_key,

            NULLIF(
              TRIM(result_row ->> 'MA_BS_DOC_KQ'),
              ''
            ) AS reader_code

          FROM xml4_result_rows
        ),

        -- Một dịch vụ có nhiều chỉ số XML4:
        -- chỉ tạo một mốc đọc kết quả khi xác định
        -- được đúng một mã bác sĩ đọc.
        xml4_result_readers AS MATERIALIZED (
          SELECT
            medical_case_id,
            service_code,
            result_time_key,
            MIN(reader_code) AS staff_code

          FROM xml4_result_values

          WHERE service_code IS NOT NULL
            AND result_time_key IS NOT NULL

          GROUP BY
            medical_case_id,
            service_code,
            result_time_key

          HAVING COUNT(DISTINCT reader_code) = 1
        ),

        activities AS MATERIALIZED (

          -- A. Công khám:
          -- có CLS thì dùng mốc bắt đầu;
          -- không CLS thì dùng khoảng khám mặc định.
          SELECT
            e.id AS event_id,
            e.medical_case_id,
            NULLIF(TRIM(e.doctor_code), '') AS staff_code,
            'EXAM' AS activity_type,
            e.item_code,
            e.item_name,
            e.start_time AS activity_start,

            CASE
              WHEN COALESCE(cf.has_cls, FALSE)
                THEN e.start_time
              ELSE
                e.start_time
                + ($2::integer * INTERVAL '1 minute')
            END AS activity_end

          FROM event_times e

          LEFT JOIN exam_flags cf
            ON cf.exam_event_id = e.id

          WHERE e.start_time IS NOT NULL

            AND NULLIF(TRIM(e.doctor_code), '') IS NOT NULL

            AND (
              UPPER(COALESCE(e.event_type, '')) = 'EXAM'
              OR LOWER(
                COALESCE(e.item_name, '')
              ) LIKE 'khám%'
            )

          UNION ALL

          -- B. Y lệnh thuốc:
          -- NGAY_YL + bác sĩ chỉ định.
          SELECT
            e.id AS event_id,
            e.medical_case_id,
            NULLIF(TRIM(e.doctor_code), '') AS staff_code,
            'DRUG_ORDER' AS activity_type,
            e.item_code,
            e.item_name,
            e.order_time AS activity_start,
            e.order_time AS activity_end

          FROM event_times e

          WHERE UPPER(COALESCE(e.event_type, '')) = 'DRUG'

            AND e.order_time IS NOT NULL

            AND NULLIF(TRIM(e.doctor_code), '') IS NOT NULL

          UNION ALL

          -- C. Y lệnh CLS/DVKT:
          -- NGAY_YL + bác sĩ chỉ định.
          SELECT
            e.id AS event_id,
            e.medical_case_id,
            NULLIF(TRIM(e.doctor_code), '') AS staff_code,
            'SERVICE_ORDER' AS activity_type,
            e.item_code,
            e.item_name,
            e.order_time AS activity_start,
            e.order_time AS activity_end

          FROM event_times e

          WHERE UPPER(COALESCE(e.event_type, ''))
                IN ('SERVICE', 'LAB', 'CLS', 'DVKT')

            AND e.order_time IS NOT NULL

            AND NULLIF(TRIM(e.doctor_code), '') IS NOT NULL

            AND NOT (
              LOWER(COALESCE(e.item_name, '')) LIKE 'khám%'
            )

          UNION ALL

          -- D. Nội soi:
          -- khoảng thực hiện gắn với NGUOI_THUC_HIEN.
          SELECT
            e.id AS event_id,
            e.medical_case_id,

            NULLIF(
              TRIM(e.raw_data ->> 'NGUOI_THUC_HIEN'),
              ''
            ) AS staff_code,

            'SERVICE_EXECUTION' AS activity_type,
            e.item_code,
            e.item_name,
            e.execution_start AS activity_start,
            e.execution_end AS activity_end

          FROM event_times e

          WHERE UPPER(COALESCE(e.event_type, ''))
                IN ('SERVICE', 'LAB', 'CLS', 'DVKT')

            AND LOWER(
              COALESCE(e.item_name, '')
            ) LIKE '%nội soi%'

            AND NULLIF(
              TRIM(e.raw_data ->> 'NGUOI_THUC_HIEN'),
              ''
            ) IS NOT NULL

            AND e.execution_start IS NOT NULL
            AND e.execution_end IS NOT NULL
            AND e.execution_end > e.execution_start

          UNION ALL

          -- E. Đọc kết quả điện tim:
          -- lấy MA_BS_DOC_KQ từ XML4.
          --
          -- Ghép bằng:
          -- cùng hồ sơ + MA_DICH_VU + NGAY_KQ.
          --
          -- Không dùng STT để ghép XML3 với XML4.
          -- Không fallback sang bác sĩ chỉ định
          -- hoặc người thực hiện.
          SELECT
            e.id AS event_id,
            e.medical_case_id,
            reader.staff_code,
            'ECG_RESULT_DOCTOR_EXAM' AS activity_type,
            e.item_code,
            e.item_name,
            e.execution_end AS activity_start,
            e.execution_end AS activity_end

          FROM event_times e

          INNER JOIN xml4_result_readers reader
            ON reader.medical_case_id = e.medical_case_id

           AND reader.service_code = NULLIF(
             TRIM(e.raw_data ->> 'MA_DICH_VU'),
             ''
           )

           AND reader.result_time_key = CASE
             WHEN TRIM(
               COALESCE(e.raw_data ->> 'NGAY_KQ', '')
             ) ~ '^[0-9]{12}([0-9]{2})?$'

             THEN RPAD(
               TRIM(e.raw_data ->> 'NGAY_KQ'),
               14,
               '0'
             )

             ELSE NULL
           END

          WHERE UPPER(COALESCE(e.event_type, ''))
                IN ('SERVICE', 'LAB', 'CLS', 'DVKT')

            AND LOWER(
              COALESCE(e.item_name, '')
            ) LIKE '%điện tim%'

            AND e.execution_end IS NOT NULL
        ),

        source_activity AS (
          SELECT *
          FROM activities
          WHERE medical_case_id = $1::uuid
        ),

        target_activity AS (
          SELECT *
          FROM activities
          WHERE medical_case_id <> $1::uuid
        ),

        conflict_pairs AS (
          SELECT
            a.event_id AS source_event_id,
            b.event_id AS conflict_event_id,
            b.medical_case_id AS conflict_case_id,
            mc.ma_bn AS conflict_ma_bn,
            mc.ho_ten AS conflict_patient_name,
            a.staff_code,
            a.activity_type AS source_activity,
            b.activity_type AS conflict_activity,
            a.item_code AS source_item_code,
            a.item_name AS source_item_name,
            b.item_code AS conflict_item_code,
            b.item_name AS conflict_item_name,
            a.activity_start AS source_start,
            a.activity_end AS source_end,
            b.activity_start AS conflict_start,
            b.activity_end AS conflict_end

          FROM source_activity a

          INNER JOIN target_activity b
            ON a.staff_code = b.staff_code

          INNER JOIN core.medical_cases mc
            ON mc.id = b.medical_case_id

          WHERE a.event_id <> b.event_id

            -- Thuốc với công khám:
            -- chỉ quy lỗi chiều DRUG_ORDER -> EXAM.
            AND NOT (
              a.activity_type = 'EXAM'
              AND b.activity_type = 'DRUG_ORDER'
            )

            -- Thuốc với y lệnh dịch vụ:
            -- chỉ quy lỗi chiều DRUG_ORDER -> SERVICE_ORDER.
            AND NOT (
              a.activity_type = 'SERVICE_ORDER'
              AND b.activity_type = 'DRUG_ORDER'
            )

            -- Nội soi với thuốc:
            -- chỉ quy lỗi chiều DRUG_ORDER -> SERVICE_EXECUTION.
            AND NOT (
              a.activity_type = 'SERVICE_EXECUTION'
              AND b.activity_type = 'DRUG_ORDER'
            )

            -- Đọc kết quả điện tim với công khám:
            -- chỉ quy lỗi chiều điện tim -> công khám.
            AND NOT (
              a.activity_type = 'EXAM'
              AND b.activity_type = 'ECG_RESULT_DOCTOR_EXAM'
            )

            -- Nội soi chỉ đối chiếu với công khám và thuốc.
            AND (
              (
                a.activity_type <> 'SERVICE_EXECUTION'
                AND b.activity_type <> 'SERVICE_EXECUTION'
              )

              OR (
                a.activity_type = 'SERVICE_EXECUTION'
                AND b.activity_type IN ('EXAM', 'DRUG_ORDER')
              )

              OR (
                b.activity_type = 'SERVICE_EXECUTION'
                AND a.activity_type IN ('EXAM', 'DRUG_ORDER')
              )
            )

            AND (
              -- Các hoạt động thông thường.
              (
                a.activity_type NOT IN (
                  'SERVICE_EXECUTION',
                  'ECG_RESULT_DOCTOR_EXAM'
                )

                AND b.activity_type NOT IN (
                  'SERVICE_EXECUTION',
                  'ECG_RESULT_DOCTOR_EXAM'
                )

                AND (
                  -- Khoảng với khoảng.
                  (
                    a.activity_end > a.activity_start
                    AND b.activity_end > b.activity_start
                    AND a.activity_start < b.activity_end
                    AND b.activity_start < a.activity_end
                  )

                  OR

                  -- Hai công khám chạm mốc kết thúc:
                  -- quy lỗi cho công khám trước.
                  (
                    a.activity_type = 'EXAM'
                    AND b.activity_type = 'EXAM'
                    AND a.activity_end > a.activity_start
                    AND b.activity_end > b.activity_start
                    AND a.activity_end = b.activity_start
                  )

                  OR

                  -- Khoảng A với mốc B.
                  (
                    a.activity_end > a.activity_start
                    AND b.activity_end = b.activity_start
                    AND b.activity_start >= a.activity_start
                    AND b.activity_start <= a.activity_end
                  )

                  OR

                  -- Mốc A với khoảng B.
                  (
                    a.activity_end = a.activity_start
                    AND b.activity_end > b.activity_start
                    AND a.activity_start >= b.activity_start
                    AND a.activity_start <= b.activity_end
                  )

                  OR

                  -- Mốc với mốc.
                  (
                    a.activity_end = a.activity_start
                    AND b.activity_end = b.activity_start
                    AND a.activity_start = b.activity_start
                  )
                )
              )

              OR

              -- Y lệnh thuốc trùng giờ đọc kết quả điện tim.
              -- JOIN đã bảo đảm cùng mã nhân sự.
              -- Chỉ quy lỗi cho hồ sơ có y lệnh thuốc.
              (
                a.activity_type = 'DRUG_ORDER'
                AND b.activity_type = 'ECG_RESULT_DOCTOR_EXAM'
                AND a.activity_start = b.activity_start
              )

              OR

              -- Đọc kết quả điện tim trùng y lệnh CLS.
              (
                a.activity_type = 'ECG_RESULT_DOCTOR_EXAM'
                AND b.activity_type = 'SERVICE_ORDER'
                AND a.activity_start = b.activity_start
              )

              OR

              -- Chiều ngược:
              -- y lệnh CLS với đọc kết quả điện tim.
              (
                a.activity_type = 'SERVICE_ORDER'
                AND b.activity_type = 'ECG_RESULT_DOCTOR_EXAM'
                AND a.activity_start = b.activity_start
              )

              OR

              -- Đọc kết quả điện tim trùng công khám.
              -- Dùng khoảng khám đã tính theo CLS.
              (
                a.activity_type = 'ECG_RESULT_DOCTOR_EXAM'
                AND b.activity_type = 'EXAM'
                AND a.activity_start
                    BETWEEN b.activity_start AND b.activity_end
              )

              OR

              -- Nội soi với thuốc, gồm cả mốc kết thúc.
              (
                a.activity_type = 'SERVICE_EXECUTION'
                AND b.activity_type = 'DRUG_ORDER'
                AND b.activity_start >= a.activity_start
                AND b.activity_start <= a.activity_end
              )

              OR

              (
                b.activity_type = 'SERVICE_EXECUTION'
                AND a.activity_type = 'DRUG_ORDER'
                AND a.activity_start >= b.activity_start
                AND a.activity_start <= b.activity_end
              )

              OR

              -- Nội soi với công khám.
              (
                a.activity_type = 'SERVICE_EXECUTION'
                AND b.activity_type = 'EXAM'
                AND a.activity_start <= b.activity_end
                AND a.activity_end >= b.activity_start
              )

              OR

              (
                b.activity_type = 'SERVICE_EXECUTION'
                AND a.activity_type = 'EXAM'
                AND b.activity_start <= a.activity_end
                AND b.activity_end >= a.activity_start
              )
            )
        )

        SELECT DISTINCT
          cp.source_event_id,
          cp.conflict_event_id,
          cp.conflict_case_id,
          cp.conflict_ma_bn,
          cp.conflict_patient_name,
          cp.staff_code,
          cp.source_activity,
          cp.conflict_activity,
          cp.source_item_code,
          cp.source_item_name,
          cp.conflict_item_code,
          cp.conflict_item_name,
          cp.source_start,
          cp.source_end,
          cp.conflict_start,
          cp.conflict_end

        FROM conflict_pairs cp

        ORDER BY
          cp.source_start ASC,
          cp.conflict_start ASC,
          cp.source_event_id ASC,
          cp.conflict_event_id ASC
      `,
      [caseId, examWindowMinutes],
    );

    const conflicts = query.rows;

    if (conflicts.length === 0) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,
        status: "PASS",
        severity: rule.severity,
        issueCount: 0,
        message: "Không phát hiện trùng thời gian nhân viên giữa các hồ sơ.",
        details: {
          conflictCount: 0,
          conflictCaseId: null,
          conflictPatient: null,
          violations: [],
        },
      };
    }

    const first = conflicts[0];

    const conflictCaseMap = new Map<
      string,
      {
        caseId: string;
        maBn: string | null;
        hoTen: string | null;
      }
    >();

    for (const row of conflicts) {
      if (!conflictCaseMap.has(row.conflict_case_id)) {
        conflictCaseMap.set(row.conflict_case_id, {
          caseId: row.conflict_case_id,
          maBn: row.conflict_ma_bn,
          hoTen: row.conflict_patient_name,
        });
      }
    }

    const conflictCases = Array.from(conflictCaseMap.values());

    const violations = conflicts.map((row, index) => {
      const sourceTime = formatActivityTime(row.source_start, row.source_end);

      const conflictTime = formatActivityTime(row.conflict_start, row.conflict_end);

      const sourceName = formatActivityName(row.source_activity, row.source_item_name);

      const conflictName = formatActivityName(row.conflict_activity, row.conflict_item_name);

      const patientName = row.conflict_patient_name ?? "Không rõ bệnh nhân";

      const displayMessage =
        `${row.staff_code} ` +
        `[${sourceName}: ${sourceTime} ` +
        `(Trùng thời gian) ${patientName} - ` +
        `${conflictName}: ${conflictTime}]`;

      return {
        index: index + 1,
        sourceEventId: row.source_event_id,
        conflictEventId: row.conflict_event_id,
        sourceCaseId: caseId,
        conflictCaseId: row.conflict_case_id,
        staffCode: row.staff_code,
        sourceActivity: row.source_activity,
        conflictActivity: row.conflict_activity,
        sourceItemCode: row.source_item_code,
        sourceItemName: row.source_item_name,
        conflictItemCode: row.conflict_item_code,
        conflictItemName: row.conflict_item_name,
        sourceStart: formatDateTime(row.source_start),
        sourceEnd: formatDateTime(row.source_end),
        conflictStart: formatDateTime(row.conflict_start),
        conflictEnd: formatDateTime(row.conflict_end),
        conflictPatientName: row.conflict_patient_name,
        conflictPatientCode: row.conflict_ma_bn,
        conflictPatient: {
          maBn: row.conflict_ma_bn,
          hoTen: row.conflict_patient_name,
        },
        displayMessage,
      };
    });

    return {
      ruleId: rule.id,
      ruleCode: rule.code,
      status: "FAIL",
      severity: rule.severity,
      issueCount: violations.length,
      message:
        `Phát hiện ${violations.length} hoạt động trùng thời gian với ` +
        `${conflictCases.length} hồ sơ khác.`,
      details: {
        conflictCaseId: first.conflict_case_id,
        conflictPatient: {
          maBn: first.conflict_ma_bn,
          hoTen: first.conflict_patient_name,
        },
        conflictCount: violations.length,
        conflictCaseCount: conflictCases.length,
        conflictCases,
        violations,
      },
    };
  },
};
