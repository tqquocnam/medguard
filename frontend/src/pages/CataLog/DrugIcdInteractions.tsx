import { useCallback, useEffect, useMemo, useState } from "react";

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
  DeleteOutlined,
  EditOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";

import { apiFetch } from "../../api/apiClient";

const { Title, Text } = Typography;

const API = "/catalog/drug-icd-interactions";

// ======================================================
// TYPES
// ======================================================

type MatchType = "EXACT" | "PREFIX";

interface FormValues {
  active_ingredient: string;
  icd_code: string;
  icd_name?: string | null;
  match_type: MatchType;
  note: string;
  active: boolean;
}

interface RuleRow extends FormValues {
  id: string | number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ======================================================
// API
// ======================================================

async function request<T>(path = "", init?: RequestInit): Promise<T | undefined> {
  const response = await apiFetch(`${API}${path}`, {
    ...init,

    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
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

// ======================================================
// COMPONENT
// ======================================================

export default function DrugIcdInteractions() {
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  const [form] = Form.useForm<FormValues>();

  const [rows, setRows] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const [editing, setEditing] = useState<RuleRow | null>(null);

  const [ingredient, setIngredient] = useState("");
  const [icd, setIcd] = useState("");

  const [status, setStatus] = useState<string | undefined>();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const busy = saving || deletingId !== null;

  // ====================================================
  // LOAD
  // ====================================================

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await request<RuleRow[]>();

      if (!Array.isArray(data)) {
        throw new Error("Danh sách cấu hình không hợp lệ.");
      }

      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải danh mục.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ====================================================
  // FILTER
  // ====================================================

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.active_ingredient
            .toLocaleLowerCase()
            .includes(ingredient.trim().toLocaleLowerCase()) &&
          `${row.icd_code} ${row.icd_name ?? ""}`
            .toLocaleLowerCase()
            .includes(icd.trim().toLocaleLowerCase()) &&
          (status === undefined || row.active === (status === "active")),
      ),
    [rows, ingredient, icd, status],
  );

  // ====================================================
  // MODAL
  // ====================================================

  function openForm(record?: RuleRow) {
    setEditing(record ?? null);
    form.resetFields();

    form.setFieldsValue(
      record ?? {
        active_ingredient: "",
        icd_code: "",
        icd_name: "",
        match_type: "EXACT",
        note: "",
        active: true,
      },
    );

    setModalOpen(true);
  }

  function closeForm() {
    if (saving) return;

    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  }

  // ====================================================
  // SAVE
  // ====================================================

  async function handleSave(values: FormValues) {
    if (saving) return;

    setSaving(true);

    try {
      const path = editing ? `/${encodeURIComponent(String(editing.id))}` : "";

      await request(path, {
        method: editing ? "PUT" : "POST",

        body: JSON.stringify({
          ...values,

          active_ingredient: values.active_ingredient.trim(),

          icd_code: values.icd_code.trim().toUpperCase(),

          icd_name: values.icd_name?.trim() || null,

          note: values.note.trim(),
        }),
      });

      messageApi.success(editing ? "Đã cập nhật cấu hình." : "Đã thêm cấu hình.");

      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      setPage(1);

      await loadData();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Không thể lưu cấu hình.");
    } finally {
      setSaving(false);
    }
  }

  // ====================================================
  // DELETE
  // ====================================================

  async function handleDelete(record: RuleRow) {
    setDeletingId(record.id);

    try {
      await request(`/${encodeURIComponent(String(record.id))}`, { method: "DELETE" });

      messageApi.success("Đã xóa cấu hình.");

      setPage(1);

      await loadData();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Không thể xóa cấu hình.");
    } finally {
      setDeletingId(null);
    }
  }

  function refresh() {
    setIngredient("");
    setIcd("");
    setStatus(undefined);
    setPage(1);

    void loadData();
  }

  // ====================================================
  // TABLE
  // ====================================================

  const columns: ColumnsType<RuleRow> = [
    {
      title: "STT",
      key: "index",
      width: 60,
      align: "center",

      render: (_, __, index) => (page - 1) * pageSize + index + 1,
    },

    {
      title: "Hoạt chất",
      dataIndex: "active_ingredient",
      width: 260,
    },

    {
      title: "Mã ICD",
      dataIndex: "icd_code",
      width: 100,

      render: (value) => (
        <Text
          strong
          style={{
            color: "#1677ff",
            fontSize: 12,
          }}
        >
          {value}
        </Text>
      ),
    },

    {
      title: "Tên ICD",
      dataIndex: "icd_name",
      width: 240,
      render: (value) => value || "—",
    },

    {
      title: "Cách khớp ICD",
      dataIndex: "match_type",
      width: 145,

      render: (value: MatchType) => (
        <Tag color={value === "EXACT" ? "blue" : "purple"}>
          {value === "EXACT" ? "Chính xác" : "Theo nhóm ICD"}
        </Tag>
      ),
    },

    {
      title: "Nội dung cảnh báo",
      dataIndex: "note",
      width: 250,
    },

    {
      title: "Trạng thái",
      dataIndex: "active",
      width: 120,
      align: "center",

      render: (value: boolean) => (
        <Tag color={value ? "success" : "default"}>{value ? "Đang bật" : "Đã tắt"}</Tag>
      ),
    },

    {
      title: "Thao tác",
      key: "actions",
      width: 100,
      fixed: "right",
      align: "center",

      render: (_, record) => (
        <Space size={2}>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              size="small"
              aria-label="Chỉnh sửa cấu hình"
              icon={<EditOutlined />}
              disabled={busy || loading}
              onClick={() => openForm(record)}
              style={{ color: "#1677ff" }}
            />
          </Tooltip>

          <Popconfirm
            title="Xóa cấu hình tương tác?"
            description={`${record.active_ingredient} — ${record.icd_code}`}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            disabled={busy || loading}
            onConfirm={() => handleDelete(record)}
          >
            <Button
              danger
              type="text"
              size="small"
              aria-label="Xóa cấu hình"
              icon={<DeleteOutlined />}
              disabled={busy || loading}
              loading={deletingId === record.id}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ====================================================
  // UI
  // ====================================================

  return (
    <div className="drug-icd-page">
      {contextHolder}

      <Breadcrumb
        items={[
          {
            title: (
              <a onClick={() => navigate("/")} aria-label="Trang chủ">
                <HomeOutlined />
              </a>
            ),
          },
          {
            title: (
              <a
                onClick={() => {
                  sessionStorage.setItem("catalog-active-tab", "rules");

                  navigate("/catalog");
                }}
              >
                Danh mục
              </a>
            ),
          },
          {
            title: "Tương tác thuốc - ICD",
          },
        ]}
      />

      <div className="drug-icd-header">
        <div>
          <Title
            level={3}
            style={{
              margin: 0,
              color: "#172033",
              fontWeight: 800,
              fontSize: 21,
            }}
          >
            <SafetyCertificateOutlined
              style={{
                marginRight: 9,
                color: "#1677ff",
              }}
            />
            Tương tác thuốc - ICD
          </Title>

          <Text type="secondary" className="drug-icd-subtitle">
            Quản lý cấu hình cảnh báo hoạt chất theo chẩn đoán ICD
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
          title="Không thể tải danh mục tương tác thuốc - ICD"
          description={error}
          action={
            <Button size="small" disabled={busy || loading} onClick={() => void loadData()}>
              Thử lại
            </Button>
          }
        />
      )}

      <div className="drug-icd-filters">
        <label>
          Hoạt chất
          <Input
            allowClear
            value={ingredient}
            placeholder="Nhập tên hoạt chất"
            onChange={(event) => {
              setIngredient(event.target.value);

              setPage(1);
            }}
          />
        </label>

        <label>
          Mã ICD / Tên ICD
          <Input
            allowClear
            value={icd}
            placeholder="Nhập mã hoặc tên ICD"
            onChange={(event) => {
              setIcd(event.target.value);
              setPage(1);
            }}
          />
        </label>

        <label>
          Trạng thái
          <Select
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
        </label>

        <Button
          type="primary"
          icon={<ReloadOutlined />}
          disabled={busy || loading}
          onClick={refresh}
        >
          Làm mới
        </Button>
      </div>

      <Card
        className="drug-icd-table"
        styles={{
          body: { padding: 0 },
        }}
      >
        <Table<RuleRow>
          rowKey="id"
          columns={columns}
          dataSource={filteredRows}
          loading={loading}
          size="middle"
          scroll={{ x: 1275 }}
          locale={{
            emptyText: error ? "Chưa tải được dữ liệu." : "Chưa có cấu hình tương tác thuốc - ICD.",
          }}
          pagination={{
            current: page,
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],

            showTotal: (total) => `Tổng số: ${total}`,

            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            },
          }}
        />
      </Card>

      <Text type="secondary" className="drug-icd-legend">
        Cấu hình đang bật được áp dụng khi chạy lại kiểm tra hồ sơ.
      </Text>

      <Modal
        open={modalOpen}
        centered
        width={680}
        destroyOnHidden
        className="drug-icd-modal"
        title={
          <div className="drug-icd-modal-heading">
            <div className="drug-icd-modal-icon">
              <SafetyCertificateOutlined />
            </div>

            <div>
              <div className="drug-icd-modal-title">
                {editing ? "Cập nhật tương tác thuốc - ICD" : "Thêm tương tác thuốc - ICD"}
              </div>

              <div className="drug-icd-subtitle">Thiết lập hoạt chất và mã ICD cần cảnh báo</div>
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
          disabled={saving}
          onFinish={handleSave}
          style={{ marginTop: 18 }}
        >
          <Form.Item
            name="active_ingredient"
            label="Hoạt chất"
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Vui lòng nhập hoạt chất.",
              },
            ]}
            extra="Nhập đúng tên hoạt chất hoặc tổ hợp hoạt chất trong Danh mục Thuốc."
          >
            <Input placeholder="VD: Calci carbonat + vitamin D3" />
          </Form.Item>

