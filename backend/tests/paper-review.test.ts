import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkPages,
  suggestedCaseKey,
  defaultRules,
  extract,
  validDate,
  type ReviewPage,
  type OcrResult,
} from "../src/modules/paper-review/review.engine";
import { parseTsv } from "../src/modules/paper-review/review.ocr";
const ocr: OcrResult = { text: "", confidence: 90, width: 100, height: 100, lines: [] };
const page = (id: string, patch: Partial<ReviewPage> = {}): ReviewPage => ({
  id,
  document_type: "STATEMENT",
  case_key: "visit-1",
  confirmed: true,
  fields: {
    patientId: "12345",
    encounterId: "visit-1",
    name: "TEST PERSON",
    birthDate: "01/01/1975",
    gender: "NU",
    visitDate: "11/11/2026",
    weight: "",
    icd: "K58.8",
  },
  ocr,
  ...patch,
});
test("unconfirmed OCR never produces definitive errors and missing case cannot pass", () => {
  const p = page("a", { confirmed: false, case_key: "" });
  p.fields.birthDate = "";
  const findings = checkPages([p], defaultRules);
  assert(findings.some((f) => f.code === "MISSING_birthDate" && f.severity === "REVIEW"));
  assert(findings.some((f) => f.code === "CASE_UNASSIGNED"));
  assert(findings.every((f) => f.severity === "REVIEW"));
});
test("confirmed missing data becomes an error; continuation pages exempt from header requirements", () => {
  const p = page("a");
  p.fields.birthDate = "";
  assert(
    checkPages([p], defaultRules).some(
      (f) => f.code === "MISSING_birthDate" && f.severity === "ERROR",
    ),
  );
  assert(
    !checkPages(
      [page("b", { document_type: "CONTINUATION", fields: { ...p.fields, icd: "", gender: "" } })],
      defaultRules,
    ).some((f) => f.code.startsWith("MISSING_")),
  );
});
test("different specialist prescriptions compare ICD union against statement, not exact equality", () => {
  const s = page("s");
  s.fields.icd = "K58.8; J02.9";
  const p = page("p", { document_type: "PRESCRIPTION" });
  p.fields.icd = "J02.9";
  assert(!checkPages([s, p], defaultRules).some((f) => f.code === "ICD_NOT_ON_STATEMENT"));
  p.fields.icd = "J02.9; R51";
  assert(checkPages([s, p], defaultRules).some((f) => f.code === "ICD_NOT_ON_STATEMENT"));
});
test("same patient across different visit groups is not compared", () => {
  const a = page("a"),
    b = page("b", { case_key: "visit-2" });
  b.fields.gender = "NAM";
  assert(!checkPages([a, b], defaultRules).some((f) => f.code === "MISMATCH_gender"));
  b.case_key = a.case_key;
  assert(checkPages([a, b], defaultRules).some((f) => f.code === "MISMATCH_gender"));
});
test("weight is opt-in; rule toggles actually change findings", () => {
  const p = page("a");
  assert(!checkPages([p], defaultRules).some((f) => f.code === "MISSING_weight"));
  assert(
    checkPages([p], { ...defaultRules, requiredWeight: true }).some(
      (f) => f.code === "MISSING_weight",
    ),
  );
});
test("invalid dates and malformed ICD cannot pass after confirmation", () => {
  assert(!validDate("31/02/2026"));
  assert(validDate("29/02/2024"));
  assert(!validDate("29/02/2025"));
  const p = page("a");
  p.fields.birthDate = "31/02/2026";
  p.fields.icd = "K58.8; garbage";
  assert(checkPages([p], defaultRules).some((f) => f.code === "INVALID_DOB"));
  assert(checkPages([p], defaultRules).some((f) => f.code === "INVALID_ICD_FORMAT"));
});
test("label-anchored OCR extraction preserves lines and does not treat service codes as ICD", () => {
  const text =
    "BẢNG KÊ CHI PHÍ KHÁM BỆNH\nHọ tên: NGUYỄN VĂN A\nNgày sinh: 01/01/1975 Giới tính: 2\nMã số người bệnh: 12345678\nMã bệnh chính: K58.8\nDịch vụ A12.123";
  const parsed = extract({
    ...ocr,
    text,
    lines: text
      .split("\n")
      .map((text) => ({ text, confidence: 90, x: 0, y: 0, width: 10, height: 10 })),
  });
  assert.equal(parsed.documentType, "STATEMENT");
  assert.equal(parsed.fields.name, "NGUYEN VAN A");
  assert.equal(parsed.fields.birthDate, "01/01/1975");
  assert.equal(parsed.fields.gender, "NU");
  assert.equal(parsed.fields.icd, "K58.8");
  assert.equal(parsed.fields.patientId, "12345678");
});
test("TSV exposes correct word/line geometry and confidence", () => {
  const parsed = parseTsv(
    "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n1\t1\t0\t0\t0\t0\t0\t0\t1000\t2000\t-1\t\n5\t1\t1\t1\t1\t1\t10\t20\t30\t10\t90\tHello\n5\t1\t1\t1\t1\t2\t50\t20\t40\t10\t80\tWorld",
  );
  assert.equal(parsed.width, 1000);
  assert.equal(parsed.height, 2000);
  assert.equal(parsed.lines[0]?.width, 80);
  assert.equal(parsed.text, "Hello World");
  assert.equal(parsed.confidence, 85);
});

test("group suggestions require encounter identity and a valid visit date", () => {
  const p = page("a");
  assert.equal(suggestedCaseKey(p.fields), "visit-1@11/11/2026");
  assert.equal(suggestedCaseKey({ ...p.fields, encounterId: "" }), "");
  assert.equal(suggestedCaseKey({ ...p.fields, visitDate: "31/02/2026" }), "");
});
