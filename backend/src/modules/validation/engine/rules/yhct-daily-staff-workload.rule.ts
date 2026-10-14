import type {
  RuleValidator,
  ValidationRule,
  RuleResult,
} from "../rule.types.js";
type Row = Record<string, unknown>;
type Technique = "ELECTRO" | "MANUAL" | "OTHER";
type EventRow = {
  event_id: string;
  medical_case_id: string;
  ma_lk: string;
  ma_bn: string | null;
  item_code: string | null;
  item_name: string | null;
  performed_at: string;
  staff_code: string;
  machine_code: string | null;
  staff_ids: string[];
};
type CaseRow = {
  id: string;
  import_batch_id: string | null;
};
type StaffRow = {
  id: string;
  full_name: string;
  active: boolean;
};
type MachineStat = {
  machineCode: string;
  serviceCount: number;
};
type TechniqueStat = {
  technique: Technique;
  serviceCount: number;
  caseCount: number;
  patientCount: number;
  machineCount: number;
  missingMachineCount: number;
  machines: MachineStat[];
  serviceCodes: string[];
};
type Workload = {
  staffId: string;
  staffName: string;
  workDate: string;
  serviceCount: number;
  caseCount: number;
  patientCount: number;
  missingPatientCodes: number;
  staffCodes: string[];
  techniqueStats: Record<Technique, TechniqueStat>;
};
type Finding = {
  type:
    | "DAILY_WORKLOAD_EXCEEDED"
    | "GROUP_WORKLOAD_EXCEEDED";
  staffId: string;
  staffName: string;
  workDate: string;
  technique: Technique | "ALL";
  serviceCount: number;
  threshold: number;
  exceededBy: number;
  message: string;
};
type TechniqueBucket = {
  eventIds: Set<string>;
  cases: Set<string>;
  patients: Set<string>;
  casesWithoutPatient: Set<string>;
  serviceCodes: Set<string>;
  machines: Map<string, Set<string>>;
  missingMachineEvents: Set<string>;
};
type DayGroup = {
  staffId: string;
  workDate: string;
  eventIds: Set<string>;
  cases: Set<string>;
  patients: Set<string>;
  casesWithoutPatient: Set<string>;
  staffCodes: Set<string>;
  techniques: Record<Technique, TechniqueBucket>;
};
function obj(value: unknown): Row | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Row
    : null;
}
function first(value: unknown): Row | null {
  return obj(
    Array.isArray(value) ? value[0] : value
  );
}
function str(value: unknown): string {
  return value == null
    ? ""
    : String(value).trim();
}
function normalize(value: unknown): string {
  return str(value)
    .replace(/\s+/g, "")
    .toLowerCase();
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
  const rows = Array.isArray(data)
    ? data
    : data ? [data] : [];
  return rows.filter(
    (item): item is Row => obj(item) !== null
  );
}
function parseStaff(value: unknown): string[] {
  const codes = new Map<string, string>();
  for (const item of str(value).split(/[;|,]+/)) {
    const code = item.trim();
    const key = normalize(code);
    if (key && !codes.has(key)) {
      codes.set(key, code);
    }
  }
  return [...codes.values()];
}
function validDate(value: string): string | null {
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
  const time = Date.UTC(
    y, m - 1, d, h, min, sec
  );
  if (!Number.isFinite(time)) {
    return null;
  }
  const dt = new Date(time);
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
  return (
    `${value.slice(0, 4)}-` +
    `${value.slice(4, 6)}-` +
    `${value.slice(6, 8)}`
  );
}
function positiveLimit(value: unknown): number | null {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  )
    ? value
    : null;
}
function makeBucket(): TechniqueBucket {
  return {
    eventIds: new Set<string>(),
    cases: new Set<string>(),
    patients: new Set<string>(),
    casesWithoutPatient: new Set<string>(),
    serviceCodes: new Set<string>(),
    machines: new Map<string, Set<string>>(),
    missingMachineEvents: new Set<string>(),
  };
}
function makeGroup(
  staffId: string,
  workDate: string
): DayGroup {
  return {
    staffId,
    workDate,
    eventIds: new Set<string>(),
    cases: new Set<string>(),
    patients: new Set<string>(),
    casesWithoutPatient: new Set<string>(),
    staffCodes: new Set<string>(),
    techniques: {
      ELECTRO: makeBucket(),
      MANUAL: makeBucket(),
      OTHER: makeBucket(),
    },
  };
}
function buildTechniqueStat(
  technique: Technique,
  bucket: TechniqueBucket
): TechniqueStat {
  const machines: MachineStat[] = [
    ...bucket.machines.entries(),
  ].map(([machineCode, ids]) => ({
    machineCode,
    serviceCount: ids.size,
  }));
  machines.sort(
    (a, b) =>
      b.serviceCount - a.serviceCount ||
      a.machineCode.localeCompare(b.machineCode)
  );
  return {
    technique,
    serviceCount: bucket.eventIds.size,
    caseCount: bucket.cases.size,
    patientCount: bucket.patients.size,
    machineCount: bucket.machines.size,
    missingMachineCount:
      bucket.missingMachineEvents.size,
    machines,
    serviceCodes: [...bucket.serviceCodes].sort(),
  };
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
export const yhctDailyStaffWorkloadRule: RuleValidator = {
  async evaluate(context, rule, runtime) {
    // ======================================
    // 1. XÁC ĐỊNH PHẠM VI
    // ======================================
    const xml1 = first(
      first(context.xml1)?.TONG_HOP
    );
    const kcb = str(
      xml1?.MA_LOAI_KCB
    ).padStart(2, "0");
    const maLk = str(xml1?.MA_LK);
    // Chi thong ke nhom YHCT; khong ap dung cho GENERAL.
    const medicalCase = context.medicalCase as
      typeof context.medicalCase & {
        treatment_group?: string | null;
      };
    const treatmentGroup = str(
      medicalCase.treatment_group
    ).toUpperCase();
    if (treatmentGroup !== "YHCT" || !xml1 || kcb !== "02") {
      return makeResult(
        rule,
        "SKIP",
        "Chỉ áp dụng hồ sơ ngoại trú YHCT (02).",
        { kcb, treatmentGroup, skipReason: "NOT_APPLICABLE" }
      );
    }
    if (!maLk) {
      return makeResult(
        rule,
        "SKIP",
        "Không xác định được MA_LK.",
        {}
      );
    }
    // ======================================
    // 2. ĐỌC CẤU HÌNH
    // ======================================
    const config = rule.config ?? {};
    const configuredCodes = Array.isArray(
      config.serviceCodes
    )
      ? (config.serviceCodes as unknown[])
          .map(str)
          .filter(Boolean)
      : [];
    const includeAllXml3 =
      config.includeAllXml3 === true;
    if (
      !includeAllXml3 &&
      configuredCodes.length === 0
    ) {
      return makeResult(
        rule,
        "SKIP",
        "Chưa cấu hình phạm vi DVKT cần thống kê.",
        {
          reason: "SERVICE_SCOPE_NOT_CONFIGURED",
        }
      );
    }
    const defaultGroups: Record<
      "ELECTRO" | "MANUAL",
      string[]
    > = {
      ELECTRO: [
        "08.0313.0230",
        "08.0278.0230",
      ],
      MANUAL: [
        "08.0432.0280",
        "08.0392.0280",
      ],
    };
    const customGroups = obj(
      config.techniqueGroups
    );
    function configuredGroup(
      group: "ELECTRO" | "MANUAL"
    ): string[] {
      const value = customGroups?.[group];
      if (!Array.isArray(value)) {
        return defaultGroups[group];
      }
      return value.map(str).filter(Boolean);
    }
    const electroCodes = new Set(
      configuredGroup("ELECTRO")
    );
    const manualCodes = new Set(
      configuredGroup("MANUAL")
    );
    // Không cho một mã thuộc đồng thời
    // nhóm ELECTRO và MANUAL.
    const overlappingCodes = [
      ...electroCodes,
    ].filter((code) => manualCodes.has(code));
    if (overlappingCodes.length) {
      return makeResult(
        rule,
        "SKIP",
        "Cấu hình phân nhóm DVKT bị trùng mã.",
        {
          reason: "OVERLAPPING_TECHNIQUE_CODES",
          overlappingCodes,
        }
      );
    }
    function techniqueOf(code: string): Technique {
      if (electroCodes.has(code)) {
        return "ELECTRO";
      }
      if (manualCodes.has(code)) {
        return "MANUAL";
      }
      return "OTHER";
    }
    const totalThreshold = positiveLimit(
      config.maxServicesPerDay
    );
    const groupConfig = obj(
      config.groupThresholds
    );
    const groupThresholds: Record<
      Technique,
      number | null
    > = {
      ELECTRO: positiveLimit(
        groupConfig?.ELECTRO
      ),
      MANUAL: positiveLimit(
        groupConfig?.MANUAL
      ),
      OTHER: positiveLimit(
        groupConfig?.OTHER
      ),
    };
    const hasThreshold =
      totalThreshold !== null ||
      Object.values(groupThresholds)
        .some((value) => value !== null);
    const selectedCodes = new Set(
      configuredCodes
    );
    // ======================================
    // 3. ĐỌC XML3 CỦA HỒ SƠ HIỆN TẠI
    // ======================================
    const focusDates = new Set<string>();
    let focusActivityCount = 0;
    let missingTime = 0;
    let missingPerformer = 0;
    for (const row of xml3Rows(context.xml3)) {
      const code = str(row.MA_DICH_VU);
      if (
        !includeAllXml3 &&
        !selectedCodes.has(code)
      ) {
        continue;
      }
      focusActivityCount++;
      const date = validDate(
        str(row.NGAY_TH_YL)
      );
      if (date === null) {
        missingTime++;
        continue;
      }
      const performers = parseStaff(
        row.NGUOI_THUC_HIEN
      );
      if (!performers.length) {
        missingPerformer++;
        continue;
      }
      focusDates.add(date);
    }
    if (!focusDates.size) {
      return makeResult(
        rule,
        "SKIP",
        "Không có hoạt động XML3 đủ dữ liệu để thống kê.",
        {
          focusActivityCount,
          missingTime,
          missingPerformer,
        }
      );
    }
    // ======================================
    // 4. XÁC ĐỊNH HỒ SƠ VÀ BATCH
    // ======================================
    const caseResult =
      await runtime.client.query<CaseRow>(
        `
        SELECT
          id::text AS id,
          import_batch_id::text AS import_batch_id
        FROM core.medical_cases
        WHERE ma_lk = $1
        `,
        [maLk]
      );
    // Không tự chọn một hồ sơ khi MA_LK trùng.
    if (caseResult.rows.length !== 1) {
      return makeResult(
        rule,
        "SKIP",
        "MA_LK không xác định duy nhất một hồ sơ.",
        {
          maLk,
          matchingCases: caseResult.rows.length,
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
        "Hồ sơ chưa có import_batch_id.",
        { maLk }
      );
    }
    // ======================================
    // 5. LẤY XML3 TRÊN TOÀN IMPORT BATCH
    // ======================================
    const response =
      await runtime.client.query<EventRow>(
        `
        WITH source_events AS (
          SELECT
            e.id,
            e.medical_case_id,
            mc.ma_lk,
            mc.ma_bn,
            e.item_code,
            e.item_name,
            e.performer_code,
            e.raw_data,
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
          WHERE
            mc.import_batch_id = $1::uuid
            AND mc.treatment_group = 'YHCT'
            AND LPAD(
              BTRIM(
                COALESCE(mc.ma_loai_kcb, '')
              ),
              2,
              '0'
            ) = '02'
            AND UPPER(
              BTRIM(
                COALESCE(e.source_type, '')
              )
            ) = 'XML3'
            AND (
              $3::boolean = TRUE
              OR e.item_code = ANY($4::text[])
            )
        ),
        valid_format AS (
          SELECT
            *,
            SUBSTRING(performed_at, 1, 4)
              || '-' ||
            SUBSTRING(performed_at, 5, 2)
              || '-' ||
            SUBSTRING(performed_at, 7, 2)
              AS work_date
          FROM source_events
          WHERE performed_at ~
            '^[0-9]{12}([0-9]{2})?$'
        ),
        expanded AS (
          SELECT
            ve.*,
            BTRIM(p.code) AS staff_code
          FROM valid_format ve
          CROSS JOIN LATERAL
            REGEXP_SPLIT_TO_TABLE(
              COALESCE(
                NULLIF(
                  BTRIM(
                    ve.raw_data
                      ->> 'NGUOI_THUC_HIEN'
                  ),
                  ''
                ),
                ve.performer_code,
                ''
              ),
              '[;|,]+'
            ) AS p(code)
          WHERE ve.work_date = ANY($2::text[])
        )
        SELECT DISTINCT
          x.id::text AS event_id,
          x.medical_case_id::text
            AS medical_case_id,
          x.ma_lk,
          x.ma_bn,
          x.item_code,
          x.item_name,
          x.performed_at,
          x.staff_code,
          x.machine_code,
          ARRAY(
            SELECT DISTINCT ms.id::text
            FROM catalog.medical_staff ms
            WHERE
              LOWER(
                REGEXP_REPLACE(
                  COALESCE(
                    ms.license_number,
                    ''
                  ),
                  '[[:space:]]+',
                  '',
                  'g'
                )
              ) = LOWER(
                REGEXP_REPLACE(
                  x.staff_code,
                  '[[:space:]]+',
                  '',
                  'g'
                )
              )
              OR
              LOWER(
                REGEXP_REPLACE(
                  COALESCE(
                    ms.social_insurance_code,
                    ''
                  ),
                  '[[:space:]]+',
                  '',
                  'g'
                )
              ) = LOWER(
                REGEXP_REPLACE(
                  x.staff_code,
                  '[[:space:]]+',
                  '',
                  'g'
                )
              )
              OR EXISTS (
                SELECT 1
                FROM catalog.medical_staff_aliases a
                WHERE a.staff_id = ms.id
                  AND LOWER(
                    REGEXP_REPLACE(
                      a.alias_code,
                      '[[:space:]]+',
                      '',
                      'g'
                    )
                  ) = LOWER(
                    REGEXP_REPLACE(
                      x.staff_code,
                      '[[:space:]]+',
                      '',
                      'g'
                    )
                  )
              )
          ) AS staff_ids
        FROM expanded x
        WHERE BTRIM(x.staff_code) <> ''
        `,
        [
          batchId,
          [...focusDates].sort(),
          includeAllXml3,
          configuredCodes,
        ]
      );
    // ======================================
    // 6. TỔNG HỢP NHÂN VIÊN VÀ NGÀY
    // ======================================
    const groups = new Map<string, DayGroup>();
    const focusGroupKeys = new Set<string>();
    const uncertain:
      Array<Record<string, unknown>> = [];
    const unresolvedKeys = new Set<string>();
    const currentEventIds = new Set<string>();
    const resolvedCurrentEventIds = new Set<string>();
    let unresolvedBatchEvents = 0;
    const batchUnresolvedKeys = new Set<string>();
    for (const event of response.rows) {
      const workDate = validDate(
        str(event.performed_at)
      );
      if (!workDate) {
        continue;
      }
      const isCurrentCase =
        event.medical_case_id === caseId;
      if (isCurrentCase) {
        currentEventIds.add(event.event_id);
      }
      const staffIds = Array.isArray(
        event.staff_ids
      )
        ? [...new Set(
            event.staff_ids.filter(Boolean)
          )]
        : [];
      if (staffIds.length !== 1) {
        const unresolvedKey = JSON.stringify([
          event.event_id,
          normalize(event.staff_code),
        ]);
        if (!batchUnresolvedKeys.has(unresolvedKey)) {
          batchUnresolvedKeys.add(unresolvedKey);
          unresolvedBatchEvents++;
        }
        if (
          isCurrentCase &&
          !unresolvedKeys.has(unresolvedKey)
        ) {
          unresolvedKeys.add(unresolvedKey);
          uncertain.push({
            type: staffIds.length === 0
              ? "STAFF_NOT_FOUND"
              : "AMBIGUOUS_STAFF",
            eventId: event.event_id,
            staffCode: event.staff_code,
            workDate,
            matchingStaffIds: staffIds,
          });
        }
        continue;
      }
      const staffId = staffIds[0];
      const key = JSON.stringify([
        staffId,
        workDate,
      ]);
      if (isCurrentCase) {
        focusGroupKeys.add(key);
        resolvedCurrentEventIds.add(
          event.event_id
        );
      }
      let group = groups.get(key);
      if (!group) {
        group = makeGroup(staffId, workDate);
        groups.set(key, group);
      }
      const eventId = event.event_id;
      const caseKey = event.medical_case_id;
      const patientCode = str(event.ma_bn);
      const code = str(event.item_code);
      const machineCode = str(event.machine_code);
      group.eventIds.add(eventId);
      group.cases.add(caseKey);
      group.staffCodes.add(event.staff_code);
      if (patientCode) {
        group.patients.add(patientCode);
      } else {
        group.casesWithoutPatient.add(caseKey);
      }
      const technique = techniqueOf(code);
      const bucket = group.techniques[technique];
      bucket.eventIds.add(eventId);
      bucket.cases.add(caseKey);
      if (code) {
        bucket.serviceCodes.add(code);
      }
      if (patientCode) {
        bucket.patients.add(patientCode);
      } else {
        bucket.casesWithoutPatient.add(caseKey);
      }
      if (machineCode) {
        const machineEvents =
          bucket.machines.get(machineCode) ??
          new Set<string>();
        machineEvents.add(eventId);
        bucket.machines.set(
          machineCode,
          machineEvents
        );
      } else if (technique === "ELECTRO") {
        bucket.missingMachineEvents.add(eventId);
      }
    }
    if (focusGroupKeys.size === 0) {
      return makeResult(
        rule,
        "SKIP",
        "Không đối chiếu được nhân viên của hồ sơ với medical_events.",
        {
          maLk,
          importBatchId: batchId,
          focusActivityCount,
          missingTime,
          missingPerformer,
          unresolvedCount: uncertain.length,
          uncertain,
          checkedStaffDays: 0,
          dailyStats: [],
        }
      );
    }
    // ======================================
    // 7. TRA CỨU NHÂN VIÊN
    // ======================================
    const staffIds = [
      ...new Set(
        [...focusGroupKeys].map((key) => {
          const pair = JSON.parse(key) as [
            string,
            string
          ];
          return pair[0];
        })
      ),
    ];
    const staffResult =
      await runtime.client.query<StaffRow>(
        `
        SELECT
          id::text AS id,
          full_name,
          active
        FROM catalog.medical_staff
        WHERE id = ANY($1::uuid[])
        `,
        [staffIds]
      );
    const staffMap = new Map(
      staffResult.rows.map((row) => [
        row.id,
        row,
      ])
    );
    // ======================================
    // 8. THỐNG KÊ NHÓM KỸ THUẬT
    // ======================================
    const dailyStats: Workload[] = [];
    const findings: Finding[] = [];
    for (const key of focusGroupKeys) {
      const group = groups.get(key);
      if (!group) {
        continue;
      }
      const staff = staffMap.get(group.staffId);
      if (!staff || staff.active !== true) {
        uncertain.push({
          type: !staff
            ? "STAFF_NOT_FOUND"
            : "INACTIVE_STAFF",
          staffId: group.staffId,
          workDate: group.workDate,
        });
        continue;
      }
      const techniqueStats = {
        ELECTRO: buildTechniqueStat(
          "ELECTRO",
          group.techniques.ELECTRO
        ),
        MANUAL: buildTechniqueStat(
          "MANUAL",
          group.techniques.MANUAL
        ),
        OTHER: buildTechniqueStat(
          "OTHER",
          group.techniques.OTHER
        ),
      };
      const stat: Workload = {
        staffId: group.staffId,
        staffName: staff.full_name,
        workDate: group.workDate,
        serviceCount: group.eventIds.size,
        caseCount: group.cases.size,
        patientCount: group.patients.size,
        missingPatientCodes:
          group.casesWithoutPatient.size,
        staffCodes: [...group.staffCodes].sort(),
        techniqueStats,
      };
      dailyStats.push(stat);
      // Ngưỡng toàn bộ DVKT.
      if (
        totalThreshold !== null &&
        stat.serviceCount > totalThreshold
      ) {
        findings.push({
          type: "DAILY_WORKLOAD_EXCEEDED",
          staffId: stat.staffId,
          staffName: stat.staffName,
          workDate: stat.workDate,
          technique: "ALL",
          serviceCount: stat.serviceCount,
          threshold: totalThreshold,
          exceededBy:
            stat.serviceCount - totalThreshold,
          message:
            "Khối lượng DVKT quan sát được " +
            "vượt ngưỡng cấu hình, cần rà soát.",
        });
      }
      // Ngưỡng riêng theo nhóm.
      const techniques: Technique[] = [
        "ELECTRO",
        "MANUAL",
        "OTHER",
      ];
      for (const technique of techniques) {
        const limit = groupThresholds[technique];
        if (limit === null) {
          continue;
        }
        const count =
          techniqueStats[technique].serviceCount;
        if (count <= limit) {
          continue;
        }
        findings.push({
          type: "GROUP_WORKLOAD_EXCEEDED",
          staffId: stat.staffId,
          staffName: stat.staffName,
          workDate: stat.workDate,
          technique,
          serviceCount: count,
          threshold: limit,
          exceededBy: count - limit,
          message:
            `Nhóm ${technique} ghi nhận ` +
            `${count} lượt, vượt ngưỡng ` +
            `${limit} lượt/ngày do cơ sở cấu hình.`,
        });
      }
    }
    dailyStats.sort(
      (a, b) =>
        a.workDate.localeCompare(b.workDate) ||
        b.serviceCount - a.serviceCount ||
        a.staffName.localeCompare(b.staffName)
    );
    // ======================================
    // 9. CHI TIẾT KẾT QUẢ
    // ======================================
    const details = {
      scope: "IMPORT_BATCH",
      importBatchId: batchId,
      maLk,
      source:
        "core.medical_events.raw_data.NGAY_TH_YL",
      unit: "DVKT / staff_id / day",
      note:
        "Số lượt quan sát được trong đợt import; " +
        "không mặc nhiên là toàn bộ hoạt động " +
        "thực tế của nhân viên. " +
        "Số bệnh nhân tính theo MA_BN không trống. " +
        "Số mã máy không chứng minh khả năng " +
        "thực hiện đồng thời.",
      includeAllXml3,
      serviceCodes: configuredCodes,
      techniqueGroups: {
        ELECTRO: [...electroCodes],
        MANUAL: [...manualCodes],
      },
      maxServicesPerDay: totalThreshold,
      groupThresholds,
      focusActivityCount,
      currentEventCount: currentEventIds.size,
      resolvedCurrentEventCount:
        resolvedCurrentEventIds.size,
      missingTime,
      missingPerformer,
      unresolvedBatchEvents,
      unresolvedCount: uncertain.length,
      uncertain,
      checkedStaffDays: dailyStats.length,
      dailyStats,
      issueCount: findings.length,
      findings,
    };
    // ======================================
    // 10. TRẢ KẾT QUẢ
    // ======================================
    if (!hasThreshold) {
      return makeResult(
        rule,
        "SKIP",
        `Đã thống kê ${dailyStats.length} nhóm ` +
        "nhân viên/ngày theo ELECTRO, MANUAL, " +
        "OTHER; chưa cấu hình ngưỡng đánh giá.",
        details
      );
    }
    if (findings.length > 0) {
      return makeResult(
        rule,
        "FAIL",
        `Có ${findings.length} trường hợp ` +
        "vượt ngưỡng khối lượng DVKT cấu hình; " +
        "cần rà soát, chưa kết luận vi phạm.",
        details,
        findings.length
      );
    }
    if (
      uncertain.length > 0 ||
      missingTime > 0 ||
      missingPerformer > 0 ||
      dailyStats.length === 0
    ) {
      return makeResult(
        rule,
        "SKIP",
        "Chưa phát hiện vượt ngưỡng; " +
        "còn dữ liệu chưa đủ để kết luận.",
        details
      );
    }
    return makeResult(
      rule,
      "PASS",
      `Đã đối chiếu ${dailyStats.length} nhóm ` +
      "nhân viên/ngày, không vượt ngưỡng cấu hình.",
      details
    );
  },
};
