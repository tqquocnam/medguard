import { db } from "../../config/database.js";

export class ScheduleError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export interface StaffScheduleInput {
  staffId: string;
  workDate: string;
  startTime: string;
  endTime: string;
  status?: "ACTIVE" | "OFF";
  source?: "MANUAL" | "DEFAULT";
  note?: string | null;
}

export interface GenerateDefaultScheduleInput {
  staffId: string;
  year: number;
  month: number;
}

function branch(value: string): void {
  if (!value) {
    throw new ScheduleError("Chưa xác định chi nhánh.", 403);
  }
}

function uuid(value: string): void {
  const pattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

  if (!pattern.test(value)) {
    throw new ScheduleError("ID không hợp lệ.");
  }
}

function checkInput(input: StaffScheduleInput): void {
  uuid(String(input.staffId ?? ""));

  const timePattern = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.workDate ?? "") ||
    !timePattern.test(input.startTime ?? "") ||
    !timePattern.test(input.endTime ?? "") ||
    !["ACTIVE", "OFF"].includes(input.status ?? "ACTIVE") ||
    !["MANUAL", "DEFAULT"].includes(input.source ?? "MANUAL")
  ) {
    throw new ScheduleError("Thông tin lịch làm việc không hợp lệ.");
  }
}

function requireRow(rows: any[]) {
  if (!rows[0]) {
    throw new ScheduleError("Không tìm thấy lịch hoặc nhân viên trong chi nhánh.", 404);
  }

  return rows[0];
}

