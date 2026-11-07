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
  DeleteOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";

import { apiFetch } from "../../api/apiClient";

const { Title, Text } = Typography;

const API = "/catalog/service-diagnosis";

const MATCH_OPTIONS = [
  { label: "Có chứa", value: "CONTAINS" },
  { label: "Chính xác", value: "EXACT" },
  { label: "Bắt đầu bằng", value: "STARTS_WITH" },
];

interface FormValues {
  service_code: string;
  diagnosis_pattern: string;
  match_type: string;
  active: boolean;
  note?: string | null;
}

interface RuleRow extends FormValues {
  id: string | number;
}

interface GroupedRow {
  serviceCode: string;
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

async function request<T>(path = "", init?: RequestInit): Promise<T | undefined> {
  const headers = new Headers(init?.headers);

  if (init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await apiFetch(`${API}${path}`, {
    ...init,
    headers,
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

export default function ServiceDiagnosis() {
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

  const [diagnosisFilter, setDiagnosisFilter] = useState("");

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

  const serviceOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => text(row.service_code)).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, "vi"))
        .map((value) => ({ value, label: value })),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const search = normalize(diagnosisFilter);

    return rows.filter((row) => {
      const matchesService = !selectedServiceCode || text(row.service_code) === selectedServiceCode;

      const matchesDiagnosis = normalize(row.diagnosis_pattern).includes(search);

      const matchesStatus = status === undefined || row.active === (status === "active");

      return matchesService && matchesDiagnosis && matchesStatus;
    });
  }, [rows, selectedServiceCode, diagnosisFilter, status]);

  const groupedRows = useMemo<GroupedRow[]>(() => {
    const groups = new Map<string, RuleRow[]>();

    for (const row of filteredRows) {
      const key = text(row.service_code);
      const items = groups.get(key) ?? [];

      items.push(row);
      groups.set(key, items);
    }

    return Array.from(groups.entries()).map(([serviceCode, items]) => ({
      serviceCode,
      rows: items,
    }));
  }, [filteredRows]);

  const currentPage = Math.min(page, Math.max(1, Math.ceil(groupedRows.length / pageSize)));

  function backToCatalog() {
    sessionStorage.setItem("catalog-active-tab", "rules");

    navigate("/catalog");
  }

