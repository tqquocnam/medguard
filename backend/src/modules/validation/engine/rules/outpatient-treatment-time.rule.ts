
import type {
  RuleResult,
  RuleValidator,
} from "../rule.types.js";

type XmlRecord = Record<string, unknown>;

interface TimeViolation {
  type: string;
  field: string;
  message: string;
  stt?: string;
  maDichVu?: string;
  tenDichVu?: string;
  value?: string;
  ngayVao?: string;
  ngayRa?: string;
}

function asRecord(value: unknown): XmlRecord | null {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as XmlRecord;
  }

  return null;
}

function getText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function getXml1(xml1: unknown): XmlRecord | null {
  const source = Array.isArray(xml1)
    ? xml1[0]
    : xml1;

  const root = asRecord(source);

  if (!root) {
    return null;
  }

  return asRecord(root.TONG_HOP);
}

function getXml3Services(xml3: unknown): XmlRecord[] {
  const source = Array.isArray(xml3)
    ? xml3[0]
    : xml3;

  const root = asRecord(source);
  const detailRoot = asRecord(
    root?.CHITIEU_CHITIET_DVKT_VTYT
  );
  const list = asRecord(
    detailRoot?.DSACH_CHI_TIET_DVKT
  );

  const rawServices = list?.CHI_TIET_DVKT;

  if (!rawServices) {
    return [];
  }

  const services = Array.isArray(rawServices)
    ? rawServices
    : [rawServices];

  return services.filter(
    (item): item is XmlRecord =>
      asRecord(item) !== null
  );
}

/**
 * Thời gian XML BHYT:
 * YYYYMMDDHHmm hoặc YYYYMMDDHHmmss.
 *
 * Tạo timestamp theo UTC chỉ để so sánh
 * các thời gian địa phương cùng hệ quy chiếu.
 * Không chuyển thời gian bệnh viện sang múi giờ khác.
 */
