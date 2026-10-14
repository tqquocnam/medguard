
import type {
  RuleValidator,
  ValidationRule,
  RuleResult,
} from "../rule.types.js";

type RecordRow = Record<string, unknown>;

type IssueType =
  | "PERFORM_BEFORE_ORDER"
  | "PERFORM_BEFORE_ADMISSION"
  | "PERFORM_AFTER_DISCHARGE";

type UncertainType =
  | "MISSING_ORDER_TIME"
  | "INVALID_ORDER_TIME"
  | "MISSING_PERFORM_TIME"
  | "INVALID_PERFORM_TIME"
  | "MISSING_TREATMENT_WINDOW"
  | "INVALID_TREATMENT_WINDOW";

type Finding = {
  type: IssueType;
  stt: string;
  serviceCode: string;
  serviceName: string;
  orderAt: string;
  performedAt: string;
  treatmentStart: string;
  treatmentEnd: string;
  differenceMinutes: number | null;
  message: string;
};

type Uncertain = {
  type: UncertainType;
  stt: string;
  serviceCode: string;
  serviceName: string;
  orderAt: string;
  performedAt: string;
  message: string;
};

function asObject(value: unknown): RecordRow | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as RecordRow)
    : null;
}

function first(value: unknown): RecordRow | null {
  return asObject(
    Array.isArray(value) ? value[0] : value
  );
}

