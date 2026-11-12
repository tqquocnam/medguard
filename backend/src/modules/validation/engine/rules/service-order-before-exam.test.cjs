const { test } = require('node:test');
const assert = require('node:assert/strict');
const { orderTimeRule } = require('./order-time.rule.ts');
const { serviceOrderBeforeExamRule } = require('./service-order-before-exam.rule.ts');
const { sameCaseExamClsOverlapRule } = require('./same-case-exam-cls-overlap.rule.ts');
const exam = (doctor, time, perform = time) => ({ MA_NHOM: '13', MA_BAC_SI: doctor, NGAY_YL: time, NGAY_TH_YL: perform, TEN_DICH_VU: 'Khám Phụ sản' });
const service = (doctor, time) => ({ MA_NHOM: '2', MA_BAC_SI: doctor, NGAY_YL: time, NGAY_TH_YL: '202611061425', NGAY_KQ: '202611061431', TEN_DICH_VU: 'Siêu âm tử cung phần phụ' });
async function check(rows) {
  const context = { medicalCase: { id: 'case' }, xml1: { TONG_HOP: { MA_LOAI_KCB: '01' } },
    xml3: { CHITIEU_CHITIET_DVKT_VTYT: { DSACH_CHI_TIET_DVKT: { CHI_TIET_DVKT: rows } } }, events: [], catalog: {} };
  return Promise.all([
    [orderTimeRule, 'ORDER_TIME_SEQUENCE'], [serviceOrderBeforeExamRule, 'SERVICE_ORDER_BEFORE_EXAM'],
    [sameCaseExamClsOverlapRule, 'SAME_CASE_EXAM_CLS_OVERLAP'],
  ].map(([validator, code]) => validator.evaluate(context, { id: code, code, severity: 'ERROR', config: { examWindowMinutes: 5 } }, {})));
}
test('screenshot: exactly one ERROR for 14:18 before 14:24; no assumed 14:24-14:29 overlap', async () => {
  const results = await check([exam('A', '202611061405'), exam('000366/KG-GPHN', '202611061424'), service('000366/KG-GPHN', '202611061418')]);
  const failures = results.filter(r => r.status === 'FAIL');
  assert.equal(failures.length, 1); assert.equal(failures[0].ruleCode, 'ORDER_TIME_SEQUENCE');
  assert.equal(failures[0].severity, 'ERROR'); assert.equal(failures[0].issueCount, 1);
  assert.match(failures[0].details.violations[0].displayMessage, /14:18.*14:24.*000366/);
  assert.equal(results[1].status, 'SKIP'); assert.equal(results[2].status, 'SKIP');
});
test('14:25 order after 14:24 exam does not fail despite overlapping ultrasound interval', async () => {
  assert.equal((await check([exam('A', '202611061424'), service('A', '202611061425')])).filter(r => r.status === 'FAIL').length, 0);
});
test('only compare NGAY_YL, not later NGAY_TH_YL of exam', async () => {
  assert.equal((await check([exam('A', '202611061420', '202611061424'), service('A', '202611061422')])).filter(r => r.status === 'FAIL').length, 0);
});
test('earlier same-doctor exam prevents false failure against later exam', async () => {
  assert.equal((await check([exam('A', '202611061405'), exam('A', '202611061424'), service('A', '202611061418')])).filter(r => r.status === 'FAIL').length, 0);
});
test('equal times, different doctors/days, missing/invalid timestamps do not invent failures', async () => {
  for (const rows of [
    [exam('A', '202611061424'), service('A', '20261106142400')],
    [exam('B', '202611061424'), service('A', '202611061418')],
    [exam('A', '202611071424'), service('A', '202611061418')],
    [exam('A', ''), service('A', '202611061418')],
    [exam('A', '202611061424'), service('A', '202602301418')],
    [exam('A', '202611061424'), service('', '202611061418')], [],
  ]) assert.equal((await check(rows)).filter(r => r.status === 'FAIL').length, 0);
});
