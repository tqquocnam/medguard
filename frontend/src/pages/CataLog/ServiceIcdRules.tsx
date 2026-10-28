
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";

import type { ColumnsType } from "antd/es/table";

import {
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";

import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

const API = "/api/catalog/service-icd-rules";

// ======================================================
// TYPES
// ======================================================

interface ServiceIcdRow {
  id: string;
  service_code: string;
  icd_code: string;
  allowed: boolean;
  active: boolean;
  note: string | null;
  created_at?: string;
}

interface GroupedServiceIcd {
  serviceCode: string;
  rows: ServiceIcdRow[];
}

interface FormValues {
  service_code: string;
  icd_code: string;
  active: boolean;
  note?: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  total?: number;
  message?: string;
  error?: string;
}

// ======================================================
// HELPERS
// ======================================================

function isRule(
  value: unknown
): value is ServiceIcdRow {
  if (!value || typeof value !== "object") {
    return false;
  }

  const r = value as Record<string, unknown>;

  return (
    typeof r.id === "string" &&
    typeof r.service_code === "string" &&
    typeof r.icd_code === "string" &&
    typeof r.allowed === "boolean" &&
    typeof r.active === "boolean"
  );
}

async function request<T>(
  path = "",
  init?: RequestInit
): Promise<ApiResponse<T>> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const contentType =
    response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      `API không trả về JSON (HTTP ${response.status}).`
    );
  }

  const body: unknown = await response.json();

  if (!body || typeof body !== "object") {
    throw new Error("Phản hồi API không hợp lệ.");
  }

  const result = body as ApiResponse<T>;

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.message ||
        result.error ||
        `Lỗi HTTP ${response.status}`
    );
  }

  return result;
}

// ======================================================
// COMPONENT
// ======================================================