          <div className="drug-icd-form-grid">
            <Form.Item
              name="icd_code"
              label="Mã ICD-10"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: "Vui lòng nhập mã ICD.",
                },
              ]}
            >
              <Input placeholder="VD: N20 hoặc K29.9" maxLength={100} />
            </Form.Item>

            <Form.Item name="icd_name" label="Tên ICD">
              <Input placeholder="Nhập tên chẩn đoán" />
            </Form.Item>
          </div>

          <Form.Item
            name="match_type"
            label="Cách khớp ICD"
            rules={[
              {
                required: true,
                message: "Vui lòng chọn cách khớp ICD.",
              },
            ]}
          >
            <Select
              options={[
                {
                  value: "EXACT",
                  label: "Chính xác mã ICD",
                },
                {
                  value: "PREFIX",
                  label: "Theo nhóm ICD (Ví dụ N20 gồm N20.0, N20.1...)",
                },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="note"
            label="Nội dung cảnh báo"
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Vui lòng nhập nội dung cảnh báo.",
              },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Nhập nội dung hiển thị khi phát hiện tương tác..."
            />
          </Form.Item>

          <div className="drug-icd-active">
            <div>
              <Text strong>Kích hoạt quy tắc</Text>

              <Text type="secondary" className="drug-icd-subtitle">
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
          .drug-icd-page {
            display: flex;
            flex-direction: column;
            gap: 15px;
            min-width: 0;
          }

          .drug-icd-page .ant-breadcrumb {
            font-size: 12px;
          }

          .drug-icd-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }

          .drug-icd-header .ant-btn {
            height: 36px;
            border-radius: 8px;
            font-weight: 600;
          }

          .drug-icd-subtitle {
            display: block;
            margin-top: 4px;
            font-size: 12px;
            color: #64748b;
            font-weight: 400;
          }

          .drug-icd-filters {
            display: grid;
            grid-template-columns:
              minmax(0, 1.5fr)
              minmax(0, 1fr)
              minmax(160px, .7fr)
              auto;
            gap: 10px;
            align-items: end;
          }

          .drug-icd-filters label {
            display: flex;
            flex-direction: column;
            gap: 6px;
            font-size: 12px;
            font-weight: 600;
            color: #172033;
          }

          .drug-icd-filters .ant-select {
            width: 100%;
          }

          .drug-icd-filters > .ant-btn {
            height: 32px;
            border-radius: 7px;
            font-weight: 600;
          }

          .drug-icd-table {
            overflow: hidden;
            border: 1px solid #dfe6ee;
            border-radius: 8px;
            box-shadow:
              0 2px 8px rgba(15, 23, 42, .03);
          }

          .drug-icd-table
          .ant-table-thead > tr > th {
            background: #f2f5f8 !important;
            color: #334155;
            font-size: 12px;
            font-weight: 700;
            border-bottom: 1px solid #d8e0e8;
          }

          .drug-icd-table
          .ant-table-tbody > tr > td {
            padding: 11px 12px;
            color: #334155;
            font-size: 12px;
            vertical-align: middle;
            overflow-wrap: anywhere;
          }

          .drug-icd-table
          .ant-table-tbody > tr:hover > td {
            background: #f7fbff !important;
          }

          .drug-icd-table .ant-tag {
            margin: 0;
            border-radius: 999px;
            font-size: 11px;
          }

          .drug-icd-table .ant-pagination {
            padding: 0 12px 10px;
          }

          .drug-icd-legend {
            margin-top: -5px;
            font-size: 11px;
          }

          .drug-icd-modal .ant-modal-content {
            border-radius: 14px;
          }

          .drug-icd-modal-heading {
            display: flex;
            align-items: center;
            gap: 12px;
            padding-bottom: 8px;
          }

          .drug-icd-modal-icon {
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

          .drug-icd-modal-title {
            color: #172033;
            font-size: 18px;
            font-weight: 800;
          }

          .drug-icd-form-grid {
            display: grid;
            grid-template-columns:
              minmax(0, 1fr)
              minmax(0, 2fr);
            gap: 12px;
          }

          .drug-icd-modal
          .ant-form-item-label > label {
            font-weight: 600;
            font-size: 12px;
          }

          .drug-icd-modal .ant-input,
          .drug-icd-modal .ant-select-selector {
            border-radius: 8px;
          }

          .drug-icd-active {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            background: #fafcff;
          }

          @media (max-width: 900px) {
            .drug-icd-filters {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 600px) {
            .drug-icd-header {
              flex-direction: column;
            }

            .drug-icd-filters,
            .drug-icd-form-grid {
              grid-template-columns: 1fr;
            }

            .drug-icd-form-grid {
              gap: 0;
            }
          }
        `}
      </style>
    </div>
  );
}
