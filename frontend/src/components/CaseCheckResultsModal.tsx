import { Alert, Button, Descriptions, Modal, Spin, Statistic, Table, Tag, Typography } from "antd";

import type { ColumnsType } from "antd/es/table";

import { CalendarOutlined, CloseCircleFilled, EyeOutlined } from "@ant-design/icons";

import { useEffect, useMemo, useState } from "react";

import dayjs from "dayjs";

import { apiFetch } from "../api/apiClient";

type RuleResult = {

  id: string;

  result: "PASS" | "FAIL" | "SKIP";

  severity: "ERROR" | "WARNING" | "INFO";

  message?: string;

  issue_count?: number;

  details?: any;

  checked_at?: string;

  rule_code: string;

  rule_name: string;

};

type ApiData = {

  checkRunId: string | null;

  checkedAt: string | null;

  results: RuleResult[];

};

type Props = {

  open: boolean;

  caseId: string | null;

  checkRunId?: string | null;

  patientName?: string;

  patientCode?: string;

  treatmentGroup?: string | null;

  onClose: () => void;

};

type ErrorRow = {

  key: string;

  ruleCode: string;

  ruleName: string;

  severity: "ERROR" | "WARNING" | "INFO";

  content: string;

  findingDate?: string;

};

function formatTime(

  value: unknown

) {

  if (

    !value

  ) {

    return "";

  }

  const date =

    dayjs(

      String(

        value

      )

    );

  if (

    !date.isValid()

  ) {

    return String(

      value

    );

  }

  return date.format(

    "DD/MM/YYYY HH:mm"

  );

}

// ======================================================

// TÊN NGẮN CỦA RULE

// ======================================================

function getRuleDisplayName(

  ruleCode: string,

  ruleName: string

) {

  switch (

    ruleCode

  ) {

    case "STAFF_TIME_OVERLAP":

      return "Trùng thời gian";

    case "EXAM_MIN_TIME":

      return "Thời gian khám";

    case "DRUG_ICD":

      return "Thuốc - ICD";

    case "SERVICE_ICD":

      return "DVKT - ICD";

    case "SERVICE_DIAGNOSIS":

      return "DVKT - Chẩn đoán";

    case "ICD_WARNING":

      return "ICD cảnh báo";

    default:

      return (

        ruleName ||

        ruleCode ||

        "Lỗi kiểm tra"

      );

  }

}

// ======================================================

// FORMAT VIOLATION

// ======================================================