function str(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function xml3Rows(value: unknown): RecordRow[] {
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
    : data
      ? [data]
      : [];

  return items.filter(
    (item): item is RecordRow =>
      asObject(item) !== null
  );
}

// Ngày giờ theo cấu trúc XML BHYT:
// yyyyMMddHHmm hoặc yyyyMMddHHmmss.
//
// Date.UTC chỉ dùng để biểu diễn và so sánh
// các mốc giờ địa phương, không chuyển múi giờ.
function localMs(value: string): number | null {
  if (!/^\d{12}(\d{2})?$/.test(value)) {
    return null;
  }

  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(4, 6));
  const d = Number(value.slice(6, 8));
  const h = Number(value.slice(8, 10));
  const minute = Number(value.slice(10, 12));

  const second =
    value.length === 14
      ? Number(value.slice(12, 14))
      : 0;

  const ms = Date.UTC(
    y,
    m - 1,
    d,
    h,
    minute,
    second
  );

  if (!Number.isFinite(ms)) {
    return null;
  }

  const dt = new Date(ms);

  const valid =
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d &&
    dt.getUTCHours() === h &&
    dt.getUTCMinutes() === minute &&
    dt.getUTCSeconds() === second;

  return valid ? ms : null;
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

export const yhctOrderPerformTimeRule: RuleValidator = {
  async evaluate(context, rule, _runtime) {
    // ========================================
    // 1. PHẠM VI HỒ SƠ NGOẠI TRÚ
    // ========================================

    const xml1 = first(
      first(context.xml1)?.TONG_HOP
    );

    const kcb = str(
      xml1?.MA_LOAI_KCB
    ).padStart(2, "0");

    if (!xml1 || kcb !== "02") {
      return makeResult(
        rule,
        "SKIP",
        "Rule chỉ áp dụng hồ sơ điều trị ngoại trú (02).",
        {
          scope: "MA_LOAI_KCB=02",
          kcb,
        }
      );
    }

    // ========================================
    // 2. CẤU HÌNH
    // ========================================

    const configuredCodes =
      Array.isArray(rule.config?.serviceCodes)
        ? (rule.config.serviceCodes as unknown[])
            .map(str)
            .filter(Boolean)
        : null;

    const selectedCodes =
      configuredCodes !== null
        ? new Set(configuredCodes)
        : null;

    // Mặc định không bắt buộc NGAY_TH_YL
    // nằm trong NGAY_VAO - NGAY_RA vì một số
    // cơ sở có cách ghi nhận dữ liệu khác nhau.
    const checkTreatmentWindow =
      rule.config?.checkTreatmentWindow === true;

    const treatmentStart = str(xml1.NGAY_VAO);
    const treatmentEnd = str(xml1.NGAY_RA);

    const treatmentStartMs =
      localMs(treatmentStart);

    const treatmentEndMs =
      localMs(treatmentEnd);

    const validTreatmentWindow =
      treatmentStartMs !== null &&
      treatmentEndMs !== null &&
      treatmentEndMs >= treatmentStartMs;

    // ========================================
    // 3. ĐỌC XML3
    // ========================================

    const findings: Finding[] = [];
    const uncertain: Uncertain[] = [];

    let totalRows = 0;
    let checkedActivities = 0;
    let missingOrderTime = 0;
    let invalidOrderTime = 0;
    let missingPerformTime = 0;
    let invalidPerformTime = 0;
    let checkedTreatmentWindow = 0;

    const dedup = new Set<string>();

    for (const row of xml3Rows(context.xml3)) {
      const stt = str(row.STT);
      const serviceCode = str(row.MA_DICH_VU);
      const serviceName = str(row.TEN_DICH_VU);

      if (
        selectedCodes !== null &&
        !selectedCodes.has(serviceCode)
      ) {
        continue;
      }

      const orderAt = str(row.NGAY_YL);
      const performedAt = str(row.NGAY_TH_YL);

      const dedupKey = JSON.stringify([
        stt,
        serviceCode,
        serviceName,
        orderAt,
        performedAt,
      ]);

      if (dedup.has(dedupKey)) {
        continue;
      }

      dedup.add(dedupKey);
      totalRows++;

      // ======================================
      // 4. KIỂM TRA NGÀY Y LỆNH
      // ======================================

      if (!orderAt) {
        missingOrderTime++;

        uncertain.push({
          type: "MISSING_ORDER_TIME",
          stt,
          serviceCode,
          serviceName,
          orderAt,
          performedAt,
          message: "XML3 thiếu NGAY_YL.",
        });

        continue;
      }

      const orderMs = localMs(orderAt);

      if (orderMs === null) {
        invalidOrderTime++;

        uncertain.push({
          type: "INVALID_ORDER_TIME",
          stt,
          serviceCode,
          serviceName,
          orderAt,
          performedAt,
          message:
            "NGAY_YL không đúng định dạng hoặc ngày giờ không hợp lệ.",
        });

        continue;
      }

      // ======================================
      // 5. KIỂM TRA NGÀY THỰC HIỆN
      // ======================================

      if (!performedAt) {
        missingPerformTime++;

        uncertain.push({
          type: "MISSING_PERFORM_TIME",
          stt,
          serviceCode,
          serviceName,
          orderAt,
          performedAt,
          message: "XML3 thiếu NGAY_TH_YL.",
        });

        continue;
      }

      const performedMs = localMs(performedAt);

      if (performedMs === null) {
        invalidPerformTime++;

        uncertain.push({
          type: "INVALID_PERFORM_TIME",
          stt,
          serviceCode,
          serviceName,
          orderAt,
          performedAt,
          message:
            "NGAY_TH_YL không đúng định dạng hoặc ngày giờ không hợp lệ.",
        });

        continue;
      }

      checkedActivities++;

      // ======================================
      // 6. THỰC HIỆN TRƯỚC Y LỆNH
      // ======================================

      if (performedMs < orderMs) {
        findings.push({
          type: "PERFORM_BEFORE_ORDER",
          stt,
          serviceCode,
          serviceName,
          orderAt,
          performedAt,
          treatmentStart,
          treatmentEnd,
          differenceMinutes:
            Math.round(
              ((orderMs - performedMs) / 60000) *
                100
            ) / 100,
          message:
            "Thời gian thực hiện DVKT trước thời gian ra y lệnh, cần rà soát dữ liệu.",
        });
      }

      // Không cảnh báo chỉ vì thực hiện
      // sau y lệnh nhiều ngày.

      // ======================================
      // 7. KIỂM TRA KHOẢNG ĐIỀU TRỊ
      // ======================================

      if (!checkTreatmentWindow) {
        continue;
      }

      if (!validTreatmentWindow) {
        // Chỉ ghi nhận một lần cho mỗi DVKT
        // đã có đủ thời gian y lệnh/thực hiện.
        uncertain.push({
          type:
            !treatmentStart || !treatmentEnd
              ? "MISSING_TREATMENT_WINDOW"
              : "INVALID_TREATMENT_WINDOW",
          stt,
          serviceCode,
          serviceName,
          orderAt,
          performedAt,
          message:
            "Không đủ mốc thời gian XML1 hợp lệ để đối chiếu khoảng điều trị.",
        });

        continue;
      }

      checkedTreatmentWindow++;

      if (performedMs < treatmentStartMs) {
        findings.push({
          type: "PERFORM_BEFORE_ADMISSION",
          stt,
          serviceCode,
          serviceName,
          orderAt,
          performedAt,
          treatmentStart,
          treatmentEnd,
          differenceMinutes:
            Math.round(
              ((treatmentStartMs - performedMs) /
                60000) *
                100
            ) / 100,
          message:
            "Thực hiện DVKT trước thời điểm bắt đầu điều trị theo XML1, cần rà soát.",
        });
      }

      if (performedMs > treatmentEndMs) {
        findings.push({
          type: "PERFORM_AFTER_DISCHARGE",
          stt,
          serviceCode,
          serviceName,
          orderAt,
          performedAt,
          treatmentStart,
          treatmentEnd,
          differenceMinutes:
            Math.round(
              ((performedMs - treatmentEndMs) /
                60000) *
                100
            ) / 100,
          message:
            "Thực hiện DVKT sau thời điểm kết thúc điều trị theo XML1, cần rà soát.",
        });
      }
    }

    // ========================================
    // 8. TỔNG HỢP KẾT QUẢ
    // ========================================

    const details = {
      scope: "MA_LOAI_KCB=02",
      timeSource: {
        order: "XML3.NGAY_YL",
        performed: "XML3.NGAY_TH_YL",
        treatmentStart: "XML1.NGAY_VAO",
        treatmentEnd: "XML1.NGAY_RA",
      },
      config: {
        checkTreatmentWindow,
        serviceCodes: configuredCodes,
      },
      totalRows,
      checkedActivities,
      checkedTreatmentWindow,
      missingOrderTime,
      invalidOrderTime,
      missingPerformTime,
      invalidPerformTime,
      unresolvedCount: uncertain.length,
      issueCount: findings.length,
      findings,
      uncertain,
    };

    // Phát hiện vấn đề: cảnh báo để rà soát.
    if (findings.length > 0) {
      return makeResult(
        rule,
        "FAIL",
        `Phát hiện ${findings.length} vấn đề thời gian y lệnh/thực hiện DVKT cần rà soát.`,
        details,
        findings.length
      );
    }

    // Không có dịch vụ thuộc phạm vi.
    if (totalRows === 0) {
      return makeResult(
        rule,
        "SKIP",
        "Không có dịch vụ XML3 thuộc phạm vi kiểm tra.",
        details
      );
    }

    // Thiếu dữ liệu: không tự động PASS.
    if (
      uncertain.length > 0 ||
      checkedActivities === 0
    ) {
      return makeResult(
        rule,
        "SKIP",
        `Đã kiểm tra ${checkedActivities} hoạt động, không phát hiện sai thứ tự thời gian; còn ${uncertain.length} mục chưa đủ dữ liệu.`,
        details
      );
    }

    return makeResult(
      rule,
      "PASS",
      `Đã kiểm tra ${checkedActivities} hoạt động, không phát hiện sai thứ tự thời gian y lệnh/thực hiện.`,
      details
    );
  },
};