export async function listStaffSchedules(params: {
  branchId: string;
  staffId?: string;
  year?: number;
  month?: number;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  branch(params.branchId);

  if (params.staffId) {
    uuid(params.staffId);
  }

  const result = await db.query(
    `
    WITH filtered AS (
      SELECT
        s.id::text AS id,
        s.staff_id::text AS "staffId",
        ms.full_name AS "fullName",

        NULLIF(
          ms.social_insurance_code, ''
        ) AS "socialInsuranceCode",

        NULLIF(
          ms.license_number, ''
        ) AS "licenseNumber",

        TO_CHAR(
          s.work_date, 'YYYY-MM-DD'
        ) AS "workDate",

        TO_CHAR(
          s.start_time, 'HH24:MI'
        ) AS "startTime",

        TO_CHAR(
          s.end_time, 'HH24:MI'
        ) AS "endTime",

        s.status,
        s.source,
        s.note

      FROM catalog.medical_staff_schedules s

      JOIN catalog.medical_staff ms
        ON ms.id = s.staff_id
        AND ms.branch_id = $1

      WHERE
        s.branch_id = $1

        AND (
          $2::uuid IS NULL
          OR s.staff_id = $2::uuid
        )

        AND (
          $3::integer IS NULL
          OR EXTRACT(YEAR FROM s.work_date)::integer = $3
        )

        AND (
          $4::integer IS NULL
          OR EXTRACT(MONTH FROM s.work_date)::integer = $4
        )

        AND (
          $5::text IS NULL
          OR s.status = $5
        )
    )

    SELECT
      (
        SELECT COUNT(*)::integer
        FROM filtered
      ) AS total,

      COALESCE(
        (
          SELECT jsonb_agg(
            p ORDER BY
              p."workDate",
              p."fullName",
              p."startTime",
              p.id
          )

          FROM (
            SELECT *
            FROM filtered

            ORDER BY
              "workDate",
              "fullName",
              "startTime",
              id

            LIMIT $6
            OFFSET $7
          ) p
        ),
        '[]'::jsonb
      ) AS items
    `,
    [
      params.branchId,
      params.staffId || null,
      params.year ?? null,
      params.month ?? null,
      params.status || null,
      params.limit ?? 50,
      params.offset ?? 0,
    ],
  );

  return {
    items: result.rows[0].items,
    total: Number(result.rows[0].total),
  };
}

export async function createStaffSchedule(branchId: string, input: StaffScheduleInput) {
  branch(branchId);
  checkInput(input);

  const result = await db.query(
    `
    INSERT INTO catalog.medical_staff_schedules (
      branch_id,
      staff_id,
      work_date,
      start_time,
      end_time,
      status,
      source,
      note
    )
    SELECT
      $1,
      ms.id,
      $3::date,
      $4::time,
      $5::time,
      $6,
      $7,
      $8
    FROM catalog.medical_staff ms
    WHERE
      ms.id = $2::uuid
      AND ms.branch_id = $1
    RETURNING *
    `,
    [
      branchId,
      input.staffId,
      input.workDate,
      input.startTime,
      input.endTime,
      input.status ?? "ACTIVE",
      input.source ?? "MANUAL",
      input.note ?? null,
    ],
  );

  return requireRow(result.rows);
}

export async function updateStaffSchedule(branchId: string, id: string, input: StaffScheduleInput) {
  branch(branchId);
  uuid(id);
  checkInput(input);

  const result = await db.query(
    `
    UPDATE catalog.medical_staff_schedules s

    SET
      staff_id = ms.id,
      work_date = $4::date,
      start_time = $5::time,
      end_time = $6::time,
      status = $7,
      source = $8,
      note = $9,
      updated_at = NOW()

    FROM catalog.medical_staff ms

    WHERE
      s.id = $2::uuid
      AND s.branch_id = $1
      AND ms.id = $3::uuid
      AND ms.branch_id = $1

    RETURNING s.*
    `,
    [
      branchId,
      id,
      input.staffId,
      input.workDate,
      input.startTime,
      input.endTime,
      input.status ?? "ACTIVE",
      input.source ?? "MANUAL",
      input.note ?? null,
    ],
  );

  return requireRow(result.rows);
}

export async function deleteStaffSchedule(branchId: string, id: string) {
  branch(branchId);
  uuid(id);

  const result = await db.query(
    `
    DELETE FROM catalog.medical_staff_schedules
    WHERE
      id = $2::uuid
      AND branch_id = $1
    RETURNING id
    `,
    [branchId, id],
  );

  requireRow(result.rows);

  return true;
}

export async function generateDefaultSchedule(
  branchId: string,
  input: GenerateDefaultScheduleInput,
) {
  branch(branchId);
  uuid(input.staffId);

  const { staffId, year, month } = input;

  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new ScheduleError("Năm hoặc tháng không hợp lệ.");
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      SELECT pg_advisory_xact_lock(
        hashtextextended($1, 0)
      )
      `,
      [`schedule:${branchId}:${staffId}:${year}:${month}`],
    );

    const staffResult = await client.query(
      `
      SELECT *
      FROM catalog.medical_staff
      WHERE
        id = $2::uuid
        AND branch_id = $1
        AND active = TRUE
      FOR SHARE
      `,
      [branchId, staffId],
    );

    const staff = requireRow(staffResult.rows);

    const dailyTime = String(staff.daily_time ?? "");

    const weeklyTime = String(staff.weekly_time ?? "");

    const daily = dailyTime.replace(/\s/g, "").match(/^(\d{2})(\d{2})-(\d{2})(\d{2})$/);

    if (
      !daily ||
      Number(daily[1]) > 23 ||
      Number(daily[3]) > 23 ||
      Number(daily[2]) > 59 ||
      Number(daily[4]) > 59
    ) {
      throw new ScheduleError("Thời gian ngày của nhân viên không hợp lệ.");
    }

    const startTime = `${daily[1]}:${daily[2]}`;

    const endTime = `${daily[3]}:${daily[4]}`;

    const tokens =
      weeklyTime
        .toUpperCase()
        .replace(/\s/g, "")
        .match(/CN|T[2-7]/g) ?? [];

    const weekdays = [
      ...new Set(tokens.map((token) => (token === "CN" ? 0 : Number(token[1]) - 1))),
    ];

    if (!weekdays.length) {
      throw new ScheduleError("Nhân viên chưa có Thời gian tuần hợp lệ.");
    }

    const firstDate = `${year}-${String(month).padStart(2, "0")}-01`;

    const result = await client.query(
      `
      WITH eligible AS (
        SELECT d::date AS work_date

        FROM generate_series(
          $3::date::timestamp,

          (
            $3::date
            + INTERVAL '1 month - 1 day'
          )::timestamp,

          INTERVAL '1 day'
        ) d

        WHERE
          EXTRACT(DOW FROM d)::integer
          = ANY($6::integer[])
      ),

      inserted AS (
        INSERT INTO catalog.medical_staff_schedules (
          branch_id,
          staff_id,
          work_date,
          start_time,
          end_time,
          status,
          source
        )
        SELECT
          $1,
          $2::uuid,
          e.work_date,
          $4::time,
          $5::time,
          'ACTIVE',
          'DEFAULT'

        FROM eligible e

        WHERE NOT EXISTS (
          SELECT 1
          FROM catalog.medical_staff_schedules s
          WHERE
            s.branch_id = $1
            AND s.staff_id = $2::uuid
            AND s.work_date = e.work_date
        )

        ON CONFLICT DO NOTHING
        RETURNING work_date
      )

      SELECT
        COALESCE(
          array_agg(
            TO_CHAR(
              e.work_date, 'YYYY-MM-DD'
            )
            ORDER BY e.work_date
          ) FILTER (
            WHERE i.work_date IS NOT NULL
          ),
          ARRAY[]::text[]
        ) AS created_dates,

        COALESCE(
          array_agg(
            TO_CHAR(
              e.work_date, 'YYYY-MM-DD'
            )
            ORDER BY e.work_date
          ) FILTER (
            WHERE i.work_date IS NULL
          ),
          ARRAY[]::text[]
        ) AS skipped_dates

      FROM eligible e

      LEFT JOIN inserted i
        ON i.work_date = e.work_date
      `,
      [branchId, staffId, firstDate, startTime, endTime, weekdays],
    );

    const createdDates: string[] = result.rows[0].created_dates;

    const skippedDates: string[] = result.rows[0].skipped_dates;

    await client.query("COMMIT");

    return {
      staff: {
        id: String(staff.id),
        fullName: staff.full_name,

        socialInsuranceCode: staff.social_insurance_code || null,

        licenseNumber: staff.license_number || null,
      },

      year,
      month,
      dailyTime,
      weeklyTime,
      startTime,
      endTime,
      weekdays,

      inserted: createdDates.length,
      skipped: skippedDates.length,
      createdDates,
      skippedDates,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
