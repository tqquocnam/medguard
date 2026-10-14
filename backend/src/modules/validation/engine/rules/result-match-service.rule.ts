
import type {
  RuleValidator,
  RuleResult,
} from "../rule.types.js";

// ======================================================
// RESULT_MATCH_SERVICE
//
// PHẠM VI: CHỈ HỒ SƠ YHCT
//
// Đối chiếu XML3 và XML4 bằng:
// - MA_DICH_VU
// - NGAY_KQ
//
// Không bắt buộc XML3 thiếu NGAY_KQ phải có XML4.
//
// Không bắt buộc GIA_TRI, MO_TA, KET_LUAN có giá trị.
//
// Cùng mã DVKT thực hiện nhiều ngày được đối chiếu
// độc lập theo từng thời điểm kết quả.
//
// GENERAL: SKIP, tuyệt đối không kiểm tra bằng
// thuật toán ghép 1-1 dành cho YHCT.
//
// strictMatch=false: cảnh báo WARNING.
// strictMatch=true: sử dụng severity trong database.
// ======================================================

type XmlRow = Record<string, unknown>;

interface MatchItem {
  stt: string;
  serviceCode: string;
  resultTime: string;
  serviceName: string;
}

interface MatchViolation {
  type:
    | "MISSING_XML4_RESULT"
    | "EXTRA_XML4_RESULT"
    | "INCOMPLETE_MATCH_KEY";

  serviceCode: string;
  serviceName: string;
  resultTime: string;

  expectedCount: number;
  actualCount: number;
  difference: number;

  xml3Stt: string[];
  xml4Stt: string[];

  message: string;
}

// ======================================================
// HELPERS
// ======================================================

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function obj(value: unknown): XmlRow {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as XmlRow;
  }

  return {};
}

function rows(value: unknown): XmlRow[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is XmlRow =>
        item !== null &&
        typeof item === "object" &&
        !Array.isArray(item)
    );
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    return [obj(value)];
  }

  return [];
}

// ======================================================
// ĐỌC XML3
// ======================================================

function xml3Rows(xml: unknown): XmlRow[] {
  const root = obj(xml);

  const container = obj(
    root.CHITIEU_CHITIET_DVKT_VTYT ?? root
  );

  const list = obj(
    container.DSACH_CHI_TIET_DVKT
  );

  return rows(list.CHI_TIET_DVKT);
}

// ======================================================
// ĐỌC XML4
// ======================================================

function xml4Rows(xml: unknown): XmlRow[] {
  const root = obj(xml);

  const container = obj(
    root.CHITIEU_CHITIET_DICHVUCANLAMSANG ??
      root
  );

  const list = obj(
    container.DSACH_CHI_TIET_CLS
  );

  return rows(list.CHI_TIET_CLS);
}

// ======================================================
// CHUẨN HÓA THỜI ĐIỂM
// ======================================================

function normalizeTime(value: unknown): string {
  const raw = str(value);

  // yyyyMMddHHmm
  if (/^\d{12}$/.test(raw)) {
    return `${raw}00`;
  }

  // yyyyMMddHHmmss
  if (/^\d{14}$/.test(raw)) {
    return raw;
  }

  return raw;
}

// ======================================================
// TẠO KHÓA ĐỐI CHIẾU
// ======================================================

function matchKey(item: MatchItem): string {
  return JSON.stringify([
    item.serviceCode.toUpperCase(),
    item.resultTime,
  ]);
}

function convertRow(
  row: XmlRow,
  isXml3: boolean
): MatchItem {
  return {
    stt: str(row.STT),
    serviceCode: str(row.MA_DICH_VU),
    resultTime: normalizeTime(row.NGAY_KQ),
    serviceName: isXml3
      ? str(row.TEN_DICH_VU)
      : "",
  };
}

