import type {
  RuleValidator,
  RuleResult,
} from "../rule.types.js";

type Row = Record<string, unknown>;

function first(value: unknown): Row {
  if (Array.isArray(value)) {
    return first(value[0]);
  }

  return value !== null && typeof value === "object"
    ? (value as Row)
    : {};
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function rows(value: unknown): Row[] {
  if (Array.isArray(value)) {
    return value
      .filter(
        (item) =>
          item !== null &&
          typeof item === "object" &&
          !Array.isArray(item)
      )
      .map(first);
  }

  if (value !== null && typeof value === "object") {
    return [first(value)];
  }

  return [];
}

// Chỉ nhận thời điểm XML có đủ ngày, giờ, phút.
// Kiểm tra lịch hợp lệ để tránh ngày sai bị tự chuyển sang ngày khác.
function normalizeTime(value: unknown): string | null {
  const raw = text(value);

  if (!/^\d{12}(\d{2})?$/.test(raw)) {
    return null;
  }

  const normalized = raw.length === 12 ? `${raw}00` : raw;

  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(4, 6));
  const day = Number(normalized.slice(6, 8));
  const hour = Number(normalized.slice(8, 10));
  const minute = Number(normalized.slice(10, 12));
  const second = Number(normalized.slice(12, 14));

  if (year < 1900 || year > 9999) return null;

  const date = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    return null;
  }

  return normalized;
}

function displayTime(value: string): string {
  return (
    `${value.slice(6, 8)}/${value.slice(4, 6)}/` +
    `${value.slice(0, 4)} ` +
    `${value.slice(8, 10)}:${value.slice(10, 12)}` +
    `:${value.slice(12, 14)}`
  );
}

function getXml3Rows(value: unknown): Row[] {
  const root = first(value);

  const container = first(
    root.CHITIEU_CHITIET_DVKT_VTYT ?? root
  );

  const list = first(container.DSACH_CHI_TIET_DVKT);

  return rows(list.CHI_TIET_DVKT);
}

function isExam(row: Row): boolean {
  // Ưu tiên mã nhóm công khám.
  const group = text(row.MA_NHOM);

  if (group) {
    return /^\d+$/.test(group) && Number(group) === 13;
  }

  // Chỉ nhận diện theo tên khi XML thiếu MA_NHOM.
  const name = text(row.TEN_DICH_VU)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return /^kham(?:\s|$)/.test(name);
}

export const outpatientExamAdmissionTimeRule: RuleValidator = {
  async evaluate(context, rule): Promise<RuleResult> {
    const base = {
      ruleId: rule.id,
      ruleCode: rule.code,
      severity: "WARNING" as const,
      issueCount: 0,
    };

    const root = first(context.xml1);
    const xml1 = first(root.TONG_HOP ?? root);

    const kcbType = text(xml1.MA_LOAI_KCB).padStart(2, "0");

    const configuredTypes = rule.config?.outpatientTypes;

    const outpatientTypes = Array.isArray(configuredTypes)
      ? configuredTypes.map((value) => text(value).padStart(2, "0"))
      : ["01", "02"];

    if (!outpatientTypes.includes(kcbType)) {
      return {
        ...base,
        status: "SKIP",
        message: "Hồ sơ ngoài phạm vi ngoại trú được cấu hình.",
        details: { kcbType, outpatientTypes },
      };
    }

    const admissionTime = normalizeTime(xml1.NGAY_VAO);

    if (!admissionTime) {
      return {
        ...base,
        status: "SKIP",
        message: "Thiếu hoặc không hợp lệ XML1.NGAY_VAO.",
      };
    }

    const exams = getXml3Rows(context.xml3).filter(isExam);

    if (exams.length === 0) {
      return {
        ...base,
        status: "SKIP",
        message: "Không có dòng công khám XML3 để đối chiếu.",
      };
    }

    const patientName =
      text(xml1.HO_TEN) || text(context.medicalCase.ho_ten);

    const patientCode =
      text(xml1.MA_BN) || text(context.medicalCase.ma_bn);

    let invalidOrderCount = 0;

    const findings: Row[] = [];

    for (const exam of exams) {
      const orderTime = normalizeTime(exam.NGAY_YL);

      if (!orderTime) {
        invalidOrderCount++;
        continue;
      }

      if (orderTime !== admissionTime) continue;

      const serviceCode = text(exam.MA_DICH_VU);
      const serviceName = text(exam.TEN_DICH_VU) || "Công khám";

      findings.push({
        type: "EXAM_ORDER_EQUALS_ADMISSION",
        date:
          `${orderTime.slice(0, 4)}-` +
          `${orderTime.slice(4, 6)}-` +
          `${orderTime.slice(6, 8)}`,
        stt: text(exam.STT),
        patientName,
        patientCode,
        serviceCode,
        serviceName,
        doctorCode: text(exam.MA_BAC_SI),
        admissionTime,
        orderTime,
        message:
          `Bệnh nhân ${patientName || "chưa rõ tên"}` +
          `${patientCode ? ` (mã BN: ${patientCode})` : ""}. ` +
          `${serviceName}` +
          `${serviceCode ? ` [${serviceCode}]` : ""}` +
          `${text(exam.STT) ? `, STT XML3: ${text(exam.STT)}` : ""}. ` +
          `Thời gian vào viện: ${displayTime(admissionTime)}; ` +
          `thời gian y lệnh công khám: ${displayTime(orderTime)}. ` +
          "Hai thời điểm bằng nhau, cần rà soát.",
      });
    }

    const details = {
      kcbType,
      patientName,
      patientCode,
      admissionTime,
      examCount: exams.length,
      checkedExamCount: exams.length - invalidOrderCount,
      invalidOrderCount,
      findings,
      source: {
        admission: "XML1.NGAY_VAO",
        order: "XML3.NGAY_YL",
        examGroup: "XML3.MA_NHOM",
      },
    };

    if (findings.length > 0) {
      return {
        ...base,
        status: "FAIL",
        issueCount: findings.length,
        message:
          `Có ${findings.length} công khám có thời gian y lệnh ` +
          "bằng thời gian vào viện.",
        details,
      };
    }

    if (invalidOrderCount > 0) {
      return {
        ...base,
        status: "SKIP",
        message:
          `Chưa phát hiện thời điểm trùng trong các dòng hợp lệ; ` +
          `${invalidOrderCount} công khám thiếu hoặc sai NGAY_YL.`,
        details,
      };
    }

    return {
      ...base,
      status: "PASS",
      message:
        "Không có công khám có thời gian y lệnh bằng thời gian vào viện.",
      details,
    };
  },
};