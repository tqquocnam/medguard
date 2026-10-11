import {
  Alert,
  Modal,
  Spin,
  Table,
  Tag,
  // Typography,
} from "antd";

import {
  CloseCircleFilled,
} from "@ant-design/icons";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import dayjs from "dayjs";

import {
  apiFetch,
} from "../api/apiClient";


// const {
//   Text,
// } = Typography;


// ======================================================
// TYPES
// ======================================================

interface RuleResult {
  id: string;

  result:
    | "PASS"
    | "FAIL"
    | "SKIP";

  severity:
    | "ERROR"
    | "WARNING"
    | "INFO";

  message?: string;

  issue_count?: number;

  details?: any;

  checked_at?: string;

  rule_code: string;

  rule_name: string;
}


interface ApiData {
  checkRunId:
    | string
    | null;

  checkedAt:
    | string
    | null;

  results:
    RuleResult[];
}


interface Props {
  open: boolean;

  caseId: string | null;

  checkRunId?: string | null;

  patientName?: string;

  patientCode?: string;

  onClose: () => void;
}


interface ErrorRow {
  key: string;

  ruleCode: string;

  ruleName: string;

  severity:
    | "ERROR"
    | "WARNING"
    | "INFO";

  content: string;
}


// ======================================================
// FORMAT TIME
// ======================================================

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
        ? `[${sourceName}: ${sourceTime} (Trùng thời gian)]`
        : sourceTime
          ? `[${sourceTime} (Trùng thời gian)]`
          : "(Trùng thời gian)",

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

