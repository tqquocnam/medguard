import type { RuleValidator, RuleResult, ValidationRule } from "../rule.types.js";
import { formatDateTime } from "../date-utils.js";

interface ActivityRow {
  event_id: string;
  staff_code: string;
  staff_name: string;
  activity_type: string;
  item_code:
    string |
    null;
  item_name:
    string |
    null;
  activity_time:
    Date;
  has_schedule:
    boolean;
  has_active:
    boolean;
  matching_schedule_id:
    string |
    null;
  schedule_start:
    string |
    null;
  schedule_end:
    string |
    null;
}
interface ScheduleViolation {
  type:
    | "STAFF_SCHEDULE_MISSING"
    | "STAFF_SCHEDULE_OFF"
    | "STAFF_SCHEDULE_OUTSIDE_TIME";
  staffCode:
    string;
  staffName:
    string;
  eventId:
    string;
  activityType:
    string;
  itemCode:
    string |
    null;
  itemName:
    string |
    null;
  activityTime:
    string;
  scheduleStart?:
    string |
    null;
  scheduleEnd?:
    string |
    null;
  message:
    string;
}
function normalizeTime(
  value:
    string |
    null |
    undefined
): string {
  if (
    !value
  ) {
    return "";
  }
  return String(
    value
  ).slice(
    0,
    5
  );
}
const legacyStaffScheduleRule:
  RuleValidator = {
  async evaluate(
    context,
    rule,
    runtime
  ) {
    const {
      client,
    } =
      runtime;
    const caseId =
      context.medicalCase.id;
    const result =
      await client.query<
        ActivityRow
      >(
        `
        WITH event_times AS (
          SELECT
            e.id
              AS event_id,
            e.event_type,
            e.item_code,
            e.item_name,
            e.raw_data,
            e.doctor_code,
            CASE
              WHEN
                COALESCE(
                  NULLIF(
                    e.raw_data ->> 'NGAY_TH_YL',
                    ''
                  ),
                  NULLIF(
                    e.raw_data ->> 'NGAY_THUC_HIEN',
                    ''
                  ),
                  NULLIF(
                    e.raw_data ->> 'NGAY_THUC_HIEN_YL',
                    ''
                  ),
                  NULLIF(
                    e.raw_data ->> 'NGAY_KQ',
                    ''
                  ),
                  NULLIF(
                    e.raw_data ->> 'NGAY_YL',
                    ''
                  ),
                  NULLIF(
                    e.raw_data ->> 'NGAY_CHI_DINH',
                    ''
                  ),
                  NULLIF(
                    e.raw_data ->> 'NGAY_KE_DON',
                    ''
                  )
                )
                ~ '^[0-9]{14}$'
              THEN
                TO_TIMESTAMP(
                  COALESCE(
                    NULLIF(
                      e.raw_data ->> 'NGAY_TH_YL',
                      ''
                    ),
                    NULLIF(
                      e.raw_data ->> 'NGAY_THUC_HIEN',
                      ''
                    ),
                    NULLIF(
                      e.raw_data ->> 'NGAY_THUC_HIEN_YL',
                      ''
                    ),
                    NULLIF(
                      e.raw_data ->> 'NGAY_KQ',
                      ''
                    ),
                    NULLIF(
                      e.raw_data ->> 'NGAY_YL',
                      ''
                    ),
                    NULLIF(
                      e.raw_data ->> 'NGAY_CHI_DINH',
                      ''
                    ),
                    NULLIF(
                      e.raw_data ->> 'NGAY_KE_DON',
                      ''
                    )
                  ),
                  'YYYYMMDDHH24MISS'
                )
              WHEN
                COALESCE(
                  NULLIF(
                    e.raw_data ->> 'NGAY_TH_YL',
                    ''
                  ),
                  NULLIF(
                    e.raw_data ->> 'NGAY_THUC_HIEN',
                    ''
                  ),
                  NULLIF(
                    e.raw_data ->> 'NGAY_THUC_HIEN_YL',
                    ''
                  ),
                  NULLIF(
                    e.raw_data ->> 'NGAY_KQ',
                    ''
                  ),
                  NULLIF(
                    e.raw_data ->> 'NGAY_YL',
                    ''
                  ),
                  NULLIF(
                    e.raw_data ->> 'NGAY_CHI_DINH',
                    ''
                  ),
                  NULLIF(
                    e.raw_data ->> 'NGAY_KE_DON',
                    ''
                  )
                )
                ~ '^[0-9]{12}$'
              THEN
                TO_TIMESTAMP(
                  COALESCE(
                    NULLIF(
                      e.raw_data ->> 'NGAY_TH_YL',
                      ''
                    ),
                    NULLIF(
                      e.raw_data ->> 'NGAY_THUC_HIEN',
                      ''
                    ),
                    NULLIF(
                      e.raw_data ->> 'NGAY_THUC_HIEN_YL',
                      ''
                    ),
                    NULLIF(
                      e.raw_data ->> 'NGAY_KQ',
                      ''
                    ),
                    NULLIF(
                      e.raw_data ->> 'NGAY_YL',
                      ''
                    ),
                    NULLIF(
                      e.raw_data ->> 'NGAY_CHI_DINH',
                      ''
                    ),
                    NULLIF(
                      e.raw_data ->> 'NGAY_KE_DON',
                      ''
                    )
                  ),
                  'YYYYMMDDHH24MI'
                )
              ELSE
                e.start_time
            END
              AS activity_time
          FROM
            core.medical_events e
          WHERE
            e.medical_case_id =
            $1::uuid
        ),
        event_staff AS (
          SELECT DISTINCT
            et.event_id,
            et.event_type,
            et.item_code,
            et.item_name,
            et.activity_time,
            BTRIM(
              split_code
            )
              AS staff_code
          FROM
            event_times et
          CROSS JOIN LATERAL
          (
            VALUES
              (
                et.raw_data ->>
                'NGUOI_THUC_HIEN'
              ),
              (
                et.raw_data ->>
                'MA_BAC_SI'
              ),
              (
                et.raw_data ->>
                'MA_BS_DOC_KQ'
              ),
              (
                et.doctor_code
              )
          )
          AS staff_source(
            staff_code
          )
          CROSS JOIN LATERAL
            REGEXP_SPLIT_TO_TABLE(
              COALESCE(
                staff_source.staff_code,
                ''
              ),
              '[;|,]+'
            )
              AS split_code
          WHERE
            NULLIF(
              BTRIM(
                split_code
              ),
              ''
            )
            IS NOT NULL
            AND
            et.activity_time
            IS NOT NULL
        ),
        matched_staff AS (
          SELECT DISTINCT
            es.event_id,
            es.event_type,
            es.item_code,
            es.item_name,
            es.activity_time,
            es.staff_code,
            ms.id
              AS staff_id,
            ms.full_name
              AS staff_name
          FROM
            event_staff es
          INNER JOIN
            catalog.medical_staff ms
          ON
            ms.active =
            true
            AND
            (
              LOWER(
                REGEXP_REPLACE(
                  BTRIM(
                    COALESCE(
                      ms.license_number,
                      ''
                    )
                  ),
                  '\\\s+',
                  '',
                  'g'
                )
              )
              =
              LOWER(
                REGEXP_REPLACE(
                  BTRIM(
                    es.staff_code
                  ),
                  '\\\s+',
                  '',
                  'g'
                )
              )
              OR
              LOWER(
                REGEXP_REPLACE(
                  BTRIM(
                    COALESCE(
                      ms.social_insurance_code,
                      ''
                    )
                  ),
                  '\\\s+',
                  '',
                  'g'
                )
              )
              =
              LOWER(
                REGEXP_REPLACE(
                  BTRIM(
                    es.staff_code
                  ),
                  '\\\s+',
                  '',
                  'g'
                )
              )
            )
        )
        SELECT
          ms.event_id,
          ms.staff_code,
          ms.staff_name,
          COALESCE(
            ms.event_type,
            ''
          )
            AS activity_type,
          ms.item_code,
          ms.item_name,
          ms.activity_time,
          schedule_info.has_schedule,
          schedule_info.has_active,
          schedule_info.matching_schedule_id,
          schedule_info.schedule_start,
          schedule_info.schedule_end
        FROM
          matched_staff ms
        CROSS JOIN LATERAL
        (
          SELECT
            EXISTS
            (
              SELECT
                1
              FROM
                catalog.medical_staff_schedules s
              WHERE
                s.staff_id =
                ms.staff_id
                AND
                s.work_date =
                ms.activity_time::date
            )
              AS has_schedule,
            EXISTS
            (
              SELECT
                1
              FROM
                catalog.medical_staff_schedules s
              WHERE
                s.staff_id =
                ms.staff_id
                AND
                s.work_date =
                ms.activity_time::date
                AND
                s.status =
                'ACTIVE'
            )
              AS has_active,
            (
              SELECT
                s.id
              FROM
                catalog.medical_staff_schedules s
              WHERE
                s.staff_id =
                ms.staff_id
                AND
                s.work_date =
                ms.activity_time::date
                AND
                s.status =
                'ACTIVE'
                AND
                ms.activity_time::time
                >=
                s.start_time
                AND
                ms.activity_time::time
                <=
                s.end_time
              ORDER BY
                s.start_time ASC
              LIMIT
                1
            )
              AS matching_schedule_id,
            (
              SELECT
                s.start_time::text
              FROM
                catalog.medical_staff_schedules s
              WHERE
                s.staff_id =
                ms.staff_id
                AND
                s.work_date =
                ms.activity_time::date
                AND
                s.status =
                'ACTIVE'
              ORDER BY
                s.start_time ASC
              LIMIT
                1
            )
              AS schedule_start,
            (
              SELECT
                s.end_time::text
              FROM
                catalog.medical_staff_schedules s
              WHERE
                s.staff_id =
                ms.staff_id
                AND
                s.work_date =
                ms.activity_time::date
                AND
                s.status =
                'ACTIVE'
              ORDER BY
                s.start_time ASC
              LIMIT
                1
            )
              AS schedule_end
        )
          AS schedule_info
        ORDER BY
          ms.activity_time ASC
        `,
        [
          caseId,
        ]
      );
    if (
      result.rows.length ===
      0
    ) {
      return {
        ruleId:
          rule.id,
        ruleCode:
          rule.code,
        status:
          "SKIP",
        severity:
          rule.severity,
        message:
          "Không có hoạt động nhân viên hợp lệ để kiểm tra lịch làm việc.",
        issueCount:
          0,
        details: {
          checkedActivities:
            0,
          violations:
            [],
        },
      };
    }
    const violations:
      ScheduleViolation[] =
      [];
    const seen =
      new Set<
        string
      >();
    let checkedActivities =
      0;
    for (
      const row
      of result.rows
    ) {
      checkedActivities++;
      const activityTime =
        new Date(
          row.activity_time
        );
      const activityTimeText =
        formatDateTime(
          activityTime
        );
        const activityDate =
  activityTimeText.slice(
    0,
    10
  );
const normalizedStaffCode =
  String(
    row.staff_code
  )
    .trim()
    .toLowerCase();
      if (
        !row.has_schedule
      ) {
    const key =
  [
    "MISSING",
    normalizedStaffCode,
    activityDate,
  ].join(
    "|"
  );
        if (
          seen.has(
            key
          )
        ) {
          continue;
        }
        seen.add(
          key
        );
        violations.push({
          type:
            "STAFF_SCHEDULE_MISSING",
          staffCode:
            row.staff_code,
          staffName:
            row.staff_name,
          eventId:
            row.event_id,
          activityType:
            row.activity_type,
          itemCode:
            row.item_code,
          itemName:
            row.item_name,
          activityTime:
            activityTimeText,
        message:
  `${row.staff_name} (${row.staff_code}) có phát sinh hoạt động ngày ${activityDate} nhưng không có lịch làm việc đăng ký.`,
        });
        continue;
      }
      if (
        !row.has_active
      ) {
       const key =
  [
    "OFF",
    normalizedStaffCode,
    activityDate,
  ].join(
    "|"
  );
        if (
          seen.has(
            key
          )
        ) {
          continue;
        }
        seen.add(
          key
        );
        violations.push({
          type:
            "STAFF_SCHEDULE_OFF",
          staffCode:
            row.staff_code,
          staffName:
            row.staff_name,
          eventId:
            row.event_id,
          activityType:
            row.activity_type,
          itemCode:
            row.item_code,
          itemName:
            row.item_name,
          activityTime:
            activityTimeText,
         message:
  `${row.staff_name} (${row.staff_code}) có phát sinh hoạt động ngày ${activityDate} nhưng được đăng ký nghỉ.`,
        });
        continue;
      }
      if (
        !row.matching_schedule_id
      ) {
        const key =
  [
    "OUTSIDE",
    normalizedStaffCode,
    activityDate,
  ].join(
    "|"
  );
        if (
          seen.has(
            key
          )
        ) {
          continue;
        }
        seen.add(
          key
        );
        const start =
          normalizeTime(
            row.schedule_start
          );
        const end =
          normalizeTime(
            row.schedule_end
          );
        violations.push({
          type:
            "STAFF_SCHEDULE_OUTSIDE_TIME",
          staffCode:
            row.staff_code,
          staffName:
            row.staff_name,
          eventId:
            row.event_id,
          activityType:
            row.activity_type,
          itemCode:
            row.item_code,
          itemName:
            row.item_name,
          activityTime:
            activityTimeText,
          scheduleStart:
            start,
          scheduleEnd:
            end,
         message:
  `${row.staff_name} (${row.staff_code}) thực hiện lúc ${activityTimeText}, ngoài lịch làm việc ${start} - ${end}.`,
        });
      }
    }
    if (
      violations.length >
      0
    ) {
      return {
        ruleId:
          rule.id,
        ruleCode:
          rule.code,
        status:
          "FAIL",
        severity:
          rule.severity,
        message:
          `Phát hiện ${violations.length} trường hợp nhân viên làm việc không phù hợp lịch trực.`,
        issueCount:
          violations.length,
        details: {
          checkedActivities,
          violations,
        },
      };
    }
    return {
      ruleId:
        rule.id,
      ruleCode:
        rule.code,
      status:
        "PASS",
      severity:
        rule.severity,
      message:
        `Đã đối chiếu ${checkedActivities} hoạt động với lịch làm việc, không phát hiện sai lệch.`,
      issueCount:
        0,
      details: {
        checkedActivities,
        violations:
          [],
      },
    };
  },
};


