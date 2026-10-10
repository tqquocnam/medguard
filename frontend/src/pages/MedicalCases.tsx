import {
  Alert,
  Button,
  Card,
  DatePicker,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";

import {
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  FileSearchOutlined,
  InfoCircleFilled,
  LoadingOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from "@ant-design/icons";

import {
  useQuery,
} from "@apollo/client/react";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useSearchParams,
} from "react-router-dom";

import dayjs from "dayjs";

import {
  GET_MEDICAL_CASES,
} from "../graphql/medicalCases";

import CaseCheckResultsModal
  from "../components/CaseCheckResultsModal";

import {
  apiFetch,
} from "../api/apiClient";


interface MedicalCase {
  id: string;

  ma_lk?: string;
  ma_bn?: string;
  ho_ten?: string;

  ma_the_bhyt?: string;
  gioi_tinh?: string;

  ma_loai_kcb?: string;

  ngay_vao?: string;
  ngay_ra?: string;
  ngay_ttoan?: string;

  t_tongchi?: number;
  t_bhtt?: number;
  t_bntt?: number;

  nam_qt?: number;
  thang_qt?: number;

  status?: string;

  error_count?: number;
}


interface QueryResult {
  core_medical_cases:
    MedicalCase[];

  core_medical_cases_aggregate: {
    aggregate: {
      count: number;

      sum: {
        t_tongchi?: number;
        t_bhtt?: number;
        t_bntt?: number;
      } | null;
    } | null;
  };
}


interface CheckProgress {
  processedCases: number;
  totalCases: number;
  remainingCases: number;
  percent: number;
  status: string;
}


function formatDate(
  value?: string
) {
  if (
    !value
  ) {
    return "";
  }

  return dayjs(
    value
  ).format(
    "DD/MM/YYYY HH:mm"
  );
}


function formatMoney(
  value?: number
) {
  return new Intl.NumberFormat(
    "vi-VN"
  ).format(
    Number(
      value ||
      0
    )
  );
}


function renderGender(
  value?: string
) {
  if (
    String(
      value
    ) ===
    "1"
  ) {
    return "Nam";
  }

  if (
    String(
      value
    ) ===
    "2"
  ) {
    return "Nữ";
  }

  return (
    value ||
    ""
  );
}


const pageStyle:
  React.CSSProperties = {
  display:
    "flex",

  flexDirection:
    "column",

  gap:
    16,
};


const panelStyle:
  React.CSSProperties = {
  borderRadius:
    14,

  border:
    "1px solid #edf0f5",

  boxShadow:
    "0 4px 18px rgba(15, 23, 42, 0.05)",

  background:
    "#ffffff",
};


const statusTagStyle:
  React.CSSProperties = {
  display:
    "inline-flex",

  alignItems:
    "center",

  justifyContent:
    "center",

  gap:
    5,

  minWidth:
    86,

  margin:
    0,

  padding:
    "4px 10px",

  borderRadius:
    999,

  fontSize:
    13,

  fontWeight:
    700,

  cursor:
    "default",

  userSelect:
    "none",
};


export default function MedicalCases() {
  const [
    searchParams,
  ] =
    useSearchParams();


  const [
    resultCase,
    setResultCase,
  ] =
    useState<
      MedicalCase |
      null
    >(
      null
    );


  const [
    paymentDate,
    setPaymentDate,
  ] =
    useState<
      string |
      undefined
    >();


  const [
    clearingPaymentDate,
    setClearingPaymentDate,
  ] =
    useState(
      false
    );


  const clearPaymentTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > |
      null
    >(
      null
    );


  const [
    checking,
    setChecking,
  ] =
    useState(
      false
    );


  const [
    checkProgress,
    setCheckProgress,
  ] =
    useState<CheckProgress>({
      processedCases:
        0,

      totalCases:
        0,

      remainingCases:
        0,

      percent:
        0,

      status:
        "IDLE",
    });


  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false
    );


  const [
    page,
    setPage,
  ] =
    useState(
      1
    );


  const [
    pageSize,
    setPageSize,
  ] =
    useState(
      10
    );


  const [
    maBn,
    setMaBn,
  ] =
    useState(
      ""
    );


  const [
    hoTen,
    setHoTen,
  ] =
    useState(
      ""
    );


  const [
    status,
    setStatus,
  ] =
    useState(
      "ALL"
    );


  const urlYear =
    searchParams.get(
      "year"
    );


  const urlMonth =
    searchParams.get(
      "month"
    );


  const [
    year,
    setYear,
  ] =
    useState<
      number |
      undefined
    >(
      urlYear &&
      !Number.isNaN(
        Number(
          urlYear
        )
      )
        ? Number(
            urlYear
          )
        : 2026
    );


  const [
    month,
    setMonth,
  ] =
    useState<
      number |
      undefined
    >(
      urlMonth &&
      !Number.isNaN(
        Number(
          urlMonth
        )
      )
        ? Number(
            urlMonth
          )
        : undefined
    );


  useEffect(
    () => {
      return () => {
        if (
          clearPaymentTimer.current
        ) {
          clearTimeout(
            clearPaymentTimer.current
          );
        }
      };
    },
    []
  );


  useEffect(
    () => {
      const yearParam =
        searchParams.get(
          "year"
        );

      const monthParam =
        searchParams.get(
          "month"
        );


      if (
        yearParam
      ) {
        const nextYear =
          Number(
            yearParam
          );

        if (
          !Number.isNaN(
            nextYear
          )
        ) {
          setYear(
            nextYear
          );
        }
      }


      if (
        monthParam
      ) {
        const nextMonth =
          Number(
            monthParam
          );

        if (
          !Number.isNaN(
            nextMonth
          )
        ) {
          setMonth(
            nextMonth
          );
        }
      } else {
        setMonth(
          undefined
        );
      }


      setPage(
        1
      );
    },
    [
      searchParams,
    ]
  );


  const where:
    Record<
      string,
      unknown
    > =
    {};


  if (
    maBn.trim()
  ) {
    where.ma_bn = {
      _ilike:
        `%${maBn.trim()}%`,
    };
  }


  if (
    hoTen.trim()
  ) {
    where.ho_ten = {
      _ilike:
        `%${hoTen.trim()}%`,
    };
  }


  if (
    status !==
    "ALL"
  ) {
    where.status = {
      _eq:
        status,
    };
  }


  if (
    year
  ) {
    where.nam_qt = {
      _eq:
        year,
    };
  }


  if (
    month
  ) {
    where.thang_qt = {
      _eq:
        month,
    };
  }


  if (
    paymentDate
  ) {
    const startDate =
      dayjs(
        paymentDate
      )
        .startOf(
          "day"
        )
        .format(
          "YYYY-MM-DDTHH:mm:ss"
        );


    const endDate =
      dayjs(
        paymentDate
      )
        .add(
          1,
          "day"
        )
        .startOf(
          "day"
        )
        .format(
          "YYYY-MM-DDTHH:mm:ss"
        );


    where.ngay_ttoan = {
      _gte:
        startDate,

      _lt:
        endDate,
    };
  }


  const {
    data,
    loading,
    error,
    refetch,
  } =
    useQuery<QueryResult>(
      GET_MEDICAL_CASES,
      {
        variables: {
          limit:
            pageSize,

          offset:
            (
              page -
              1
            ) *
            pageSize,

          where,
        },

        fetchPolicy:
          "network-only",
      }
    );


  async function handleRunChecks() {
    try {
      if (
        !year
      ) {
        message.warning(
          "Vui lòng chọn năm cần kiểm tra."
        );

        return;
      }


      setChecking(
        true
      );


      setCheckProgress({
        processedCases:
          0,

        totalCases:
          0,

        remainingCases:
          0,

        percent:
          0,

        status:
          "RUNNING",
      });


      const response =
        await apiFetch(
          "/checks/run",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                year,

                month:
                  month ??
                  null,

                paymentDate:
                  paymentDate ??
                  null,
              }),
          }
        );


      let json:
        any =
        null;


      try {
        json =
          await response.json();
      } catch {
        json =
          null;
      }


      if (
        !response.ok ||
        !json?.success
      ) {
        throw new Error(
          json?.message ||
          "Không thể bắt đầu kiểm tra dữ liệu."
        );
      }


      const validation =
        json
          ?.data
          ?.validation;


      const checkRunId =
        validation
          ?.checkRunId;


      if (
        !checkRunId
      ) {
        throw new Error(
          "Backend không trả về checkRunId."
        );
      }


      const totalCases =
        Number(
          validation
            ?.totalCases ??
          0
        );


      setCheckProgress({
        processedCases:
          0,

        totalCases,

        remainingCases:
          totalCases,

        percent:
          0,

        status:
          "RUNNING",
      });


      await new Promise<void>(
        (
          resolve,
          reject
        ) => {
          let stopped =
            false;


          const poll =
            async () => {
              if (
                stopped
              ) {
                return;
              }


              try {
                const progressResponse =
                  await apiFetch(
                    `/checks/runs/${checkRunId}/progress`
                  );


                let progressJson:
                  any =
                  null;


                try {
                  progressJson =
                    await progressResponse.json();
                } catch {
                  progressJson =
                    null;
                }


                if (
                  !progressResponse.ok ||
                  !progressJson?.success
                ) {
                  throw new Error(
                    progressJson?.message ||
                    "Không lấy được tiến độ kiểm tra."
                  );
                }


                const progress =
                  progressJson
                    ?.data
                    ?.progress;


                if (
                  !progress
                ) {
                  window.setTimeout(
                    poll,
                    400
                  );

                  return;
                }


                const nextProgress:
                  CheckProgress = {
                  processedCases:
                    Number(
                      progress
                        .processedCases ??
                      0
                    ),

                  totalCases:
                    Number(
                      progress
                        .totalCases ??
                      0
                    ),

                  remainingCases:
                    Number(
                      progress
                        .remainingCases ??
                      0
                    ),

                  percent:
                    Number(
                      progress
                        .percent ??
                      0
                    ),

                  status:
                    String(
                      progress
                        .status ??
                      "RUNNING"
                    ),
                };


                setCheckProgress(
                  nextProgress
                );


                if (
                  progress.status ===
                  "DONE"
                ) {
                  stopped =
                    true;


                  setCheckProgress({
                    processedCases:
                      Number(
                        progress
                          .totalCases ??
                        0
                      ),

                    totalCases:
                      Number(
                        progress
                          .totalCases ??
                        0
                      ),

                    remainingCases:
                      0,

                    percent:
                      100,

                    status:
                      "DONE",
                  });


                  resolve();

                  return;
                }


                if (
                  progress.status ===
                  "ERROR"
                ) {
                  stopped =
                    true;


                  reject(
                    new Error(
                      "Quá trình kiểm tra dữ liệu bị lỗi."
                    )
                  );

                  return;
                }


                window.setTimeout(
                  poll,
                  400
                );
              } catch (
                pollError
              ) {
                stopped =
                  true;

                reject(
                  pollError
                );
              }
            };


          void poll();
        }
      );


      message.success(
        "Kiểm tra dữ liệu hoàn tất."
      );


      await refetch();
    } catch (
      runError
    ) {
      console.error(
        "Run checks error:",
        runError
      );


      message.error(
        runError instanceof Error
          ? runError.message
          : "Kiểm tra dữ liệu thất bại."
      );
    } finally {
      setChecking(
        false
      );
    }
  }


  if (
    error
  ) {
    return (
      <Alert
        type="error"

        showIcon

        message="Không tải được hồ sơ"

        description={
          error.message
        }
      />
    );
  }


  const cases =
    data
      ?.core_medical_cases ??
    [];


  const aggregate =
    data
      ?.core_medical_cases_aggregate
      ?.aggregate;


  const total =
    aggregate
      ?.count ??
    0;


  const totalAmount =
    aggregate
      ?.sum
      ?.t_tongchi ??
    0;


  const totalBhyt =
    aggregate
      ?.sum
      ?.t_bhtt ??
    0;


  const totalPatient =
    aggregate
      ?.sum
      ?.t_bntt ??
    0;


  function handleReset() {
    if (
      refreshing
    ) {
      return;
    }


    setRefreshing(
      true
    );


    window.setTimeout(
      () => {
        setMaBn(
          ""
        );

        setHoTen(
          ""
        );

        setStatus(
          "ALL"
        );

        setYear(
          2026
        );

        setMonth(
          undefined
        );

        setPaymentDate(
          undefined
        );

        setPage(
          1
        );

        setRefreshing(
          false
        );
      },
      800
    );
  }


  function canOpenResult(
    record:
      MedicalCase
  ) {
    return (
      record.status ===
        "ERROR" ||
      record.status ===
        "WARNING" ||
      record.status ===
        "INCOMPLETE"
    );
  }


  function openResult(
    record:
      MedicalCase
  ) {
    if (
      !canOpenResult(
        record
      )
    ) {
      return;
    }


    setResultCase(
      record
    );
  }


  function renderCaseStatus(
    statusValue:
      string |
      undefined,

    record:
      MedicalCase
  ) {
    if (
      statusValue ===
      "ERROR"
    ) {
      return (
        <Tag
          icon={
            <CloseCircleFilled />
          }

          color="error"

          style={{
            ...statusTagStyle,

            cursor:
              "pointer",
          }}

          onClick={(
            event
          ) => {
            event.stopPropagation();

            openResult(
              record
            );
          }}
        >
          Lỗi
          {
            Number(
              record.error_count ??
              0
            ) >
            0
              ? ` (${record.error_count})`
              : ""
          }
        </Tag>
      );
    }


    if (
      statusValue ===
      "OK"
    ) {
      return (
        <Tag
          icon={
            <CheckCircleFilled />
          }

          color="success"

          style={{
            ...statusTagStyle,

            cursor:
              "default",
          }}
        >
          Tốt
        </Tag>
      );
    }


    if (
      statusValue ===
      "WARNING"
    ) {
      return (
        <Tag
          icon={
            <ExclamationCircleFilled />
          }

          color="warning"

          style={{
            ...statusTagStyle,

            cursor:
              "pointer",
          }}

          onClick={(
            event
          ) => {
            event.stopPropagation();

            openResult(
              record
            );
          }}
        >
          Cảnh báo
        </Tag>
      );
    }


    if (
      statusValue ===
      "INCOMPLETE"
    ) {
      return (
        <Tag
          icon={
            <InfoCircleFilled />
          }

          color="gold"

          style={{
            ...statusTagStyle,

            minWidth:
              140,

            cursor:
              "pointer",
          }}

          onClick={(
            event
          ) => {
            event.stopPropagation();

            openResult(
              record
            );
          }}
        >
          Chưa đủ cấu hình
        </Tag>
      );
    }


    if (
      statusValue ===
      "CHECKING"
    ) {
      return (
        <Tag
          icon={
            <LoadingOutlined />
          }

          color="processing"

          style={{
            ...statusTagStyle,

            cursor:
              "default",
          }}
        >
          Đang kiểm tra
        </Tag>
      );
    }


    return (
      <Tag
        icon={
          <InfoCircleFilled />
        }

        style={{
          ...statusTagStyle,

          color:
            "#64748b",

          background:
            "#f8fafc",

          borderColor:
            "#e2e8f0",

          cursor:
            "default",
        }}
      >
        Chưa kiểm tra
      </Tag>
    );
  }


  function statusFilterLabel(
    type:
      "OK" |
      "ERROR"
  ) {
    if (
      type ===
      "OK"
    ) {
      return (
        <Space
          size={
            7
          }
        >
          <CheckCircleFilled
            style={{
              color:
                "#52c41a",
            }}
          />

          <span>
            Tốt
          </span>
        </Space>
      );
    }


    return (
      <Space
        size={
          7
        }
      >
        <CloseCircleFilled
          style={{
            color:
              "#ff4d4f",
          }}
        />

        <span>
          Lỗi
        </span>
      </Space>
    );
  }


  return (
    <div
      style={
        pageStyle
      }
    >
      <div>
        <Typography.Title
          level={
            3
          }

          style={{
            margin:
              0,

            display:
              "flex",

            alignItems:
              "center",

            gap:
              10,

            fontWeight:
              800,

            color:
              "#172033",
          }}
        >
          <FileSearchOutlined
            style={{
              color:
                "#1677ff",

              fontSize:
                23,
            }}
          />

          Danh sách hồ sơ
        </Typography.Title>


        <Typography.Text
          type="secondary"

          style={{
            display:
              "block",

            marginTop:
              4,
          }}
        >
          Theo dõi và kiểm tra dữ liệu hồ sơ khám chữa bệnh BHYT
        </Typography.Text>
      </div>


      <div
        className="medguard-stat-grid"

        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(4, minmax(170px, 1fr))",

          gap:
            14,
        }}
      >
        <Card
          styles={{
            body: {
              padding:
                "16px 18px",
            },
          }}

          style={{
            ...panelStyle,

            borderLeft:
              "4px solid #ff4d4f",
          }}
        >
          <Typography.Text
            type="secondary"
          >
            Tổng hồ sơ
          </Typography.Text>

          <div
            style={{
              marginTop:
                5,

              fontSize:
                24,

              lineHeight:
                1.2,

              fontWeight:
                800,

              color:
                "#d4380d",
            }}
          >
            {total}
          </div>
        </Card>


        <Card
          styles={{
            body: {
              padding:
                "16px 18px",
            },
          }}

          style={{
            ...panelStyle,

            borderLeft:
              "4px solid #1677ff",
          }}
        >
          <Typography.Text
            type="secondary"
          >
            Tổng chi
          </Typography.Text>

          <div
            style={{
              marginTop:
                5,

              fontSize:
                21,

              lineHeight:
                1.2,

              fontWeight:
                800,

              color:
                "#1677ff",
            }}
          >
            {
              formatMoney(
                totalAmount
              )
            }
          </div>
        </Card>


        <Card
          styles={{
            body: {
              padding:
                "16px 18px",
            },
          }}

          style={{
            ...panelStyle,

            borderLeft:
              "4px solid #faad14",
          }}
        >
          <Typography.Text
            type="secondary"
          >
            Tổng BHYT
          </Typography.Text>

          <div
            style={{
              marginTop:
                5,

              fontSize:
                21,

              lineHeight:
                1.2,

              fontWeight:
                800,

              color:
                "#d48806",
            }}
          >
            {
              formatMoney(
                totalBhyt
              )
            }
          </div>
        </Card>


        <Card
          styles={{
            body: {
              padding:
                "16px 18px",
            },
          }}

          style={{
            ...panelStyle,

            borderLeft:
              "4px solid #52c41a",
          }}
        >
          <Typography.Text
            type="secondary"
          >
            Tổng BNTT
          </Typography.Text>

          <div
            style={{
              marginTop:
                5,

              fontSize:
                21,

              lineHeight:
                1.2,

              fontWeight:
                800,

              color:
                "#389e0d",
            }}
          >
            {
              formatMoney(
                totalPatient
              )
            }
          </div>
        </Card>
      </div>


      <Card
        style={
          panelStyle
        }

        styles={{
          body: {
            padding:
              16,
          },
        }}
      >
        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "space-between",

            gap:
              12,

            marginBottom:
              14,
          }}
        >
          <div>
            <Typography.Text
              strong

              style={{
                fontSize:
                  15,
              }}
            >
              Bộ lọc hồ sơ
            </Typography.Text>

            <Typography.Text
              type="secondary"

              style={{
                display:
                  "block",

                marginTop:
                  2,

                fontSize:
                  12,
              }}
            >
              Tìm nhanh theo bệnh nhân, trạng thái và thời gian
            </Typography.Text>
          </div>
        </div>


        <Space
          wrap

          size={
            10
          }
        >
          <Input
            value={
              maBn
            }

            placeholder="Mã BN"

            allowClear

            prefix={
              <SearchOutlined
                style={{
                  color:
                    "#bfbfbf",
                }}
              />
            }

            style={{
              width:
                150,
            }}

            onChange={(
              event
            ) => {
              setMaBn(
                event
                  .target
                  .value
              );

              setPage(
                1
              );
            }}
          />


          <Input
            value={
              hoTen
            }

            placeholder="Họ tên"

            allowClear

            prefix={
              <SearchOutlined
                style={{
                  color:
                    "#bfbfbf",
                }}
              />
            }

            style={{
              width:
                180,
            }}

            onChange={(
              event
            ) => {
              setHoTen(
                event
                  .target
                  .value
              );

              setPage(
                1
              );
            }}
          />


          <Select
            value={
              status
            }

            style={{
              width:
                170,
            }}

            onChange={(
              value
            ) => {
              setStatus(
                value
              );

              setPage(
                1
              );
            }}

            options={[
              {
                value:
                  "ALL",

                label:
                  "Tất cả trạng thái",
              },

              {
                value:
                  "OK",

                label:
                  statusFilterLabel(
                    "OK"
                  ),
              },

              {
                value:
                  "ERROR",

                label:
                  statusFilterLabel(
                    "ERROR"
                  ),
              },
            ]}
          />


          <Select
            value={
              year
            }

            allowClear

            placeholder="Năm"

            style={{
              width:
                100,
            }}

            onChange={(
              value
            ) => {
              setYear(
                value
              );

              setPage(
                1
              );
            }}

            options={[
              {
                value:
                  2026,

                label:
                  "2026",
              },

              {
                value:
                  2025,

                label:
                  "2025",
              },

              {
                value:
                  2024,

                label:
                  "2024",
              },
            ]}
          />


          <Select
            value={
              month
            }

            allowClear

            placeholder="Tháng"

            style={{
              width:
                110,
            }}

            onChange={(
              value
            ) => {
              setMonth(
                value
              );

              setPage(
                1
              );
            }}

            options={
              Array.from(
                {
                  length:
                    12,
                },

                (
                  _,
                  index
                ) => ({
                  value:
                    index +
                    1,

                  label:
                    `Tháng ${index + 1}`,
                })
              )
            }
          />


          <div
            style={{
              position:
                "relative",

              width:
                175,

              transition:
                "all 0.35s ease",

              opacity:
                clearingPaymentDate
                  ? 0.55
                  : 1,

              transform:
                clearingPaymentDate
                  ? "scale(0.98)"
                  : "scale(1)",
            }}
          >
            <DatePicker
              value={
                paymentDate
                  ? dayjs(
                      paymentDate
                    )
                  : null
              }

              placeholder={
                clearingPaymentDate
                  ? "Đang bỏ lọc..."
                  : "Ngày thanh toán"
              }

              format="DD/MM/YYYY"

              allowClear

              disabled={
                clearingPaymentDate
              }

              style={{
                width:
                  "100%",
              }}

              onChange={(
                date
              ) => {
                if (
                  date
                ) {
                  if (
                    clearPaymentTimer.current
                  ) {
                    clearTimeout(
                      clearPaymentTimer.current
                    );
                  }


                  setClearingPaymentDate(
                    false
                  );


                  setPaymentDate(
                    date.format(
                      "YYYY-MM-DD"
                    )
                  );


                  setPage(
                    1
                  );

                  return;
                }


                if (
                  !paymentDate
                ) {
                  return;
                }


                setClearingPaymentDate(
                  true
                );


                if (
                  clearPaymentTimer.current
                ) {
                  clearTimeout(
                    clearPaymentTimer.current
                  );
                }


                clearPaymentTimer.current =
                  window.setTimeout(
                    () => {
                      setPaymentDate(
                        undefined
                      );


                      setClearingPaymentDate(
                        false
                      );


                      setPage(
                        1
                      );


                      clearPaymentTimer.current =
                        null;
                    },
                    1200
                  );
              }}
            />
          </div>


          <Button
            icon={
              <ReloadOutlined
                className={
                  refreshing
                    ? "medguard-refresh-spin"
                    : ""
                }
              />
            }

            disabled={
              refreshing
            }

            onClick={
              handleReset
            }

            style={{
              borderRadius:
                8,

              fontWeight:
                600,

              minWidth:
                115,

              transition:
                "all 0.25s ease",

              transform:
                refreshing
                  ? "scale(0.97)"
                  : "scale(1)",

              opacity:
                refreshing
                  ? 0.78
                  : 1,
            }}
          >
            {
              refreshing
                ? "Đang làm mới..."
                : "Làm mới"
            }
          </Button>


          <Button
            type="primary"

            icon={
              checking
                ? (
                  <LoadingOutlined />
                )
                : (
                  <SafetyCertificateOutlined />
                )
            }

            loading={
              checking
            }

            onClick={
              handleRunChecks
            }

            style={{
              borderRadius:
                8,

              fontWeight:
                700,

              paddingInline:
                18,

              boxShadow:
                "0 4px 12px rgba(22,119,255,0.22)",
            }}
          >
            {
              checking
                ? "Đang kiểm tra..."
                : "Kiểm tra dữ liệu"
            }
          </Button>
        </Space>
      </Card>


      <Card
        style={
          panelStyle
        }

        styles={{
          body: {
            padding:
              0,
          },
        }}
      >
        <div
          style={{
            padding:
              "14px 16px",

            display:
              "flex",

            justifyContent:
              "space-between",

            alignItems:
              "center",

            borderBottom:
              "1px solid #f0f0f0",
          }}
        >
          <div>
            <Typography.Text
              strong

              style={{
                fontSize:
                  15,
              }}
            >
              Hồ sơ khám chữa bệnh
            </Typography.Text>

            <Typography.Text
              type="secondary"

              style={{
                marginLeft:
                  8,

                fontSize:
                  12,
              }}
            >
              {total} hồ sơ
            </Typography.Text>
          </div>


          <Typography.Text
            type="secondary"

            style={{
              fontSize:
                12,
            }}
          >
            Hồ sơ có lỗi hoặc cảnh báo có thể bấm để xem chi tiết
          </Typography.Text>
        </div>


        <Table<MedicalCase>
          rowKey="id"

          loading={
            loading
          }

          dataSource={
            cases
          }

          size="middle"

          scroll={{
            x:
              1500,
          }}

          rowClassName={(
            record
          ) => {
            if (
              record.status ===
              "ERROR"
            ) {
              return "medguard-row-error";
            }


            if (
              record.status ===
              "OK"
            ) {
              return "medguard-row-ok";
            }


            return "";
          }}

          pagination={{
            current:
              page,

            pageSize,

            total,

            showSizeChanger:
              true,

            pageSizeOptions: [
              "10",
              "50",
              "100",
            ],

            showTotal:
              (
                value
              ) =>
                `Tổng số: ${value}`,

            onChange:
              (
                newPage,
                newPageSize
              ) => {
                if (
                  newPageSize !==
                  pageSize
                ) {
                  setPageSize(
                    newPageSize
                  );

                  setPage(
                    1
                  );

                  return;
                }


                setPage(
                  newPage
                );
              },
          }}

          columns={[
            {
              title:
                "Trạng thái",

              dataIndex:
                "status",

              width:
                145,

              fixed:
                "left",

              render:
                (
                  value,
                  record
                ) =>
                  renderCaseStatus(
                    value,
                    record
                  ),
            },

            {
              title:
                "Mã BN",

              dataIndex:
                "ma_bn",

              width:
                110,

              render:
                (
                  value
                ) => (
                  <Typography.Text
                    strong
                  >
                    {value}
                  </Typography.Text>
                ),
            },

            {
              title:
                "Họ và tên",

              dataIndex:
                "ho_ten",

              width:
                190,

              render:
                (
                  value,
                  record
                ) => {
                  if (
                    !canOpenResult(
                      record
                    )
                  ) {
                    return (
                      <Typography.Text
                        style={{
                          fontWeight:
                            600,

                          color:
                            "#334155",

                          cursor:
                            "default",
                        }}
                      >
                        {value}
                      </Typography.Text>
                    );
                  }


                  return (
                    <Typography.Link
                      style={{
                        fontWeight:
                          600,
                      }}

                      onClick={(
                        event
                      ) => {
                        event.stopPropagation();

                        openResult(
                          record
                        );
                      }}
                    >
                      {value}
                    </Typography.Link>
                  );
                },
            },

            {
              title:
                "Mã thẻ",

              dataIndex:
                "ma_the_bhyt",

              width:
                170,
            },

            {
              title:
                "Giới tính",

              dataIndex:
                "gioi_tinh",

              width:
                90,

              render:
                renderGender,
            },

            {
              title:
                "Loại KCB",

              dataIndex:
                "ma_loai_kcb",

              width:
                100,
            },

            {
              title:
                "Ngày vào",

              dataIndex:
                "ngay_vao",

              width:
                160,

              render:
                formatDate,
            },

            {
              title:
                "Ngày ra",

              dataIndex:
                "ngay_ra",

              width:
                160,

              render:
                formatDate,
            },

            {
              title:
                "Tổng chi",

              dataIndex:
                "t_tongchi",

              align:
                "right",

              width:
                130,

              render:
                (
                  value
                ) => (
                  <Typography.Text
                    strong
                  >
                    {
                      formatMoney(
                        value
                      )
                    }
                  </Typography.Text>
                ),
            },

            {
              title:
                "Bệnh nhân TT",

              dataIndex:
                "t_bntt",

              align:
                "right",

              width:
                130,

              render:
                formatMoney,
            },

            {
              title:
                "Bảo hiểm TT",

              dataIndex:
                "t_bhtt",

              align:
                "right",

              width:
                130,

              render:
                (
                  value
                ) => (
                  <Typography.Text
                    style={{
                      color:
                        "#1677ff",

                      fontWeight:
                        600,
                    }}
                  >
                    {
                      formatMoney(
                        value
                      )
                    }
                  </Typography.Text>
                ),
            },

            {
              title:
                "Ngày thanh toán",

              dataIndex:
                "ngay_ttoan",

              width:
                170,

              render:
                formatDate,
            },
          ]}
        />
      </Card>


      <style>
        {`
          .ant-table-thead > tr > th {
            background: #f8fafc !important;
            color: #334155 !important;
            font-weight: 700 !important;
            border-bottom: 1px solid #e8edf3 !important;
          }

          .ant-table-tbody > tr > td {
            transition: background 0.18s ease;
          }

          .ant-table-tbody > tr:hover > td {
            background: #f5f9ff !important;
          }

          .medguard-row-error > td:first-child {
            box-shadow: inset 3px 0 0 #ff4d4f;
          }

          .medguard-row-ok > td:first-child {
            box-shadow: inset 3px 0 0 #52c41a;
          }

          .ant-pagination {
            padding: 0 16px 12px;
          }

          @media (max-width: 1100px) {
            .medguard-stat-grid {
              grid-template-columns:
                repeat(
                  2,
                  minmax(
                    180px,
                    1fr
                  )
                ) !important;
            }
          }

          .medguard-refresh-spin {
            animation:
              medguardRefreshSpin
              0.75s
              linear
              infinite;
          }

          @keyframes medguardRefreshSpin {
            from {
              transform:
                rotate(0deg);
            }

            to {
              transform:
                rotate(360deg);
            }
          }

          .medguard-checking-screen {
            position: fixed;
            inset: 0;
            z-index: 99999;

            display: flex;
            align-items: center;
            justify-content: center;

            background:
              rgba(
                15,
                23,
                42,
                0.12
              );

            backdrop-filter:
              blur(2px);

            -webkit-backdrop-filter:
              blur(2px);

            animation:
              medguardCheckingBackdrop
              2.8s
              ease-in-out
              infinite;
          }

          .medguard-checking-card {
            position: relative;

            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;

            width: 360px;

            padding:
              34px
              38px
              30px;

            border-radius:
              22px;

            background:
              rgba(
                255,
                255,
                255,
                0.96
              );

            border:
              1px solid
              rgba(
                255,
                255,
                255,
                0.8
              );

            box-shadow:
              0
              28px
              80px
              rgba(
                15,
                23,
                42,
                0.22
              ),
              0
              8px
              24px
              rgba(
                15,
                23,
                42,
                0.08
              );

            animation:
              medguardCheckingCard
              2.4s
              ease-in-out
              infinite;
          }

          .medguard-checking-orbit {
            position: relative;

            width: 90px;
            height: 90px;

            margin-bottom:
              20px;
          }

          .medguard-checking-ring {
            position: absolute;
            border-radius: 50%;
          }

          .medguard-checking-ring-a {
            inset: 0;

            border:
              4px solid
              rgba(
                22,
                119,
                255,
                0.12
              );

            border-top-color:
              #1677ff;

            border-right-color:
              #4096ff;

            animation:
              medguardCheckingSpin
              1.05s
              linear
              infinite;
          }

          .medguard-checking-ring-b {
            inset: 11px;

            border:
              3px solid
              rgba(
                22,
                119,
                255,
                0.08
              );

            border-left-color:
              #91caff;

            border-bottom-color:
              #69b1ff;

            animation:
              medguardCheckingSpinReverse
              1.55s
              linear
              infinite;
          }

          .medguard-checking-core {
            position: absolute;

            inset: 23px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 50%;

            color:
              #ffffff;

            font-size:
              24px;

            background:
              linear-gradient(
                135deg,
                #1677ff 0%,
                #4096ff 55%,
                #69b1ff 100%
              );

            box-shadow:
              0
              10px
              25px
              rgba(
                22,
                119,
                255,
                0.34
              );

            animation:
              medguardCheckingCore
              1.8s
              ease-in-out
              infinite;
          }

          .medguard-checking-title {
            font-size: 19px;
            font-weight: 800;
            color: #172033;
          }

          .medguard-checking-subtitle {
            margin-top: 7px;
            font-size: 13px;
            color: #64748b;
          }

          .medguard-checking-count {
            margin-top: 16px;

            display: flex;
            align-items: baseline;
            justify-content: center;

            gap: 5px;

            color: #334155;

            font-size: 15px;
            font-weight: 700;
          }

          .medguard-checking-count-current {
            color: #1677ff;
            font-size: 18px;
            font-weight: 800;
          }

          .medguard-checking-percent {
            margin-top: 5px;

            color: #1677ff;

            font-size: 28px;
            font-weight: 800;
          }

          .medguard-checking-progress {
            position: relative;

            width: 240px;
            height: 7px;

            margin-top: 15px;

            overflow: hidden;

            border-radius: 999px;

            background:
              #e8eef7;
          }

          .medguard-checking-progress-bar {
            position: absolute;

            top: 0;
            left: 0;
            bottom: 0;

            border-radius: 999px;

            background:
              linear-gradient(
                90deg,
                #1677ff,
                #4096ff,
                #69b1ff
              );

            transition:
              width
              0.35s
              ease;
          }

          .medguard-checking-remaining {
            margin-top: 9px;

            color: #64748b;

            font-size: 12px;
            font-weight: 500;
          }

          .medguard-checking-remaining strong {
            color: #334155;
            font-weight: 800;
          }

          .medguard-checking-dots {
            display: flex;

            gap: 6px;

            margin-top: 15px;
          }

          .medguard-checking-dots span {
            width: 7px;
            height: 7px;

            border-radius: 50%;

            background:
              #1677ff;

            animation:
              medguardCheckingDot
              1.2s
              ease-in-out
              infinite;
          }

          .medguard-checking-dots span:nth-child(2) {
            animation-delay:
              0.15s;
          }

          .medguard-checking-dots span:nth-child(3) {
            animation-delay:
              0.3s;
          }

          .medguard-checking-note {
            margin-top: 10px;

            font-size: 12px;

            color:
              #94a3b8;
          }

          @keyframes medguardCheckingBackdrop {
            0%,
            100% {
              background:
                rgba(
                  15,
                  23,
                  42,
                  0.10
                );

              backdrop-filter:
                blur(1px);

              -webkit-backdrop-filter:
                blur(1px);
            }

            50% {
              background:
                rgba(
                  15,
                  23,
                  42,
                  0.42
                );

              backdrop-filter:
                blur(6px);

              -webkit-backdrop-filter:
                blur(6px);
            }
          }

          @keyframes medguardCheckingCard {
            0%,
            100% {
              transform:
                translateY(0)
                scale(1);
            }

            50% {
              transform:
                translateY(-5px)
                scale(1.015);
            }
          }

          @keyframes medguardCheckingCore {
            0%,
            100% {
              transform:
                scale(1);
            }

            50% {
              transform:
                scale(1.12);
            }
          }

          @keyframes medguardCheckingSpin {
            from {
              transform:
                rotate(0deg);
            }

            to {
              transform:
                rotate(360deg);
            }
          }

          @keyframes medguardCheckingSpinReverse {
            from {
              transform:
                rotate(360deg);
            }

            to {
              transform:
                rotate(0deg);
            }
          }

          @keyframes medguardCheckingDot {
            0%,
            80%,
            100% {
              opacity: 0.25;

              transform:
                translateY(0)
                scale(0.85);
            }

            40% {
              opacity: 1;

              transform:
                translateY(-5px)
                scale(1);
            }
          }
        `}
      </style>


      <CaseCheckResultsModal
        open={
          resultCase !==
          null
        }

        caseId={
          resultCase?.id ??
          null
        }

        patientCode={
          resultCase?.ma_bn ??
          ""
        }

        patientName={
          resultCase?.ho_ten ??
          ""
        }

        onClose={() =>
          setResultCase(
            null
          )
        }
      />


      {checking && (
        <div
          className="medguard-checking-screen"
        >
          <div
            className="medguard-checking-card"
          >
            <div
              className="medguard-checking-orbit"
            >
              <div
                className="medguard-checking-ring medguard-checking-ring-a"
              />

              <div
                className="medguard-checking-ring medguard-checking-ring-b"
              />

              <div
                className="medguard-checking-core"
              >
                <SafetyCertificateOutlined />
              </div>
            </div>


            <div
              className="medguard-checking-title"
            >
              Đang kiểm tra dữ liệu
            </div>


            <div
              className="medguard-checking-subtitle"
            >
              Hệ thống đang đối chiếu hồ sơ BHYT
            </div>


            <div
              className="medguard-checking-count"
            >
              <span
                className="medguard-checking-count-current"
              >
                {
                  checkProgress
                    .processedCases
                }
              </span>

              <span>
                /
              </span>

              <span>
                {
                  checkProgress
                    .totalCases
                }
              </span>

              <span>
                hồ sơ
              </span>
            </div>


            <div
              className="medguard-checking-percent"
            >
              {
                Math.max(
                  0,
                  Math.min(
                    100,
                    checkProgress
                      .percent
                  )
                )
              }
              %
            </div>


            <div
              className="medguard-checking-progress"
            >
              <div
                className="medguard-checking-progress-bar"

                style={{
                  width:
                    `${Math.max(
                      0,
                      Math.min(
                        100,
                        checkProgress
                          .percent
                      )
                    )}%`,
                }}
              />
            </div>


            <div
              className="medguard-checking-remaining"
            >
              Còn lại{" "}

              <strong>
                {
                  checkProgress
                    .remainingCases
                }
              </strong>

              {" "}hồ sơ
            </div>


            <div
              className="medguard-checking-dots"
            >
              <span />
              <span />
              <span />
            </div>


            <div
              className="medguard-checking-note"
            >
              Vui lòng chờ trong giây lát
            </div>
          </div>
        </div>
      )}
    </div>
  );
}