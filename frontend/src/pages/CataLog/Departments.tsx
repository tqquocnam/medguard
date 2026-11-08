import {
  Breadcrumb,
  Button,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";

import type { TableColumnsType } from "antd";

import {
  ApartmentOutlined,
  EditOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "../../api/apiClient";
import { Link } from "react-router-dom";

const { Title, Text } = Typography;

// ======================================================
// TYPES
// ======================================================

interface DepartmentItem {
  code: string;

  name: string;

  description: string | null;

  active: boolean;

  createdAt?: string;

  updatedAt?: string;
}

interface DepartmentFormValues {
  code: string;

  name: string;

  description?: string;

  active: boolean;
}

interface DepartmentListResponse {
  success?: boolean;

  message?: string;

  data?: {
    items: DepartmentItem[];

    total: number;

    page: number;

    pageSize: number;
  };
}

// ======================================================
// COMPONENT
// ======================================================

export default function Departments() {
  // ====================================================
  // FILTER
  // ====================================================

  const [searchCode, setSearchCode] = useState("");

  const [searchName, setSearchName] = useState("");

  // ====================================================
  // DATA
  // ====================================================

  const [items, setItems] = useState<DepartmentItem[]>([]);

  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(false);

  // ====================================================
  // ADD / EDIT
  // ====================================================

  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);

  const [editingDepartment, setEditingDepartment] = useState<DepartmentItem | null>(null);

  const [form] = Form.useForm<DepartmentFormValues>();

  // ====================================================
  // LOAD
  // ====================================================

  const loadDepartments = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(page),

        pageSize: String(pageSize),
      });

      if (searchCode.trim()) {
        params.set("code", searchCode.trim());
      }

      if (searchName.trim()) {
        params.set("name", searchName.trim());
      }

      const response = await apiFetch(`/catalog/departments?${params.toString()}`, {
        method: "GET",
      });

      const json: DepartmentListResponse = await response.json();

      if (!response.ok || json.success !== true) {
        throw new Error(json.message || "Không thể tải danh mục khoa.");
      }

      setItems(json.data?.items ?? []);

      setTotal(Number(json.data?.total ?? 0));
    } catch (error) {
      console.error("Load departments error:", error);

      message.error(error instanceof Error ? error.message : "Không thể tải danh mục khoa.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchCode, searchName]);

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  // ====================================================
  // ADD
  // ====================================================

  function openAddModal() {
    setEditingDepartment(null);

    form.resetFields();

    form.setFieldsValue({
      code: "",

      name: "",

      description: "",

      active: true,
    });

    setModalOpen(true);
  }

  // ====================================================
  // EDIT
  // ====================================================

  async function openEditModal(record: DepartmentItem) {
    try {
      const response = await apiFetch(`/catalog/departments/${encodeURIComponent(record.code)}`, {
        method: "GET",
      });

      const json = await response.json();

      if (!response.ok || json.success !== true) {
        throw new Error(json.message || "Không thể tải thông tin khoa.");
      }

      const data = json.data;

      setEditingDepartment(record);

      form.setFieldsValue({
        code: data.code,

        name: data.name,

        description: data.description ?? "",

        active: Boolean(data.active),
      });

      setModalOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Không thể tải khoa.");
    }
  }

  // ====================================================
  // SAVE
  // ====================================================

  async function handleSave() {
    try {
      const values = await form.validateFields();

      setSaving(true);

      const isEdit = editingDepartment !== null;

      const endpoint = isEdit
        ? `/catalog/departments/${encodeURIComponent(editingDepartment.code)}`
        : "/catalog/departments";

      const response = await apiFetch(endpoint, {
        method: isEdit ? "PUT" : "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          code: values.code.trim(),

          name: values.name.trim(),

          description: values.description?.trim() || null,

          active: values.active,
        }),
      });

      const json = await response.json();

      if (!response.ok || json.success !== true) {
        throw new Error(json.message || "Không thể lưu khoa.");
      }

      message.success(isEdit ? "Cập nhật khoa thành công." : "Thêm khoa thành công.");

      setModalOpen(false);

      setEditingDepartment(null);

      form.resetFields();

      await loadDepartments();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) {
        return;
      }

      message.error(error instanceof Error ? error.message : "Không thể lưu khoa.");
    } finally {
      setSaving(false);
    }
  }

  // ====================================================
  // DISABLE
  // ====================================================

  function confirmDisable(record: DepartmentItem) {
    Modal.confirm({
      title: "Ngừng sử dụng khoa?",

      content: `${record.code} - ${record.name}`,

      okText: "Đồng ý",

      cancelText: "Hủy",

      okButtonProps: {
        danger: true,
      },

      onOk: async () => {
        try {
          const response = await apiFetch(
            `/catalog/departments/${encodeURIComponent(record.code)}`,
            {
              method: "DELETE",
            },
          );

          const json = await response.json();

          if (!response.ok || json.success !== true) {
            throw new Error(json.message || "Không thể ngừng sử dụng khoa.");
          }

          message.success("Đã ngừng sử dụng khoa.");

          await loadDepartments();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "Không thể ngừng sử dụng khoa.");
        }
      },
    });
  }

  // ====================================================
  // REFRESH
  // ====================================================

  function handleRefresh() {
    setSearchCode("");

    setSearchName("");

    setPage(1);
  }

  // ====================================================
  // TABLE
  // ====================================================

  const columns: TableColumnsType<DepartmentItem> = [
    {
      title: "STT",

      key: "stt",

      width: 70,

      align: "center",

      render: (_, __, index) => (page - 1) * pageSize + index + 1,
    },

    {
      title: "Mã khoa",

      dataIndex: "code",

      key: "code",

      width: 160,

      render: (value: string) => <Text strong>{value || "-"}</Text>,
    },

    {
      title: "Tên khoa",

      dataIndex: "name",

      key: "name",

      width: 300,

      render: (value: string) => value || "-",
    },

    {
      title: "Mô tả",

      dataIndex: "description",

      key: "description",

      ellipsis: true,

      render: (value: string | null) => {
        const text = value || "-";

        if (text === "-") {
          return "-";
        }

        return (
          <Tooltip title={text} placement="topLeft">
            <Text ellipsis>{text}</Text>
          </Tooltip>
        );
      },
    },

    {
      title: "Trạng thái",

      dataIndex: "active",

      key: "active",

      width: 120,

      align: "center",

      render: (value: boolean) =>
        value ? (
          <Tag color="success" className="departments-status">
            Đang dùng
          </Tag>
        ) : (
          <Tag className="departments-status">Ngừng dùng</Tag>
        ),
    },

    {
      title: "Thao tác",

      key: "actions",

      width: 105,

      align: "center",

      render: (_, record) => (
        <Space size={10}>
          <Tooltip title="Cập nhật">
            <Button
              type="text"
              size="small"
              icon={
                <EditOutlined
                  style={{
                    color: "#1677ff",
                  }}
                />
              }
              onClick={() => void openEditModal(record)}
            />
          </Tooltip>

          <Tooltip title={record.active ? "Ngừng sử dụng" : "Đã ngừng sử dụng"}>
            <Button
              type="text"
              size="small"
              disabled={!record.active}
              icon={
                <StopOutlined
                  style={{
                    color: record.active ? "#ff4d4f" : "#bfbfbf",
                  }}
                />
              }
              onClick={() => confirmDisable(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ====================================================
  // UI
  // ====================================================

  return (
    <>
      <div className="departments-page">
        {/* =================================================
            BREADCRUMB
        ================================================= */}

        <Breadcrumb
          className="departments-breadcrumb"
          items={[
            {
              title: (
                <Link to="/">
                  {" "}
                  <HomeOutlined />
                </Link>
              ),
            },

            {
              title: <Link to="/catalog">Danh mục</Link>,
            },

            {
              title: "Khoa",
            },
          ]}
        />
        {/* =================================================
            HEADER
        ================================================= */}
        <div className="departments-header">
          <div>
            <div className="departments-title-row">
              <ApartmentOutlined className="departments-title-icon" />

              <Title
                level={3}
                style={{
                  margin: 0,
                }}
              >
                Danh mục Khoa
              </Title>
            </div>

            <Text type="secondary" className="departments-subtitle">
              Quản lý danh mục khoa sử dụng trong hệ thống
            </Text>
          </div>

          <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
            Thêm mới
          </Button>
        </div>
        {/* =================================================
            FILTER
        ================================================= */}
        <div className="departments-filter-grid">
          <div className="departments-filter-item">
            <Text strong className="departments-filter-label">
              Mã khoa
            </Text>

            <Input
              value={searchCode}
              placeholder="Nhập mã khoa"
              allowClear
              onChange={(event) => {
                setSearchCode(event.target.value);

                setPage(1);
              }}
            />
          </div>

          <div className="departments-filter-item">
            <Text strong className="departments-filter-label">
              Tên khoa
            </Text>

            <Input
              value={searchName}
              placeholder="Nhập tên khoa"
              allowClear
              onChange={(event) => {
                setSearchName(event.target.value);

                setPage(1);
              }}
            />
          </div>

          <Button type="primary" icon={<ReloadOutlined />} onClick={handleRefresh}>
            Làm mới
          </Button>
        </div>
        {/* =================================================
            TABLE
        ================================================= */}
        <Table<DepartmentItem>
          className="departments-table"
          rowKey="code"
          size="middle"
          tableLayout="fixed"
          loading={loading}
          dataSource={items}
          columns={columns}
          pagination={{
            current: page,

            pageSize,

            total,

            showSizeChanger: true,

            pageSizeOptions: ["10", "50", "100"],

            showTotal: (value) => `Tổng số: ${value}`,

            onChange: (newPage, newPageSize) => {
              if (newPageSize !== pageSize) {
                setPageSize(newPageSize);

                setPage(1);

                return;
              }

              setPage(newPage);
            },
          }}
          locale={{
            emptyText: "Chưa có dữ liệu khoa",
          }}
        />
      </div>

      {/* =================================================
          MODAL
      ================================================= */}

      <Modal
        open={modalOpen}
        title={editingDepartment ? "Cập nhật Khoa" : "Thêm Khoa"}
        width={650}
        okText={editingDepartment ? "Cập nhật" : "Thêm mới"}
        cancelText="Hủy"
        confirmLoading={saving}
        onOk={() => void handleSave()}
        onCancel={() => {
          if (saving) {
            return;
          }

          setModalOpen(false);

          setEditingDepartment(null);

          form.resetFields();
        }}
      >
        <Form form={form} layout="vertical" requiredMark={false} className="departments-form">
          <div className="departments-form-grid">
            <Form.Item
              label="Mã khoa"
              name="code"
              rules={[
                {
                  required: true,

                  whitespace: true,

                  message: "Vui lòng nhập mã khoa.",
                },
              ]}
            >
              <Input placeholder="Ví dụ: KKB" disabled={editingDepartment !== null} />
            </Form.Item>

            <Form.Item
              label="Tên khoa"
              name="name"
              rules={[
                {
                  required: true,

                  whitespace: true,

                  message: "Vui lòng nhập tên khoa.",
                },
              ]}
            >
              <Input placeholder="Ví dụ: Khoa Khám bệnh" />
            </Form.Item>
          </div>

          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={4} placeholder="Mô tả khoa" />
          </Form.Item>

          <Form.Item label="Đang sử dụng" name="active" valuePropName="checked">
            <Switch checkedChildren="Đang dùng" unCheckedChildren="Ngừng dùng" />
          </Form.Item>
        </Form>
      </Modal>

      {/* =================================================
          STYLE
      ================================================= */}

      <style>
        {`
          .departments-page {
            width: 100%;
          }

          .departments-breadcrumb {
            margin-bottom: 14px;
            font-size: 12px;
          }

          .departments-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 16px;
          }

          .departments-title-row {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .departments-title-row h3 {
            margin: 0 !important;
            color: #172033 !important;
            font-size: 22px !important;
            font-weight: 800 !important;
          }

          .departments-title-icon {
            color: #1677ff;
            font-size: 25px;
          }

          .departments-subtitle {
            display: block;
            margin-top: 3px;
            font-size: 12px;
          }

          .departments-filter-grid {
            display: grid;
            grid-template-columns:
              minmax(220px, 1fr)
              minmax(320px, 1.5fr)
              auto;
            gap: 10px;
            align-items: end;
            margin-bottom: 14px;
          }

          .departments-filter-item {
            min-width: 0;
          }

          .departments-filter-label {
            display: block;
            margin-bottom: 6px;
            color: #172033;
            font-size: 12px;
            font-weight: 700;
          }

          .departments-table {
            overflow: hidden;
            border: 1px solid #e6ebf1;
            border-radius: 8px;
          }

          .departments-table .ant-table {
            border-radius: 8px;
          }

          .departments-table
          .ant-table-container {
            border-start-start-radius: 8px;
            border-start-end-radius: 8px;
          }

          .departments-table
          .ant-table-thead
          > tr
          > th {
            padding: 11px 10px !important;
            color: #172033;
            font-size: 12px;
            font-weight: 700;
            background: #f3f6f9 !important;
            border-bottom: 1px solid #e5eaf0 !important;
          }

          .departments-table
          .ant-table-tbody
          > tr
          > td {
            padding: 13px 10px !important;
            color: #202a3b;
            font-size: 12px;
            vertical-align: middle;
            border-bottom: 1px solid #edf0f5 !important;
          }

          .departments-table
          .ant-table-tbody
          > tr:hover
          > td {
            background: #f7fbff !important;
          }

          .departments-table
          .ant-pagination {
            margin: 14px 8px 6px;
          }

          .departments-status {
            margin: 0;
            border-radius: 6px;
            font-size: 11px;
          }

          .departments-form {
            margin-top: 18px;
          }

          .departments-form-grid {
            display: grid;
            grid-template-columns:
              1fr 2fr;
            gap: 16px;
          }

          @media (max-width: 800px) {
            .departments-header {
              flex-direction: column;
            }

            .departments-filter-grid {
              grid-template-columns: 1fr;
            }

            .departments-form-grid {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>
    </>
  );
}
