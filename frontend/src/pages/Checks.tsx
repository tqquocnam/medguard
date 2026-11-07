import { useEffect, useState } from "react";
import { Alert, Button, Select, Table, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import {
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  DatabaseOutlined,
  LoadingOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import { apiFetch } from "../api/apiClient";

interface ImportItem {
  importBatchId: string;
  dataDate: string;
  importStatus: string;
  importStartedAt: string | null;
  importFinishedAt: string | null;
}

interface DatasetResponse {
  success?: boolean;
  message?: string;
  data?: {
    items?: ImportItem[];
    total?: number;
  };
}

function isImporting(status: string) {
  return status === "PROCESSING" || status === "RUNNING";
}

function renderDate(value: string | null | undefined) {
  const date = value ? dayjs(value) : null;

  if (!date?.isValid()) {
    return <span className="mc-muted">—</span>;
  }

  return (
    <span className="mc-data-date">
      <CalendarOutlined />
      {date.format("DD/MM/YYYY")}
    </span>
  );
}

function renderDateTime(value: string | null | undefined) {
  const date = value ? dayjs(value) : null;

  if (!date?.isValid()) {
    return <span className="mc-muted">—</span>;
  }

  return (
    <div className="mc-datetime">
      <span>{date.format("DD/MM/YYYY")}</span>
      <span className="mc-time">
        <ClockCircleOutlined />
        {date.format("HH:mm:ss")}
      </span>
    </div>
  );
}

function renderImportStatus(status: string) {
  if (status === "COMPLETED") {
    return (
      <Tag className="mc-status" color="success" icon={<CheckCircleFilled />}>
        Thành công
      </Tag>
    );
  }

  if (isImporting(status)) {
    return (
      <Tag className="mc-status" color="processing" icon={<LoadingOutlined spin />}>
        Đang import
      </Tag>
    );
  }

  if (["ERROR", "FAILED", "FAILURE"].includes(status)) {
    return (
      <Tag className="mc-status" color="error" icon={<CloseCircleFilled />}>
        Thất bại
      </Tag>
    );
  }

  if (["PENDING", "QUEUED", "READY"].includes(status)) {
    return (
      <Tag className="mc-status" color="warning" icon={<ClockCircleOutlined />}>
        Chờ import
      </Tag>
    );
  }

  return <Tag className="mc-status">{status || "Chưa xác định"}</Tag>;
}

const columns: TableColumnsType<ImportItem> = [
  {
    title: "Ngày dữ liệu",
    dataIndex: "dataDate",
    width: 180,
    render: renderDate,
  },
  {
    title: "Bắt đầu import",
    dataIndex: "importStartedAt",
    width: 230,
    render: renderDateTime,
  },
  {
    title: "Kết thúc import",
    dataIndex: "importFinishedAt",
    width: 230,
    render: renderDateTime,
  },
  {
    title: "Trạng thái",
    dataIndex: "importStatus",
    width: 160,
    render: renderImportStatus,
  },
];

export default function Checks() {
  const currentYear = dayjs().year();

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(dayjs().month() + 1);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const hasImporting = items.some((item) => isImporting(item.importStatus));

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function loadDatasets(silent = false) {
      if (!silent) {
        setLoading(true);
        setError(null);
        setItems([]);
      }

      let shouldPoll = false;

      try {
        const params = new URLSearchParams({
          year: String(year),
          month: String(month),
        });

        const response = await apiFetch(`/checks/datasets?${params.toString()}`, { method: "GET" });

        if (cancelled || response.status === 401) return;

        let json: DatasetResponse;

        try {
          json = await response.json();
        } catch {
          throw new Error("Dữ liệu phản hồi không hợp lệ.");
        }

        if (!response.ok || json.success !== true) {
          throw new Error(json.message || "Không thể tải lịch sử import.");
        }

        if (cancelled) return;

        const nextItems = Array.isArray(json.data?.items) ? [...json.data.items] : [];

        nextItems.sort((a, b) => {
          const aTime = a.importStartedAt ? dayjs(a.importStartedAt).valueOf() : 0;
          const bTime = b.importStartedAt ? dayjs(b.importStartedAt).valueOf() : 0;

          return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
        });

        setItems(nextItems);
        setPage((current) =>
          Math.min(current, Math.max(1, Math.ceil(nextItems.length / pageSize))),
        );
        setError(null);
        shouldPoll = nextItems.some((item) => isImporting(item.importStatus));
      } catch (loadError) {
        if (cancelled) return;

        setError(loadError instanceof Error ? loadError.message : "Không thể tải lịch sử import.");

        shouldPoll = silent;
      } finally {
        if (!cancelled) {
          setLoading(false);

          if (shouldPoll) {
            timer = setTimeout(() => {
              void loadDatasets(true);
            }, 3000);
          }
        }
      }
    }

    void loadDatasets();

    return () => {
      cancelled = true;

      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [year, month, refreshKey, pageSize]);

  return (
    <section className="mc-page">
      <header className="mc-header">
        <div className="mc-heading">
          <div className="mc-heading-icon">
            <SafetyCertificateOutlined />
          </div>

          <div className="mc-heading-text">
            <Typography.Title level={3}>Kiểm tra hồ sơ</Typography.Title>

            <Typography.Text type="secondary">
              Lịch sử import và trạng thái xử lý dữ liệu
            </Typography.Text>
          </div>
        </div>

        {hasImporting && (
          <div className="mc-live">
            <LoadingOutlined spin />
            Đang cập nhật
          </div>
        )}
      </header>

      <div className="mc-panel">
        <div className="mc-toolbar">
          <div className="mc-toolbar-title">
            <span className="mc-section-icon">
              <DatabaseOutlined />
            </span>

            <span>Lịch sử import</span>

            <span className="mc-count">{loading ? "…" : items.length}</span>
          </div>

          <div className="mc-filters">
            <Select
              aria-label="Năm dữ liệu"
              value={year}
              className="mc-year"
              options={Array.from({ length: 11 }, (_, index) => {
                const value = currentYear + 1 - index;

                return {
                  label: `Năm ${value}`,
                  value,
                };
              })}
              onChange={(value) => {
                setYear(value);
                setPage(1);
              }}
            />

            <Select
              aria-label="Tháng dữ liệu"
              value={month}
              className="mc-month"
              options={Array.from({ length: 12 }, (_, index) => ({
                label: `Tháng ${index + 1}`,
                value: index + 1,
              }))}
              onChange={(value) => {
                setMonth(value);
                setPage(1);
              }}
            />

            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={() => {
                setPage(1);
                setRefreshKey((value) => value + 1);
              }}
            >
              Làm mới
            </Button>
          </div>
        </div>

        {error && (
          <div className="mc-error">
            <Alert type="error" showIcon title={error} />
          </div>
        )}

        <Table<ImportItem>
          className="mc-table"
          rowKey="importBatchId"
          columns={columns}
          dataSource={items}
          loading={loading}
          size="middle"
          scroll={{ x: 800 }}
          locale={{
            emptyText: (
              <div className="mc-empty">
                <div className="mc-empty-icon">
                  <DatabaseOutlined />
                </div>

                <strong>Chưa có dữ liệu import</strong>

                <span>
                  Không có đợt import trong tháng {String(month).padStart(2, "0")}/{year}
                </span>
              </div>
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (total, range) =>
              total > 0 ? `${range[0]}–${range[1]} / ${total} đợt import` : "0 đợt import",
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPageSize !== pageSize ? 1 : nextPage);
              setPageSize(nextPageSize);
            },
          }}
        />
      </div>

      <style>{`
 .mc-page {
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 18px;
          width: 100%;
          min-width: 0;
          padding: 0;
          background: transparent;
          border: none;
          border-radius: 0;
          box-shadow: none;
        }


  /* Tiêu đề cùng phong cách trang Import XML */
  .mc-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
  }

  .mc-heading {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }

  .mc-heading-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 46px;
    height: 46px;
    border: 1px solid #d8e8ff;
    border-radius: 14px;
    background: #f0f6ff;
    color: #1677ff;
    font-size: 23px;
  }

  .mc-heading-text {
    min-width: 0;
  }

  .mc-heading-text h3.ant-typography {
    margin: 0 0 5px;
    color: #172b4d;
    font-size: 23px;
    font-weight: 700;
    line-height: 1.35;
  }

  .mc-heading-text .ant-typography-secondary {
    color: #8b9ab0;
    font-size: 13px;
    line-height: 1.6;
  }

  .mc-live {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 10px;
    border: 1px solid #dfe8f5;
    border-radius: 8px;
    background: #fff;
    color: #7c8ea8;
    font-size: 11px;
  }

  /* Một khung nội dung duy nhất */
  .mc-panel {
    width: 100%;
    min-width: 0;
    border: 1px solid #dfe8f5;
    border-radius: 14px;
    background: #fff;
  }

  .mc-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 24px;
    border-bottom: 1px solid #eaf0f8;
    border-radius: 14px 14px 0 0;
    background: #fbfcfe;
  }

  .mc-toolbar-title {
    display: flex;
    align-items: center;
    gap: 9px;
    color: #344b6b;
    font-size: 13px;
    font-weight: 600;
  }

  .mc-section-icon {
    display: grid;
    place-items: center;
    width: 27px;
    height: 27px;
    border-radius: 7px;
    background: #ecf3ff;
    color: #1677ff;
    font-size: 15px;
  }

  .mc-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 23px;
    height: 21px;
    padding: 0 6px;
    border: none;
    border-radius: 5px;
    background: #edf2f8;
    color: #8192aa;
    font-size: 11px;
    font-weight: 500;
  }

  .mc-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .mc-year {
    width: 128px;
  }

  .mc-month {
    width: 120px;
  }

  .mc-filters .ant-select {
    height: 35px;
    font-size: 12px;
  }

  .mc-filters .ant-select-selector {
    border-color: #dfe7f2;
    border-radius: 8px;
    box-shadow: none;
  }

  .mc-filters > .ant-btn {
    height: 35px;
    padding-inline: 15px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    box-shadow: none;
  }

  .mc-error {
    padding: 16px 24px 0;
  }

  /* Bảng không có thêm khung bao */
  .mc-table {
    width: 100%;
    min-width: 0;
  }

  .mc-table .ant-table,
  .mc-table .ant-table-container {
    border: none;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .mc-table .ant-table-thead > tr > th {
    padding: 14px 24px;
    border-bottom: 1px solid #eaf0f8;
    background: #fff;
    color: #7d8fa8;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .mc-table .ant-table-thead > tr > th::before {
    display: none;
  }

  .mc-table .ant-table-tbody > tr > td {
    height: 66px;
    padding: 17px 24px;
    border-bottom: 1px solid #edf2f8;
    color: #344b6b;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .mc-table .ant-table-tbody > tr.ant-table-row:hover > td {
    background: #f7faff;
  }

  .mc-data-date {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    color: #344b6b;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .mc-data-date > .anticon {
    color: #8ca8cf;
    font-size: 14px;
  }

  .mc-datetime {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    white-space: nowrap;
  }

  .mc-time {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #91a0b5;
    font-size: 11px;
  }

  .mc-time > .anticon {
    font-size: 11px;
  }

  .mc-muted {
    color: #a2afc1;
  }

  .mc-page .mc-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin: 0;
    padding: 3px 9px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    line-height: 20px;
    white-space: nowrap;
  }

  .mc-page .mc-status.ant-tag-success {
    border-color: #dcefe3;
    background: #f0faf3;
    color: #31915a;
  }

  .mc-page .mc-status.ant-tag-processing {
    border-color: #dce9ff;
    background: #f0f6ff;
    color: #1677ff;
  }

  .mc-page .mc-status.ant-tag-error {
    border-color: #ffe0de;
    background: #fff3f2;
    color: #d65c57;
  }

  .mc-page .mc-status.ant-tag-warning {
    border-color: #f5e7c8;
    background: #fffbf0;
    color: #b58a31;
  }

  /* Chân bảng giống thanh cuối trang Import */
  .mc-table .ant-pagination {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 0;
    padding: 17px 24px;
    border-radius: 0 0 14px 14px;
    background: #fbfcfe;
  }

  .mc-table .ant-pagination-total-text {
    margin-right: auto;
    color: #8b9ab0;
    font-size: 12px;
  }

  .mc-table .ant-pagination-item {
    border-radius: 7px;
    font-size: 12px;
  }

  .mc-table .ant-pagination-item-active {
    background: #f0f6ff;
  }

  .mc-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 9px;
    padding: 48px 16px;
    text-align: center;
  }

  .mc-empty-icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    margin-bottom: 7px;
    border: 1px solid #dce8fc;
    border-radius: 13px;
    background: #f7faff;
    color: #1677ff;
    font-size: 23px;
  }

  .mc-empty strong {
    color: #526b8c;
    font-size: 13px;
    font-weight: 500;
  }

  .mc-empty > span {
    color: #96a4b8;
    font-size: 12px;
  }

  @media (max-width: 991px) {
    .mc-page {
      gap: 20px;
      padding: 22px 18px 18px;
    }

    .mc-toolbar {
      padding: 16px;
    }

    .mc-table .ant-table-thead > tr > th,
    .mc-table .ant-table-tbody > tr > td {
      padding-inline: 16px;
    }

    .mc-table .ant-pagination {
      padding: 14px 16px;
    }
  }

  @media (max-width: 575px) {
    .mc-page {
      gap: 18px;
      padding: 18px 12px 12px;
      border-radius: 12px;
    }

    .mc-heading {
      align-items: flex-start;
      gap: 11px;
    }

    .mc-heading-icon {
      width: 40px;
      height: 40px;
      border-radius: 11px;
      font-size: 20px;
    }

    .mc-heading-text h3.ant-typography {
      font-size: 20px;
    }

    .mc-heading-text .ant-typography-secondary {
      font-size: 12px;
    }

    .mc-toolbar {
      padding: 14px 12px;
    }

    .mc-filters {
      width: 100%;
      gap: 8px;
    }

    .mc-year,
    .mc-month {
      flex: 1;
      min-width: 100px;
    }

    .mc-filters > .ant-btn {
      flex: 1;
    }

    .mc-table .ant-pagination {
      padding: 12px;
    }

    .mc-table .ant-pagination-total-text {
      width: 100%;
      margin-right: 0;
    }

    .mc-error {
      padding: 12px 12px 0;
    }
  }
`}</style>
    </section>
  );
}
