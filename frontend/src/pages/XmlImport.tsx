import {

  CheckCircleFilled,

  CloseCircleFilled,

  InboxOutlined,

} from "@ant-design/icons";



import {

  Alert,

  Button,

  Card,

  Descriptions,

  message,

  Progress,

  Space,

  Table,

  Tag,

  Typography,

  Upload,
  Radio,

} from "antd";



import type {

  UploadFile,

} from "antd";



import {

  useState,

} from "react";



import apiClient

  from "../api/apiClient";



const {

  Dragger,

} = Upload;



const {

  Title,

  Text,

} = Typography;



interface ValidationError {

  code: string;

  message: string;

}



interface MedicalCase {

  index: number;



  maLk?: string | null;

  maBn?: string | null;

  hoTen?: string | null;



  ngayVao?: string | null;

  ngayRa?: string | null;



  tongChi?:

    | string

    | number

    | null;



  xmlTypes?: string[];



  valid: boolean;



  errors:

    ValidationError[];

}



interface ValidationSummary {

  total: number;

  valid: number;

  invalid: number;

}



interface AnalyzeResult {

  facilityCode?: string;

  createdDate?: string;



  declaredTotal: number;

  actualTotal: number;



  summary:

    ValidationSummary;



  cases:

    MedicalCase[];

}



interface ImportProgress {

  percent?: number;



  status?:

    | "PENDING"

    | "RUNNING"

    | "DONE"

    | "ERROR"

    | string;



  message?: string;



  error?: string;

}



interface ApiErrorResponse {

  message?: string;



  data?:

    AnalyzeResult;

}



interface ApiErrorLike {

  response?: {

    status?: number;



    data?:

      ApiErrorResponse;

  };



  message?: string;

}



function getApiError(

  error:

    unknown

):

  ApiErrorLike {

  return error as

    ApiErrorLike;

}



function getApiErrorMessage(

  error:

    unknown,



  fallback:

    string

) {

  const apiError =

    getApiError(

      error

    );



  const status =

    apiError.response

      ?.status;



  if (

    status ===

    401

  ) {

    return (

      "Phiên đăng nhập đã hết. " +

      "Vui lòng đăng nhập lại."

    );

  }



  if (

    status ===

    403

  ) {

    return (

      "Bạn không có quyền thực hiện chức năng này."

    );

  }



  return (

    apiError.response

      ?.data

      ?.message ||



    apiError.message ||



    fallback

  );

}



type TreatmentGroup = "GENERAL" | "YHCT";

