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

import type { UploadFile } from "antd";
import type { ColumnsType } from "antd/es/table";

import {
  ArrowLeftOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import { apiFetch } from "../../api/apiClient";

const { Title, Text } = Typography;

const API = "/catalog/service-staff";

interface ServiceItem {
  code: string;
  name: string;
  active?: boolean;
}

interface MedicalStaff {
  id: string;
  fullName: string;
  socialInsuranceCode?: string | null;
  licenseNumber?: string | null;
  active?: boolean;
}

interface FormValues {
  service_code: string;
  staff_code: string;
  specialty_code?: string | null;
  activity_type: string;
  active: boolean;
  note?: string | null;
}

interface RuleRow extends FormValues {
  id: string;
  allowed: boolean;
  created_at?: string;
}

interface PreviewRow {
  row: number;
  status: "VALID" | "ERROR" | "DUPLICATE";
  serviceCode: string;
  staffCode: string;
  activityType: string;
  message: string;
}

interface PreviewData {
  totalRows: number;
  valid: number;
  invalid: number;
  duplicate: number;
  rows: PreviewRow[];
}

interface ImportResult {
  inserted?: number;
  updated?: number;
  skipped?: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

type ListData<T> = T[] | { items: T[] };

const ACTIVITY_OPTIONS = [
  {
    value: "CONGKHAM",
    label: "CONGKHAM - Công khám",
  },
  {
    value: "THUCHIEN_CDHA",
    label: "THUCHIEN_CDHA - Thực hiện CĐHA",
  },
  {
    value: "KETQUA_CDHA",
    label: "KETQUA_CDHA - Kết quả CĐHA",
  },
  {
    value: "THUCHIEN_PTTT",
    label: "THUCHIEN_PTTT - Thực hiện thủ thuật/Phẫu thuật",
  },
  {
    value: "THUCHIEN_XN",
    label: "THUCHIEN_XN - Thực hiện Xét nghiệm",
  },
  {
    value: "KETQUAXN",
    label: "KETQUAXN - Kết quả Xét nghiệm",
  },
];

const text = (value: unknown): string => String(value ?? "").trim();

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : "Không thể thực hiện yêu cầu.";

function getActivityLabel(value: string): string {
  return ACTIVITY_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function extractItems<T>(data: ListData<T> | undefined): T[] {
  if (Array.isArray(data)) return data;

  if (data && Array.isArray(data.items)) {
    return data.items;
  }

  throw new Error("Danh sách dữ liệu không hợp lệ.");
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

export default function ServiceStaff() {
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  const [form] = Form.useForm<FormValues>();

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const ruleRequestRef = useRef(0);
  const serviceRequestRef = useRef(0);
  const previewRequestRef = useRef(0);

  const savingRef = useRef(false);
  const importingRef = useRef(false);

  const [tableScrollHeight, setTableScrollHeight] = useState(320);

  const [rows, setRows] = useState<RuleRow[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);

  const [serviceCache, setServiceCache] = useState<Record<string, ServiceItem>>({});

  const [staffList, setStaffList] = useState<MedicalStaff[]>([]);

  const [loading, setLoading] = useState(false);

  const [serviceLoading, setServiceLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState("");

  const [referenceError, setReferenceError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);

  const [editing, setEditing] = useState<RuleRow | null>(null);

  const [filterServiceCode, setFilterServiceCode] = useState<string | undefined>();

  const [filterStaffCode, setFilterStaffCode] = useState<string | undefined>();

  const [filterActivityType, setFilterActivityType] = useState<string | undefined>();

  const [currentPage, setCurrentPage] = useState(1);

  const [pageSize, setPageSize] = useState(10);

  const [importOpen, setImportOpen] = useState(false);

  const [importing, setImporting] = useState(false);

  const [previewing, setPreviewing] = useState(false);

  const [importFileList, setImportFileList] = useState<UploadFile[]>([]);

  const [importPreview, setImportPreview] = useState<PreviewData | null>(null);

  const [downloading, setDownloading] = useState(false);

  const busy = saving || deletingId !== null || importing || previewing;

  const loadRules = useCallback(async () => {
    const sequence = ++ruleRequestRef.current;

    setLoading(true);
    setError("");

    try {
      const data = await request<ListData<RuleRow>>(API);

      if (sequence === ruleRequestRef.current) {
        setRows(extractItems(data));
      }
    } catch (err) {
      if (sequence === ruleRequestRef.current) {
        setError(errorText(err));
      }
    } finally {
      if (sequence === ruleRequestRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const loadServices = useCallback(
    async (keyword = "") => {
      const sequence = ++serviceRequestRef.current;

      setServiceLoading(true);

      try {
        const search = keyword.trim();

        const fetchServices = async (filter?: "name" | "code") => {
          const params = new URLSearchParams({
            page: "1",
            pageSize: "50",
            active: "true",
          });

          if (search && filter) {
            params.set(filter, search);
          }

          const data = await request<ListData<ServiceItem>>(
            `/catalog/services?${params.toString()}`,
          );

          return extractItems(data);
        };

        const results = search
          ? await Promise.all([fetchServices("name"), fetchServices("code")])
          : [await fetchServices()];

        const map = new Map<string, ServiceItem>();

        for (const item of results.flat()) {
          map.set(item.code, item);
        }

        const items = Array.from(map.values()).sort(
          (a, b) => text(a.name).localeCompare(text(b.name), "vi") || a.code.localeCompare(b.code),
        );

        if (sequence !== serviceRequestRef.current) {
          return;
        }

        setServices(items);

        setServiceCache((previous) => {
          const next = { ...previous };

          for (const item of items) {
            next[item.code] = item;
          }

          return next;
        });
      } catch (err) {
        if (sequence === serviceRequestRef.current) {
          messageApi.error(errorText(err));
        }
      } finally {
        if (sequence === serviceRequestRef.current) {
          setServiceLoading(false);
        }
      }
    },
    [messageApi],
  );

  const loadStaff = useCallback(async () => {
    setReferenceError("");

    try {
      const data = await request<ListData<MedicalStaff>>(
        "/catalog/medical-staff?page=1&pageSize=1000&active=true",
      );

      setStaffList(extractItems(data));
    } catch (err) {
      setReferenceError(`Không thể tải danh mục nhân viên: ${errorText(err)}`);
    }
  }, []);

  useEffect(() => {
    void loadRules();
    void loadServices();
    void loadStaff();

    return () => {
      ruleRequestRef.current++;
      serviceRequestRef.current++;
      previewRequestRef.current++;
    };
  }, [loadRules, loadServices, loadStaff]);

  useEffect(() => {
    const element = tableContainerRef.current;

    if (!element) return;

    const updateHeight = () => {
      const available = element.getBoundingClientRect().height - 130;

      setTableScrollHeight(Math.max(160, Math.floor(available)));
    };

    const frame = window.requestAnimationFrame(updateHeight);

    const observer = new ResizeObserver(updateHeight);

    observer.observe(element);

    window.addEventListener("resize", updateHeight);

    return () => {
      window.cancelAnimationFrame(frame);

      window.removeEventListener("resize", updateHeight);

      observer.disconnect();
    };
  }, []);

  const serviceOptions = useMemo(() => {
    const map = new Map(services.map((item) => [item.code, item]));

    for (const code of [filterServiceCode, editing?.service_code]) {
      if (code && !map.has(code)) {
        map.set(
          code,
          serviceCache[code] ?? {
            code,
            name: "",
          },
        );
      }
    }

    return Array.from(map.values()).map((item) => ({
      value: item.code,
      label: item.name ? `${item.code} - ${item.name}` : item.code,
    }));
  }, [services, serviceCache, filterServiceCode, editing]);

  const staffMap = useMemo(() => {
    const map = new Map<string, MedicalStaff>();

    for (const staff of staffList) {
      const license = text(staff.licenseNumber);

      const insurance = text(staff.socialInsuranceCode);

      if (license) {
        map.set(license, staff);
      }

      if (insurance) {
        map.set(insurance, staff);
      }
    }

    return map;
  }, [staffList]);

  const staffOptions = useMemo(() => {
    const map = new Map<string, string>();

    for (const staff of staffList) {
      const code = text(staff.licenseNumber) || text(staff.socialInsuranceCode);

      if (code && !map.has(code)) {
        map.set(code, `${staff.fullName} - ${code}`);
      }
    }

    for (const code of [filterStaffCode, editing?.staff_code]) {
      if (code && !map.has(code)) {
        const staff = staffMap.get(code);

        map.set(code, staff ? `${staff.fullName} - ${code}` : code);
      }
    }

    return Array.from(map.entries())
      .map(([value, label]) => ({
        value,
        label,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [staffList, staffMap, filterStaffCode, editing]);

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!filterServiceCode || row.service_code === filterServiceCode) &&
          (!filterStaffCode || row.staff_code === filterStaffCode) &&
          (!filterActivityType || row.activity_type === filterActivityType),
      ),
    [rows, filterServiceCode, filterStaffCode, filterActivityType],
  );

  const safePage = Math.min(currentPage, Math.max(1, Math.ceil(filteredRows.length / pageSize)));

  function backToCatalog() {
    sessionStorage.setItem("catalog-active-tab", "rules");

    navigate("/catalog");
  }

  function resetFilters() {
    setFilterServiceCode(undefined);
    setFilterStaffCode(undefined);
    setFilterActivityType(undefined);
    setCurrentPage(1);

    void loadServices();
  }

  function refresh() {
    void loadRules();
    void loadServices();
    void loadStaff();
  }

  function openForm(record?: RuleRow) {
    setEditing(record ?? null);

    form.resetFields();

    form.setFieldsValue({
      service_code: record?.service_code ?? filterServiceCode ?? "",
      staff_code: record?.staff_code ?? filterStaffCode ?? "",
      specialty_code: record?.specialty_code ?? "",
      activity_type: record?.activity_type ?? filterActivityType ?? "THUCHIEN_CDHA",
      active: record ? record.active === true : true,
      note: record?.note ?? "",
    });

    setModalOpen(true);

    if (services.length === 0) {
      void loadServices();
    }
  }

  function closeForm() {
    if (savingRef.current) return;

    setModalOpen(false);
  }

  async function handleSave(values: FormValues) {
    if (savingRef.current) return;

    savingRef.current = true;
    setSaving(true);

    try {
      const path = editing ? `/${encodeURIComponent(editing.id)}` : "";

      await request(`${API}${path}`, {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({
          service_code: text(values.service_code),
          staff_code: text(values.staff_code),
          specialty_code: text(values.specialty_code) || null,
          activity_type: values.activity_type,

          // Trang này quản lý danh sách
          // nhân viên được phép thực hiện.
          allowed: true,

          // Chỉ có một công tắc bật/tắt.
          active: values.active === true,

          note: text(values.note) || null,
        }),
      });

      messageApi.success(editing ? "Đã cập nhật cấu hình." : "Đã thêm cấu hình.");

      setModalOpen(false);

      await loadRules();
    } catch (err) {
      messageApi.error(errorText(err));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleDelete(record: RuleRow) {
    setDeletingId(record.id);

    try {
      await request(`${API}/${encodeURIComponent(record.id)}`, { method: "DELETE" });

      messageApi.success("Đã xóa cấu hình.");

      await loadRules();
    } catch (err) {
      messageApi.error(errorText(err));
    } finally {
      setDeletingId(null);
    }
  }

  async function downloadTemplate() {
    setDownloading(true);

    try {
      const response = await apiFetch(`${API}/template`, { method: "GET" });

      if (!response.ok) {
        throw new Error(`Không thể tải file mẫu (HTTP ${response.status}).`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = "service_staff_template.xlsx";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      messageApi.error(errorText(err));
    } finally {
      setDownloading(false);
    }
  }

  function openImportModal() {
    previewRequestRef.current++;
    setImportFileList([]);
    setImportPreview(null);
    setImportOpen(true);
  }

  function closeImportModal() {
    if (importingRef.current || previewing) {
      return;
    }

    previewRequestRef.current++;
    setImportOpen(false);
    setImportFileList([]);
    setImportPreview(null);
  }

  async function previewExcel(file: File) {
    const sequence = ++previewRequestRef.current;

    setPreviewing(true);
    setImportPreview(null);

    try {
      const body = new FormData();
      body.append("file", file);

      const data = await request<PreviewData>(`${API}/import/preview`, {
        method: "POST",
        body,
      });

      if (!data || !Array.isArray(data.rows)) {
        throw new Error("Dữ liệu kiểm tra Excel không hợp lệ.");
      }

      if (sequence !== previewRequestRef.current) {
        return;
      }

      setImportPreview({
        totalRows: Number(data.totalRows ?? 0),
        valid: Number(data.valid ?? 0),
        invalid: Number(data.invalid ?? 0),
        duplicate: Number(data.duplicate ?? 0),
        rows: data.rows,
      });
    } catch (err) {
      if (sequence === previewRequestRef.current) {
        messageApi.error(errorText(err));
      }
    } finally {
      if (sequence === previewRequestRef.current) {
        setPreviewing(false);
      }
    }
  }

  async function handleImportExcel() {
    if (importingRef.current) return;

    const file = importFileList[0]?.originFileObj;

    if (!file || !importPreview || importPreview.valid <= 0 || previewing) {
      messageApi.warning("Vui lòng chọn file có dữ liệu hợp lệ trước khi import.");
      return;
    }

    importingRef.current = true;
    setImporting(true);

    try {
      const body = new FormData();
      body.append("file", file);

      const data = await request<ImportResult>(`${API}/import`, {
        method: "POST",
        body,
      });

      messageApi.success(
        `Import thành công: ` +
          `${Number(data?.inserted ?? 0)} thêm mới, ` +
          `${Number(data?.updated ?? 0)} cập nhật, ` +
          `${Number(data?.skipped ?? 0)} bỏ qua.`,
      );

      setImportOpen(false);
      setImportFileList([]);
      setImportPreview(null);

      await loadRules();
    } catch (err) {
      messageApi.error(errorText(err));
    } finally {
      importingRef.current = false;
      setImporting(false);
    }
  }

  const columns: ColumnsType<RuleRow> = [
    {
      title: "STT",
      key: "index",
      width: 60,
      align: "center",
      render: (_, __, index) => (safePage - 1) * pageSize + index + 1,
    },
    {
      title: "Dịch vụ kỹ thuật",
      dataIndex: "service_code",
      width: 320,
      render: (code: string) => {
        const name = serviceCache[code]?.name;

        return (
          <div className="ss-cell">
            <Text strong>{name || code}</Text>

            {name && (
              <Text type="secondary" className="ss-secondary">
                {code}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: "Nhân viên",
      dataIndex: "staff_code",
      width: 280,
      render: (code: string) => {
        const name = staffMap.get(code)?.fullName;

        return (
          <div className="ss-person">
            <div className="ss-avatar">
              <TeamOutlined />
            </div>

            <div className="ss-cell">
              <Text strong>{name || code}</Text>

              {name && (
                <Text type="secondary" className="ss-secondary">
                  {code}
                </Text>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: "Loại thực hiện",
      dataIndex: "activity_type",
      width: 280,
      render: (value: string) => (
        <Tag color="blue" className="ss-wrap-tag">
          {getActivityLabel(value)}
        </Tag>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "active",
      width: 110,
      align: "center",
      render: (active: boolean) => (
        <Tag color={active ? "success" : "default"}>{active ? "Đang bật" : "Đã tắt"}</Tag>
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
              className="ss-edit"
              disabled={busy || loading}
              onClick={() => openForm(record)}
            />
          </Tooltip>

          <Popconfirm
            title="Xóa cấu hình?"
            description="Bạn có chắc muốn xóa quyền thực hiện này?"
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{
              danger: true,
            }}
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

  const importColumns: ColumnsType<PreviewRow> = [
    {
      title: "Dòng",
      dataIndex: "row",
      width: 65,
      align: "center",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 110,
      render: (value: PreviewRow["status"]) => (
        <Tag color={value === "VALID" ? "success" : value === "ERROR" ? "error" : "warning"}>
          {value === "VALID" ? "Hợp lệ" : value === "ERROR" ? "Lỗi" : "Trùng"}
        </Tag>
      ),
    },
    {
      title: "Mã DVKT",
      dataIndex: "serviceCode",
      width: 160,
    },
    {
      title: "Mã nhân viên",
      dataIndex: "staffCode",
      width: 180,
    },
    {
      title: "Loại thực hiện",
      dataIndex: "activityType",
      width: 180,
    },
    {
      title: "Ghi chú",
      dataIndex: "message",
      width: 240,
    },
  ];

  return (
    <div className="ss-page">
      {contextHolder}

      <Breadcrumb
        items={[
          {
            title: (
              <Button
                type="link"
                size="small"
                className="ss-crumb"
                aria-label="Trang chủ"
                icon={<HomeOutlined />}
                onClick={() => navigate("/")}
              />
            ),
          },
          {
            title: (
              <Button type="link" size="small" className="ss-crumb" onClick={backToCatalog}>
                Danh mục
              </Button>
            ),
          },
          {
            title: "DVKT - Nhân viên",
          },
        ]}
      />

      <div className="ss-header">
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
            DVKT - Nhân viên
          </Title>

          <Text type="secondary" className="ss-subtitle">
            Cấu hình bác sĩ và nhân viên được phép thực hiện từng DVKT
          </Text>
        </div>

        <Space size={8} wrap>
          <Button
            icon={<DownloadOutlined />}
            loading={downloading}
            onClick={() => void downloadTemplate()}
          >
            File mẫu
          </Button>

          <Button icon={<UploadOutlined />} disabled={busy || loading} onClick={openImportModal}>
            Import Excel
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

      {(error || referenceError) && (
        <Alert
          type={error ? "error" : "warning"}
          showIcon
          message={error ? "Không thể tải cấu hình" : "Không thể tải đủ danh mục"}
          description={error || referenceError}
          action={
            <Button size="small" disabled={busy || loading} onClick={refresh}>
              Thử lại
            </Button>
          }
        />
      )}

      <div className="ss-filters">
        <div className="ss-filter">
          <label htmlFor="ss-service">Dịch vụ kỹ thuật</label>

          <Select
            id="ss-service"
            showSearch
            allowClear
            filterOption={false}
            value={filterServiceCode}
            placeholder="Nhập mã hoặc tên DVKT"
            options={serviceOptions}
            loading={serviceLoading}
            onSearch={(value) => void loadServices(value)}
            onChange={(value) => {
              setFilterServiceCode(value);
              setCurrentPage(1);

              if (!value) {
                void loadServices();
              }
            }}
          />
        </div>

        <div className="ss-filter">
          <label htmlFor="ss-staff">Nhân viên</label>

          <Select
            id="ss-staff"
            showSearch
            allowClear
            optionFilterProp="label"
            value={filterStaffCode}
            placeholder="Tất cả nhân viên"
            options={staffOptions}
            onChange={(value) => {
              setFilterStaffCode(value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="ss-filter">
          <label htmlFor="ss-activity">Loại thực hiện</label>

          <Select
            id="ss-activity"
            allowClear
            value={filterActivityType}
            placeholder="Tất cả loại"
            options={ACTIVITY_OPTIONS}
            onChange={(value) => {
              setFilterActivityType(value);
              setCurrentPage(1);
            }}
          />
        </div>

        <Button icon={<ReloadOutlined />} disabled={busy} onClick={resetFilters}>
          Xóa bộ lọc
        </Button>
      </div>

      <div className="ss-table-wrap" ref={tableContainerRef}>
        <Card
          className="ss-table"
          styles={{
            body: { padding: 0 },
          }}
        >
          <Table<RuleRow>
            rowKey="id"
            columns={columns}
            dataSource={filteredRows}
            loading={loading}
            tableLayout="fixed"
            size="middle"
            scroll={{
              x: 1150,
              y: tableScrollHeight,
            }}
            locale={{
              emptyText: error
                ? "Chưa tải được dữ liệu."
                : rows.length === 0
                  ? "Chưa có cấu hình DVKT - Nhân viên."
                  : "Không có cấu hình phù hợp bộ lọc.",
            }}
            pagination={{
              current: safePage,
              pageSize,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              showTotal: (total, range) => `Hiển thị ${range[0]}-${range[1]} / Tổng số: ${total}`,
              onChange: (nextPage, nextSize) => {
                setCurrentPage(nextSize !== pageSize ? 1 : nextPage);
                setPageSize(nextSize);
              },
            }}
          />
        </Card>
      </div>

      <Text type="secondary" className="ss-legend">
        Cấu hình đang bật được áp dụng khi chạy lại kiểm tra hồ sơ.
      </Text>

      <Modal
        open={modalOpen}
        forceRender
        centered
        width={760}
        className="ss-modal"
        title={
          <div className="ss-modal-heading">
            <div className="ss-modal-icon">
              <TeamOutlined />
            </div>

            <div>
              <div className="ss-modal-title">
                {editing ? "Cập nhật DVKT - Nhân viên" : "Thêm DVKT - Nhân viên"}
              </div>

              <div className="ss-subtitle">Cấu hình quyền thực hiện DVKT cho nhân viên</div>
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
            name="service_code"
            label="Dịch vụ kỹ thuật"
            rules={[
              {
                required: true,
                message: "Vui lòng chọn DVKT.",
              },
            ]}
          >
            <Select
              showSearch
              allowClear
              filterOption={false}
              loading={serviceLoading}
              options={serviceOptions}
              placeholder="Nhập mã hoặc tên DVKT"
              notFoundContent={serviceLoading ? "Đang tìm..." : "Không tìm thấy DVKT"}
              onSearch={(value) => void loadServices(value)}
              onClear={() => void loadServices()}
            />
          </Form.Item>

          <Form.Item
            name="staff_code"
            label="Nhân viên"
            rules={[
              {
                required: true,
                message: "Vui lòng chọn nhân viên.",
              },
            ]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={staffOptions}
              placeholder="Chọn nhân viên"
              notFoundContent="Không tìm thấy nhân viên"
            />
          </Form.Item>

          <div className="ss-form-grid">
            <Form.Item
              name="activity_type"
              label="Loại thực hiện"
              rules={[
                {
                  required: true,
                  message: "Vui lòng chọn loại thực hiện.",
                },
              ]}
            >
              <Select options={ACTIVITY_OPTIONS} />
            </Form.Item>

            <Form.Item name="specialty_code" label="Mã chuyên khoa">
              <Input placeholder="Không bắt buộc" />
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

          <div className="ss-switch-box">
            <div>
              <Text strong>Kích hoạt cấu hình</Text>

              <Text className="ss-subtitle">
                Bật để áp dụng quyền thực hiện DVKT cho nhân viên này
              </Text>
            </div>

            <Form.Item name="active" valuePropName="checked" noStyle>
              <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        open={importOpen}
        centered
        width={1050}
        destroyOnHidden
        className="ss-import-modal"
        title={
          <div className="ss-modal-heading">
            <div className="ss-modal-icon">
              <UploadOutlined />
            </div>

            <div>
              <div className="ss-modal-title">Import DVKT - Nhân viên</div>

              <div className="ss-subtitle">Kiểm tra dữ liệu Excel trước khi nhập vào danh mục</div>
            </div>
          </div>
        }
        closable={!importing && !previewing}
        maskClosable={!importing && !previewing}
        keyboard={!importing && !previewing}
        onCancel={closeImportModal}
        footer={[
          <Button key="cancel" disabled={importing || previewing} onClick={closeImportModal}>
            Hủy
          </Button>,
          <Button
            key="import"
            type="primary"
            icon={<UploadOutlined />}
            loading={importing}
            disabled={previewing || !importPreview || importPreview.valid <= 0}
            onClick={() => void handleImportExcel()}
          >
            Import
          </Button>,
        ]}
      >
        <div className="ss-upload-area">
          <Upload
            accept=".xlsx"
            maxCount={1}
            disabled={importing || previewing}
            fileList={importFileList}
            beforeUpload={(file) => {
              if (!file.name.toLowerCase().endsWith(".xlsx")) {
                messageApi.error("Vui lòng chọn file Excel .xlsx.");

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

              void previewExcel(file);

              return false;
            }}
            onRemove={() => {
              if (importing || previewing) {
                return false;
              }

              previewRequestRef.current++;
              setImportFileList([]);
              setImportPreview(null);

              return true;
            }}
          >
            <Button
              icon={<UploadOutlined />}
              loading={previewing}
              disabled={importing || previewing}
            >
              Chọn file Excel
            </Button>
          </Upload>

          <Button
            type="link"
            icon={<DownloadOutlined />}
            loading={downloading}
            onClick={() => void downloadTemplate()}
          >
            Tải file mẫu
          </Button>
        </div>

        {previewing && (
          <Alert
            type="info"
            showIcon
            message="Đang kiểm tra dữ liệu Excel..."
            style={{ marginTop: 16 }}
          />
        )}

        {importPreview && !previewing && (
          <>
            <div className="ss-import-summary">
              {[
                {
                  label: "Tổng số",
                  value: importPreview.totalRows,
                  className: "",
                },
                {
                  label: "Hợp lệ",
                  value: importPreview.valid,
                  className: "ss-summary-success",
                },
                {
                  label: "Lỗi",
                  value: importPreview.invalid,
                  className: "ss-summary-error",
                },
                {
                  label: "Trùng",
                  value: importPreview.duplicate,
                  className: "ss-summary-warning",
                },
              ].map((item) => (
                <div key={item.label} className={`ss-summary-item ${item.className}`}>
                  <div className="ss-summary-label">{item.label}</div>

                  <div className="ss-summary-value">{item.value}</div>
                </div>
              ))}
            </div>

            {importPreview.invalid > 0 && (
              <Alert
                type="warning"
                showIcon
                message="File có dòng lỗi"
                description="Các dòng lỗi sẽ không được import. Xem chi tiết trong cột Ghi chú."
                style={{
                  marginBottom: 12,
                }}
              />
            )}

            <div className="ss-preview-table">
              <Table<PreviewRow>
                rowKey={(record) =>
                  `${record.row}-${record.serviceCode}-${record.staffCode}-${record.activityType}`
                }
                columns={importColumns}
                dataSource={importPreview.rows}
                size="small"
                tableLayout="fixed"
                scroll={{
                  x: 1035,
                  y: 320,
                }}
                pagination={{
                  defaultPageSize: 10,
                  showSizeChanger: false,
                  showTotal: (total) => `Tổng số: ${total}`,
                }}
              />
            </div>
          </>
        )}
      </Modal>

      <style>
        {`
          .ss-page {
            display: flex;
            flex-direction: column;
            gap: 15px;
            width: 100%;
            min-width: 0;
            height: calc(100dvh - 165px);
            min-height: 480px;
          }

          .ss-page > .ant-breadcrumb,
          .ss-header,
          .ss-filters,
          .ss-page > .ant-alert,
          .ss-legend {
            flex-shrink: 0;
          }

          .ss-page .ant-breadcrumb {
            font-size: 12px;
          }

          .ss-crumb.ant-btn {
            height: auto;
            padding: 0;
            font-size: 12px;
            line-height: inherit;
          }

          .ss-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }

          .ss-header .ant-btn {
            height: 36px;
            border-radius: 8px;
            font-weight: 600;
          }

          .ss-subtitle {
            display: block;
            margin-top: 4px;
            color: #64748b;
            font-size: 12px;
            font-weight: 400;
            line-height: 1.6;
          }

          .ss-filters {
            display: grid;
            grid-template-columns:
              minmax(0, 1.3fr)
              minmax(0, 1.1fr)
              minmax(0, 1fr)
              auto;
            align-items: end;
            gap: 10px;
          }

          .ss-filter {
            display: flex;
            flex-direction: column;
            min-width: 0;
            gap: 6px;
          }

          .ss-filter > label {
            color: #172033;
            font-size: 12px;
            font-weight: 600;
          }

          .ss-filter .ant-select {
            width: 100%;
          }

          .ss-filters > .ant-btn {
            height: 32px;
            border-radius: 7px;
            font-weight: 600;
          }

          .ss-table-wrap {
            flex: 1 1 auto;
            min-width: 0;
            min-height: 290px;
          }

          .ss-table,
          .ss-preview-table {
            min-width: 0;
            overflow: hidden;
            border: 1px solid #dfe6ee;
            border-radius: 8px;
            box-shadow:
              0 2px 8px rgba(15, 23, 42, .03);
          }

          .ss-table
          .ant-table-thead > tr > th,
          .ss-preview-table
          .ant-table-thead > tr > th {
            background: #f2f5f8 !important;
            color: #334155;
            font-size: 12px;
            font-weight: 700;
            border-bottom: 1px solid #d8e0e8;
          }

          .ss-table
          .ant-table-tbody > tr > td,
          .ss-preview-table
          .ant-table-tbody > tr > td {
            padding: 11px 12px;
            color: #334155;
            font-size: 12px;
            vertical-align: middle;
            overflow-wrap: anywhere;
          }

          .ss-table
          .ant-table-tbody > tr:hover > td {
            background: #f7fbff !important;
          }

          .ss-cell {
            display: flex;
            flex-direction: column;
            gap: 3px;
            min-width: 0;
            white-space: normal;
            overflow-wrap: anywhere;
            line-height: 1.65;
          }

          .ss-cell .ant-typography {
            font-size: 12px;
          }

          .ss-secondary {
            display: block;
            font-size: 11px !important;
          }

          .ss-person {
            display: flex;
            align-items: center;
            gap: 9px;
          }

          .ss-avatar {
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

          .ss-table .ant-tag,
          .ss-preview-table .ant-tag {
            margin: 0;
            border-radius: 999px;
            font-size: 11px;
          }

          .ss-wrap-tag {
            max-width: 100%;
            white-space: normal;
            overflow-wrap: anywhere;
            line-height: 1.7;
          }

          .ss-edit {
            color: #1677ff;
          }

          .ss-table .ant-pagination {
            margin: 12px !important;
          }

          .ss-legend {
            margin-top: -5px;
            font-size: 11px;
            line-height: 1.7;
          }

          .ss-modal .ant-modal-content,
          .ss-import-modal .ant-modal-content {
            border-radius: 14px;
          }

          .ss-modal-heading {
            display: flex;
            align-items: center;
            gap: 12px;
            padding-bottom: 8px;
          }

          .ss-modal-icon {
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

          .ss-modal-title {
            color: #172033;
            font-size: 18px;
            font-weight: 800;
          }

          .ss-form-grid {
            display: grid;
            grid-template-columns:
              minmax(0, 1fr)
              minmax(0, 1fr);
            column-gap: 16px;
          }

          .ss-modal
          .ant-form-item-label > label {
            font-size: 12px;
            font-weight: 600;
          }

          .ss-modal .ant-input,
          .ss-modal .ant-select-selector {
            border-radius: 8px;
          }

          .ss-modal input.ant-input {
            min-height: 36px;
          }

          .ss-switch-box {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            width: 100%;
            padding: 13px 15px;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            background: #fafcff;
          }

          .ss-switch-box .ant-typography {
            font-size: 12px;
          }

          .ss-switch-box .ant-switch {
            flex-shrink: 0;
          }

          .ss-upload-area {
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

          .ss-import-summary {
            display: grid;
            grid-template-columns:
              repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin: 16px 0 12px;
          }

          .ss-summary-item {
            padding: 12px 14px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            background: #fff;
          }

          .ss-summary-label {
            color: #64748b;
            font-size: 12px;
            font-weight: 600;
          }

          .ss-summary-value {
            margin-top: 3px;
            color: #172033;
            font-size: 23px;
            font-weight: 800;
          }

          .ss-summary-success {
            border-color: #d9f7be;
            background: #f6ffed;
          }

          .ss-summary-error {
            border-color: #ffccc7;
            background: #fff2f0;
          }

          .ss-summary-warning {
            border-color: #ffe58f;
            background: #fffbe6;
          }

          .ss-modal
          .ant-modal-footer .ant-btn,
          .ss-import-modal
          .ant-modal-footer .ant-btn {
            border-radius: 8px;
          }

          @media (max-width: 1200px) {
            .ss-header {
              flex-direction: column;
            }

            .ss-filters {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 600px) {
            .ss-page {
              height: auto;
              min-height: 0;
            }

            .ss-table-wrap {
              flex: none;
              height: 480px;
            }

            .ss-filters,
            .ss-form-grid {
              grid-template-columns: 1fr;
            }

            .ss-import-summary {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .ss-upload-area {
              align-items: flex-start;
              flex-direction: column;
            }

            .ss-modal-title {
              font-size: 16px;
            }
          }
        `}
      </style>
    </div>
  );
}
