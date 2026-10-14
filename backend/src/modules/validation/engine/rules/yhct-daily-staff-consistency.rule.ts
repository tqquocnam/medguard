import type { RuleValidator, ValidationRule, RuleResult } from "../rule.types.js";

type Obj = Record<string, unknown>;
type Source = "XML3" | "XML5";
type StaffItem = {
  source: Source;
  stt: string;
  date: string;
  code: string;
  field: string;
};
type StaffInfo = {
  staffId: string;
  staffName: string;
};
type Finding = {
  type: "MISSING_STAFF_CODE" | "INVALID_STAFF_DATE";
  date?: string;
  source: Source;
  stt: string;
  field: string;
  message: string;
};

const SERVICE_CODES = [
  "08.0313.0230", "08.0278.0230", "08.0432.0280", "08.0392.0280",
];

function object(value: unknown): Obj | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Obj : null;
}
function first(value: unknown): Obj | null {
  return object(Array.isArray(value) ? value[0] : value);
}
function rows(value: unknown): Obj[] {
  const array = Array.isArray(value) ? value : value == null ? [] : [value];
  return array.filter((item): item is Obj => object(item) !== null);
}
function str(value: unknown): string {
  return value == null ? "" : String(value).trim();
}
function xml3Rows(xml: unknown): Obj[] {
  const root = first(xml);
  const section = first(root?.CHITIEU_CHITIET_DVKT_VTYT);
  return rows(first(section?.DSACH_CHI_TIET_DVKT)?.CHI_TIET_DVKT);
}
function xml5Rows(xml: unknown): Obj[] {
  const root = first(xml);
  const section = first(root?.CHITIEU_CHITIET_DIENBIENLAMSANG);
  return rows(first(section?.DSACH_CHI_TIET_DIEN_BIEN_BENH)?.CHI_TIET_DIEN_BIEN_BENH);
}
function medicalDate(raw: unknown): string | null {
  const s = str(raw);
  if (!/^\d{12}(\d{2})?$/.test(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  const h = Number(s.slice(8, 10));
  const min = Number(s.slice(10, 12));
  const sec = s.length === 14 ? Number(s.slice(12, 14)) : 0;
  const ms = Date.UTC(y, m - 1, d, h, min, sec);
  if (!Number.isFinite(ms)) return null;
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== y || check.getUTCMonth() + 1 !== m ||
    check.getUTCDate() !== d || check.getUTCHours() !== h ||
    check.getUTCMinutes() !== min || check.getUTCSeconds() !== sec
  ) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}
function codes(raw: unknown): string[] {
  return [...new Set(str(raw).split(/[;,|]/).map(s => s.trim().toUpperCase()).filter(Boolean))];
}
function result(rule: ValidationRule, status: RuleResult["status"], message: string,
  details: Obj, issueCount = 0): RuleResult {
  return {
    ruleId: rule.id, ruleCode: rule.code, status, severity: rule.severity,
    message, details, issueCount,
  };
}

/**
 * Rule 17: compare XML3 performers against XML5 narrative authors by date.
 * Different professionals in these two roles is NOT a violation and is never
 * used to generate a warning. No assumptions about mandatory same-day XML5.
 */
export const yhctDailyStaffConsistencyRule: RuleValidator = {
  async evaluate(context, rule, runtime) {
    const xml1 = first(first(context.xml1)?.TONG_HOP);
    if (!xml1 || str(xml1.MA_LOAI_KCB).padStart(2, "0") !== "02") {
      return result(rule, "SKIP", "Chỉ áp dụng hồ sơ điều trị ngoại trú (02).", { reason: "NOT_OUTPATIENT" });
    }
    const cfg = rule.config ?? {};
    const selected = new Set(
      Array.isArray(cfg.serviceCodes)
        ? (cfg.serviceCodes as unknown[]).map(str).filter(Boolean)
        : SERVICE_CODES
    );
    if (!selected.size) return result(rule, "SKIP", "Chưa cấu hình DVKT YHCT.", { reason: "NO_SERVICE_CODES" });

    // Optional explicit warning switches; default is audit-only (SKIP).
    const warnMissingXml3Performer = cfg.warnMissingXml3Performer === true;
    const warnMissingXml5Author = cfg.warnMissingXml5Author === true;
    const warnInvalidStaffDate = cfg.warnInvalidStaffDate === true;
    const warnEnabled = warnMissingXml3Performer || warnMissingXml5Author || warnInvalidStaffDate;

    const xml3 = xml3Rows(context.xml3).filter(r => selected.has(str(r.MA_DICH_VU)));
    const xml5Present = context.xml5 != null;
    const xml5 = xml5Rows(context.xml5);
    if (!xml3.length) {
      return result(rule, "SKIP", "Không có DVKT YHCT thuộc phạm vi kiểm tra nhân viên.", {
        reason: "NO_SELECTED_XML3", serviceCodes: [...selected],
      });
    }

    const items: StaffItem[] = [];
    const findings: Finding[] = [];
    const uncertain: Obj[] = [];
    const counts = { xml3Services: xml3.length, xml5Entries: xml5.length,
      xml3MissingStaffRows: 0, xml5MissingStaffRows: 0, invalidTimeRows: 0 };
    const allSources: { source: Source; records: Obj[]; field: string; timeField: string }[] = [
      { source: "XML3", records: xml3, field: "NGUOI_THUC_HIEN", timeField: "NGAY_TH_YL" },
      { source: "XML5", records: xml5, field: "NGUOI_THUC_HIEN", timeField: "THOI_DIEM_DBLS" },
    ];
    const observedDays = new Map<string, Set<Source>>();

    for (const input of allSources) {
      for (const row of input.records) {
        const stt = str(row.STT);
        const date = medicalDate(row[input.timeField]);
        const staffCodes = codes(row[input.field]);
        if (!date) {
          counts.invalidTimeRows++;
          uncertain.push({ type: "INVALID_STAFF_DATE", source: input.source, stt,
            field: input.timeField, rawTime: str(row[input.timeField]) });
          if (warnInvalidStaffDate) {
            findings.push({ type: "INVALID_STAFF_DATE", source: input.source, stt,
              field: input.timeField, message: `${input.source} STT ${stt} có thời gian ${input.timeField} không hợp lệ; cần kiểm tra nguồn dữ liệu.` });
          }
          continue;
        }
        if (!observedDays.has(date)) observedDays.set(date, new Set());
        observedDays.get(date)!.add(input.source);
        if (!staffCodes.length) {
          if (input.source === "XML3") counts.xml3MissingStaffRows++;
          else counts.xml5MissingStaffRows++;
          uncertain.push({ type: "MISSING_STAFF_CODE", source: input.source, date, stt, field: input.field });
          if ((input.source === "XML3" && warnMissingXml3Performer) ||
              (input.source === "XML5" && warnMissingXml5Author)) {
            findings.push({ type: "MISSING_STAFF_CODE", date, source: input.source,
              stt, field: input.field,
              message: `Ngày ${date}: ${input.source} STT ${stt} thiếu ${input.field}; cần rà soát hồ sơ, chưa kết luận vi phạm BHYT.` });
          }
          continue;
        }
        for (const code of staffCodes) {
          items.push({ source: input.source, date, stt, code, field: input.field });
        }
      }
    }

    // Resolve only names/identities already present in the staff catalog.
    // Aliases and license numbers for the same staff resolve to one staff ID.
    const distinctCodes = [...new Set(items.map(item => item.code))];
    type StaffLookupRow = { code: string; staff_id: string; full_name: string };
    const lookup = new Map<string, StaffInfo>();
    const ambiguous = new Set<string>();
    if (distinctCodes.length) {
      const found = await runtime.client.query<StaffLookupRow>(`
        SELECT DISTINCT UPPER(BTRIM(ms.license_number)) AS code,
               ms.id::text AS staff_id, ms.full_name
        FROM catalog.medical_staff ms
        WHERE NULLIF(BTRIM(ms.license_number), '') IS NOT NULL
          AND UPPER(BTRIM(ms.license_number)) = ANY($1::text[])
        UNION
        SELECT DISTINCT UPPER(BTRIM(ms.social_insurance_code)) AS code,
               ms.id::text AS staff_id, ms.full_name
        FROM catalog.medical_staff ms
        WHERE NULLIF(BTRIM(ms.social_insurance_code), '') IS NOT NULL
          AND UPPER(BTRIM(ms.social_insurance_code)) = ANY($1::text[])
        UNION
        SELECT DISTINCT UPPER(BTRIM(a.alias_code)) AS code,
               ms.id::text AS staff_id, ms.full_name
        FROM catalog.medical_staff_aliases a
        JOIN catalog.medical_staff ms ON ms.id = a.staff_id
        WHERE UPPER(BTRIM(a.alias_code)) = ANY($1::text[])
      `, [distinctCodes]);
      for (const person of found.rows) {
        const key = person.code.toUpperCase().trim();
        const previous = lookup.get(key);
        if (previous && previous.staffId !== person.staff_id) ambiguous.add(key);
        else lookup.set(key, { staffId: person.staff_id, staffName: person.full_name });
      }
      for (const key of ambiguous) lookup.delete(key);
    }

    const groups = new Map<string, { xml3: Set<string>; xml5: Set<string>;
      xml3Codes: Set<string>; xml5Codes: Set<string>; xml3Rows: Set<string>; xml5Rows: Set<string> }>();
    const unresolved = new Set<string>();
    for (const item of items) {
      let group = groups.get(item.date);
      if (!group) {
        group = { xml3: new Set(), xml5: new Set(), xml3Codes: new Set(),
          xml5Codes: new Set(), xml3Rows: new Set(), xml5Rows: new Set() };
        groups.set(item.date, group);
      }
      const identity = lookup.get(item.code)?.staffId ?? `CODE:${item.code}`;
      if (!lookup.has(item.code)) unresolved.add(item.code);
      const staff = item.source === "XML3" ? group.xml3 : group.xml5;
      const groupCodes = item.source === "XML3" ? group.xml3Codes : group.xml5Codes;
      const rowIds = item.source === "XML3" ? group.xml3Rows : group.xml5Rows;
      staff.add(identity);
      groupCodes.add(item.code);
      rowIds.add(item.stt);
    }

    const dailyStats = [...observedDays.keys()].sort().map(date => {
      const group = groups.get(date);
      const xml3StaffIds = [...(group?.xml3 ?? [])].sort();
      const xml5StaffIds = [...(group?.xml5 ?? [])].sort();
      const sharedStaffIds = xml3StaffIds.filter(id => xml5StaffIds.includes(id));
      return {
        date,
        hasXml3: observedDays.get(date)?.has("XML3") ?? false,
        hasXml5: observedDays.get(date)?.has("XML5") ?? false,
        xml3StaffCodes: [...(group?.xml3Codes ?? [])].sort(),
        xml5StaffCodes: [...(group?.xml5Codes ?? [])].sort(),
        xml3StaffCount: xml3StaffIds.length,
        xml5StaffCount: xml5StaffIds.length,
        sharedStaffCount: sharedStaffIds.length,
        xml3StaffIds, xml5StaffIds,
        // Informational only: different staff roles are legitimate.
        differentStaffRoles: xml3StaffIds.length > 0 && xml5StaffIds.length > 0 && sharedStaffIds.length === 0,
      };
    });

    const details: Obj = {
      scope: "MA_LOAI_KCB=02",
      source: { xml3Time: "XML3.NGAY_TH_YL", xml3Staff: "XML3.NGUOI_THUC_HIEN",
        xml5Time: "XML5.THOI_DIEM_DBLS", xml5Staff: "XML5.NGUOI_THUC_HIEN" },
      serviceCodes: [...selected],
      xml5Present,
      ...counts,
      daysWithXml3: dailyStats.filter(x => x.hasXml3).length,
      daysWithXml5: dailyStats.filter(x => x.hasXml5).length,
      daysWithBoth: dailyStats.filter(x => x.hasXml3 && x.hasXml5).length,
      daysWithDifferentStaffRoles: dailyStats.filter(x => x.differentStaffRoles).length,
      unresolvedStaffCodes: [...unresolved].sort(),
      ambiguousStaffCodes: [...ambiguous].sort(),
      dailyStats,
      warnMissingXml3Performer, warnMissingXml5Author, warnInvalidStaffDate,
      findings,
      uncertain,
      note: "Người thực hiện DVKT XML3 và người ghi diễn biến XML5 có thể là hai nhân viên khác nhau. " +
        "Điều này không được tính là lỗi. Mã chưa có trong danh mục không đồng nghĩa nhân viên không hợp lệ.",
    };

    if (findings.length) {
      return result(rule, "FAIL", `Có ${findings.length} thông tin nhân viên/thời gian cần rà soát; chưa kết luận vi phạm BHYT.`,
        details, findings.length);
    }
    if (!warnEnabled) {
      return result(rule, "SKIP", `Đã đối chiếu nhân viên XML3/XML5 theo ${dailyStats.length} ngày; đang ở chế độ thống kê.`, details);
    }
    if (counts.invalidTimeRows > 0 && !warnInvalidStaffDate) {
      return result(rule, "SKIP", "Đã thống kê nhưng còn ngày giờ không hợp lệ, chưa đủ cơ sở kết luận.", details);
    }
    if (!xml5Present && warnMissingXml5Author) {
      return result(rule, "SKIP", "Không có XML5 để đối chiếu tác giả diễn biến.", details);
    }
    return result(rule, "PASS", "Đã kiểm tra trường nhân viên theo cấu hình; không phát hiện thiếu mã cần cảnh báo.", details);
  },
};