function formatViolation(

  rule: RuleResult,

  violation: any

): string {

  // ====================================================

  // BACKEND ĐÃ FORMAT MESSAGE

  // ====================================================

  if (

    violation?.displayMessage

  ) {

    return String(

      violation.displayMessage

    );

  }

  // ====================================================

  // STAFF TIME OVERLAP

  // ====================================================

  if (

    rule.rule_code ===

    "STAFF_TIME_OVERLAP"

  ) {

    const staff =

      violation.staffCode ??

      violation.staff_code ??

      violation.doctorCode ??

      violation.performerCode ??

      "";

    const sourceName =

      violation.sourceItemName ??

      violation.itemName ??

      violation.source_name ??

      "";

    const sourceTime =

      formatTime(

        violation.sourceStart ??

        violation.sourceTime ??

        violation.startTime

      );

    const conflictPatient =

      violation.conflictPatientName ??

      violation.patientName ??

      violation.conflict_patient_name ??

      "";

    const conflictItem =

      violation.conflictItemName ??

      violation.otherItemName ??

      violation.conflict_name ??

      "";

    const conflictStart =

      formatTime(

        violation.conflictStart ??

        violation.otherStart

      );

    const conflictEnd =

      formatTime(

        violation.conflictEnd ??

        violation.otherEnd

      );

    return [

      staff,

      sourceName

        ? `[${sourceName}: ${sourceTime} (Trùng thời gian) với`

        : sourceTime

          ? `[${sourceTime} (Trùng thời gian) với`

          : "(Trùng thời gian)  với",

      conflictPatient,

      conflictItem

        ? `- ${conflictItem}:`

        : "",

      conflictStart &&

      conflictEnd

        ? `${conflictStart} → ${conflictEnd}`

        : conflictStart,

    ]

      .filter(

        Boolean

      )

      .join(

        " "

      );

  }

  // ====================================================

  // EXAM MIN TIME

  // ====================================================

  if (

    rule.rule_code ===

    "EXAM_MIN_TIME"

  ) {

    const name =

      violation.itemName ??

      violation.examName ??

      "Công khám";

    const start =

      formatTime(

        violation.startTime

      );

    const end =

      formatTime(

        violation.endTime

      );

    const minutes =

      violation.durationMinutes ??

      violation.minutes;

    return (

      `${name}: ` +

      `${start}` +

      (

        end

          ? ` → ${end}`

          : ""

      ) +

      (

        minutes !==

        undefined

          ? ` (${minutes} phút - thời gian khám không đủ)`

          : " (Thời gian khám không đủ)"

      )

    );

  }

  // ====================================================

  // DRUG ICD

  // ====================================================

  if (

    rule.rule_code ===

    "DRUG_ICD"

  ) {

    const drug =

      violation.drugName ??

      violation.itemName ??

      violation.drugCode ??

      "Thuốc";

    const code =

      violation.drugCode ??

      violation.itemCode ??

      "";

    return (

      `${code ? `${code} - ` : ""}` +

      `${drug}: Không phù hợp ICD của hồ sơ`

    );

  }

  // ====================================================

  // SERVICE ICD

  // ====================================================

  if (

    rule.rule_code ===

    "SERVICE_ICD"

  ) {

    const service =

      violation.serviceName ??

      violation.itemName ??

      violation.serviceCode ??

      "DVKT";

    const code =

      violation.serviceCode ??

      violation.itemCode ??

      "";

    return (

      `${code ? `${code} - ` : ""}` +

      `${service}: Không phù hợp ICD của hồ sơ`

    );

  }

  // ====================================================

  // SERVICE DIAGNOSIS

  // ====================================================

  if (

    rule.rule_code ===

    "SERVICE_DIAGNOSIS"

  ) {

    const service =

      violation.serviceName ??

      violation.itemName ??

      violation.serviceCode ??

      "DVKT";

    return (

      `${service}: ` +

      "Không phù hợp chẩn đoán vào"

    );

  }

  // ====================================================

  // FALLBACK

  // ====================================================

  if (

    violation?.message

  ) {

    return String(

      violation.message

    );

  }

  return (

    rule.message ??

    rule.rule_name

  );

}

// ======================================================

// BUILD ERROR ROWS

// ======================================================

