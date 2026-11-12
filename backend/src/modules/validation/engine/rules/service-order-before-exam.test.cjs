const { test } = require('node:test');
const assert = require('node:assert/strict');
const { serviceOrderBeforeExamRule } = require('./service-order-before-exam.rule.ts');
const rule = { id: 'test', code: 'SERVICE_ORDER_BEFORE_EXAM' };
const exam = (doctor, time) => ({ MA_NHOM: '13', MA_BAC_SI: doctor, NGAY_TH_YL: time });
const service = (doctor, time) => ({ MA_NHOM: '2', MA_BAC_SI: doctor, NGAY_YL: time, TEN_DICH_VU: 'Siêu âm tử cung phần phụ' });
const check = (rows, type = '01') => serviceOrderBeforeExamRule.evaluate({
  medicalCase: { id: 'case' }, xml1: { TONG_HOP: { MA_LOAI_KCB: type } },
  xml3: { CHITIEU_CHITIET_DVKT_VTYT: { DSACH_CHI_TIET_DVKT: { CHI_TIET_DVKT: rows } } },
  events: [], catalog: {},
}, rule);
test('regression: 14:18 order before same doctor exam at 14:24, with another earlier doctor', async () => {
  const r = await check([exam('A', '202611061405'), exam('000366/KG-GPHN', '202611061424'), service('000366/KG-GPHN', '202611061418')]);
  assert.equal(r.status, 'FAIL'); assert.equal(r.severity, 'ERROR'); assert.equal(r.issueCount, 1);
  assert.match(r.details.violations[0].displayMessage, /14:18:00.*14:24:00.*000366/);
});
test('earlier same doctor exam prevents false failure against later exam', async () => {
  assert.equal((await check([exam('A', '202611061405'), exam('A', '202611061424'), service('A', '202611061418')])).status, 'PASS');
});
test('same timestamp and order after exam pass', async () => {
  for (const time of ['20261106142400', '202611061425'])
    assert.equal((await check([exam('A', '202611061424'), service('A', time)])).status, 'PASS');
});
test('different doctor, different day, missing and invalid timestamps skip', async () => {
  for (const rows of [
    [exam('B', '202611061424'), service('A', '202611061418')],
    [exam('A', '202611071424'), service('A', '202611061418')],
    [exam('A', ''), service('A', '202611061418')],
    [exam('A', '202611061424'), service('A', '202602301418')],
    [exam('A', '202611061424'), service('', '202611061418')],
    [],
  ]) assert.equal((await check(rows)).status, 'SKIP');
});
test('inpatient skipped; single XML row supported', async () => {
  assert.equal((await check([exam('A', '202611061424'), service('A', '202611061418')], '03')).status, 'SKIP');
  assert.equal((await check(service('A', '202611061418'))).status, 'SKIP');
});