  function openForm(record?: RuleRow) {
    setEditing(record ?? null);
    form.resetFields();

    form.setFieldsValue({
      service_code: record ? text(record.service_code) : (selectedServiceCode ?? ""),
      diagnosis_pattern: text(record?.diagnosis_pattern),
      match_type: record?.match_type ?? "CONTAINS",
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
          diagnosis_pattern: text(values.diagnosis_pattern),
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

      messageApi.success("Đã xóa cấu hình.");
      await loadData();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Không thể xóa cấu hình.");
    } finally {
      setDeletingId(null);
    }
  }

  function resetFilters() {
    setSelectedServiceCode(undefined);
    setDiagnosisFilter("");
    setStatus(undefined);
    setPage(1);
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
      title: "Mã DVKT",
      dataIndex: "serviceCode",
      width: 200,
      render: (value) => <div className="sd-code">{text(value) || "—"}</div>,
    },
    {
      title: "Chẩn đoán vào",
      key: "diagnoses",
      render: (_, record) => (
        <div className="sd-diagnoses">
          {record.rows.map((item) => (
            <div
              key={item.id}
              className={item.active ? "sd-diagnosis" : "sd-diagnosis sd-diagnosis-inactive"}
            >
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
                  className="sd-diagnosis-edit"
                  disabled={busy || loading}
                  onClick={() => openForm(item)}
                  aria-label={`Chỉnh sửa chẩn đoán ` + item.diagnosis_pattern}
                >
                  {item.diagnosis_pattern}
                </Button>
              </Tooltip>

              <Popconfirm
                title="Xóa chẩn đoán này?"
                description={item.diagnosis_pattern}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
                disabled={busy || loading}
                onConfirm={() => handleDelete(item)}
              >
                <Button
                  type="text"
                  size="small"
                  className="sd-diagnosis-delete"
                  aria-label={`Xóa chẩn đoán ` + item.diagnosis_pattern}
                  icon={<DeleteOutlined />}
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
            <Tag
              key={value}
              color={value === "EXACT" ? "blue" : value === "STARTS_WITH" ? "purple" : "cyan"}
            >
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
        const activeCount = record.rows.filter((item) => item.active).length;

        return (
          <Tag
            color={
              activeCount === 0
                ? "default"
                : activeCount === record.rows.length
                  ? "success"
                  : "warning"
            }
          >
            {activeCount}/{record.rows.length}
          </Tag>
        );
      },
    },
  ];

  return (
    <div className="sd-page">
      {contextHolder}

      <Breadcrumb
        items={[
          {
            title: (
              <Button
                type="link"
                size="small"
                className="sd-crumb"
                aria-label="Trang chủ"
                icon={<HomeOutlined />}
                onClick={() => navigate("/")}
              />
            ),
          },
          {
            title: (
              <Button type="link" size="small" className="sd-crumb" onClick={backToCatalog}>
                Danh mục
              </Button>
            ),
          },
          { title: "DVKT - Chẩn đoán vào" },
        ]}
      />

      <div className="sd-header">
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
            DVKT - Chẩn đoán vào
          </Title>

          <Text type="secondary" className="sd-subtitle">
            Quản lý chẩn đoán phù hợp theo từng dịch vụ kỹ thuật
          </Text>
        </div>

        <Space size={8} wrap>
          <Button icon={<ArrowLeftOutlined />} disabled={busy} onClick={backToCatalog}>
            Quay lại
          </Button>

          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            disabled={busy}
            onClick={() => void loadData()}
          >
            Làm mới
          </Button>

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
          message="Không thể tải danh mục DVKT - Chẩn đoán vào"
          description={error}
          action={
            <Button size="small" disabled={busy || loading} onClick={() => void loadData()}>
              Thử lại
            </Button>
          }
        />
      )}

      <div className="sd-filters">
        <div className="sd-filter">
          <label htmlFor="sd-service">Mã DVKT</label>

          <Select<string>
            id="sd-service"
            showSearch
            allowClear
            optionFilterProp="label"
            value={selectedServiceCode}
            placeholder="Tất cả DVKT"
            options={serviceOptions}
            onChange={(value) => {
              setSelectedServiceCode(value);
              setPage(1);
            }}
          />
        </div>

        <div className="sd-filter">
          <label htmlFor="sd-diagnosis-search">Chẩn đoán vào</label>

          <Input
            id="sd-diagnosis-search"
            allowClear
            value={diagnosisFilter}
            placeholder="Nhập chẩn đoán cần tìm"
            onChange={(event) => {
              setDiagnosisFilter(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="sd-filter">
          <label htmlFor="sd-status">Trạng thái</label>

          <Select<StatusFilter>
            id="sd-status"
            allowClear
            value={status}
            placeholder="Tất cả trạng thái"
            options={[
              { value: "active", label: "Đang bật" },
              { value: "inactive", label: "Đã tắt" },
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

      <Card className="sd-table" styles={{ body: { padding: 0 } }}>
        <Table<GroupedRow>
          rowKey="serviceCode"
          loading={loading}
          dataSource={groupedRows}
          columns={columns}
          tableLayout="fixed"
          size="middle"
          scroll={{ x: 960 }}
          pagination={{
            current: currentPage,
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            showTotal: (total) => `Tổng số: ${total} DVKT`,
            onChange: (nextPage, nextSize) => {
              setPage(nextSize !== pageSize ? 1 : nextPage);
              setPageSize(nextSize);
            },
          }}
          locale={{
            emptyText: error
              ? "Chưa tải được dữ liệu."
              : rows.length === 0
                ? "Chưa có cấu hình chẩn đoán."
                : "Không có cấu hình phù hợp bộ lọc.",
          }}
        />
      </Card>

      <Text type="secondary" className="sd-legend">
        Bấm vào chẩn đoán để chỉnh sửa, bấm biểu tượng thùng rác để xóa. Khi lọc, bảng chỉ hiển thị
        và đếm các cấu hình phù hợp bộ lọc.
      </Text>

      <Modal
        open={modalOpen}
        centered
        width={720}
        destroyOnHidden
        className="sd-modal"
        title={
          <div className="sd-modal-heading">
            <div className="sd-modal-icon">
              <SafetyCertificateOutlined />
            </div>

            <div>
              <div className="sd-modal-title">
                {editing ? "Cập nhật chẩn đoán vào" : "Thêm chẩn đoán vào"}
              </div>

              <div className="sd-subtitle">Thiết lập điều kiện phù hợp cho DVKT</div>
            </div>
          </div>
        }
        okText={editing ? "Cập nhật" : "Thêm mới"}
        cancelText="Hủy"
        confirmLoading={saving}
        cancelButtonProps={{ disabled: saving }}
        closable={!saving}
        maskClosable={!saving}
        keyboard={!saving}
        onCancel={closeForm}
        onOk={() => form.submit()}
      >
        <Form<FormValues>
          form={form}
          layout="vertical"
          preserve={false}
          requiredMark={false}
          disabled={saving}
          onFinish={handleSave}
          style={{ marginTop: 18 }}
        >
          <div className="sd-form-grid">
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

          <Form.Item
            name="diagnosis_pattern"
            label="Chẩn đoán vào"
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Vui lòng nhập chẩn đoán vào.",
              },
            ]}
          >
            <Input placeholder="Ví dụ: đau ngực" />
          </Form.Item>

          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 6 }}
              placeholder="Nhập ghi chú nếu có"
            />
          </Form.Item>

          <div className="sd-active">
            <div>
              <Text strong>Kích hoạt quy tắc</Text>

              <Text type="secondary" className="sd-subtitle">
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
          .sd-page {
            display: flex;
            flex-direction: column;
            gap: 15px;
            min-width: 0;
          }

          .sd-page .ant-breadcrumb {
            font-size: 12px;
          }

          .sd-crumb.ant-btn {
            height: auto;
            padding: 0;
            font-size: 12px;
            line-height: inherit;
          }

          .sd-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }

          .sd-header .ant-btn {
            height: 36px;
            border-radius: 8px;
            font-weight: 600;
          }

          .sd-subtitle {
            display: block;
            margin-top: 4px;
            color: #64748b;
            font-size: 12px;
            font-weight: 400;
            line-height: 1.6;
          }

          .sd-filters {
            display: grid;
            grid-template-columns:
              minmax(0, 1.1fr)
              minmax(0, 1.3fr)
              minmax(160px, .7fr)
              auto;
            align-items: end;
            gap: 10px;
          }

          .sd-filter {
            display: flex;
            flex-direction: column;
            min-width: 0;
            gap: 6px;
          }

          .sd-filter > label {
            color: #172033;
            font-size: 12px;
            font-weight: 600;
          }

          .sd-filter .ant-select {
            width: 100%;
          }

          .sd-filters > .ant-btn {
            height: 32px;
            border-radius: 7px;
            font-weight: 600;
          }

          .sd-table {
            min-width: 0;
            overflow: hidden;
            border: 1px solid #dfe6ee;
            border-radius: 8px;
            box-shadow:
              0 2px 8px rgba(15, 23, 42, .03);
          }

          .sd-table .ant-table-thead > tr > th {
            background: #f2f5f8 !important;
            color: #334155;
            font-size: 12px;
            font-weight: 700;
            border-bottom: 1px solid #d8e0e8;
          }

          .sd-table .ant-table-tbody > tr > td {
            padding: 12px;
            color: #334155;
            font-size: 12px;
            vertical-align: top;
            overflow-wrap: anywhere;
          }

          .sd-table
          .ant-table-tbody > tr:hover > td {
            background: #f7fbff !important;
          }

          .sd-code {
            color: #172033;
            font-weight: 600;
            line-height: 1.7;
            overflow-wrap: anywhere;
          }

          .sd-diagnoses {
            display: flex;
            flex-wrap: wrap;
            align-items: flex-start;
            gap: 7px;
          }

          .sd-diagnosis {
            display: inline-flex;
            align-items: center;
            max-width: 100%;
            overflow: hidden;
            border: 1px solid #bae0ff;
            border-radius: 12px;
            background: #e6f4ff;
          }

          .sd-diagnosis-edit.ant-btn {
            display: block;
            height: auto;
            min-height: 28px;
            max-width: 100%;
            padding: 4px 9px;
            color: #1677ff;
            font-size: 12px;
            font-weight: 600;
            line-height: 1.6;
            text-align: left;
            white-space: normal;
          }

          .sd-diagnosis-edit.ant-btn > span {
            white-space: normal;
            overflow-wrap: anywhere;
          }

          .sd-diagnosis-delete.ant-btn {
            flex-shrink: 0;
            width: 27px;
            height: 27px;
            margin-right: 2px;
            color: #64748b;
            font-size: 12px;
          }

          .sd-diagnosis-delete.ant-btn:hover {
            color: #ff4d4f !important;
            background: #fff1f0 !important;
          }

          .sd-diagnosis-inactive {
            border-color: #e2e8f0;
            background: #f8fafc;
          }

          .sd-diagnosis-inactive
          .sd-diagnosis-edit.ant-btn {
            color: #64748b;
          }

          .sd-table .ant-tag {
            margin: 0;
            border-radius: 999px;
            font-size: 11px;
          }

          .sd-table .ant-pagination {
            padding: 0 12px 10px;
          }

          .sd-legend {
            margin-top: -5px;
            font-size: 11px;
            line-height: 1.7;
          }

          .sd-modal .ant-modal-content {
            border-radius: 14px;
          }

          .sd-modal-heading {
            display: flex;
            align-items: center;
            gap: 12px;
            padding-bottom: 8px;
          }

          .sd-modal-icon {
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

          .sd-modal-title {
            color: #172033;
            font-size: 18px;
            font-weight: 800;
          }

          .sd-form-grid {
            display: grid;
            grid-template-columns:
              minmax(0, 1fr)
              minmax(0, 1fr);
            column-gap: 16px;
          }

          .sd-modal
          .ant-form-item-label > label {
            font-size: 12px;
            font-weight: 600;
          }

          .sd-modal .ant-input,
          .sd-modal .ant-select-selector {
            border-radius: 8px;
          }

          .sd-modal input.ant-input {
            min-height: 36px;
          }

          .sd-active {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            background: #fafcff;
          }

          .sd-modal .ant-modal-footer .ant-btn {
            border-radius: 8px;
          }

          @media (max-width: 1000px) {
            .sd-header {
              flex-direction: column;
            }

            .sd-filters {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 600px) {
            .sd-filters,
            .sd-form-grid {
              grid-template-columns: 1fr;
            }

            .sd-header .ant-space {
              width: 100%;
            }

            .sd-modal-title {
              font-size: 16px;
            }
          }
        `}
      </style>
    </div>
  );
}
