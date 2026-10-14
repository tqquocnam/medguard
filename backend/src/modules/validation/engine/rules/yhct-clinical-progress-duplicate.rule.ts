import type { RuleValidator, ValidationRule, RuleResult } from "../rule.types.js";

type Obj = Record<string, unknown>;
type Entry = { stt: string; time: string; day: string; minute: string; staff: string; text: string; normalized: string };
type Finding = { type: string; date: string; time?: string; stts: string[]; count: number; message: string; preview?: string };

function obj(value: unknown): Obj | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Obj : null;
}
function first(value: unknown): Obj | null { return obj(Array.isArray(value) ? value[0] : value); }
function str(value: unknown): string { return value == null ? "" : String(value).trim(); }
function rows(value: unknown): Obj[] {
  return (Array.isArray(value) ? value : value == null ? [] : [value]).filter((v): v is Obj => obj(v) !== null);
}
function xml5Rows(xml: unknown): Obj[] {
  const root = first(xml);
  const section = first(root?.CHITIEU_CHITIET_DIENBIENLAMSANG);
  const list = first(section?.DSACH_CHI_TIET_DIEN_BIEN_BENH);
  return rows(list?.CHI_TIET_DIEN_BIEN_BENH);
}
function dateTime(raw: string): { day: string; minute: string } | null {
  if (!/^\d{12}(\d{2})?$/.test(raw)) return null;
  const y=+raw.slice(0,4), m=+raw.slice(4,6), d=+raw.slice(6,8);
  const h=+raw.slice(8,10), min=+raw.slice(10,12), s=raw.length===14 ? +raw.slice(12,14) : 0;
  const v = new Date(Date.UTC(y,m-1,d,h,min,s));
  if (v.getUTCFullYear()!==y || v.getUTCMonth()!==m-1 || v.getUTCDate()!==d || v.getUTCHours()!==h || v.getUTCMinutes()!==min || v.getUTCSeconds()!==s) return null;
  return {day:`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`,minute:raw.slice(0,12)};
}
function normalizeNarrative(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(/\s+/g," ").trim();
}
function result(rule: ValidationRule, status: RuleResult["status"], message: string, details: Obj, issueCount=0): RuleResult {
  return {ruleId:rule.id, ruleCode:rule.code, status, severity:rule.severity, message, details, issueCount};
}
function groupBy<T>(items: T[], keyOf: (item:T)=>string): Map<string,T[]> {
  const map = new Map<string,T[]>();
  for(const item of items) {const key=keyOf(item); const a=map.get(key)??[];a.push(item);map.set(key,a);}
  return map;
}

/**
 * Rule 15: Audit of XML5 clinical progress. Repeated text at the same minute is
 * frequent when XML5 emits one row per procedure; it is informational, NOT a violation.
 * Exact repetition across separate days is only warned when explicitly enabled.
 * No judgement on clinical correctness is made.
 */
