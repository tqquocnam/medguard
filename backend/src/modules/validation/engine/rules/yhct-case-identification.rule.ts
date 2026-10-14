
import type {
  RuleResult,
  RuleValidator,
  ValidationRule,
} from "../rule.types.js";

type JsonObject = Record<string, unknown>;

type Evidence = {
  source: "XML1" | "XML3" | "XML5";
  field: string;
  value: string;
  stt?: string;
};

function isObject(value: unknown): value is JsonObject {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function toText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function firstObject(value: unknown): JsonObject | null {
  const item = Array.isArray(value)
    ? value[0]
    : value;

  return isObject(item) ? item : null;
}

function getXml1(value: unknown): JsonObject | null {
  return firstObject(firstObject(value)?.TONG_HOP);
}

function getRows(
  xml: unknown,
  rootKey: string,
  listKey: string,
  itemKey: string
): JsonObject[] {
  const root = firstObject(xml);
  const section = firstObject(root?.[rootKey]);
  const list = firstObject(section?.[listKey]);
  const raw = list?.[itemKey];

  if (!raw) return [];

  const items = Array.isArray(raw) ? raw : [raw];

  return items.filter(isObject);
}

function getXml3Rows(value: unknown): JsonObject[] {
  return getRows(
    value,
    "CHITIEU_CHITIET_DVKT_VTYT",
    "DSACH_CHI_TIET_DVKT",
    "CHI_TIET_DVKT"
  );
}

function getXml5Rows(value: unknown): JsonObject[] {
  return getRows(
    value,
    "CHITIEU_CHITIET_DIENBIENLAMSANG",
    "DSACH_CHI_TIET_DIEN_BIEN_BENH",
    "CHI_TIET_DIEN_BIEN_BENH"
  );
}

function getConfiguredCodes(
  rule: ValidationRule
): Set<string> {
  const raw = rule.config?.yhctServiceCodes;

  if (!Array.isArray(raw)) {
    return new Set();
  }

  return new Set(
    raw
      .filter((item): item is string =>
        typeof item === "string"
      )
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)
  );
}

