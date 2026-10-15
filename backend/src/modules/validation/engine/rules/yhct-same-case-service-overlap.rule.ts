import type { RuleValidator } from "../rule.types.js";

type XmlRow = Record<string, unknown>;
type Session = {
  key: string;
  stt: string;
  code: string;
  name: string;
  start: number;
  end: number;
  startRaw: string;
  endRaw: string;
  staff: string;
  machine: string;
};

function asObject(value: unknown): XmlRow | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as XmlRow)
    : null;
}

function first(value: unknown): XmlRow | null {
  return asObject(Array.isArray(value) ? value[0] : value);
}

function txt(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function parseXmlTime(value: unknown): number | null {
  const raw = txt(value);
  if (!/^\d{12}(\d{2})?$/.test(raw)) return null;
  const y = Number(raw.slice(0, 4));
  const mo = Number(raw.slice(4, 6));
  const d = Number(raw.slice(6, 8));
  const h = Number(raw.slice(8, 10));
  const mi = Number(raw.slice(10, 12));
  const s = raw.length === 14 ? Number(raw.slice(12, 14)) : 0;
  const ms = Date.UTC(y, mo - 1, d, h, mi, s);
  const dt = new Date(ms);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 ||
      dt.getUTCDate() !== d || dt.getUTCHours() !== h ||
      dt.getUTCMinutes() !== mi || dt.getUTCSeconds() !== s) return null;
  return ms;
}

function formatted(raw: string): string {
  if (!/^\d{12}(\d{2})?$/.test(raw)) return raw;
  return `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)} ${raw.slice(8, 10)}:${raw.slice(10, 12)}`;
}

function xml3Rows(xml: unknown): XmlRow[] {
  const root = first(xml);
  const section = first(root?.CHITIEU_CHITIET_DVKT_VTYT);
  const list = first(section?.DSACH_CHI_TIET_DVKT);
  const data = list?.CHI_TIET_DVKT;
  return (Array.isArray(data) ? data : data ? [data] : [])
    .filter((v): v is XmlRow => asObject(v) !== null);
}

