import {
  BarsOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
  CloseCircleFilled,
  DashboardOutlined,
  ReloadOutlined,
  RightOutlined,
} from "@ant-design/icons";

import { Alert, Button, Card, Col, Empty, Row, Space, Spin, Tag, Typography } from "antd";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ReactNode } from "react";

import { useNavigate } from "react-router-dom";

import { apiFetch } from "../api/apiClient";

const { Title, Text } = Typography;

interface DashboardMonthSummary {
  month: number;
  year: number;

  totalCases: number;
  goodCases: number;
  errorCases: number;
  uncheckedCases: number;
}

interface DashboardResponse {
  success?: boolean;
  message?: string;

  data?: DashboardMonthSummary[];
}

type StatType = "normal" | "success" | "error" | "warning";

function formatMonth(
  month: number,

  year: number,
) {
  return `Tháng ${String(month).padStart(2, "0")}/${year}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function getPercent(
  value: number,

  total: number,
) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function NumberBadge({
  value,
  type,
}: {
  value: number;

  type: StatType;
}) {
  return (
    <span className={`dashboard-number-badge dashboard-number-${type}`}>{formatNumber(value)}</span>
  );
}

function StatRow({
  icon,
  label,
  value,
  type,
}: {
  icon: ReactNode;

  label: string;

  value: number;

  type: StatType;
}) {
  return (
    <div className="dashboard-stat-row">
      <div className="dashboard-stat-row-left">
        <span className={`dashboard-stat-icon dashboard-stat-icon-${type}`}>{icon}</span>

        <Text className="dashboard-stat-label">{label}</Text>
      </div>

      <NumberBadge value={value} type={type} />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  type,
}: {
  title: string;

  value: number;

  icon: ReactNode;

  type: StatType;
}) {
  return (
    <div className={`dashboard-summary-card dashboard-summary-${type}`}>
      <div className={`dashboard-summary-icon dashboard-summary-icon-${type}`}>{icon}</div>

      <div>
        <div className="dashboard-summary-title">{title}</div>

        <div className="dashboard-summary-number">{formatNumber(value)}</div>
      </div>
    </div>
  );
}

function MonthCard({
  item,
  onView,
  latest,
}: {
  item: DashboardMonthSummary;

  onView: (item: DashboardMonthSummary) => void;

  latest?: boolean;
}) {
  const checked = item.goodCases + item.errorCases;

  const goodPercent = getPercent(item.goodCases, checked);

  return (
    <Card className={`dashboard-month-card ${latest ? "dashboard-month-card-latest" : ""}`}>
      <div className="dashboard-month-card-top">
        <Tag color="blue" className="dashboard-month-tag">
          {formatMonth(item.month, item.year)}
        </Tag>

        {latest && <span className="dashboard-latest-badge">Mới nhất</span>}
      </div>

      <div className="dashboard-month-heading">
        <div>
          <div className="dashboard-month-title">Hồ sơ thanh toán</div>

          <div className="dashboard-month-subtitle">Tổng hợp kết quả kiểm tra trong tháng</div>
        </div>

        {checked > 0 && (
          <div className="dashboard-rate">
            <span>{goodPercent}%</span>

            <small>hồ sơ đúng</small>
          </div>
        )}
      </div>

      <div className="dashboard-month-divider" />

      <div className="dashboard-month-stats">
        <StatRow
          icon={<BarsOutlined />}
          label="Tổng số hồ sơ"
          value={item.totalCases}
          type="normal"
        />

        <StatRow
          icon={<CheckCircleFilled />}
          label="Hồ sơ đúng"
          value={item.goodCases}
          type="success"
        />

        <StatRow
          icon={<CloseCircleFilled />}
          label="Hồ sơ lỗi"
          value={item.errorCases}
          type="error"
        />

        <StatRow
          icon={<ClockCircleFilled />}
          label="Chưa kiểm tra"
          value={item.uncheckedCases}
          type="warning"
        />
      </div>

      <div className="dashboard-month-footer">
        <Button block className="dashboard-detail-button" onClick={() => onView(item)}>
          <Space size={8}>
            Xem chi tiết
            <RightOutlined />
          </Space>
        </Button>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [summaries, setSummaries] = useState<DashboardMonthSummary[]>([]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);

      setError(null);

      const response = await apiFetch("/dashboard/summary", {
        method: "GET",
      });

      if (response.status === 401) {
        return;
      }

      let json: DashboardResponse;

      try {
        json = await response.json();
      } catch {
        throw new Error("Backend trả về dữ liệu Dashboard không hợp lệ.");
      }

      if (!response.ok || json.success !== true) {
        throw new Error(json.message || "Không thể tải dữ liệu Dashboard.");
      }

      setSummaries(Array.isArray(json.data) ? json.data : []);
    } catch (loadError) {
      console.error("Dashboard load error:", loadError);

      setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu Dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadDashboard]);

  const sortedSummaries = useMemo(
    () =>
      [...summaries].sort((a, b) => {
        if (a.year !== b.year) {
          return b.year - a.year;
        }

        return b.month - a.month;
      }),
    [summaries],
  );

  const totals = useMemo(() => {
    return sortedSummaries.reduce(
      (accumulator, item) => {
        accumulator.total += item.totalCases;

        accumulator.good += item.goodCases;

        accumulator.error += item.errorCases;

        accumulator.unchecked += item.uncheckedCases;

        return accumulator;
      },
      {
        total: 0,

        good: 0,

        error: 0,

        unchecked: 0,
      },
    );
  }, [sortedSummaries]);

  function handleViewDetail(item: DashboardMonthSummary) {
    navigate(`/medical-cases?year=${item.year}&month=${item.month}`);
  }

  return (
    <>
      <div className="dashboard-page">
        <div className="dashboard-header">
          <div>
            <Title
              level={3}
              style={{
                margin: 0,

                color: "#172033",

                fontWeight: 800,
              }}
            >
              <DashboardOutlined
                style={{
                  marginRight: 10,

                  color: "#1677ff",
                }}
              />
              Dashboard
            </Title>

            <Text type="secondary" className="dashboard-subtitle">
              Tổng quan hồ sơ thanh toán và kết quả kiểm tra BHYT theo tháng
            </Text>
          </div>

          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void loadDashboard()}
            className="dashboard-refresh-button"
          >
            Làm mới
          </Button>
        </div>

        {loading ? (
          <div className="dashboard-loading">
            <Spin size="large" />

            <Text type="secondary">Đang tải dữ liệu Dashboard...</Text>
          </div>
        ) : null}

        {!loading && error && (
          <Alert
            type="error"
            showIcon
            title="Không thể tải Dashboard"
            description={error}
            action={
              <Button size="small" onClick={() => void loadDashboard()}>
                Thử lại
              </Button>
            }
          />
        )}

        {!loading && !error && sortedSummaries.length === 0 && (
          <Card className="dashboard-empty-card">
            <Empty description="Chưa có dữ liệu hồ sơ." />
          </Card>
        )}

        {!loading && !error && sortedSummaries.length > 0 && (
          <>
            <div className="dashboard-summary-grid">
              <SummaryCard
                title="Tổng hồ sơ"
                value={totals.total}
                type="normal"
                icon={<BarsOutlined />}
              />

              <SummaryCard
                title="Hồ sơ đúng"
                value={totals.good}
                type="success"
                icon={<CheckCircleFilled />}
              />

              <SummaryCard
                title="Hồ sơ lỗi"
                value={totals.error}
                type="error"
                icon={<CloseCircleFilled />}
              />

              <SummaryCard
                title="Chưa kiểm tra"
                value={totals.unchecked}
                type="warning"
                icon={<ClockCircleFilled />}
              />
            </div>

            <div className="dashboard-section">
              <div className="dashboard-section-header">
                <div>
                  <div className="dashboard-section-title">Hồ sơ thanh toán theo tháng</div>

                  <div className="dashboard-section-subtitle">
                    Chọn một tháng để xem chi tiết danh sách hồ sơ
                  </div>
                </div>

                <Tag color="blue" className="dashboard-month-count">
                  {sortedSummaries.length} tháng
                </Tag>
              </div>

              <Row gutter={[16, 16]}>
                {sortedSummaries.map((item, index) => (
                  <Col
                    key={`${item.year}-${item.month}`}
                    xs={24}
                    sm={24}
                    md={12}
                    lg={8}
                    xl={8}
                    xxl={6}
                  >
                    <MonthCard item={item} latest={index === 0} onView={handleViewDetail} />
                  </Col>
                ))}
              </Row>
            </div>
          </>
        )}
      </div>

      <style>
        {`
          .dashboard-page {
            display: flex;
            flex-direction: column;
            gap: 18px;
          }

          .dashboard-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }

          .dashboard-subtitle {
            display: block;
            margin-top: 4px;
            font-size: 13px;
          }

          .dashboard-refresh-button {
            height: 36px;
            padding: 0 14px;
            border-radius: 8px;
            font-weight: 600;
          }

          .dashboard-loading {
            min-height: 330px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 14px;
          }

          .dashboard-empty-card {
            border-radius: 12px;
            border: 1px solid #e5e7eb;
          }

          .dashboard-summary-grid {
            display: grid;
            grid-template-columns:
              repeat(
                4,
                minmax(
                  0,
                  1fr
                )
              );
            gap: 12px;
          }

          .dashboard-summary-card {
            min-height: 96px;
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 16px;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            background: #ffffff;
            box-shadow:
              0
              3px
              12px
              rgba(
                15,
                23,
                42,
                0.035
              );
            transition:
              transform
              0.18s
              ease,
              box-shadow
              0.18s
              ease;
          }

          .dashboard-summary-card:hover {
            transform:
              translateY(
                -2px
              );

            box-shadow:
              0
              8px
              20px
              rgba(
                15,
                23,
                42,
                0.07
              );
          }

          .dashboard-summary-normal {
            border-left:
              4px solid
              #1677ff;
          }

          .dashboard-summary-success {
            border-left:
              4px solid
              #52c41a;
          }

          .dashboard-summary-error {
            border-left:
              4px solid
              #ff4d4f;
          }

          .dashboard-summary-warning {
            border-left:
              4px solid
              #fa8c16;
          }

          .dashboard-summary-icon {
            width: 46px;
            height: 46px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            font-size: 20px;
          }

          .dashboard-summary-icon-normal {
            color: #1677ff;
            background: #e6f4ff;
          }

          .dashboard-summary-icon-success {
            color: #389e0d;
            background: #f6ffed;
          }

          .dashboard-summary-icon-error {
            color: #ff4d4f;
            background: #fff1f0;
          }

          .dashboard-summary-icon-warning {
            color: #fa8c16;
            background: #fff7e6;
          }

          .dashboard-summary-title {
            color: #64748b;
            font-size: 12px;
            font-weight: 600;
          }

          .dashboard-summary-number {
            margin-top: 3px;
            color: #172033;
            font-size: 23px;
            line-height: 1.2;
            font-weight: 800;
          }

          .dashboard-section {
            padding: 16px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #ffffff;
          }

          .dashboard-section-header {
            margin-bottom: 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }

          .dashboard-section-title {
            color: #172033;
            font-size: 15px;
            font-weight: 700;
          }

          .dashboard-section-subtitle {
            margin-top: 2px;
            color: #94a3b8;
            font-size: 11px;
          }

          .dashboard-month-count {
            margin: 0;
            border-radius: 999px;
            font-weight: 600;
          }

          .dashboard-month-card {
            height: 100%;
            overflow: hidden;
            border:
              1px solid
              #dfe6ee !important;
            border-radius:
              12px !important;
            box-shadow:
              0
              2px
              8px
              rgba(
                15,
                23,
                42,
                0.035
              );
            transition:
              transform
              0.18s
              ease,
              box-shadow
              0.18s
              ease,
              border-color
              0.18s
              ease;
          }

          .dashboard-month-card
          .ant-card-body {
            padding:
              17px !important;
          }

          .dashboard-month-card:hover {
            transform:
              translateY(
                -2px
              );

            border-color:
              #91caff !important;

            box-shadow:
              0
              8px
              20px
              rgba(
                15,
                23,
                42,
                0.07
              );
          }

          .dashboard-month-card-latest {
            border-color:
              #b7d7ff !important;
          }

          .dashboard-month-card-top {
            min-height: 25px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
          }

          .dashboard-month-tag {
            margin: 0;
            padding: 2px 9px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 600;
          }

          .dashboard-latest-badge {
            padding:
              2px
              8px;
            border-radius:
              999px;
            color:
              #389e0d;
            background:
              #f6ffed;
            font-size:
              10px;
            font-weight: 700;
          }

          .dashboard-month-heading {
            min-height: 60px;
            margin-top: 13px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }

          .dashboard-month-title {
            color: #172033;
            font-size: 17px;
            font-weight: 800;
          }

          .dashboard-month-subtitle {
            margin-top: 2px;
            color: #94a3b8;
            font-size: 10px;
          }

          .dashboard-rate {
            min-width: 55px;
            text-align: right;
          }

          .dashboard-rate span {
            display: block;
            color: #389e0d;
            font-size: 16px;
            line-height: 1.2;
            font-weight: 800;
          }

          .dashboard-rate small {
            color: #94a3b8;
            font-size: 9px;
          }

          .dashboard-month-divider {
            height: 1px;
            margin: 13px 0 10px;
            background: #eef2f7;
          }

          .dashboard-month-stats {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .dashboard-stat-row {
            min-height: 35px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }

          .dashboard-stat-row-left {
            display: flex;
            align-items: center;
            gap: 9px;
            min-width: 0;
          }

          .dashboard-stat-icon {
            width: 25px;
            height: 25px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 7px;
            font-size: 13px;
          }

          .dashboard-stat-icon-normal {
            color: #1677ff;
            background: #e6f4ff;
          }

          .dashboard-stat-icon-success {
            color: #52c41a;
            background: #f6ffed;
          }

          .dashboard-stat-icon-error {
            color: #ff4d4f;
            background: #fff1f0;
          }

          .dashboard-stat-icon-warning {
            color: #fa8c16;
            background: #fff7e6;
          }

          .dashboard-stat-label {
            color: #475569;
            font-size: 12px;
          }

          .dashboard-number-badge {
            min-width: 45px;
            height: 24px;
            padding: 0 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
          }

          .dashboard-number-normal {
            color: #1677ff;
            border: 1px solid #91caff;
            background: #f8fbff;
          }

          .dashboard-number-success {
            color: #389e0d;
            border: 1px solid #b7eb8f;
            background: #f6ffed;
          }

          .dashboard-number-error {
            color: #ff4d4f;
            border: 1px solid #ffa39e;
            background: #fff1f0;
          }

          .dashboard-number-warning {
            color: #d46b08;
            border: 1px solid #ffd591;
            background: #fff7e6;
          }

          .dashboard-month-footer {
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid #eef2f7;
          }

          .dashboard-detail-button {
            height: 36px;
            border: 0;
            border-radius: 8px;
            color: #334155;
            background: #f5f7fa;
            font-size: 12px;
            font-weight: 700;
          }

          .dashboard-detail-button:hover {
            color: #1677ff !important;
            background: #e6f4ff !important;
          }

          @media
          (
            max-width:
              1100px
          ) {
            .dashboard-summary-grid {
              grid-template-columns:
                1fr
                1fr;
            }
          }

          @media
          (
            max-width:
              650px
          ) {
            .dashboard-header {
              flex-direction: column;
            }

            .dashboard-summary-grid {
              grid-template-columns:
                1fr;
            }

            .dashboard-refresh-button {
              width: 100%;
            }

            .dashboard-section-header {
              align-items: flex-start;
            }
          }
        `}
      </style>
    </>
  );
}