function buildErrorRows(

  rules: RuleResult[]

): ErrorRow[] {

  const rows:

    ErrorRow[] = [];

  const seen =

    new Set<string>();

  for (

    const rule

    of rules

  ) {

    // ==================================================

    // CHỈ FAIL

    // ==================================================

    if (

      rule.result !==

      "FAIL"

    ) {

      continue;

    }

    const violations =

      Array.isArray(

        rule.details?.violations

      )

        ? rule.details.violations

        : [];

    // ==================================================

    // CÓ VIOLATIONS

    // ==================================================

    if (

      violations.length >

      0

    ) {

      for (

        let index = 0;

        index <

        violations.length;

        index++

      ) {

        const violation =

          violations[index];

        // ================================================

        // CHỐNG HIỂN THỊ TRÙNG

        // ================================================

        const sourceEventId =

          violation.eventId ??

          violation.sourceEventId ??

          violation.source_event_id ??

          "";

        const conflictEventId =

          violation.conflictEventId ??

          violation.otherEventId ??

          violation.conflict_event_id ??

          "";

        let duplicateKey =

          "";

        // ================================================

        // ƯU TIÊN EVENT ID

        // ================================================

        if (

          sourceEventId &&

          conflictEventId

        ) {

          duplicateKey =

            [

              rule.rule_code,

              ...[

                String(

                  sourceEventId

                ),

                String(

                  conflictEventId

                ),

              ].sort(),

            ].join(

              "|"

            );

        }

        // ================================================

        // FALLBACK CASE ID

        // ================================================

        else {

          const sourceCase =

            violation.medicalCaseId ??

            violation.sourceCaseId ??

            "";

          const conflictCase =

            violation.conflictCaseId ??

            violation.otherCaseId ??

            "";

          if (

            sourceCase &&

            conflictCase

          ) {

            duplicateKey =

              [

                rule.rule_code,

                ...[

                  String(

                    sourceCase

                  ),

                  String(

                    conflictCase

                  ),

                ].sort(),

                violation.itemCode ??

                violation.drugCode ??

                violation.serviceCode ??

                "",

                violation.startTime ??

                violation.sourceStart ??

                "",

              ].join(

                "|"

              );

          }

        }

        if (

          duplicateKey &&

          seen.has(

            duplicateKey

          )

        ) {

          continue;

        }

        if (

          duplicateKey

        ) {

          seen.add(

            duplicateKey

          );

        }

        rows.push({

          key:

            `${rule.id}-${index}`,

          ruleCode:

            rule.rule_code,

          ruleName:

            getRuleDisplayName(

              rule.rule_code,

              rule.rule_name

            ),

          severity:

            rule.severity,

          content:

            formatViolation(

              rule,

              violation

            ),

        });

      }

      continue;

    }

    // YHCT lưu từng phát hiện trong details.findings, không phải violations.

    const findings = Array.isArray(rule.details?.findings)

      ? rule.details.findings

      : [];

    if (findings.length > 0) {

      findings.forEach((finding: any, index: number) => {

        // Older YHCT_PERFORM_OVERLAP results lack finding.message.
        // Render each pair from structured details instead of repeating rule.message.
        const overlapDetail = rule.rule_code === "YHCT_PERFORM_OVERLAP" && finding?.currentCode && finding?.otherCode
          ? [
              finding.type === "SAME_MACHINE_OVERLAP"
                ? `Trùng thời gian sử dụng máy ${finding.machine || ""}`
                : finding.type === "DIRECT_STAFF_OVERLAP"
                  ? `Nhân viên ${finding.staff || ""} trùng thời gian thực hiện YHCT`
                  : `Hai kỹ thuật YHCT giao nhau (nhân viên ${finding.staff || "không rõ"})`,
              `${finding.currentCode} - ${finding.currentName || "DVKT"}: ${finding.currentStart || ""} → ${finding.currentEnd || ""}`,
              `Hồ sơ khác: ${finding.otherCode} - ${finding.otherName || "DVKT"}: ${finding.otherStart || ""} → ${finding.otherEnd || ""}`,
              `Chồng lấn ${finding.overlapMinutes ?? "?"} phút. Cần đối chiếu trước khi kết luận vi phạm.`,
            ].join(" | ")
          : "";
        const content = String(finding?.message || overlapDetail || finding?.note || rule.message || rule.rule_name);

        const date = String(finding?.date || "");

        const key = `${rule.rule_code}|${finding?.type || "FINDING"}|${date}|${content}`;

        if (seen.has(key)) return;

        seen.add(key);

        rows.push({

          key: `${rule.id}-finding-${index}`,

          ruleCode: rule.rule_code,

          ruleName: getRuleDisplayName(rule.rule_code, rule.rule_name),

          severity: rule.severity,

          content,

          findingDate: date || undefined,

        });

      });

      continue;

    }

    // ==================================================

    // FAIL KHÔNG CÓ VIOLATIONS

    // ==================================================

    rows.push({

      key:

        rule.id,

      ruleCode:

        rule.rule_code,

      ruleName:

        getRuleDisplayName(

          rule.rule_code,

          rule.rule_name

        ),

      severity:

        rule.severity,

      content:

        rule.message ||

        rule.rule_name,

    });

  }

  return rows;

}

// ======================================================

// COMPONENT

// ======================================================