export const yhctSameCaseServiceOverlapRule: RuleValidator = {
  async evaluate(context, rule, runtime) {
    const treatmentGroup = txt(
      (context.medicalCase as typeof context.medicalCase & { treatment_group?: string | null })
        .treatment_group
    ).toUpperCase();
    const xml1 = first(first(context.xml1)?.TONG_HOP);
    const kcb = txt(xml1?.MA_LOAI_KCB).padStart(2, "0");

    const makeResult = (
      status: "PASS" | "FAIL" | "SKIP",
      message: string,
      details: Record<string, unknown>,
      issueCount = 0
    ) => ({
      ruleId: rule.id,
      ruleCode: rule.code,
      status,
      severity: rule.severity,
      issueCount,
      message,
      details,
    });

    if (treatmentGroup !== "YHCT" || !xml1 || kcb !== "02") {
      return makeResult("SKIP", "Chỉ kiểm tra trùng DVKT trong hồ sơ ngoại trú YHCT.", {
        skipReason: "NOT_APPLICABLE", violations: [],
      });
    }

    // Bảo vệ ngữ nghĩa NGAY_KQ, cùng điều kiện với YHCT_PERFORM_OVERLAP.
    if (rule.config?.confirmedProcedureInterval !== true) {
      return makeResult("SKIP", "Chưa xác nhận khoảng NGAY_TH_YL → NGAY_KQ là thời gian thực hiện.", {
        skipReason: "INTERVAL_NOT_CONFIRMED", violations: [],
      });
    }

    const rawRows = xml3Rows(context.xml3);
    const sessions: Session[] = [];
    const seen = new Set<string>();
    let invalidIntervalCount = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const code = txt(row.MA_DICH_VU).toUpperCase();
      if (!code) continue;
      const startRaw = txt(row.NGAY_TH_YL);
      const endRaw = txt(row.NGAY_KQ);
      const start = parseXmlTime(startRaw);
      const end = parseXmlTime(endRaw);
      if (start === null || end === null || end <= start) {
        invalidIntervalCount++;
        continue;
      }
      const stt = txt(row.STT);
      // Giữ các sự kiện khác nhau ngay cả khi cùng mã DVKT, cùng giờ.
      const key = JSON.stringify([stt || `row-${i}`, code, startRaw, endRaw]);
      if (seen.has(key)) continue;
      seen.add(key);
      sessions.push({
        key, stt, code, name: txt(row.TEN_DICH_VU) || code,
        start, end, startRaw, endRaw,
        staff: txt(row.NGUOI_THUC_HIEN), machine: txt(row.MA_MAY),
      });
    }

    if (sessions.length < 2) {
      return makeResult("SKIP", "Không đủ hai DVKT có khoảng thực hiện hợp lệ để đối chiếu.", {
        checkedSessions: sessions.length, invalidIntervalCount, violations: [],
      });
    }

    const serviceCodes = [...new Set(sessions.map(s => s.code))];
    const query = await runtime.client.query<{
      code: string;
      allow_simultaneous: boolean | null;
    }>(`
      SELECT code, allow_simultaneous
      FROM catalog.services
      WHERE active = TRUE AND code = ANY($1::varchar[])
    `, [serviceCodes]);

    const permission = new Map<string, boolean | null>();
    for (const row of query.rows) {
      permission.set(txt(row.code).toUpperCase(), row.allow_simultaneous);
    }

    const violations: Record<string, unknown>[] = [];
    let unknownConfigPairs = 0;
    for (let i = 0; i < sessions.length; i++) {
      for (let j = i + 1; j < sessions.length; j++) {
        const a = sessions[i];
        const b = sessions[j];
        const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
        if (overlap <= 0) continue;

        // Chỉ kết luận theo cấu hình khi CẢ HAI dịch vụ đều không cho phép đồng thời.
        if (permission.get(a.code) !== false || permission.get(b.code) !== false) {
          if (!permission.has(a.code) || !permission.has(b.code)) unknownConfigPairs++;
          continue;
        }

        const minutes = Math.round((overlap / 60000) * 100) / 100;
        const message = `${a.name}: ${formatted(a.startRaw)} → ${formatted(a.endRaw)} ` +
          `(Trùng thời gian) - ${b.name}: ${formatted(b.startRaw)} → ${formatted(b.endRaw)}. ` +
          `Chồng lấn ${minutes} phút; cả hai DVKT đều có cấu hình không cho phép thực hiện cùng lúc.`;

        violations.push({
          type: "YHCT_SAME_CASE_SERVICE_OVERLAP",
          sourceEventKey: a.key, conflictEventKey: b.key,
          sourceStt: a.stt, conflictStt: b.stt,
          sourceCode: a.code, conflictCode: b.code,
          sourceName: a.name, conflictName: b.name,
          sourceStaff: a.staff, conflictStaff: b.staff,
          sourceMachine: a.machine, conflictMachine: b.machine,
          sourceStart: a.startRaw, sourceEnd: a.endRaw,
          conflictStart: b.startRaw, conflictEnd: b.endRaw,
          overlapMinutes: minutes,
          displayMessage: message, message,
        });
      }
    }

    const details = {
      scope: "YHCT_SAME_CASE", checkedSessions: sessions.length,
      invalidIntervalCount, unknownConfigPairs, violations,
    };
    if (violations.length) {
      return makeResult("FAIL", `Phát hiện ${violations.length} cặp DVKT cùng hồ sơ bị trùng thời gian theo cấu hình.`,
        details, violations.length);
    }
    if (invalidIntervalCount || unknownConfigPairs) {
      return makeResult("SKIP", "Còn DVKT thiếu khoảng thời gian hoặc cấu hình; chưa thể xác nhận đầy đủ.", details);
    }
    return makeResult("PASS", "Không phát hiện cặp DVKT cùng hồ sơ thực hiện đồng thời trái cấu hình.", details);
  },
};
