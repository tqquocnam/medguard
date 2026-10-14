
import type { RuleValidator } from "../rule.types.js";

const KCB_TYPES: Record<string, string> = {
  "01": "Khám bệnh",
  "02": "Điều trị ngoại trú",
  "03": "Điều trị nội trú",
  "04": "Điều trị ban ngày",
};

export const kcbTypeRule: RuleValidator = {
  async evaluate(context, rule) {
    const xml1 = Array.isArray(context.xml1)
      ? context.xml1[0]?.TONG_HOP
      : context.xml1?.TONG_HOP;

    if (!xml1) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,
        status: "SKIP",
        severity: rule.severity,
        message: "Không đọc được dữ liệu XML1.",
        details: {},
      };
    }

    const maLoaiKcb = String(
      xml1.MA_LOAI_KCB ?? ""
    ).trim().padStart(2, "0");

    const loaiKcb = KCB_TYPES[maLoaiKcb];

    if (!loaiKcb) {
      return {
        ruleId: rule.id,
        ruleCode: rule.code,
        status: "FAIL",
        severity: rule.severity,
        issueCount: 1,
        message: `Mã loại KCB không hợp lệ: ${maLoaiKcb}`,
        details: {
          maLoaiKcb,
          maLk: xml1.MA_LK,
        },
      };
    }

    return {
      ruleId: rule.id,
      ruleCode: rule.code,
      status: "PASS",
      severity: rule.severity,
      issueCount: 0,
      message: `Hồ sơ thuộc nhóm: ${loaiKcb}.`,
      details: {
        maLoaiKcb,
        loaiKcb,
        maKhoa: xml1.MA_KHOA,
        ngayVao: xml1.NGAY_VAO,
        ngayRa: xml1.NGAY_RA,
        soNgayDieuTri: xml1.SO_NGAY_DTRI,
      },
    };
  },
};
