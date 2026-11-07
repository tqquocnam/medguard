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
  Upload,
  message,
} from "antd";

import type { TableColumnsType, UploadFile } from "antd";

import {
  EditOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import { apiFetch } from "../../api/apiClient";

const { Title, Text } = Typography;

const API = "/catalog/medical-staff";

interface DepartmentOption {
  code: string;
  name: string;
}

interface StaffFormValues {
  fullName: string;
  socialInsuranceCode?: string | null;
  licenseNumber?: string | null;
  gender?: string | null;
  licenseIssueDate?: string | null;
  professionalTitle?: string | null;
  licenseIssuer?: string | null;
  professionalScope?: string | null;
  registrationTime?: string | null;
  dailyTime?: string | null;
  weeklyTime?: string | null;
  position?: string | null;
  note?: string | null;
  departmentCodes: string[];
  active: boolean;
}

interface MedicalStaffItem {
  id: string;
  fullName: string;
  socialInsuranceCode: string | null;
  licenseNumber: string | null;
  gender: string | null;
  licenseIssueDate: string | null;
  professionalTitle: string | null;
  licenseIssuer: string | null;
  professionalScope: string | null;
  registrationTime: string | null;
  dailyTime: string | null;
  weeklyTime: string | null;
  position: string | null;
  note: string | null;
  active: boolean;
  departments: DepartmentOption[];
  departmentCount?: number;
}

interface Filters {
  fullName: string;
  licenseNumber: string;
  socialInsuranceCode: string;
  departmentCode?: string;
}

interface ListData<T> {
  items: T[];
  total: number;
}

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  totalRows: number;
  inserted: number;
  updated: number;
  skipped: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: ImportError[];
}

const EMPTY_FILTERS: Filters = {
  fullName: "",
  licenseNumber: "",
  socialInsuranceCode: "",
  departmentCode: undefined,
};

const OPTIONAL_FIELDS = [
  "socialInsuranceCode",
  "licenseNumber",
  "gender",
  "professionalTitle",
  "licenseIssuer",
  "professionalScope",
  "registrationTime",
  "dailyTime",
  "weeklyTime",
  "position",
  "note",
] as const;

const text = (value: unknown): string => String(value ?? "").trim();

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : "Không thể thực hiện yêu cầu.";

function formatDate(value: unknown): string {
  const content = text(value);

  if (!content) return "—";

  const match = content.match(/^(\d{4})-(\d{2})-(\d{2})/);

  return match ? `${match[3]}/${match[2]}/${match[1]}` : content;
}

function dateInputValue(value: unknown): string {
  const content = text(value);

  return content.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

async function readResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error(`API không trả về JSON (HTTP ${response.status}).`);
  }

  return (await response.json()) as ApiResponse<T>;
}

