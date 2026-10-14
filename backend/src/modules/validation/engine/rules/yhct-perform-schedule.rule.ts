
import type {
  RuleValidator,
  RuleResult,
  ValidationRule,
} from "../rule.types.js";

type Row = Record<string, unknown>;

type Activity = {
  stt: string;
  serviceCode: string;
  serviceName: string;
  staffCode: string;
  performedAt: string;
  performedMs: number;
  resultAt: string;
  resultMs: number | null;
};

type ScheduleRow = {
  staff_code: string;
  staff_id: string;
  staff_name: string;
  staff_active: boolean;
  has_any_schedule: boolean;
  schedule_id: string | null;
  work_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
};

type Finding = {
  type:
    | "NO_SCHEDULE_ON_DATE"
    | "OFF_SCHEDULE"
    | "OUTSIDE_WORKING_HOURS";
  stt: string;
  serviceCode: string;
  serviceName: string;
  staffCode: string;
  staffName: string;
  performedAt: string;
  resultAt: string;
  schedules: Array<{
    date: string;
    start: string;
    end: string;
    status: string;
  }>;
  message: string;
};

const DAY = 86400000;

function str(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function obj(value: unknown): Row | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Row)
    : null;
}

function first(value: unknown): Row | null {
  return obj(Array.isArray(value) ? value[0] : value);
}

function xml3Rows(value: unknown): Row[] {
  const root = first(value);
  const section = first(
    root?.CHITIEU_CHITIET_DVKT_VTYT
  );
  const list = first(
    section?.DSACH_CHI_TIET_DVKT
  );
  const data = list?.CHI_TIET_DVKT;
  const items = Array.isArray(data)
    ? data
    : data ? [data] : [];

  return items.filter(
    (item): item is Row => obj(item) !== null
  );
}

function normalizeCode(value: unknown): string {
  return str(value)
    .replace(/\s+/g, "")
    .toLowerCase();
}

function parseStaff(value: unknown): string[] {
  const unique = new Map<string, string>();

  for (const part of str(value).split(/[;|,]+/)) {
    const code = part.trim();
    const key = normalizeCode(code);

    if (key && !unique.has(key)) {
      unique.set(key, code);
    }
  }

  return [...unique.values()];
}

// Date.UTC chỉ dùng làm trục số để so sánh
// giờ địa phương trong XML.
// Không chuyển đổi múi giờ.
function localMs(value: string): number | null {
  if (!/^\d{12}(\d{2})?$/.test(value)) {
    return null;
  }

  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(4, 6));
  const d = Number(value.slice(6, 8));
  const h = Number(value.slice(8, 10));
  const min = Number(value.slice(10, 12));
  const sec = value.length === 14
    ? Number(value.slice(12, 14))
    : 0;

  const ms = Date.UTC(
    y, m - 1, d, h, min, sec
  );
  const dt = new Date(ms);

  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d ||
    dt.getUTCHours() !== h ||
    dt.getUTCMinutes() !== min ||
    dt.getUTCSeconds() !== sec
  ) {
    return null;
  }

  return ms;
}

function timeOfDay(value: string): number | null {
  const match =
    /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/
      .exec(value);

  if (!match) return null;

  const h = Number(match[1]);
  const m = Number(match[2]);
  const s = Number(match[3] ?? "0");

  if (h > 23 || m > 59 || s > 59) {
    return null;
  }

  return ((h * 60 + m) * 60 + s) * 1000;
}

function scheduleInterval(
  row: ScheduleRow
): [number, number] | null {
  const date = str(row.work_date);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const start = timeOfDay(
    str(row.start_time)
  );
  const end = timeOfDay(
    str(row.end_time)
  );
  const midnight = localMs(
    date.replace(/-/g, "") + "0000"
  );

  if (
    start === null ||
    end === null ||
    midnight === null ||
    start === end
  ) {
    return null;
  }

  return [
    midnight + start,
    midnight + end + (
      end < start ? DAY : 0
    ),
  ];
}

function dateIso(ms: number): string {
  return new Date(ms)
    .toISOString()
    .slice(0, 10);
}

// Nhiều ca ACTIVE liên tiếp có thể cùng
// bao phủ toàn bộ khoảng thực hiện kỹ thuật.
function isCovered(
  start: number,
  end: number,
  intervals: Array<[number, number]>
): boolean {
  const ordered = [...intervals].sort(
    (a, b) => a[0] - b[0]
  );

  let coveredUntil = start;

  for (const [from, to] of ordered) {
    if (to < coveredUntil) continue;
    if (from > coveredUntil) return false;

    coveredUntil = Math.max(
      coveredUntil,
      to
    );

    if (coveredUntil >= end) {
      return true;
    }
  }

  return false;
}

