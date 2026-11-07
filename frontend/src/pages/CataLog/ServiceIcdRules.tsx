import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";

import type { ColumnsType } from "antd/es/table";

import {
  ArrowLeftOutlined,
  CloseOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";

import { apiFetch } from "../../api/apiClient";

const { Title, Text } = Typography;

const API = "/catalog/service-icd";

const MATCH_OPTIONS = [
  {
    label: "Bắt đầu bằng",
    value: "PREFIX",
  },
  {
    label: "Chính xác",
    value: "EXACT",
  },
  {
    label: "Có chứa",
    value: "CONTAINS",
  },
];

interface FormValues {
  service_code: string;
  icd_code: string;
  match_type: string;
  active: boolean;
  note?: string | null;
}

interface RuleRow extends FormValues {
  id: string | number;
  service_name?: string | null;
}

interface GroupedRow {
  serviceCode: string;
  serviceName: string;
  rows: RuleRow[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

type StatusFilter = "active" | "inactive";

const text = (value: unknown): string => String(value ?? "").trim();

const normalize = (value: unknown): string =>
  text(value).normalize("NFC").replace(/\s+/gu, " ").toLocaleLowerCase("vi");

function getMatchLabel(value: string): string {
  return MATCH_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function getMatchColor(value: string): string {
  if (value === "EXACT") return "blue";
  if (value === "PREFIX") return "purple";
  return "cyan";
}

async function request<T>(path = "", init?: RequestInit): Promise<T | undefined> {
  const headers = new Headers(init?.headers);

  if (init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const headerObject: Record<string, string> = {};

  headers.forEach((value, key) => {
    headerObject[key] = value;
  });

  const response = await apiFetch(`${API}${path}`, {
    ...init,
    headers: headerObject,
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error(`API không trả về JSON (HTTP ${response.status}).`);
  }

  const json = (await response.json()) as ApiResponse<T>;

  if (!response.ok || json.success !== true) {
    throw new Error(json.message || json.error || `Lỗi HTTP ${response.status}`);
  }

  return json.data;
}

export default function ServiceIcd() {
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  const [form] = Form.useForm<FormValues>();

  const requestSequence = useRef(0);
  const savingRef = useRef(false);

  const [rows, setRows] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const [editing, setEditing] = useState<RuleRow | null>(null);

  const [selectedServiceCode, setSelectedServiceCode] = useState<string | undefined>();

  const [icdFilter, setIcdFilter] = useState("");

  const [status, setStatus] = useState<StatusFilter | undefined>();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const busy = saving || deletingId !== null;

  const loadData = useCallback(async () => {
    const sequence = ++requestSequence.current;

    setLoading(true);
    setError("");

    try {
      const data = await request<RuleRow[] | { items: RuleRow[] }>();

      const items = Array.isArray(data) ? data : data?.items;

      if (!Array.isArray(items)) {
        throw new Error("Danh sách cấu hình không hợp lệ.");
      }

      if (sequence === requestSequence.current) {
        setRows(items);
      }
    } catch (err) {
      if (sequence === requestSequence.current) {
        setError(err instanceof Error ? err.message : "Không thể tải danh mục.");
      }
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadData();

    return () => {
      requestSequence.current++;
    };
  }, [loadData]);

  const serviceNameMap = useMemo(() => {
    const map = new Map<string, string>();

    for (const row of rows) {
      const code = text(row.service_code);
      const name = text(row.service_name);

      if (code && name) {
        map.set(code, name);
      }
    }

    return map;
  }, [rows]);

  const serviceOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => text(row.service_code)).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, "vi"))
        .map((code) => {
          const name = serviceNameMap.get(code);

          return {
            value: code,
            label: name ? `${code} - ${name}` : code,
          };
        }),
    [rows, serviceNameMap],
  );

  const filteredRows = useMemo(() => {
    const search = normalize(icdFilter);

    return rows.filter((row) => {
      const matchesService = !selectedServiceCode || text(row.service_code) === selectedServiceCode;

      const matchesIcd = normalize(row.icd_code).includes(search);

      const matchesStatus = status === undefined || row.active === (status === "active");

      return matchesService && matchesIcd && matchesStatus;
    });
  }, [rows, selectedServiceCode, icdFilter, status]);

  const groupedRows = useMemo<GroupedRow[]>(() => {
    const groups = new Map<string, RuleRow[]>();

    for (const row of filteredRows) {
      const code = text(row.service_code);
      const items = groups.get(code) ?? [];

      items.push(row);
      groups.set(code, items);
    }

    return Array.from(groups.entries()).map(([serviceCode, items]) => ({
      serviceCode,
      serviceName: serviceNameMap.get(serviceCode) ?? "",
      rows: items,
    }));
  }, [filteredRows, serviceNameMap]);

  const currentPage = Math.min(page, Math.max(1, Math.ceil(groupedRows.length / pageSize)));

  function backToCatalog() {
    sessionStorage.setItem("catalog-active-tab", "rules");

    navigate("/catalog");
  }

  function resetFilters() {
    setSelectedServiceCode(undefined);
    setIcdFilter("");
    setStatus(undefined);
    setPage(1);
  }

  function openForm(record?: RuleRow) {
    setEditing(record ?? null);
    form.resetFields();

    form.setFieldsValue({
      service_code: record ? text(record.service_code) : (selectedServiceCode ?? ""),
      icd_code: text(record?.icd_code),
      match_type: record?.match_type || "PREFIX",
      active: record ? record.active === true : true,
      note: text(record?.note),
    });

    setModalOpen(true);
  }

  function closeForm() {
    if (savingRef.current) return;

    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  }

  async function handleSave(values: FormValues) {
    if (savingRef.current) return;

    savingRef.current = true;
    setSaving(true);

    try {
      const path = editing ? `/${encodeURIComponent(String(editing.id))}` : "";

      await request(path, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({
          service_code: text(values.service_code),
          icd_code: text(values.icd_code).toUpperCase(),
          match_type: values.match_type,
          active: values.active === true,
          note: text(values.note) || null,
        }),
      });

      messageApi.success(editing ? "Đã cập nhật cấu hình." : "Đã thêm cấu hình.");

      setModalOpen(false);
      setEditing(null);
      form.resetFields();

      await loadData();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Không thể lưu cấu hình.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleDelete(record: RuleRow) {
    setDeletingId(record.id);

    try {
      await request(`/${encodeURIComponent(String(record.id))}`, { method: "DELETE" });

      messageApi.success("Đã xóa cấu hình ICD.");

      await loadData();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Không thể xóa cấu hình.");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: ColumnsType<GroupedRow> = [
    {
      title: "STT",
      key: "index",
      width: 56,
      align: "center",
      render: (_, __, index) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: "Tên dịch vụ kỹ thuật",
      dataIndex: "serviceName",
      width: 240,
      render: (value: string) => (
        <div className={value ? "si-service-name" : "si-service-name si-muted"}>
          {value || "Chưa có tên trong danh mục"}
        </div>
      ),
    },
    {
      title: "Mã DVKT",
      dataIndex: "serviceCode",
      width: 170,
      render: (value: string) => <div className="si-code">{value || "—"}</div>,
    },
    {
      title: "Mã ICD",
      key: "icd",
      render: (_, record) => (
        <div className="si-tags">
          {record.rows.map((item) => (
            <div key={item.id} className={item.active ? "si-icd" : "si-icd si-icd-inactive"}>
              <Tooltip
                title={
                  <div>
                    <div>Kiểu so khớp: {getMatchLabel(item.match_type)}</div>

                    <div>Trạng thái: {item.active ? "Đang bật" : "Đã tắt"}</div>

                    {item.note && <div>Ghi chú: {item.note}</div>}

                    <div>Bấm để chỉnh sửa</div>
                  </div>
                }
              >
                <Button
                  type="text"
                  size="small"
                  className="si-icd-edit"
                  aria-label={`Chỉnh sửa ICD ${item.icd_code}`}
                  disabled={busy || loading}
                  onClick={() => openForm(item)}
                >
                  {item.icd_code}
                </Button>
              </Tooltip>

              <Popconfirm
                title="Xóa cấu hình ICD?"
                description={`${record.serviceCode} — ` + item.icd_code}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{
                  danger: true,
                }}
                disabled={busy || loading}
                onConfirm={() => handleDelete(item)}
              >
                <Button
                  type="text"
                  size="small"
                  className="si-icd-delete"
                  aria-label={`Xóa ICD ${item.icd_code}`}
                  icon={<CloseOutlined />}
                  disabled={busy || loading}
                  loading={deletingId === item.id}
                />
              </Popconfirm>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Kiểu so khớp",
      key: "matchType",
      width: 175,
      render: (_, record) => (
        <Space size={[4, 5]} wrap>
          {Array.from(new Set(record.rows.map((item) => item.match_type))).map((value) => (
            <Tag key={value} color={getMatchColor(value)}>
              {getMatchLabel(value)}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "Đang bật / Tổng",
      key: "active",
      width: 130,
      align: "center",
      render: (_, record) => {
        const count = record.rows.filter((item) => item.active).length;

        return (
          <Tag
            color={count === 0 ? "default" : count === record.rows.length ? "success" : "warning"}
          >
            {count}/{record.rows.length}
          </Tag>
        );
      },
    },
  ];

  return (
    <div className="si-page">
      {contextHolder}

      <Breadcrumb
        items={[
          {
            title: (
              <Button
                type="link"
                size="small"
                className="si-crumb"
                aria-label="Trang chủ"
                icon={<HomeOutlined />}
                onClick={() => navigate("/")}
              />
            ),
          },
          {
            title: (
              <Button type="link" size="small" className="si-crumb" onClick={backToCatalog}>
                Danh mục
              </Button>
            ),
          },
          { title: "DVKT - ICD" },
        ]}
      />

      <div className="si-header">
        <div>
          <Title
            level={3}
            style={{
              margin: 0,
              color: "#172033",
              fontSize: 21,
              fontWeight: 800,
            }}
          >
            <SafetyCertificateOutlined
              style={{
                marginRight: 9,
                color: "#1677ff",
              }}
            />
            DVKT - ICD
          </Title>

          <Text type="secondary" className="si-subtitle">
            Quản lý mã ICD phù hợp theo từng dịch vụ kỹ thuật
          </Text>
        </div>

        <Space size={8} wrap>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={busy || loading}
            onClick={() => openForm()}
          >
            Thêm mới
          </Button>
        </Space>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Không thể tải danh mục DVKT - ICD"
          description={error}
          action={
            <Button size="small" disabled={busy || loading} onClick={() => void loadData()}>
              Thử lại
            </Button>
          }
        />
      )}

      <div className="si-filters">
        <div className="si-filter">
          <label htmlFor="si-service">Dịch vụ kỹ thuật</label>

          <Select<string>
            id="si-service"
            showSearch
            allowClear
            optionFilterProp="label"
            value={selectedServiceCode}
            placeholder="Tìm theo mã hoặc tên DVKT"
            options={serviceOptions}
            onChange={(value) => {
              setSelectedServiceCode(value);
              setPage(1);
            }}
          />
        </div>

        <div className="si-filter">
          <label htmlFor="si-icd-search">Mã ICD</label>

          <Input
            id="si-icd-search"
            allowClear
            value={icdFilter}
            placeholder="Nhập mã ICD cần tìm"
            onChange={(event) => {
              setIcdFilter(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="si-filter">
          <label htmlFor="si-status">Trạng thái</label>

          <Select<StatusFilter>
            id="si-status"
            allowClear
            value={status}
            placeholder="Tất cả trạng thái"
            options={[
              {
                value: "active",
                label: "Đang bật",
              },
              {
                value: "inactive",
                label: "Đã tắt",
              },
            ]}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
        </div>

        <Button icon={<ReloadOutlined />} onClick={resetFilters}>
          Xóa bộ lọc
        </Button>
      </div>

      <Card
        className="si-table"
        styles={{
          body: { padding: 0 },
        }}
      >
        <Table<GroupedRow>
          rowKey="serviceCode"
          columns={columns}
          dataSource={groupedRows}
          loading={loading}
          tableLayout="fixed"
          size="middle"
          scroll={{ x: 1120 }}
          locale={{
            emptyText: error
              ? "Chưa tải được dữ liệu."
              : rows.length === 0
                ? "Chưa có cấu hình DVKT - ICD."
                : "Không có cấu hình phù hợp bộ lọc.",
          }}
          pagination={{
            current: currentPage,
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
            showTotal: (total) => `Tổng số: ${total} DVKT`,
            onChange: (nextPage, nextSize) => {
              setPage(nextSize !== pageSize ? 1 : nextPage);
              setPageSize(nextSize);
            },
          }}
        />
      </Card>

      <Text type="secondary" className="si-legend">
        Bấm mã ICD để chỉnh sửa, bấm dấu × để xóa. Khi lọc, bảng chỉ hiển thị và đếm các cấu hình
        phù hợp bộ lọc.
      </Text>

      <Modal
        open={modalOpen}
        centered
        width={720}
        destroyOnHidden
        className="si-modal"
        title={
          <div className="si-modal-heading">
            <div className="si-modal-icon">
              <SafetyCertificateOutlined />
            </div>

            <div>
              <div className="si-modal-title">
                {editing ? "Cập nhật DVKT - ICD" : "Thêm DVKT - ICD"}
              </div>

              <div className="si-subtitle">Thiết lập mã ICD phù hợp cho dịch vụ kỹ thuật</div>
            </div>
          </div>
        }
        okText={editing ? "Cập nhật" : "Thêm mới"}
        cancelText="Hủy"
        confirmLoading={saving}
        cancelButtonProps={{
          disabled: saving,
        }}
        closable={!saving}
        maskClosable={!saving}
        keyboard={!saving}
        onCancel={closeForm}
        onOk={() => form.submit()}
      >
        <Form<FormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          preserve={false}
          disabled={saving}
          onFinish={handleSave}
          style={{ marginTop: 18 }}
        >
          <Form.Item
            name="service_code"
            label="Mã DVKT"
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Vui lòng nhập mã DVKT.",
              },
            ]}
          >
            <Input placeholder="Ví dụ: 21.0014.1778" />
          </Form.Item>

          <div className="si-form-grid">
            <Form.Item
              name="icd_code"
              label="Mã ICD"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: "Vui lòng nhập mã ICD.",
                },
              ]}
            >
              <Input placeholder="Ví dụ: E11.9" />
            </Form.Item>

            <Form.Item
              name="match_type"
              label="Kiểu so khớp"
              rules={[
                {
                  required: true,
                  message: "Vui lòng chọn kiểu so khớp.",
                },
              ]}
            >
              <Select options={MATCH_OPTIONS} />
            </Form.Item>
          </div>

          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea
              autoSize={{
                minRows: 3,
                maxRows: 6,
              }}
              placeholder="Nhập ghi chú nếu có"
            />
          </Form.Item>

          <div className="si-active">
            <div>
              <Text strong>Kích hoạt quy tắc</Text>

              <Text type="secondary" className="si-subtitle">
                Áp dụng trong lần kiểm tra hồ sơ tiếp theo
              </Text>
            </div>

            <Form.Item name="active" valuePropName="checked" noStyle>
              <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <style>
        {`
          .si-page {
            display: flex;
            flex-direction: column;
            gap: 15px;
            min-width: 0;
          }

          .si-page .ant-breadcrumb {
            font-size: 12px;
          }

          .si-crumb.ant-btn {
            height: auto;
            padding: 0;
            font-size: 12px;
            line-height: inherit;
          }

          .si-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }

          .si-header .ant-btn {
            height: 36px;
            border-radius: 8px;
            font-weight: 600;
          }

          .si-subtitle {
            display: block;
            margin-top: 4px;
            color: #64748b;
            font-size: 12px;
            font-weight: 400;
            line-height: 1.6;
          }

          .si-filters {
            display: grid;
            grid-template-columns:
              minmax(0, 1.5fr)
              minmax(0, 1fr)
              minmax(160px, .7fr)
              auto;
            align-items: end;
            gap: 10px;
          }

          .si-filter {
            display: flex;
            flex-direction: column;
            min-width: 0;
            gap: 6px;
          }

          .si-filter > label {
            color: #172033;
            font-size: 12px;
            font-weight: 600;
          }

          .si-filter .ant-select {
            width: 100%;
          }

          .si-filters > .ant-btn {
            height: 32px;
            border-radius: 7px;
            font-weight: 600;
          }

          .si-table {
            min-width: 0;
            overflow: hidden;
            border: 1px solid #dfe6ee;
            border-radius: 8px;
            box-shadow:
              0 2px 8px rgba(15, 23, 42, .03);
          }

          .si-table
          .ant-table-thead > tr > th {
            background: #f2f5f8 !important;
            color: #334155;
            font-size: 12px;
            font-weight: 700;
            border-bottom: 1px solid #d8e0e8;
          }

          .si-table
          .ant-table-tbody > tr > td {
            padding: 12px;
            color: #334155;
            font-size: 12px;
            vertical-align: top;
            overflow-wrap: anywhere;
          }

          .si-table
          .ant-table-tbody > tr:hover > td {
            background: #f7fbff !important;
          }

          .si-service-name,
          .si-code {
            color: #172033;
            font-weight: 600;
            line-height: 1.7;
            white-space: normal;
            overflow-wrap: anywhere;
          }

          .si-muted {
            color: #94a3b8;
            font-weight: 400;
          }

          .si-tags {
            display: flex;
            flex-wrap: wrap;
            align-items: flex-start;
            gap: 7px;
          }

          .si-icd {
            display: inline-flex;
            align-items: center;
            max-width: 100%;
            overflow: hidden;
            border: 1px solid #bae0ff;
            border-radius: 12px;
            background: #e6f4ff;
          }

          .si-icd-edit.ant-btn {
            display: block;
            height: auto;
            min-height: 28px;
            max-width: 100%;
            padding: 4px 9px;
            color: #1677ff;
            font-size: 12px;
            font-weight: 600;
            line-height: 1.6;
            white-space: normal;
          }

          .si-icd-edit.ant-btn > span {
            white-space: normal;
            overflow-wrap: anywhere;
          }

          .si-icd-delete.ant-btn {
            flex-shrink: 0;
            width: 25px;
            height: 25px;
            margin-right: 3px;
            color: #64748b;
            font-size: 10px;
          }

          .si-icd-delete.ant-btn:hover {
            color: #ff4d4f !important;
            background: #fff1f0 !important;
          }

          .si-icd-inactive {
            border-color: #e2e8f0;
            background: #f8fafc;
          }

          .si-icd-inactive
          .si-icd-edit.ant-btn {
            color: #64748b;
          }

          .si-table .ant-tag {
            margin: 0;
            border-radius: 999px;
            font-size: 11px;
          }

          .si-table .ant-pagination {
            padding: 0 12px 10px;
          }

          .si-legend {
            margin-top: -5px;
            font-size: 11px;
            line-height: 1.7;
          }

          .si-modal .ant-modal-content {
            border-radius: 14px;
          }

          .si-modal-heading {
            display: flex;
            align-items: center;
            gap: 12px;
            padding-bottom: 8px;
          }

          .si-modal-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            width: 42px;
            height: 42px;
            border-radius: 12px;
            background: #e6f4ff;
            color: #1677ff;
            font-size: 21px;
          }

          .si-modal-title {
            color: #172033;
            font-size: 18px;
            font-weight: 800;
          }

          .si-form-grid {
            display: grid;
            grid-template-columns:
              minmax(0, 1fr)
              minmax(0, 1fr);
            column-gap: 16px;
          }

          .si-modal
          .ant-form-item-label > label {
            font-size: 12px;
            font-weight: 600;
          }

          .si-modal .ant-input,
          .si-modal .ant-select-selector {
            border-radius: 8px;
          }

          .si-modal input.ant-input {
            min-height: 36px;
          }

          .si-active {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            background: #fafcff;
          }

          .si-modal
          .ant-modal-footer .ant-btn {
            border-radius: 8px;
          }

          @media (max-width: 1000px) {
            .si-header {
              flex-direction: column;
            }

            .si-filters {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 600px) {
            .si-filters,
            .si-form-grid {
              grid-template-columns: 1fr;
            }

            .si-modal-title {
              font-size: 16px;
            }
          }
        `}
      </style>
    </div>
  );
}