async function request<T>(url: string, init?: RequestInit): Promise<T | undefined> {
  const headers = new Headers(init?.headers);

  if (init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const headerObject: Record<string, string> = {};

  headers.forEach((value, key) => {
    headerObject[key] = value;
  });

  const response = await apiFetch(url, {
    ...init,
    headers: headerObject,
  });

  const json = await readResponse<T>(response);

  if (!response.ok || json.success !== true) {
    throw new Error(json.message || json.error || `Lỗi HTTP ${response.status}`);
  }

  return json.data;
}

export default function MedicalStaff() {
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  const [form] = Form.useForm<StaffFormValues>();

  const requestSequence = useRef(0);
  const savingRef = useRef(false);
  const importingRef = useRef(false);
  const detailRequestRef = useRef(0);

  const [items, setItems] = useState<MedicalStaffItem[]>([]);

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [departmentError, setDepartmentError] = useState("");

  const [inputs, setInputs] = useState<Filters>({ ...EMPTY_FILTERS });

  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });

  const [modalOpen, setModalOpen] = useState(false);

  const [editingStaff, setEditingStaff] = useState<MedicalStaffItem | null>(null);

  const [saving, setSaving] = useState(false);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  const [disablingId, setDisablingId] = useState<string | null>(null);

  const [importModalOpen, setImportModalOpen] = useState(false);

  const [importFileList, setImportFileList] = useState<UploadFile[]>([]);

  const [importing, setImporting] = useState(false);

  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [importErrors, setImportErrors] = useState<ImportError[]>([]);

  const [importMessage, setImportMessage] = useState("");

  const busy = saving || importing || disablingId !== null || detailLoadingId !== null;

  const loadDepartments = useCallback(async () => {
    setDepartmentError("");

    try {
      const all: DepartmentOption[] = [];
      let nextPage = 1;

      while (true) {
        const data = await request<ListData<DepartmentOption>>(
          "/catalog/departments" + `?active=true&page=${nextPage}&pageSize=100`,
        );

        if (!data || !Array.isArray(data.items)) {
          throw new Error("Danh sách khoa không hợp lệ.");
        }

        all.push(...data.items);

        if (data.items.length === 0 || all.length >= Number(data.total ?? 0)) {
          break;
        }

        nextPage++;
      }

      setDepartments(Array.from(new Map(all.map((item) => [item.code, item])).values()));
    } catch (err) {
      setDepartmentError(errorText(err));
    }
  }, []);

  const loadMedicalStaff = useCallback(async () => {
    const sequence = ++requestSequence.current;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });

      for (const [key, value] of Object.entries(filters)) {
        if (text(value)) {
          params.set(key, text(value));
        }
      }

      const data = await request<ListData<MedicalStaffItem>>(`${API}?${params.toString()}`);

      if (!data || !Array.isArray(data.items)) {
        throw new Error("Danh sách nhân viên không hợp lệ.");
      }

      if (sequence !== requestSequence.current) {
        return;
      }

      const nextTotal = Number(data.total ?? 0);
      const maxPage = Math.max(1, Math.ceil(nextTotal / pageSize));

      if (page > maxPage) {
        setPage(maxPage);
        return;
      }

      setItems(data.items);
      setTotal(nextTotal);
    } catch (err) {
      if (sequence === requestSequence.current) {
        setError(errorText(err));
      }
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
      }
    }
  }, [page, pageSize, filters]);

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    void loadMedicalStaff();

    return () => {
      requestSequence.current++;
    };
  }, [loadMedicalStaff]);

  useEffect(
    () => () => {
      detailRequestRef.current++;
    },
    [],
  );

  const departmentOptions = useMemo(() => {
    const map = new Map(departments.map((item) => [item.code, item]));

    for (const department of editingStaff?.departments ?? []) {
      if (!map.has(department.code)) {
        map.set(department.code, department);
      }
    }

    return Array.from(map.values())
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .map((item) => ({
        value: item.code,
        label: `${item.code} - ${item.name}`,
      }));
  }, [departments, editingStaff]);

  function backToCatalog() {
    sessionStorage.setItem("catalog-active-tab", "bhxh");

    navigate("/catalog");
  }

  function search() {
    setPage(1);

    setFilters({
      fullName: text(inputs.fullName),
      licenseNumber: text(inputs.licenseNumber),
      socialInsuranceCode: text(inputs.socialInsuranceCode),
      departmentCode: inputs.departmentCode || undefined,
    });
  }

  function resetFilters() {
    setInputs({ ...EMPTY_FILTERS });
    setFilters({ ...EMPTY_FILTERS });
    setPage(1);
  }

  function refresh() {
    void loadMedicalStaff();
    void loadDepartments();
  }

  function fillForm(staff?: MedicalStaffItem) {
    const values: StaffFormValues = {
      fullName: staff?.fullName ?? "",
      departmentCodes: staff?.departments?.map((item) => item.code) ?? [],
      active: staff ? staff.active : true,
      licenseIssueDate: dateInputValue(staff?.licenseIssueDate),
    };

    for (const field of OPTIONAL_FIELDS) {
      values[field] = text(staff?.[field]);
    }

    form.resetFields();
    form.setFieldsValue(values);
  }

  function openCreate() {
    setEditingStaff(null);
    fillForm();
    setModalOpen(true);
  }

  async function openEdit(record: MedicalStaffItem) {
    const sequence = ++detailRequestRef.current;

    setDetailLoadingId(record.id);

    try {
      const data = await request<MedicalStaffItem>(`${API}/${encodeURIComponent(record.id)}`);

      if (sequence !== detailRequestRef.current) {
        return;
      }

      if (!data) {
        throw new Error("Thông tin nhân viên không hợp lệ.");
      }

      setEditingStaff(data);
      fillForm(data);
      setModalOpen(true);
    } catch (err) {
      if (sequence === detailRequestRef.current) {
        messageApi.error(errorText(err));
      }
    } finally {
      if (sequence === detailRequestRef.current) {
        setDetailLoadingId(null);
      }
    }
  }

  function closeForm() {
    if (savingRef.current) return;

    setModalOpen(false);
    setEditingStaff(null);
    form.resetFields();
  }

  async function handleSave(values: StaffFormValues) {
    if (savingRef.current) return;

    savingRef.current = true;
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        fullName: text(values.fullName),
        licenseIssueDate: values.licenseIssueDate || null,
        departmentCodes: values.departmentCodes ?? [],
        active: values.active === true,
      };

      for (const field of OPTIONAL_FIELDS) {
        payload[field] = text(values[field]) || null;
      }

      const isEdit = editingStaff !== null;

      const url = editingStaff ? `${API}/${encodeURIComponent(editingStaff.id)}` : API;

      await request(url, {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      messageApi.success(isEdit ? "Đã cập nhật nhân viên y tế." : "Đã thêm nhân viên y tế.");

      setModalOpen(false);
      setEditingStaff(null);
      form.resetFields();

      if (!isEdit && page !== 1) {
        setPage(1);
      } else {
        await loadMedicalStaff();
      }
    } catch (err) {
      messageApi.error(errorText(err));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function disableStaff(record: MedicalStaffItem) {
    setDisablingId(record.id);

    try {
      await request(`${API}/${encodeURIComponent(record.id)}`, { method: "DELETE" });

      messageApi.success("Đã ngừng sử dụng nhân viên y tế.");

      await loadMedicalStaff();
    } catch (err) {
      messageApi.error(errorText(err));
    } finally {
      setDisablingId(null);
    }
  }

  function clearImportResult() {
    setImportResult(null);
    setImportErrors([]);
    setImportMessage("");
  }

  function openImport() {
    setImportFileList([]);
    clearImportResult();
    setImportModalOpen(true);
  }

  function closeImport() {
    if (importingRef.current) return;

    setImportModalOpen(false);
    setImportFileList([]);
    clearImportResult();
  }

  async function handleImport() {
    if (importingRef.current) return;

    const file = importFileList[0]?.originFileObj;

    if (!file) {
      messageApi.warning("Vui lòng chọn file Excel.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      messageApi.error("Chỉ hỗ trợ file Excel .xlsx.");
      return;
    }

    importingRef.current = true;
    setImporting(true);
    clearImportResult();

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await apiFetch(`${API}/import`, {
        method: "POST",
        body,
      });

      const json = await readResponse<ImportResult>(response);

      if (!response.ok || json.success !== true) {
        const description = json.message || json.error || "Import nhân viên y tế thất bại.";

        setImportMessage(description);

        setImportErrors(Array.isArray(json.errors) ? json.errors : []);

        messageApi.error(description);
        return;
      }

      if (!json.data) {
        throw new Error("Kết quả import không hợp lệ.");
      }

      setImportResult({
        totalRows: Number(json.data.totalRows ?? 0),
        inserted: Number(json.data.inserted ?? 0),
        updated: Number(json.data.updated ?? 0),
        skipped: Number(json.data.skipped ?? 0),
      });

      const description = json.message || "Import nhân viên y tế thành công.";

      setImportMessage(description);
      messageApi.success(description);

      if (page !== 1) {
        setPage(1);
      } else {
        await loadMedicalStaff();
      }
    } catch (err) {
      const description = errorText(err);

      setImportMessage(description);
      messageApi.error(description);
    } finally {
      importingRef.current = false;
      setImporting(false);
    }
  }

  function renderLongText(value: unknown) {
    const content = text(value);

    if (!content) return "—";

    return (
      <Tooltip title={content} placement="topLeft">
        <div className="ms-clamp">{content}</div>
      </Tooltip>
    );
  }

  function textColumn(
    title: string,
    dataIndex: keyof MedicalStaffItem,
    width: number,
  ): TableColumnsType<MedicalStaffItem>[number] {
    return {
      title,
      dataIndex,
      width,
      render: renderLongText,
    };
  }

  const columns: TableColumnsType<MedicalStaffItem> = [
    {
      title: "STT",
      key: "index",
      width: 56,
      fixed: "left",
      align: "center",
      render: (_, __, index) => (page - 1) * pageSize + index + 1,
    },
    {
      title: "Họ tên",
      dataIndex: "fullName",
      width: 210,
      fixed: "left",
      render: (value: string) => (
        <div className="ms-person">
          <div className="ms-avatar">
            <TeamOutlined />
          </div>

          <div className="ms-name">{value}</div>
        </div>
      ),
    },
    textColumn("Mã BHXH", "socialInsuranceCode", 140),
    textColumn("Mã CCHN", "licenseNumber", 180),
    {
      title: "Mã khoa",
      key: "departmentCodes",
      width: 140,
      render: (_, record) =>
        renderLongText(record.departments?.map((item) => item.code).join("; ")),
    },
    {
      title: "Khoa",
      key: "departments",
      width: 230,
      render: (_, record) =>
        record.departments?.length ? (
          <Space size={[4, 5]} wrap>
            {record.departments.map((item) => (
              <Tag key={item.code} color="blue" className="ms-department-tag">
                {item.name}
              </Tag>
            ))}
          </Space>
        ) : (
          "—"
        ),
    },
    textColumn("Giới tính", "gender", 90),
    {
      title: "Ngày cấp CCHN",
      dataIndex: "licenseIssueDate",
      width: 130,
      render: formatDate,
    },
    textColumn("Chức danh nghề nghiệp", "professionalTitle", 170),
    textColumn("Nơi cấp CCHN", "licenseIssuer", 180),
    textColumn("Phạm vi chuyên môn", "professionalScope", 250),
    textColumn("Thời gian đăng ký", "registrationTime", 140),
    textColumn("Thời gian ngày", "dailyTime", 150),
    textColumn("Thời gian tuần", "weeklyTime", 170),
    textColumn("Vị trí", "position", 150),
    textColumn("Ghi chú", "note", 220),
    {
      title: "Trạng thái",
      dataIndex: "active",
      width: 115,
      align: "center",
      render: (active: boolean) => (
        <Tag color={active ? "success" : "default"}>
          {active ? "Đang sử dụng" : "Ngừng sử dụng"}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 105,
      fixed: "right",
      align: "center",
      render: (_, record) => (
        <Space size={2}>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              size="small"
              aria-label="Chỉnh sửa nhân viên"
              icon={<EditOutlined />}
              className="ms-edit"
              disabled={busy || loading}
              loading={detailLoadingId === record.id}
              onClick={() => void openEdit(record)}
            />
          </Tooltip>

          <Popconfirm
            title="Ngừng sử dụng nhân viên?"
            description={record.fullName}
            okText="Ngừng sử dụng"
            cancelText="Hủy"
            okButtonProps={{
              danger: true,
            }}
            disabled={busy || loading || !record.active}
            onConfirm={() => disableStaff(record)}
          >
            <Button
              danger
              type="text"
              size="small"
              aria-label="Ngừng sử dụng nhân viên"
              icon={<StopOutlined />}
              disabled={busy || loading || !record.active}
              loading={disablingId === record.id}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const errorColumns: TableColumnsType<ImportError> = [
    {
      title: "Dòng",
      dataIndex: "row",
      width: 70,
      align: "center",
    },
    {
      title: "Cột",
      dataIndex: "field",
      width: 180,
    },
    {
      title: "Nội dung lỗi",
      dataIndex: "message",
      render: (value) => <div className="ms-wrap">{value}</div>,
    },
  ];

  return (
    <div className="ms-page">
      {contextHolder}

      <Breadcrumb
        items={[
          {
            title: (
              <Button
                type="link"
                size="small"
                className="ms-crumb"
                aria-label="Trang chủ"
                icon={<HomeOutlined />}
                onClick={() => navigate("/")}
              />
            ),
          },
          {
            title: (
              <Button type="link" size="small" className="ms-crumb" onClick={backToCatalog}>
                Danh mục
              </Button>
            ),
          },
          { title: "Nhân viên y tế" },
        ]}
      />

      <div className="ms-header">
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
            <TeamOutlined
              style={{
                marginRight: 9,
                color: "#1677ff",
              }}
            />
            Nhân viên y tế
          </Title>

          <Text type="secondary" className="ms-subtitle">
            Quản lý thông tin hành nghề, chuyên môn và khoa của nhân viên
          </Text>
        </div>

        <Space size={8} wrap>
          <Button icon={<UploadOutlined />} disabled={busy || loading} onClick={openImport}>
            Import Excel
          </Button>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={busy || loading}
            onClick={openCreate}
          >
            Thêm mới
          </Button>
        </Space>
      </div>

      {(error || departmentError) && (
        <Alert
          type={error ? "error" : "warning"}
          showIcon
          message={error ? "Không thể tải danh sách nhân viên" : "Không thể tải danh mục khoa"}
          description={error || departmentError}
          action={
            <Button size="small" disabled={busy || loading} onClick={refresh}>
              Thử lại
            </Button>
          }
        />
      )}

      <div className="ms-filters">
        <div className="ms-filter">
          <label htmlFor="ms-name-search">Họ tên</label>

          <Input
            id="ms-name-search"
            allowClear
            value={inputs.fullName}
            placeholder="Nhập họ tên"
            onChange={(event) =>
              setInputs((previous) => ({
                ...previous,
                fullName: event.target.value,
              }))
            }
            onPressEnter={search}
          />
        </div>

        <div className="ms-filter">
          <label htmlFor="ms-license-search">Mã CCHN</label>

          <Input
            id="ms-license-search"
            allowClear
            value={inputs.licenseNumber}
            placeholder="Nhập mã CCHN"
            onChange={(event) =>
              setInputs((previous) => ({
                ...previous,
                licenseNumber: event.target.value,
              }))
            }
            onPressEnter={search}
          />
        </div>

        <div className="ms-filter">
          <label htmlFor="ms-insurance-search">Mã BHXH</label>

          <Input
            id="ms-insurance-search"
            allowClear
            value={inputs.socialInsuranceCode}
            placeholder="Nhập mã BHXH"
            onChange={(event) =>
              setInputs((previous) => ({
                ...previous,
                socialInsuranceCode: event.target.value,
              }))
            }
            onPressEnter={search}
          />
        </div>

        <div className="ms-filter">
          <label htmlFor="ms-department-search">Khoa</label>

          <Select
            id="ms-department-search"
            showSearch
            allowClear
            optionFilterProp="label"
            value={inputs.departmentCode}
            placeholder="Tất cả khoa"
            options={departmentOptions}
            onChange={(value) =>
              setInputs((previous) => ({
                ...previous,
                departmentCode: value,
              }))
            }
          />
        </div>

        <Space size={8}>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            disabled={busy || loading}
            onClick={search}
          >
            Tìm kiếm
          </Button>

          <Button icon={<ReloadOutlined />} disabled={busy} onClick={resetFilters}>
            Xóa bộ lọc
          </Button>
        </Space>
      </div>

      <Card
        className="ms-table"
        styles={{
          body: { padding: 0 },
        }}
      >
        <Table<MedicalStaffItem>
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          size="middle"
          tableLayout="fixed"
          scroll={{
            x: 2931,
            y: 440,
          }}
          locale={{
            emptyText: error ? "Chưa tải được dữ liệu." : "Chưa có nhân viên phù hợp.",
          }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
            showTotal: (value) => `Tổng số: ${value} nhân viên`,
            onChange: (nextPage, nextSize) => {
              setPage(nextSize !== pageSize ? 1 : nextPage);
              setPageSize(nextSize);
            },
          }}
        />
      </Card>

      <Text type="secondary" className="ms-legend">
        Kéo ngang để xem đầy đủ thông tin. Di chuột vào nội dung để xem chi tiết.
      </Text>

      <Modal
        open={modalOpen}
        centered
        width={960}
        destroyOnHidden
        className="ms-modal"
        title={
          <div className="ms-modal-heading">
            <div className="ms-modal-icon">
              <TeamOutlined />
            </div>

            <div>
              <div className="ms-modal-title">
                {editingStaff ? "Cập nhật nhân viên y tế" : "Thêm nhân viên y tế"}
              </div>

              <div className="ms-subtitle">Thông tin nhân sự, hành nghề và khoa làm việc</div>
            </div>
          </div>
        }
        okText={editingStaff ? "Cập nhật" : "Thêm mới"}
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
        styles={{
          body: {
            maxHeight: "68vh",
            overflowY: "auto",
            paddingRight: 8,
          },
        }}
      >
        <Form<StaffFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          preserve={false}
          disabled={saving}
          onFinish={handleSave}
          style={{ marginTop: 18 }}
        >
          <div className="ms-section-title">Thông tin nhân viên</div>

          <div className="ms-form-grid ms-grid-3">
            <Form.Item
              name="fullName"
              label="Họ tên"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: "Vui lòng nhập họ tên.",
                },
              ]}
            >
              <Input placeholder="Nhập họ tên" />
            </Form.Item>

            <Form.Item name="socialInsuranceCode" label="Mã BHXH">
              <Input placeholder="Nhập mã BHXH" />
            </Form.Item>

            <Form.Item name="licenseNumber" label="Mã CCHN">
              <Input placeholder="Nhập mã CCHN" />
            </Form.Item>
          </div>

          <div className="ms-form-grid ms-grid-3">
            <Form.Item name="gender" label="Giới tính">
              <Select
                allowClear
                placeholder="Chọn giới tính"
                options={[
                  {
                    value: "Nam",
                    label: "Nam",
                  },
                  {
                    value: "Nữ",
                    label: "Nữ",
                  },
                  {
                    value: "Khác",
                    label: "Khác",
                  },
                ]}
              />
            </Form.Item>

            <Form.Item name="professionalTitle" label="Chức danh nghề nghiệp">
              <Input placeholder="Nhập chức danh" />
            </Form.Item>

            <Form.Item name="position" label="Vị trí">
              <Input placeholder="Nhập vị trí" />
            </Form.Item>
          </div>

          <div className="ms-section-title">Thông tin hành nghề</div>

          <div className="ms-form-grid ms-grid-2">
            <Form.Item name="licenseIssueDate" label="Ngày cấp CCHN">
              <Input type="date" />
            </Form.Item>

            <Form.Item name="licenseIssuer" label="Nơi cấp CCHN">
              <Input placeholder="Nhập nơi cấp CCHN" />
            </Form.Item>
          </div>

          <Form.Item name="departmentCodes" label="Khoa làm việc">
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              options={departmentOptions}
              placeholder="Chọn một hoặc nhiều khoa"
            />
          </Form.Item>

          <Form.Item name="professionalScope" label="Phạm vi chuyên môn">
            <Input.TextArea
              autoSize={{
                minRows: 2,
                maxRows: 5,
              }}
              placeholder="Nhập phạm vi chuyên môn"
            />
          </Form.Item>

          <div className="ms-section-title">Thời gian đăng ký</div>

          <div className="ms-form-grid ms-grid-3">
            <Form.Item name="registrationTime" label="Thời gian đăng ký">
              <Input placeholder="Ví dụ: 1" />
            </Form.Item>

            <Form.Item name="dailyTime" label="Thời gian ngày">
              <Input placeholder="Ví dụ: 0700-1900" />
            </Form.Item>

            <Form.Item name="weeklyTime" label="Thời gian tuần">
              <Input placeholder="Ví dụ: T2T3T4T5T6T7" />
            </Form.Item>
          </div>

          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea
              autoSize={{
                minRows: 2,
                maxRows: 5,
              }}
              placeholder="Nhập ghi chú nếu có"
            />
          </Form.Item>

          <div className="ms-active">
            <div>
              <Text strong>Trạng thái sử dụng</Text>

              <Text type="secondary" className="ms-subtitle">
                Bật để sử dụng nhân viên trong hệ thống
              </Text>
            </div>

            <Form.Item name="active" valuePropName="checked" noStyle>
              <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        open={importModalOpen}
        centered
        width={940}
        destroyOnHidden
        className="ms-import-modal"
        title={
          <div className="ms-modal-heading">
            <div className="ms-modal-icon">
              <UploadOutlined />
            </div>

            <div>
              <div className="ms-modal-title">Import nhân viên y tế</div>

              <div className="ms-subtitle">Nhập danh sách nhân viên từ file Excel</div>
            </div>
          </div>
        }
        okText="Import"
        cancelText="Đóng"
        confirmLoading={importing}
        okButtonProps={{
          disabled: importFileList.length === 0 || importResult !== null,
        }}
        cancelButtonProps={{
          disabled: importing,
        }}
        closable={!importing}
        maskClosable={!importing}
        keyboard={!importing}
        onCancel={closeImport}
        onOk={() => void handleImport()}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          message="Cấu trúc file Excel"
          description={
            <div className="ms-import-help">
              Hệ thống nhận diện sheet có các cột <b>MA_BHXH</b>, <b>HO_TEN</b>, <b>MACCHN</b>. Cột{" "}
              <b>MA_KHOA</b> hỗ trợ nhiều khoa, phân cách bằng dấu chấm phẩy. Nhân viên đã tồn tại
              được nhận diện theo MA_BHXH hoặc MACCHN để cập nhật. Nếu có mã khoa chưa tồn tại hoặc
              dữ liệu lỗi, toàn bộ lần import sẽ bị hủy.
            </div>
          }
        />

        <div className="ms-upload-area">
          <Upload
            accept=".xlsx"
            maxCount={1}
            fileList={importFileList}
            disabled={importing}
            beforeUpload={(file) => {
              if (!file.name.toLowerCase().endsWith(".xlsx")) {
                messageApi.error("Chỉ hỗ trợ file Excel .xlsx.");

                return Upload.LIST_IGNORE;
              }

              setImportFileList([
                {
                  uid: file.uid,
                  name: file.name,
                  status: "done",
                  originFileObj: file,
                },
              ]);

              clearImportResult();
              return false;
            }}
            onRemove={() => {
              if (importingRef.current) {
                return false;
              }

              setImportFileList([]);
              clearImportResult();
              return true;
            }}
          >
            <Button icon={<UploadOutlined />} disabled={importing}>
              Chọn file Excel
            </Button>
          </Upload>

          <Text type="secondary" style={{ fontSize: 12 }}>
            Định dạng hỗ trợ: .xlsx
          </Text>
        </div>

        {importResult && (
          <>
            <Alert
              type="success"
              showIcon
              style={{ marginTop: 16 }}
              message={importMessage || "Import thành công."}
            />

            <div className="ms-import-summary">
              {[
                {
                  label: "Tổng số nhân viên",
                  value: importResult.totalRows,
                  className: "",
                },
                {
                  label: "Thêm mới",
                  value: importResult.inserted,
                  className: "ms-summary-success",
                },
                {
                  label: "Cập nhật",
                  value: importResult.updated,
                  className: "ms-summary-info",
                },
                {
                  label: "Bỏ qua",
                  value: importResult.skipped,
                  className: "ms-summary-warning",
                },
              ].map((item) => (
                <div key={item.label} className={`ms-summary-item ${item.className}`}>
                  <div className="ms-summary-label">{item.label}</div>

                  <div className="ms-summary-value">{item.value}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {!importResult && importMessage && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 16 }}
            message={importMessage}
            description={
              importErrors.length > 0
                ? "Không có nhân viên nào được import. Hãy sửa các dòng lỗi rồi import lại."
                : undefined
            }
          />
        )}

        {importErrors.length > 0 && (
          <div className="ms-import-errors">
            <Table<ImportError>
              rowKey={(record, index) => `${record.row}-${record.field}-${index}`}
              columns={errorColumns}
              dataSource={importErrors}
              size="small"
              tableLayout="fixed"
              scroll={{
                x: 650,
                y: 280,
              }}
              pagination={{
                defaultPageSize: 10,
                showSizeChanger: false,
                showTotal: (value) => `Tổng lỗi: ${value}`,
              }}
            />
          </div>
        )}
      </Modal>

      <style>
        {`
          .ms-page {
            display: flex;
            flex-direction: column;
            gap: 15px;
            width: 100%;
            min-width: 0;
          }

          .ms-page .ant-breadcrumb {
            font-size: 12px;
          }

          .ms-crumb.ant-btn {
            height: auto;
            padding: 0;
            font-size: 12px;
            line-height: inherit;
          }

          .ms-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }

          .ms-header .ant-btn {
            height: 36px;
            border-radius: 8px;
            font-weight: 600;
          }

          .ms-subtitle {
            display: block;
            margin-top: 4px;
            color: #64748b;
            font-size: 12px;
            font-weight: 400;
            line-height: 1.6;
          }

          .ms-filters {
            display: grid;
            grid-template-columns:
              minmax(0, 1.2fr)
              minmax(0, 1fr)
              minmax(0, 1fr)
              minmax(0, 1.2fr)
              auto;
            align-items: end;
            gap: 10px;
          }

          .ms-filter {
            display: flex;
            flex-direction: column;
            min-width: 0;
            gap: 6px;
          }

          .ms-filter > label {
            color: #172033;
            font-size: 12px;
            font-weight: 600;
          }

          .ms-filter .ant-select {
            width: 100%;
          }

          .ms-filters .ant-btn {
            height: 32px;
            border-radius: 7px;
            font-weight: 600;
          }

          .ms-table,
          .ms-import-errors {
            min-width: 0;
            overflow: hidden;
            border: 1px solid #dfe6ee;
            border-radius: 8px;
            box-shadow:
              0 2px 8px rgba(15, 23, 42, .03);
          }

          .ms-table
          .ant-table-thead > tr > th,
          .ms-import-errors
          .ant-table-thead > tr > th {
            background: #f2f5f8 !important;
            color: #334155;
            font-size: 12px;
            font-weight: 700;
            border-bottom: 1px solid #d8e0e8;
          }

          .ms-table
          .ant-table-tbody > tr > td,
          .ms-import-errors
          .ant-table-tbody > tr > td {
            padding: 11px 12px;
            color: #334155;
            font-size: 12px;
            vertical-align: middle;
            overflow-wrap: anywhere;
          }

          .ms-table
          .ant-table-tbody > tr:hover > td {
            background: #f7fbff !important;
          }

          .ms-table .ant-tag {
            margin: 0;
            border-radius: 999px;
            font-size: 11px;
          }

          .ms-department-tag {
            max-width: 100%;
            white-space: normal;
            overflow-wrap: anywhere;
          }

          .ms-table .ant-pagination {
            margin: 12px !important;
          }

          .ms-person {
            display: flex;
            align-items: center;
            gap: 9px;
          }

          .ms-avatar {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            width: 31px;
            height: 31px;
            border-radius: 9px;
            color: #1677ff;
            background: #e6f4ff;
          }

          .ms-name {
            color: #172033;
            font-weight: 600;
            line-height: 1.7;
            overflow-wrap: anywhere;
          }

          .ms-edit {
            color: #1677ff;
          }

          .ms-clamp {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            max-height: 40px;
            overflow: hidden;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            line-height: 20px;
          }

          .ms-wrap {
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            line-height: 1.7;
          }

          .ms-legend {
            margin-top: -5px;
            font-size: 11px;
            line-height: 1.7;
          }

          .ms-modal .ant-modal-content,
          .ms-import-modal .ant-modal-content {
            border-radius: 14px;
          }

          .ms-modal-heading {
            display: flex;
            align-items: center;
            gap: 12px;
            padding-bottom: 8px;
          }

          .ms-modal-icon {
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

          .ms-modal-title {
            color: #172033;
            font-size: 18px;
            font-weight: 800;
          }

          .ms-section-title {
            margin: 0 0 15px;
            padding: 8px 11px;
            border-radius: 7px;
            color: #334155;
            background: #f2f5f8;
            font-size: 12px;
            font-weight: 700;
          }

          .ms-form-grid {
            display: grid;
            column-gap: 16px;
          }

          .ms-grid-3 {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .ms-grid-2 {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .ms-modal
          .ant-form-item-label > label {
            font-size: 12px;
            font-weight: 600;
          }

          .ms-modal .ant-input,
          .ms-modal .ant-select-selector {
            border-radius: 8px;
          }

          .ms-modal input.ant-input {
            min-height: 36px;
          }

          .ms-active {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            background: #fafcff;
          }

          .ms-modal
          .ant-modal-footer .ant-btn,
          .ms-import-modal
          .ant-modal-footer .ant-btn {
            border-radius: 8px;
          }

          .ms-import-help {
            font-size: 12px;
            line-height: 1.8;
          }

          .ms-upload-area {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-top: 16px;
            padding: 14px 16px;
            border: 1px dashed #d9e2ec;
            border-radius: 10px;
            background: #fafcff;
          }

          .ms-import-summary {
            display: grid;
            grid-template-columns:
              repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-top: 16px;
          }

          .ms-summary-item {
            padding: 12px 14px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            background: #fff;
          }

          .ms-summary-label {
            color: #64748b;
            font-size: 12px;
            font-weight: 600;
          }

          .ms-summary-value {
            margin-top: 3px;
            color: #172033;
            font-size: 23px;
            font-weight: 800;
          }

          .ms-summary-success {
            border-color: #d9f7be;
            background: #f6ffed;
          }

          .ms-summary-info {
            border-color: #bae0ff;
            background: #e6f4ff;
          }

          .ms-summary-warning {
            border-color: #ffe58f;
            background: #fffbe6;
          }

          .ms-import-errors {
            margin-top: 14px;
          }

          @media (max-width: 1200px) {
            .ms-header {
              flex-direction: column;
            }

            .ms-filters {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 720px) {
            .ms-grid-3 {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 600px) {
            .ms-filters,
            .ms-grid-2,
            .ms-grid-3 {
              grid-template-columns: 1fr;
            }

            .ms-import-summary {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .ms-upload-area {
              align-items: flex-start;
              flex-direction: column;
            }

            .ms-modal-title {
              font-size: 16px;
            }
          }
        `}
      </style>
    </div>
  );
}
