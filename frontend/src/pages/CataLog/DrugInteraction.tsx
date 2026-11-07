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
  DeleteOutlined,
  EditOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";

import { apiFetch } from "../../api/apiClient";

const { Title, Text } = Typography;

const API = "/catalog/drug-interaction";

interface FormValues {
  drug_name_a: string;
  drug_name_b: string;
  ingredient_a: string;
  ingredient_b: string;
  description: string;
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

type StatusFilter = "active" | "inactive";

const text = (value: unknown): string => String(value ?? "").trim();

const normalize = (value: unknown): string =>
  text(value).normalize("NFC").replace(/\s+/gu, " ").toLocaleLowerCase("vi");

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

const inputFields = [
  {
    name: "drug_name_a",
    label: "Tên thuốc",
    placeholder: "Nhập đúng tên thuốc trong XML",
  },
  {
    name: "drug_name_b",
    label: "Tên thuốc tương tác",
    placeholder: "Nhập đúng tên thuốc tương tác trong XML",
  },
  {
    name: "ingredient_a",
    label: "Hoạt chất",
    placeholder: "Nhập hoạt chất của thuốc thứ nhất",
  },
  {
    name: "ingredient_b",
    label: "Hoạt chất tương tác",
    placeholder: "Nhập hoạt chất của thuốc tương tác",
  },
] as const;

export default function DrugInteraction() {
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

  const [drugFilter, setDrugFilter] = useState("");
  const [ingredientFilter, setIngredientFilter] = useState("");

  const [status, setStatus] = useState<StatusFilter | undefined>();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const busy = saving || deletingId !== null;

  const loadData = useCallback(async () => {
    const sequence = ++requestSequence.current;

    setLoading(true);
    setError("");

    try {
      const data = await request<RuleRow[]>();

      if (!Array.isArray(data)) {
        throw new Error("Danh sách cấu hình không hợp lệ.");
      }

      if (sequence === requestSequence.current) {
        setRows(data);
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

  const filteredRows = useMemo(() => {
    const drugSearch = normalize(drugFilter);
    const ingredientSearch = normalize(ingredientFilter);

    return rows.filter((row) => {
      const matchesDrug = [row.drug_name_a, row.drug_name_b].some((value) =>
        normalize(value).includes(drugSearch),
      );

      const matchesIngredient = [row.ingredient_a, row.ingredient_b].some((value) =>
        normalize(value).includes(ingredientSearch),
      );

      const matchesStatus = status === undefined || row.active === (status === "active");

      return matchesDrug && matchesIngredient && matchesStatus;
    });
  }, [rows, drugFilter, ingredientFilter, status]);

  const currentPage = Math.min(page, Math.max(1, Math.ceil(filteredRows.length / pageSize)));

  function backToCatalog() {
    sessionStorage.setItem("catalog-active-tab", "rules");

    navigate("/catalog");
  }

  function openForm(record?: RuleRow) {
    setEditing(record ?? null);
    form.resetFields();

    form.setFieldsValue({
      drug_name_a: text(record?.drug_name_a),
      drug_name_b: text(record?.drug_name_b),
      ingredient_a: text(record?.ingredient_a),
      ingredient_b: text(record?.ingredient_b),
      description: text(record?.description),
      active: record ? record.active === true : true,
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

    if (normalize(values.drug_name_a) === normalize(values.drug_name_b)) {
      messageApi.error("Tên thuốc và tên thuốc tương tác phải khác nhau.");
      return;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      const path = editing ? `/${encodeURIComponent(String(editing.id))}` : "";

      await request(path, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({
          drug_name_a: text(values.drug_name_a),
          drug_name_b: text(values.drug_name_b),
          ingredient_a: text(values.ingredient_a),
          ingredient_b: text(values.ingredient_b),
          description: text(values.description),
          active: values.active === true,
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
    setDrugFilter("");
    setIngredientFilter("");
    setStatus(undefined);
    setPage(1);
  }

  function renderText(value: unknown) {
    return <div className="drug-pair-cell">{text(value) || "—"}</div>;
  }

  const columns: ColumnsType<RuleRow> = [
    {
      title: "STT",
      key: "index",
      width: 56,
      align: "center",
      render: (_, __, index) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: "Tên thuốc",
      dataIndex: "drug_name_a",
      width: 195,
      render: (value) => <div className="drug-pair-cell drug-pair-name">{text(value) || "—"}</div>,
    },
    {
      title: "Tên thuốc tương tác",
      dataIndex: "drug_name_b",
      width: 195,
      render: (value) => <div className="drug-pair-cell drug-pair-name">{text(value) || "—"}</div>,
    },
    {
      title: "Hoạt chất",
      dataIndex: "ingredient_a",
      width: 150,
      render: renderText,
    },
    {
      title: "Hoạt chất tương tác",
      dataIndex: "ingredient_b",
      width: 150,
      render: renderText,
    },
    {
      title: "Nội dung lỗi tương tác",
      dataIndex: "description",
      width: 300,
      render: renderText,
    },
    {
      title: "Trạng thái",
      dataIndex: "active",
      width: 105,
      align: "center",
      render: (active: boolean) => (
        <Tag color={active ? "success" : "default"}>{active ? "Đang bật" : "Đã tắt"}</Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 95,
      align: "center",
      fixed: "right",
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
            description={`${text(record.drug_name_a)} — ` + `${text(record.drug_name_b)}`}
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

  return (
    <div className="drug-pair-page">
      {contextHolder}

      <Breadcrumb
        items={[
          {
            title: (
              <Button
                type="link"
                size="small"
                className="drug-pair-crumb"
                aria-label="Trang chủ"
                icon={<HomeOutlined />}
                onClick={() => navigate("/")}
              />
            ),
          },
          {
            title: (
              <Button type="link" size="small" className="drug-pair-crumb" onClick={backToCatalog}>
                Danh mục
              </Button>
            ),
          },
          {
            title: "Tương tác thuốc - thuốc",
          },
        ]}
      />

      <div className="drug-pair-header">
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
            Tương tác thuốc - thuốc
          </Title>

          <Text type="secondary" className="drug-pair-subtitle">
            Quản lý cặp thuốc tương tác để đối chiếu tên thuốc trong hồ sơ XML
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
          message="Không thể tải danh mục tương tác thuốc"
          description={error}
          action={
            <Button size="small" disabled={busy || loading} onClick={() => void loadData()}>
              Thử lại
            </Button>
          }
        />
      )}

      <div className="drug-pair-filters">
        <div className="drug-pair-filter">
          <label htmlFor="drug-pair-drug-search">Tên thuốc / Tên thuốc tương tác</label>

          <Input
            id="drug-pair-drug-search"
            allowClear
            value={drugFilter}
            placeholder="Nhập tên thuốc cần tìm"
            onChange={(event) => {
              setDrugFilter(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="drug-pair-filter">
          <label htmlFor="drug-pair-ingredient-search">Hoạt chất / Hoạt chất tương tác</label>

          <Input
            id="drug-pair-ingredient-search"
            allowClear
            value={ingredientFilter}
            placeholder="Nhập tên hoạt chất"
            onChange={(event) => {
              setIngredientFilter(event.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="drug-pair-filter">
          <label htmlFor="drug-pair-status">Trạng thái</label>

          <Select<StatusFilter>
            id="drug-pair-status"
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

      <Card className="drug-pair-table" styles={{ body: { padding: 0 } }}>
        <Table<RuleRow>
          rowKey="id"
          columns={columns}
          dataSource={filteredRows}
          loading={loading}
          tableLayout="fixed"
          size="middle"
          scroll={{ x: 1246 }}
          locale={{
            emptyText: error
              ? "Chưa tải được dữ liệu."
              : rows.length === 0
                ? "Chưa có cấu hình tương tác thuốc."
                : "Không có cấu hình phù hợp bộ lọc.",
          }}
          pagination={{
            current: currentPage,
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            showTotal: (total) => `Tổng số: ${total}`,
            onChange: (nextPage, nextSize) => {
              setPage(nextSize !== pageSize ? 1 : nextPage);
              setPageSize(nextSize);
            },
          }}
        />
      </Card>

      <Text type="secondary" className="drug-pair-legend">
        Cấu hình đang bật được áp dụng khi chạy lại kiểm tra hồ sơ. Phát hiện cặp tên thuốc khớp sẽ
        hiển thị lỗi trên modal.
      </Text>

      <Modal
        open={modalOpen}
        centered
        width={780}
        destroyOnHidden
        className="drug-pair-modal"
        title={
          <div className="drug-pair-modal-heading">
            <div className="drug-pair-modal-icon">
              <SafetyCertificateOutlined />
            </div>

            <div>
              <div className="drug-pair-modal-title">
                {editing ? "Cập nhật tương tác thuốc" : "Thêm tương tác thuốc"}
              </div>

              <div className="drug-pair-subtitle">
                Thiết lập cặp thuốc và nội dung lỗi hiển thị trên hồ sơ
              </div>
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
          <div className="drug-pair-form-grid">
            {inputFields.map((field) => (
              <Form.Item
                key={field.name}
                name={field.name}
                label={field.label}
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: `Vui lòng nhập ` + `${field.label.toLowerCase()}.`,
                  },
                ]}
              >
                <Input placeholder={field.placeholder} />
              </Form.Item>
            ))}
          </div>

          <Form.Item
            name="description"
            label="Nội dung lỗi tương tác"
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Vui lòng nhập nội dung lỗi tương tác.",
              },
            ]}
          >
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 7 }}
              placeholder={
                "Nhập tác dụng tương tác và các điều kiện " + "đi kèm theo danh mục đã đối chiếu..."
              }
            />
          </Form.Item>

          <div className="drug-pair-active">
            <div>
              <Text strong>Kích hoạt quy tắc</Text>

              <Text type="secondary" className="drug-pair-subtitle">
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
          .drug-pair-page {
            display: flex;
            flex-direction: column;
            gap: 15px;
            min-width: 0;
          }

          .drug-pair-page .ant-breadcrumb {
            font-size: 12px;
          }

          .drug-pair-crumb.ant-btn {
            height: auto;
            padding: 0;
            font-size: 12px;
            line-height: inherit;
          }

          .drug-pair-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }

          .drug-pair-header .ant-btn {
            height: 36px;
            border-radius: 8px;
            font-weight: 600;
          }

          .drug-pair-subtitle {
            display: block;
            margin-top: 4px;
            color: #64748b;
            font-size: 12px;
            font-weight: 400;
            line-height: 1.6;
          }

          .drug-pair-filters {
            display: grid;
            grid-template-columns:
              minmax(0, 1.2fr)
              minmax(0, 1.2fr)
              minmax(160px, .7fr)
              auto;
            align-items: end;
            gap: 10px;
          }

          .drug-pair-filter {
            display: flex;
            flex-direction: column;
            min-width: 0;
            gap: 6px;
          }

          .drug-pair-filter > label {
            color: #172033;
            font-size: 12px;
            font-weight: 600;
          }

          .drug-pair-filter .ant-select {
            width: 100%;
          }

          .drug-pair-filters > .ant-btn {
            height: 32px;
            border-radius: 7px;
            font-weight: 600;
          }

          .drug-pair-table {
            min-width: 0;
            overflow: hidden;
            border: 1px solid #dfe6ee;
            border-radius: 8px;
            box-shadow:
              0 2px 8px rgba(15, 23, 42, .03);
          }

          .drug-pair-table
          .ant-table-thead > tr > th {
            background: #f2f5f8 !important;
            color: #334155;
            font-size: 12px;
            font-weight: 700;
            border-bottom: 1px solid #d8e0e8;
          }

          .drug-pair-table
          .ant-table-tbody > tr > td {
            padding: 12px;
            color: #334155;
            font-size: 12px;
            vertical-align: top;
          }

          .drug-pair-cell {
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            line-height: 1.7;
          }

          .drug-pair-name {
            color: #172033;
            font-weight: 600;
          }

          .drug-pair-table
          .ant-table-tbody > tr:hover > td {
            background: #f7fbff !important;
          }

          .drug-pair-table .ant-tag {
            margin: 0;
            border-radius: 999px;
            font-size: 11px;
          }

          .drug-pair-table .ant-pagination {
            padding: 0 12px 10px;
          }

          .drug-pair-legend {
            margin-top: -5px;
            font-size: 11px;
            line-height: 1.7;
          }

          .drug-pair-modal .ant-modal-content {
            border-radius: 14px;
          }

          .drug-pair-modal-heading {
            display: flex;
            align-items: center;
            gap: 12px;
            padding-bottom: 8px;
          }

          .drug-pair-modal-icon {
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

          .drug-pair-modal-title {
            color: #172033;
            font-size: 18px;
            font-weight: 800;
          }

          .drug-pair-form-help {
            margin-bottom: 20px;
            border-radius: 8px;
          }

          .drug-pair-form-help .ant-alert-message {
            font-size: 13px;
            font-weight: 600;
          }

          .drug-pair-form-help .ant-alert-description {
            font-size: 12px;
            line-height: 1.7;
          }

          .drug-pair-form-grid {
            display: grid;
            grid-template-columns:
              minmax(0, 1fr)
              minmax(0, 1fr);
            column-gap: 16px;
          }

          .drug-pair-modal
          .ant-form-item-label > label {
            font-size: 12px;
            font-weight: 600;
          }

          .drug-pair-modal .ant-input {
            border-radius: 8px;
          }

          .drug-pair-modal input.ant-input {
            min-height: 36px;
          }

          .drug-pair-active {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            background: #fafcff;
          }

          .drug-pair-modal .ant-modal-footer .ant-btn {
            border-radius: 8px;
          }

          @media (max-width: 1000px) {
            .drug-pair-header {
              flex-direction: column;
            }

            .drug-pair-filters {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 600px) {
            .drug-pair-filters,
            .drug-pair-form-grid {
              grid-template-columns: 1fr;
            }

            .drug-pair-header .ant-space {
              width: 100%;
            }

            .drug-pair-modal-title {
              font-size: 16px;
            }
          }
        `}
      </style>
    </div>
  );
}
