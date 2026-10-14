
import type {
  RuleValidator,
  ValidationRule,
  RuleResult,
} from "../rule.types.js";

// ======================================================
// YHCT_MACHINE_DAILY_USAGE
//
// - Chỉ kiểm tra ngoại trú YHCT
// - Thống kê số lượt DVKT theo máy/ngày
// - Kiểm tra cùng máy, cùng phút bắt đầu
// - Chỉ đối chiếu hồ sơ YHCT cùng import batch
// - Không tự kết luận vi phạm BHYT
// - Không ảnh hưởng GENERAL
// ======================================================

type Row = Record<string, unknown>;

interface MachineEvent {
  event_id: string;
  medical_case_id: string;
  ma_lk: string;
  ma_bn: string | null;
  item_code: string | null;
  item_name: string | null;
  performed_at: string;
  machine_code: string | null;
}

interface CaseRow {
  id: string;
  import_batch_id: string | null;
}

interface ValidEvent extends MachineEvent {
  performedMs: number;
  workDate: string;
  minuteKey: string;
  machineKey: string;
}

interface MachineDay {
  machineCode: string;
  workDate: string;
  serviceCount: number;
  caseCount: number;
  patientCount: number;
  missingPatientCodes: number;
  serviceCodes: string[];
  firstPerformedAt: string;
  lastPerformedAt: string;
}

interface Collision {
  type: "SAME_MACHINE_SAME_MINUTE";
  machineCode: string;
  workDate: string;
  performedMinute: string;
  eventCount: number;
  caseCount: number;
  cases: string[];
  services: Array<{
    eventId: string;
    maLk: string;
    serviceCode: string;
    performedAt: string;
  }>;
  message: string;
}

// ======================================================
// HELPERS
// ======================================================

function asObject(
  value: unknown
): Row | null {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Row;
  }

  return null;
}

function first(
  value: unknown
): Row | null {
  return asObject(
    Array.isArray(value)
      ? value[0]
      : value
  );
}

function str(value: unknown): string {
  return value == null
    ? ""
    : String(value).trim();
}

function normalizeMachine(
  value: unknown
): string {
  return str(value).toUpperCase();
}

function parseTime(
  value: string
): number | null {
  if (!/^\d{12}(\d{2})?$/.test(value)) {
    return null;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(8, 10));
  const minute = Number(value.slice(10, 12));

  const second =
    value.length === 14
      ? Number(value.slice(12, 14))
      : 0;

  // Date.UTC dùng làm trục số so sánh.
  // Không tự chuyển múi giờ của XML.
  const ms = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  );

  if (!Number.isFinite(ms)) {
    return null;
  }

  const check = new Date(ms);

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute ||
    check.getUTCSeconds() !== second
  ) {
    return null;
  }

  return ms;
}

function isoDate(
  value: string
): string {
  return (
    `${value.slice(0, 4)}-` +
    `${value.slice(4, 6)}-` +
    `${value.slice(6, 8)}`
  );
}

