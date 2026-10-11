import {
  AppstoreOutlined,
  BankOutlined,
  BuildOutlined,
  DatabaseOutlined,
  DollarOutlined,
  ExperimentOutlined,
  MedicineBoxOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";

import {
  Button,
  Card,
  Col,
  Row,
  Tabs,
  Tag,
  Typography,
} from "antd";

import {
  useNavigate,
} from "react-router-dom";

import {
  useState,
} from "react";

import type {
  ReactNode,
} from "react";


const {
  Title,
  Text,
} = Typography;


// ======================================================
// TYPES
// ======================================================

interface CatalogCardItem {
  title: string;

  description: string;

  path?: string;

  icon: ReactNode;

  color: string;

  ready?: boolean;
}


interface RuleCard {
  title: string;

  description: string;

  path: string;

  icon: ReactNode;

  color: string;
}


type CatalogTabKey =
  | "bhxh"
  | "rules";


// ======================================================
// DANH MỤC BHXH
// ======================================================

const catalogCards:
  CatalogCardItem[] = [

  {
    title:
      "DVKT",

    description:
      "Danh mục dịch vụ kỹ thuật và cấu hình kiểm tra.",

    path:
      "/catalog/services",

    icon:
      <MedicineBoxOutlined />,

    color:
      "#1677ff",

    ready:
      true,
  },


  {
    title:
      "Vật tư",

    description:
      "Danh mục vật tư y tế.",

    path:
      "/catalog/medical-supplies",

    icon:
      <DatabaseOutlined />,

    color:
      "#389e0d",

    ready:
      false,
  },


  {
    title:
      "Thuốc",

    description:
      "Danh mục thuốc và thông tin sử dụng.",

    path:
      "/catalog/drugs",

    icon:
      <ExperimentOutlined />,

    color:
      "#fa8c16",

    ready:
      true,
  },


  {
    title:
      "Nhân viên y tế",

    description:
      "Danh mục bác sĩ và nhân viên y tế.",

    path:
      "/catalog/medical-staff",

    icon:
      <UserOutlined />,

    color:
      "#722ed1",

    ready:
      true,
  },


  {
    title:
      "Giường bệnh",

    description:
      "Danh mục giường bệnh theo khoa.",

    path:
      "/catalog/beds",

    icon:
      <BuildOutlined />,

    color:
      "#cf1322",

    ready:
      false,
  },


  {
    title:
      "Khoa",

    description:
      "Danh mục khoa phòng.",

    path:
      "/catalog/departments",

    icon:
      <BankOutlined />,

    color:
      "#2f54eb",

    ready:
      true,
  },


  {
    title:
      "Công khám",

    description:
      "Danh mục dịch vụ khám bệnh.",

    path:
      "/catalog/examination-services",

    icon:
      <AppstoreOutlined />,

    color:
      "#08979c",

    ready:
      true,
  },


  {
    title:
      "Tiền giường",

    description:
      "Danh mục giá giường BHYT.",

    path:
      "/catalog/bed-prices",

    icon:
      <DollarOutlined />,

    color:
      "#c41d7f",

    ready:
      false,
  },


  {
    title:
      "Danh mục máy",

    description:
      "Quản lý máy và cảnh báo trùng thời gian thực hiện.",

    path:
      "/catalog/machines",

    icon:
      <BuildOutlined />,

    color:
      "#8c564b",

    ready:
      true,
  },
];


// ======================================================
// QUY LUẬT KIỂM TRA
// ======================================================

const ruleCards:
  RuleCard[] = [

  // {
  //   title:
  //     "DVKT - ICD",

  //   description:
  //     "Kiểm tra dịch vụ kỹ thuật có phù hợp mã ICD của hồ sơ.",

  //   path:
  //     "/catalog/service-icd",

  //   icon:
  //     <SafetyCertificateOutlined />,

  //   color:
  //     "#1677ff",
  // },


  {
    title:
      "DVKT - Nhân viên",

    description:
      "Cấu hình nhân viên được phép thực hiện từng DVKT.",

    path:
      "/catalog/service-staff",

    icon:
      <TeamOutlined />,

    color:
      "#607d8b",
  },


  {
    title:
      "DVKT - Chẩn đoán vào",

    description:
      "Kiểm tra DVKT có phù hợp chẩn đoán vào.",

    path:
      "/catalog/service-diagnosis",

    icon:
      <AppstoreOutlined />,

    color:
      "#2f54eb",
  },


  {
    title:
      "ICD Cảnh báo",

    description:
      "Cấu hình các mã ICD cần cảnh báo khi kiểm tra hồ sơ.",

    path:
      "/catalog/icd-warnings",

    icon:
      <SafetyCertificateOutlined />,

    color:
      "#d4380d",
  },


  // {
  //   title:
  //     "Thuốc - ICD",

  //   description:
  //     "Kiểm tra thuốc có phù hợp mã bệnh.",

  //   path:
  //     "/catalog/drug-icd",

  //   icon:
  //     <MedicineBoxOutlined />,

  //   color:
  //     "#52c41a",
  // },


  // {
  //   title:
  //     "Thuốc - Hoạt chất",

  //   description:
  //     "Cấu hình hoạt chất của từng thuốc.",

  //   path:
  //     "/catalog/drug-ingredient",

  //   icon:
  //     <ExperimentOutlined />,

  //   color:
  //     "#fa8c16",
  // },


  // {
  //   title:
  //     "Tương tác thuốc",

  //   description:
  //     "Cấu hình các hoạt chất không nên sử dụng cùng nhau.",

  //   path:
  //     "/catalog/drug-interaction",

  //   icon:
  //     <ApartmentOutlined />,

  //   color:
  //     "#722ed1",
  // },
];


// ======================================================
// COMPONENT
// ======================================================

export default function Catalog() {

  const navigate =
    useNavigate();


  // ====================================================
  // ACTIVE TAB
  //
  // Ghi nhớ tab người dùng đang chọn.
  // Khi vào trang con rồi quay lại /catalog
  // sẽ giữ nguyên tab trước đó.
  // ====================================================

  const [
    activeTab,
    setActiveTab,
  ] = useState<CatalogTabKey>(
    () => {

      const savedTab =
        sessionStorage.getItem(
          "catalog-active-tab"
        );


      if (
        savedTab ===
        "rules"
      ) {

        return "rules";
      }


      return "bhxh";
    }
  );


  function handleTabChange(
    key: string
  ) {

    const nextTab:
      CatalogTabKey =
      key ===
      "rules"
        ? "rules"
        : "bhxh";


    setActiveTab(
      nextTab
    );


    sessionStorage.setItem(
      "catalog-active-tab",
      nextTab
    );
  }


  // ====================================================
  // NAVIGATE FROM BHXH TAB
  // ====================================================

  function openCatalogPage(
    path:
      string
  ) {

    sessionStorage.setItem(
      "catalog-active-tab",
      "bhxh"
    );


    navigate(
      path
    );
  }


  // ====================================================
  // NAVIGATE FROM RULES TAB
  // ====================================================

  function openRulePage(
    path:
      string
  ) {

    sessionStorage.setItem(
      "catalog-active-tab",
      "rules"
    );


    navigate(
      path
    );
  }


  // ====================================================
  // DANH MỤC BHXH TAB
  // ====================================================

  const bhxhTab = (

    <div
      className="catalog-section"
    >

      <div
        className="catalog-section-header"
      >

        <div>

          <Typography.Text
            strong

            style={{
              fontSize:
                15,
            }}
          >
            Danh mục nghiệp vụ
          </Typography.Text>


          <Typography.Text
            type="secondary"

            style={{
              display:
                "block",

              marginTop:
                3,

              fontSize:
                12,
            }}
          >
            Quản lý các danh mục phục vụ đối chiếu và kiểm tra hồ sơ BHYT
          </Typography.Text>

        </div>

      </div>


      <Row
        gutter={[
          14,
          14,
        ]}
      >

        {
          catalogCards.map(
            (
              item
            ) => (

              <Col
                xs={24}
                sm={12}
                md={8}
                lg={6}
                xl={6}

                key={
                  item.title
                }
              >

                <Card
                  hoverable={
                    item.ready
                  }

                  className={
                    item.ready
                      ? "catalog-card"
                      : "catalog-card catalog-card-disabled"
                  }

                  onClick={() => {

                    if (
                      item.ready &&
                      item.path
                    ) {

                      openCatalogPage(
                        item.path
                      );
                    }
                  }}
                >

                  <div
                    className="catalog-card-top"
                  >

                    <div
                      className="catalog-card-icon"

                      style={{
                        color:
                          item.color,

                        background:
                          `${item.color}12`,
                      }}
                    >
                      {
                        item.icon
                      }
                    </div>

                  </div>


                  <div
                    className="catalog-card-content"
                  >

                    <Title
                      level={5}

                      className="catalog-card-title"
                    >
                      {
                        item.title
                      }
                    </Title>


                    <Text
                      type="secondary"

                      className="catalog-card-description"
                    >
                      {
                        item.description
                      }
                    </Text>

                  </div>


                  <div
                    className="catalog-card-footer"
                  >

                    <Button
                      type={
                        item.ready
                          ? "primary"
                          : "default"
                      }

                      ghost={
                        item.ready
                      }

                      disabled={
                        !item.ready
                      }

                      onClick={(
                        event
                      ) => {

                        event.stopPropagation();


                        if (
                          item.ready &&
                          item.path
                        ) {

                          openCatalogPage(
                            item.path
                          );
                        }
                      }}

                      style={{
                        borderRadius:
                          8,

                        fontWeight:
                          600,
                      }}
                    >
                      {
                        item.ready
                          ? "Chi tiết"
                          : "Sắp làm"
                      }
                    </Button>

                  </div>

                </Card>

              </Col>

            )
          )
        }

      </Row>

    </div>
  );


  // ====================================================
  // QUY LUẬT KIỂM TRA TAB
  // ====================================================

  const rulesTab = (

    <div
      className="catalog-section"
    >

      <div
        className="catalog-section-header"
      >

        <div>

          <Typography.Text
            strong

            style={{
              fontSize:
                15,
            }}
          >
            Quy luật kiểm tra
          </Typography.Text>


          <Typography.Text
            type="secondary"

            style={{
              display:
                "block",

              marginTop:
                3,

              fontSize:
                12,
            }}
          >
            Thiết lập điều kiện nghiệp vụ dùng cho Rule Engine
          </Typography.Text>

        </div>


        <Tag
          color="blue"
        >
          {
            ruleCards.length
          } nhóm quy luật
        </Tag>

      </div>


      <Row
        gutter={[
          14,
          14,
        ]}
      >

        {
          ruleCards.map(
            (
              item
            ) => (

              <Col
                xs={24}
                sm={12}
                md={8}
                xl={6}

                key={
                  item.path
                }
              >

                <Card
                  hoverable

                  className="catalog-rule-card"

                  onClick={() =>
                    openRulePage(
                      item.path
                    )
                  }
                >

                  <div
                    className="catalog-rule-icon"

                    style={{
                      color:
                        item.color,

                      background:
                        `${item.color}12`,
                    }}
                  >
                    {
                      item.icon
                    }
                  </div>


                  <Title
                    level={5}

                    className="catalog-rule-title"
                  >
                    {
                      item.title
                    }
                  </Title>


                  <Text
                    type="secondary"

                    className="catalog-rule-description"
                  >
                    {
                      item.description
                    }
                  </Text>


                  <div
                    className="catalog-rule-footer"
                  >

                    <Button
                      type="primary"

                      ghost

                      onClick={(
                        event
                      ) => {

                        event.stopPropagation();


                        openRulePage(
                          item.path
                        );
                      }}

                      style={{
                        borderRadius:
                          8,

                        fontWeight:
                          600,
                      }}
                    >
                      Chi tiết
                    </Button>

                  </div>

                </Card>

              </Col>

            )
          )
        }

      </Row>

    </div>
  );


  // ====================================================
  // UI
  // ====================================================

  return (

    <div
      className="catalog-page"
    >

      {/* =================================================
          HEADER
      ================================================= */}

      <div
        className="catalog-header"
      >

        <div>

          <Title
            level={3}

            style={{
              margin:
                0,

              color:
                "#172033",

              fontWeight:
                800,
            }}
          >

            <AppstoreOutlined
              style={{
                marginRight:
                  10,

                color:
                  "#1677ff",
              }}
            />


            Danh mục

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
            Quản lý dữ liệu danh mục và cấu hình quy luật kiểm tra BHYT
          </Text>

        </div>

      </div>


      {/* =================================================
          TABS
      ================================================= */}

      <Card
        className="catalog-main-card"

        styles={{
          body: {
            padding:
              "0 18px 18px",
          },
        }}
      >

        <Tabs
          activeKey={
            activeTab
          }

          onChange={
            handleTabChange
          }

          className="catalog-tabs"

          items={[
            {
              key:
                "bhxh",

              label:
                "Danh mục BHXH",

              children:
                bhxhTab,
            },

            {
              key:
                "rules",

              label:
                "Quy luật kiểm tra",

              children:
                rulesTab,
            },
          ]}
        />

      </Card>


      {/* =================================================
          STYLE
      ================================================= */}

      <style>
        {`
          .catalog-page {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .catalog-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .catalog-main-card {
            border: 1px solid #edf0f5;
            border-radius: 14px;

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

            overflow: hidden;
          }

          .catalog-tabs
          > .ant-tabs-nav {
            margin:
              0
              0
              18px;
          }

          .catalog-tabs
          > .ant-tabs-nav
          .ant-tabs-tab {
            padding:
              15px
              4px;

            font-size:
              13px;

            font-weight:
              600;
          }

          .catalog-tabs
          > .ant-tabs-nav
          .ant-tabs-tab-active
          .ant-tabs-tab-btn {
            font-weight:
              700;
          }

          .catalog-section {
            display:
              flex;

            flex-direction:
              column;

            gap:
              14px;
          }

          .catalog-section-header {
            display:
              flex;

            align-items:
              center;

            justify-content:
              space-between;

            gap:
              12px;

            padding:
              2px
              0;
          }

          .catalog-section-status {
            display:
              flex;

            align-items:
              center;

            gap:
              6px;
          }

          .catalog-card {
            height:
              100%;

            min-height:
              205px;

            border:
              1px solid
              #edf0f5;

            border-radius:
              14px;

            box-shadow:
              0
              3px
              14px
              rgba(
                15,
                23,
                42,
                0.035
              );

            cursor:
              pointer;

            transition:
              all
              0.22s
              ease;
          }

          .catalog-card:hover {
            transform:
              translateY(
                -3px
              );

            border-color:
              #d6e4ff;

            box-shadow:
              0
              10px
              28px
              rgba(
                15,
                23,
                42,
                0.09
              );
          }

          .catalog-card-disabled {
            cursor:
              default;

            background:
              #fafafa;
          }

          .catalog-card-disabled:hover {
            transform:
              none;

            border-color:
              #edf0f5;

            box-shadow:
              0
              3px
              14px
              rgba(
                15,
                23,
                42,
                0.035
              );
          }

          .catalog-card
          .ant-card-body {
            height:
              100%;

            min-height:
              205px;

            display:
              flex;

            flex-direction:
              column;

            padding:
              17px;
          }

          .catalog-card-top {
            display:
              flex;

            align-items:
              flex-start;

            justify-content:
              space-between;

            gap:
              10px;
          }

          .catalog-card-icon {
            width:
              48px;

            height:
              48px;

            display:
              flex;

            align-items:
              center;

            justify-content:
              center;

            border-radius:
              13px;

            font-size:
              25px;

            flex-shrink:
              0;
          }

          .catalog-card-state {
            margin:
              0;

            border-radius:
              999px;

            font-size:
              10px;

            font-weight:
              700;
          }

          .catalog-card-content {
            margin-top:
              15px;
          }

          .catalog-card-title {
            margin:
              0
              0
              7px !important;

            color:
              #172033 !important;

            font-size:
              15px !important;

            font-weight:
              800 !important;
          }

          .catalog-card-description {
            display:
              block;

            min-height:
              38px;

            font-size:
              12px;

            line-height:
              1.55;
          }

          .catalog-card-footer {
            margin-top:
              auto;

            padding-top:
              14px;
          }

          .catalog-rule-card {
            height:
              100%;

            min-height:
              205px;

            border:
              1px solid
              #edf0f5;

            border-radius:
              14px;

            box-shadow:
              0
              3px
              14px
              rgba(
                15,
                23,
                42,
                0.035
              );

            cursor:
              pointer;

            transition:
              all
              0.22s
              ease;
          }

          .catalog-rule-card:hover {
            transform:
              translateY(
                -3px
              );

            border-color:
              #d6e4ff;

            box-shadow:
              0
              10px
              28px
              rgba(
                15,
                23,
                42,
                0.09
              );
          }

          .catalog-rule-card
          .ant-card-body {
            min-height:
              205px;

            display:
              flex;

            flex-direction:
              column;

            padding:
              17px;
          }

          .catalog-rule-icon {
            width:
              48px;

            height:
              48px;

            display:
              flex;

            align-items:
              center;

            justify-content:
              center;

            border-radius:
              13px;

            font-size:
              25px;
          }

          .catalog-rule-title {
            margin:
              15px
              0
              7px !important;

            color:
              #172033 !important;

            font-size:
              15px !important;

            font-weight:
              800 !important;
          }

          .catalog-rule-description {
            display:
              block;

            min-height:
              38px;

            font-size:
              12px;

            line-height:
              1.55;
          }

          .catalog-rule-footer {
            margin-top:
              auto;

            padding-top:
              14px;
          }

          @media
          (
            max-width:
              800px
          ) {

            .catalog-section-header {
              align-items:
                flex-start;

              flex-direction:
                column;
            }

          }
        `}
      </style>

    </div>
  );
}