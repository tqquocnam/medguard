import dayjs from "dayjs";

import {
  db,
} from "../../config/database.js";


// ======================================================
// TYPES
// ======================================================

export interface StaffScheduleInput {

  staffId: string;

  workDate: string;

  startTime: string;

  endTime: string;

  status?:
    "ACTIVE" |
    "OFF";

  source?:
    "MANUAL" |
    "DEFAULT";

  note?:
    string |
    null;

}


export interface GenerateDefaultScheduleInput {

  staffId:
    string;

  year:
    number;

  month:
    number;

}


// ======================================================
// HELPERS
// ======================================================

function normalizeText(
  value:
    unknown
): string {

  return String(
    value ??
    ""
  ).trim();

}


function parseDailyTime(
  value:
    unknown
) {

  const text =
    normalizeText(
      value
    )
      .replace(
        /\s+/g,
        ""
      );


  const match =
    text.match(
      /^(\d{4})-(\d{4})$/
    );


  if (
    !match
  ) {

    throw new Error(
      `Thời gian ngày không hợp lệ: ${text || "(trống)"}.`
    );

  }


  const startRaw =
    match[1];

  const endRaw =
    match[2];


  const startHour =
    Number(
      startRaw.slice(
        0,
        2
      )
    );

  const startMinute =
    Number(
      startRaw.slice(
        2,
        4
      )
    );


  const endHour =
    Number(
      endRaw.slice(
        0,
        2
      )
    );

  const endMinute =
    Number(
      endRaw.slice(
        2,
        4
      )
    );


  if (
    startHour >
      23 ||
    endHour >
      23 ||
    startMinute >
      59 ||
    endMinute >
      59
  ) {

    throw new Error(
      `Thời gian ngày không hợp lệ: ${text}.`
    );

  }


  const startTime =
    `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`;


  const endTime =
    `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;


  return {
    startTime,
    endTime,
  };

}


// ======================================================
// PARSE WEEKLY TIME
//
// CNT2T3T4T5T6T7
//
// JavaScript:
// 0 = CN
// 1 = T2
// 2 = T3
// 3 = T4
// 4 = T5
// 5 = T6
// 6 = T7
// ======================================================

function parseWeeklyTime(
  value:
    unknown
): number[] {

  const text =
    normalizeText(
      value
    )
      .toUpperCase()
      .replace(
        /\s+/g,
        ""
      );


  if (
    !text
  ) {

    throw new Error(
      "Nhân viên chưa có cấu hình Thời gian tuần."
    );

  }


  const weekdays =
    new Set<
      number
    >();


  if (
    text.includes(
      "CN"
    )
  ) {

    weekdays.add(
      0
    );

  }


  if (
    text.includes(
      "T2"
    )
  ) {

    weekdays.add(
      1
    );

  }


  if (
    text.includes(
      "T3"
    )
  ) {

    weekdays.add(
      2
    );

  }


  if (
    text.includes(
      "T4"
    )
  ) {

    weekdays.add(
      3
    );

  }


  if (
    text.includes(
      "T5"
    )
  ) {

    weekdays.add(
      4
    );

  }


  if (
    text.includes(
      "T6"
    )
  ) {

    weekdays.add(
      5
    );

  }


  if (
    text.includes(
      "T7"
    )
  ) {

    weekdays.add(
      6
    );

  }


  if (
    weekdays.size ===
    0
  ) {

    throw new Error(
      `Không đọc được Thời gian tuần: ${text}.`
    );

  }


  return [
    ...weekdays,
  ];

}


// ======================================================
// LIST
// ======================================================

export async function listStaffSchedules(
  params: {

    staffId?:
      string;

    year?:
      number;

    month?:
      number;

    status?:
      string;

    limit?:
      number;

    offset?:
      number;

  }
) {

  const {

    staffId,
    year,
    month,
    status,

    limit =
      50,

    offset =
      0,

  } =
    params;


  const conditions:
    string[] =
    [];


  const values:
    unknown[] =
    [];


  if (
    staffId
  ) {

    values.push(
      staffId
    );

    conditions.push(
      `s.staff_id = $${values.length}::uuid`
    );

  }


  if (
    year
  ) {

    values.push(
      year
    );

    conditions.push(
      `EXTRACT(YEAR FROM s.work_date)::int = $${values.length}`
    );

  }


  if (
    month
  ) {

    values.push(
      month
    );

    conditions.push(
      `EXTRACT(MONTH FROM s.work_date)::int = $${values.length}`
    );

  }


  if (
    status
  ) {

    values.push(
      status
    );

    conditions.push(
      `s.status = $${values.length}`
    );

  }


  const whereSql =
    conditions.length >
    0

      ? `WHERE ${conditions.join(" AND ")}`

      : "";


  values.push(
    limit
  );

  const limitIndex =
    values.length;


  values.push(
    offset
  );

  const offsetIndex =
    values.length;


  const result =
    await db.query(
      `
      SELECT

        s.id,

        s.staff_id,

        ms.full_name,

        ms.social_insurance_code,

        ms.license_number,

        s.work_date,

        s.start_time,

        s.end_time,

        s.status,

        s.source,

        s.note,

        s.created_at,

        s.updated_at

      FROM
        catalog.medical_staff_schedules s

      INNER JOIN
        catalog.medical_staff ms

        ON
          ms.id =
          s.staff_id

      ${whereSql}

      ORDER BY

        s.work_date ASC,

        ms.full_name ASC,

        s.start_time ASC

      LIMIT
        $${limitIndex}

      OFFSET
        $${offsetIndex}
      `,
      values
    );


  const countValues =
    values.slice(
      0,
      values.length -
      2
    );


  const countResult =
    await db.query(
      `
      SELECT
        COUNT(*)::int
          AS total

      FROM
        catalog.medical_staff_schedules s

      ${whereSql}
      `,
      countValues
    );


  return {

    items:
      result.rows.map(
        (
          row
        ) => ({

          id:
            String(
              row.id
            ),

          staffId:
            String(
              row.staff_id
            ),

          fullName:
            String(
              row.full_name
            ),

          socialInsuranceCode:
            row.social_insurance_code
              ? String(
                  row.social_insurance_code
                )
              : null,

          licenseNumber:
            row.license_number
              ? String(
                  row.license_number
                )
              : null,

          workDate:
            dayjs(
              row.work_date
            ).format(
              "YYYY-MM-DD"
            ),

          startTime:
            String(
              row.start_time
            ).slice(
              0,
              5
            ),

          endTime:
            String(
              row.end_time
            ).slice(
              0,
              5
            ),

          status:
            String(
              row.status
            ),

          source:
            String(
              row.source
            ),

          note:
            row.note
              ? String(
                  row.note
                )
              : null,

        })
      ),

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
// CREATE MANUAL
// ======================================================

export async function createStaffSchedule(
  input:
    StaffScheduleInput
) {

  const staffId =
    normalizeText(
      input.staffId
    );


  const workDate =
    normalizeText(
      input.workDate
    );


  const startTime =
    normalizeText(
      input.startTime
    );


  const endTime =
    normalizeText(
      input.endTime
    );


  if (
    !staffId ||
    !workDate ||
    !startTime ||
    !endTime
  ) {

    throw new Error(
      "Thiếu thông tin lịch làm việc."
    );

  }


  const result =
    await db.query(
      `
      INSERT INTO
        catalog.medical_staff_schedules
      (
        staff_id,

        work_date,

        start_time,

        end_time,

        status,

        source,

        note,

        created_at,

        updated_at
      )

      VALUES
      (
        $1::uuid,

        $2::date,

        $3::time,

        $4::time,

        $5,

        $6,

        $7,

        NOW(),

        NOW()
      )

      RETURNING
        *
      `,
      [

        staffId,

        workDate,

        startTime,

        endTime,

        input.status ??
          "ACTIVE",

        input.source ??
          "MANUAL",

        input.note ??
          null,

      ]
    );


  return result.rows[0];

}


// ======================================================
// UPDATE
// ======================================================

export async function updateStaffSchedule(
  id:
    string,

  input:
    StaffScheduleInput
) {

  const result =
    await db.query(
      `
      UPDATE
        catalog.medical_staff_schedules

      SET

        staff_id =
          $2::uuid,

        work_date =
          $3::date,

        start_time =
          $4::time,

        end_time =
          $5::time,

        status =
          $6,

        source =
          $7,

        note =
          $8,

        updated_at =
          NOW()

      WHERE
        id =
        $1::uuid

      RETURNING
        *
      `,
      [

        id,

        input.staffId,

        input.workDate,

        input.startTime,

        input.endTime,

        input.status ??
          "ACTIVE",

        input.source ??
          "MANUAL",

        input.note ??
          null,

      ]
    );


  if (
    result.rowCount ===
    0
  ) {

    throw new Error(
      "Không tìm thấy lịch làm việc."
    );

  }


  return result.rows[0];

}


// ======================================================
// DELETE
// ======================================================

export async function deleteStaffSchedule(
  id:
    string
) {

  const result =
    await db.query(
      `
      DELETE FROM
        catalog.medical_staff_schedules

      WHERE
        id =
        $1::uuid

      RETURNING
        id
      `,
      [
        id,
      ]
    );


  if (
    result.rowCount ===
    0
  ) {

    throw new Error(
      "Không tìm thấy lịch làm việc."
    );

  }


  return true;

}


// ======================================================
// GENERATE DEFAULT
//
// Đọc:
// medical_staff.daily_time
// medical_staff.weekly_time
//
// Ví dụ:
//
// daily_time:
// 0700-1900
//
// weekly_time:
// CNT2T3T4T5T6T7
//
// ======================================================

export async function generateDefaultSchedule(
  input:
    GenerateDefaultScheduleInput
) {

  const {

    staffId,
    year,
    month,

  } =
    input;


  if (
    !staffId
  ) {

    throw new Error(
      "Vui lòng chọn nhân viên."
    );

  }


  if (
    !year ||
    year <
      2000 ||
    year >
      2100
  ) {

    throw new Error(
      "Năm không hợp lệ."
    );

  }


  if (
    !month ||
    month <
      1 ||
    month >
      12
  ) {

    throw new Error(
      "Tháng không hợp lệ."
    );

  }


  // ==================================================
  // LOAD STAFF
  // ==================================================

  const staffResult =
    await db.query(
      `
      SELECT

        id,

        full_name,

        social_insurance_code,

        license_number,

        daily_time,

        weekly_time

      FROM
        catalog.medical_staff

      WHERE
        id =
        $1::uuid

        AND active =
        true

      LIMIT
        1
      `,
      [
        staffId,
      ]
    );


  if (
    staffResult.rowCount ===
    0
  ) {

    throw new Error(
      "Không tìm thấy nhân viên đang hoạt động."
    );

  }


  const staff =
    staffResult.rows[0];


  const {
    startTime,
    endTime,
  } =
    parseDailyTime(
      staff.daily_time
    );


  const weekdays =
    parseWeeklyTime(
      staff.weekly_time
    );


  // ==================================================
  // LOOP ALL DAYS OF MONTH
  // ==================================================

  const firstDay =
    dayjs(
      `${year}-${String(month).padStart(2, "0")}-01`
    );


  const daysInMonth =
    firstDay.daysInMonth();


  let inserted =
    0;


  let skipped =
    0;


  const createdDates:
    string[] =
    [];


  const skippedDates:
    string[] =
    [];


  const client =
    await db.connect();


  try {

    await client.query(
      "BEGIN"
    );


    for (
      let day =
        1;
      day <=
        daysInMonth;
      day++
    ) {

      const currentDate =
        firstDay.date(
          day
        );


      const jsWeekday =
        currentDate.day();


      if (
        !weekdays.includes(
          jsWeekday
        )
      ) {

        continue;

      }


      const workDate =
        currentDate.format(
          "YYYY-MM-DD"
        );


      // ==================================================
      // KIỂM TRA ĐÃ CÓ LỊCH NGÀY ĐÓ CHƯA
      //
      // Nếu có bất kỳ lịch nào:
      // không ghi đè
      // ==================================================

      const existingResult =
        await client.query(
          `
          SELECT

            id,

            start_time,

            end_time,

            source

          FROM
            catalog.medical_staff_schedules

          WHERE
            staff_id =
            $1::uuid

            AND work_date =
            $2::date

          LIMIT
            1
          `,
          [
            staffId,
            workDate,
          ]
        );


      if (
        existingResult.rowCount &&
        existingResult.rowCount >
        0
      ) {

        skipped++;

        skippedDates.push(
          workDate
        );

        continue;

      }


      await client.query(
        `
        INSERT INTO
          catalog.medical_staff_schedules
        (
          staff_id,

          work_date,

          start_time,

          end_time,

          status,

          source,

          note,

          created_at,

          updated_at
        )

        VALUES
        (
          $1::uuid,

          $2::date,

          $3::time,

          $4::time,

          'ACTIVE',

          'DEFAULT',

          NULL,

          NOW(),

          NOW()
        )

        ON CONFLICT
        DO NOTHING
        `,
        [

          staffId,

          workDate,

          startTime,

          endTime,

        ]
      );


      inserted++;


      createdDates.push(
        workDate
      );

    }


    await client.query(
      "COMMIT"
    );


    return {

      staff: {

        id:
          String(
            staff.id
          ),

        fullName:
          String(
            staff.full_name
          ),

        socialInsuranceCode:
          staff.social_insurance_code
            ? String(
                staff.social_insurance_code
              )
            : null,

        licenseNumber:
          staff.license_number
            ? String(
                staff.license_number
              )
            : null,

      },

      year,

      month,

      dailyTime:
        String(
          staff.daily_time
        ),

      weeklyTime:
        String(
          staff.weekly_time
        ),

      startTime,

      endTime,

      weekdays,

      inserted,

      skipped,

      createdDates,

      skippedDates,

    };

  } catch (
    error
  ) {

    await client.query(
      "ROLLBACK"
    );


    throw error;

  } finally {

    client.release();

  }

}