// Lịch làm việc ngoại trú YHCT.
// XML3.MA_BAC_SI + NGAY_YL: người chỉ định.
// XML3.NGUOI_THUC_HIEN + NGAY_TH_YL: người thực hiện.
// Không dùng ngày thực hiện để kiểm tra lịch bác sĩ chỉ định.
// Không suy đoán người ký xuất viện từ XML1.NGAY_RA.

type Role = "ORDER" | "PERFORM";
type ViolationType =
  | "STAFF_SCHEDULE_MISSING"
  | "STAFF_SCHEDULE_OFF"
  | "STAFF_SCHEDULE_OUTSIDE_TIME";

interface YhctActivityRow {
  event_id: string;
  staff_code: string;
  staff_name: string;
  activity_type: Role;
  item_code: string | null;
  item_name: string | null;
  activity_time: Date | string;
  activity_time_text: string;
  has_schedule: boolean;
  has_active: boolean;
  matching_schedule_id: string | null;
  schedule_start: string | null;
  schedule_end: string | null;
}

interface YhctScheduleViolation {
  type: ViolationType;
  staffCode: string;
  staffName: string;
  eventId: string;
  activityType: Role;
  itemCode: string | null;
  itemName: string | null;
  activityTime: string;
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
  message: string;
}

function resultFor(
  rule: ValidationRule,
  status: RuleResult["status"],
  message: string,
  details: Record<string, unknown>,
  issueCount = 0,
): RuleResult {
  return {
    ruleId: rule.id,
    ruleCode: rule.code,
    status,
    severity: rule.severity,
    message,
    issueCount,
    details,
  };
}

