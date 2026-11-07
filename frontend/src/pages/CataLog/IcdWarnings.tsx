import { useCallback, useEffect, useRef, useState } from "react";

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
  CheckCircleOutlined,
  EditOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StopOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import { apiFetch } from "../../api/apiClient";

const { Title, Text } = Typography;

const API = "/catalog/icd-warnings";

interface IcdWarningItem {
  id: string;
  icdCode: string;
  errorCode: string;
  diseaseName: string | null;
  errorMessage: string | null;
  active: boolean;
  note: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface FormValues {
  icdCode: string;
  errorCode: string;
  diseaseName?: string | null;
  errorMessage: string;
  active: boolean;
  note?: string | null;
}

interface Filters {
  icdCode: string;
  errorCode: string;
  diseaseName: string;
}

interface ListData {
  items: IcdWarningItem[];
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
  icdCode: "",
  errorCode: "",
  diseaseName: "",
};

const text = (value: unknown): string => String(value ?? "").trim();

const getError = (error: unknown): string =>
  error instanceof Error ? error.message : "Không thể thực hiện yêu cầu.";

async function readResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error(`API không trả về JSON (HTTP ${response.status}).`);
  }

  return (await response.json()) as ApiResponse<T>;
}

async function request<T>(path = "", init?: RequestInit): Promise<T | undefined> {
  const headers = new Headers(init?.headers);

  if (init?.body && !(init.body instanceof FormData)) {
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

  const json = await readResponse<T>(response);

  if (!response.ok || json.success !== true) {
    throw new Error(json.message || json.error || `Lỗi HTTP ${response.status}`);
  }

  return json.data;
}

export default function IcdWarnings() {
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  const [form] = Form.useForm<FormValues>();

  const pageRef = useRef<HTMLDivElement>(null);
  const tableRegionRef = useRef<HTMLDivElement>(null);

  const requestSequence = useRef(0);
  const savingRef = useRef(false);
  const importingRef = useRef(false);

  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  const [tableScrollY, setTableScrollY] = useState(320);

  const [items, setItems] = useState<IcdWarningItem[]>([]);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [inputs, setInputs] = useState<Filters>({ ...EMPTY_FILTERS });

  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });

  const [formModalOpen, setFormModalOpen] = useState(false);

  const [editingItem, setEditingItem] = useState<IcdWarningItem | null>(null);

  const [saving, setSaving] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [importModalOpen, setImportModalOpen] = useState(false);

  const [importFileList, setImportFileList] = useState<UploadFile[]>([]);

  const [importing, setImporting] = useState(false);

  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [importErrors, setImportErrors] = useState<ImportError[]>([]);

  const [importMessage, setImportMessage] = useState("");

  const busy = saving || importing || togglingId !== null;

  const loadIcdWarnings = useCallback(async () => {
    const sequence = ++requestSequence.current;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });

      for (const [key, value] of Object.entries(filters)) {
        if (value.trim()) {
          params.set(key, value.trim());
        }
      }

      const data = await request<ListData>(`?${params.toString()}`);

      if (!data || !Array.isArray(data.items)) {
        throw new Error("Danh sách ICD cảnh báo không hợp lệ.");
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
        setError(getError(err));
      }
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
      }
    }
  }, [page, pageSize, filters]);

  useEffect(() => {
    void loadIcdWarnings();

    return () => {
      requestSequence.current++;
    };
  }, [loadIcdWarnings]);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      window.cancelAnimationFrame(frame);

      frame = window.requestAnimationFrame(() => {
        const pageElement = pageRef.current;
        const tableElement = tableRegionRef.current;

        if (!pageElement || !tableElement) {
          return;
        }

        const compact = window.matchMedia("(max-width: 900px), (max-height: 650px)").matches;

        if (compact) {
          setViewportHeight(null);
          setTableScrollY(320);
          return;
        }

        const top = pageElement.getBoundingClientRect().top;

        const height = Math.max(400, Math.floor(window.innerHeight - top - 18));

        setViewportHeight((previous) => (previous === height ? previous : height));

        const regionHeight = tableElement.getBoundingClientRect().height;

        const nextY = Math.max(140, Math.floor(regionHeight - 125));

        setTableScrollY((previous) => (previous === nextY ? previous : nextY));
      });
    };

    const observer = new ResizeObserver(measure);

    if (pageRef.current) {
      observer.observe(pageRef.current);
    }

    if (tableRegionRef.current) {
      observer.observe(tableRegionRef.current);
    }

    window.addEventListener("resize", measure);
    measure();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, []);

  function backToCatalog() {
    sessionStorage.setItem("catalog-active-tab", "rules");

    navigate("/catalog");
  }

  function handleSearch() {
    setPage(1);

    setFilters({
      icdCode: inputs.icdCode.trim(),
      errorCode: inputs.errorCode.trim(),
      diseaseName: inputs.diseaseName.trim(),
    });
  }

  function resetFilters() {
    setInputs({ ...EMPTY_FILTERS });
    setFilters({ ...EMPTY_FILTERS });
    setPage(1);
  }

  function openForm(item?: IcdWarningItem) {
    setEditingItem(item ?? null);
    form.resetFields();

    form.setFieldsValue({
      icdCode: text(item?.icdCode),
      errorCode: text(item?.errorCode),
      diseaseName: text(item?.diseaseName),
      errorMessage: text(item?.errorMessage),
      active: item ? item.active : true,
      note: text(item?.note),
    });

    setFormModalOpen(true);
  }

  function closeForm() {
    if (savingRef.current) return;

    setFormModalOpen(false);
    setEditingItem(null);
    form.resetFields();
  }

  async function handleSave(values: FormValues) {
    if (savingRef.current) return;

    savingRef.current = true;
    setSaving(true);

    try {
      const isEdit = Boolean(editingItem);

      const path = editingItem ? `/${encodeURIComponent(editingItem.id)}` : "";

      await request(path, {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify({
          icdCode: text(values.icdCode),
          errorCode: text(values.errorCode),
          diseaseName: text(values.diseaseName) || null,
          errorMessage: text(values.errorMessage),
          active: values.active === true,
          note: text(values.note) || null,
        }),
      });

      messageApi.success(isEdit ? "Đã cập nhật ICD cảnh báo." : "Đã thêm ICD cảnh báo.");

      setFormModalOpen(false);
      setEditingItem(null);
      form.resetFields();

      if (!isEdit && page !== 1) {
        setPage(1);
      } else {
        await loadIcdWarnings();
      }
    } catch (err) {
      messageApi.error(getError(err));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function toggleActive(item: IcdWarningItem) {
    setTogglingId(item.id);

    try {
      await request(`/${encodeURIComponent(item.id)}/toggle-active`, { method: "PATCH" });

      messageApi.success("Đã cập nhật trạng thái.");

      await loadIcdWarnings();
    } catch (err) {
      messageApi.error(getError(err));
    } finally {
      setTogglingId(null);
    }
  }

  function clearImportResult() {
    setImportResult(null);
    setImportErrors([]);
    setImportMessage("");
  }

  function openImportModal() {
    setImportFileList([]);
    clearImportResult();
    setImportModalOpen(true);
  }

  function closeImportModal() {
    if (importingRef.current) return;

    setImportModalOpen(false);
    setImportFileList([]);
    clearImportResult();
  }

  async function handleImportExcel() {
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
        const errors = Array.isArray(json.errors) ? json.errors : [];

        const description = json.message || json.error || "Import ICD cảnh báo thất bại.";

        setImportErrors(errors);
        setImportMessage(description);
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

      const description = json.message || "Import ICD cảnh báo thành công.";

      setImportMessage(description);
      messageApi.success(description);

      await loadIcdWarnings();
    } catch (err) {
      const description = getError(err);

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
        <div className="iw-clamp">{content}</div>
      </Tooltip>
    );
  }

  const columns: TableColumnsType<IcdWarningItem> = [
    {
      title: "STT",
      key: "index",
      width: 56,
      align: "center",
      render: (_, __, index) => (page - 1) * pageSize + index + 1,
    },
    {
      title: "Mã ICD",
      dataIndex: "icdCode",
      width: 100,
      render: (value: string) => (
        <Text
          strong
          style={{
            color: "#1677ff",
            fontSize: 12,
          }}
        >
          {value || "—"}
        </Text>
      ),
    },
    {
      title: "Mã lỗi",
      dataIndex: "errorCode",
      width: 110,
      render: (value: string) => (
        <Tag color="error" className="iw-code-tag">
          {value || "—"}
        </Tag>
      ),
    },
    {
      title: "Tên bệnh",
      dataIndex: "diseaseName",
      width: 220,
      render: renderLongText,
    },
    {
      title: "Nội dung cảnh báo",
      dataIndex: "errorMessage",
      width: 340,
      render: renderLongText,
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
      title: "Ghi chú",
      dataIndex: "note",
      width: 200,
      render: renderLongText,
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
              aria-label="Chỉnh sửa ICD cảnh báo"
              icon={<EditOutlined />}
              style={{
                color: "#1677ff",
              }}
              disabled={busy || loading}
              onClick={() => openForm(record)}
            />
          </Tooltip>

          <Popconfirm
            title={record.active ? "Ngừng sử dụng ICD cảnh báo?" : "Kích hoạt ICD cảnh báo?"}
            description={
              record.active
                ? `Mã ${record.icdCode} sẽ không được áp dụng khi kiểm tra hồ sơ.`
                : `Mã ${record.icdCode} sẽ được áp dụng lại khi kiểm tra hồ sơ.`
            }
            okText={record.active ? "Ngừng sử dụng" : "Kích hoạt"}
            cancelText="Hủy"
            okButtonProps={{
              danger: record.active,
            }}
            disabled={busy || loading}
            onConfirm={() => toggleActive(record)}
          >
            <Button
              type="text"
              size="small"
              aria-label={record.active ? "Ngừng sử dụng" : "Kích hoạt"}
              icon={record.active ? <StopOutlined /> : <CheckCircleOutlined />}
              style={{
                color: record.active ? "#ff4d4f" : "#52c41a",
              }}
              disabled={busy || loading}
              loading={togglingId === record.id}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const importErrorColumns: TableColumnsType<ImportError> = [
    {
      title: "Dòng",
      dataIndex: "row",
      width: 70,
      align: "center",
    },
    {
      title: "Cột",
      dataIndex: "field",
      width: 170,
    },
    {
      title: "Nội dung lỗi",
      dataIndex: "message",
      render: (value) => <div className="iw-wrap">{value}</div>,
    },
  ];

  return (
    <div
      className="iw-page"
      ref={pageRef}
      style={viewportHeight !== null ? { height: viewportHeight } : undefined}
    >
      {contextHolder}

      <Breadcrumb
        items={[
          {
            title: (
              <Button
                type="link"
                size="small"
                className="iw-crumb"
                aria-label="Trang chủ"
                icon={<HomeOutlined />}
                onClick={() => navigate("/")}
              />
            ),
          },
          {
            title: (
              <Button type="link" size="small" className="iw-crumb" onClick={backToCatalog}>
                Danh mục
              </Button>
            ),
          },
          { title: "ICD Cảnh báo" },
        ]}
      />

      <div className="iw-header">
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
            ICD Cảnh báo
          </Title>

          <Text type="secondary" className="iw-subtitle">
            Quản lý mã ICD và nội dung cảnh báo khi kiểm tra hồ sơ
          </Text>
        </div>

        <Space size={8} wrap>
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

      {error && (
        <Alert
          type="error"
          showIcon
          message="Không thể tải danh mục ICD cảnh báo"
          description={error}
          action={
            <Button size="small" disabled={busy || loading} onClick={() => void loadIcdWarnings()}>
              Thử lại
            </Button>
          }
        />
      )}

      <div className="iw-filters">
        <div className="iw-filter">
          <label htmlFor="iw-icd">Mã ICD</label>

          <Input
            id="iw-icd"
            allowClear
            value={inputs.icdCode}
            placeholder="Nhập mã ICD"
            onChange={(event) =>
              setInputs((previous) => ({
                ...previous,
                icdCode: event.target.value,
              }))
            }
            onPressEnter={handleSearch}
          />
        </div>

        <div className="iw-filter">
          <label htmlFor="iw-error">Mã lỗi</label>

          <Input
            id="iw-error"
            allowClear
            value={inputs.errorCode}
            placeholder="Nhập mã lỗi"
            onChange={(event) =>
              setInputs((previous) => ({
                ...previous,
                errorCode: event.target.value,
              }))
            }
            onPressEnter={handleSearch}
          />
        </div>

        <div className="iw-filter">
          <label htmlFor="iw-disease">Tên bệnh</label>

          <Input
            id="iw-disease"
            allowClear
            value={inputs.diseaseName}
            placeholder="Nhập tên bệnh cần tìm"
            onChange={(event) =>
              setInputs((previous) => ({
                ...previous,
                diseaseName: event.target.value,
              }))
            }
            onPressEnter={handleSearch}
          />
        </div>

        <Space size={8}>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            disabled={busy || loading}
            onClick={handleSearch}
          >
            Tìm kiếm
          </Button>

          <Button icon={<ReloadOutlined />} disabled={busy} onClick={resetFilters}>
            Xóa bộ lọc
          </Button>
        </Space>
      </div>

      <div className="iw-table-region" ref={tableRegionRef}>
        <Card
          className="iw-table"
          styles={{
            body: { padding: 0 },
          }}
        >
          <Table<IcdWarningItem>
            rowKey="id"
            columns={columns}
            dataSource={items}
            loading={loading}
            size="middle"
            tableLayout="fixed"
            scroll={{
              x: 1241,
              y: tableScrollY,
            }}
            locale={{
              emptyText: error ? "Chưa tải được dữ liệu." : "Chưa có dữ liệu ICD cảnh báo.",
            }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              showTotal: (value) => `Tổng số: ${value}`,
              onChange: (nextPage, nextSize) => {
                setPage(nextSize !== pageSize ? 1 : nextPage);
                setPageSize(nextSize);
              },
            }}
          />
        </Card>
      </div>

      <Text type="secondary" className="iw-legend">
        Cấu hình đang bật được áp dụng khi chạy lại kiểm tra hồ sơ. Di chuột vào nội dung để xem đầy
        đủ.
      </Text>

      <Modal
        open={formModalOpen}
        centered
        width={760}
        destroyOnHidden
        className="iw-modal"
        title={
          <div className="iw-modal-heading">
            <div className="iw-modal-icon">
              <SafetyCertificateOutlined />
            </div>

            <div>
              <div className="iw-modal-title">
                {editingItem ? "Cập nhật ICD cảnh báo" : "Thêm ICD cảnh báo"}
              </div>

              <div className="iw-subtitle">
                Thiết lập mã ICD và nội dung hiển thị khi kiểm tra hồ sơ
              </div>
            </div>
          </div>
        }
        okText={editingItem ? "Cập nhật" : "Thêm mới"}
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
          preserve={false}
          requiredMark={false}
          disabled={saving}
          onFinish={handleSave}
          style={{ marginTop: 18 }}
        >
          <div className="iw-form-grid">
            <Form.Item
              name="icdCode"
              label="Mã ICD"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: "Vui lòng nhập mã ICD.",
                },
              ]}
            >
              <Input maxLength={50} placeholder="Ví dụ: M62.9" />
            </Form.Item>

            <Form.Item
              name="errorCode"
              label="Mã lỗi"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: "Vui lòng nhập mã lỗi.",
                },
              ]}
            >
              <Input maxLength={100} placeholder="Ví dụ: ERR-26" />
            </Form.Item>
          </div>

          <Form.Item name="diseaseName" label="Tên bệnh">
            <Input placeholder="Nhập tên bệnh" />
          </Form.Item>

          <Form.Item
            name="errorMessage"
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
              autoSize={{
                minRows: 3,
                maxRows: 7,
              }}
              placeholder="Nhập nội dung hiển thị khi phát hiện ICD..."
            />
          </Form.Item>

          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea
              autoSize={{
                minRows: 2,
                maxRows: 5,
              }}
              placeholder="Nhập ghi chú nếu có"
            />
          </Form.Item>

          <div className="iw-active">
            <div>
              <Text strong>Kích hoạt quy tắc</Text>

              <Text type="secondary" className="iw-subtitle">
                Áp dụng trong lần kiểm tra hồ sơ tiếp theo
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
        width={920}
        destroyOnHidden
        className="iw-import-modal"
        title={
          <div className="iw-modal-heading">
            <div className="iw-modal-icon">
              <UploadOutlined />
            </div>

            <div>
              <div className="iw-modal-title">Import ICD cảnh báo</div>

              <div className="iw-subtitle">Nhập danh mục từ file Excel</div>
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
        onCancel={closeImportModal}
        onOk={() => void handleImportExcel()}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          message="Cấu trúc file Excel"
          description={
            <div className="iw-import-help">
              File cần có tối thiểu <b>ICD</b> và <b>MA_LOI</b>. Các cột bổ sung: <b>TEN_BENH</b>,{" "}
              <b>NOI_DUNG_LOI</b>, <b>TRANG_THAI</b>, <b>GHI_CHU</b>. Mã đã tồn tại sẽ được cập
              nhật, mã mới được thêm mới.
            </div>
          }
        />

        <div className="iw-upload-area">
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
              message={importMessage || "Import thành công."}
              style={{ marginTop: 16 }}
            />

            <div className="iw-import-summary">
              {[
                {
                  label: "Tổng số dòng",
                  value: importResult.totalRows,
                  className: "",
                },
                {
                  label: "Thêm mới",
                  value: importResult.inserted,
                  className: "iw-summary-success",
                },
                {
                  label: "Cập nhật",
                  value: importResult.updated,
                  className: "iw-summary-info",
                },
                {
                  label: "Bỏ qua",
                  value: importResult.skipped,
                  className: "iw-summary-warning",
                },
              ].map((item) => (
                <div key={item.label} className={`iw-summary-item ${item.className}`}>
                  <div className="iw-summary-label">{item.label}</div>

                  <div className="iw-summary-value">{item.value}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {!importResult && importMessage && (
          <Alert
            type="error"
            showIcon
            message={importMessage}
            description={
              importErrors.length > 0
                ? "Không có dữ liệu nào được import. Sửa các dòng lỗi rồi import lại."
                : undefined
            }
            style={{ marginTop: 16 }}
          />
        )}

        {importErrors.length > 0 && (
          <div className="iw-import-errors">
            <Table<ImportError>
              rowKey={(record) => `${record.row}-${record.field}-${record.message}`}
              columns={importErrorColumns}
              dataSource={importErrors}
              size="small"
              tableLayout="fixed"
              scroll={{ x: 600, y: 280 }}
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
          .iw-page {
            display: flex;
            flex-direction: column;
            gap: 15px;
            width: 100%;
            min-width: 0;
            min-height: 0;
          }

          .iw-page > .ant-breadcrumb,
          .iw-header,
          .iw-filters,
          .iw-page > .ant-alert,
          .iw-legend {
            flex-shrink: 0;
          }

          .iw-page .ant-breadcrumb {
            font-size: 12px;
          }

          .iw-crumb.ant-btn {
            height: auto;
            padding: 0;
            font-size: 12px;
            line-height: inherit;
          }

          .iw-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }

          .iw-header .ant-btn {
            height: 36px;
            border-radius: 8px;
            font-weight: 600;
          }

          .iw-subtitle {
            display: block;
            margin-top: 4px;
            color: #64748b;
            font-size: 12px;
            font-weight: 400;
            line-height: 1.6;
          }

          .iw-filters {
            display: grid;
            grid-template-columns:
              minmax(0, 1fr)
              minmax(0, 1fr)
              minmax(0, 1.4fr)
              auto;
            align-items: end;
            gap: 10px;
          }

          .iw-filter {
            display: flex;
            flex-direction: column;
            min-width: 0;
            gap: 6px;
          }

          .iw-filter > label {
            color: #172033;
            font-size: 12px;
            font-weight: 600;
          }

          .iw-filters .ant-btn {
            height: 32px;
            border-radius: 7px;
            font-weight: 600;
          }

          .iw-table-region {
            flex: 1 1 auto;
            min-width: 0;
            min-height: 265px;
          }

          .iw-table,
          .iw-import-errors {
            min-width: 0;
            overflow: hidden;
            border: 1px solid #dfe6ee;
            border-radius: 8px;
            box-shadow:
              0 2px 8px rgba(15, 23, 42, .03);
          }

          .iw-table
          .ant-table-thead > tr > th,
          .iw-import-errors
          .ant-table-thead > tr > th {
            background: #f2f5f8 !important;
            color: #334155;
            font-size: 12px;
            font-weight: 700;
            border-bottom: 1px solid #d8e0e8;
          }

          .iw-table
          .ant-table-tbody > tr > td,
          .iw-import-errors
          .ant-table-tbody > tr > td {
            padding: 11px 12px;
            color: #334155;
            font-size: 12px;
            vertical-align: middle;
            overflow-wrap: anywhere;
          }

          .iw-table
          .ant-table-tbody > tr:hover > td {
            background: #f7fbff !important;
          }

          .iw-table .ant-tag {
            margin: 0;
            border-radius: 999px;
            font-size: 11px;
          }

          .iw-code-tag {
            max-width: 100%;
            white-space: normal;
            overflow-wrap: anywhere;
          }

          .iw-table .ant-pagination {
            margin: 12px !important;
          }

          .iw-clamp {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            line-height: 20px;
            max-height: 40px;
          }

          .iw-wrap {
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            line-height: 1.7;
          }

          .iw-legend {
            margin-top: -5px;
            font-size: 11px;
            line-height: 1.7;
          }

          .iw-modal .ant-modal-content,
          .iw-import-modal .ant-modal-content {
            border-radius: 14px;
          }

          .iw-modal-heading {
            display: flex;
            align-items: center;
            gap: 12px;
            padding-bottom: 8px;
          }

          .iw-modal-icon {
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

          .iw-modal-title {
            color: #172033;
            font-size: 18px;
            font-weight: 800;
          }

          .iw-form-grid {
            display: grid;
            grid-template-columns:
              minmax(0, 1fr)
              minmax(0, 1fr);
            column-gap: 16px;
          }

          .iw-modal
          .ant-form-item-label > label {
            font-size: 12px;
            font-weight: 600;
          }

          .iw-modal .ant-input {
            border-radius: 8px;
          }

          .iw-modal input.ant-input {
            min-height: 36px;
          }

          .iw-active {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            background: #fafcff;
          }

          .iw-modal
          .ant-modal-footer .ant-btn,
          .iw-import-modal
          .ant-modal-footer .ant-btn {
            border-radius: 8px;
          }

          .iw-import-help {
            font-size: 12px;
            line-height: 1.8;
          }

          .iw-upload-area {
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

          .iw-import-summary {
            display: grid;
            grid-template-columns:
              repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-top: 16px;
          }

          .iw-summary-item {
            padding: 12px 14px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            background: #fff;
          }

          .iw-summary-label {
            color: #64748b;
            font-size: 12px;
            font-weight: 600;
          }

          .iw-summary-value {
            margin-top: 3px;
            color: #172033;
            font-size: 23px;
            font-weight: 800;
          }

          .iw-summary-success {
            border-color: #d9f7be;
            background: #f6ffed;
          }

          .iw-summary-info {
            border-color: #bae0ff;
            background: #e6f4ff;
          }

          .iw-summary-warning {
            border-color: #ffe58f;
            background: #fffbe6;
          }

          .iw-import-errors {
            margin-top: 14px;
          }

          @media (max-width: 1100px) {
            .iw-header {
              flex-direction: column;
            }

            .iw-filters {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 900px),
                 (max-height: 650px) {
            .iw-page {
              height: auto !important;
            }

            .iw-table-region {
              flex: none;
              min-height: 0;
            }
          }

          @media (max-width: 600px) {
            .iw-filters,
            .iw-form-grid {
              grid-template-columns: 1fr;
            }

            .iw-import-summary {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .iw-upload-area {
              align-items: flex-start;
              flex-direction: column;
            }

            .iw-modal-title {
              font-size: 16px;
            }
          }
        `}
      </style>
    </div>
  );
}