function makeResult(
  rule: ValidationRule,
  status: RuleResult["status"],
  message: string,
  details: Record<string, unknown>,
  issueCount = 0
): RuleResult {
  return {
    ruleId: rule.id,
    ruleCode: rule.code,
    status,
    severity: rule.severity,
    message,
    details,
    issueCount,
  };
}

export const yhctPerformScheduleRule:
  RuleValidator = {
  async evaluate(context, rule, runtime) {
    // =========================================
    // 1. CHỈ ÁP DỤNG YHCT NGOẠI TRÚ
    // =========================================
    const group = str(
      (
        context.medicalCase as
          typeof context.medicalCase & {
            treatment_group?: string | null;
          }
      ).treatment_group
    ).toUpperCase();

    const xml1 = first(
      first(context.xml1)?.TONG_HOP
    );
    const kcb = str(
      xml1?.MA_LOAI_KCB
    ).padStart(2, "0");

    if (
      group !== "YHCT" ||
      !xml1 ||
      kcb !== "02"
    ) {
      return makeResult(
        rule,
        "SKIP",
        "Chỉ áp dụng hồ sơ ngoại trú YHCT.",
        {
          skipReason: "NOT_APPLICABLE",
          treatmentGroup: group,
          kcb,
          checkedActivities: 0,
        }
      );
    }

    // =========================================
    // 2. ĐỌC NGAY_TH_YL VÀ NGAY_KQ
    // =========================================
    const selectedCodes = Array.isArray(
      rule.config?.serviceCodes
    )
      ? new Set(
          (rule.config.serviceCodes as unknown[])
            .map(str)
            .filter(Boolean)
        )
      : null;

    const activities: Activity[] = [];
    const dedup = new Set<string>();
    const uncertain:
      Array<Record<string, unknown>> = [];

    let missingTime = 0;
    let missingPerformer = 0;
    let missingResultTime = 0;

    for (const row of xml3Rows(context.xml3)) {
      const serviceCode = str(
        row.MA_DICH_VU
      );

      if (
        selectedCodes &&
        !selectedCodes.has(serviceCode)
      ) {
        continue;
      }

      const performedAt = str(
        row.NGAY_TH_YL
      );
      const performedMs = localMs(
        performedAt
      );

      const resultAt = str(
        row.NGAY_KQ
      );
      const parsedResultMs = resultAt
        ? localMs(resultAt)
        : null;

      const staffCodes = parseStaff(
        row.NGUOI_THUC_HIEN
      );
      const stt = str(row.STT);

      if (performedMs === null) {
        missingTime++;
        continue;
      }

      if (!staffCodes.length) {
        missingPerformer++;
        continue;
      }

      for (const staffCode of staffCodes) {
        const key = JSON.stringify([
          stt,
          serviceCode,
          normalizeCode(staffCode),
          performedAt,
        ]);

        if (dedup.has(key)) {
          continue;
        }

        dedup.add(key);

        if (
          resultAt &&
          (
            parsedResultMs === null ||
            parsedResultMs < performedMs
          )
        ) {
          uncertain.push({
            type: "INVALID_RESULT_TIME",
            stt,
            serviceCode,
            staffCode,
            performedAt,
            resultAt,
            message:
              "NGAY_KQ không hợp lệ hoặc trước NGAY_TH_YL.",
          });
          continue;
        }

        if (!resultAt) {
          missingResultTime++;
        }

        activities.push({
          stt,
          serviceCode,
          serviceName: str(
            row.TEN_DICH_VU
          ),
          staffCode,
          performedAt,
          performedMs,
          resultAt,
          resultMs: parsedResultMs,
        });
      }
    }

    if (!activities.length) {
      return makeResult(
        rule,
        "SKIP",
        "Không có hoạt động đủ dữ liệu để đối chiếu.",
        {
          checkedActivities: 0,
          missingTime,
          missingPerformer,
          missingResultTime,
          unresolvedCount: uncertain.length,
          uncertain,
          findings: [],
        }
      );
    }

    // =========================================
    // 3. TRA NHÂN VIÊN VÀ LỊCH TRỰC
    // =========================================
    const codes = [
      ...new Set(
        activities.map(
          (a) => a.staffCode
        )
      ),
    ];

    const minMs = Math.min(
      ...activities.map(
        (a) => a.performedMs
      )
    );
    const maxMs = Math.max(
      ...activities.map(
        (a) => a.resultMs ?? a.performedMs
      )
    );

    const minDate = dateIso(minMs);
    const maxDate = dateIso(maxMs);

    const response =
      await runtime.client.query<ScheduleRow>(
      `
      WITH requested AS (
        SELECT DISTINCT
          BTRIM(code) AS code,
          LOWER(
            REGEXP_REPLACE(
              BTRIM(code),
              '[[:space:]]+', '', 'g'
            )
          ) AS normalized_code
        FROM UNNEST($1::text[]) AS t(code)
        WHERE BTRIM(code) <> ''
      ),
      direct_matches AS (
        SELECT
          req.code AS staff_code,
          ms.id AS staff_id,
          ms.full_name AS staff_name,
          ms.active AS staff_active
        FROM requested req
        JOIN catalog.medical_staff ms
          ON (
            LOWER(
              REGEXP_REPLACE(
                BTRIM(
                  COALESCE(ms.license_number, '')
                ),
                '[[:space:]]+', '', 'g'
              )
            ) = req.normalized_code
            OR
            LOWER(
              REGEXP_REPLACE(
                BTRIM(
                  COALESCE(
                    ms.social_insurance_code, ''
                  )
                ),
                '[[:space:]]+', '', 'g'
              )
            ) = req.normalized_code
          )
        WHERE req.normalized_code <> ''
      ),
      alias_matches AS (
        SELECT
          req.code AS staff_code,
          ms.id AS staff_id,
          ms.full_name AS staff_name,
          ms.active AS staff_active
        FROM requested req
        JOIN catalog.medical_staff_aliases a
          ON LOWER(
            REGEXP_REPLACE(
              BTRIM(a.alias_code),
              '[[:space:]]+', '', 'g'
            )
          ) = req.normalized_code
        JOIN catalog.medical_staff ms
          ON ms.id = a.staff_id
        WHERE req.normalized_code <> ''
      ),
      staff_matches AS (
        SELECT DISTINCT
          staff_code,
          staff_id,
          staff_name,
          staff_active
        FROM (
          SELECT * FROM direct_matches
          UNION ALL
          SELECT * FROM alias_matches
        ) matches
      )
      SELECT
        sm.staff_code,
        sm.staff_id::text AS staff_id,
        sm.staff_name,
        sm.staff_active,
        EXISTS (
          SELECT 1
          FROM catalog.medical_staff_schedules old
          WHERE old.staff_id = sm.staff_id
        ) AS has_any_schedule,
        s.id::text AS schedule_id,
        s.work_date::text AS work_date,
        s.start_time::text AS start_time,
        s.end_time::text AS end_time,
        s.status
      FROM staff_matches sm
      LEFT JOIN catalog.medical_staff_schedules s
        ON s.staff_id = sm.staff_id
        AND s.work_date BETWEEN
          ($2::date - INTERVAL '1 day')::date
          AND $3::date
      ORDER BY
        sm.staff_code,
        sm.staff_id,
        s.work_date,
        s.start_time
      `,
      [codes, minDate, maxDate]
    );

    const byCode = new Map<
      string,
      ScheduleRow[]
    >();

    for (const row of response.rows) {
      const key = normalizeCode(
        row.staff_code
      );
      const items = byCode.get(key) ?? [];

      items.push(row);
      byCode.set(key, items);
    }

    // =========================================
    // 4. KIỂM TRA TOÀN BỘ KHOẢNG THỜI GIAN
    // =========================================
    const findings: Finding[] = [];
    let checkedActivities = 0;

    for (const activity of activities) {
      const staffRows = byCode.get(
        normalizeCode(activity.staffCode)
      ) ?? [];

      const base = {
        stt: activity.stt,
        serviceCode: activity.serviceCode,
        staffCode: activity.staffCode,
      };

      if (!staffRows.length) {
        uncertain.push({
          ...base,
          type: "STAFF_NOT_FOUND",
        });
        continue;
      }

      const staffIds = [
        ...new Set(
          staffRows.map((r) => r.staff_id)
        ),
      ];

      if (staffIds.length !== 1) {
        uncertain.push({
          ...base,
          type: "AMBIGUOUS_STAFF",
          matchingStaffIds: staffIds,
        });
        continue;
      }

      const staff = staffRows[0];

      if (!staff.staff_active) {
        uncertain.push({
          ...base,
          type: "INACTIVE_STAFF",
          staffId: staff.staff_id,
        });
        continue;
      }

      if (!staff.has_any_schedule) {
        uncertain.push({
          ...base,
          type: "NO_SCHEDULE_DATA_FOR_STAFF",
          staffId: staff.staff_id,
        });
        continue;
      }

      const endMs =
        activity.resultMs ??
        activity.performedMs;

      const schedules = staffRows.filter(
        (r) => r.schedule_id !== null
      );

      const activeIntervals = schedules
        .filter(
          (r) =>
            str(r.status).toUpperCase() ===
            "ACTIVE"
        )
        .map(scheduleInterval)
        .filter(
          (v): v is [number, number] =>
            v !== null
        );

      const covered = isCovered(
        activity.performedMs,
        endMs,
        activeIntervals
      );

      
if (covered) {
  checkedActivities++;

  // Dịch vụ khám Y học cổ truyền mã 08.16:
  // Chỉ kiểm tra thời điểm khám NGAY_TH_YL.
  // Không bắt buộc có NGAY_KQ trong rule
  // kiểm tra lịch thực hiện kỹ thuật YHCT.
  const isYhctExamination =
    activity.serviceCode === "08.16";

  if (
    activity.resultMs === null &&
    !isYhctExamination
  ) {
    uncertain.push({
      ...base,
      type: "MISSING_RESULT_TIME",
      performedAt: activity.performedAt,
      message:
        "Chỉ đối chiếu được NGAY_TH_YL vì XML3 thiếu NGAY_KQ.",
    });
  }

  continue;
}


      const relevantDate = dateIso(
        activity.performedMs
      );

      const onDay = schedules.filter(
        (r) =>
          r.work_date === relevantDate
      );

      const overnight = schedules.filter(
        (r) => {
          const interval =
            scheduleInterval(r);

          return (
            interval !== null &&
            r.work_date !== relevantDate &&
            interval[0] <= activity.performedMs &&
            interval[1] >= activity.performedMs
          );
        }
      );

      const relevant = [
        ...onDay,
        ...overnight,
      ];

      if (!relevant.length) {
        uncertain.push({
          ...base,
          type: "NO_SCHEDULE_ON_DATE",
          workDate: relevantDate,
        });
        continue;
      }

      if (
        relevant.some(
          (r) => scheduleInterval(r) === null
        )
      ) {
        uncertain.push({
          ...base,
          type: "INVALID_SCHEDULE_TIME",
          workDate: relevantDate,
        });
        continue;
      }

      checkedActivities++;

      const hasActive = relevant.some(
        (r) =>
          str(r.status).toUpperCase() ===
          "ACTIVE"
      );

      const type: Finding["type"] =
        hasActive
          ? "OUTSIDE_WORKING_HOURS"
          : "OFF_SCHEDULE";

      const message =
        `${staff.staff_name} (${activity.staffCode}) - ` +
        `${activity.serviceName}: ` +
        `${activity.performedAt}` +
        (
          activity.resultAt
            ? ` -> ${activity.resultAt}`
            : ""
        ) +
        " không nằm trọn trong thời gian làm việc đã đăng ký.";

      findings.push({
        type,
        stt: activity.stt,
        serviceCode: activity.serviceCode,
        serviceName: activity.serviceName,
        staffCode: activity.staffCode,
        staffName: staff.staff_name,
        performedAt: activity.performedAt,
        resultAt: activity.resultAt,
        message,
        schedules: relevant.map((r) => ({
          date: str(r.work_date),
          start: str(r.start_time),
          end: str(r.end_time),
          status: str(r.status),
        })),
      });
    }

    // =========================================
    // 5. TỔNG HỢP KẾT QUẢ
    // =========================================
    const details = {
      checkedActivities,
      missingTime,
      missingPerformer,
      missingResultTime,
      unresolvedCount: uncertain.length,
      uncertain,
      findings,
      timeSource:
        "XML3.NGAY_TH_YL + XML3.NGAY_KQ",
      scope: "YHCT + MA_LOAI_KCB=02",
      staffLookupSources: [
        "catalog.medical_staff.license_number",
        "catalog.medical_staff.social_insurance_code",
        "catalog.medical_staff_aliases.alias_code",
      ],
    };

    if (findings.length) {
      return makeResult(
        rule,
        "FAIL",
        `Có ${findings.length} hoạt động YHCT cần rà soát lịch làm việc (chưa kết luận vi phạm).`,
        details,
        findings.length
      );
    }

    if (
      missingTime > 0 ||
      missingPerformer > 0 ||
      uncertain.length > 0 ||
      checkedActivities === 0
    ) {
      return makeResult(
        rule,
        "SKIP",
        `Không phát hiện ngoài lịch trong ${checkedActivities} hoạt động đã đối chiếu; còn dữ liệu chưa đủ để kết luận.`,
        details
      );
    }

    return makeResult(
      rule,
      "PASS",
      `Đã đối chiếu ${checkedActivities} hoạt động YHCT với lịch nhân viên, không phát hiện sai lệch.`,
      details
    );
  },
};
