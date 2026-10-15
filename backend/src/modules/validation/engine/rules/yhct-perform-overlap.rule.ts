
import type {
  RuleValidator,
  ValidationRule,
  RuleResult,
} from "../rule.types.js";

// ======================================================
// YHCT_PERFORM_OVERLAP
//
// Kiểm tra chồng chéo thời gian thực hiện DVKT YHCT
// giữa các hồ sơ YHCT khác nhau.
//
// Chỉ áp dụng:
// treatment_group = YHCT
// MA_LOAI_KCB = 02
//
// Khoảng thực hiện:
// XML3.NGAY_TH_YL -> XML3.NGAY_KQ
//
// Chỉ sử dụng khoảng này khi:
// config.confirmedProcedureInterval = true
//
// Không tự kết luận vi phạm BHYT.
// ======================================================

type Row = Record<string, unknown>;

type Technique = "ELECTRO" | "MANUAL";

interface Session {
  caseId: string;
  stt: string;

  code: string;
  name: string;
  group: Technique;

  staffRaw: string;
  staffCodes: string[];

  machine: string;
  machineDisplay: string;

  start: number;
  end: number;

  startRaw: string;
  endRaw: string;
}

interface PeerRow {
  medical_case_id: string;
  patient_name: string | null;
  raw_data: Row;
}

const DEFAULT_CODES: Record<string, Technique> = {
  "08.0313.0230": "ELECTRO",
  "08.0278.0230": "ELECTRO",

  "08.0432.0280": "MANUAL",
  "08.0392.0280": "MANUAL",
};

// ======================================================
// HELPERS
// ======================================================

function obj(value: unknown): Row | null {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Row;
  }

  return null;
}

function first(value: unknown): Row | null {
  return obj(
    Array.isArray(value) ? value[0] : value
  );
}

function txt(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function normalizeCode(value: unknown): string {
  return txt(value)
    .replace(/\s+/g, "")
    .toLowerCase();
}

// ======================================================
// XML3
// ======================================================

function xml3Rows(xml: unknown): Row[] {
  const root = first(xml);

  const section = first(
    root?.CHITIEU_CHITIET_DVKT_VTYT
  );

  const list = first(
    section?.DSACH_CHI_TIET_DVKT
  );

  const data = list?.CHI_TIET_DVKT;

  const values = Array.isArray(data)
    ? data
    : data
      ? [data]
      : [];

  return values.filter(
    (value): value is Row =>
      obj(value) !== null
  );
}

// ======================================================
// NHÂN VIÊN
// ======================================================

function parseStaffCodes(
  value: unknown
): string[] {
  const unique = new Map<string, string>();

  const parts = txt(value).split(/[;|,]+/);

  for (const part of parts) {
    const code = part.trim();
    const normalized = normalizeCode(code);

    if (
      normalized &&
      !unique.has(normalized)
    ) {
      unique.set(normalized, code);
    }
  }

  return [...unique.values()];
}

function sharedStaffCodes(
  firstCodes: string[],
  secondCodes: string[]
): string[] {
  const secondSet = new Set(
    secondCodes.map(normalizeCode)
  );

  return firstCodes.filter(
    (code) =>
      secondSet.has(normalizeCode(code))
  );
}

// ======================================================
// MÃ MÁY
// ======================================================

function normalizeMachine(
  value: unknown
): string {
  return txt(value).toUpperCase();
}

// ======================================================
// DANH MỤC KỸ THUẬT
// ======================================================

function getCodes(
  rule: ValidationRule
): Record<string, Technique> {
  const configured = rule.config?.techniques;

  if (!Array.isArray(configured)) {
    return { ...DEFAULT_CODES };
  }

  const result: Record<string, Technique> = {};

  for (const item of configured) {
    const value = obj(item);

    const code = txt(
      value?.code
    ).toUpperCase();

    const group = txt(
      value?.group
    ).toUpperCase();

    if (
      code &&
      (group === "ELECTRO" ||
        group === "MANUAL")
    ) {
      result[code] = group;
    }
  }

  return result;
}

// ======================================================
// THỜI GIAN XML
//
// YYYYMMDDHHmm
// YYYYMMDDHHmmss
//
// Dùng Date.UTC như trục số để so sánh
// giờ địa phương; không chuyển múi giờ XML.
// ======================================================

function parseTime(
  value: unknown
): number | null {
  const raw = txt(value);

  if (!/^\d{12}(\d{2})?$/.test(raw)) {
    return null;
  }

  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const hour = Number(raw.slice(8, 10));
  const minute = Number(raw.slice(10, 12));

  const second =
    raw.length === 14
      ? Number(raw.slice(12, 14))
      : 0;

  const timestamp = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  );

  const date = new Date(timestamp);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    return null;
  }

  return timestamp;
}