export default function ServiceIcdRules() {
  const navigate = useNavigate();

  const [form] = Form.useForm<FormValues>();

  const [rows, setRows] = useState<ServiceIcdRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);

  const [editing, setEditing] =
    useState<ServiceIcdRow | null>(null);

  const [
    selectedServiceCode,
    setSelectedServiceCode,
  ] = useState<string | undefined>();

  // ======================================================
  // LOAD DATA
  // ======================================================

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result =
        await request<ServiceIcdRow[]>();

      if (
        !Array.isArray(result.data) ||
        !result.data.every(isRule)
      ) {
        throw new Error(
          "API trả về dữ liệu DVKT–ICD không hợp lệ."
        );
      }

      setRows(result.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể tải dữ liệu."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ======================================================
  // DVKT OPTIONS
  // ======================================================

  const serviceOptions = useMemo(() => {
    const codes = Array.from(
      new Set(
        rows
          .map((item) =>
            String(item.service_code ?? "").trim()
          )
          .filter(Boolean)
      )
    );

    codes.sort((a, b) => a.localeCompare(b));

    return codes.map((code) => ({
      value: code,
      label: code,
    }));
  }, [rows]);

  // ======================================================
  // FILTER
  // ======================================================

  const filteredRows = useMemo(() => {
    if (!selectedServiceCode) {
      return rows;
    }

    return rows.filter(
      (item) =>
        item.service_code === selectedServiceCode
    );
  }, [rows, selectedServiceCode]);

  // ======================================================
  // GROUP BY DVKT
  // ======================================================

  const groupedRows: GroupedServiceIcd[] =
    useMemo(() => {
      const map = new Map<
        string,
        ServiceIcdRow[]
      >();

      for (const item of filteredRows) {
        const code = item.service_code.trim();
        const list = map.get(code) ?? [];

        list.push(item);
        map.set(code, list);
      }

      return Array.from(map.entries())
        .map(([serviceCode, values]) => ({
          serviceCode,
          rows: [...values].sort((a, b) =>
            a.icd_code.localeCompare(b.icd_code)
          ),
        }))
        .sort((a, b) =>
          a.serviceCode.localeCompare(b.serviceCode)
        );
    }, [filteredRows]);

  // ======================================================
  // OPEN CREATE
  // ======================================================

  function openCreate() {
    setEditing(null);
    form.resetFields();

    form.setFieldsValue({
      service_code: selectedServiceCode ?? "",
      icd_code: "",
      active: false,
      note: "",
    });

    setModalOpen(true);
  }

  // ======================================================
  // OPEN EDIT
  // ======================================================

  function openEdit(record: ServiceIcdRow) {
    setEditing(record);
    form.resetFields();

    form.setFieldsValue({
      service_code: record.service_code,
      icd_code: record.icd_code,
      active: record.active,
      note: record.note ?? "",
    });

    setModalOpen(true);
  }

  // ======================================================
  // CLOSE MODAL
  // ======================================================

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  }

  // ======================================================
  // SAVE
  //
  // Quy tắc mới: allowed = true.
  // Khi sửa: giữ allowed hiện tại.
  // ======================================================

  async function handleSave(values: FormValues) {
    if (saving) return;

    setSaving(true);

    try {
      const payload = {
        service_code:
          values.service_code.trim().toUpperCase(),

        icd_code:
          values.icd_code.trim().toUpperCase(),

        allowed: editing?.allowed ?? true,

        active: values.active ?? false,

        note: values.note?.trim() || null,
      };

      await request<ServiceIcdRow>(
        editing
          ? `/${encodeURIComponent(editing.id)}`
          : "",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      message.success(
        editing
          ? "Cập nhật cấu hình thành công."
          : "Thêm mới cấu hình thành công."
      );

      setModalOpen(false);
      setEditing(null);
      form.resetFields();

      await loadData();
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : "Không thể lưu cấu hình."
      );
    } finally {
      setSaving(false);
    }
  }

  // ======================================================
  // DELETE
  // ======================================================

  async function handleDelete(id: string) {
    await request<unknown>(
      `/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      }
    );

    message.success("Đã xóa cấu hình.");
    await loadData();
  }

  // ======================================================
  // CONFIRM DELETE
  // ======================================================

  function confirmDelete(record: ServiceIcdRow) {
    Modal.confirm({
      title: "Xóa cấu hình DVKT – ICD?",
      centered: true,
      okText: "Xóa",
      cancelText: "Hủy",
      okButtonProps: { danger: true },

      content: (
        <div style={{ marginTop: 12 }}>
          <Text type="secondary">
            Bạn có chắc muốn xóa mã ICD này?
          </Text>

          <div className="service-icd-delete-preview">
            <div>
              <Text type="secondary">
                Mã DVKT:{" "}
              </Text>

              <Text strong>
                {record.service_code}
              </Text>
            </div>

            <div style={{ marginTop: 4 }}>
              <Text type="secondary">
                Mã ICD:{" "}
              </Text>

              <Text strong>
                {record.icd_code}
              </Text>
            </div>
          </div>

          <Text
            type="secondary"
            style={{ fontSize: 12 }}
          >
            Hành động này không thể hoàn tác.
          </Text>
        </div>
      ),

      onOk: async () => {
        try {
          await handleDelete(record.id);
        } catch (err) {
          message.error(
            err instanceof Error
              ? err.message
              : "Không thể xóa cấu hình."
          );

          throw err;
        }
      },
    });
  }

  // ======================================================
  // TABLE COLUMNS
  // ======================================================

  const columns: ColumnsType<GroupedServiceIcd> = [
    {
      title: "DVKT",
      dataIndex: "serviceCode",
      key: "serviceCode",
      width: 280,

      render: (value: string) => (
        <Text
          strong
          style={{ color: "#172033" }}
        >
          {value}
        </Text>
      ),
    },

    {
      title: "Mã ICD",
      key: "icd",

      render: (_, record) => (
        <div className="service-icd-tags">
          {record.rows.map((item) => (
            <Tag
              key={item.id}
              color={item.active ? "blue" : "default"}
              className="service-icd-tag"
              closable
              onClose={(event) => {
                event.preventDefault();
                event.stopPropagation();
                confirmDelete(item);
              }}
            >
              <span
                title={[
                  item.icd_code,
                  item.active
                    ? "Đang hoạt động"
                    : "Đang tắt",
                  item.note ?? "",
                ]
                  .filter(Boolean)
                  .join(" • ")}
                onClick={(event) => {
                  event.stopPropagation();
                  openEdit(item);
                }}
              >
                {item.icd_code}
              </span>
            </Tag>
          ))}
        </div>
      ),
    },

    {
      title: "Hoạt động",
      key: "active",
      width: 130,
      align: "center",

      render: (_, record) => {
        const activeCount = record.rows.filter(
          (item) => item.active
        ).length;

        return (
          <Tag
            color={
              activeCount === record.rows.length
                ? "success"
                : activeCount === 0
                  ? "default"
                  : "warning"
            }
            className="service-icd-status-tag"
          >
            {activeCount}/{record.rows.length}
          </Tag>
        );
      },
    },
  ];

  // ======================================================
  // UI
  // ======================================================

  return (
    <div className="service-icd-page">
      {/* BREADCRUMB */}

      <div className="service-icd-breadcrumb">
        <Breadcrumb
          items={[
            {
              title: (
                <HomeOutlined
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate("/")}
                />
              ),
            },
            {
              title: (
                <span
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    sessionStorage.setItem(
                      "catalog-active-tab",
                      "rules"
                    );

                    navigate("/catalog");
                  }}
                >
                  Danh mục
                </span>
              ),
            },
            {
              title: "DVKT - ICD",
            },
          ]}
        />
      </div>

      {/* HEADER */}

      <div className="service-icd-header">
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

            DVKT - ICD
          </Title>

          <Text
            type="secondary"
            style={{
              display: "block",
              marginTop: 4,
              fontSize: 12,
            }}
          >
            Quản lý mã ICD phù hợp theo từng dịch vụ kỹ thuật
          </Text>
        </div>

        <Space size={8} wrap>
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void loadData()}
            className="service-icd-header-button"
          >
            Làm mới
          </Button>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            className="service-icd-header-button service-icd-add-button"
          >
            Thêm mới
          </Button>
        </Space>
      </div>

      {/* ERROR */}

      {error && (
        <Alert
          type="error"
          showIcon
          message="Không thể tải danh mục DVKT - ICD"
          description={error}
          action={
            <Button
              size="small"
              onClick={() => void loadData()}
            >
              Thử lại
            </Button>
          }
        />
      )}

      {/* FILTER */}

      <div className="service-icd-filter-block">
        <div className="service-icd-filter-label">
          DVKT
        </div>

        <div className="service-icd-filter-row">
          <Select
            showSearch
            allowClear
            value={selectedServiceCode}
            placeholder="Chọn DVKT"
            optionFilterProp="label"
            options={serviceOptions}
            className="service-icd-filter-select"
            onChange={(value) =>
              setSelectedServiceCode(value)
            }
          />

          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => {
              setSelectedServiceCode(undefined);
              void loadData();
            }}
            className="service-icd-filter-refresh"
          >
            Làm mới
          </Button>
        </div>
      </div>

      {/* TABLE */}

      <Card
        className="service-icd-table-card"
        styles={{
          body: { padding: 0 },
        }}
      >
        <Table<GroupedServiceIcd>
          rowKey="serviceCode"
          loading={loading}
          dataSource={groupedRows}
          columns={columns}
          size="middle"
          scroll={{ x: 720 }}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [
              "10",
              "20",
              "50",
            ],
            showTotal: (count) =>
              `Tổng số: ${count}`,
          }}
          locale={{
            emptyText: "Chưa có dữ liệu DVKT - ICD.",
          }}
        />
      </Card>

      <div className="service-icd-legend">
        <Text type="secondary">
          Nhấp mã ICD để chỉnh sửa hoặc dấu × để xóa.
          Thẻ xanh đang hoạt động, thẻ xám đang tắt.
        </Text>
      </div>

      {/* ================================================= */}
      {/* MODAL ADD / EDIT */}
      {/* ================================================= */}

      <Modal
        open={modalOpen}
        centered
        width={600}
        destroyOnHidden
        className="service-icd-modal"
        title={
          <div className="service-icd-modal-heading">
            <div className="service-icd-modal-icon">
              <SafetyCertificateOutlined />
            </div>

            <div>
              <div className="service-icd-modal-title">
                {editing
                  ? "Cập nhật DVKT - ICD"
                  : "Thêm DVKT - ICD"}
              </div>

              <div className="service-icd-modal-description">
                Thiết lập mã ICD phù hợp với dịch vụ kỹ thuật
              </div>
            </div>
          </div>
        }
        okText={editing ? "Cập nhật" : "Thêm mới"}
        cancelText="Hủy"
        confirmLoading={saving}
        okButtonProps={{
          disabled: saving,
          style: {
            borderRadius: 8,
            fontWeight: 600,
          },
        }}
        onOk={() => form.submit()}
        onCancel={closeModal}
      >
        <Form<FormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) =>
            void handleSave(values)
          }
          style={{ marginTop: 18 }}
        >
          {/* DVKT / ICD */}

          <div className="service-icd-form-grid">
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
              <Input
                placeholder="VD: 23.0083.1523"
                maxLength={100}
              />
            </Form.Item>

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
              <Input
                placeholder="VD: E11.9"
                maxLength={100}
              />
            </Form.Item>
          </div>

          {/* GHI CHÚ */}

          <Form.Item
            name="note"
            label="Ghi chú / Diễn giải"
          >
            <Input.TextArea
              rows={3}
              maxLength={2000}
              placeholder="Nhập ghi chú nếu có..."
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          {/* HOẠT ĐỘNG */}

          <div className="service-icd-active-setting">
            <div>
              <Text strong>
                Kích hoạt quy tắc
              </Text>

              <div>
                <Text
                  type="secondary"
                  style={{ fontSize: 11 }}
                >
                  Áp dụng trong lần kiểm tra hồ sơ tiếp theo
                </Text>
              </div>
            </div>

            <Form.Item
              name="active"
              valuePropName="checked"
              noStyle
            >
              <Switch
                checkedChildren="Bật"
                unCheckedChildren="Tắt"
              />
            </Form.Item>
          </div>

          <Alert
            type="info"
            showIcon
            style={{ marginTop: 14 }}
            message="Lưu ý"
            description="Quy tắc mới mặc định được tắt. Chỉ kích hoạt khi danh sách ICD phù hợp với DVKT đã được xác minh."
          />
        </Form>
      </Modal>

      {/* ================================================= */}
      {/* STYLES */}
      {/* ================================================= */}

      <style>
        {`
          .service-icd-page {
            display: flex;
            flex-direction: column;
            gap: 15px;
            min-width: 0;
          }

          .service-icd-breadcrumb {
            margin-bottom: -2px;
            font-size: 12px;
          }

          .service-icd-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }

          .service-icd-header-button {
            height: 36px;
            border-radius: 8px;
            font-weight: 600;
          }

          .service-icd-add-button {
            box-shadow:
              0 4px 12px rgba(22,119,255,.20);
          }

          .service-icd-filter-block {
            padding: 2px 0 3px;
          }

          .service-icd-filter-label {
            margin-bottom: 6px;
            color: #172033;
            font-size: 13px;
            font-weight: 700;
          }

          .service-icd-filter-row {
            display: flex;
            align-items: center;
            gap: 9px;
          }

          .service-icd-filter-select {
            width: 310px;
            max-width: 100%;
          }

          .service-icd-filter-refresh {
            height: 34px;
            min-width: 105px;
            border-radius: 7px;
            font-weight: 600;
          }

          .service-icd-table-card {
            overflow: hidden;
            border: 1px solid #dfe6ee;
            border-radius: 8px;
            box-shadow:
              0 2px 8px rgba(15,23,42,.03);
          }

          .service-icd-table-card
          .ant-table-thead > tr > th {
            background: #f2f5f8 !important;
            color: #334155 !important;
            font-size: 12px;
            font-weight: 700 !important;
            border-bottom:
              1px solid #d8e0e8 !important;
          }

          .service-icd-table-card
          .ant-table-tbody > tr > td {
            padding: 11px 12px !important;
            color: #334155;
            font-size: 12px;
            vertical-align: middle;
          }

          .service-icd-table-card
          .ant-table-tbody > tr:hover > td {
            background: #f7fbff !important;
          }

          .service-icd-table-card .ant-pagination {
            padding: 0 12px 10px;
          }

          .service-icd-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }

          .service-icd-tag {
            display: inline-flex;
            align-items: center;
            margin: 0;
            padding: 3px 7px 3px 9px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all .18s ease;
          }

          .service-icd-tag:hover {
            transform: translateY(-1px);
            box-shadow:
              0 3px 8px rgba(22,119,255,.18);
          }

          .service-icd-tag .ant-tag-close-icon {
            margin-left: 5px;
            font-size: 10px;
            opacity: .7;
          }

          .service-icd-tag:hover .ant-tag-close-icon {
            opacity: 1;
          }

          .service-icd-status-tag {
            min-width: 46px;
            margin: 0;
            text-align: center;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
          }

          .service-icd-legend {
            margin-top: -5px;
            font-size: 11px;
          }

          .service-icd-modal .ant-modal-content {
            border-radius: 14px;
            overflow: hidden;
          }

          .service-icd-modal-heading {
            display: flex;
            align-items: center;
            gap: 12px;
            padding-bottom: 8px;
          }

          .service-icd-modal-icon {
            width: 42px;
            height: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            color: #1677ff;
            background: #e6f4ff;
            font-size: 21px;
          }

          .service-icd-modal-title {
            color: #172033;
            font-size: 18px;
            font-weight: 800;
          }

          .service-icd-modal-description {
            margin-top: 3px;
            color: #64748b;
            font-size: 12px;
            font-weight: 400;
          }

          .service-icd-form-grid {
            display: grid;
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .service-icd-active-setting {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            background: #fafcff;
          }

          .service-icd-delete-preview {
            margin: 10px 0;
            padding: 10px 12px;
            border-radius: 8px;
            background: #f5f7fa;
          }

          @media (max-width: 700px) {
            .service-icd-header {
              flex-direction: column;
            }

            .service-icd-filter-row {
              align-items: stretch;
              flex-direction: column;
            }

            .service-icd-filter-select {
              width: 100%;
            }

            .service-icd-form-grid {
              grid-template-columns: 1fr;
              gap: 0;
            }
          }
        `}
      </style>
    </div>
  );
}
