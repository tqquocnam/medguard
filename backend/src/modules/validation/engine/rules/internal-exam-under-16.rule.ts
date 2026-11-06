import type { RuleValidator } from "../rule.types.js";

type XmlRow = Record<string, unknown>;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalize(value: unknown): string {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");
}

// Hỗ trợ XML có hoặc không có wrapper.
function findField(
  value: unknown,
  field: string,
  depth = 0
): unknown {
  if (!value || typeof value !== "object" || depth > 12) {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findField(child, field, depth + 1);
      if (found !== undefined) return found;
    }

    return undefined;
  }

  const object = value as XmlRow;

  if (Object.prototype.hasOwnProperty.call(object, field)) {
    return object[field];
  }

  for (const child of Object.values(object)) {
    const found = findField(child, field, depth + 1);
    if (found !== undefined) return found;
  }

  return undefined;
}

function getServiceRows(xml: unknown): XmlRow[] {
  const value = findField(xml, "CHI_TIET_DVKT");
  const rows = Array.isArray(value) ? value : value ? [value] : [];

  return rows.filter(
    (row): row is XmlRow =>
      row !== null &&
      typeof row === "object" &&
      !Array.isArray(row)
  );
}

function dateText(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";

    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("");
  }

  const raw = text(value);

  // Ngày lấy từ database dạng YYYY-MM-DD.
  if (/^\d{4}-\d{2}-\d{2}(?:$|[T ])/.test(raw)) {
    return raw.slice(0, 10).replace(/-/g, "");
  }

  return raw;
}

function parseDate(value: unknown): Date | null {
  const raw = dateText(value);

  // XML: YYYYMMDD, YYYYMMDDHHmm hoặc YYYYMMDDHHmmss.
  if (!/^\d{8}(?:\d{4}|\d{6})?$/.test(raw)) {
    return null;
  }

  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function getAge(birth: Date, exam: Date): number | null {
  if (exam < birth) return null;

  let age = exam.getUTCFullYear() - birth.getUTCFullYear();

  const beforeBirthday =
    exam.getUTCMonth() < birth.getUTCMonth() ||
    (
      exam.getUTCMonth() === birth.getUTCMonth() &&
      exam.getUTCDate() < birth.getUTCDate()
    );

  if (beforeBirthday) age--;

  return age;
}

function formatDate(date: Date): string {
  return [
    String(date.getUTCDate()).padStart(2, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    date.getUTCFullYear(),
  ].join("/");
}

export const internalExamUnder16Rule: RuleValidator = {
  async evaluate(context, rule) {
    const base = {
      ruleId: rule.id,
      ruleCode: rule.code,
      severity: rule.severity,
    };

    // Có thể cấu hình mã dịch vụ khám Nội của phòng khám.
    const configuredCodes = rule.config?.internalExamCodes;

    const internalExamCodes = new Set(
      Array.isArray(configuredCodes)
        ? configuredCodes.map(text).filter(Boolean)
        : []
    );

    const services = getServiceRows(context.xml3).filter((row) => {
      const code = text(row.MA_DICH_VU);
      const name = normalize(row.TEN_DICH_VU);

      if (internalExamCodes.has(code)) return true;

      // Khám Nội, Khám Nội khoa, Khám Nội tổng hợp...
      // Không nhận nhầm "Khám nội soi".
      return /^kham (?:chuyen khoa )?noi(?: khoa| tong hop)?(?:$|\s*[-(])/.test(
        name
      );
    });

    if (services.length === 0) {
      return {
        ...base,
        status: "SKIP",
        message: "Không có dịch vụ khám Nội trong XML3.",
        issueCount: 0,
        details: {
          skipReason: "NO_INTERNAL_EXAM",
          findings: [],
        },
      };
    }

    const birth = parseDate(
      findField(context.xml1, "NGAY_SINH")
    );

    if (!birth) {
      return {
        ...base,
        status: "SKIP",
        message: "Thiếu hoặc sai ngày sinh, chưa thể kiểm tra tuổi khám Nội.",
        issueCount: 0,
        details: {
          skipReason: "INVALID_BIRTH_DATE",
          findings: [],
        },
      };
    }

    const fallbackDate =
      findField(context.xml1, "NGAY_VAO") ||
      context.medicalCase.ngay_vao;

    const findings: Array<{
      type: string;
      code: string;
      name: string;
      stt: string;
      age: number;
      date: string;
      message: string;
    }> = [];

    const uncoveredItems: Array<{
      stt: string;
      code: string;
      reason: string;
    }> = [];

    for (const service of services) {
      const examValue =
        service.NGAY_TH_YL ||
        service.NGAY_YL ||
        fallbackDate;

      const examDate = parseDate(examValue);
      const age = examDate ? getAge(birth, examDate) : null;

      if (!examDate || age === null) {
        uncoveredItems.push({
          stt: text(service.STT),
          code: text(service.MA_DICH_VU),
          reason: "INVALID_EXAM_DATE",
        });

        continue;
      }

      if (age >= 16) continue;

      const code = text(service.MA_DICH_VU);
      const name = text(service.TEN_DICH_VU) || "Khám Nội";
      const patientName = text(context.medicalCase.ho_ten);
      const patientLabel = patientName
        ? `Bệnh nhân ${patientName}`
        : "Bệnh nhân";

      findings.push({
        type: "INTERNAL_EXAM_UNDER_16",
        code,
        name,
        stt: text(service.STT),
        age,
        date: dateText(examValue).slice(0, 8),
        message:
          `${patientLabel}, ${age} tuổi (dưới 16 tuổi), ` +
          `có dịch vụ "${name}"` +
          (code ? ` [${code}]` : "") +
          ` ngày ${formatDate(examDate)}. ` +
          "Cần rà soát chuyên khoa khám.",
      });
    }

    if (findings.length > 0) {
      return {
        ...base,
        status: "FAIL",
        message:
          `Phát hiện ${findings.length} lượt khám Nội ` +
          "cho bệnh nhân dưới 16 tuổi.",
        issueCount: findings.length,
        details: {
          findings,
          uncoveredItems,
        },
      };
    }

    if (uncoveredItems.length > 0) {
      return {
        ...base,
        status: "SKIP",
        message: "Một số lượt khám Nội chưa đủ dữ liệu ngày khám hợp lệ.",
        issueCount: 0,
        details: {
          skipReason: "PARTIAL_COVERAGE",
          findings: [],
          uncoveredItems,
        },
      };
    }

    return {
      ...base,
      status: "PASS",
      message: "Bệnh nhân đủ 16 tuổi tại các lượt khám Nội.",
      issueCount: 0,
      details: {
        findings: [],
      },
    };
  },
};