export default function CaseCheckResultsModal({

  open,

  caseId,

  patientName,

  patientCode,

  onClose,

}: Props) {

  // ====================================================
  // STATE
  // ====================================================

  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );


  const [
    data,
    setData,
  ] =
    useState<ApiData | null>(
      null
    );


  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );


  // ====================================================
  // LOAD RESULTS
  // ====================================================

  const loadResults =
    useCallback(
      async () => {

        if (
          !caseId
        ) {

          return;
        }


        try {

          setLoading(
            true
          );


          setError(
            null
          );


          setData(
            null
          );


          const response =
            await apiFetch(
              `/checks/cases/${caseId}/results`,
              {
                method:
                  "GET",

                headers: {
                  "Content-Type":
                    "application/json",
                },
              }
            );


          // ==============================================
          // HẾT PHIÊN
          // ==============================================

          if (
            response.status ===
            401
          ) {

            throw new Error(
              "Phiên đăng nhập đã hết. Vui lòng đăng nhập lại."
            );
          }


          // ==============================================
          // KHÔNG CÓ QUYỀN
          // ==============================================

          if (
            response.status ===
            403
          ) {

            throw new Error(
              "Bạn không có quyền xem kết quả kiểm tra hồ sơ này."
            );
          }


          const json =
            await response.json();


          if (
            !response.ok ||
            !json.success
          ) {

            throw new Error(
              json.message ||
              "Không thể tải kết quả kiểm tra."
            );
          }


          setData(
            json.data
          );

        } catch (
          error
        ) {

          console.error(
            "Load case check results error:",
            error
          );


          setError(
            error instanceof
            Error
              ? error.message
              : "Không thể tải kết quả kiểm tra."
          );

        } finally {

          setLoading(
            false
          );
        }
      },
      [
        caseId,
      ]
    );


  // ====================================================
  // LOAD KHI MỞ MODAL
  // ====================================================

  useEffect(
    () => {

      if (
        !open ||
        !caseId
      ) {

        return;
      }


      const timer =
        window.setTimeout(
          () => {

            void loadResults();

          },
          0
        );


      return () => {

        window.clearTimeout(
          timer
        );
      };

    },
    [
      open,
      caseId,
      loadResults,
    ]
  );


  // ====================================================
  // ERROR ROWS
  // ====================================================

  const rows =
    useMemo(
      () =>
        buildErrorRows(
          data?.results ??
          []
        ),

      [
        data,
      ]
    );


  // ====================================================
  // SỐ NHÓM RULE BỊ LỖI
  // ====================================================

  // const failedRuleCount =
  //   useMemo(
  //     () =>
  //       new Set(
  //         rows.map(
  //           (
  //             row
  //           ) =>
  //             row.ruleCode
  //         )
  //       ).size,

  //     [
  //       rows,
  //     ]
  //   );


  // ====================================================
  // UI
  // ====================================================

  return (

<Modal
  open={open}
  onCancel={onClose}
  footer={null}

  width={1250}

  mask={true}

  styles={{
    mask: {
      backgroundColor: "rgba(15, 23, 42, 0.18)",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
    },
  }}

  destroyOnClose
  className="medguard-case-error-modal"

  title={
    <div className="case-error-title">
      <div className="case-error-title-icon">
        <CloseCircleFilled />
      </div>

      <div className="case-error-title-info">
        <div className="case-error-title-main">
          Chi tiết lỗi hồ sơ
        </div>

        <div className="case-error-patient">
          <span className="case-error-patient-code">
            {patientCode || "-"}
          </span>

          {patientName ? (
            <>
              <span className="case-error-patient-separator">
                -
              </span>

              <span className="case-error-patient-name">
                {patientName}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  }
>

      {/* =================================================
          LOADING
      ================================================= */}

      {
        loading && (

          <div
            className="case-error-loading"
          >
            <Spin
              size="large"
            />
          </div>

        )
      }


      {/* =================================================
          API ERROR
      ================================================= */}

      {
        !loading &&
        error && (

          <Alert
            type="error"

            showIcon

            message={
              error
            }
          />

        )
      }


      {/* =================================================
          KHÔNG CÓ LỖI
      ================================================= */}

      {
        !loading &&
        !error &&
        data &&
        rows.length ===
          0 && (

          <Alert
            type="success"

            showIcon

            message="Không phát hiện lỗi."

            description="Hồ sơ không có lỗi theo các quy luật kiểm tra hiện tại."
          />

        )
      }


      {/* =================================================
          DANH SÁCH LỖI
      ================================================= */}

      {
        !loading &&
        !error &&
        rows.length >
          0 && (

          <>

            {/* =============================================
                TÓM TẮT
            ============================================= */}

            {/* <div
              className="case-error-summary"
            >

              <div
                className="case-error-summary-left"
              >

                <CloseCircleFilled />


                <span>
                  Phát hiện
                </span>


                <strong>
                  {
                    rows.length
                  } lỗi
                </strong>

              </div>


              <div
                className="case-error-summary-right"
              >

                <SafetyCertificateOutlined />


                <span>
                  {
                    failedRuleCount
                  } nhóm quy luật
                </span>

              </div>

            </div> */}


            {/* =============================================
                TABLE
            ============================================= */}

            <Table<ErrorRow>
              rowKey="key"

              size="small"

              pagination={
                false
              }

              bordered={
                false
              }

              dataSource={
                rows
              }

              className="case-error-table"

              scroll={{
                y:
                  430,
              }}

              columns={[

                // =========================================
                // STT
                // =========================================

                {
                  title:
                    "#",

                  key:
                    "index",

                  width:
                    54,

                  align:
                    "center",

                  render:
                    (
                      _,
                      __,
                      index
                    ) => (

                      <div
                        className="case-error-number"
                      >
                        {
                          index +
                          1
                        }
                      </div>

                    ),
                },


                // =========================================
                // NHÓM LỖI
                // =========================================

                {
                  title:
                    "Nhóm lỗi",

                  dataIndex:
                    "ruleName",

                  key:
                    "ruleName",

                  width:
                    190,

                  render:
                    (
                      value:
                        string,

                      record:
                        ErrorRow
                    ) => (

                      <Tag
                        color={
                          record.severity ===
                          "WARNING"
                            ? "warning"
                            : record.severity ===
                              "INFO"
                              ? "blue"
                              : "error"
                        }

                        className="case-error-rule-tag"
                      >
                        {
                          value ||
                          record.ruleCode
                        }
                      </Tag>

                    ),
                },


                // =========================================
                // NỘI DUNG
                // =========================================

                {
                  title:
                    "Nội dung lỗi",

                  dataIndex:
                    "content",

                  key:
                    "content",

                  render:
                    (
                      value:
                        string
                    ) => (

                      <div
                        className="case-error-content"
                      >
                        {
                          value
                        }
                      </div>

                    ),
                },

              ]}
            />

          </>

        )
      }


      {/* =================================================
          STYLE
      ================================================= */}

      <style>
        {`

          /* ===============================================
             MODAL
          =============================================== */

          .medguard-case-error-modal
          .ant-modal-content {
            padding: 20px;
            border-radius: 12px;
            overflow: hidden;
          }


          .medguard-case-error-modal
          .ant-modal-header {
            margin-bottom: 16px;
            padding-bottom: 14px;
            border-bottom: 1px solid #edf0f5;
          }


          .medguard-case-error-modal
          .ant-modal-close {
            top: 17px;
            right: 17px;
          }


          /* ===============================================
             TITLE
          =============================================== */

          .case-error-title {
            display: flex;
            align-items: center;
            gap: 11px;
            padding-right: 34px;
          }


          .case-error-title-icon {
            width: 40px;
            height: 40px;

            display: flex;
            align-items: center;
            justify-content: center;

            flex-shrink: 0;

            border-radius: 10px;

            background: #fff1f0;
            color: #ff4d4f;

            font-size: 19px;
          }


          .case-error-title-info {
            min-width: 0;
          }


          .case-error-title-main {
            color: #172033;

            font-size: 17px;
            font-weight: 800;

            line-height: 1.3;
          }


          .case-error-patient {
            display: flex;
            align-items: center;
            gap: 5px;

            margin-top: 3px;

            color: #64748b;

            font-size: 12px;
            font-weight: 500;
          }


       .case-error-patient-code {
  color: #1677ff;

  font-size: 15px;
  font-weight: 800;

  line-height: 1.4;
}

.case-error-patient-name {
  color: #334155;

  font-size: 16px;
  font-weight: 800;

  line-height: 1.4;
  letter-spacing: 0.1px;
}

          .case-error-patient-separator {
            color: #94a3b8;
          }


          /* ===============================================
             LOADING
          =============================================== */

          .case-error-loading {
            display: flex;
            align-items: center;
            justify-content: center;

            min-height: 220px;
          }


          /* ===============================================
             SUMMARY
          =============================================== */

          .case-error-summary {
            display: flex;
            align-items: center;
            justify-content: space-between;

            gap: 12px;

            min-height: 46px;

            margin-bottom: 12px;
            padding: 9px 13px;

            border: 1px solid #ffccc7;
            border-radius: 9px;

            background: #fff7f6;
          }


          .case-error-summary-left {
            display: flex;
            align-items: center;
            gap: 7px;

            color: #cf1322;

            font-size: 13px;
          }


          .case-error-summary-left
          strong {
            font-size: 14px;
            font-weight: 800;
          }


          .case-error-summary-right {
            display: inline-flex;
            align-items: center;
            gap: 6px;

            padding: 4px 10px;

            border: 1px solid #f0f0f0;
            border-radius: 999px;

            background: #ffffff;

            color: #64748b;

            font-size: 12px;
            font-weight: 600;
          }


          /* ===============================================
             TABLE
          =============================================== */

          .case-error-table {
            overflow: hidden;

            border: 1px solid #e7ebf0;
            border-radius: 9px;
          }


          .case-error-table
          .ant-table {
            border-radius: 9px;
          }


          .case-error-table
          .ant-table-container {
            border-radius: 9px;
          }


          .case-error-table
          .ant-table-thead
          > tr
          > th {
            padding: 10px 12px !important;

            background: #f3f6f9 !important;

            color: #475569;

            font-size: 12px;
            font-weight: 700;

            border-bottom: 1px solid #e5eaf0 !important;
          }


          .case-error-table
          .ant-table-tbody
          > tr
          > td {
            padding: 10px 12px !important;

            background: #ffffff;

            border-bottom: 1px solid #edf0f5 !important;

            vertical-align: top;
          }


          .case-error-table
          .ant-table-tbody
          > tr:nth-child(even)
          > td {
            background: #fafbfc;
          }


          .case-error-table
          .ant-table-tbody
          > tr:hover
          > td {
            background: #fff8f7 !important;
          }


          .case-error-table
          .ant-table-tbody
          > tr:last-child
          > td {
            border-bottom: none !important;
          }


          /* ===============================================
             STT
          =============================================== */

          .case-error-number {
            width: 24px;
            height: 24px;

            display: inline-flex;
            align-items: center;
            justify-content: center;

            border-radius: 7px;

            background: #fff1f0;
            color: #cf1322;

            font-size: 11px;
            font-weight: 800;
          }


          /* ===============================================
             RULE TAG
          =============================================== */

          .case-error-rule-tag {
            max-width: 165px;

            margin: 0;

            overflow: hidden;

            border-radius: 6px;

            font-size: 11px;
            font-weight: 600;

            text-overflow: ellipsis;
            white-space: nowrap;
          }


          /* ===============================================
             CONTENT
          =============================================== */

          .case-error-content {
            color: #334155;

            font-size: 12.5px;
            font-weight: 500;

            line-height: 1.55;

            word-break: break-word;
          }


          /* ===============================================
             SCROLLBAR
          =============================================== */

          .case-error-table
          .ant-table-body::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }


          .case-error-table
          .ant-table-body::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 999px;
          }


          .case-error-table
          .ant-table-body::-webkit-scrollbar-track {
            background: #f8fafc;
          }


          /* ===============================================
             RESPONSIVE
          =============================================== */

          @media (max-width: 760px) {

            .case-error-summary {
              align-items: flex-start;
              flex-direction: column;
            }


            .case-error-title {
              align-items: flex-start;
            }


            .case-error-rule-tag {
              max-width: 120px;
            }

          }

        `}
      </style>

    </Modal>

  );
}