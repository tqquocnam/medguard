import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  fieldKeys,
  parseAnalysis,
  readWithAi,
  aiDailyLimit,
  type AiObservation,
} from "../src/modules/paper-review/review.ai";
import {
  automationReasons,
  autoReviewReasons,
  checkPages,
  defaultRules,
  suggestedCaseKey,
  type Fields,
  type ReviewPage,
} from "../src/modules/paper-review/review.engine";
function fixture() {
  const fields: Fields = {
    patientId: "TEST-P001",
    encounterId: "TEST-V001",
    name: "NGƯỜI THỬ NGHIỆM",
    birthDate: "01/01/1975",
    gender: "NU",
    visitDate: "11/11/2026",
    weight: "",
    icd: "K58.8",
  };
  const observations = Object.fromEntries(
    fieldKeys.map((k) => [
      k,
      {
        value: fields[k],
        status: fields[k] ? "PRESENT" : "MISSING",
        evidence: fields[k] ? `${k}: ${fields[k]}` : "",
      },
    ]),
  ) as Record<keyof Fields, AiObservation>;
  return { documentType: "STATEMENT", observations, issues: [] as string[] };
}
function page(raw = fixture()): ReviewPage {
  const ai = parseAnalysis(raw, "test-model");
  return {
    id: "test",
    document_type: ai.documentType,
    case_key: suggestedCaseKey(ai.fields),
    confirmed: false,
    fields: { ...ai.fields },
    ocr: { ai, text: "", confidence: 0, width: 100, height: 100, lines: [] },
  };
}
test("AI reads a clear page without forging human confirmation or mandatory manual editing", () => {
  const p = page();
  assert.equal(p.confirmed, false);
  assert.equal(autoReviewReasons(p, defaultRules).length, 0);
  assert.equal(checkPages([p], defaultRules).length, 0);
});
test("unclear is not missing and never becomes a definitive missing-field error", () => {
  const raw = fixture();
  raw.observations.birthDate = { value: "guess", status: "UNCLEAR", evidence: "" };
  const p = page(raw);
  assert.equal(p.fields.birthDate, "");
  const fs = checkPages([p], defaultRules);
  assert(fs.some((f) => f.severity === "REVIEW"));
  assert(!fs.some((f) => f.severity === "ERROR"));
});
test("explicit missing data yields automatic rule finding when identity and context are clear", () => {
  const raw = fixture();
  raw.observations.gender = { value: "", status: "MISSING", evidence: "Giới tính:" };
  const p = page(raw);
  assert(
    checkPages([p], defaultRules).some(
      (f) => f.code === "MISSING_gender" && f.severity === "ERROR",
    ),
  );
  assert.equal(p.confirmed, false);
});
test("overlapping papers, unknown pages and handwritten/cropped uncertainty stay in exceptions", () => {
  const raw = fixture();
  raw.issues = ["Nhiều tờ chồng lên nhau"];
  assert(checkPages([page(raw)], defaultRules).some((f) => f.code === "OCR_UNCONFIRMED"));
});
test("a changed field or manually changed case key invalidates automatic readiness", () => {
  const p = page();
  p.fields.birthDate = "02/01/1975";
  assert(autoReviewReasons(p, defaultRules).length);
  const q = page();
  q.case_key = "another-visit";
  assert(autoReviewReasons(q, defaultRules).length);
});
test("evidence is mandatory and patient ID alone cannot become encounter identity", () => {
  const raw = fixture();
  raw.observations.name.evidence = "";
  assert.equal(parseAnalysis(raw, "test").observations.name.status, "UNCLEAR");
  const same = fixture();
  same.observations.encounterId.value = same.observations.patientId.value;
  assert.equal(parseAnalysis(same, "test").fields.encounterId, "");
});
test("AI uncertainty in disabled optional rules does not force every page into manual review", () => {
  const raw = fixture();
  raw.observations.weight = { value: "", status: "UNCLEAR", evidence: "" };
  const ai = parseAnalysis(raw, "test");
  assert.equal(automationReasons(ai, ai.fields, ai.documentType, defaultRules).length, 0);
  assert(
    automationReasons(ai, ai.fields, ai.documentType, { ...defaultRules, requiredWeight: true })
      .length,
  );
});
test("malformed AI values and missing schema fields are rejected", () => {
  assert.throws(() =>
    parseAnalysis({ documentType: "STATEMENT", observations: {}, issues: [] }, "test"),
  );
  const raw = fixture();
  raw.observations.name.value = "x".repeat(201);
  assert.throws(() => parseAnalysis(raw, "test"));
});
test("API payload uses server key, image input, strict schema, no stored response and no invented confidence", async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-only-not-a-real-key";
  const dir = await mkdtemp(path.join(tmpdir(), "paper-ai-"));
  const image = path.join(dir, "test.png");
  await writeFile(image, Buffer.from("synthetic-image"));
  let calls = 0;
  try {
    const fake = (async (url, init) => {
      calls++;
      assert.equal(url, "https://api.openai.com/v1/responses");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      assert.equal(body.input[0].content[1].type, "input_image");
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(fixture()) }],
            },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const result = await readWithAi(image, { width: 1200, height: 1800 }, fake);
    assert.equal(calls, 1);
    assert.equal(result.ocr.lines.length, 0);
    assert.equal(result.ocr.confidence, 0);
    assert.equal(result.analysis.inputTokens, 100);
    await assert.rejects(
      readWithAi(
        image,
        { width: 1, height: 1 },
        (async () => new Response("private provider body", { status: 401 })) as typeof fetch,
      ),
      /API key không hợp lệ/,
    );
    await assert.rejects(
      readWithAi(
        image,
        { width: 1, height: 1 },
        (async () => new Response(JSON.stringify({ status: "incomplete" }))) as typeof fetch,
      ),
      /chưa trả kết quả đầy đủ/,
    );
    await assert.rejects(
      readWithAi(
        image,
        { width: 1, height: 1 },
        (async () =>
          new Response(
            JSON.stringify({
              status: "completed",
              output: [{ type: "message", content: [{ type: "refusal" }] }],
            }),
          )) as typeof fetch,
      ),
      /từ chối/,
    );
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
test("daily quota configuration is bounded and rejects invalid values", () => {
  const saved = process.env.PAPER_REVIEW_AI_DAILY_LIMIT;
  try {
    process.env.PAPER_REVIEW_AI_DAILY_LIMIT = "0";
    assert.throws(() => aiDailyLimit());
    process.env.PAPER_REVIEW_AI_DAILY_LIMIT = "20";
    assert.equal(aiDailyLimit(), 20);
  } finally {
    if (saved === undefined) delete process.env.PAPER_REVIEW_AI_DAILY_LIMIT;
    else process.env.PAPER_REVIEW_AI_DAILY_LIMIT = saved;
  }
});