function xml3Rows(
  value: unknown
): Row[] {
  const root = first(value);

  const section = first(
    root?.CHITIEU_CHITIET_DVKT_VTYT
  );

  const list = first(
    section?.DSACH_CHI_TIET_DVKT
  );

  const data = list?.CHI_TIET_DVKT;

  const rows = Array.isArray(data)
    ? data
    : data
      ? [data]
      : [];

  return rows.filter(
    (item): item is Row =>
      asObject(item) !== null
  );
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

// ======================================================
// RULE CHÍNH
// ======================================================

export const yhctMachineDailyUsageRule:
  RuleValidator = {
  async evaluate(context, rule, runtime) {

    // ============================================
    // 1. CHỈ ÁP DỤNG NGOẠI TRÚ YHCT
    // ============================================

    const medicalCase =
      context.medicalCase as
        typeof context.medicalCase & {
          treatment_group?: string | null;
        };

    const treatmentGroup = str(
      medicalCase.treatment_group
    ).toUpperCase();

    const xml1 = first(
      first(context.xml1)?.TONG_HOP
    );

    const kcb = str(
      xml1?.MA_LOAI_KCB
    ).padStart(2, "0");

    const maLk = str(
      xml1?.MA_LK
    );

    if (
      treatmentGroup !== "YHCT" ||
      !xml1 ||
      kcb !== "02"
    ) {
      return makeResult(
        rule,
        "SKIP",
        "Chỉ áp dụng kiểm tra sử dụng máy cho hồ sơ ngoại trú YHCT.",
        {
          skipReason: "NOT_APPLICABLE",
          treatmentGroup,
          kcb,
          checkedMachineDays: 0,
          findings: [],
        }
      );
    }

    if (!maLk) {
      return makeResult(
        rule,
        "SKIP",
        "Hồ sơ YHCT chưa có MA_LK.",
        {
          skipReason: "MISSING_MA_LK",
          findings: [],
        }
      );
    }

    // ============================================
    // 2. ĐỌC CẤU HÌNH RULE
    // ============================================

    const config = rule.config ?? {};

    const defaultCodes = [
      "08.0313.0230",
      "08.0278.0230",
    ];

    const serviceCodes = Array.isArray(
      config.serviceCodes
    )
      ? (config.serviceCodes as unknown[])
          .map(str)
          .filter(Boolean)
      : defaultCodes;

    const selectedCodes = new Set(
      serviceCodes
    );

    if (selectedCodes.size === 0) {
      return makeResult(
        rule,
        "SKIP",
        "Chưa cấu hình mã DVKT cần kiểm tra máy.",
        {
          skipReason:
            "SERVICE_CODES_NOT_CONFIGURED",
          serviceCodes,
          findings: [],
        }
      );
    }

    const flagSameMinuteStarts =
      config.flagSameMinuteStarts !== false;

    // ============================================
    // 3. ĐỌC XML3 HỒ SƠ HIỆN TẠI
    // ============================================

    const focusDates = new Set<string>();
    const focusMachines = new Set<string>();

    let focusActivityCount = 0;
    let missingTime = 0;
    let invalidTime = 0;
    let missingMachine = 0;

    const uncertain:
      Array<Record<string, unknown>> = [];

    for (const row of xml3Rows(context.xml3)) {
      const serviceCode = str(
        row.MA_DICH_VU
      );

      if (!selectedCodes.has(serviceCode)) {
        continue;
      }

      focusActivityCount++;

      const stt = str(row.STT);

      const performedAt = str(
        row.NGAY_TH_YL
      );

      const machineCode = str(
        row.MA_MAY
      );

      const performedMs = parseTime(
        performedAt
      );

      if (performedMs === null) {
        if (!performedAt) {
          missingTime++;
        } else {
          invalidTime++;
        }

        uncertain.push({
          type: !performedAt
            ? "MISSING_PERFORM_TIME"
            : "INVALID_PERFORM_TIME",
          stt,
          serviceCode,
          performedAt,
        });

        continue;
      }

      if (!machineCode) {
        missingMachine++;

        uncertain.push({
          type: "MISSING_MACHINE_CODE",
          stt,
          serviceCode,
          performedAt,
        });

        continue;
      }

      focusDates.add(
        isoDate(performedAt)
      );

      focusMachines.add(
        normalizeMachine(machineCode)
      );
    }

    if (focusActivityCount === 0) {
      return makeResult(
        rule,
        "SKIP",
        "Không có DVKT thuộc nhóm kiểm tra máy.",
        {
          skipReason: "NO_SELECTED_SERVICES",
          serviceCodes,
          focusActivityCount: 0,
          findings: [],
        }
      );
    }

    if (
      focusDates.size === 0 ||
      focusMachines.size === 0
    ) {
      return makeResult(
        rule,
        "SKIP",
        "Chưa có hoạt động đủ thời gian và mã máy để đối chiếu.",
        {
          focusActivityCount,
          missingTime,
          invalidTime,
          missingMachine,
          unresolvedCount: uncertain.length,
          uncertain,
          checkedMachineDays: 0,
          dailyStats: [],
          findings: [],
        }
      );
    }

    // ============================================
    // 4. XÁC ĐỊNH HỒ SƠ VÀ IMPORT BATCH
    // ============================================

    const caseResult =
      await runtime.client.query<CaseRow>(
        `
        SELECT
          id::text AS id,
          import_batch_id::text AS import_batch_id

        FROM core.medical_cases

        WHERE ma_lk = $1
          AND treatment_group = 'YHCT'
        `,
        [maLk]
      );

    // Không chọn đại một hồ sơ khi MA_LK trùng.
    if (caseResult.rows.length !== 1) {
      return makeResult(
        rule,
        "SKIP",
        "MA_LK không xác định duy nhất một hồ sơ YHCT.",
        {
          maLk,
          matchingCases:
            caseResult.rows.length,
          findings: [],
        }
      );
    }

    const caseId = caseResult.rows[0].id;

    const batchId =
      caseResult.rows[0].import_batch_id;

    if (!batchId) {
      return makeResult(
        rule,
        "SKIP",
        "Hồ sơ YHCT chưa có import_batch_id.",
        {
          maLk,
          findings: [],
        }
      );
    }

    // ============================================
    // 5. LẤY XML3 TRONG CÙNG BATCH
    //
    // Bắt buộc giới hạn treatment_group = YHCT
    // để không thống kê lẫn GENERAL.
    // ============================================

    const response =
      await runtime.client.query<MachineEvent>(
        `
        SELECT
          e.id::text AS event_id,

          e.medical_case_id::text
            AS medical_case_id,

          mc.ma_lk,
          mc.ma_bn,

          e.item_code,
          e.item_name,

          BTRIM(
            COALESCE(
              e.raw_data ->> 'NGAY_TH_YL',
              ''
            )
          ) AS performed_at,

          NULLIF(
            BTRIM(
              COALESCE(
                e.raw_data ->> 'MA_MAY',
                ''
              )
            ),
            ''
          ) AS machine_code

        FROM core.medical_events e

        JOIN core.medical_cases mc
          ON mc.id = e.medical_case_id

        WHERE mc.import_batch_id = $1::uuid

          AND mc.treatment_group = 'YHCT'

          AND LPAD(
            BTRIM(
              COALESCE(
                mc.ma_loai_kcb,
                ''
              )
            ),
            2,
            '0'
          ) = '02'

          AND UPPER(
            BTRIM(
              COALESCE(
                e.source_type,
                ''
              )
            )
          ) = 'XML3'

          AND e.item_code = ANY($2::text[])

          AND LEFT(
            BTRIM(
              COALESCE(
                e.raw_data ->> 'NGAY_TH_YL',
                ''
              )
            ),
            8
          ) = ANY($3::text[])
        `,
        [
          batchId,
          serviceCodes,
          [...focusDates].map(
            (date) => date.replace(/-/g, "")
          ),
        ]
      );

    // ============================================
    // 6. CHUẨN HÓA SỰ KIỆN
    // ============================================

    const validEvents = new Map<
      string,
      ValidEvent
    >();

    const currentMatchedEvents =
      new Set<string>();

    for (const event of response.rows) {
      const performedAt = str(
        event.performed_at
      );

      const performedMs = parseTime(
        performedAt
      );

      const machineCode = str(
        event.machine_code
      );

      if (
        performedMs === null ||
        !machineCode
      ) {
        continue;
      }

      const workDate = isoDate(
        performedAt
      );

      const machineKey = normalizeMachine(
        machineCode
      );

      const validEvent: ValidEvent = {
        ...event,

        // Giữ lại giờ thực hiện gốc.
        performed_at: performedAt,

        performedMs,
        workDate,

        minuteKey:
          performedAt.slice(0, 12),

        machineKey,
      };

      // Mỗi event_id chỉ được tính một lần.
      validEvents.set(
        event.event_id,
        validEvent
      );

      if (
        event.medical_case_id === caseId &&
        focusMachines.has(machineKey)
      ) {
        currentMatchedEvents.add(
          event.event_id
        );
      }
    }

    if (currentMatchedEvents.size === 0) {
      return makeResult(
        rule,
        "SKIP",
        "Không đối chiếu được hoạt động XML3 của hồ sơ với medical_events.",
        {
          maLk,
          importBatchId: batchId,
          focusActivityCount,
          missingTime,
          invalidTime,
          missingMachine,
          unresolvedCount: uncertain.length,
          uncertain,
          matchedCurrentEvents: 0,
          checkedMachineDays: 0,
          dailyStats: [],
          findings: [],
        }
      );
    }

    // ============================================
    // 7. THỐNG KÊ THEO MÁY VÀ NGÀY
    // ============================================

    type MachineDayGroup = {
      machineCode: string;
      workDate: string;

      eventIds: Set<string>;
      cases: Set<string>;
      patients: Set<string>;
      casesWithoutPatient: Set<string>;
      serviceCodes: Set<string>;
      performedTimes: string[];
    };

    const groups = new Map<
      string,
      MachineDayGroup
    >();

    const focusGroupKeys =
      new Set<string>();

    for (const event of validEvents.values()) {
      const key = JSON.stringify([
        event.machineKey,
        event.workDate,
      ]);

      let group = groups.get(key);

      if (!group) {
        group = {
          machineCode:
            event.machine_code ?? "",

          workDate: event.workDate,

          eventIds: new Set(),
          cases: new Set(),
          patients: new Set(),

          casesWithoutPatient: new Set(),
          serviceCodes: new Set(),
          performedTimes: [],
        };

        groups.set(key, group);
      }

      group.eventIds.add(
        event.event_id
      );

      group.cases.add(
        event.medical_case_id
      );

      const patientCode = str(
        event.ma_bn
      );

      if (patientCode) {
        group.patients.add(
          patientCode
        );
      } else {
        group.casesWithoutPatient.add(
          event.medical_case_id
        );
      }

      if (event.item_code) {
        group.serviceCodes.add(
          event.item_code
        );
      }

      group.performedTimes.push(
        event.performed_at
      );

      if (
        currentMatchedEvents.has(
          event.event_id
        )
      ) {
        focusGroupKeys.add(key);
      }
    }

    const dailyStats: MachineDay[] = [];

    for (const key of focusGroupKeys) {
      const group = groups.get(key);

      if (!group) {
        continue;
      }

      const times = [
        ...group.performedTimes,
      ].sort();

      dailyStats.push({
        machineCode: group.machineCode,
        workDate: group.workDate,

        serviceCount: group.eventIds.size,
        caseCount: group.cases.size,
        patientCount: group.patients.size,

        missingPatientCodes:
          group.casesWithoutPatient.size,

        serviceCodes: [
          ...group.serviceCodes,
        ].sort(),

        firstPerformedAt:
          times[0] ?? "",

        lastPerformedAt:
          times[times.length - 1] ?? "",
      });
    }

    dailyStats.sort(
      (a, b) =>
        a.workDate.localeCompare(
          b.workDate
        ) ||
        b.serviceCount - a.serviceCount ||
        a.machineCode.localeCompare(
          b.machineCode
        )
    );

    // ============================================
    // 8. PHÁT HIỆN CÙNG MÁY, CÙNG PHÚT
    // ============================================

    const minuteGroups = new Map<
      string,
      ValidEvent[]
    >();

    for (const event of validEvents.values()) {
      const key = JSON.stringify([
        event.machineKey,
        event.workDate,
        event.minuteKey,
      ]);

      const items =
        minuteGroups.get(key) ?? [];

      items.push(event);

      minuteGroups.set(key, items);
    }

    const findings: Collision[] = [];

    for (const list of minuteGroups.values()) {
      if (list.length < 2) {
        continue;
      }

      const differentCases = new Set(
        list.map(
          (item) => item.medical_case_id
        )
      );

      // Chỉ xét khi từ hai hồ sơ khác nhau.
      if (differentCases.size < 2) {
        continue;
      }

      // Cảnh báo chỉ thuộc các nhóm có
      // hoạt động của hồ sơ đang kiểm tra.
      const currentIsInGroup = list.some(
        (item) =>
          item.medical_case_id === caseId
      );

      if (!currentIsInGroup) {
        continue;
      }

      const sample = list[0];

      if (
        !focusMachines.has(
          sample.machineKey
        )
      ) {
        continue;
      }

      findings.push({
        type: "SAME_MACHINE_SAME_MINUTE",

        machineCode:
          sample.machine_code ?? "",

        workDate: sample.workDate,

        performedMinute:
          sample.minuteKey,

        eventCount: list.length,

        caseCount:
          differentCases.size,

        cases: [
          ...new Set(
            list.map(
              (item) => item.ma_lk
            )
          ),
        ].sort(),

        services: list.map(
          (item) => ({
            eventId:
              item.event_id,

            maLk:
              item.ma_lk,

            serviceCode: str(
              item.item_code
            ),

            performedAt:
              item.performed_at,
          })
        ),

        message:
          "Cùng mã máy được ghi nhận bắt đầu DVKT " +
          "trong cùng phút ở nhiều hồ sơ; " +
          "cần rà soát thời gian và khả năng " +
          "phục vụ đồng thời của thiết bị.",
      });
    }

    findings.sort(
      (a, b) =>
        a.workDate.localeCompare(
          b.workDate
        ) ||
        a.performedMinute.localeCompare(
          b.performedMinute
        ) ||
        a.machineCode.localeCompare(
          b.machineCode
        )
    );

    // ============================================
    // 9. TỔNG HỢP KẾT QUẢ
    // ============================================

    const details = {
      scope: "YHCT_IMPORT_BATCH",

      treatmentGroup,
      importBatchId: batchId,
      maLk,

      timeSource:
        "XML3.NGAY_TH_YL",

      machineSource:
        "XML3.MA_MAY",

      serviceCodes,
      flagSameMinuteStarts,

      focusActivityCount,

      matchedCurrentEvents:
        currentMatchedEvents.size,

      validBatchEvents:
        validEvents.size,

      missingTime,
      invalidTime,
      missingMachine,

      unresolvedCount:
        uncertain.length,

      uncertain,

      checkedMachineDays:
        dailyStats.length,

      dailyStats,

      detectedCollisions:
        findings.length,

      findings,

      note:
        "Trùng phút bắt đầu không chứng minh " +
        "máy được sử dụng đồng thời hoặc " +
        "vi phạm quy định BHYT. " +
        "Chỉ thống kê các hoạt động YHCT " +
        "trong cùng đợt import.",
    };

    // ============================================
    // 10. CÓ CẢNH BÁO CẦN RÀ SOÁT
    // ============================================

    if (
      flagSameMinuteStarts &&
      findings.length > 0
    ) {
      return makeResult(
        rule,
        "FAIL",

        `Phát hiện ${findings.length} nhóm ` +
        "hoạt động cùng máy, cùng phút bắt đầu " +
        "ở nhiều hồ sơ YHCT; cần rà soát, " +
        "chưa kết luận vi phạm.",

        details,
        findings.length
      );
    }

    // ============================================
    // 11. CÒN THIẾU DỮ LIỆU
    // ============================================

    if (
      uncertain.length > 0 ||
      dailyStats.length === 0
    ) {
      return makeResult(
        rule,
        "SKIP",

        "Đã thống kê sử dụng máy YHCT " +
        "nhưng còn dữ liệu chưa đủ để kết luận.",

        details
      );
    }

    // ============================================
    // 12. PASS
    // ============================================

    return makeResult(
      rule,
      "PASS",

      flagSameMinuteStarts
        ? `Đã thống kê ${dailyStats.length} nhóm máy/ngày YHCT, không phát hiện các mốc bắt đầu trùng phút giữa nhiều hồ sơ.`
        : `Đã thống kê ${dailyStats.length} nhóm máy/ngày YHCT; chức năng cảnh báo trùng phút đang tắt.`,

      details
    );
  },
};
