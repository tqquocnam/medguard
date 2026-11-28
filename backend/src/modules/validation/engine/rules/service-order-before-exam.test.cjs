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
test('X-ray ending at the second exam start is one error for the same performer and doctor despite duplicate rows', async () => {
  const firstExam = { ...exam('A', '202611220714'), TEN_DICH_VU: 'Khám Nhi' };
  const secondExam = { ...exam('B', '202611220733'), TEN_DICH_VU: 'Khám Tai Mũi Họng' };
  const xray = {
    MA_NHOM: '2', MA_DICH_VU: '18.0112.0029', TEN_DICH_VU: 'Chụp X-quang khớp gối',
    MA_BAC_SI: 'A', NGUOI_THUC_HIEN: ' b ',
    NGAY_YL: '202611220716', NGAY_TH_YL: '202611220730', NGAY_KQ: '202611220733',
  };
  const lab = { ...xray, MA_NHOM: '1', TEN_DICH_VU: 'Xét nghiệm máu', NGAY_KQ: '202611220747' };
  const [result] = await check([firstExam, lab, xray, { ...xray }, secondExam]);
  assert.equal(result.status, 'FAIL');
  assert.equal(result.severity, 'ERROR');
  assert.equal(result.issueCount, 1);
  assert.equal(result.details.violations[0].type, 'XRAY_EXAM_OVERLAP');
  assert.match(result.details.violations[0].displayMessage, /07:30.*07:33.*Khám Tai Mũi Họng.*07:33.*07:38/);

  for (const performer of ['C', '']) {
    const [withoutConflict] = await check([
      firstExam, { ...xray, NGUOI_THUC_HIEN: performer, NGAY_KQ: '202611220735' }, secondExam,
    ]);
    assert.notEqual(withoutConflict.status, 'FAIL');
  }

  for (const resultTime of ['20261122073259', '', '202611220729']) {
    const [withoutOverlap] = await check([firstExam, lab, { ...xray, NGAY_KQ: resultTime }, secondExam]);
    assert.notEqual(withoutOverlap.status, 'FAIL');
  }
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

test('ECG execution overlaps a same-case exam only for the person performing both', async () => {
  const visit = exam('A', '202611231255');
  const ecg = {
    MA_NHOM: '2', MA_BAC_SI: 'A', NGUOI_THUC_HIEN: 'A',
    TEN_DICH_VU: 'Điện tim thường', NGAY_YL: '202611231256',
    NGAY_TH_YL: '202611231256', NGAY_KQ: '202611231311',
  };
  const [conflict] = await check([visit, ecg, { ...ecg }]);
  assert.equal(conflict.issueCount, 1);
  assert.equal(conflict.details.violations[0].type, 'ECG_EXECUTION_EXAM_OVERLAP');

  for (const performer of ['B', '']) {
    const [result] = await check([visit, { ...ecg, NGUOI_THUC_HIEN: performer }]);
    assert.notEqual(result.status, 'FAIL');
  }
});
