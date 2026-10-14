import {

  Alert,

  Button,

  Card,

  Col,

  Descriptions,

  Modal,

  Row,

  Select,

  Space,

  Statistic,

  Table,

  Tag,

  Typography,

  message,

} from "antd";



import {

  CheckCircleFilled,

  CloseCircleFilled,

  EyeOutlined,

  FileSearchOutlined,

  LoadingOutlined,

  PlayCircleOutlined,

  ReloadOutlined,

  SafetyCertificateOutlined,



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



import CaseCheckResultsModal

  from "../components/CaseCheckResultsModal";





const {

  Title,

  Text,

} = Typography;





type CheckStatus =

  | "READY"

  | "RUNNING"

  | "DONE"

  | "ERROR";





interface CheckDatasetItem {

  importBatchId: string;
  treatmentGroup: "GENERAL" | "YHCT" | null;



  fileName: string;



  facilityCode:

    string |

    null;



  dataDate: string;



  year: number;



  month: number;



  totalCases: number;



  importStatus: string;



  importStartedAt:

    string |

    null;



  importFinishedAt:

    string |

    null;



  checkStatus:

    CheckStatus;



  checkRunId:

    string |

    null;



  checkStartedAt:

    string |

    null;



  checkFinishedAt:

    string |

    null;



  errorCases: number;



  okCases: number;

}





interface DatasetResponse {

  success?: boolean;



  message?: string;



  data?: {

    items:

      CheckDatasetItem[];



    total:

      number;

  };

}





interface CheckRun {

  id: string;



  paymentDate:

    string |

    null;



  year:

    number |

    null;



  month:

    number |

    null;



  startedAt:

    string |

    null;



  finishedAt:

    string |

    null;



  status:

    | "PENDING"

    | "RUNNING"

    | "DONE"

    | "ERROR";



  totalCases:

    number;



  okCases:

    number;



  errorCases:

    number;



  errorMessage:

    string |

    null;

}





interface CheckRunErrorCase {

  id: string;



  maLk:

    string |

    null;



  maBn:

    string |

    null;



  hoTen:

    string |

    null;



  maTheBhyt:

    string |

    null;



  errorCount:

    number;

}





interface CheckRunResultData {

  run:

    CheckRun;



  errorCases:

    CheckRunErrorCase[];

}





interface CheckRunResultResponse {

  success?: boolean;



  message?: string;



  data?:

    CheckRunResultData;

}





function formatDate(

  value:

    string |

    null |

    undefined

) {

  if (!value) {

    return "-";

  }



  const date =

    dayjs(

      value

    );



  if (

    !date.isValid()

  ) {

    return String(

      value

    );

  }



  return date.format(

    "DD/MM/YYYY"

  );

}





function formatDateTime(

  value:

    string |

    null |

    undefined

) {

  if (!value) {

    return "-";

  }



  const date =

    dayjs(

      value

    );



  if (

    !date.isValid()

  ) {

    return String(

      value

    );

  }



  return date.format(

    "DD/MM/YYYY HH:mm:ss"

  );

}





const tagStyle:

  React.CSSProperties = {

    margin: 0,



    padding:

      "3px 9px",



    borderRadius:

      999,



    fontSize:

      11,



    fontWeight:

      700,



    lineHeight:

      "18px",

  };





function renderImportStatus(

  status:

    string

) {

  if (

    status ===

    "COMPLETED"

  ) {

    return (

      <Tag

        color="success"



        icon={

          <CheckCircleFilled />

        }



        style={

          tagStyle

        }

      >

        ĐÃ IMPORT

      </Tag>

    );

  }



  if (

    status ===

      "PROCESSING" ||

    status ===

      "RUNNING"

  ) {

    return (

      <Tag

        color="processing"



        icon={

          <LoadingOutlined

            spin

          />

        }



        style={

          tagStyle

        }

      >

        ĐANG IMPORT

      </Tag>

    );

  }



  return (

    <Tag

      color="error"



      icon={

        <CloseCircleFilled />

      }



      style={

        tagStyle

      }

    >

      {

        status ||

        "LỖI"

      }

    </Tag>

  );

}





function renderCheckStatus(

  status:

    CheckStatus

) {

  if (

    status ===

    "READY"

  ) {

    return (

      <Tag

        color="warning"



        style={

          tagStyle

        }

      >

        CHƯA KIỂM TRA

      </Tag>

    );

  }



  if (

    status ===

    "RUNNING"

  ) {

    return (

      <Tag

        color="processing"



        icon={

          <LoadingOutlined

            spin

          />

        }



        style={

          tagStyle

        }

      >

        ĐANG KIỂM TRA

      </Tag>

    );

  }



  if (

    status ===

    "DONE"

  ) {

    return (

      <Tag

        color="success"



        icon={

          <CheckCircleFilled />

        }



        style={

          tagStyle

        }

      >

        HOÀN TẤT

      </Tag>

    );

  }



  return (

    <Tag

      color="error"



      icon={

        <CloseCircleFilled />

      }



      style={

        tagStyle

      }

    >

      LỖI

    </Tag>

  );

}





export default function Checks() {

  const [

    year,

    setYear,

  ] =

    useState<number>(

      dayjs().year()

    );



  const [

    month,

    setMonth,

  ] =

    useState<number>(

      dayjs().month() +

        1

    );





  const [

    items,

    setItems,

  ] =

    useState<

      CheckDatasetItem[]

    >([]);





  const [

    loading,

    setLoading,

  ] =

    useState(

      false

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





  const [

    runningDatasetId,

    setRunningDatasetId,

  ] =

    useState<

      string |

      null

    >(

      null

    );





  const [

    resultOpen,

    setResultOpen,

  ] =

    useState(

      false

    );





  const [

    resultLoading,

    setResultLoading,

  ] =

    useState(

      false

    );





  const [

    resultError,

    setResultError,

  ] =

    useState<

      string |

      null

    >(

      null

    );





  const [

    selectedResult,

    setSelectedResult,

  ] =

    useState<

      CheckRunResultData |

      null

    >(

      null

    );





  const [

    selectedCase,

    setSelectedCase,

  ] =

    useState<

      CheckRunErrorCase |

      null

    >(

      null

    );





  const loadDatasets =

    useCallback(

      async (

        silent =

          false

      ) => {

        try {

          if (

            !silent

          ) {

            setLoading(

              true

            );

          }



          setError(

            null

          );





          const params =

            new URLSearchParams({

              year:

                String(

                  year

                ),



              month:

                String(

                  month

                ),

            });





          const response =

            await apiFetch(

              `/checks/datasets?${params.toString()}`,

              {

                method:

                  "GET",

              }

            );





          if (

            response.status ===

            401

          ) {

            return;

          }





          let json:

            DatasetResponse;





          try {

            json =

              await response.json();

          } catch {

            throw new Error(

              "Backend trả dữ liệu không hợp lệ."

            );

          }





          if (

            !response.ok ||

            json.success !==

              true

          ) {

            throw new Error(

              json.message ||

              "Không thể tải danh sách dữ liệu đã import."

            );

          }





          setItems(

            Array.isArray(

              json.data

                ?.items

            )

              ? json.data!.items

              : []

          );



        } catch (

          loadError

        ) {

          console.error(

            "Load check datasets error:",

            loadError

          );





          if (

            !silent

          ) {

            setError(

              loadError instanceof

              Error

                ? loadError.message

                : "Không thể tải dữ liệu kiểm tra."

            );

          }



        } finally {

          if (

            !silent

          ) {

            setLoading(

              false

            );

          }

        }

      },

      [

        year,

        month,

      ]

    );





  useEffect(

    () => {

      const timer =

        window.setTimeout(

          () => {

            void loadDatasets();

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

      loadDatasets,

    ]

  );





  const hasRunning =

    useMemo(

      () =>

        items.some(

          (

            item

          ) =>

            item.checkStatus ===

            "RUNNING"

        ),

      [

        items,

      ]

    );





  useEffect(

    () => {

      if (

        !hasRunning

      ) {

        return;

      }





      const timer =

        window.setInterval(

          () => {

            void loadDatasets(

              true

            );

          },

          2000

        );





      return () => {

        window.clearInterval(

          timer

        );

      };

    },

    [

      hasRunning,

      loadDatasets,

    ]

  );





  const summary =

    useMemo(

      () => {

        let totalCases =

          0;



        let okCases =

          0;



        let errorCases =

          0;





        for (

          const item

          of items

        ) {

          totalCases +=

            Number(

              item.totalCases ||

              0

            );



          if (

            item.checkStatus ===

            "DONE"

          ) {

            okCases +=

              Number(

                item.okCases ||

                0

              );



            errorCases +=

              Number(

                item.errorCases ||

                0

              );

          }

        }





        return {

          totalRuns:

            items.length,



          totalCases,



          okCases,



          errorCases,

        };

      },

      [

        items,

      ]

    );





  async function handleRunCheck(

    record:

      CheckDatasetItem

  ) {

    if (!record.treatmentGroup || record.totalCases === 0) {
      message.warning("Batch chưa phân loại hoặc không có hồ sơ để kiểm tra.");
      return;
    }
    try {

      setRunningDatasetId(

        record.importBatchId

      );





      setItems(

        (

          current

        ) =>

          current.map(

            (

              item

            ) =>

              item.importBatchId ===

              record.importBatchId

                ? {

                    ...item,



                    checkStatus:

                      "RUNNING",

                  }

                : item

          )

      );





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

                year:

                  record.year,



                month:

                  record.month,



                paymentDate:

                  record.dataDate,
                importBatchId: record.importBatchId,
                treatmentGroup: record.treatmentGroup,

              }),

          }

        );





      if (

        response.status ===

        401

      ) {

        return;

      }





      let json:

        {

          success?: boolean;



          message?: string;



          data?: {

            validation?: {

              checkRunId?:

                string;



              status?:

                string;



              totalCases?:

                number;



              errorCases?:

                number;



              okCases?:

                number;

            };

          };

        };





      try {

        json =

          await response.json();

      } catch {

        throw new Error(

          "Backend trả về dữ liệu kiểm tra không hợp lệ."

        );

      }





      if (

        !response.ok ||

        json.success !==

          true

      ) {

        throw new Error(

          json.message ||

          "Không thể kiểm tra dữ liệu."

        );

      }





      const validation =

        json.data

          ?.validation;





      if (

        validation

          ?.status ===

        "RUNNING"

      ) {

        message.success(

          `Đã bắt đầu kiểm tra ${validation.totalCases ?? record.totalCases} hồ sơ.`

        );



      } else if (

        validation

      ) {

        message.success(

          `Kiểm tra hoàn tất: ` +

          `${validation.totalCases ?? 0} hồ sơ, ` +

          `${validation.okCases ?? 0} TỐT, ` +

          `${validation.errorCases ?? 0} lỗi.`

        );



      } else {

        message.success(

          "Đã bắt đầu kiểm tra hồ sơ."

        );

      }





      await loadDatasets(

        true

      );



    } catch (

      runError

    ) {

      console.error(

        "Run dataset check error:",

        runError

      );





      message.error(

        runError instanceof

        Error

          ? runError.message

          : "Kiểm tra hồ sơ thất bại."

      );





      await loadDatasets(

        true

      );



    } finally {

      setRunningDatasetId(

        null

      );

    }

  }





  async function handleViewResult(

    runId:

      string

  ) {

    try {

      setResultOpen(

        true

      );



      setResultLoading(

        true

      );



      setResultError(

        null

      );



      setSelectedResult(

        null

      );



      setSelectedCase(

        null

      );





      const response =

        await apiFetch(

          `/checks/runs/${runId}/results`,

          {

            method:

              "GET",

          }

        );





      if (

        response.status ===

        401

      ) {

        return;

      }





      let json:

        CheckRunResultResponse;





      try {

        json =

          await response.json();

      } catch {

        throw new Error(

          "Backend trả kết quả kiểm tra không hợp lệ."

        );

      }





      if (

        !response.ok ||

        json.success !==

          true ||

        !json.data

      ) {

        throw new Error(

          json.message ||

          "Không thể tải kết quả kiểm tra."

        );

      }





      setSelectedResult(

        json.data

      );



    } catch (

      loadError

    ) {

      console.error(

        "Load check result error:",

        loadError

      );





      setResultError(

        loadError instanceof

        Error

          ? loadError.message

          : "Không thể tải kết quả kiểm tra."

      );



    } finally {

      setResultLoading(

        false

      );

    }

  }





  const errorCaseColumns = [

    {

      title:

        "Mã BN",



      dataIndex:

        "maBn",



      width:

        120,

    },



    {

      title:

        "Họ tên",



      dataIndex:

        "hoTen",



      width:

        200,



      render:

        (

          value:

            string |

            null,



          record:

            CheckRunErrorCase

        ) => (

          <Typography.Link

            style={{

              fontWeight:

                600,

            }}



            onClick={() =>

              setSelectedCase(

                record

              )

            }

          >

            {

              value ||

              "-"

            }

          </Typography.Link>

        ),

    },



    {

      title:

        "Mã thẻ BHYT",



      dataIndex:

        "maTheBhyt",



      width:

        180,

    },



    {

      title:

        "Mã liên kết",



      dataIndex:

        "maLk",



      width:

        300,



      ellipsis:

        true,

    },



   {

  title:

    "Số lỗi",



  dataIndex:

    "errorCount",



  width:

    120,



  align:

    "center" as const,



  render:

    (

      value:

        number,



      record:

        CheckRunErrorCase

    ) => (



      <Button

        type="link"



        danger



        size="small"



        icon={

          <CloseCircleFilled />

        }



        style={{

          padding:

            "0 10px",



          height:

            28,



          borderRadius:

            999,



          fontWeight:

            700,



          background:

            "#fff1f0",



          display:

            "inline-flex",



          alignItems:

            "center",



          gap:

            4,

        }}



        onClick={() =>

          setSelectedCase(

            record

          )

        }

      >

        Lỗi ({value})

      </Button>



    ),

},

  ];





  const columns = [
    {
      title: "Nhóm KCB",
      dataIndex: "treatmentGroup",
      width: 125,
      render: (value: CheckDatasetItem["treatmentGroup"]) =>
        <Tag color={value === "YHCT" ? "purple" : value === "GENERAL" ? "blue" : "default"}>
          {value === "YHCT" ? "YHCT" : value === "GENERAL" ? "Thông thường" : "Chưa phân loại"}
        </Tag>,
    },

    {

      title:

        "Ngày dữ liệu",



      dataIndex:

        "dataDate",



      width:

        135,



      render:

        (

          value:

            string

        ) => (

          <Text

            strong

          >

            {

              formatDate(

                value

              )

            }

          </Text>

        ),

    },



    {

      title:

        "Số hồ sơ",



      dataIndex:

        "totalCases",



      width:

        105,



      align:

        "center" as const,



      render:

        (

          value:

            number

        ) => (

          <span

            className="check-count-pill"

          >

            {value}

          </span>

        ),

    },



    {

      title:

        "Trạng thái Import",



      dataIndex:

        "importStatus",



      width:

        165,



      render:

        (

          value:

            string

        ) =>

          renderImportStatus(

            value

          ),

    },



    {

      title:

        "Trạng thái kiểm tra",



      dataIndex:

        "checkStatus",



      width:

        180,



      render:

        (

          value:

            CheckStatus

        ) =>

          renderCheckStatus(

            value

          ),

    },



    {

      title:

        "Hồ sơ TỐT",



      dataIndex:

        "okCases",



      width:

        115,



      align:

        "center" as const,



      render:

        (

          value:

            number,



          record:

            CheckDatasetItem

        ) =>

          record.checkStatus ===

          "DONE"

            ? (

              <span

                className="check-good-pill"

              >

                {value}

              </span>

            )

            : "-",

    },



    {

      title:

        "Hồ sơ lỗi",



      dataIndex:

        "errorCases",



      width:

        110,



      align:

        "center" as const,



      render:

        (

          value:

            number,



          record:

            CheckDatasetItem

        ) =>

          record.checkStatus ===

          "DONE"

            ? (

              <span

                className={

                  value > 0

                    ? "check-error-pill"

                    : "check-zero-pill"

                }

              >

                {value}

              </span>

            )

            : "-",

    },



    {

      title:

        "Bắt đầu kiểm tra",



      dataIndex:

        "checkStartedAt",



      width:

        185,



      render:

        formatDateTime,

    },



    {

      title:

        "Kết thúc kiểm tra",



      dataIndex:

        "checkFinishedAt",



      width:

        185,



      render:

        formatDateTime,

    },



    {

      title:

        "Thao tác",



      key:

        "actions",



      width:

        175,



      fixed:

        "right" as const,



      render:

        (

          _:

            unknown,



          record:

            CheckDatasetItem

        ) => {

          if (

            record.checkStatus ===

              "DONE" &&

            record.checkRunId

          ) {

            return (

              <Button

                type="primary"



                ghost



                size="small"



                icon={

                  <EyeOutlined />

                }



                style={{

                  borderRadius:

                    8,



                  fontWeight:

                    600,

                }}



                onClick={() =>

                  void handleViewResult(

                    record.checkRunId!

                  )

                }

              >

                Xem kết quả

              </Button>

            );

          }





          if (

            record.checkStatus ===

            "RUNNING"

          ) {

            return (

              <Button

                type="default"



                size="small"



                disabled



                icon={

                  <LoadingOutlined

                    spin

                  />

                }



                style={{

                  borderRadius:

                    8,

                }}

              >

                Đang kiểm tra

              </Button>

            );

          }





          return (

            <Button

              type={

                record.checkStatus ===

                "READY"

                  ? "primary"

                  : "default"

              }



              danger={

                record.checkStatus ===

                "ERROR"

              }



              size="small"



              icon={

                <PlayCircleOutlined />

              }



              loading={

                runningDatasetId ===

                record.importBatchId

              }



              disabled={

                record.importStatus !==

                "COMPLETED"

              }



              style={{

                borderRadius:

                  8,



                fontWeight:

                  600,

              }}



              onClick={() =>

                void handleRunCheck(

                  record

                )

              }

            >

              {

                record.checkStatus ===

                "ERROR"

                  ? "Kiểm tra lại"

                  : "Kiểm tra ngay"

              }

            </Button>

          );

        },

    },

  ];





  return (

    <div

      className="checks-page"

    >

      <div

        className="checks-header"

      >

        <div>

         <Typography.Title

  level={3}



  style={{

    margin: 0,



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

  <span

    style={{

      width:

        34,



      height:

        34,



      display:

        "inline-flex",



      alignItems:

        "center",



      justifyContent:

        "center",



      borderRadius:

        10,



      background:

        "#e6f4ff",



      color:

        "#1677ff",



      fontSize:

        18,

    }}

  >

    <SafetyCertificateOutlined />

  </span>



  Kiểm tra hồ sơ

</Typography.Title>



          <Text

            type="secondary"



            style={{

              display:

                "block",



              marginTop:

                4,

            }}

          >

            Theo dõi các đợt import và kết quả kiểm tra hồ sơ BHYT

          </Text>

        </div>





        {hasRunning && (

          <div

            className="checks-running-badge"

          >

            <LoadingOutlined

              spin

            />



            Hệ thống đang kiểm tra

          </div>

        )}

      </div>





      <Row

        gutter={[

          14,

          14,

        ]}



        className="checks-stat-grid"

      >

        <Col

          xs={24}

          sm={12}

          xl={6}

        >

          <Card

            className="checks-stat-card checks-stat-blue"

          >

            <Statistic

              title="Đợt dữ liệu"



              value={

                summary.totalRuns

              }



              prefix={

                <FileSearchOutlined />

              }

            />

          </Card>

        </Col>





        <Col

          xs={24}

          sm={12}

          xl={6}

        >

          <Card

            className="checks-stat-card checks-stat-slate"

          >

            <Statistic

              title="Tổng hồ sơ"



              value={

                summary.totalCases

              }



              prefix={

                <SafetyCertificateOutlined />

              }

            />

          </Card>

        </Col>





        <Col

          xs={24}

          sm={12}

          xl={6}

        >

          <Card

            className="checks-stat-card checks-stat-green"

          >

            <Statistic

              title="Hồ sơ TỐT"



              value={

                summary.okCases

              }



              valueStyle={{

                color:

                  "#389e0d",

              }}



              prefix={

                <CheckCircleFilled />

              }

            />

          </Card>

        </Col>





        <Col

          xs={24}

          sm={12}

          xl={6}

        >

          <Card

            className="checks-stat-card checks-stat-red"

          >

            <Statistic

              title="Hồ sơ lỗi"



              value={

                summary.errorCases

              }



              valueStyle={{

                color:

                  "#cf1322",

              }}



              prefix={

                <CloseCircleFilled />

              }

            />

          </Card>

        </Col>

      </Row>





      <Card

        className="checks-filter-card"

      >

        <div

          className="checks-filter-title"

        >

          <div>

            <Text

              strong

            >

              Bộ lọc dữ liệu

            </Text>



            <Text

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

              Chọn thời gian cần theo dõi

            </Text>

          </div>





          <Button

            type="primary"



            icon={

              <ReloadOutlined />

            }



            loading={

              loading

            }



            onClick={() =>

              void loadDatasets()

            }



            style={{

              borderRadius:

                8,



              fontWeight:

                600,

            }}

          >

            Làm mới

          </Button>

        </div>





        <Space

          wrap



          size={

            10

          }

        >

          <div>

            <Text

              className="checks-filter-label"

            >

              Năm

            </Text>



            <Select<number>

              value={

                year

              }



              style={{

                width:

                  140,

              }}



              onChange={(

                value

              ) => {

                setYear(

                  value

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

          </div>





          <div>

            <Text

              className="checks-filter-label"

            >

              Tháng

            </Text>



            <Select<number>

              value={

                month

              }



              style={{

                width:

                  140,

              }}



              onChange={(

                value

              ) => {

                setMonth(

                  value

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

          </div>

        </Space>

      </Card>





      {hasRunning && (

        <Alert

          type="info"



          showIcon



          message="Đang kiểm tra hồ sơ"



          description="Trang sẽ tự động cập nhật trạng thái mỗi 2 giây."



          style={{

            marginBottom:

              16,



            borderRadius:

              10,

          }}

        />

      )}





      {error && (

        <Alert

          type="error"



          showIcon



          message="Không tải được dữ liệu"



          description={

            error

          }



          style={{

            marginBottom:

              16,



            borderRadius:

              10,

          }}

        />

      )}





      <Card

        className="checks-table-card"



        styles={{

          body: {

            padding:

              0,

          },

        }}

      >

        <div

          className="checks-table-header"

        >

          <div>

            <Text

              strong



              style={{

                fontSize:

                  15,

              }}

            >

              Danh sách kiểm tra

            </Text>



            <Text

              type="secondary"



              style={{

                marginLeft:

                  8,



                fontSize:

                  12,

              }}

            >

              {

                items.length

              } đợt dữ liệu

            </Text>

          </div>



          <Text

            type="secondary"



            style={{

              fontSize:

                12,

            }}

          >

            Chọn “Xem kết quả” để xem chi tiết lỗi

          </Text>

        </div>





        <Table<CheckDatasetItem>

          rowKey="importBatchId"



          loading={

            loading

          }



          dataSource={

            items

          }



          columns={

            columns

          }



          size="middle"



          scroll={{

            x:

              1450,

          }}



          rowClassName={(

            record

          ) => {

            if (

              record.checkStatus ===

              "ERROR"

            ) {

              return "checks-row-error";

            }



            if (

              record.checkStatus ===

              "DONE" &&

              record.errorCases ===

              0

            ) {

              return "checks-row-good";

            }



            return "";

          }}



          pagination={{

            defaultPageSize:

              10,



            pageSizeOptions: [

              "10",

              "50",

              "100",

            ],



            showSizeChanger:

              true,



            showTotal:

              (

                value

              ) =>

                `Tổng số: ${value}`,

          }}

        />

      </Card>





      <Modal

        open={

          resultOpen

        }



        title={

          <div>

            <div

              style={{

                fontSize:

                  19,



                fontWeight:

                  800,



                color:

                  "#172033",

              }}

            >

              Kết quả kiểm tra hồ sơ

            </div>



            <div

              style={{

                marginTop:

                  3,



                fontSize:

                  12,



                fontWeight:

                  400,



                color:

                  "#64748b",

              }}

            >

              Tổng hợp kết quả của đợt kiểm tra

            </div>

          </div>

        }



        width={

          1200

        }



        footer={

          null

        }



        className="checks-result-modal"



styles={{

  body: {

    maxHeight:

      "78vh",



    overflowY:

      "auto",

  },

}}



        onCancel={() => {

          setResultOpen(

            false

          );



          setSelectedResult(

            null

          );



          setSelectedCase(

            null

          );



          setResultError(

            null

          );

        }}

      >

        {resultLoading && (

          <Alert

            type="info"



            showIcon



            message="Đang tải kết quả..."

          />

        )}





        {!resultLoading &&

          resultError && (

            <Alert

              type="error"



              showIcon



              message={

                resultError

              }

            />

          )}





        {!resultLoading &&

          !resultError &&

          selectedResult && (

            <>

              <Descriptions

                bordered



                size="small"



                column={

                  4

                }



                style={{

                  marginBottom:

                    20,

                }}

              >

                <Descriptions.Item

                  label="Ngày dữ liệu"

                >

                  {

                    formatDate(

                      selectedResult

                        .run

                        .paymentDate

                    )

                  }

                </Descriptions.Item>





                <Descriptions.Item

                  label="Năm"

                >

                  {

                    selectedResult

                      .run

                      .year ??

                    "-"

                  }

                </Descriptions.Item>





                <Descriptions.Item

                  label="Tháng"

                >

                  {

                    selectedResult

                      .run

                      .month ??

                    "-"

                  }

                </Descriptions.Item>





                <Descriptions.Item

                  label="Trạng thái"

                >

                  {

                    selectedResult

                      .run

                      .status ===

                    "DONE"

                      ? (

                        <Tag

                          color="success"



                          style={

                            tagStyle

                          }

                        >

                          HOÀN TẤT

                        </Tag>

                      )

                      : selectedResult

                          .run

                          .status

                  }

                </Descriptions.Item>





                <Descriptions.Item

                  label="Bắt đầu"



                  span={

                    2

                  }

                >

                  {

                    formatDateTime(

                      selectedResult

                        .run

                        .startedAt

                    )

                  }

                </Descriptions.Item>





                <Descriptions.Item

                  label="Kết thúc"



                  span={

                    2

                  }

                >

                  {

                    formatDateTime(

                      selectedResult

                        .run

                        .finishedAt

                    )

                  }

                </Descriptions.Item>

              </Descriptions>





              <Row

                gutter={[

                  14,

                  14,

                ]}



                style={{

                  marginBottom:

                    22,

                }}

              >

                <Col

                  xs={24}

                  md={8}

                >

                  <Card

                    className="checks-modal-stat"

                  >

                    <Statistic

                      title="Tổng hồ sơ"



                      value={

                        selectedResult

                          .run

                          .totalCases

                      }

                    />

                  </Card>

                </Col>





                <Col

                  xs={24}

                  md={8}

                >

                  <Card

                    className="checks-modal-stat"

                  >

                    <Statistic

                      title="Hồ sơ TỐT"



                      value={

                        selectedResult

                          .run

                          .okCases

                      }



                      valueStyle={{

                        color:

                          "#389e0d",

                      }}

                    />

                  </Card>

                </Col>





                <Col

                  xs={24}

                  md={8}

                >

                  <Card

                    className="checks-modal-stat"

                  >

                    <Statistic

                      title="Hồ sơ lỗi"



                      value={

                        selectedResult

                          .run

                          .errorCases

                      }



                      valueStyle={{

                        color:

                          "#cf1322",

                      }}

                    />

                  </Card>

                </Col>

              </Row>





              <div

                style={{

                  marginBottom:

                    12,

                }}

              >

                <Title

                  level={4}



                  style={{

                    margin:

                      0,

                  }}

                >

                  Danh sách hồ sơ lỗi

                </Title>



                <Text

                  type="secondary"



                  style={{

                    fontSize:

                      12,

                  }}

                >

                  Bấm vào họ tên hoặc số lỗi để xem chi tiết

                </Text>

              </div>





              {

                selectedResult

                  .errorCases

                  .length ===

                0

                  ? (

                    <Alert

                      type="success"



                      showIcon



                      message="Không có hồ sơ lỗi."

                    />

                  )

                  : (

                    <Table<CheckRunErrorCase>

                      rowKey="id"



                      size="small"



                      dataSource={

                        selectedResult

                          .errorCases

                      }



                      columns={

                        errorCaseColumns

                      }



                      pagination={{

                        defaultPageSize:

                          10,



                        pageSizeOptions: [

                          "10",

                          "50",

                          "100",

                        ],



                        showSizeChanger:

                          true,



                        showTotal:

                          (

                            value

                          ) =>

                            `Tổng hồ sơ lỗi: ${value}`,

                      }}



                      scroll={{

                        x:

                          950,

                      }}

                    />

                  )

              }

            </>

          )}

      </Modal>





      <CaseCheckResultsModal

        open={

          selectedCase !==

          null

        }



        caseId={

          selectedCase

            ?.id ??

          null

        }



        checkRunId={

          selectedResult

            ?.run

            .id ??

          null

        }



        patientCode={

          selectedCase

            ?.maBn ??

          ""

        }



        patientName={

          selectedCase

            ?.hoTen ??

          ""

        }



        onClose={() =>

          setSelectedCase(

            null

          )

        }

      />





      <style>

        {`

          .checks-page {

            display:

              flex;



            flex-direction:

              column;



            gap:

              16px;

          }



          .checks-header {

            display:

              flex;



            align-items:

              center;



            justify-content:

              space-between;



            gap:

              16px;

          }



          .checks-running-badge {

            display:

              inline-flex;



            align-items:

              center;



            gap:

              7px;



            padding:

              8px

              13px;



            border:

              1px solid

              #91caff;



            border-radius:

              999px;



            background:

              #e6f4ff;



            color:

              #1677ff;



            font-size:

              12px;



            font-weight:

              700;

          }



          .checks-stat-card {

            position:

              relative;



            overflow:

              hidden;



            border:

              1px solid

              #edf0f5;



            border-radius:

              14px;



            box-shadow:

              0

              4px

              18px

              rgba(

                15,

                23,

                42,

                0.04

              );



            transition:

              all

              0.2s

              ease;

          }



          .checks-stat-card:hover {

            transform:

              translateY(

                -2px

              );



            box-shadow:

              0

              8px

              24px

              rgba(

                15,

                23,

                42,

                0.08

              );

          }



          .checks-stat-card

          .ant-card-body {

            padding:

              17px

              18px;

          }



          .checks-stat-card

          .ant-statistic-title {

            margin-bottom:

              5px;



            color:

              #64748b;



            font-size:

              12px;

          }



          .checks-stat-card

          .ant-statistic-content {

            font-size:

              23px;



            font-weight:

              800;

          }



          .checks-stat-blue {

            border-left:

              4px solid

              #1677ff;

          }



          .checks-stat-slate {

            border-left:

              4px solid

              #64748b;

          }



          .checks-stat-green {

            border-left:

              4px solid

              #52c41a;

          }



          .checks-stat-red {

            border-left:

              4px solid

              #ff4d4f;

          }



          .checks-filter-card {

            border:

              1px solid

              #edf0f5;



            border-radius:

              14px;



            box-shadow:

              0

              4px

              18px

              rgba(

                15,

                23,

                42,

                0.04

              );

          }



          .checks-filter-card

          .ant-card-body {

            padding:

              15px;

          }



          .checks-filter-title {

            display:

              flex;



            align-items:

              center;



            justify-content:

              space-between;



            gap:

              12px;



            margin-bottom:

              13px;

          }



          .checks-filter-label {

            display:

              block;



            margin-bottom:

              6px;



            color:

              #475569;



            font-size:

              12px;



            font-weight:

              700;

          }



          .checks-table-card {

            overflow:

              hidden;



            border:

              1px solid

              #edf0f5;



            border-radius:

              14px;



            box-shadow:

              0

              4px

              18px

              rgba(

                15,

                23,

                42,

                0.04

              );

          }



          .checks-table-header {

            display:

              flex;



            align-items:

              center;



            justify-content:

              space-between;



            gap:

              12px;



            padding:

              14px

              16px;



            border-bottom:

              1px solid

              #edf0f5;

          }



          .checks-table-card

          .ant-table-thead

          > tr

          > th {

            background:

              #f8fafc !important;



            color:

              #334155 !important;



            font-size:

              12px;



            font-weight:

              700 !important;



            border-bottom:

              1px solid

              #e8edf3 !important;

          }



          .checks-table-card

          .ant-table-tbody

          > tr

          > td {

            color:

              #334155;



            font-size:

              12px;



            transition:

              background

              0.18s

              ease;

          }



          .checks-table-card

          .ant-table-tbody

          > tr:hover

          > td {

            background:

              #f5f9ff !important;

          }



          .checks-row-error

          > td:first-child {

            box-shadow:

              inset

              3px

              0

              0

              #ff4d4f;

          }



          .checks-row-good

          > td:first-child {

            box-shadow:

              inset

              3px

              0

              0

              #52c41a;

          }



          .check-count-pill {

            display:

              inline-flex;



            min-width:

              36px;



            justify-content:

              center;



            padding:

              3px

              9px;



            border-radius:

              999px;



            background:

              #f1f5f9;



            color:

              #334155;



            font-weight:

              700;

          }



          .check-good-pill {

            display:

              inline-flex;



            min-width:

              36px;



            justify-content:

              center;



            padding:

              3px

              9px;



            border-radius:

              999px;



            background:

              #f6ffed;



            color:

              #389e0d;



            font-weight:

              800;

          }



          .check-error-pill {

            display:

              inline-flex;



            min-width:

              36px;



            justify-content:

              center;



            padding:

              3px

              9px;



            border-radius:

              999px;



            background:

              #fff1f0;



            color:

              #cf1322;



            font-weight:

              800;

          }



          .check-zero-pill {

            display:

              inline-flex;



            min-width:

              36px;



            justify-content:

              center;



            padding:

              3px

              9px;



            border-radius:

              999px;



            background:

              #f6ffed;



            color:

              #389e0d;



            font-weight:

              800;

          }



          .checks-table-card

          .ant-pagination {

            padding:

              0

              16px

              12px;

          }



          .checks-modal-stat {

            border:

              1px solid

              #edf0f5;



            border-radius:

              12px;



            box-shadow:

              0

              3px

              12px

              rgba(

                15,

                23,

                42,

                0.04

              );

          }



          @media

          (

            max-width:

              800px

          ) {

            .checks-header,

            .checks-filter-title,

            .checks-table-header {

              align-items:

                flex-start;



              flex-direction:

                column;

            }

          }

            .checks-result-modal

.ant-modal-content {

  border-radius:

    16px;



  overflow:

    hidden;

}



.checks-result-modal

.ant-modal-header {

  margin-bottom:

    16px;

}



.checks-result-modal

.ant-modal-body {

  max-height:

    78vh;



  overflow-y:

    auto;

}

        `}

      </style>

    </div>

  );

}