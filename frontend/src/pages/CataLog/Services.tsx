import {
  Alert,
  Breadcrumb,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message,
} from "antd";

import type { TableColumnsType, UploadFile } from "antd";

import {
  EditOutlined,
  HomeOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "../../api/apiClient";
import { Link } from "react-router-dom";

const { Title, Text } = Typography;

// ======================================================
// TYPES
// ======================================================

interface MachineOption {
  code: string;

  name: string;

  warnTimeOverlap: boolean;
}

interface ServiceItem {
  code: string;

  name: string;

  groupCode: string | null;

  unitPrice: number;

  decisionNo: string | null;

  requiresResult: boolean;

  requiresMachine: boolean;

  allowSimultaneous: boolean;

  minDurationMinutes: number;

  maxDurationMinutes: number;

  nextExecutionDays: number;

  note: string | null;

  active: boolean;

  machines: MachineOption[];

  machineCount: number;
}

interface ServiceFormValues {
  code: string;

  name: string;

  groupCode?: string;

  unitPrice: number;

  decisionNo?: string;

  requiresMachine: boolean;

  allowSimultaneous: boolean;

  minDurationMinutes: number;

  maxDurationMinutes: number;

  nextExecutionDays: number;

  machineCodes: string[];

  note?: string;

  active: boolean;
}

interface ServiceListResponse {
  success?: boolean;

  message?: string;

  data?: {
    items: ServiceItem[];

    total: number;

    page: number;

    pageSize: number;
  };
}

interface MachineListResponse {
  success?: boolean;

  message?: string;

  data?: {
    items: Array<{
      code: string;

      name: string;

      warnTimeOverlap: boolean;

      active: boolean;
    }>;
  };
}

interface ServiceImportError {
  row: number;

  field: string;

  message: string;
}

interface ServiceImportResult {
  totalRows: number;

  inserted: number;

  updated: number;

  skipped: number;
}

// ======================================================
// COMPONENT
// ======================================================

export default function Services() {
  // ====================================================
  // FILTERS
  // ====================================================

  const [searchCode, setSearchCode] = useState("");

  const [searchName, setSearchName] = useState("");

  const [searchDecision, setSearchDecision] = useState("");

  const [searchGroupCode, setSearchGroupCode] = useState("");

  // ====================================================
  // DATA
  // ====================================================

  const [items, setItems] = useState<ServiceItem[]>([]);

  const [machineOptions, setMachineOptions] = useState<MachineOption[]>([]);

  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(false);

  // ====================================================
  // ADD / EDIT
  // ====================================================

  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);

  const [editingService, setEditingService] = useState<ServiceItem | null>(null);

  const [form] = Form.useForm<ServiceFormValues>();

  const requiresMachine = Form.useWatch("requiresMachine", form);

  // ====================================================
  // IMPORT EXCEL
  // ====================================================

  const [importModalOpen, setImportModalOpen] = useState(false);

  const [importFileList, setImportFileList] = useState<UploadFile[]>([]);

  const [importing, setImporting] = useState(false);

  const [importResult, setImportResult] = useState<ServiceImportResult | null>(null);

  const [importErrors, setImportErrors] = useState<ServiceImportError[]>([]);

  const [importMessage, setImportMessage] = useState("");

  // ====================================================
  // LOAD MACHINES
  // ====================================================

  const loadMachineOptions = useCallback(async () => {
    try {
      const response = await apiFetch("/catalog/machines?active=true&page=1&pageSize=100", {
        method: "GET",
      });

      const json: MachineListResponse = await response.json();

      if (!response.ok || json.success !== true) {
        throw new Error(json.message || "Không thể tải danh mục máy.");
      }

      setMachineOptions(
        (json.data?.items ?? []).map((item) => ({
          code: item.code,

          name: item.name,

          warnTimeOverlap: item.warnTimeOverlap,
        })),
      );
    } catch (error) {
      console.error("Load machine options error:", error);
    }
  }, []);

  // ====================================================
  // LOAD SERVICES
  // ====================================================

  const loadServices = useCallback(async () => {
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

      if (searchGroupCode.trim()) {
        params.set("groupCode", searchGroupCode.trim());
      }

      const response = await apiFetch(`/catalog/services?${params.toString()}`, {
        method: "GET",
      });

      const json: ServiceListResponse = await response.json();

      if (!response.ok || json.success !== true) {
        throw new Error(json.message || "Không thể tải danh mục DVKT.");
      }

      let rows = json.data?.items ?? [];

      // =============================================
      // LỌC QUYẾT ĐỊNH TẠI FRONTEND
      // =============================================

      if (searchDecision.trim()) {
        const keyword = searchDecision.trim().toLowerCase();

        rows = rows.filter((row) => (row.decisionNo ?? "").toLowerCase().includes(keyword));
      }

      setItems(rows);

      setTotal(Number(json.data?.total ?? 0));
    } catch (error) {
      console.error("Load services error:", error);

      message.error(error instanceof Error ? error.message : "Không thể tải danh mục DVKT.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchCode, searchName, searchDecision, searchGroupCode]);

  // ====================================================
  // INITIAL LOAD
  // ====================================================

  useEffect(() => {
    void loadServices();

    void loadMachineOptions();
  }, [loadServices, loadMachineOptions]);

  // ====================================================
  // ADD
  // ====================================================

  function openAddModal() {
    setEditingService(null);

    form.resetFields();

    form.setFieldsValue({
      code: "",

      name: "",

      groupCode: "",

      unitPrice: 0,

      decisionNo: "",

      requiresMachine: false,

      allowSimultaneous: false,

      minDurationMinutes: 0,

      maxDurationMinutes: 0,

      nextExecutionDays: 0,

      machineCodes: [],

      note: "",

      active: true,
    });

    setModalOpen(true);
  }

  // ====================================================
  // EDIT
  // ====================================================

  async function openEditModal(record: ServiceItem) {
    try {
      const response = await apiFetch(`/catalog/services/${encodeURIComponent(record.code)}`, {
        method: "GET",
      });

      const json = await response.json();

      if (!response.ok || json.success !== true) {
        throw new Error(json.message || "Không thể tải DVKT.");
      }

      const data = json.data;

      setEditingService(record);

      form.setFieldsValue({
        code: data.code,

        name: data.name,

        groupCode: data.groupCode ?? "",

        unitPrice: Number(data.unitPrice ?? 0),

        decisionNo: data.decisionNo ?? "",

        requiresMachine: Boolean(data.requiresMachine),

        allowSimultaneous: Boolean(data.allowSimultaneous),

        minDurationMinutes: Number(data.minDurationMinutes ?? 0),

        maxDurationMinutes: Number(data.maxDurationMinutes ?? 0),

        nextExecutionDays: Number(data.nextExecutionDays ?? 0),

        machineCodes: Array.isArray(data.machines)
          ? data.machines.map((machine: MachineOption) => machine.code)
          : [],

        note: data.note ?? "",

        active: Boolean(data.active),
      });

      setModalOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Không thể tải DVKT.");
    }
  }

  // ====================================================
  // SAVE
  // ====================================================

  async function handleSave() {
    try {
      const values = await form.validateFields();

      if (
        Number(values.maxDurationMinutes ?? 0) > 0 &&
        Number(values.maxDurationMinutes ?? 0) < Number(values.minDurationMinutes ?? 0)
      ) {
        message.error("Max TG thực hiện phải lớn hơn hoặc bằng Min.");

        return;
      }

      if (values.requiresMachine && (!values.machineCodes || values.machineCodes.length === 0)) {
        message.error("DVKT yêu cầu mã máy nên phải chọn ít nhất 1 máy.");

        return;
      }

      setSaving(true);

      const isEdit = editingService !== null;

      const endpoint = isEdit
        ? `/catalog/services/${encodeURIComponent(editingService.code)}`
        : "/catalog/services";

      const response = await apiFetch(endpoint, {
        method: isEdit ? "PUT" : "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          code: values.code.trim(),

          name: values.name.trim(),

          groupCode: values.groupCode?.trim() || null,

          unitPrice: Number(values.unitPrice ?? 0),

          decisionNo: values.decisionNo?.trim() || null,

          requiresResult: false,

          requiresMachine: Boolean(values.requiresMachine),

          allowSimultaneous: Boolean(values.allowSimultaneous),

          minDurationMinutes: Number(values.minDurationMinutes ?? 0),

          maxDurationMinutes: Number(values.maxDurationMinutes ?? 0),

          nextExecutionDays: Number(values.nextExecutionDays ?? 0),

          machineCodes: values.requiresMachine ? values.machineCodes : [],

          note: values.note?.trim() || null,

          active: values.active,
        }),
      });

      const json = await response.json();

      if (!response.ok || json.success !== true) {
        throw new Error(json.message || "Không thể lưu DVKT.");
      }

      message.success(isEdit ? "Cập nhật DVKT thành công." : "Thêm DVKT thành công.");

      setModalOpen(false);

      setEditingService(null);

      form.resetFields();

      await loadServices();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) {
        return;
      }

      message.error(error instanceof Error ? error.message : "Không thể lưu DVKT.");
    } finally {
      setSaving(false);
    }
  }

  // ====================================================
  // DISABLE
  // ====================================================

  async function handleDisable(record: ServiceItem) {
    try {
      const response = await apiFetch(`/catalog/services/${encodeURIComponent(record.code)}`, {
        method: "DELETE",
      });

      const json = await response.json();

      if (!response.ok || json.success !== true) {
        throw new Error(json.message || "Không thể ngừng sử dụng DVKT.");
      }

      message.success("Đã ngừng sử dụng DVKT.");

      await loadServices();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Không thể ngừng DVKT.");
    }
  }

  // ====================================================
  // REFRESH
  // ====================================================

  function handleRefresh() {
    setSearchCode("");

    setSearchName("");

    setSearchDecision("");

    setSearchGroupCode("");

    setPage(1);
  }

  // ====================================================
  // OPEN IMPORT
  // ====================================================

  function openImportModal() {
    setImportFileList([]);

    setImportResult(null);

    setImportErrors([]);

    setImportMessage("");

    setImportModalOpen(true);
  }

  // ====================================================
  // CLOSE IMPORT
  // ====================================================

  function closeImportModal() {
    if (importing) {
      return;
    }

    setImportModalOpen(false);

    setImportFileList([]);

    setImportResult(null);

    setImportErrors([]);

    setImportMessage("");
  }

  // ====================================================
  // IMPORT EXCEL
  // ====================================================

  async function handleImportExcel() {
    const file = importFileList[0]?.originFileObj;

    if (!file) {
      message.warning("Vui lòng chọn file Excel.");

      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      message.error("Chỉ hỗ trợ file Excel .xlsx.");

      return;
    }

    try {
      setImporting(true);

      setImportResult(null);

      setImportErrors([]);

      setImportMessage("");

      const formData = new FormData();

      formData.append("file", file);

      const response = await apiFetch("/catalog/services/import", {
        method: "POST",

        body: formData,
      });

      let json: any = null;

      try {
        json = await response.json();
      } catch {
        // Backend không trả JSON.
      }

      if (!response.ok || json?.success !== true) {
        const errors = Array.isArray(json?.errors) ? json.errors : [];

        setImportErrors(errors);

        setImportMessage(json?.message || "Import DVKT thất bại.");

        message.error(json?.message || "Import DVKT thất bại.");

        return;
      }

      const result: ServiceImportResult = {
        totalRows: Number(json.data?.totalRows ?? 0),

        inserted: Number(json.data?.inserted ?? 0),

        updated: Number(json.data?.updated ?? 0),

        skipped: Number(json.data?.skipped ?? 0),
      };

      setImportResult(result);

      setImportMessage(json?.message || "Import DVKT thành công.");

      message.success(json?.message || "Import DVKT thành công.");

      if (page !== 1) {
        setPage(1);
      } else {
        await loadServices();
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Import DVKT thất bại.";

      setImportMessage(text);

      message.error(text);
    } finally {
      setImporting(false);
    }
  }

  // ====================================================
  // TABLE COLUMNS
  // ====================================================

  const columns: TableColumnsType<ServiceItem> = [
    {
      title: "STT",

      key: "stt",

      width: 60,

      align: "center",

      fixed: "left",

      render: (_, __, index) => (page - 1) * pageSize + index + 1,
    },

    {
      title: "Mã dịch vụ",

      dataIndex: "code",

      key: "code",

      width: 150,

      fixed: "left",

      render: (value: string) => <Text strong>{value || "-"}</Text>,
    },

    {
      title: "Tên dịch vụ",

      dataIndex: "name",

      key: "name",

      width: 300,

      ellipsis: true,
    },

    {
      title: "Mã 5937",

      dataIndex: "groupCode",

      key: "groupCode",

      width: 100,

      align: "center",

      render: (value: string | null) => value ?? "-",
    },

    {
      title: "Đơn giá",

      dataIndex: "unitPrice",

      key: "unitPrice",

      width: 120,

      align: "right",

      render: (value: number) => Number(value ?? 0).toLocaleString("vi-VN"),
    },

    {
      title: "Quyết định",

      dataIndex: "decisionNo",

      key: "decisionNo",

      width: 220,

      ellipsis: true,

      render: (value: string | null) => value ?? "-",
    },

    {
      title: "Mã máy",

      dataIndex: "requiresMachine",

      key: "requiresMachine",

      width: 110,

      align: "center",

      render: (value: boolean) =>
        value ? (
          <Tag color="blue" className="services-pill">
            Bắt buộc
          </Tag>
        ) : (
          <Tag className="services-pill">Không</Tag>
        ),
    },

    {
      title: "DS máy",

      dataIndex: "machines",

      key: "machines",

      width: 210,

      ellipsis: true,

      render: (machines: MachineOption[]) => {
        if (!Array.isArray(machines) || machines.length === 0) {
          return "-";
        }

        const text = machines.map((machine) => machine.code).join(", ");

        return (
          <Tooltip title={text}>
            <Text ellipsis>{text}</Text>
          </Tooltip>
        );
      },
    },

    {
      title: "Thời gian thực hiện",

      key: "duration",

      width: 170,

      align: "center",

      render: (_, record) => (
        <Text>
          {record.minDurationMinutes}
          {" - "}
          {record.maxDurationMinutes}
          {" phút"}
        </Text>
      ),
    },

    {
      title: "Số ngày TH tiếp",

      dataIndex: "nextExecutionDays",

      key: "nextExecutionDays",

      width: 130,

      align: "center",
    },

    {
      title: "Thực hiện cùng lúc",

      dataIndex: "allowSimultaneous",

      key: "allowSimultaneous",

      width: 145,

      align: "center",

      render: (value: boolean) =>
        value ? (
          <Tag color="warning" className="services-pill">
            Có
          </Tag>
        ) : (
          <Tag color="blue" className="services-pill">
            Không
          </Tag>
        ),
    },

    {
      title: "Trạng thái",

      dataIndex: "active",

      key: "active",

      width: 105,

      fixed: "right",

      align: "center",

      render: (value: boolean) =>
        value ? (
          <Tag color="success" className="services-pill">
            Đang dùng
          </Tag>
        ) : (
          <Tag className="services-pill">Ngừng dùng</Tag>
        ),
    },

    {
      title: "Thao tác",

      key: "actions",

      width: 100,

      fixed: "right",

      align: "center",

      render: (_, record) => (
        <Space size={8}>
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
            <Popconfirm
              title="Ngừng sử dụng DVKT?"
              description={`${record.code} - ${record.name}`}
              okText="Đồng ý"
              cancelText="Hủy"
              disabled={!record.active}
              onConfirm={() => void handleDisable(record)}
            >
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
              />
            </Popconfirm>
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
      <div className="services-page">
        {/* =================================================
            BREADCRUMB
        ================================================= */}

        <Breadcrumb
          className="services-breadcrumb"
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
              title: "Dịch vụ kỹ thuật",
            },
          ]}
        />

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="services-header">
          <div>
            <div className="services-title-row">
              <MedicineBoxOutlined className="services-title-icon" />

              <Title
                level={3}
                style={{
                  margin: 0,
                }}
              >
                Dịch vụ kỹ thuật
              </Title>
            </div>

            <Text type="secondary" className="services-subtitle">
              Quản lý danh mục dịch vụ kỹ thuật và cấu hình kiểm tra
            </Text>
          </div>

          <Space size={8}>
            <Button icon={<UploadOutlined />} onClick={openImportModal}>
              Import Excel
            </Button>

            <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
              Thêm mới
            </Button>
          </Space>
        </div>

        {/* =================================================
            FILTER
        ================================================= */}

        <div className="services-filter-grid">
          <div className="services-filter-item">
            <Text strong className="services-filter-label">
              Tên dịch vụ
            </Text>

            <Input
              value={searchName}
              placeholder="Nhập tên dịch vụ"
              allowClear
              onChange={(event) => {
                setSearchName(event.target.value);

                setPage(1);
              }}
            />
          </div>

          <div className="services-filter-item">
            <Text strong className="services-filter-label">
              Mã dịch vụ
            </Text>

            <Input
              value={searchCode}
              placeholder="Nhập mã dịch vụ"
              allowClear
              onChange={(event) => {
                setSearchCode(event.target.value);

                setPage(1);
              }}
            />
          </div>

          <div className="services-filter-item">
            <Text strong className="services-filter-label">
              Quyết định
            </Text>

            <Input
              value={searchDecision}
              placeholder="Nhập quyết định"
              allowClear
              onChange={(event) => {
                setSearchDecision(event.target.value);

                setPage(1);
              }}
            />
          </div>

          <div className="services-filter-item">
            <Text strong className="services-filter-label">
              Mã nhóm 5937
            </Text>

            <Input
              value={searchGroupCode}
              placeholder="Mã nhóm"
              allowClear
              onChange={(event) => {
                setSearchGroupCode(event.target.value);

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

        <Table<ServiceItem>
          className="services-table"
          rowKey="code"
          size="middle"
          tableLayout="fixed"
          loading={loading}
          dataSource={items}
          columns={columns}
          scroll={{
            x: 1850,
          }}
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
            emptyText: "Chưa có dữ liệu dịch vụ kỹ thuật",
          }}
        />
      </div>

      {/* =================================================
          ADD / EDIT MODAL
      ================================================= */}

      <Modal
        open={modalOpen}
        title={editingService ? "Cập nhật Dịch vụ Kỹ thuật" : "Thêm Dịch vụ Kỹ thuật"}
        width={1000}
        okText={editingService ? "Cập nhật" : "Thêm mới"}
        cancelText="Hủy"
        confirmLoading={saving}
        onOk={() => void handleSave()}
        onCancel={() => {
          if (saving) {
            return;
          }

          setModalOpen(false);

          setEditingService(null);

          form.resetFields();
        }}
      >
        <Form form={form} layout="vertical" requiredMark={false} className="services-form">
          {/* =============================================
              CODE / GROUP
          ============================================= */}

          <div className="services-form-grid services-form-grid-2">
            <Form.Item
              label="Mã dịch vụ"
              name="code"
              rules={[
                {
                  required: true,

                  whitespace: true,

                  message: "Vui lòng nhập mã dịch vụ.",
                },
              ]}
            >
              <Input placeholder="Mã dịch vụ" disabled={editingService !== null} />
            </Form.Item>

            <Form.Item label="Mã nhóm 5937" name="groupCode">
              <Input placeholder="Mã nhóm 5937" />
            </Form.Item>
          </div>

          {/* =============================================
              NAME
          ============================================= */}

          <Form.Item
            label="Tên dịch vụ"
            name="name"
            rules={[
              {
                required: true,

                whitespace: true,

                message: "Vui lòng nhập tên dịch vụ.",
              },
            ]}
          >
            <Input placeholder="Tên dịch vụ kỹ thuật" />
          </Form.Item>

          {/* =============================================
              PRICE / DECISION / NEXT DAYS
          ============================================= */}

          <div className="services-form-grid services-form-grid-3">
            <Form.Item
              label="Đơn giá"
              name="unitPrice"
              rules={[
                {
                  type: "number",

                  min: 0,

                  message: "Đơn giá không hợp lệ.",
                },
              ]}
            >
              <InputNumber
                min={0}
                style={{
                  width: "100%",
                }}
              />
            </Form.Item>

            <Form.Item label="Quyết định" name="decisionNo">
              <Input placeholder="Số quyết định" />
            </Form.Item>

            <Form.Item label="Số ngày thực hiện tiếp theo" name="nextExecutionDays">
              <InputNumber
                min={0}
                style={{
                  width: "100%",
                }}
              />
            </Form.Item>
          </div>

          {/* =============================================
              MACHINE / DURATION
          ============================================= */}

          <div className="services-form-grid services-form-grid-4">
            <Form.Item label="Mã máy" name="requiresMachine" valuePropName="checked">
              <Switch checkedChildren="Bắt buộc" unCheckedChildren="Không" />
            </Form.Item>

            <Form.Item label="Thực hiện cùng lúc" name="allowSimultaneous" valuePropName="checked">
              <Switch checkedChildren="Có" unCheckedChildren="Không" />
            </Form.Item>

            <Form.Item label="Min TG thực hiện (phút)" name="minDurationMinutes">
              <InputNumber
                min={0}
                style={{
                  width: "100%",
                }}
              />
            </Form.Item>

            <Form.Item label="Max TG thực hiện (phút)" name="maxDurationMinutes">
              <InputNumber
                min={0}
                style={{
                  width: "100%",
                }}
              />
            </Form.Item>
          </div>

          {/* =============================================
              MACHINE LIST
          ============================================= */}

          <Form.Item label="Danh mục mã máy" name="machineCodes">
            <Select
              mode="multiple"
              allowClear
              showSearch
              disabled={!requiresMachine}
              optionFilterProp="label"
              placeholder={
                requiresMachine ? "Chọn một hoặc nhiều máy" : "DVKT không yêu cầu mã máy"
              }
              options={machineOptions.map((machine) => ({
                value: machine.code,

                label: `${machine.code} - ${machine.name}`,
              }))}
            />
          </Form.Item>

          {/* =============================================
              NOTE
          ============================================= */}

          <Form.Item label="Ghi chú" name="note">
            <Input.TextArea rows={2} placeholder="Ghi chú" />
          </Form.Item>

          {/* =============================================
              ACTIVE
          ============================================= */}

          <Form.Item label="Đang sử dụng" name="active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* =================================================
          IMPORT EXCEL MODAL
      ================================================= */}

      <Modal
        open={importModalOpen}
        title="Import Danh mục Dịch vụ Kỹ thuật"
        width={900}
        okText="Import"
        cancelText="Đóng"
        confirmLoading={importing}
        okButtonProps={{
          disabled: importFileList.length === 0 || importResult !== null,
        }}
        onOk={() => void handleImportExcel()}
        onCancel={closeImportModal}
      >
        <div
          style={{
            marginTop: 16,
          }}
        >
          <Alert
            type="info"
            showIcon
            title="Import Danh mục Dịch vụ Kỹ thuật từ Excel"
            description={
              <>
                Hệ thống tự nhận diện sheet có cột <b>MA_TUONG_DUONG</b>. File mẫu hiện tại có 791
                DVKT. Hệ thống sử dụng <b>TEN_DVKT_PHEDUYET</b> làm tên dịch vụ, <b>DON_GIA</b> làm
                đơn giá và <b>QUYET_DINH</b> làm số quyết định. Mã đã tồn tại sẽ được cập nhật, mã
                mới sẽ được thêm. Các cấu hình riêng của MedGuard như Mã 5937, mã máy, thời gian
                thực hiện và thực hiện cùng lúc sẽ được giữ nguyên. Nếu file có lỗi thì toàn bộ lần
                import sẽ bị hủy.
              </>
            }
            style={{
              marginBottom: 16,
            }}
          />

          <Upload
            accept=".xlsx"
            maxCount={1}
            fileList={importFileList}
            beforeUpload={() => false}
            disabled={importing}
            onRemove={() => {
              setImportFileList([]);

              setImportResult(null);

              setImportErrors([]);

              setImportMessage("");

              return true;
            }}
            onChange={(info) => {
              setImportFileList(info.fileList.slice(-1));

              setImportResult(null);

              setImportErrors([]);

              setImportMessage("");
            }}
          >
            <Button icon={<UploadOutlined />} disabled={importing}>
              Chọn file Excel
            </Button>
          </Upload>

          {/* =============================================
              SUCCESS
          ============================================= */}

          {importResult && (
            <Alert
              type="success"
              showIcon
              className="services-import-alert"
              title={importMessage || "Import DVKT thành công."}
              description={
                <div className="services-import-summary">
                  <div>
                    <span>Tổng số DVKT</span>

                    <b>{importResult.totalRows}</b>
                  </div>

                  <div>
                    <span>Thêm mới</span>

                    <b>{importResult.inserted}</b>
                  </div>

                  <div>
                    <span>Cập nhật</span>

                    <b>{importResult.updated}</b>
                  </div>

                  <div>
                    <span>Bỏ qua</span>

                    <b>{importResult.skipped}</b>
                  </div>
                </div>
              }
            />
          )}

          {/* =============================================
              GENERAL ERROR
          ============================================= */}

          {!importResult && importMessage && importErrors.length === 0 && (
            <Alert
              type="error"
              showIcon
              title={importMessage}
              style={{
                marginTop: 20,
              }}
            />
          )}

          {/* =============================================
              ROW ERRORS
          ============================================= */}

          {importErrors.length > 0 && (
            <div
              style={{
                marginTop: 20,
              }}
            >
              <Alert
                type="error"
                showIcon
                title={importMessage || `File có ${importErrors.length} lỗi.`}
                description="Không có DVKT nào được import. Hãy sửa các dòng lỗi rồi import lại."
                style={{
                  marginBottom: 12,
                }}
              />

              <Table<ServiceImportError>
                className="services-import-table"
                size="small"
                rowKey={(record, index) => `${record.row}-${record.field}-${index}`}
                dataSource={importErrors}
                pagination={{
                  pageSize: 10,

                  showSizeChanger: false,

                  showTotal: (value) => `Tổng lỗi: ${value}`,
                }}
                scroll={{
                  y: 320,
                }}
                columns={[
                  {
                    title: "Dòng",

                    dataIndex: "row",

                    width: 80,

                    align: "center",
                  },

                  {
                    title: "Cột",

                    dataIndex: "field",

                    width: 220,
                  },

                  {
                    title: "Lỗi",

                    dataIndex: "message",
                  },
                ]}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* =================================================
          STYLE
      ================================================= */}

      <style>
        {`
          .services-page {
            width: 100%;
          }

          .services-breadcrumb {
            margin-bottom: 14px;
            font-size: 12px;
          }

          .services-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 16px;
          }

          .services-title-row {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .services-title-row h3 {
            margin: 0 !important;
            color: #172033 !important;
            font-size: 22px !important;
            font-weight: 800 !important;
          }

          .services-title-icon {
            color: #1677ff;
            font-size: 25px;
          }

          .services-subtitle {
            display: block;
            margin-top: 3px;
            font-size: 12px;
          }

          .services-filter-grid {
            display: grid;
            grid-template-columns:
              minmax(230px, 1.25fr)
              minmax(190px, 1fr)
              minmax(210px, 1fr)
              minmax(150px, 0.7fr)
              auto;
            gap: 10px;
            align-items: end;
            margin-bottom: 14px;
          }

          .services-filter-item {
            min-width: 0;
          }

          .services-filter-label {
            display: block;
            margin-bottom: 6px;
            color: #172033;
            font-size: 12px;
            font-weight: 700;
          }

          .services-table {
            overflow: hidden;
            border: 1px solid #e6ebf1;
            border-radius: 8px;
          }

          .services-table .ant-table {
            border-radius: 8px;
          }

          .services-table
          .ant-table-container {
            border-start-start-radius: 8px;
            border-start-end-radius: 8px;
          }

          .services-table
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

          .services-table
          .ant-table-tbody
          > tr
          > td {
            padding: 11px 10px !important;
            color: #202a3b;
            font-size: 12px;
            vertical-align: middle;
            border-bottom: 1px solid #edf0f5 !important;
          }

          .services-table
          .ant-table-tbody
          > tr:hover
          > td {
            background: #f7fbff !important;
          }

          .services-table
          .ant-table-cell-fix-left,
          .services-table
          .ant-table-cell-fix-right {
            background: #ffffff;
          }

          .services-table
          .ant-table-thead
          .ant-table-cell-fix-left,
          .services-table
          .ant-table-thead
          .ant-table-cell-fix-right {
            background: #f3f6f9 !important;
          }

          .services-table
          .ant-pagination {
            margin: 14px 8px 6px;
          }

          .services-pill {
            margin: 0;
            border-radius: 6px;
            font-size: 11px;
          }

          .services-form {
            margin-top: 18px;
          }

          .services-form-grid {
            display: grid;
            gap: 16px;
          }

          .services-form-grid-2 {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .services-form-grid-3 {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .services-form-grid-4 {
            grid-template-columns:
              repeat(4, minmax(0, 1fr));
          }

          .services-import-alert {
            margin-top: 20px;
          }

          .services-import-summary {
            display: grid;
            grid-template-columns:
              repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-top: 8px;
          }

          .services-import-summary > div {
            display: flex;
            flex-direction: column;
            gap: 3px;
            padding: 10px 12px;
            background: rgba(255, 255, 255, 0.65);
            border-radius: 7px;
          }

          .services-import-summary span {
            color: #667085;
            font-size: 12px;
          }

          .services-import-summary b {
            color: #172033;
            font-size: 18px;
          }

          .services-import-table {
            overflow: hidden;
            border: 1px solid #e6ebf1;
            border-radius: 8px;
          }

          @media (max-width: 1150px) {
            .services-filter-grid {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .services-form-grid-4 {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 800px) {
            .services-header {
              flex-direction: column;
            }

            .services-filter-grid {
              grid-template-columns: 1fr;
            }

            .services-form-grid-2,
            .services-form-grid-3,
            .services-form-grid-4 {
              grid-template-columns: 1fr;
            }

            .services-import-summary {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }
          }
        `}
      </style>
    </>
  );
}
