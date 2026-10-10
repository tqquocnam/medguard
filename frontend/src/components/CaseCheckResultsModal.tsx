  import {
    Alert,
    Modal,
    Spin,
    Table,
    Typography,
  } from "antd";

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


  const {
    Text,
  } = Typography;


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

    details?: {
      violations?: unknown[];
      [key: string]: unknown;
    };

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

    caseId:
      | string
      | null;

    checkRunId?:
      | string
      | null;

    patientName?: string;

    patientCode?: string;

    onClose: () => void;
  }


  interface ErrorRow {
    key: string;
    content: string;
  }


  type Violation =
    Record<
      string,
      unknown
    >;


  function getValue(
    violation: Violation,
    ...keys: string[]
  ): unknown {

    for (
      const key
      of keys
    ) {

      const value =
        violation[key];

      if (
        value !== undefined &&
        value !== null
      ) {
        return value;
      }

    }

    return undefined;
  }


  function getString(
    violation: Violation,
    ...keys: string[]
  ): string {

    const value =
      getValue(
        violation,
        ...keys
      );

    if (
      value === undefined ||
      value === null
    ) {
      return "";
    }

    return String(
      value
    );
  }


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


  function formatViolation(
    rule: RuleResult,
    violation: Violation
  ): string {

    const displayMessage =
      getString(
        violation,
        "displayMessage"
      );

    if (
      displayMessage
    ) {
      return displayMessage;
    }


    if (
      rule.rule_code ===
      "STAFF_TIME_OVERLAP"
    ) {

      const staff =
        getString(
          violation,
          "staffCode",
          "staff_code",
          "doctorCode",
          "performerCode"
        );

      const sourceName =
        getString(
          violation,
          "sourceItemName",
          "itemName",
          "source_name"
        );

      const sourceTime =
        formatTime(
          getValue(
            violation,
            "sourceStart",
            "sourceTime",
            "startTime"
          )
        );

      const conflictPatient =
        getString(
          violation,
          "conflictPatientName",
          "patientName",
          "conflict_patient_name"
        );

      const conflictItem =
        getString(
          violation,
          "conflictItemName",
          "otherItemName",
          "conflict_name"
        );

      const conflictStart =
        formatTime(
          getValue(
            violation,
            "conflictStart",
            "otherStart"
          )
        );

      const conflictEnd =
        formatTime(
          getValue(
            violation,
            "conflictEnd",
            "otherEnd"
          )
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


    if (
      rule.rule_code ===
      "EXAM_MIN_TIME"
    ) {

      const name =
        getString(
          violation,
          "itemName",
          "examName"
        ) ||
        "Công khám";

      const start =
        formatTime(
          getValue(
            violation,
            "startTime"
          )
        );

      const end =
        formatTime(
          getValue(
            violation,
            "endTime"
          )
        );

      const minutes =
        getValue(
          violation,
          "durationMinutes",
          "minutes"
        );

      return (
        `${name}: ` +
        `${start}` +
        (
          end
            ? ` → ${end}`
            : ""
        ) +
        (
          minutes !== undefined
            ? ` (${String(minutes)} phút - thời gian khám không đủ)`
            : " (Thời gian khám không đủ)"
        )
      );
    }


    if (
      rule.rule_code ===
      "DRUG_ICD"
    ) {

      const drug =
        getString(
          violation,
          "drugName",
          "itemName",
          "drugCode"
        ) ||
        "Thuốc";

      const code =
        getString(
          violation,
          "drugCode",
          "itemCode"
        );

      return (
        `${code ? `${code} - ` : ""}` +
        `${drug}: Không phù hợp ICD của hồ sơ`
      );
    }


    if (
      rule.rule_code ===
      "SERVICE_ICD"
    ) {

      const service =
        getString(
          violation,
          "serviceName",
          "itemName",
          "serviceCode"
        ) ||
        "DVKT";

      const code =
        getString(
          violation,
          "serviceCode",
          "itemCode"
        );

      return (
        `${code ? `${code} - ` : ""}` +
        `${service}: Không phù hợp ICD của hồ sơ`
      );
    }


    if (
      rule.rule_code ===
      "SERVICE_DIAGNOSIS"
    ) {

      const type =
        getString(
          violation,
          "type"
        );

      const service =
        getString(
          violation,
          "serviceName",
          "itemName",
          "serviceCode"
        ) ||
        "DVKT";

      const code =
        getString(
          violation,
          "serviceCode",
          "itemCode"
        );

      if (
        type ===
        "SERVICE_DIAGNOSIS_MISSING"
      ) {
        return (
          `${service}` +
          `${code ? ` - ${code}` : ""}` +
          " thiếu chẩn đoán vào"
        );
      }

      return (
        `${service}` +
        `${code ? ` - ${code}` : ""}` +
        ": Không phù hợp chẩn đoán vào"
      );
    }


    if (
      rule.rule_code ===
      "STAFF_SCHEDULE"
    ) {

      const type =
        getString(
          violation,
          "type"
        );

      const staffName =
        getString(
          violation,
          "staffName"
        );

      const staffCode =
        getString(
          violation,
          "staffCode"
        );

      const activityTime =
        getString(
          violation,
          "activityTime"
        );

      const itemName =
        getString(
          violation,
          "itemName"
        );

      const scheduleStart =
        getString(
          violation,
          "scheduleStart"
        );

      const scheduleEnd =
        getString(
          violation,
          "scheduleEnd"
        );


      if (
        type ===
        "STAFF_SCHEDULE_MISSING"
      ) {

        return (
          `${staffName}` +
          `${staffCode ? ` (${staffCode})` : ""}` +
          `${itemName ? ` - ${itemName}` : ""}` +
          `${activityTime ? ` - ${activityTime}` : ""}` +
          " - Không có lịch làm việc đăng ký"
        );
      }


      if (
        type ===
        "STAFF_SCHEDULE_OFF"
      ) {

        return (
          `${staffName}` +
          `${staffCode ? ` (${staffCode})` : ""}` +
          `${activityTime ? ` - ${activityTime}` : ""}` +
          " - Có phát sinh hoạt động trong ngày đăng ký nghỉ"
        );
      }


      if (
        type ===
        "STAFF_SCHEDULE_OUTSIDE_TIME"
      ) {

        return (
          `${staffName}` +
          `${staffCode ? ` (${staffCode})` : ""}` +
          `${itemName ? ` - ${itemName}` : ""}` +
          `${activityTime ? ` - ${activityTime}` : ""}` +
          `${
            scheduleStart &&
            scheduleEnd
              ? ` - Ngoài giờ làm việc ${scheduleStart} - ${scheduleEnd}`
              : " - Ngoài giờ làm việc"
          }`
        );
      }
    }


    const violationMessage =
      getString(
        violation,
        "message"
      );

    if (
      violationMessage
    ) {
      return violationMessage;
    }


    return (
      rule.message ??
      rule.rule_name
    );
  }


  function buildErrorRows(
    rules: RuleResult[]
  ): ErrorRow[] {

    const rows:
      ErrorRow[] =
      [];

    const seen =
      new Set<
        string
      >();


    for (
      const rule
      of rules
    ) {

      if (
        rule.result !==
        "FAIL"
      ) {
        continue;
      }


      const rawViolations =
        rule.details
          ?.violations;


      const violations:
        Violation[] =
        Array.isArray(
          rawViolations
        )
          ? rawViolations.filter(
              (
                item
              ): item is Violation =>
                typeof item ===
                  "object" &&
                item !==
                  null
            )
          : [];


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


          const sourceEventId =
            getString(
              violation,
              "eventId",
              "sourceEventId",
              "source_event_id"
            );


          const conflictEventId =
            getString(
              violation,
              "conflictEventId",
              "otherEventId",
              "conflict_event_id"
            );


          let duplicateKey =
            "";


          if (
            sourceEventId &&
            conflictEventId
          ) {

            duplicateKey =
              [
                rule.rule_code,

                ...[
                  sourceEventId,
                  conflictEventId,
                ].sort(),
              ].join(
                "|"
              );

          } else {

            const sourceCase =
              getString(
                violation,
                "medicalCaseId",
                "sourceCaseId"
              );


            const conflictCase =
              getString(
                violation,
                "conflictCaseId",
                "otherCaseId"
              );


            if (
              sourceCase &&
              conflictCase
            ) {

              const itemCode =
                getString(
                  violation,
                  "itemCode",
                  "drugCode",
                  "serviceCode"
                );


              const startTime =
                getString(
                  violation,
                  "startTime",
                  "sourceStart"
                );


              duplicateKey =
                [
                  rule.rule_code,

                  ...[
                    sourceCase,
                    conflictCase,
                  ].sort(),

                  itemCode,

                  startTime,
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

            content:
              formatViolation(
                rule,
                violation
              ),

          });

        }


        continue;
      }


      rows.push({

        key:
          rule.id,

        content:
          rule.message ||
          rule.rule_name,

      });

    }


    return rows;
  }


  export default function CaseCheckResultsModal({
    open,
    caseId,
    checkRunId,
    patientName,
    patientCode,
    onClose,
  }: Props) {

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
      useState<
        ApiData |
        null
      >(
        null
      );


    const [
      error,
      setError,
    ] =
      useState<
        string |
        null
      >(
        null
      );


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


            const endpoint =
              checkRunId
                ? `/checks/runs/${checkRunId}/cases/${caseId}/results`
                : `/checks/cases/${caseId}/results`;


            const response =
              await apiFetch(
                endpoint,
                {
                  method:
                    "GET",

                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                }
              );


            if (
              response.status ===
              401
            ) {

              throw new Error(
                "Phiên đăng nhập đã hết. Vui lòng đăng nhập lại."
              );

            }


            if (
              response.status ===
              403
            ) {

              throw new Error(
                "Bạn không có quyền xem kết quả kiểm tra hồ sơ này."
              );

            }


            let json:
              {
                success?: boolean;
                message?: string;
                data?: ApiData;
              };


            try {

              json =
                await response.json();

            } catch {

              throw new Error(
                "Backend trả về dữ liệu không hợp lệ."
              );

            }


            if (
              !response.ok ||
              !json.success
            ) {

              throw new Error(
                json.message ||
                "Không thể tải kết quả kiểm tra."
              );

            }


            if (
              !json.data
            ) {

              throw new Error(
                "Backend không trả về kết quả kiểm tra."
              );

            }


            setData(
              json.data
            );

          } catch (
            loadError
          ) {

            console.error(
              "Load case check results error:",
              loadError
            );


            setError(
              loadError instanceof Error
                ? loadError.message
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
          checkRunId,
        ]
      );


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


    const rows =
      useMemo(
        () => {

          return buildErrorRows(
            data?.results ??
            []
          );

        },
        [
          data,
        ]
      );

return (

  <Modal
    open={
      open
    }

    onCancel={
      onClose
    }

    footer={
      null
    }

    width={
      1250
    }

    centered

    destroyOnHidden

    className="medguard-case-modal"

    styles={{
      mask: {
        backgroundColor:
          "rgba(15, 23, 42, 0.52)",

        backdropFilter:
          "blur(5px)",

        WebkitBackdropFilter:
          "blur(5px)",
      },

      header: {
        marginBottom:
          0,

        padding:
          "18px 20px 14px",

        borderBottom:
          "1px solid #edf0f5",

        background:
          "#ffffff",
      },

      body: {
        padding:
          "14px 20px 20px",

        maxHeight:
          "72vh",

        overflowY:
          "auto",
      },
    }}

title={
  <div
    style={{
      fontSize: 20,
      fontWeight: 700,
      color: "#258AFF",
      lineHeight: 1.4,
      paddingRight: 30,
      letterSpacing: "0.2px",
    }}
  >
    Chi tiết hồ sơ: {patientCode ? `${patientCode} - ` : ""}
    {patientName ?? ""}
  </div>
}
  >

    {
      loading && (

        <div
          style={{
            textAlign:
              "center",

            padding:
              "60px 20px",
          }}
        >

          <Spin
            size="large"
          />

          <div
            style={{
              marginTop:
                14,

              color:
                "#8c8c8c",
            }}
          >
            Đang tải kết quả kiểm tra...
          </div>

        </div>

      )
    }


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
        />

      )
    }


    {
      !loading &&
      !error &&
      rows.length >
        0 && (

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

          columns={[
            {
              title:
                "Nội dung",

              dataIndex:
                "content",

              render:
                (
                  value:
                    string
                ) => (

                  <Text
                    style={{
                      color:
                        "#303846",

                      lineHeight:
                        1.65,

                      whiteSpace:
                        "normal",
                    }}
                  >
                    {value}
                  </Text>

                ),
            },
          ]}

          rowClassName={(
            _,
            index
          ) =>
            index % 2 ===
              1
              ? "medguard-error-row-alt"
              : ""
          }
        />

      )
    }


    <style>
      {`
        .medguard-case-modal .ant-modal-content {
          border-radius: 14px !important;
          padding: 0 !important;
          overflow: hidden !important;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.32) !important;
        }

        .medguard-case-modal .ant-modal-header {
          margin-bottom: 0 !important;
        }

        .medguard-case-modal .ant-modal-body {
          scrollbar-width: thin;
        }

        .medguard-case-modal .ant-modal-close {
          top: 14px !important;
          inset-inline-end: 14px !important;
          border-radius: 8px !important;
        }

        .medguard-case-modal .ant-modal-close:hover {
          background: #f1f5f9 !important;
        }

        .medguard-error-row-alt td {
          background: #f7f9fc !important;
        }

        .medguard-case-modal .ant-table-thead > tr > th {
          background: #eef3f8 !important;
          font-weight: 600 !important;
          color: #172033 !important;
        }

        .medguard-case-modal .ant-table-tbody > tr > td {
          padding-top: 10px !important;
          padding-bottom: 10px !important;
          border-bottom: 1px solid #edf0f5 !important;
        }
      `}
    </style>

  </Modal>

);

  }