function groupByKey(
  items: MatchItem[]
): Map<string, MatchItem[]> {
  const map = new Map<string, MatchItem[]>();

  for (const item of items) {
    const key = matchKey(item);
    const current = map.get(key) ?? [];

    current.push(item);
    map.set(key, current);
  }

  return map;
}

// ======================================================
// TẠO KẾT QUẢ SKIP
// ======================================================

function skipResult(
  rule: {
    id: string;
    code: string;
    severity: RuleResult["severity"];
  },
  message: string,
  details: Record<string, unknown>
): RuleResult {
  return {
    ruleId: rule.id,
    ruleCode: rule.code,
    status: "SKIP",
    severity: rule.severity,
    message,
    issueCount: 0,
    details,
  };
}

// ======================================================
// RULE CHÍNH
// ======================================================

export const resultMatchServiceRule:
  RuleValidator = {
  async evaluate(context, rule) {
    // ================================================
    // 1. KIỂM TRA PHẠM VI HỒ SƠ
    // ================================================

    const medicalCase = context.medicalCase as
      typeof context.medicalCase & {
        treatment_group?: string | null;
      };

    const treatmentGroup = str(
      medicalCase.treatment_group
    ).toUpperCase();

    // Chỉ chạy trên hồ sơ YHCT.
    //
    // GENERAL hoặc NULL không được phép thực hiện
    // đối chiếu 1-1 XML3/XML4 bằng rule này.
    if (treatmentGroup !== "YHCT") {
      return skipResult(
        rule,
        "Không áp dụng RESULT_MATCH_SERVICE cho hồ sơ ngoài nhóm YHCT.",
        {
          skipReason: "NOT_APPLICABLE",
          treatmentGroup:
            treatmentGroup || null,
          violations: [],
        }
      );
    }

    // ================================================
    // 2. ĐỌC XML3 / XML4
    // ================================================

    const xml3 = xml3Rows(context.xml3);
    const xml4 = xml4Rows(context.xml4);

    const base = {
      ruleId: rule.id,
      ruleCode: rule.code,
    };

    if (xml3.length === 0) {
      return skipResult(
        rule,
        "Không có dữ liệu dịch vụ XML3 để đối chiếu.",
        {
          skipReason: "NO_XML3",
          totalXml3: 0,
          totalXml4: xml4.length,
          violations: [],
        }
      );
    }

    // ================================================
    // 3. CHUẨN BỊ DỮ LIỆU ĐỐI CHIẾU
    // ================================================

    const expected = xml3
      .map((item) => convertRow(item, true))
      .filter(
        (item) => item.resultTime !== ""
      );

    const actual = xml4.map(
      (item) => convertRow(item, false)
    );

    if (
      expected.length === 0 &&
      actual.length === 0
    ) {
      return skipResult(
        rule,
        "Không có dòng kết quả XML3/XML4 cần đối chiếu.",
        {
          skipReason: "NO_RESULTS_TO_MATCH",
          totalXml3: xml3.length,
          totalXml4: xml4.length,
          expectedResultRows: 0,
          violations: [],
        }
      );
    }

    // ================================================
    // 4. NHÓM THEO MA_DICH_VU + NGAY_KQ
    // ================================================

    const expectedMap = groupByKey(expected);
    const actualMap = groupByKey(actual);

    const keys = new Set<string>([
      ...expectedMap.keys(),
      ...actualMap.keys(),
    ]);

    const violations: MatchViolation[] = [];

    let matchedRows = 0;
    let unmatchedRows = 0;

    for (const key of keys) {
      const xml3Items =
        expectedMap.get(key) ?? [];

      const xml4Items =
        actualMap.get(key) ?? [];

      const expectedCount = xml3Items.length;
      const actualCount = xml4Items.length;

      const sample =
        xml3Items[0] ?? xml4Items[0];

      if (!sample) {
        continue;
      }

      // ============================================
      // THIẾU MÃ DỊCH VỤ / NGÀY KẾT QUẢ
      // ============================================

      if (
        !sample.serviceCode ||
        !sample.resultTime
      ) {
        const difference = Math.max(
          expectedCount,
          actualCount
        );

        unmatchedRows += difference;

        violations.push({
          type: "INCOMPLETE_MATCH_KEY",

          serviceCode: sample.serviceCode,
          serviceName: sample.serviceName,
          resultTime: sample.resultTime,

          expectedCount,
          actualCount,
          difference,

          xml3Stt: xml3Items.map(
            (item) => item.stt
          ),

          xml4Stt: xml4Items.map(
            (item) => item.stt
          ),

          message:
            "Dòng kết quả thiếu MA_DICH_VU hoặc NGAY_KQ, không đủ thông tin để đối chiếu.",
        });

        continue;
      }

      // ============================================
      // TÍNH SỐ DÒNG KHỚP
      // ============================================

      matchedRows += Math.min(
        expectedCount,
        actualCount
      );

      // ============================================
      // XML3 NHIỀU HƠN XML4
      // ============================================

      if (expectedCount > actualCount) {
        const difference =
          expectedCount - actualCount;

        unmatchedRows += difference;

        violations.push({
          type: "MISSING_XML4_RESULT",

          serviceCode: sample.serviceCode,
          serviceName: sample.serviceName,
          resultTime: sample.resultTime,

          expectedCount,
          actualCount,
          difference,

          xml3Stt: xml3Items.map(
            (item) => item.stt
          ),

          xml4Stt: xml4Items.map(
            (item) => item.stt
          ),

          message:
            `Dịch vụ ${sample.serviceCode}, ` +
            `ngày kết quả ${sample.resultTime}: ` +
            `XML3 có ${expectedCount} dòng, ` +
            `XML4 có ${actualCount} dòng.`,
        });
      }

      // ============================================
      // XML4 NHIỀU HƠN XML3
      // ============================================

      else if (actualCount > expectedCount) {
        const difference =
          actualCount - expectedCount;

        unmatchedRows += difference;

        violations.push({
          type: "EXTRA_XML4_RESULT",

          serviceCode: sample.serviceCode,
          serviceName: sample.serviceName,
          resultTime: sample.resultTime,

          expectedCount,
          actualCount,
          difference,

          xml3Stt: xml3Items.map(
            (item) => item.stt
          ),

          xml4Stt: xml4Items.map(
            (item) => item.stt
          ),

          message:
            `XML4 có ${difference} dòng kết quả ` +
            `dịch vụ ${sample.serviceCode}, ` +
            `thời điểm ${sample.resultTime} ` +
            "chưa tìm được dòng XML3 tương ứng.",
        });
      }
    }

    // ================================================
    // 5. TỔNG HỢP CHI TIẾT
    // ================================================

    const details = {
      treatmentGroup,
      matchMode:
        "YHCT_SERVICE_CODE_RESULT_TIME_COUNT",

      totalXml3: xml3.length,
      totalXml4: xml4.length,

      expectedResultRows: expected.length,
      matchedRows,
      unmatchedRows,

      violations,
    };

    // ================================================
    // 6. PASS
    // ================================================

    if (violations.length === 0) {
      return {
        ...base,
        status: "PASS",
        severity: rule.severity,

        message:
          `Đối chiếu XML3–XML4 YHCT đạt: ` +
          `${matchedRows} dòng kết quả khớp.`,

        issueCount: 0,
        details,
      };
    }

    // ================================================
    // 7. FAIL / WARNING
    // ================================================

    const strictMatch =
      rule.config?.strictMatch === true;

    return {
      ...base,
      status: "FAIL",

      severity:
        strictMatch
          ? rule.severity
          : "WARNING",

      message:
        `Đối chiếu XML3–XML4 YHCT có ` +
        `${unmatchedRows} dòng chưa khớp, ` +
        `thuộc ${violations.length} nhóm vấn đề.`,

      issueCount: unmatchedRows,

      details: {
        ...details,
        strictMatch,
      },
    };
  },
};
