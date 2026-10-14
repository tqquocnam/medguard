
import type {
  RuleResult,
  RuleValidator,
  ValidationRule,
} from "../rule.types.js";

type JsonObject = Record<string, unknown>;

interface DiagnosisFinding {
  type: string;
  stt: string;
  maDichVu: string;
  tenDichVu: string;
  maBenhYhctXml1: string[];
  maBenhYhctXml3: string[];
  ngayThucHien: string;
  message: string;
}

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
  const selected = Array.isArray(value)
    ? value[0]
    : value;

  return isObject(selected) ? selected : null;
}

function getXml1(xml1: unknown): JsonObject | null {
  const root = firstObject(xml1);

  return firstObject(root?.TONG_HOP);
}

function getXml3Rows(xml3: unknown): JsonObject[] {
  const root = firstObject(xml3);

  const section = firstObject(
    root?.CHITIEU_CHITIET_DVKT_VTYT
  );

  const list = firstObject(
    section?.DSACH_CHI_TIET_DVKT
  );

  const raw = list?.CHI_TIET_DVKT;

  if (!raw) {
    return [];
  }

  const rows = Array.isArray(raw) ? raw : [raw];

  return rows.filter(isObject);
}

function normalizeCodes(value: unknown): string[] {
  const raw = toText(value);

  if (!raw) {
    return [];
  }

  return Array.from(
    new Set(
      raw
        .split(/[;,，\n\r]+/)
        .map((code) =>
          code.trim().toUpperCase()
        )
        .filter(Boolean)
    )
  );
}

function hasIntersection(
  left: string[],
  right: string[]
): boolean {
  const codes = new Set(left);

  return right.some((code) =>
    codes.has(code)
  );
}

function createResult(
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
    issueCount,
    details,
  };
}

export const yhctServiceDiagnosisRule:
  RuleValidator = {
  async evaluate(context, rule) {
    const xml1 = getXml1(context.xml1);

    if (!xml1) {
      return createResult(
        rule,
        "SKIP",
        "Không đọc được XML1 để đối chiếu mã bệnh YHCT.",
        {
          reason: "XML1_UNAVAILABLE",
        }
      );
    }

    const maLk = toText(xml1.MA_LK);
    const maLoaiKcb = toText(
      xml1.MA_LOAI_KCB
    ).padStart(2, "0");

    const maKhoa = toText(xml1.MA_KHOA);

    const xml1Codes = normalizeCodes(
      xml1.MA_BENH_YHCT
    );

    const xml3Rows = getXml3Rows(
      context.xml3
    );

    // Thu thập những mã bệnh YHCT
    // được khai báo trong XML3.
    const rowsWithYhctCodes = xml3Rows.filter(
      (row) =>
        normalizeCodes(
          row.MA_BENH_YHCT
        ).length > 0
    );

    // Không dùng K01 hoặc MA_LOAI_KCB = 02
    // làm bằng chứng duy nhất về YHCT.
    //
    // Mã bệnh YHCT từ XML1/XML3
    // là căn cứ của rule đối chiếu này.
    const hasYhctEvidence =
      xml1Codes.length > 0 ||
      rowsWithYhctCodes.length > 0;

    if (!hasYhctEvidence) {
      return createResult(
        rule,
        "SKIP",
        "Hồ sơ không có mã bệnh YHCT trong XML1/XML3 để đối chiếu.",
        {
          maLk,
          maLoaiKcb,
          reason: "NO_YHCT_DIAGNOSIS_EVIDENCE",
          totalXml3Rows: xml3Rows.length,
        }
      );
    }

    if (xml3Rows.length === 0) {
      return createResult(
        rule,
        "SKIP",
        "Có mã bệnh YHCT nhưng không có dữ liệu DVKT XML3.",
        {
          maLk,
          maLoaiKcb,
          maBenhYhctXml1: xml1Codes,
          reason: "XML3_UNAVAILABLE",
        }
      );
    }

    const findings: DiagnosisFinding[] = [];

    let comparedRows = 0;
    let matchingRows = 0;
    let rowsWithoutYhctDiagnosis = 0;

    const missingDiagnosisRows: Array<{
      stt: string;
      maDichVu: string;
      tenDichVu: string;
    }> = [];

    for (const row of xml3Rows) {
      const stt = toText(row.STT);
      const maDichVu = toText(
        row.MA_DICH_VU
      );
      const tenDichVu = toText(
        row.TEN_DICH_VU
      );

      const xml3Codes = normalizeCodes(
        row.MA_BENH_YHCT
      );

      if (xml3Codes.length === 0) {
        rowsWithoutYhctDiagnosis++;

        missingDiagnosisRows.push({
          stt,
          maDichVu,
          tenDichVu,
        });

        // Không coi mọi DVKT thiếu
        // MA_BENH_YHCT là lỗi.
        continue;
      }

      // XML1 không có mã tham chiếu,
      // không thể khẳng định bất nhất.
      if (xml1Codes.length === 0) {
        continue;
      }

      comparedRows++;

      if (
        hasIntersection(
          xml1Codes,
          xml3Codes
        )
      ) {
        matchingRows++;
        continue;
      }

      findings.push({
        type: "YHCT_DIAGNOSIS_NEEDS_REVIEW",
        stt,
        maDichVu,
        tenDichVu,
        maBenhYhctXml1: xml1Codes,
        maBenhYhctXml3: xml3Codes,
        ngayThucHien: toText(
          row.NGAY_TH_YL
        ),
        message:
          "Mã bệnh YHCT của DVKT không trùng với các mã khai báo trong XML1. Cần rà soát chẩn đoán và hồ sơ chuyên môn.",
      });
    }

    const details: Record<string, unknown> = {
      maLk,
      maLoaiKcb,
      maKhoa,
      maBenhYhctXml1: xml1Codes,
      totalXml3Rows: xml3Rows.length,
      rowsWithYhctDiagnosis:
        rowsWithYhctCodes.length,
      rowsWithoutYhctDiagnosis,
      comparedRows,
      matchingRows,
      findings,
      // Chỉ lưu thông tin những dòng thiếu mã,
      // không tự kết luận là lỗi.
      missingDiagnosisRows,
    };

    if (xml1Codes.length === 0) {
      return createResult(
        rule,
        "SKIP",
        "XML3 có mã bệnh YHCT nhưng XML1 không có mã tham chiếu. Chưa thể đối chiếu tính nhất quán.",
        details
      );
    }

    if (findings.length > 0) {
      return createResult(
        rule,
        "FAIL",
        `Có ${findings.length} dòng DVKT có mã bệnh YHCT không giao nhau với XML1. Cần rà soát, chưa kết luận sai BHYT.`,
        details,
        findings.length
      );
    }

    if (comparedRows === 0) {
      return createResult(
        rule,
        "SKIP",
        "XML1 có mã bệnh YHCT nhưng XML3 không có dòng mã bệnh YHCT để đối chiếu. Chưa đủ căn cứ kiểm tra.",
        details
      );
    }

    return createResult(
      rule,
      "PASS",
      `Đã đối chiếu ${comparedRows} dòng DVKT có mã bệnh YHCT; ${matchingRows} dòng có mã giao nhau với XML1. Không phát hiện bất nhất theo tiêu chí hiện tại.`,
      details
    );
  },
};