// Format a validated XML3 timestamp without timezone conversion.
function formatBhytTime(value: string): string {
  if (parseTime(value) === null) return value;
  return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)} ${value.slice(8, 10)}:${value.slice(10, 12)}`;
}

// ======================================================
// SESSION
// ======================================================

function makeSession(
  caseId: string,
  row: Row,
  groups: Record<string, Technique>
): Session | null {
  const code = txt(
    row.MA_DICH_VU
  ).toUpperCase();

  const group = groups[code];

  if (!group) {
    return null;
  }

  const startRaw = txt(
    row.NGAY_TH_YL
  );

  const endRaw = txt(
    row.NGAY_KQ
  );

  const start = parseTime(startRaw);
  const end = parseTime(endRaw);

  if (
    start === null ||
    end === null ||
    end <= start
  ) {
    return null;
  }

  const staffRaw = txt(
    row.NGUOI_THUC_HIEN
  );

  return {
    caseId,
    stt: txt(row.STT),

    code,
    name: txt(row.TEN_DICH_VU),
    group,

    staffRaw,
    staffCodes: parseStaffCodes(staffRaw),

    machine: normalizeMachine(row.MA_MAY),
    machineDisplay: txt(row.MA_MAY),

    start,
    end,
    startRaw,
    endRaw,
  };
}

// ======================================================
// KHÓA SỰ KIỆN VÀ CHỐNG TRÙNG
// ======================================================

function eventKey(
  session: Session
): string {
  return JSON.stringify([
    session.caseId,
    session.stt,
    session.code,
    session.startRaw,
    session.endRaw,
  ]);
}

function conflictPairKey(
  a: Session,
  b: Session,
  type: string
): string {
  const keys = [
    eventKey(a),
    eventKey(b),
  ].sort();

  return JSON.stringify([
    type,
    keys[0],
    keys[1],
  ]);
}

// ======================================================
// SỐ PHÚT CHỒNG LẤN
// ======================================================

function overlapMinutes(
  a: Session,
  b: Session
): number {
  const start = Math.max(
    a.start,
    b.start
  );

  const end = Math.min(
    a.end,
    b.end
  );

  if (end <= start) {
    return 0;
  }

  return Math.round(
    ((end - start) / 60000) * 100
  ) / 100;
}

// ======================================================
// RESULT
// ======================================================

function result(
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

export const yhctPerformOverlapRule:
  RuleValidator = {
  async evaluate(context, rule, runtime) {

    // ============================================
    // 1. CHỈ ÁP DỤNG YHCT NGOẠI TRÚ
    // ============================================

    const medicalCase =
      context.medicalCase as
        typeof context.medicalCase & {
          treatment_group?: string | null;
        };

    const treatmentGroup = txt(
      medicalCase.treatment_group
    ).toUpperCase();

    const xml1 = first(
      first(context.xml1)?.TONG_HOP
    );

    const kcb = txt(
      xml1?.MA_LOAI_KCB
    ).padStart(2, "0");

    if (
      treatmentGroup !== "YHCT" ||
      !xml1 ||
      kcb !== "02"
    ) {
      return result(
        rule,
        "SKIP",
        "Chỉ kiểm tra trùng thời gian thực hiện cho hồ sơ ngoại trú YHCT.",
        {
          skipReason: "NOT_APPLICABLE",
          treatmentGroup,
          kcb,
          findings: [],
        }
      );
    }

    // ============================================
    // 2. XÁC NHẬN Ý NGHĨA NGAY_KQ
    // ============================================

    if (
      rule.config?.confirmedProcedureInterval !== true
    ) {
      return result(
        rule,
        "SKIP",
        "Chưa xác nhận NGAY_KQ là thời điểm kết thúc thực hiện DVKT. Không suy diễn thời lượng.",
        {
          skipReason: "INTERVAL_NOT_CONFIRMED",
          treatmentGroup,
          confirmedProcedureInterval: false,
          findings: [],
        }
      );
    }

    // ============================================
    // 3. ĐỌC CÁC KỸ THUẬT TRONG XML3
    // ============================================

    const groups = getCodes(rule);

    const currentRows = xml3Rows(
      context.xml3
    );

    const own: Session[] = [];
    const ownSeen = new Set<string>();

    let incomplete = 0;
    let configuredRows = 0;

    for (const row of currentRows) {
      const code = txt(
        row.MA_DICH_VU
      ).toUpperCase();

      if (!groups[code]) {
        continue;
      }

      configuredRows++;

      const session = makeSession(
        context.medicalCase.id,
        row,
        groups
      );

      if (!session) {
        incomplete++;
        continue;
      }

      const key = eventKey(session);

      if (ownSeen.has(key)) {
        continue;
      }

      ownSeen.add(key);
      own.push(session);
    }

    if (own.length === 0) {
      return result(
        rule,
        "SKIP",
        "Không có khoảng thực hiện YHCT đủ dữ liệu để đối chiếu.",
        {
          configuredRows,
          incompleteSessions: incomplete,
          configuredCodes: Object.keys(groups),
          checkedSessions: 0,
          findings: [],
        }
      );
    }

    // ============================================
    // 4. THU THẬP MÃ NHÂN VIÊN VÀ MÃ MÁY
    // ============================================

    const staffCodes = [
      ...new Set(
        own.flatMap(
          (session) =>
            session.staffCodes.map(
              normalizeCode
            )
        )
      ),
    ];

    const machineCodes = [
      ...new Set(
        own
          .filter(
            (session) =>
              session.group === "ELECTRO"
          )
          .map(
            (session) => session.machine
          )
          .filter(Boolean)
      ),
    ];

    const minDate = own
      .map(
        (session) =>
          session.startRaw.slice(0, 8)
      )
      .sort()[0];

    const endDates = own
      .map(
        (session) =>
          session.endRaw.slice(0, 8)
      )
      .sort();

    const maxDate =
      endDates[endDates.length - 1] ??
      minDate;

    // ============================================
    // 5. TÌM HOẠT ĐỘNG Ở HỒ SƠ YHCT KHÁC
    //
    // QUAN TRỌNG:
    // - Không lấy hồ sơ GENERAL.
    // - Không lấy hoạt động cùng hồ sơ.
    // - Truy vấn core.medical_events XML3.
    // - So sánh mã nhân viên đã chuẩn hóa.
    // ============================================

    const peerQuery =
      await runtime.client.query<PeerRow>(
        `
        SELECT
          e.medical_case_id,
          mc.ho_ten AS patient_name,
          e.raw_data

        FROM core.medical_events e

        JOIN core.medical_cases mc
          ON mc.id = e.medical_case_id

        WHERE e.source_type = 'XML3'

          AND e.medical_case_id <> $1::uuid

          AND mc.treatment_group = 'YHCT'

          AND (
            EXISTS (
              SELECT 1
              FROM regexp_split_to_table(
                COALESCE(
                  e.raw_data ->> 'NGUOI_THUC_HIEN',
                  ''
                ),
                '[;|,]+'
              ) AS person(code)
              WHERE LOWER(
                REGEXP_REPLACE(
                  BTRIM(person.code),
                  '[[:space:]]+',
                  '',
                  'g'
                )
              ) = ANY($2::text[])
            )

            OR (
              UPPER(
                BTRIM(
                  COALESCE(
                    e.raw_data ->> 'MA_MAY',
                    ''
                  )
                )
              ) = ANY($3::text[])
            )
          )

          AND LEFT(
            e.raw_data ->> 'NGAY_TH_YL',
            8
          ) <= $5::text

          AND LEFT(
            COALESCE(
              NULLIF(
                e.raw_data ->> 'NGAY_KQ',
                ''
              ),
              e.raw_data ->> 'NGAY_TH_YL'
            ),
            8
          ) >= $4::text
        `,
        [
          context.medicalCase.id,
          staffCodes,
          machineCodes,
          minDate,
          maxDate,
        ]
      );

    // ============================================
    // 6. SO SÁNH CÁC KHOẢNG THỜI GIAN
    // ============================================

    const findings:
      Array<Record<string, unknown>> = [];

    const seen = new Set<string>();
    const peerSeen = new Set<string>();

    let comparedOverlaps = 0;
    let validPeerSessions = 0;

    for (const peer of peerQuery.rows) {
      const other = makeSession(
        String(peer.medical_case_id),
        peer.raw_data,
        groups
      );

      if (!other) {
        continue;
      }

      const otherKey = eventKey(other);

      if (peerSeen.has(otherKey)) {
        continue;
      }

      peerSeen.add(otherKey);
      validPeerSessions++;

      for (const current of own) {
        const minutes = overlapMinutes(
          current,
          other
        );

        if (minutes <= 0) {
          continue;
        }

        const commonStaff =
          sharedStaffCodes(
            current.staffCodes,
            other.staffCodes
          );

        const sameStaff =
          commonStaff.length > 0;

        const sameMachine =
          !!current.machine &&
          current.machine === other.machine;

        if (!sameStaff && !sameMachine) {
          continue;
        }

        comparedOverlaps++;

        // ========================================
        // 7. PHÂN LOẠI XUNG ĐỘT
        // ========================================

        let type: string | null = null;

        // Điện châm dùng chung máy.
        if (
          sameMachine &&
          (
            current.group === "ELECTRO" ||
            other.group === "ELECTRO"
          )
        ) {
          type = "SAME_MACHINE_OVERLAP";
        }

        // Hai kỹ thuật thủ công do cùng
        // nhân viên thực hiện ở hai hồ sơ.
        else if (
          sameStaff &&
          current.group === "MANUAL" &&
          other.group === "MANUAL"
        ) {
          type = "DIRECT_STAFF_OVERLAP";
        }

        // Điện châm và thủ công cùng nhân viên:
        // cần rà soát, không tự kết luận.
        else if (
          sameStaff &&
          current.group !== other.group
        ) {
          type = "MIXED_TECHNIQUE_REVIEW";
        }

        // Điện châm + điện châm khác máy:
        // không tự kết luận một nhân viên
        // không thể thực hiện đồng thời.
        if (!type) {
          continue;
        }

        // ========================================
        // 8. KHÔNG ĐẾM TRÙNG CẶP
        // ========================================

        const pairKey = conflictPairKey(
          current,
          other,
          type
        );

        if (seen.has(pairKey)) {
          continue;
        }

        seen.add(pairKey);

        // ========================================
        // 9. CHI TIẾT CẢNH BÁO
        // ========================================

        findings.push({
          type,
          pairKey,

          currentCaseId: current.caseId,
          currentStt: current.stt,
          currentCode: current.code,
          currentName: current.name,

          otherCaseId: other.caseId,
          otherPatientName: txt(peer.patient_name) || null,
          otherStt: other.stt,
          otherCode: other.code,
          otherName: other.name,

          staff: sameStaff
            ? commonStaff.join(";")
            : null,

          staffCodes: commonStaff,

          currentStaffRaw: current.staffRaw,
          otherStaffRaw: other.staffRaw,

          machine: sameMachine
            ? current.machine
            : null,

          currentMachine: current.machine,
          otherMachine: other.machine,

          currentStart: current.startRaw,
          currentEnd: current.endRaw,

          otherStart: other.startRaw,
          otherEnd: other.endRaw,

          overlapMinutes: minutes,
          reviewRequired: true,

          // Hiển thị theo cách trình bày của iCheck, giữ nguyên kết luận cần rà soát.
          message: type === "SAME_MACHINE_OVERLAP"
            ? `${current.machineDisplay || current.machine}[${current.name}: ${formatBhytTime(current.startRaw)} → ${formatBhytTime(current.endRaw)} (Trùng thời gian thực hiện máy)] ${txt(peer.patient_name) || `Hồ sơ ${other.caseId}`} - ${other.name}: ${formatBhytTime(other.startRaw)} → ${formatBhytTime(other.endRaw)}`
            : `${commonStaff.join(";") || "Nhân viên"}[${current.name}: ${formatBhytTime(current.startRaw)} → ${formatBhytTime(current.endRaw)} (${type === "DIRECT_STAFF_OVERLAP" ? "Trùng thời gian nhân viên" : "Thời gian thực hiện giao nhau"})] ${txt(peer.patient_name) || `Hồ sơ ${other.caseId}`} - ${other.name}: ${formatBhytTime(other.startRaw)} → ${formatBhytTime(other.endRaw)}`,

          note:
            "Hai hoạt động YHCT có khoảng thời gian chồng lấn theo dữ liệu XML3. Cần đối chiếu hồ sơ và quy trình thực hiện trước khi kết luận.",
        });
      }
    }

    // ============================================
    // 10. TỔNG HỢP KẾT QUẢ
    // ============================================

    const details:
      Record<string, unknown> = {
        treatmentGroup,
        scope: "YHCT_ONLY",

        checkedSessions: own.length,
        configuredServiceRows: configuredRows,
        incompleteSessions: incomplete,

        peerEvents: peerQuery.rows.length,
        validPeerSessions,

        comparedOverlaps,
        uniqueConflictPairsInCase:
          findings.length,

        normalizedStaffCodes: staffCodes,

        confirmedProcedureInterval: true,

        intervalBasis:
          "XML3.NGAY_TH_YL -> XML3.NGAY_KQ",

        findings,
      };

    // ============================================
    // 11. CÓ XUNG ĐỘT CẦN RÀ SOÁT
    // ============================================

    if (findings.length > 0) {
      return result(
        rule,
        "FAIL",
        `Có ${findings.length} cặp thời gian thực hiện YHCT cần rà soát (chưa kết luận vi phạm).`,
        details,
        findings.length
      );
    }

    // ============================================
    // 12. THIẾU DỮ LIỆU
    // ============================================

    if (incomplete > 0) {
      return result(
        rule,
        "SKIP",
        `Đã đối chiếu ${own.length} ca YHCT, nhưng còn ${incomplete} dòng thiếu hoặc sai mốc thời gian.`,
        details
      );
    }

    // ============================================
    // 13. KHÔNG PHÁT HIỆN XUNG ĐỘT
    // ============================================

    return result(
      rule,
      "PASS",
      `Đã đối chiếu ${own.length} ca YHCT với các hồ sơ YHCT khác, không phát hiện xung đột theo cấu hình.`,
      details
    );
  },
};
