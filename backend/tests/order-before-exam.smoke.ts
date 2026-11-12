import assert from 'node:assert/strict';
import { orderTimeRule } from '../src/modules/validation/engine/rules/order-time.rule.js';
const exam = (time = '202611060715', doctor = '00064/ST-CCHN') => ({MA_NHOM:13, MA_BAC_SI:doctor, TEN_DICH_VU:'Khám Nội', NGAY_YL:time});
const service = (time = '202611060701', doctor = '00064/ST-CCHN') => ({MA_NHOM:2, MA_BAC_SI:doctor, TEN_DICH_VU:'Chụp X-quang ngực', NGAY_YL:time});
async function check(rows: unknown[], events: unknown[] = []) {
 return orderTimeRule.evaluate({medicalCase:{id:'test'}, events, catalog:{}, xml3:{CHITIEU_CHITIET_DVKT_VTYT:{DSACH_CHI_TIET_DVKT:{CHI_TIET_DVKT:rows}}}} as any, {id:'r',code:'ORDER_TIME_SEQUENCE',severity:'WARNING',config:{}} as any, {} as any);
}
async function main() {
 const result = await check([exam(),service()]);
 assert.equal(result.status,'FAIL'); assert.equal(result.severity,'ERROR'); assert.equal(result.issueCount,1);
 assert.match((result.details!.violations as any[])[0].displayMessage,/07:01.*07:15/);
 for (const rows of [
  [exam(),service('202611060715')], [exam(),service('202611060716')],
  [exam(),service(undefined,'OTHER')], [exam(),service('202611050701')],
  [exam(),exam('202611060700'),service()], [exam(),service('202602300701')],
  [exam(),service('')], [service()],
 ]) assert.notEqual((await check(rows)).status,'FAIL');
 assert.equal((await check([exam('20261106071500'),service('20261106071459')])).status,'FAIL');
 const old = await check([], [{id:'event',raw_data:{NGAY_YL:'202611060800',NGAY_TH_YL:'202611060759'}}]);
 assert.equal(old.status,'FAIL'); assert.equal((old.details!.violations as any[])[0].type,'PERFORM_BEFORE_ORDER');
 console.log('Passed: early order, boundaries, doctor/day matching, repeated exams, invalid/missing dates, seconds, existing sequence check.');
}
main();