function time5(value: string | null): string {
  return (value ?? "").slice(0, 5);
}

const yhctStaffScheduleRule: RuleValidator = {
  async evaluate(context, rule, runtime) {
    const mc = context.medicalCase as typeof context.medicalCase & {
      treatment_group?: string | null;
    };

    // Chỉ đổi nghiệp vụ YHCT. GENERAL không bị chấm bằng logic mới.
    if (String(mc.treatment_group ?? "").trim().toUpperCase() !== "YHCT") {
      return resultFor(rule, "SKIP", "Quy tắc lịch nhân viên phiên bản này chỉ áp dụng YHCT.", {
        skipReason: "NOT_YHCT",
        treatmentGroup: mc.treatment_group ?? null,
        checkedActivities: 0,
        violations: [],
      });
    }

    const query = await runtime.client.query<YhctActivityRow>(
      `
      WITH source_events AS (
        SELECT
          e.id::text AS event_id,
          e.item_code,
          e.item_name,
          e.raw_data,
          mc.ma_loai_kcb
        FROM core.medical_events e
        JOIN core.medical_cases mc ON mc.id = e.medical_case_id
        WHERE e.medical_case_id = $1::uuid
          AND mc.treatment_group = 'YHCT'
          AND LPAD(BTRIM(COALESCE(mc.ma_loai_kcb, '')), 2, '0') = '02'
          AND UPPER(BTRIM(COALESCE(e.source_type, ''))) = 'XML3'
      ),
      roles AS (
        SELECT
          se.event_id,
          se.item_code,
          se.item_name,
          role_info.activity_type,
          BTRIM(code) AS staff_code,
          role_info.raw_time
        FROM source_events se
        CROSS JOIN LATERAL (
          VALUES
            ('ORDER'::text,
              NULLIF(BTRIM(COALESCE(se.raw_data ->> 'MA_BAC_SI', '')), ''),
              NULLIF(BTRIM(COALESCE(se.raw_data ->> 'NGAY_YL', '')), '')),
            ('PERFORM'::text,
              NULLIF(BTRIM(COALESCE(se.raw_data ->> 'NGUOI_THUC_HIEN', '')), ''),
              NULLIF(BTRIM(COALESCE(se.raw_data ->> 'NGAY_TH_YL', '')), ''))
        ) AS role_info(activity_type, staff_list, raw_time)
        CROSS JOIN LATERAL REGEXP_SPLIT_TO_TABLE(
          COALESCE(role_info.staff_list, ''), '[;|,]+'
        ) AS code
        WHERE NULLIF(BTRIM(code), '') IS NOT NULL
          AND role_info.raw_time ~ '^[0-9]{12}([0-9]{2})?$'
      ),
      activity_times AS (
        SELECT DISTINCT
          r.event_id,
          r.item_code,
          r.item_name,
          r.activity_type,
          r.staff_code,
          CASE
            WHEN length(r.raw_time) = 14 THEN
              to_timestamp(r.raw_time, 'YYYYMMDDHH24MISS')::timestamp
            ELSE
              to_timestamp(r.raw_time, 'YYYYMMDDHH24MI')::timestamp
          END AS activity_time
        FROM roles r
      ),
      matched_staff AS (
        SELECT
          a.*,
          ms.id AS staff_id,
          ms.full_name AS staff_name
        FROM activity_times a
        JOIN catalog.medical_staff ms
          ON ms.active = true
          AND (
            LOWER(REGEXP_REPLACE(BTRIM(COALESCE(ms.license_number, '')), '[[:space:]]+', '', 'g'))
              = LOWER(REGEXP_REPLACE(a.staff_code, '[[:space:]]+', '', 'g'))
            OR LOWER(REGEXP_REPLACE(BTRIM(COALESCE(ms.social_insurance_code, '')), '[[:space:]]+', '', 'g'))
              = LOWER(REGEXP_REPLACE(a.staff_code, '[[:space:]]+', '', 'g'))
          )
      )
      SELECT
        m.event_id,
        m.staff_code,
        m.staff_name,
        m.activity_type,
        m.item_code,
        m.item_name,
        m.activity_time,
        TO_CHAR(m.activity_time, 'YYYY-MM-DD HH24:MI:SS') AS activity_time_text,
        schedule_info.has_schedule,
        schedule_info.has_active,
        schedule_info.matching_schedule_id,
        schedule_info.schedule_start,
        schedule_info.schedule_end
      FROM matched_staff m
      CROSS JOIN LATERAL (
        SELECT
          EXISTS (
            SELECT 1 FROM catalog.medical_staff_schedules s
            WHERE s.staff_id = m.staff_id
              AND (s.work_date = m.activity_time::date
                OR s.work_date = m.activity_time::date - 1)
          ) AS has_schedule,
          EXISTS (
            SELECT 1 FROM catalog.medical_staff_schedules s
            WHERE s.staff_id = m.staff_id
              AND s.status = 'ACTIVE'
              AND (s.work_date = m.activity_time::date
                OR (s.work_date = m.activity_time::date - 1
                  AND s.end_time < s.start_time))
          ) AS has_active,
          (
            SELECT s.id::text
            FROM catalog.medical_staff_schedules s
            WHERE s.staff_id = m.staff_id
              AND s.status = 'ACTIVE'
              AND (
                (s.work_date = m.activity_time::date
                  AND m.activity_time::time >= s.start_time
                  AND (s.end_time >= s.start_time
                    AND m.activity_time::time <= s.end_time
                    OR s.end_time < s.start_time))
                OR (s.work_date = m.activity_time::date - 1
                  AND s.end_time < s.start_time
                  AND m.activity_time::time <= s.end_time)
              )
            ORDER BY s.work_date DESC, s.start_time ASC
            LIMIT 1
          ) AS matching_schedule_id,
          (
            SELECT s.start_time::text
            FROM catalog.medical_staff_schedules s
            WHERE s.staff_id = m.staff_id
              AND s.work_date = m.activity_time::date
              AND s.status = 'ACTIVE'
            ORDER BY s.start_time LIMIT 1
          ) AS schedule_start,
          (
            SELECT s.end_time::text
            FROM catalog.medical_staff_schedules s
            WHERE s.staff_id = m.staff_id
              AND s.work_date = m.activity_time::date
              AND s.status = 'ACTIVE'
            ORDER BY s.start_time LIMIT 1
          ) AS schedule_end
      ) AS schedule_info
      ORDER BY m.activity_time, m.activity_type, m.staff_code
      `,
      [context.medicalCase.id],
    );

    const violations: YhctScheduleViolation[] = [];
    const seen = new Set<string>();
    let checkedActivities = 0;
    let checkedOrders = 0;
    let checkedPerformances = 0;

    for (const row of query.rows) {
      checkedActivities++;
      if (row.activity_type === "ORDER") checkedOrders++;
      if (row.activity_type === "PERFORM") checkedPerformances++;

      const date = row.activity_time_text.slice(0, 10);
      const roleDescription = row.activity_type === "ORDER"
        ? "ra y lệnh"
        : "thực hiện kỹ thuật";

      let type: ViolationType | null = null;
      let message = "";
      if (!row.has_schedule) {
        type = "STAFF_SCHEDULE_MISSING";
        message = `${row.staff_name} (${row.staff_code}) ${roleDescription} ngày ${date} nhưng không có lịch làm việc đăng ký.`;
      } else if (!row.has_active) {
        type = "STAFF_SCHEDULE_OFF";
        message = `${row.staff_name} (${row.staff_code}) ${roleDescription} ngày ${date} nhưng không có ca ACTIVE.`;
      } else if (!row.matching_schedule_id) {
        type = "STAFF_SCHEDULE_OUTSIDE_TIME";
        message = `${row.staff_name} (${row.staff_code}) ${roleDescription} lúc ${row.activity_time_text}, ngoài lịch ${time5(row.schedule_start)} - ${time5(row.schedule_end)}.`;
      }
      if (!type) continue;

      // Cùng nhân viên, cùng ngày, cùng vai trò và loại lỗi: chỉ báo 1 lần.
      const key = [type, row.staff_code.trim().toLowerCase(), date, row.activity_type].join("|");
      if (seen.has(key)) continue;
      seen.add(key);

      violations.push({
        type,
        staffCode: row.staff_code,
        staffName: row.staff_name,
        eventId: row.event_id,
        activityType: row.activity_type,
        itemCode: row.item_code,
        itemName: row.item_name,
        activityTime: row.activity_time_text,
        scheduleStart: row.schedule_start,
        scheduleEnd: row.schedule_end,
        message,
      });
    }

    const details = {
      scope: "OUTPATIENT_YHCT",
      checkedActivities,
      checkedOrders,
      checkedPerformances,
      violations,
      note: "Kiểm tra người chỉ định theo NGAY_YL, người thực hiện theo NGAY_TH_YL. Không coi MA_BAC_SI là người thực hiện kỹ thuật.",
    };

    if (checkedActivities === 0) {
      return resultFor(rule, "SKIP", "Không tìm thấy hoạt động XML3 YHCT có nhân viên khớp danh mục để đối chiếu lịch.", details);
    }
    if (violations.length) {
      return resultFor(rule, "FAIL", `Phát hiện ${violations.length} trường hợp cần rà soát lịch làm việc theo đúng vai trò.`, details, violations.length);
    }
    return resultFor(rule, "PASS", `Đã đối chiếu ${checkedOrders} lượt ra y lệnh và ${checkedPerformances} lượt thực hiện kỹ thuật với lịch nhân viên.`, details);
  },
};


// Phân luồng: giữ nguyên thuật toán GENERAL hiện hành.
// Chỉ hồ sơ YHCT mới tách người chỉ định / người thực hiện.
export const staffScheduleRule: RuleValidator = {
  async evaluate(context, rule, runtime) {
    const medicalCase = context.medicalCase as typeof context.medicalCase & {
      treatment_group?: string | null;
    };
    if (String(medicalCase.treatment_group ?? "").trim().toUpperCase() === "YHCT") {
      return yhctStaffScheduleRule.evaluate(context, rule, runtime);
    }
    return legacyStaffScheduleRule.evaluate(context, rule, runtime);
  },
};