type YhctDay = {

  date: string;

  status: "BOTH" | "XML3_ONLY" | "XML5_ONLY" | "NEITHER";

  serviceCount: number;

  progressCount: number;

  serviceCodes: string[];

  hasXml3Service: boolean;

  hasXml5Progress: boolean;

};

const YHCT_CODE = "YHCT_DAILY_TREATMENT_CONTINUITY";

const dayLabels: Record<YhctDay["status"], string> = {

  BOTH: "Có XML3 + XML5",

  XML3_ONLY: "Có DVKT, thiếu diễn biến",

  XML5_ONLY: "Có diễn biến, không có DVKT nhóm kiểm tra",

  NEITHER: "Không ghi nhận cả hai",

};

function validCalendar(raw: unknown): YhctDay[] {

  if (!Array.isArray(raw)) return [];

  return raw.filter((item): item is YhctDay =>

    item != null && typeof item === "object" &&

    typeof item.date === "string" &&

    ["BOTH", "XML3_ONLY", "XML5_ONLY", "NEITHER"].includes(item.status)

  );

}

function YhctTreatmentCalendar({ rule, preferredDate }: {

  rule: RuleResult;

  preferredDate?: string;

}) {

  const details = rule.details ?? {};

  const calendar = useMemo(() => validCalendar(details.calendar), [details.calendar]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {

    setSelectedDate(calendar.some(item => item.date === preferredDate) ? preferredDate! : (calendar.find(item => item.status === "XML3_ONLY")?.date || calendar[0]?.date || null));

  }, [preferredDate, rule.id, calendar]);

  const selected = calendar.find(item => item.date === selectedDate);

  const findings: any[] = Array.isArray(details.findings) ? details.findings : [];

  const selectedFindings = findings.filter(item => item.date === selectedDate ||

    (Array.isArray(item.missingDays) && item.missingDays.includes(selectedDate)));

  if (!calendar.length) {

    return <Alert type="info" showIcon message="Chưa có dữ liệu lịch điều trị của lần kiểm tra này." description="Hãy chạy lại Rule Check với bản mới của YHCT_DAILY_TREATMENT_CONTINUITY." />;

  }

  return (

    <section className="mg-yhct-panel" aria-label="Lịch điều trị YHCT">

      <div className="mg-yhct-heading">

        <CalendarOutlined /> <strong>Lịch điều trị Y học cổ truyền</strong>

        <Typography.Text type="secondary">{details.startDate || "-"} → {details.endDate || "-"}</Typography.Text>

      </div>

      <div className="mg-yhct-stats">

        <Statistic title="Tổng ngày" value={details.totalTreatmentDays ?? calendar.length} />

        <Statistic title="Ngày có XML3" value={details.daysWithXml3Service ?? 0} />

        <Statistic title="Ngày có XML5" value={details.daysWithXml5Progress ?? 0} />

        <Statistic title="Chỉ XML3" value={details.daysWithServiceOnly ?? 0} />

        <Statistic title="Thiếu cả hai" value={details.daysWithNeither ?? 0} />

      </div>

      <div className="mg-yhct-legend">

        <Tag color="success">Có XML3 + XML5</Tag>

        <Tag color="warning">Chỉ XML3</Tag>

        <Tag color="processing">Chỉ XML5</Tag>

        <Tag>Không ghi nhận</Tag>

      </div>

      <div className="mg-yhct-days">

        {calendar.map(item => {

          const active = item.date === selectedDate;

          return (

            <button key={item.date} type="button"

              className={`mg-yhct-day mg-yhct-${item.status.toLowerCase()} ${active ? "is-selected" : ""}`}

              onClick={() => setSelectedDate(item.date)}

              aria-pressed={active}

              title={dayLabels[item.status]}>

              <strong>{dayjs(item.date).format("DD/MM")}</strong>

              <small>{item.status === "BOTH" ? "XML3 + 5" : item.status === "XML3_ONLY" ? "Thiếu XML5" : item.status === "XML5_ONLY" ? "Chỉ XML5" : "Trống"}</small>

            </button>

          );

        })}

      </div>

      {selected && (

        <div className="mg-yhct-day-detail">

          <Typography.Title level={5} style={{ marginTop: 0 }}>Ngày {dayjs(selected.date).format("DD/MM/YYYY")}</Typography.Title>

          <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>

            <Descriptions.Item label="Trạng thái" span={2}>

              <Tag color={selected.status === "BOTH" ? "success" : selected.status === "XML3_ONLY" ? "warning" : selected.status === "XML5_ONLY" ? "processing" : "default"}>

                {dayLabels[selected.status]}

              </Tag>

            </Descriptions.Item>

            <Descriptions.Item label="Lượt DVKT XML3">{selected.serviceCount}</Descriptions.Item>

            <Descriptions.Item label="Bản ghi diễn biến XML5">{selected.progressCount}</Descriptions.Item>

            <Descriptions.Item label="Mã DVKT" span={2}>

              {selected.serviceCodes?.length ? selected.serviceCodes.map(code => <Tag key={code}>{code}</Tag>) : "Không có trong nhóm DVKT được cấu hình"}

            </Descriptions.Item>

          </Descriptions>

          {selectedFindings.map((finding, i) => (

            <Alert key={i} style={{ marginTop: 12 }} type="warning" showIcon message={String(finding.message || "Cần rà soát")} />

          ))}

          {selected.status === "NEITHER" && !selectedFindings.length && (

            <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>

              Chưa ghi nhận DVKT thuộc phạm vi kiểm tra hoặc diễn biến XML5 trong ngày. Không tự kết luận vi phạm BHYT.

            </Typography.Text>

          )}

        </div>

      )}

    </section>

  );

}

