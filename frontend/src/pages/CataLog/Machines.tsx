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
  Upload,
  message,
} from "antd";
import type { TableColumnsType } from "antd";

import {
  EditOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  ToolOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "../../api/apiClient";
import { Link } from "react-router-dom";

const { Title, Text } = Typography;

// ======================================================
// TYPES
// ======================================================

interface MachineItem {
  code: string;
  name: string;
  legacyServiceCode: string | null;
  warnTimeOverlap: boolean;
  note: string | null;
  active: boolean;
  serviceCount: number;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiResponse {
  success?: boolean;
  message?: string;
}

interface MachineListResponse extends ApiResponse {
  data?: {
    items: MachineItem[];
    total: number;
    page: number;
    pageSize: number;
  };
}

interface MachineImportResponse extends ApiResponse {
  errors?: string[];
  data?: {
    totalRows: number;
    inserted: number;
    skipped: number;
  };
}

interface MachineFormValues {
  code: string;
  name: string;
  warnTimeOverlap: boolean;
  note?: string;
  active: boolean;
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`Backend trả dữ liệu không hợp lệ (HTTP ${response.status}).`);
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

// ======================================================
// COMPONENT
// ======================================================

export default function Machines() {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();

  const [form] = Form.useForm<MachineFormValues>();

  // Search / pagination
  const [searchCode, setSearchCode] = useState("");
  const [searchName, setSearchName] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reloadKey, setReloadKey] = useState(0);

  // Table
  const [items, setItems] = useState<MachineItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Create / update
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingMachine, setEditingMachine] = useState<MachineItem | null>(null);

  // Import / disable
  const [importing, setImporting] = useState(false);
  const [disablingCode, setDisablingCode] = useState<string | null>(null);

  const importLock = useRef(false);
  const saveLock = useRef(false);
  const disableLock = useRef(false);

  const busy = importing || saving || disablingCode !== null;

  // ====================================================
  // LOAD
  // ====================================================

  const loadMachines = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);

      try {
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

        const response = await apiFetch(`/catalog/machines?${params.toString()}`, {
          method: "GET",
          signal,
        });

        const json = await readJson<MachineListResponse>(response);

        if (signal.aborted) return;

        if (!response.ok || json.success !== true) {
          throw new Error(json.message || "Không thể tải danh mục máy.");
        }

        const nextTotal = Number(json.data?.total ?? 0);
        const lastPage = Math.max(1, Math.ceil(nextTotal / pageSize));

        setTotal(nextTotal);

        if (page > lastPage) {
          setPage(lastPage);
          return;
        }

        setItems(json.data?.items ?? []);
      } catch (error) {
        if (signal.aborted) return;

        messageApi.error(getErrorMessage(error, "Không thể tải danh mục máy."));
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [page, pageSize, searchCode, searchName, messageApi],
  );

  useEffect(() => {
    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      void loadMachines(controller.signal);
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadMachines, reloadKey]);

  function reloadMachines() {
    setReloadKey((value) => value + 1);
  }

  function resetSearchAndReload() {
    setSearchCode("");
    setSearchName("");
    setPage(1);
    reloadMachines();
  }

  // ====================================================
  // CREATE / UPDATE
  // ====================================================

  function openAddModal() {
    setEditingMachine(null);
    form.resetFields();

    form.setFieldsValue({
      code: "",
      name: "",
      warnTimeOverlap: false,
      note: "",
      active: true,
    });

    setModalOpen(true);
  }

  function openEditModal(machine: MachineItem) {
    setEditingMachine(machine);
    form.resetFields();

    form.setFieldsValue({
      code: machine.code,
      name: machine.name,
      warnTimeOverlap: machine.warnTimeOverlap,
      note: machine.note ?? "",
      active: machine.active,
    });

    setModalOpen(true);
  }

  function closeModal() {
    if (saveLock.current) return;

    setModalOpen(false);
    setEditingMachine(null);
    form.resetFields();
  }

  async function handleSave() {
    if (saveLock.current) return;

    saveLock.current = true;

    try {
      const values = await form.validateFields();
      setSaving(true);

      const currentMachine = editingMachine;

      const endpoint = currentMachine
        ? `/catalog/machines/${encodeURIComponent(currentMachine.code)}`
        : "/catalog/machines";

      const response = await apiFetch(endpoint, {
        method: currentMachine ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: values.code.trim(),
          name: values.name.trim(),
          warnTimeOverlap: values.warnTimeOverlap,
          note: values.note?.trim() || null,
          active: values.active,
        }),
      });

      const json = await readJson<ApiResponse>(response);

      if (!response.ok || json.success !== true) {
        throw new Error(
          json.message || (currentMachine ? "Không thể cập nhật máy." : "Không thể thêm máy."),
        );
      }

      messageApi.success(currentMachine ? "Cập nhật máy thành công." : "Thêm máy thành công.");

      setModalOpen(false);
      setEditingMachine(null);
      form.resetFields();
      reloadMachines();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) {
        return;
      }

      messageApi.error(getErrorMessage(error, "Không thể lưu máy."));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  // ====================================================
  // DISABLE
  // ====================================================

  async function handleDisable(machine: MachineItem) {
    if (disableLock.current) return;

    disableLock.current = true;
    setDisablingCode(machine.code);

    try {
      const response = await apiFetch(`/catalog/machines/${encodeURIComponent(machine.code)}`, {
        method: "DELETE",
      });

      const json = await readJson<ApiResponse>(response);

      if (!response.ok || json.success !== true) {
        throw new Error(json.message || "Không thể ngừng sử dụng máy.");
      }

      messageApi.success("Đã ngừng sử dụng máy.");
      reloadMachines();
    } catch (error) {
      messageApi.error(getErrorMessage(error, "Không thể ngừng sử dụng máy."));

      // Giữ hộp xác nhận mở khi thao tác thất bại.
      throw error;
    } finally {
      disableLock.current = false;
      setDisablingCode(null);
    }
  }

  function confirmDisable(machine: MachineItem) {
    modalApi.confirm({
      title: "Ngừng sử dụng máy?",
      content: `${machine.code} - ${machine.name}`,
      okText: "Ngừng sử dụng",
      cancelText: "Hủy",
      okButtonProps: {
        danger: true,
      },
      onOk: () => handleDisable(machine),
    });
  }

  // ====================================================
  // IMPORT EXCEL
  // ====================================================

  async function handleImportExcel(file: File) {
    if (importLock.current) return;

    if (!/\.xlsx$/i.test(file.name)) {
      messageApi.error("Vui lòng chọn file Excel .xlsx.");
      return;
    }

    if (file.size === 0) {
      messageApi.error("File Excel đang trống.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      messageApi.error("File Excel không được vượt quá 10 MB.");
      return;
    }

    importLock.current = true;
    setImporting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiFetch("/catalog/machines/import", {
        method: "POST",
        body: formData,
      });

      const json = await readJson<MachineImportResponse>(response);

      if (!response.ok || json.success !== true) {
        if (json.errors?.length) {
          modalApi.error({
            title: "Chưa thể import danh mục máy",
            width: 680,
            okText: "Đóng",
            content: (
              <div className="machines-import-errors">
                <p>{json.message || "Vui lòng kiểm tra lại dữ liệu trong file."}</p>

                <div className="machines-import-error-list">
                  {json.errors.map((error, index) => (
                    <div key={`${index}-${error}`} className="machines-import-error-item">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            ),
          });

          return;
        }

        throw new Error(
          json.message ||
            (response.status === 404
              ? "Backend chưa có API import danh mục máy."
              : "Không thể import danh mục máy."),
        );
      }

      messageApi.success(json.message || "Import danh mục máy thành công.", 5);

      resetSearchAndReload();
    } catch (error) {
      messageApi.error(getErrorMessage(error, "Không thể import danh mục máy."));
    } finally {
      importLock.current = false;
      setImporting(false);
    }
  }

  // ====================================================
  // COLUMNS
  // ====================================================

  const columns: TableColumnsType<MachineItem> = [
    {
      title: "STT",
      key: "stt",
      width: 60,
      align: "center",
      render: (_, __, index) => (page - 1) * pageSize + index + 1,
    },
    {
      title: "Mã máy",
      dataIndex: "code",
      key: "code",
      width: 220,
      ellipsis: true,
      render: (value: string) => (
        <Tooltip title={value} placement="topLeft">
          <Text strong>{value || "-"}</Text>
        </Tooltip>
      ),
    },
    {
      title: "Tên máy",
      dataIndex: "name",
      key: "name",
      width: 300,
      ellipsis: true,
      render: (value: string) => (
        <Tooltip title={value} placement="topLeft">
          {value || "-"}
        </Tooltip>
      ),
    },
    {
      title: "Cảnh báo trùng TGTH",
      dataIndex: "warnTimeOverlap",
      key: "warnTimeOverlap",
      width: 170,
      align: "center",
      render: (value: boolean) => (
        <Tag color={value ? "blue" : "default"} className="machines-pill">
          {value ? "Có" : "Không"}
        </Tag>
      ),
    },
    {
      title: "Số DVKT liên kết",
      dataIndex: "serviceCount",
      key: "serviceCount",
      width: 140,
      align: "center",
      render: (value: number) => (
        <Tag color={value > 0 ? "blue" : "default"} className="machines-count">
          {value ?? 0}
        </Tag>
      ),
    },
    {
      title: "Ghi chú",
      dataIndex: "note",
      key: "note",
      width: 260,
      ellipsis: true,
      render: (value: string | null) => (
        <Tooltip title={value} placement="topLeft">
          {value || "-"}
        </Tooltip>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "active",
      key: "active",
      width: 120,
      fixed: "right",
      align: "center",
      render: (value: boolean) => (
        <Tag color={value ? "success" : "default"} className="machines-status">
          {value ? "Đang dùng" : "Ngừng dùng"}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 100,
      fixed: "right",
      align: "center",
      render: (_, record) => (
        <Space size={6}>
          <Tooltip title="Cập nhật">
            <Button
              type="text"
              size="small"
              aria-label={`Cập nhật máy ${record.code}`}
              disabled={busy}
              icon={<EditOutlined style={{ color: "#1677ff" }} />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>

          <Tooltip title={record.active ? "Ngừng sử dụng" : "Đã ngừng sử dụng"}>
            <Button
              type="text"
              size="small"
              danger
              aria-label={`Ngừng sử dụng máy ${record.code}`}
              disabled={!record.active || busy}
              loading={disablingCode === record.code}
              icon={<StopOutlined />}
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
      {messageContextHolder}
      {modalContextHolder}

      <div className="machines-page">
        <Breadcrumb
          className="machines-breadcrumb"
          items={[
            {
              title: (
                <Link to="/">
                  <HomeOutlined />
                </Link>
              ),
            },

            {
              title: <Link to="/catalog">Danh mục</Link>,
            },

            {
              title: "Danh mục máy",
            },
          ]}
        />

        <div className="machines-header">
          <div className="machines-heading">
            <div className="machines-title-row">
              <ToolOutlined className="machines-title-icon" />

              <Title level={3}>Danh mục máy</Title>
            </div>

            <Text type="secondary" className="machines-subtitle">
              Quản lý máy thực hiện dịch vụ kỹ thuật và cấu hình cảnh báo
            </Text>
          </div>

          <Space wrap className="machines-header-actions">
            <Tooltip title="Nhập danh mục máy từ file Excel .xlsx">
              <Upload
                accept=".xlsx"
                multiple={false}
                showUploadList={false}
                disabled={busy}
                beforeUpload={(file) => {
                  void handleImportExcel(file);
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />} loading={importing} disabled={busy}>
                  {importing ? "Đang import..." : "Import Excel"}
                </Button>
              </Upload>
            </Tooltip>

            <Button type="primary" icon={<PlusOutlined />} disabled={busy} onClick={openAddModal}>
              Thêm mới
            </Button>
          </Space>
        </div>

        <div className="machines-filter-grid">
          <div className="machines-filter-item">
            <label htmlFor="machines-search-code" className="machines-filter-label">
              Mã máy
            </label>

            <Input
              id="machines-search-code"
              value={searchCode}
              placeholder="Nhập mã máy"
              allowClear
              disabled={importing}
              onChange={(event) => {
                setSearchCode(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="machines-filter-item">
            <label htmlFor="machines-search-name" className="machines-filter-label">
              Tên máy
            </label>

            <Input
              id="machines-search-name"
              value={searchName}
              placeholder="Nhập tên máy"
              allowClear
              disabled={importing}
              onChange={(event) => {
                setSearchName(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <Button
            type="primary"
            icon={<ReloadOutlined />}
            disabled={busy}
            onClick={resetSearchAndReload}
          >
            Làm mới
          </Button>
        </div>

        <Table<MachineItem>
          className="machines-table"
          rowKey="code"
          size="middle"
          tableLayout="fixed"
          loading={loading}
          dataSource={items}
          columns={columns}
          scroll={{ x: 1370 }}
          pagination={{
            current: page,
            pageSize,
            total,
            disabled: importing,
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
            emptyText: "Chưa có dữ liệu máy",
          }}
        />
      </div>

      <Modal
        open={modalOpen}
        title={editingMachine ? "Cập nhật máy" : "Thêm máy"}
        width={720}
        okText={editingMachine ? "Cập nhật" : "Thêm mới"}
        cancelText="Hủy"
        confirmLoading={saving}
        cancelButtonProps={{ disabled: saving }}
        closable={!saving}
        keyboard={!saving}
        onOk={() => void handleSave()}
        onCancel={closeModal}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          disabled={saving}
          className="machines-form"
        >
          <div className="machines-form-grid machines-form-grid-main">
            <Form.Item
              label="Mã máy"
              name="code"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: "Vui lòng nhập mã máy.",
                },
              ]}
            >
              <Input placeholder="Nhập mã máy" />
            </Form.Item>

            <Form.Item
              label="Tên máy"
              name="name"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: "Vui lòng nhập tên máy.",
                },
              ]}
            >
              <Input placeholder="Nhập tên máy" />
            </Form.Item>
          </div>

          <div className="machines-form-grid machines-form-grid-config">
            <Form.Item label="Cảnh báo trùng TGTH" name="warnTimeOverlap" valuePropName="checked">
              <Switch checkedChildren="Có" unCheckedChildren="Không" />
            </Form.Item>

            <Form.Item label="Ghi chú" name="note">
              <Input placeholder="Nhập ghi chú" />
            </Form.Item>
          </div>

          <Form.Item label="Đang sử dụng" name="active" valuePropName="checked">
            <Switch checkedChildren="Đang dùng" unCheckedChildren="Ngừng dùng" />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .machines-page {
          width: 100%;
          min-width: 0;
        }

        .machines-breadcrumb {
          margin-bottom: 14px;
          font-size: 12px;
        }

        .machines-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .machines-heading {
          min-width: 0;
        }

        .machines-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .machines-title-row h3 {
          margin: 0 !important;
          color: #172033 !important;
          font-size: 22px !important;
          font-weight: 800 !important;
        }

        .machines-title-icon {
          flex-shrink: 0;
          color: #1677ff;
          font-size: 25px;
        }

        .machines-subtitle {
          display: block;
          margin-top: 4px;
          font-size: 12px;
        }

        .machines-header-actions {
          flex-shrink: 0;
        }

        .machines-header-actions .ant-btn {
          border-radius: 7px;
          font-weight: 500;
        }

        .machines-filter-grid {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(0, 1.4fr)
            auto;
          gap: 10px;
          align-items: end;
          margin-bottom: 14px;
        }

        .machines-filter-item {
          min-width: 0;
        }

        .machines-filter-label {
          display: block;
          margin-bottom: 6px;
          color: #172033;
          font-size: 12px;
          font-weight: 700;
        }

        .machines-table {
          overflow: hidden;
          border: 1px solid #e6ebf1;
          border-radius: 8px;
        }

        .machines-table .ant-table {
          border-radius: 8px;
        }

        .machines-table .ant-table-container {
          border-start-start-radius: 8px;
          border-start-end-radius: 8px;
        }

        .machines-table .ant-table-thead > tr > th {
          padding: 11px 10px !important;
          color: #172033;
          font-size: 12px;
          font-weight: 700;
          background: #f3f6f9 !important;
          border-bottom: 1px solid #e5eaf0 !important;
        }

        .machines-table .ant-table-tbody > tr > td {
          padding: 13px 10px !important;
          color: #202a3b;
          font-size: 12px;
          vertical-align: middle;
          border-bottom: 1px solid #edf0f5 !important;
        }

        .machines-table .ant-table-tbody > tr:hover > td {
          background: #f7fbff !important;
        }

        .machines-table .ant-table-cell-fix-right {
          background: #ffffff;
        }

        .machines-table
        .ant-table-thead
        .ant-table-cell-fix-right {
          background: #f3f6f9 !important;
        }

        .machines-table .ant-pagination {
          margin: 14px 8px 8px;
        }

        .machines-status,
        .machines-pill,
        .machines-count {
          margin: 0;
          border-radius: 6px;
          font-size: 11px;
        }

        .machines-form {
          margin-top: 18px;
        }

        .machines-form-grid {
          display: grid;
          gap: 16px;
        }

        .machines-form-grid-main {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
        }

        .machines-form-grid-config {
          grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
        }

        .machines-import-errors {
          margin-top: 12px;
        }

        .machines-import-errors p {
          margin: 0 0 12px;
          line-height: 1.6;
        }

        .machines-import-error-list {
          max-height: 320px;
          overflow-y: auto;
          padding: 12px 14px;
          border: 1px solid #ffccc7;
          border-radius: 8px;
          background: #fff2f0;
        }

        .machines-import-error-item {
          color: #a8071a;
          font-size: 13px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .machines-import-error-item + .machines-import-error-item {
          margin-top: 6px;
        }

        @media (max-width: 800px) {
          .machines-header {
            flex-direction: column;
            gap: 12px;
          }

          .machines-header-actions {
            width: 100%;
          }

          .machines-filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .machines-filter-grid > .ant-btn {
            grid-column: 1 / -1;
            justify-self: end;
          }
        }

        @media (max-width: 520px) {
          .machines-filter-grid,
          .machines-form-grid-main,
          .machines-form-grid-config {
            grid-template-columns: minmax(0, 1fr);
          }

          .machines-filter-grid > .ant-btn {
            width: 100%;
          }

          .machines-title-row h3 {
            font-size: 20px !important;
          }
        }
      `}</style>
    </>
  );
}
