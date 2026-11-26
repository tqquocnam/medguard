import type { AiAnalysis } from "./review.ai.js";
export type DocumentType = "STATEMENT" | "PRESCRIPTION" | "ORDER" | "CONTINUATION" | "UNKNOWN";
export interface Fields {
  patientId: string;
  encounterId: string;
  name: string;
  birthDate: string;
  gender: string;
  visitDate: string;
  weight: string;
  icd: string;
}
export interface OcrLine {
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface OcrResult {
  ai?: AiAnalysis;
  text: string;
  confidence: number;
  width: number;
  height: number;
  lines: OcrLine[];
}
export interface ReviewPage {
  id: string;
  document_type: DocumentType;
  case_key: string;
  confirmed: boolean;
  fields: Fields;
  ocr: OcrResult;
}
export interface Rules {
  requiredBirthDate: boolean;
  requiredGender: boolean;
  requiredIcd: boolean;
  requiredWeight: boolean;
  compareIdentity: boolean;
  icdCoverage: boolean;
}
export const defaultRules: Rules = {
  requiredBirthDate: true,
  requiredGender: true,
  requiredIcd: true,
  requiredWeight: false,
  compareIdentity: true,
  icdCoverage: true,
};
export interface Finding {
  code: string;
  severity: "ERROR" | "REVIEW";
  message: string;
  pageIds: string[];
  field?: keyof Fields;
}
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .replace(/[^\S\n]+/g, " ")
    .trim();
}
export function validDate(value: string): boolean {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[3]!, +m[2]! - 1, +m[1]!));
  return (
    d.getUTCFullYear() === +m[3]! &&
    d.getUTCMonth() === +m[2]! - 1 &&
    d.getUTCDate() === +m[1]! &&
    +m[3]! >= 1900
  );
}
export function icdCodes(value: string): string[] {
  return [...new Set(value.toUpperCase().match(/\b[A-Z]\d{2}(?:\.[A-Z0-9]{1,4})?\b/g) ?? [])];
}
export function extract(ocr: OcrResult): { fields: Fields; documentType: DocumentType } {
  const text = normalize(ocr.text);
  const pick = (re: RegExp) => re.exec(text)?.[1]?.trim() ?? "";
  const date = "(\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4})";
  const formatDate = (v: string) => {
    const a = v.split(/[/.-]/);
    return a.length === 3 ? `${a[0]!.padStart(2, "0")}/${a[1]!.padStart(2, "0")}/${a[2]}` : "";
  };
  // Only label-anchored candidates. The operator confirms them against the image.
  const fields: Fields = {
    patientId: pick(/MA\s*(?:SO\s*)?(?:NGUOI BENH|BN)\s*[:：]?\s*(\d{5,20})/),
    encounterId: pick(
      /(?:MA LUOT KHAM|MA HO SO|MA LIEN KET|SO KHAM BENH|SO PHIEU)\s*[:：]?\s*([A-Z0-9_/-]{3,60})/,
    ),
    name: pick(
      /HO\s*(?:VA\s*)?TEN\s*(?:NGUOI BENH)?\s*[:：]\s*([^\n;]+?)(?=\s+(?:NGAY SINH|NAM SINH|TUOI|GIOI TINH)|\n|$)/,
    ),
    birthDate: formatDate(
      pick(new RegExp("(?:NGAY(?:, THANG, NAM)? SINH|NGAY, THANG, NAM SINH)\\s*[:：]?\\s*" + date)),
    ),
    gender: pick(/GIOI TINH\s*[:：]?\s*(NAM|NU|[12])\b/),
    visitDate: formatDate(
      pick(new RegExp("(?:NGAY KHAM|NGAY VAO(?: VIEN)?)\\s*[:：]?\\s*" + date)),
    ),
    weight: pick(/CAN NANG\s*[:：]?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:KG)?/),
    icd: "",
  };
  fields.gender = fields.gender === "1" ? "NAM" : fields.gender === "2" ? "NU" : fields.gender;
  // Do not extract ICD-looking service/drug codes outside diagnosis sections.
  const diagnosis = ocr.lines
    .filter((l) => /CHAN DOAN|MA BENH|BENH KEM|ICD/.test(normalize(l.text)))
    .map((l) => normalize(l.text))
    .join("\n");
  fields.icd = icdCodes(diagnosis).join("; ");
  const documentType: DocumentType = /BANG KE (?:CHI PHI|THANH TOAN)/.test(text)
    ? "STATEMENT"
    : /DON THUOC/.test(text)
      ? "PRESCRIPTION"
      : /PHIEU CHI DINH/.test(text)
        ? "ORDER"
        : "UNKNOWN";
  return { fields, documentType };
}
// A suggestion only: no grouping by patient ID or page adjacency.
export function suggestedCaseKey(fields: Fields): string {
  return fields.encounterId && validDate(fields.visitDate)
    ? `${fields.encounterId}@${fields.visitDate}`
    : "";
}
export function automationReasons(
  ai: AiAnalysis,
  fields: Fields,
  documentType: DocumentType,
  required: Rules = defaultRules,
): string[] {
  const reasons = [...ai.issues];
  if (!fields.patientId || !fields.name)
    reasons.push("Chưa đọc rõ mã bệnh nhân và họ tên để đối chiếu danh tính.");
  if (
    documentType !== ai.documentType ||
    (Object.keys(fields) as (keyof Fields)[]).some((k) => fields[k] !== ai.fields[k])
  )
    return ["Nội dung đã thay đổi sau khi AI đọc; cần kiểm tra lại."];
  if (documentType === "UNKNOWN" || documentType === "CONTINUATION")
    reasons.push("Chưa đủ dấu hiệu tự xử lý loại trang này.");
  const relevant: (keyof Fields)[] = ["patientId", "encounterId", "name", "visitDate"];
  if (required.requiredBirthDate) relevant.push("birthDate");
  if (required.requiredGender) relevant.push("gender");
  if (required.requiredIcd && (documentType === "STATEMENT" || documentType === "PRESCRIPTION"))
    relevant.push("icd");
  if (required.requiredWeight) relevant.push("weight");
  for (const k of relevant) {
    const o = ai.observations[k];
    if (!o || o.status === "UNCLEAR" || (o.status === "PRESENT" && !o.value))
      reasons.push(`AI chưa đọc chắc trường ${k}.`);
  }
  if (!fields.encounterId || !validDate(fields.visitDate))
    reasons.push("Chưa có mã lượt và ngày khám đủ rõ để tự ghép.");
  return [...new Set(reasons)];
}
export function autoReviewReasons(page: ReviewPage, rules: Rules): string[] {
  if (!page.ocr?.ai) return ["Chưa xác nhận nội dung đọc từ ảnh và loại giấy."];
  const reasons = automationReasons(page.ocr.ai, page.fields, page.document_type, rules);
  if (!page.case_key || page.case_key !== suggestedCaseKey(page.ocr.ai.fields))
    reasons.push("Nhóm lượt khám chưa khớp dấu hiệu AI đọc được.");
  return reasons;
}
export function checkPages(pages: ReviewPage[], rules: Rules): Finding[] {
  const ready = (p: ReviewPage) =>
    p.confirmed || (!!p.ocr?.ai && autoReviewReasons(p, rules).length === 0);
  const findings: Finding[] = [];
  const add = (
    code: string,
    message: string,
    ps: ReviewPage[],
    field?: keyof Fields,
    error = true,
  ) => {
    findings.push({
      code,
      severity: error && ps.every(ready) ? "ERROR" : "REVIEW",
      message,
      pageIds: ps.map((p) => p.id),
      field,
    });
  };
  for (const p of pages) {
    if (!ready(p))
      add(
        "OCR_UNCONFIRMED",
        p.ocr?.ai
          ? autoReviewReasons(p, rules).join(" ")
          : "Chưa xác nhận nội dung đọc từ ảnh và loại giấy.",
        [p],
        undefined,
        false,
      );
    if (!p.case_key)
      add("CASE_UNASSIGNED", "Chưa ghép trang vào đúng lượt khám.", [p], undefined, false);
    if (p.document_type === "UNKNOWN")
      add("UNKNOWN_DOCUMENT", "Chưa xác định loại giấy.", [p], undefined, false);
    if (p.document_type === "UNKNOWN" || p.document_type === "CONTINUATION") continue;
    const required: [keyof Fields, boolean, string][] = [
      ["birthDate", rules.requiredBirthDate, "ngày sinh"],
      ["gender", rules.requiredGender, "giới tính"],
      ["icd", rules.requiredIcd && p.document_type !== "ORDER", "ICD"],
      ["weight", rules.requiredWeight, "cân nặng"],
    ];
    for (const [field, enabled, label] of required)
      if (enabled && !p.fields[field])
        add(`MISSING_${field}`, `Chưa có ${label} trên trang này.`, [p], field);
    if (p.fields.birthDate && !validDate(p.fields.birthDate))
      add("INVALID_DOB", "Ngày sinh không hợp lệ; cần đủ DD/MM/YYYY.", [p], "birthDate");
    if (p.fields.visitDate && !validDate(p.fields.visitDate))
      add("INVALID_VISIT_DATE", "Ngày khám không hợp lệ.", [p], "visitDate");
    if (p.fields.gender && !["NAM", "NU"].includes(normalize(p.fields.gender)))
      add("INVALID_GENDER", "Giới tính chưa xác định Nam/Nữ.", [p], "gender");
    if (
      p.fields.weight &&
      (!Number.isFinite(Number(p.fields.weight.replace(",", "."))) ||
        Number(p.fields.weight.replace(",", ".")) <= 0)
    )
      add("INVALID_WEIGHT", "Cân nặng phải là số lớn hơn 0.", [p], "weight");
    if (
      p.fields.icd &&
      p.fields.icd
        .split(/[;,\s]+/)
        .filter(Boolean)
        .some((c) => !/^[A-Z]\d{2}(?:\.[A-Z0-9]{1,4})?$/i.test(c))
    )
      add(
        "INVALID_ICD_FORMAT",
        "Có mã ICD không đúng định dạng; chưa kiểm tra hiệu lực mã trong danh mục.",
        [p],
        "icd",
      );
  }
  const groups = new Map<string, ReviewPage[]>();
  pages
    .filter((p) => p.case_key)
    .forEach((p) => groups.set(p.case_key, [...(groups.get(p.case_key) ?? []), p]));
  for (const group of groups.values()) {
    if (!group.some((p) => p.document_type === "STATEMENT"))
      add("NO_STATEMENT", "Chưa tìm thấy bảng kê trong bộ giấy đã ghép.", group, undefined, false);
    if (rules.compareIdentity)
      for (const field of ["patientId", "name", "birthDate", "gender", "visitDate"] as const) {
        const relevant = group.filter((p) => p.fields[field]);
        if (new Set(relevant.map((p) => normalize(p.fields[field]))).size > 1)
          add(
            `MISMATCH_${field}`,
            `Thông tin ${field === "birthDate" ? "ngày sinh" : field === "gender" ? "giới tính" : field === "name" ? "họ tên" : field === "visitDate" ? "ngày khám" : "mã bệnh nhân"} không khớp giữa các trang.`,
            relevant,
            field,
          );
      }
    const statements = group.filter((p) => p.document_type === "STATEMENT");
    if (rules.icdCoverage && statements.length) {
      const covered = new Set(statements.flatMap((p) => icdCodes(p.fields.icd)));
      for (const p of group.filter((p) => p.document_type === "PRESCRIPTION")) {
        const missing = icdCodes(p.fields.icd).filter((c) => !covered.has(c));
        if (missing.length)
          add(
            "ICD_NOT_ON_STATEMENT",
            `ICD trên đơn chưa có trong bảng kê đã ghép: ${missing.join(", ")}.`,
            [p, ...statements],
            "icd",
          );
      }
    }
  }
  return findings;
}
