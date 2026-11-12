import test from "node:test";
import assert from "node:assert/strict";
import { orderTimeRule } from "./order-time.rule.js";
import type { MedicalCaseContext, ValidationRule, RuleRuntime } from "../rule.types.js";

const rule = { id: "test", code: "ORDER_TIME_SEQUENCE", severity: "WARNING", config: {} } as ValidationRule;
const exam = (doctor: string, time: string) => ({ MA_NHOM: 13, MA_BAC_SI: doctor, NGAY_YL: time, MA_DICH_VU: "exam", TEN_DICH_VU: "Khám" });
const service = (time = "202611060744", doctor = "000095/BL-CCHN") => ({ MA_NHOM: 2, MA_BAC_SI: doctor, NGAY_YL: time, MA_DICH_VU: "xray", TEN_DICH_VU: "Chụp X-quang Blondeau" });
async function evaluate(rows: unknown[], events: unknown[] = []) {
  return orderTimeRule.evaluate({ medicalCase: { id: "synthetic" }, xml3: { CHITIEU_CHITIET_DVKT_VTYT: { DSACH_CHI_TIET_DVKT: { CHI_TIET_DVKT: rows } } }, events, catalog: {} } as MedicalCaseContext, rule, {} as RuleRuntime);
}

test("07:44 order before ordering doctor's 13:06 exam fails despite another doctor's 07:15 exam", async () => {
  const result = await evaluate([exam("other", "202611060715"), exam("000095/BL-CCHN", "202611061306"), service()]);
  assert.equal(result.status, "FAIL");
  assert.equal(result.severity, "ERROR");
  assert.equal(result.issueCount, 1);
  assert.match(JSON.stringify(result.details), /06\/11\/2026 07:44.*06\/11\/2026 13:06/);
});

test("valid preceding exam and equal order time do not fail", async () => {
  for (const time of ["202611060714", "202611060744"]) {
    const result = await evaluate([exam("000095/BL-CCHN", time), service(), exam("000095/BL-CCHN", "202611061306")]);
    assert.notEqual(result.status, "FAIL");
  }
});

test("missing, different doctor, different day and invalid dates do not invent a match", async () => {
  for (const row of [exam("other", "202611061306"), exam("000095/BL-CCHN", "202611071306"), exam("000095/BL-CCHN", "202602301306")]) {
    assert.notEqual((await evaluate([row, service()])).status, "FAIL");
  }
  assert.notEqual((await evaluate([exam("000095/BL-CCHN", "202611061306"), service("202611060744", "")])).status, "FAIL");
});

test("seconds, trim and case normalization are supported", async () => {
  assert.equal((await evaluate([exam("000095/BL-CCHN", "20261106130600"), service("20261106074400", " 000095/bl-cchn ")])).status, "FAIL");
});

test("existing order/perform checks remain active", async () => {
  const result = await evaluate([], [{ raw_data: { NGAY_YL: "202611060800", NGAY_TH_YL: "202611060759" } }]);
  assert.equal(result.status, "FAIL");
  assert.equal(result.severity, "WARNING");
  assert.match(JSON.stringify(result.details), /PERFORM_BEFORE_ORDER/);
});