function normalizeText(value: unknown): string {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Dùng để nhận diện dấu hiệu cần rà soát,
// KHÔNG tự xác nhận hồ sơ YHCT từ từ khóa.
const YHCT_KEYWORDS = [
  "y hoc co truyen",
  "dien cham",
  "thuy cham",
  "hao cham",
  "nhĩ cham",
  "nhi cham",
  "cay chi",
  "cuu ngai",
  "xoa bop bam huyet",
  "bam huyet",
  "giac hoi",
];

function containsYhctKeyword(
  value: unknown
): boolean {
  const normalized = normalizeText(value);

  return YHCT_KEYWORDS.some((keyword) =>
    normalized.includes(normalizeText(keyword))
  );
}

function createResult(
  rule: ValidationRule,
  status: RuleResult["status"],
  message: string,
  details: Record<string, unknown>
): RuleResult {
  return {
    ruleId: rule.id,
    ruleCode: rule.code,
    status,
    severity: rule.severity,
    issueCount: 0,
    message,
    details,
  };
}

export const yhctCaseIdentificationRule:
  RuleValidator = {
  async evaluate(context, rule) {
    const xml1 = getXml1(context.xml1);

    if (!xml1) {
      return createResult(
        rule,
        "SKIP",
        "Không đọc được XML1 để nhận diện YHCT.",
        {
          classification: "UNKNOWN",
          reason: "XML1_UNAVAILABLE",
        }
      );
    }

    const maLk = toText(xml1.MA_LK);
    const maLoaiKcb = toText(
      xml1.MA_LOAI_KCB
    ).padStart(2, "0");

    const maKhoa = toText(xml1.MA_KHOA);
    const maBenhYhct = toText(
      xml1.MA_BENH_YHCT
    );

    const xml3Rows = getXml3Rows(context.xml3);
    const xml5Rows = getXml5Rows(context.xml5);

    const configuredCodes = getConfiguredCodes(rule);

    const strongEvidence: Evidence[] = [];
    const supportingEvidence: Evidence[] = [];

    // 1. Mã bệnh YHCT trong XML1.
    if (maBenhYhct) {
      strongEvidence.push({
        source: "XML1",
        field: "MA_BENH_YHCT",
        value: maBenhYhct,
      });
    }

    // 2. XML3: mã dịch vụ đã được bệnh viện
    // xác nhận thuộc danh mục YHCT.
    for (const row of xml3Rows) {
      const maDichVu = toText(
        row.MA_DICH_VU
      ).toUpperCase();

      const tenDichVu = toText(
        row.TEN_DICH_VU
      );

      const stt = toText(row.STT);

      const maBenhYhctXml3 = toText(
        row.MA_BENH_YHCT
      );

      if (maBenhYhctXml3) {
        strongEvidence.push({
          source: "XML3",
          field: "MA_BENH_YHCT",
          value: maBenhYhctXml3,
          stt,
        });
      }

      if (
        maDichVu &&
        configuredCodes.has(maDichVu)
      ) {
        strongEvidence.push({
          source: "XML3",
          field: "MA_DICH_VU",
          value: maDichVu,
          stt,
        });
      } else if (
        containsYhctKeyword(tenDichVu)
      ) {
        supportingEvidence.push({
          source: "XML3",
          field: "TEN_DICH_VU",
          value: tenDichVu.slice(0, 180),
          stt,
        });
      }
    }

    // 3. XML5: chỉ ghi nhận dấu hiệu bổ sung.
    // Không tự coi mọi diễn biến có chữ YHCT
    // là một đợt điều trị chuyên khoa YHCT.
    for (const row of xml5Rows) {
      const stt = toText(row.STT);

      const clinical = toText(
        row.DIEN_BIEN_LS
      );

      const procedure = toText(
        row.PHAU_THUAT
      );

      if (containsYhctKeyword(clinical)) {
        supportingEvidence.push({
          source: "XML5",
          field: "DIEN_BIEN_LS",
          value: "Có nội dung liên quan YHCT",
          stt,
        });
      }

      if (containsYhctKeyword(procedure)) {
        supportingEvidence.push({
          source: "XML5",
          field: "PHAU_THUAT",
          value: "Có mô tả kỹ thuật liên quan YHCT",
          stt,
        });
      }
    }

    const isConfirmed = strongEvidence.length > 0;
    const isCandidate =
      !isConfirmed &&
      supportingEvidence.length > 0;

    const classification = isConfirmed
      ? "YHCT_CONFIRMED"
      : isCandidate
        ? "YHCT_CANDIDATE"
        : "NOT_IDENTIFIED";

    const details: Record<string, unknown> = {
      maLk,
      maLoaiKcb,
      maKhoa,
      classification,
      maBenhYhct,
      configuredServiceCodeCount:
        configuredCodes.size,
      totalXml3Rows: xml3Rows.length,
      totalXml5Rows: xml5Rows.length,
      strongEvidenceCount:
        strongEvidence.length,
      supportingEvidenceCount:
        supportingEvidence.length,
      strongEvidence,
      // Giới hạn nội dung để không lưu lại
      // toàn bộ bệnh án dài trong kết quả rule.
      supportingEvidence:
        supportingEvidence.slice(0, 30),
    };

    if (isConfirmed) {
      return createResult(
        rule,
        "PASS",
        `Phát hiện ${strongEvidence.length} bằng chứng mã bệnh/DVKT YHCT. Hồ sơ có dữ liệu YHCT, loại KCB ${maLoaiKcb}.`,
        details
      );
    }

    if (isCandidate) {
      return createResult(
        rule,
        "SKIP",
        `Phát hiện ${supportingEvidence.length} dấu hiệu liên quan YHCT nhưng chưa đủ bằng chứng mã hóa để xác nhận. Cần rà soát.`,
        details
      );
    }

    return createResult(
      rule,
      "SKIP",
      "Chưa tìm thấy bằng chứng YHCT theo các tiêu chí đã cấu hình.",
      details
    );
  },
};