function parseXmlTime(value: unknown): number | null {
  const raw = getText(value);

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

function createResult(
  rule: Parameters<RuleValidator["evaluate"]>[1],
  status: RuleResult["status"],
  message: string,
  details: Record<string, unknown> = {},
  issueCount = 0
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

export const outpatientTreatmentTimeRule:
  RuleValidator = {
  async evaluate(context, rule) {
    const xml1 = getXml1(context.xml1);

    if (!xml1) {
      return createResult(
        rule,
        "SKIP",
        "Không đọc được XML1.TONG_HOP để xác định loại KCB.",
        { reason: "XML1_UNAVAILABLE" }
      );
    }

    const maLoaiKcb = getText(
      xml1.MA_LOAI_KCB
    ).padStart(2, "0");

    // Chỉ chạy cho điều trị ngoại trú.
    if (maLoaiKcb !== "02") {
      return createResult(
        rule,
        "SKIP",
        `Rule chỉ áp dụng cho điều trị ngoại trú (02). Hồ sơ hiện tại có mã ${maLoaiKcb || "trống"}.`,
        { maLoaiKcb }
      );
    }

    const maLk = getText(xml1.MA_LK);
    const ngayVao = getText(xml1.NGAY_VAO);
    const ngayRa = getText(xml1.NGAY_RA);

    const violations: TimeViolation[] = [];

    if (!ngayVao || !ngayRa) {
      return createResult(
        rule,
        "SKIP",
        "Hồ sơ ngoại trú thiếu NGAY_VAO hoặc NGAY_RA, chưa đủ dữ liệu đối chiếu thời gian DVKT.",
        {
          maLk,
          maLoaiKcb,
          ngayVao,
          ngayRa,
          reason: "VISIT_TIME_MISSING",
        }
      );
    }

    const start = parseXmlTime(ngayVao);
    const end = parseXmlTime(ngayRa);

    if (start === null || end === null) {
      return createResult(
        rule,
        "FAIL",
        "Ngày vào hoặc ngày ra không đúng định dạng thời gian XML.",
        {
          maLk,
          maLoaiKcb,
          ngayVao,
          ngayRa,
          violations: [{
            type: "INVALID_VISIT_TIME",
            field: "NGAY_VAO/NGAY_RA",
            message: "Không thể phân tích thời gian vào/ra.",
          }],
        },
        1
      );
    }

    if (end < start) {
      return createResult(
        rule,
        "FAIL",
        "Ngày ra trước ngày vào điều trị ngoại trú.",
        {
          maLk,
          maLoaiKcb,
          ngayVao,
          ngayRa,
          violations: [{
            type: "DISCHARGE_BEFORE_ADMISSION",
            field: "NGAY_RA",
            message: "NGAY_RA nhỏ hơn NGAY_VAO.",
          }],
        },
        1
      );
    }

    const services = getXml3Services(context.xml3);

    if (services.length === 0) {
      return createResult(
        rule,
        "SKIP",
        "Không có dữ liệu DVKT XML3 để kiểm tra thời gian điều trị ngoại trú.",
        {
          maLk,
          maLoaiKcb,
          ngayVao,
          ngayRa,
          checkedServices: 0,
        }
      );
    }

    let checkedTimes = 0;
    let checkedServices = 0;

    const timeFields = [
      "NGAY_YL",
      "NGAY_TH_YL",
      "NGAY_KQ",
    ] as const;

    for (const service of services) {
      const stt = getText(service.STT);
      const maDichVu = getText(
        service.MA_DICH_VU
      );
      const tenDichVu = getText(
        service.TEN_DICH_VU
      );

      let hasValidTime = false;

      for (const field of timeFields) {
        const rawTime = getText(
          service[field]
        );

        // Thời gian kết quả có thể không
        // áp dụng cho mọi loại dịch vụ.
        // Không tự đánh lỗi chỉ vì để trống.
        if (!rawTime) {
          continue;
        }

        const currentTime = parseXmlTime(
          rawTime
        );

        if (currentTime === null) {
          violations.push({
            type: "INVALID_SERVICE_TIME",
            field,
            stt,
            maDichVu,
            tenDichVu,
            value: rawTime,
            message:
              `${field} không đúng định dạng thời gian XML.`,
          });

          continue;
        }

        checkedTimes++;
        hasValidTime = true;

        if (currentTime < start) {
          violations.push({
            type: "TIME_BEFORE_TREATMENT",
            field,
            stt,
            maDichVu,
            tenDichVu,
            value: rawTime,
            ngayVao,
            ngayRa,
            message:
              `${field} xảy ra trước thời gian vào điều trị.`,
          });
        } else if (currentTime > end) {
          violations.push({
            type: "TIME_AFTER_TREATMENT",
            field,
            stt,
            maDichVu,
            tenDichVu,
            value: rawTime,
            ngayVao,
            ngayRa,
            message:
              `${field} xảy ra sau thời gian ra điều trị.`,
          });
        }
      }

      if (hasValidTime) {
        checkedServices++;
      }
    }

    const details = {
      maLk,
      maLoaiKcb,
      ngayVao,
      ngayRa,
      totalServices: services.length,
      checkedServices,
      checkedTimes,
      violations,
    };

    if (violations.length > 0) {
      return createResult(
        rule,
        "FAIL",
        `Phát hiện ${violations.length} mốc thời gian DVKT bất thường trong đợt điều trị ngoại trú.`,
        details,
        violations.length
      );
    }

    if (checkedTimes === 0) {
      return createResult(
        rule,
        "SKIP",
        "Các dịch vụ XML3 không có mốc thời gian hợp lệ để đối chiếu.",
        details
      );
    }

    return createResult(
      rule,
      "PASS",
      `Đã kiểm tra ${checkedTimes} mốc thời gian của ${checkedServices} dịch vụ. Không phát hiện thời gian nằm ngoài đợt điều trị ngoại trú.`,
      details
    );
  },
};
