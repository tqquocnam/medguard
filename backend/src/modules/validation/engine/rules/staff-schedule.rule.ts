import type {
  RuleValidator,
} from "../rule.types.js";

import {
  formatDateTime,
} from "../date-utils.js";


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


export const staffScheduleRule:
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
                  '\\s+',
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
                  '\\s+',
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
                  '\\s+',
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
                  '\\s+',
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