export const yhctClinicalProgressDuplicateRule: RuleValidator = {
  async evaluate(context, rule, _runtime) {
    const xml1=first(first(context.xml1)?.TONG_HOP);
    if(!xml1 || str(xml1.MA_LOAI_KCB).padStart(2,"0")!=="02") {
      return result(rule,"SKIP","Chỉ áp dụng hồ sơ điều trị ngoại trú (02).",{});
    }
    if(context.xml5 == null) {
      return result(rule,"SKIP","Hồ sơ không có XML5 để kiểm tra diễn biến.",{reason:"XML5_NOT_LOADED"});
    }
    const cfg=rule.config??{};
    const warnRepeatedAcrossDays=cfg.warnRepeatedAcrossDays===true;
    const warnDifferentNarrativeSameMinute=cfg.warnDifferentNarrativeSameMinute===true;
    const minTextLength=typeof cfg.minTextLength==="number" && Number.isSafeInteger(cfg.minTextLength) && cfg.minTextLength>=20 ? cfg.minTextLength : 100;
    const rawRows=xml5Rows(context.xml5);
    if(!rawRows.length) return result(rule,"SKIP","XML5 không có dòng diễn biến để đối chiếu.",{totalXml5Rows:0});

    const entries: Entry[]=[];
    const uncertain: Obj[]=[];
    for(const row of rawRows) {
      const stt=str(row.STT),time=str(row.THOI_DIEM_DBLS), dt=dateTime(time);
      if(!dt) {uncertain.push({type:time?"INVALID_XML5_TIME":"MISSING_XML5_TIME",stt,time});continue;}
      const narrative=str(row.DIEN_BIEN_LS);
      entries.push({stt,time,day:dt.day,minute:dt.minute,staff:str(row.NGUOI_THUC_HIEN),text:narrative,normalized:normalizeNarrative(narrative)});
    }
    const sameMinute=groupBy(entries,e=>e.minute);
    const sameMinuteDuplicates: Obj[]=[];
    const findings: Finding[]=[];
    let repeatedWithinMinuteRows=0;
    for(const [, group] of sameMinute) {
      if(group.length<2) continue;
      const narrativeGroups=groupBy(group,e=>e.normalized);
      for(const [,dup] of narrativeGroups) {
        if(dup.length<2 || !dup[0].normalized) continue;
        repeatedWithinMinuteRows+=dup.length-1;
        sameMinuteDuplicates.push({date:dup[0].day,time:dup[0].minute,count:dup.length,stts:dup.map(x=>x.stt),preview:dup[0].text.slice(0,130)});
      }
      const longDifferent=[...narrativeGroups.keys()].filter(x=>x.length>=minTextLength);
      if(warnDifferentNarrativeSameMinute && longDifferent.length>1) {
        findings.push({type:"DIFFERENT_NARRATIVE_SAME_MINUTE",date:group[0].day,time:group[0].minute,stts:group.map(x=>x.stt),count:group.length,message:`XML5 có ${longDifferent.length} nội dung diễn biến khác nhau được ghi cùng phút ${group[0].minute} (${group[0].day}); cần đối chiếu các bản ghi, chưa kết luận sai.`});
      }
    }

    // De-duplicate within the same day BEFORE comparing across days.
    const dailyUnique=[...groupBy(entries.filter(e=>e.normalized.length>=minTextLength),e=>`${e.day}|${e.normalized}`).values()].map(a=>a[0]);
    const narrativeAcrossDates=groupBy(dailyUnique,e=>e.normalized);
    const repeatedAcrossDays: Obj[]=[];
    for(const [,group] of narrativeAcrossDates) {
      const dates=[...new Set(group.map(e=>e.day))].sort();
      if(dates.length<2)continue;
      repeatedAcrossDays.push({dates,dayCount:dates.length,stts:group.map(e=>e.stt),preview:group[0].text.slice(0,160)});
      if(warnRepeatedAcrossDays) {
        findings.push({type:"REPEATED_PROGRESS_ACROSS_DAYS",date:dates[0],stts:group.map(e=>e.stt),count:dates.length,preview:group[0].text.slice(0,160),message:`Nội dung diễn biến XML5 giống nhau ở ${dates.length} ngày (${dates.join(", ")}); cần rà soát tính phù hợp của ghi chép, chưa kết luận vi phạm.`});
      }
    }
    const dates=[...new Set(entries.map(e=>e.day))].sort();
    const details: Obj={source:"XML5.THOI_DIEM_DBLS + XML5.DIEN_BIEN_LS",totalXml5Rows:rawRows.length,validRows:entries.length,invalidTimeCount:uncertain.length,uncertain,uniqueDays:dates.length,dates,sameMinuteDuplicateGroups:sameMinuteDuplicates.length,repeatedWithinMinuteRows,sameMinuteDuplicates,repeatedAcrossDaysGroups:repeatedAcrossDays.length,repeatedAcrossDays,config:{warnRepeatedAcrossDays,warnDifferentNarrativeSameMinute,minTextLength},findings,note:"Các dòng XML5 trùng phút/nội dung có thể xuất phát từ ghi nhận cho nhiều DVKT. Nội dung giống nhau qua nhiều ngày không mặc nhiên sai. Chỉ yêu cầu rà soát."};
    if(findings.length) return result(rule,"FAIL",`Phát hiện ${findings.length} nhóm diễn biến XML5 cần rà soát; chưa kết luận vi phạm.`,details,findings.length);
    if(uncertain.length) return result(rule,"SKIP",`Đã thống kê XML5 nhưng có ${uncertain.length} dòng thiếu/sai thời gian.`,details);
    if(!warnRepeatedAcrossDays && !warnDifferentNarrativeSameMinute) return result(rule,"SKIP",`Đã thống kê ${entries.length} dòng XML5 trong ${dates.length} ngày; chưa bật cảnh báo trùng nội dung.`,details);
    return result(rule,"PASS","Đã đối chiếu diễn biến XML5, không phát hiện tình huống vượt điều kiện cảnh báo đã bật.",details);
  }
};