function renderOverlapContent(
  content: string,
  ruleCode: string
) {
  if (ruleCode !== "STAFF_TIME_OVERLAP") {
    return content;
  }

  // Backend co the tra displayMessage da duoc format.
  // Xu ly ngay tren noi dung thuc te, tranh bo qua displayMessage.
  const formattedContent = content
    .replace(/\(Trùng thời gian với\)/gi, "(Trùng thời gian) với")
    .replace(/\(Trùng thời gian\)\s+với(?=\s*\])/gi, "(Trùng thời gian) với")
    .replace(/\(Trùng thời gian\)(?!\s+với)/gi, "(Trùng thời gian) với")
    // Khong de dau ngoac dong chen giua 'voi' va ten benh nhan.
    .replace(/\(Trùng thời gian\) với\](?=\s+)/gi, "(Trùng thời gian) với");

  const timePattern = /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/g;
  const exactTimePattern = /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}$/;

  return formattedContent.split(timePattern).map((part, index) =>
    exactTimePattern.test(part) ? (
      <strong key={index} style={{ fontWeight: 700, color: "#111827" }}>
        {part}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

export default function CaseCheckResultsModal({

  open, caseId, checkRunId, patientName, patientCode, treatmentGroup, onClose,

}: Props) {

  const [data, setData] = useState<ApiData | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [calendarExpanded, setCalendarExpanded] = useState(false);

  const [preferredDate, setPreferredDate] = useState<string | undefined>();

  useEffect(() => {

    if (!open || !caseId) return;

    let cancelled = false;

    const load = async () => {

      setLoading(true);

      setData(null);

      setError(null);

      setCalendarExpanded(false);

      setPreferredDate(undefined);

      try {

        // Chỉ hiển thị kết quả đúng lần kiểm tra được chọn.

        const response = await apiFetch(`/checks/cases/${encodeURIComponent(caseId)}/results`, { method: "GET" });

        if (response.status === 401) throw new Error("Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.");

        if (response.status === 403) throw new Error("Bạn không có quyền xem kết quả hồ sơ này.");

        const json = await response.json();

        if (!response.ok || json.success !== true || !json.data) {

          throw new Error(json.message || "Không thể tải kết quả kiểm tra.");

        }

        const incoming = json.data as ApiData;

        if (checkRunId && incoming.checkRunId !== checkRunId) {

          throw new Error("API đang trả kết quả của lần kiểm tra khác. Cần hỗ trợ checkRunId trên backend trước khi hiển thị chi tiết để tránh lấy nhầm kết quả cũ.");

        }

        if (!cancelled) setData(incoming);

      } catch (e) {

        if (!cancelled) setError(e instanceof Error ? e.message : "Không thể tải kết quả.");

      } finally {

        if (!cancelled) setLoading(false);

      }

    };

    void load();

    return () => { cancelled = true; };

  }, [open, caseId, checkRunId]);

  const errorRows = useMemo(() => buildErrorRows(data?.results ?? []), [data]);

  const yhctRule = useMemo(() => data?.results.find(rule => rule.rule_code === YHCT_CODE), [data]);

  // If treatment_group was not selected by GET_MEDICAL_CASES,

  // recognize YHCT from the actual executed rule's scope.

  // A SKIP from GENERAL must NOT be treated as YHCT.

  const isYhct = treatmentGroup != null && treatmentGroup.trim() !== ""

    ? treatmentGroup.trim().toUpperCase() === "YHCT"

    : yhctRule?.details?.scope === "YHCT_MA_LOAI_KCB_02";

  const counts = useMemo(() => ({

    errors: errorRows.filter(row => row.severity === "ERROR").length,

    warnings: errorRows.filter(row => row.severity === "WARNING").length,

    info: errorRows.filter(row => row.severity === "INFO").length,

  }), [errorRows]);

  const columns: ColumnsType<ErrorRow> = [

    { title: "#", key: "index", width: 56, align: "center", render: (_value, _record, index) => index + 1 },

    { title: "Nhóm lỗi", dataIndex: "ruleName", key: "ruleName", width: 220,

      render: (value: string, record) => <Tag color={record.severity === "WARNING" ? "warning" : record.severity === "INFO" ? "blue" : "error"} style={{ whiteSpace: "normal", margin: 0 }}>{value || record.ruleCode}</Tag> },

{

  title: "Nội dung cảnh báo / lỗi",

  dataIndex: "content",

  key: "content",

  render: (value: string, record: ErrorRow) => (

    <span

      style={{

        whiteSpace: "pre-wrap",

        overflowWrap: "anywhere",

        lineHeight: 1.65,

      }}

    >

      {renderOverlapContent(value, record.ruleCode)}

    </span>

  ),

}

,

    // GENERAL has only the three columns above; YHCT keeps calendar actions.

    ...(isYhct ? [{

      title: "Chi tiết", key: "action", width: 130, align: "center" as const,

      render: (_value: unknown, record: ErrorRow) =>

        record.ruleCode === YHCT_CODE && yhctRule ? (

          <Button size="small" icon={<EyeOutlined />} onClick={() => {

            setPreferredDate(record.findingDate);

            setCalendarExpanded(true);

          }}>Xem lịch</Button>

        ) : null,

    }] : []),

  ];

  return (

    <Modal open={open} onCancel={onClose} footer={null} width={1000}

      destroyOnClose className="medguard-case-error-modal"

      style={{ top: "5vh", maxWidth: "calc(100vw - 24px)" }}

      styles={{

        mask: { backgroundColor: "rgba(15,23,42,.22)", backdropFilter: "blur(5px)" },

        body: { maxHeight: "calc(90dvh - 115px)", overflowY: "auto", overflowX: "hidden", paddingRight: 4 },

      }}

      title={<div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 32 }}>

        <CloseCircleFilled style={{ fontSize: 26, color: "#e05252" }} />

        <div style={{ minWidth: 0 }}>

          <div style={{ fontWeight: 700 }}>Chi tiết hồ sơ</div>

          <Typography.Text type="secondary" style={{ fontSize: 18, overflowWrap: "anywhere",fontWeight:700 }}>

            {patientCode || "-"}{patientName ? ` - ${patientName}` : ""}

          </Typography.Text>

        </div>

      </div>}>

      {loading && <div style={{ textAlign: "center", padding: 48 }}><Spin size="large" /></div>}

      {!loading && error && <Alert type="error" showIcon message={error} />}

      {!loading && !error && data && (

        <>

          {errorRows.length === 0 ? (

            <Alert type="success" showIcon message="Không phát hiện lỗi hoặc cảnh báo trong lần kiểm tra này." />

          ) : (

            <>

              <div className="mg-error-summary">

                <Tag color="error">{counts.errors} lỗi</Tag>

                <Tag color="warning">{counts.warnings} cảnh báo</Tag>

                {counts.info > 0 && <Tag color="processing">{counts.info} thông tin</Tag>}

              </div>

              <Table<ErrorRow> rowKey="key" size="small" bordered={false}

              columns={columns} dataSource={errorRows}

              pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ["10", "20", "50"], showTotal: total => `Tổng ${total} mục` }}

              scroll={{ x: isYhct ? 800 : 670 }} />

            </>

          )}

          {isYhct && yhctRule && validCalendar(yhctRule.details?.calendar).length > 0 && (

            <div style={{ marginTop: 14 }}>

              <Button type={calendarExpanded ? "default" : "primary"} ghost={!calendarExpanded}

                icon={<CalendarOutlined />} onClick={() => {

                  setPreferredDate(undefined);

                  setCalendarExpanded(v => !v);

                }}>

                {calendarExpanded ? "Thu gọn lịch điều trị YHCT" : "Xem lịch điều trị YHCT"}

              </Button>

              {calendarExpanded && <YhctTreatmentCalendar rule={yhctRule} preferredDate={preferredDate} />}

            </div>

          )}

        </>

      )}

      <style>{`

        .medguard-case-error-modal .ant-modal-content { border-radius: 14px; padding: 20px; }

        .medguard-case-error-modal .ant-table-wrapper { max-width: 100%; }

        .mg-error-summary { display:flex; gap:6px; flex-wrap:wrap; margin: 0 0 12px; }

        .mg-error-summary .ant-tag { margin:0; padding:3px 10px; border-radius:8px; font-weight:600; }

        .medguard-case-error-modal .ant-pagination { flex-wrap: wrap; row-gap: 10px; }

        .mg-yhct-panel { margin-top: 14px; padding: 14px; background: #fafcff; border: 1px solid #e5ebf5; border-radius: 12px; }

        .mg-yhct-heading { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }

        .mg-yhct-stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }

        .mg-yhct-stats .ant-statistic { padding: 10px; background: white; border-radius: 9px; border: 1px solid #edf0f4; }

        .mg-yhct-stats .ant-statistic-title { font-size: 12px; }

        .mg-yhct-stats .ant-statistic-content { font-size: 20px; }

        .mg-yhct-legend { display: flex; flex-wrap: wrap; gap: 7px; margin: 14px 0 10px; }

        .mg-yhct-days { display: grid; grid-template-columns: repeat(auto-fit, minmax(95px, 1fr)); gap: 9px; }

        .mg-yhct-day { border: 1px solid #e5e7eb; border-radius: 10px; min-height: 64px; padding: 8px; cursor: pointer; text-align: center; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; color:#243247; }

        .mg-yhct-day small { font-size: 11px; }

        .mg-yhct-both { background: #ecfdf3; border-color: #a7e7c0; }

        .mg-yhct-xml3_only { background: #fff7e8; border-color: #f8cf87; }

        .mg-yhct-xml5_only { background: #eaf5ff; border-color: #add6ff; }

        .mg-yhct-neither { background: #f5f5f5; }

        .mg-yhct-day.is-selected { outline: 2px solid #1677ff; outline-offset: 1px; }

        .mg-yhct-day-detail { background: white; padding: 14px; margin-top: 14px; border-radius: 10px; border: 1px solid #e9edf3; }

        @media(max-width: 760px) { .mg-yhct-stats { grid-template-columns: repeat(2,minmax(0,1fr)); } .medguard-case-error-modal .ant-modal-content { padding: 13px; } }

      `}</style>

    </Modal>

  );

}
