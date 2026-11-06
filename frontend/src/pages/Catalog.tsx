
import {
  AppstoreOutlined,
  BankOutlined,
  BuildOutlined,
  ExperimentOutlined,
  FileImageOutlined,
  MedicineBoxOutlined,
  FileProtectOutlined,
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

import { useNavigate } from "react-router-dom";
import { useState } from "react";
import type { ReactNode } from "react";

const { Title, Text } = Typography;

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

type CatalogTabKey = "bhxh" | "rules";

// ======================================================
// DANH MỤC BHXH
// ======================================================

const catalogCards: CatalogCardItem[] = [
  {
    title: "Dịch vụ kỹ thuật",
    description:
      "Danh mục dịch vụ kỹ thuật và cấu hình kiểm tra.",
    path: "/catalog/services",
    icon: <MedicineBoxOutlined />,
    color: "#1677ff",
    ready: true,
  },
  // {
  //   title: "Vật tư",
  //   description: "Danh mục vật tư y tế.",
  //   path: "/catalog/medical-supplies",
  //   icon: <DatabaseOutlined />,
  //   color: "#389e0d",
  //   ready: false,
  // },
  {
    title: "Thuốc",
    description:
      "Danh mục thuốc và thông tin sử dụng.",
    path: "/catalog/drugs",
    icon: <ExperimentOutlined />,
    color: "#fa8c16",
    ready: true,
  },
  {
    title: "Nhân viên y tế",
    description:
      "Danh mục bác sĩ và nhân viên y tế.",
    path: "/catalog/medical-staff",
    icon: <UserOutlined />,
    color: "#722ed1",
    ready: true,
  },
  // {
  //   title: "Giường bệnh",
  //   description:
  //     "Danh mục giường bệnh theo khoa.",
  //   path: "/catalog/beds",
  //   icon: <BuildOutlined />,
  //   color: "#cf1322",
  //   ready: false,
  // },
  {
    title: "Khoa",
    description: "Danh mục khoa phòng.",
    path: "/catalog/departments",
    icon: <BankOutlined />,
    color: "#2f54eb",
    ready: true,
  },
  {
    title: "Công khám",
    description:
      "Danh mục dịch vụ khám bệnh.",
    path: "/catalog/examination-services",
    icon: <AppstoreOutlined />,
    color: "#08979c",
    ready: true,
  },
  // {
  //   title: "Tiền giường",
  //   description:
  //     "Danh mục giá giường BHYT.",
  //   path: "/catalog/bed-prices",
  //   icon: <DollarOutlined />,
  //   color: "#c41d7f",
  //   ready: false,
  // },
  {
    title: "Danh mục máy",
    description:
      "Quản lý máy và cảnh báo trùng thời gian thực hiện.",
    path: "/catalog/machines",
    icon: <BuildOutlined />,
    color: "#8c564b",
    ready: true,
  },
];

// ======================================================
// QUY LUẬT KIỂM TRA
// ======================================================

const ruleCards: RuleCard[] = [
  {
    title: "DVKT - Nhân viên",
    description:
      "Cấu hình nhân viên được phép thực hiện từng DVKT.",
    path: "/catalog/service-staff",
    icon: <TeamOutlined />,
    color: "#607d8b",
  },
  {
    title: "DVKT - Chẩn đoán vào",
    description:
      "Kiểm tra DVKT có phù hợp chẩn đoán vào.",
    path: "/catalog/service-diagnosis",
    icon: <AppstoreOutlined />,
    color: "#2f54eb",
  },
  {
    title: "DVKT - ICD",
    description:
      "Cấu hình đối chiếu mã dịch vụ kỹ thuật với ICD-10.",
    path: "/catalog/service-icd",
    icon: <FileProtectOutlined />,
    color: "#08979c",
  },
  {
    title: "ICD Cảnh báo",
    description:
      "Cấu hình các mã ICD cần cảnh báo khi kiểm tra hồ sơ.",
    path: "/catalog/icd-warnings",
    icon: <SafetyCertificateOutlined />,
    color: "#d4380d",
  },

{
  title: "Nội soi TMH - Lấy dị vật",
  description:
    "Cấu hình cảnh báo thanh toán đồng thời nội soi tai mũi họng và lấy dị vật.",
  path: "/catalog/ent-foreign-body",
  icon: <MedicineBoxOutlined />,
  color: "#fa8c16",
},
{
  title: "Canxi - Điện giải đồ",
  description:
    "Cảnh báo thanh toán đồng thời hai DVKT xét nghiệm máu.",
  path: "/catalog/service-calcium-electrolyte",
  icon: <ExperimentOutlined />,
  color: "#fa8c16",
},

{
  title: "Tương tác X-quang ngực",
  description:
    "Cảnh báo thanh toán đồng thời X-quang ngực thẳng và nghiêng/chếch.",
  path: "/catalog/service-chest-xray",
  icon: <FileImageOutlined />,
  color: "#1677ff",
},
{
  title: "Tương tác thuốc - ICD",
  description:
    "Cấu hình cảnh báo hoạt chất theo chẩn đoán ICD.",
  path: "/catalog/drug-icd-interactions",
  icon: <ExperimentOutlined />,
  color: "#cf1322",
},

];

// ======================================================
// COMPONENT
// ======================================================

export default function Catalog() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] =
    useState<CatalogTabKey>(() => {
      const savedTab = sessionStorage.getItem(
        "catalog-active-tab"
      );
      return savedTab === "rules" ? "rules" : "bhxh";
    });

  function handleTabChange(key: string) {
    const nextTab: CatalogTabKey =
      key === "rules" ? "rules" : "bhxh";

    setActiveTab(nextTab);

    sessionStorage.setItem(
      "catalog-active-tab",
      nextTab
    );
  }

  function openCatalogPage(path: string) {
    sessionStorage.setItem(
      "catalog-active-tab",
      "bhxh"
    );
    navigate(path);
  }

  function openRulePage(path: string) {
    sessionStorage.setItem(
      "catalog-active-tab",
      "rules"
    );
    navigate(path);
  }

  // ======================================================
  // DANH MỤC BHXH TAB
  // ======================================================

  const bhxhTab = (
    <div className="catalog-section">
      <div className="catalog-section-header">
        <div>
          <Text strong style={{ fontSize: 14 }}>
            Danh mục nghiệp vụ
          </Text>

          <Text
            type="secondary"
            style={{
              display: "block",
              marginTop: 2,
              fontSize: 11,
            }}
          >
            Quản lý các danh mục phục vụ đối chiếu
            và kiểm tra hồ sơ BHYT
          </Text>
        </div>
      </div>

      <Row gutter={[12, 12]}>
        {catalogCards.map((item) => (
          <Col
            xs={24}
            sm={12}
            md={8}
            lg={6}
            xl={6}
            key={item.title}
          >
            <Card
              hoverable={item.ready}
              className={
                item.ready
                  ? "catalog-card"
                  : "catalog-card catalog-card-disabled"
              }
              onClick={() => {
                if (item.ready && item.path) {
                  openCatalogPage(item.path);
                }
              }}
            >
              <div className="catalog-card-main">
                <div
                  className="catalog-card-icon"
                  style={{
                    color: item.color,
                    background: `${item.color}12`,
                  }}
                >
                  {item.icon}
                </div>

                <div className="catalog-card-content">
                  <Title
                    level={5}
                    className="catalog-card-title"
                  >
                    {item.title}
                  </Title>

                  <Text
                    type="secondary"
                    className="catalog-card-description"
                  >
                    {item.description}
                  </Text>
                </div>
              </div>

              <div className="catalog-card-footer">
                <Button
                  type={
                    item.ready ? "primary" : "default"
                  }
                  ghost={item.ready}
                  size="small"
                  disabled={!item.ready}
                  onClick={(event) => {
                    event.stopPropagation();

                    if (item.ready && item.path) {
                      openCatalogPage(item.path);
                    }
                  }}
                >
                  {item.ready ? "Chi tiết" : "Sắp làm"}
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );

  // ======================================================
  // QUY LUẬT KIỂM TRA TAB
  // ======================================================

  const rulesTab = (
    <div className="catalog-section">
      <div className="catalog-section-header">
        <div>
          <Text strong style={{ fontSize: 14 }}>
            Quy luật kiểm tra
          </Text>

          <Text
            type="secondary"
            style={{
              display: "block",
              marginTop: 2,
              fontSize: 11,
            }}
          >
            Thiết lập điều kiện nghiệp vụ dùng
            cho Rule Engine
          </Text>
        </div>

        <Tag color="blue">
          {ruleCards.length} nhóm quy luật
        </Tag>
      </div>

      <Row gutter={[12, 12]}>
        {ruleCards.map((item) => (
          <Col
            xs={24}
            sm={12}
            md={8}
            lg={6}
            xl={6}
            key={item.path}
          >
            <Card
              hoverable
              className="catalog-rule-card"
              onClick={() =>
                openRulePage(item.path)
              }
            >
              <div className="catalog-card-main">
                <div
                  className="catalog-card-icon"
                  style={{
                    color: item.color,
                    background: `${item.color}12`,
                  }}
                >
                  {item.icon}
                </div>

                <div className="catalog-card-content">
                  <Title
                    level={5}
                    className="catalog-card-title"
                  >
                    {item.title}
                  </Title>

                  <Text
                    type="secondary"
                    className="catalog-card-description"
                  >
                    {item.description}
                  </Text>
                </div>
              </div>

              <div className="catalog-card-footer">
                <Button
                  type="primary"
                  ghost
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    openRulePage(item.path);
                  }}
                >
                  Chi tiết
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );

  // ======================================================
  // UI
  // ======================================================

  return (
    <div className="catalog-page">
      {/* HEADER */}
      <div className="catalog-header">
        <div>
          <Title
            level={3}
            style={{
              margin: 0,
              color: "#172033",
              fontWeight: 800,
              fontSize: 21,
              lineHeight: 1.25,
            }}
          >
            <AppstoreOutlined
              style={{
                marginRight: 10,
                color: "#1677ff",
              }}
            />
            Danh mục
          </Title>

          <Text
            type="secondary"
            style={{
              display: "block",
              marginTop: 3,
              fontSize: 12,
            }}
          >
            Quản lý dữ liệu danh mục và cấu hình
            quy luật kiểm tra BHYT
          </Text>
        </div>
      </div>

      {/* TABS */}
      <Card
        className="catalog-main-card"
        styles={{
          body: {
            padding: "0 14px 14px",
          },
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          className="catalog-tabs"
          items={[
            {
              key: "bhxh",
              label: "Danh mục BHXH",
              children: bhxhTab,
            },
            {
              key: "rules",
              label: "Quy luật kiểm tra",
              children: rulesTab,
            },
          ]}
        />
      </Card>

      {/* STYLES */}
      <style>
        {`
          /* ============================================
             PAGE FIT HEIGHT
          ============================================ */

          .catalog-page {
            display: flex;
            flex-direction: column;
            gap: 10px;

            height: calc(100dvh - 160px);
            max-height: calc(100dvh - 160px);

            min-height: 0;
            overflow: hidden;
          }

          .catalog-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
          }

          /* ============================================
             MAIN CARD
          ============================================ */

          .catalog-main-card {
            flex: 1;
            min-height: 0;
            overflow: hidden;

            border: 1px solid #edf0f5;
            border-radius: 14px;

            box-shadow:
              0 4px 18px rgba(15, 23, 42, 0.04);
          }

          .catalog-main-card > .ant-card-body {
            height: 100%;
            min-height: 0;

            display: flex;
            flex-direction: column;
          }

          .catalog-tabs {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
          }

          .catalog-tabs > .ant-tabs-nav {
            flex-shrink: 0;
            margin: 0 0 10px;
          }

          .catalog-tabs > .ant-tabs-nav
          .ant-tabs-tab {
            padding: 12px 4px;
            font-size: 13px;
            font-weight: 600;
          }

          .catalog-tabs > .ant-tabs-content-holder {
            flex: 1;
            min-height: 0;
            overflow: hidden;
          }

          .catalog-tabs .ant-tabs-content,
          .catalog-tabs .ant-tabs-tabpane {
            height: 100%;
            min-height: 0;
          }

          /* ============================================
             SECTION
          ============================================ */

          .catalog-section {
            display: flex;
            flex-direction: column;
            gap: 10px;
            height: 100%;
            min-height: 0;
            overflow-y: auto;
            overflow-x: hidden;
            scrollbar-width: thin;
            overscroll-behavior: contain;
          }

          .catalog-section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-shrink: 0;
            padding: 2px 0;
          }

          /* ============================================
             CATALOG CARD
          ============================================ */

          .catalog-card,
          .catalog-rule-card {
            height: 100%;
            min-height: 140px;

            border: 1px solid #edf0f5;
            border-radius: 12px;
            background: #ffffff;

            box-shadow:
              0 3px 12px rgba(15, 23, 42, 0.035);

            cursor: pointer;
            transition:
              border-color 0.2s ease,
              box-shadow 0.2s ease;
          }

          .catalog-card:hover,
          .catalog-rule-card:hover {
            border-color: #c9ddff;

            box-shadow:
              0 6px 18px rgba(15, 23, 42, 0.07);
          }

          .catalog-card-disabled {
            cursor: default;
            background: #fafafa;
          }

          .catalog-card-disabled:hover {
            border-color: #edf0f5;

            box-shadow:
              0 3px 12px rgba(15, 23, 42, 0.035);
          }

          .catalog-card > .ant-card-body,
          .catalog-rule-card > .ant-card-body {
            display: flex;
            flex-direction: column;
            height: 100%;

            min-height: 140px;
            padding: 12px 14px;
          }

          .catalog-card-main {
            display: flex;
            align-items: flex-start;
            gap: 11px;
            min-width: 0;
          }

          .catalog-card-icon {
            width: 38px;
            height: 38px;
            min-width: 38px;

            display: flex;
            align-items: center;
            justify-content: center;

            border-radius: 10px;
            font-size: 19px;
          }

          .catalog-card-content {
            min-width: 0;
            flex: 1;
          }

          .catalog-card-title {
            margin: 1px 0 4px !important;

            color: #172033 !important;
            font-size: 14px !important;
            font-weight: 800 !important;
          }

          .catalog-card-description {
            display: block;

            font-size: 11px;
            line-height: 1.45;
            color: #64748b;
          }

          .catalog-card-footer {
            margin-top: auto;
            padding-top: 9px;
          }

          .catalog-card-footer .ant-btn {
            border-radius: 7px;
            font-weight: 600;
          }

          /* ============================================
             SMALL HEIGHT SCREEN
          ============================================ */

          @media (max-height: 800px) {
            .catalog-page {
              gap: 7px;
            }

            .catalog-card,
            .catalog-rule-card {
              min-height: 120px;
            }

            .catalog-card > .ant-card-body,
            .catalog-rule-card > .ant-card-body {
              min-height: 120px;
              padding: 9px 11px;
            }

            .catalog-card-icon {
              width: 32px;
              height: 32px;
              min-width: 32px;
              font-size: 17px;
            }

            .catalog-card-footer {
              padding-top: 6px;
            }
          }

          /* ============================================
             RESPONSIVE
          ============================================ */

          @media (max-width: 900px) {
            .catalog-page {
              height: calc(100dvh - 145px);
              max-height: calc(100dvh - 145px);
            }

            .catalog-card-main {
              gap: 8px;
            }
          }

          @media (max-width: 600px) {
            .catalog-page {
              height: calc(100dvh - 120px);
              max-height: calc(100dvh - 120px);
            }

            .catalog-main-card > .ant-card-body {
              padding: 0 10px 10px !important;
            }

            .catalog-section {
              padding-right: 3px;
            }
          }
        `}
      </style>
    </div>
  );
}