export default function XmlImport() {
  const [treatmentGroup, setTreatmentGroup] = useState<TreatmentGroup>("GENERAL");


  const [

    fileList,

    setFileList,

  ] =

    useState<

      UploadFile[]

    >([]);



  const [

    analyzing,

    setAnalyzing,

  ] =

    useState(

      false

    );



  const [

    importing,

    setImporting,

  ] =

    useState(

      false

    );



  const [

    result,

    setResult,

  ] =

    useState<

      AnalyzeResult |

      undefined

    >();



  const [

    canImport,

    setCanImport,

  ] =

    useState(

      false

    );



  const [

    importPercent,

    setImportPercent,

  ] =

    useState(

      0

    );



  function resetAnalysis() {

    setResult(

      undefined

    );



    setCanImport(

      false

    );



    setImportPercent(

      0

    );

  }



  async function handleAnalyze() {

    const file =

      fileList[0]

        ?.originFileObj;



    if (

      !file

    ) {

      message.warning(

        "Vui lòng chọn file XML"

      );



      return;

    }



    const formData =

      new FormData();



    formData.append(

      "file",

      file

    );
    formData.append("treatmentGroup", treatmentGroup);



    try {

      setAnalyzing(

        true

      );



      setCanImport(

        false

      );



      setImportPercent(

        0

      );



      const response =

        await apiClient.post(

          "/xml/analyze",

          formData

        );



      const data =

        response.data;



      setResult(

        data.data

      );



      setCanImport(

        data.canImport ===

        true

      );



      if (

        data.canImport ===

        true

      ) {

        message.success(

          "Toàn bộ dữ liệu XML hợp lệ. Có thể import."

        );

      } else {

        message.error(

          `Có ${

            data.data

              ?.summary

              ?.invalid ??

            0

          } hồ sơ bị lỗi. Không thể import.`

        );

      }

    } catch (

      error:

        unknown

    ) {

      const apiError =

        getApiError(

          error

        );



      const responseData =

        apiError.response

          ?.data;



      setCanImport(

        false

      );



      if (

        responseData?.data

      ) {

        setResult(

          responseData.data

        );

      }



      message.error(

        getApiErrorMessage(

          error,

          "Không thể xử lý file XML"

        )

      );

    } finally {

      setAnalyzing(

        false

      );

    }

  }



  async function waitForImport(

    importId:

      string

  ) {

    return new Promise<void>(

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

              const response =

                await apiClient.get(

                  `/xml/import-progress/${importId}`

                );



              const progress:

                ImportProgress |

                undefined =

                response.data

                  ?.data;



              if (

                !progress

              ) {

                window.setTimeout(

                  poll,

                  250

                );



                return;

              }



              const rawPercent =

                Number(

                  progress.percent ??

                  0

                );



              const percent =

                Number.isFinite(

                  rawPercent

                )

                  ? Math.max(

                      0,

                      Math.min(

                        100,

                        rawPercent

                      )

                    )

                  : 0;



              setImportPercent(

                percent

              );



              if (

                progress.status ===

                "DONE"

              ) {

                stopped =

                  true;



                setImportPercent(

                  100

                );



                message.success(

                  progress.message ||

                  "Import XML thành công."

                );



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

                    progress.error ||

                    progress.message ||

                    "Import XML thất bại."

                  )

                );



                return;

              }



              window.setTimeout(

                poll,

                250

              );

            } catch (

              error

            ) {

              stopped =

                true;



              reject(

                error

              );

            }

          };



        void poll();

      }

    );

  }



  async function handleImport() {

    const file =

      fileList[0]

        ?.originFileObj;



    if (

      !file

    ) {

      message.warning(

        "Vui lòng chọn file XML"

      );



      return;

    }



    if (

      !result ||

      !canImport

    ) {

      message.error(

        "Dữ liệu XML chưa đạt điều kiện để import."

      );



      return;

    }



    const formData =

      new FormData();



    formData.append(

      "file",

      file

    );
    formData.append("treatmentGroup", treatmentGroup);



    try {

      setImporting(

        true

      );



      setImportPercent(

        0

      );



      const response =

        await apiClient.post(

          "/xml/upload",

          formData

        );



      const importId =

        response.data

          ?.importId;



      if (

        !importId

      ) {

        throw new Error(

          "Backend không trả về importId."

        );

      }



      await waitForImport(

        String(

          importId

        )

      );

    } catch (

      error:

        unknown

    ) {

      setImportPercent(

        0

      );



      message.error(

        getApiErrorMessage(

          error,

          "Import XML thất bại"

        )

      );

    } finally {

      setImporting(

        false

      );

    }

  }



  const columns = [

    {

      title:

        "Trạng thái",



      width:

        120,



      render:

        (

          _:

            unknown,



          record:

            MedicalCase

        ) => {

          if (

            record.valid

          ) {

            return (

              <Tag

                color="success"



                icon={

                  <CheckCircleFilled />

                }



                className="xml-status-tag"

              >

                TỐT

              </Tag>

            );

          }



          return (

            <Tag

              color="error"



              icon={

                <CloseCircleFilled />

              }



              className="xml-status-tag"

            >

              Lỗi

            </Tag>

          );

        },

    },



    {

      title:

        "STT",



      dataIndex:

        "index",



      width:

        70,

    },



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

    },



    {

      title:

        "Mã liên kết",



      dataIndex:

        "maLk",



      width:

        280,

    },



    {

      title:

        "Ngày vào",



      dataIndex:

        "ngayVao",



      width:

        150,



      render:

        (

          value:

            | string

            | null

            | undefined

        ) =>

          value ||

          "-",

    },



    {

      title:

        "Ngày ra",



      dataIndex:

        "ngayRa",



      width:

        150,



      render:

        (

          value:

            | string

            | null

            | undefined

        ) =>

          value ||

          "-",

    },



    {

      title:

        "Tổng chi",



      dataIndex:

        "tongChi",



      width:

        120,



      render:

        (

          value:

            | string

            | number

            | null

            | undefined

        ) =>

          value ??

          "-",

    },



    {

      title:

        "XML",



      dataIndex:

        "xmlTypes",



      width:

        180,



      render:

        (

          value?:

            string[]

        ) =>

          value

            ?.join(

              ", "

            ) ||

          "-",

    },



    {

      title:

        "Nội dung lỗi",



      width:

        500,



      render:

        (

          _:

            unknown,



          record:

            MedicalCase

        ) => {

          if (

            record.valid

          ) {

            return (

              <Typography.Text

                type="success"

              >

                Không phát hiện lỗi

              </Typography.Text>

            );

          }



          return (

            <Space

              direction="vertical"



              size={

                2

              }

            >

              {

                record.errors.map(

                  (

                    error,

                    index

                  ) => (

                    <Typography.Text

                      type="danger"



                      key={

                        `${error.code}-${index}`

                      }

                    >

                      {

                        error.message

                      }

                    </Typography.Text>

                  )

                )

              }

            </Space>

          );

        },

    },

  ];



  return (

    <>

      <div

        className="xml-import-page"

      >

        <div

          className="xml-import-header"

        >

          <div>

            <Title

              level={

                3

              }



              style={{

                margin:

                  0,



                color:

                  "#172033",



                fontWeight:

                  800,

              }}

            >

              <InboxOutlined

                style={{

                  marginRight:

                    10,



                  color:

                    "#1677ff",

                }}

              />



              XML Import

            </Title>



            <Text

              type="secondary"



              style={{

                display:

                  "block",



                marginTop:

                  4,

              }}

            >

              Kiểm tra và import dữ liệu XML khám chữa bệnh BHYT

            </Text>

          </div>

        </div>



        <Card

          className="xml-upload-card"



          styles={{

            body: {

              padding:

                20,

            },

          }}

        >

          <div className="xml-treatment-selector">
            <Text strong>Chọn nhóm dữ liệu trước khi xử lý file XML</Text>
            <Radio.Group
              value={treatmentGroup}
              disabled={analyzing || importing}
              onChange={(e) => {
                setTreatmentGroup(e.target.value as TreatmentGroup);
                resetAnalysis();
              }}
              style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10 }}
            >
              <Radio value="GENERAL">KCB thông thường (GENERAL)</Radio>
              <Radio value="YHCT">KCB Y học cổ truyền (YHCT)</Radio>
            </Radio.Group>
            <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
              Import lại chỉ thay thế dữ liệu đúng nhóm, đúng cơ sở và đúng ngày.
              Nếu chọn sai nhóm, backend sẽ chặn file có dấu hiệu không phù hợp.
            </Text>
          </div>

          <Dragger

            accept=".xml"



            maxCount={

              1

            }



            beforeUpload={() =>

              false

            }



            fileList={

              fileList

            }



            disabled={

              analyzing ||

              importing

            }



            onChange={({

              fileList:

                newFileList,

            }) => {

              setFileList(

                newFileList

              );



              resetAnalysis();

            }}



            className="xml-dragger"

          >

            <div

              className="xml-upload-icon"

            >

              <InboxOutlined />

            </div>



            <div

              className="xml-upload-title"

            >

              Kéo file XML vào đây hoặc click để chọn

            </div>



            <div

              className="xml-upload-subtitle"

            >

              Hỗ trợ file XML hồ sơ KCB BHYT

            </div>



            <div

              className="xml-upload-note"

            >

              Chọn 1 file XML cho mỗi lần kiểm tra

            </div>

          </Dragger>



          <div

            className="xml-action-row"

          >

            <div

              className="xml-action-left"

            >

              <Button

                type="primary"



                loading={

                  analyzing

                }



                disabled={

                  fileList.length ===

                    0 ||

                  importing

                }



                onClick={

                  handleAnalyze

                }



                className="xml-primary-button"

              >

                Xử lý File

              </Button>



              <Button

                type="primary"



                loading={

                  importing

                }



                disabled={

                  !canImport ||

                  analyzing ||

                  importing

                }



                onClick={

                  handleImport

                }



                className="xml-import-button"

              >

                Import vào DB

              </Button>

            </div>



            {

              fileList.length >

                0 &&

              (

                <div

                  className="xml-selected-file"

                >

                  <span

                    className="xml-selected-dot"

                  />



                  <span>

                    {

                      fileList[0]

                        ?.name

                    }

                  </span>

                </div>

              )

            }

          </div>



          {

            importing &&

            (

              <div

                className="xml-progress-block"

              >

                <div

                  className="xml-progress-head"

                >

                  <Text

                    strong

                  >

                    Đang import dữ liệu

                  </Text>



                  <Text

                    strong



                    style={{

                      color:

                        "#1677ff",

                    }}

                  >

                    {

                      importPercent

                    }

                    %

                  </Text>

                </div>



                <Progress

                  percent={

                    importPercent

                  }



                  status="active"



                  strokeWidth={

                    10

                  }



                  showInfo={

                    false

                  }

                />

              </div>

            )

          }



          {

            importPercent ===

              100 &&

            !importing &&

            (

              <Alert

                type="success"



                showIcon



                message="Import XML hoàn tất"



                description="Dữ liệu đã được ghi vào hệ thống."



                style={{

                  marginTop:

                    16,

                }}

              />

            )

          }

        </Card>



        {

          result &&

          (

            <>

              {

                canImport

                  ? (

                    <Alert

                      type="success"



                      showIcon



                      message="Dữ liệu XML hợp lệ"



                      description={

                        `Tất cả ${result.summary.total} hồ sơ đều đạt điều kiện. Có thể import vào database.`

                      }



                      className="xml-result-alert"

                    />

                  )

                  : (

                    <Alert

                      type="error"



                      showIcon



                      message="Không thể import XML"



                      description={

                        `Có ${result.summary.invalid}/${result.summary.total} hồ sơ bị lỗi. Vui lòng sửa dữ liệu XML và xử lý lại file.`

                      }



                      className="xml-result-alert"

                    />

                  )

              }



              <div

                className="xml-summary-grid"

              >

                <div

                  className="xml-summary-card"

                >

                  <div

                    className="xml-summary-label"

                  >

                    Tổng hồ sơ

                  </div>



                  <div

                    className="xml-summary-value"

                  >

                    {

                      result.summary

                        .total

                    }

                  </div>

                </div>



                <div

                  className="xml-summary-card xml-summary-success"

                >

                  <div

                    className="xml-summary-label"

                  >

                    Hồ sơ đúng

                  </div>



                  <div

                    className="xml-summary-value"

                  >

                    {

                      result.summary

                        .valid

                    }

                  </div>

                </div>



                <div

                  className="xml-summary-card xml-summary-error"

                >

                  <div

                    className="xml-summary-label"

                  >

                    Hồ sơ lỗi

                  </div>



                  <div

                    className="xml-summary-value"

                  >

                    {

                      result.summary

                        .invalid

                    }

                  </div>

                </div>



                <div

                  className="xml-summary-card xml-summary-info"

                >

                  <div

                    className="xml-summary-label"

                  >

                    XML đọc được

                  </div>



                  <div

                    className="xml-summary-value"

                  >

                    {

                      result.actualTotal

                    }

                  </div>

                </div>

              </div>



              <Card

                className="xml-info-card"



                styles={{

                  body: {

                    padding:

                      0,

                  },

                }}

              >

                <div

                  className="xml-section-header"

                >

                  <div>

                    <div

                      className="xml-section-title"

                    >

                      Thông tin file

                    </div>



                    <div

                      className="xml-section-subtitle"

                    >

                      Thông tin tổng quan của file XML

                    </div>

                  </div>

                </div>



                <Descriptions

                  bordered



                  column={

                    4

                  }



                  size="middle"



                  className="xml-descriptions"

                >

                  <Descriptions.Item

                    label="Mã CSKCB"

                  >

                    {

                      result

                        .facilityCode ||

                      "-"

                    }

                  </Descriptions.Item>



                  <Descriptions.Item

                    label="Ngày lập"

                  >

                    {

                      result

                        .createdDate ||

                      "-"

                    }

                  </Descriptions.Item>



                  <Descriptions.Item

                    label="SL khai báo"

                  >

                    {

                      result

                        .declaredTotal

                    }

                  </Descriptions.Item>



                  <Descriptions.Item

                    label="SL đọc được"

                  >

                    {

                      result

                        .actualTotal

                    }

                  </Descriptions.Item>

                </Descriptions>

              </Card>



              <Card

                className="xml-table-card"



                styles={{

                  body: {

                    padding:

                      0,

                  },

                }}

              >

                <div

                  className="xml-section-header"

                >

                  <div>

                    <div

                      className="xml-section-title"

                    >

                      Danh sách hồ sơ

                    </div>



                    <div

                      className="xml-section-subtitle"

                    >

                      {

                        result.summary

                          .total

                      }{" "}

                      hồ sơ trong file

                    </div>

                  </div>



                  <Space>

                    <Tag

                      color="success"



                      className="xml-header-tag"

                    >

                      Đúng:

                      {" "}

                      {

                        result.summary

                          .valid

                      }

                    </Tag>



                    <Tag

                      color="error"



                      className="xml-header-tag"

                    >

                      Lỗi:

                      {" "}

                      {

                        result.summary

                          .invalid

                      }

                    </Tag>

                  </Space>

                </div>



                <Table<MedicalCase>

                  rowKey={(

                    record

                  ) =>

                    `${record.index}-${record.maLk ?? ""}`

                  }



                  dataSource={

                    result.cases

                  }



                  columns={

                    columns

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

                        total

                      ) =>

                        `Tổng số: ${total}`,

                  }}



                  scroll={{

                    x:

                      1800,

                  }}



                  rowClassName={(

                    record

                  ) =>

                    record.valid

                      ? ""

                      : "xml-error-row"

                  }



                  size="middle"

                />

              </Card>

            </>

          )

        }

      </div>



      <style>

        {`

          .xml-import-page {

            display: flex;

            flex-direction: column;

            gap: 16px;

          }



          .xml-import-header {

            display: flex;

            align-items: flex-start;

            justify-content: space-between;

            gap: 16px;

          }



          .xml-upload-card {

            border:

              1px solid

              #e5e7eb;



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



          .xml-treatment-selector {
            padding: 13px 16px;
            margin-bottom: 16px;
            border: 1px solid #dbeafe;
            background: #f8fbff;
            border-radius: 11px;
          }

          .xml-dragger {

            border:

              1.5px dashed

              #91caff !important;



            border-radius:

              14px !important;



            background:

              linear-gradient(

                180deg,

                #fbfdff 0%,

                #f8fbff 100%

              ) !important;



            transition:

              all

              0.2s

              ease;

          }



          .xml-dragger:hover {

            border-color:

              #1677ff !important;



            background:

              #f5f9ff !important;

          }



          .xml-dragger

          .ant-upload {

            padding:

              34px

              20px !important;

          }



          .xml-upload-icon {

            width:

              58px;



            height:

              58px;



            margin:

              0

              auto

              14px;



            display:

              flex;



            align-items:

              center;



            justify-content:

              center;



            border-radius:

              18px;



            color:

              #1677ff;



            background:

              #e6f4ff;



            font-size:

              30px;

          }



          .xml-upload-title {

            color:

              #172033;



            font-size:

              16px;



            font-weight:

              700;

          }



          .xml-upload-subtitle {

            margin-top:

              6px;



            color:

              #64748b;



            font-size:

              13px;

          }



          .xml-upload-note {

            margin-top:

              8px;



            color:

              #94a3b8;



            font-size:

              11px;

          }



          .xml-action-row {

            margin-top:

              16px;



            display:

              flex;



            align-items:

              center;



            justify-content:

              space-between;



            gap:

              12px;



            flex-wrap:

              wrap;

          }



          .xml-action-left {

            display:

              flex;



            align-items:

              center;



            gap:

              8px;

          }



          .xml-primary-button,

          .xml-import-button {

            height:

              38px;



            border-radius:

              9px;



            font-weight:

              600;

          }



          .xml-import-button {

            background:

              #0f766e;



            border-color:

              #0f766e;

          }



          .xml-import-button:hover {

            background:

              #0d9488 !important;



            border-color:

              #0d9488 !important;

          }



          .xml-selected-file {

            display:

              flex;



            align-items:

              center;



            gap:

              8px;



            max-width:

              420px;



            padding:

              7px

              10px;



            border:

              1px solid

              #e2e8f0;



            border-radius:

              8px;



            background:

              #f8fafc;



            color:

              #475569;



            font-size:

              12px;



            overflow:

              hidden;

          }



          .xml-selected-file

          span:last-child {

            overflow:

              hidden;



            text-overflow:

              ellipsis;



            white-space:

              nowrap;

          }



          .xml-selected-dot {

            width:

              8px;



            height:

              8px;



            flex-shrink:

              0;



            border-radius:

              50%;



            background:

              #22c55e;

          }



          .xml-progress-block {

            margin-top:

              18px;



            padding:

              14px

              16px;



            border:

              1px solid

              #dbeafe;



            border-radius:

              10px;



            background:

              #f8fbff;

          }



          .xml-progress-head {

            display:

              flex;



            align-items:

              center;



            justify-content:

              space-between;



            margin-bottom:

              8px;

          }



          .xml-result-alert {

            border-radius:

              10px;

          }



          .xml-summary-grid {

            display:

              grid;



            grid-template-columns:

              repeat(

                4,

                minmax(

                  0,

                  1fr

                )

              );



            gap:

              12px;

          }



          .xml-summary-card {

            min-height:

              94px;



            padding:

              16px

              18px;



            border:

              1px solid

              #e5e7eb;



            border-radius:

              12px;



            background:

              #ffffff;



            box-shadow:

              0

              3px

              12px

              rgba(

                15,

                23,

                42,

                0.03

              );

          }



          .xml-summary-label {

            color:

              #64748b;



            font-size:

              12px;



            font-weight:

              600;

          }



          .xml-summary-value {

            margin-top:

              6px;



            color:

              #172033;



            font-size:

              24px;



            font-weight:

              800;

          }



          .xml-summary-success {

            border-left:

              4px solid

              #52c41a;

          }



          .xml-summary-error {

            border-left:

              4px solid

              #ff4d4f;

          }



          .xml-summary-info {

            border-left:

              4px solid

              #1677ff;

          }



          .xml-info-card,

          .xml-table-card {

            overflow:

              hidden;



            border:

              1px solid

              #e5e7eb;



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

                0.03

              );

          }



          .xml-section-header {

            min-height:

              58px;



            padding:

              12px

              16px;



            display:

              flex;



            align-items:

              center;



            justify-content:

              space-between;



            gap:

              12px;



            border-bottom:

              1px solid

              #eef2f7;



            background:

              #ffffff;

          }



          .xml-section-title {

            color:

              #172033;



            font-size:

              15px;



            font-weight:

              700;

          }



          .xml-section-subtitle {

            margin-top:

              2px;



            color:

              #94a3b8;



            font-size:

              11px;

          }



          .xml-header-tag {

            margin:

              0;



            border-radius:

              999px;



            font-size:

              11px;



            font-weight:

              600;

          }



          .xml-status-tag {

            border-radius:

              999px;



            font-weight:

              600;

          }



          .xml-descriptions

          .ant-descriptions-item-label {

            background:

              #f8fafc !important;



            color:

              #475569 !important;



            font-weight:

              600 !important;

          }



          .xml-table-card

          .ant-table-thead

          > tr

          > th {

            background:

              #f2f5f8 !important;



            color:

              #334155 !important;



            font-size:

              12px;



            font-weight:

              700 !important;

          }



          .xml-table-card

          .ant-table-tbody

          > tr

          > td {

            padding:

              10px

              12px !important;



            color:

              #334155;



            font-size:

              12px;

          }



          .xml-table-card

          .ant-table-tbody

          > tr:hover

          > td {

            background:

              #f8fbff !important;

          }



          .xml-error-row

          > td {

            background:

              #fff7f6 !important;

          }



          .xml-error-row:hover

          > td {

            background:

              #fff1f0 !important;

          }



          .xml-table-card

          .ant-pagination {

            padding:

              0

              12px

              10px;

          }



          @media

          (

            max-width:

              1000px

          ) {

            .xml-summary-grid {

              grid-template-columns:

                1fr

                1fr;

            }



            .xml-descriptions

            .ant-descriptions-view {

              overflow-x:

                auto;

            }

          }



          @media

          (

            max-width:

              700px

          ) {

            .xml-summary-grid {

              grid-template-columns:

                1fr;

            }



            .xml-action-row {

              align-items:

                stretch;



              flex-direction:

                column;

            }



            .xml-action-left {

              flex-direction:

                column;



              align-items:

                stretch;

            }



            .xml-selected-file {

              max-width:

                none;

            }

          }

        `}

      </style>

    </>

  );

}