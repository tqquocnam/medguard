import type { RuleValidator, RuleResult, ValidationRule } from "../rule.types.js";

type ExamRow = {
  event_id: string;
  medical_case_id: string;
  ma_bn: string | null;
  ho_ten: string | null;
  treatment_group: string | null;
  item_code: string | null;
  item_name: string | null;
  ngay_yl: string | null;
  ty_le_tt_dv: string | null;
  t_bhtt: string | null;
};

type CaseInfo = {
  id: string;
  ma_bn?: string | null;
  ho_ten?: string | null;
  treatment_group?: string | null;
};

const trim = (value: unknown): string => String(value ?? "").trim();

function parseNumber(value: unknown): number | null {
  const str = trim(value).replace(/\s/g, "");
  if (!str) return null;
  const number = Number(str.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function parseXmlDateTime(value: unknown): string | null {
  const str = trim(value);
  if (!/^\d{12}(\d{2})?$/.test(str)) return null;
  const year = +str.slice(0, 4);
  const month = +str.slice(4, 6);
  const day = +str.slice(6, 8);
  const hour = +str.slice(8, 10);
  const minute = +str.slice(10, 12);
  const second = str.length === 14 ? +str.slice(12, 14) : 0;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day || date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second
  ) return null;
  return str.padEnd(14, "0");
}

function formatDate(raw: string): string {
  return `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`;
}

function makeResult(
  rule: ValidationRule,
  status: RuleResult["status"],
  message: string,
  violations: Array<Record<string, unknown>>,
  extra: Record<string, unknown> = {}
): RuleResult {
  return {
    ruleId: rule.id,
    ruleCode: rule.code,
    status,
    severity: rule.severity,
    issueCount: violations.length,
    message,
    details: { violations, ...extra },
  };
}

/**
 * Quy tắc nội bộ (phải đối chiếu với quy định thanh toán áp dụng):
 * Nếu một bệnh nhân đã có công khám được BHYT thanh toán trước đó
 * trong cùng ngày, công khám YHCT 08.16 sau đó phải có TYLE_TT_DV = 30.
 * Chỉ kiểm tra hồ sơ YHCT; không sửa hoặc đánh giá hồ sơ GENERAL.
 */
export const yhctExamPaymentRateRule: RuleValidator = {
  async evaluate(context, rule, runtime) {
    const medicalCase = context.medicalCase as CaseInfo;
    if (trim(medicalCase.treatment_group).toUpperCase() !== "YHCT") {
      return makeResult(rule, "SKIP", "Chỉ áp dụng cho hồ sơ YHCT.", [], {
        skipReason: "NOT_YHCT",
      });
    }

    const patientCode = trim(medicalCase.ma_bn);
    if (!patientCode) {
      return makeResult(rule, "SKIP", "Hồ sơ thiếu mã bệnh nhân để đối chiếu công khám.", [], {
        skipReason: "MISSING_PATIENT_CODE",
      });
    }

    const configuredRate = parseNumber(rule.config?.secondExamRate) ?? 30;
    const examCodesValue = rule.config?.examCodes;
    const examCodes = Array.isArray(examCodesValue)
      ? examCodesValue.map(trim).filter(Boolean)
      : ["02.03", "08.16"];
    const yhctCode = trim(rule.config?.yhctExamCode) || "08.16";
    if (!examCodes.includes(yhctCode)) examCodes.push(yhctCode);

    // Dùng ma_bn để tìm giữa nhiều hồ sơ, kể cả nhóm GENERAL.
    // Không lấy ngày thanh toán từ ngay_vao: ngày công khám phải đến từ XML3.NGAY_YL.
    const { rows } = await runtime.client.query<ExamRow>(
      `
      SELECT
        e.id::text AS event_id,
        e.medical_case_id::text AS medical_case_id,
        mc.ma_bn,
        mc.ho_ten,
        mc.treatment_group,
        e.item_code,
        e.item_name,
        e.raw_data ->> 'NGAY_YL' AS ngay_yl,
        e.raw_data ->> 'TYLE_TT_DV' AS ty_le_tt_dv,
        e.raw_data ->> 'T_BHTT' AS t_bhtt
      FROM core.medical_events e
      JOIN core.medical_cases mc ON mc.id = e.medical_case_id
      WHERE mc.ma_bn = $1
        AND e.source_type = 'XML3'
        AND e.item_code = ANY($2::text[])
      `,
      [patientCode, examCodes]
    );

    // Chặn đối chiếu nhầm khi hệ thống tái sử dụng mã BN cho tên khác.
    const patientName = trim(medicalCase.ho_ten).toUpperCase();
    const exams = rows
      .filter((r) => !patientName || !trim(r.ho_ten) || trim(r.ho_ten).toUpperCase() === patientName)
      .map((r) => ({ ...r, time: parseXmlDateTime(r.ngay_yl) }))
      .filter((r): r is ExamRow & { time: string } => r.time !== null)
      .sort((a, b) => a.time.localeCompare(b.time) || a.event_id.localeCompare(b.event_id));

    const current = exams.filter(
      (r) => r.medical_case_id === String(medicalCase.id) && trim(r.item_code) === yhctCode
    );
    if (!current.length) {
      return makeResult(rule, "SKIP", "Hồ sơ không có công khám YHCT đủ thời gian để kiểm tra.", [], {
        skipReason: "NO_VALID_YHCT_EXAM",
      });
    }

    const violations: Array<Record<string, unknown>> = [];
    let checked = 0;
    let missingRate = 0;
    for (const exam of current) {
      const earlierPaid = exams.find((other) =>
        other.event_id !== exam.event_id &&
        other.time.slice(0, 8) === exam.time.slice(0, 8) &&
        other.time < exam.time &&
        (parseNumber(other.t_bhtt) ?? 0) > 0
      );
      if (!earlierPaid) continue;

      const declaredRate = parseNumber(exam.ty_le_tt_dv);
      if (declaredRate === null) {
        missingRate++;
        continue;
      }
      checked++;
      if (Math.abs(declaredRate - configuredRate) < 0.000001) continue;

      const date = formatDate(earlierPaid.time);
      const message =
        `Khám Y học cổ truyền sai tỉ lệ thanh toán, bệnh nhân đã được thanh toán công khám lần đầu ngày ${date}. ` +
        `Tỷ lệ khai báo ${declaredRate}%, tỷ lệ yêu cầu ${configuredRate}%.`;
      violations.push({
        type: "YHCT_SECOND_EXAM_PAYMENT_RATE",
        message,
        displayMessage: message,
        currentEventId: exam.event_id,
        currentCaseId: exam.medical_case_id,
        currentServiceCode: exam.item_code,
        currentServiceName: exam.item_name,
        currentExamTime: exam.ngay_yl,
        firstPaidEventId: earlierPaid.event_id,
        firstPaidCaseId: earlierPaid.medical_case_id,
        firstPaidServiceCode: earlierPaid.item_code,
        firstPaidExamTime: earlierPaid.ngay_yl,
        firstPaidBHYTAmount: parseNumber(earlierPaid.t_bhtt),
        declaredRate,
        expectedRate: configuredRate,
      });
    }

    if (violations.length) {
      return makeResult(
        rule, "FAIL", `Phát hiện ${violations.length} công khám YHCT sai tỷ lệ thanh toán theo cấu hình.`,
        violations, { checkedCount: checked, missingRateCount: missingRate }
      );
    }
    if (missingRate) {
      return makeResult(rule, "SKIP", "Thiếu TYLE_TT_DV của công khám YHCT cần đối chiếu.", [], {
        checkedCount: checked, missingRateCount: missingRate,
      });
    }
    return makeResult(rule, "PASS", "Không phát hiện sai tỷ lệ công khám YHCT thứ hai trong cùng ngày theo cấu hình.", [], {
      checkedCount: checked,
    });
  },
};
