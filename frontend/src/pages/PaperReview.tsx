import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  DownloadOutlined,
  FileSearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import api from "../api/apiClient";
import { useAuth } from "../auth/AuthContext";
import "./PaperReview.css";
const { Text, Title } = Typography;
type Fields = {
  patientId: string;
  encounterId: string;
  name: string;
  birthDate: string;
  gender: string;
  visitDate: string;
  weight: string;
  icd: string;
};
type Page = {
  id: string;
  file_id: string;
  original_name: string;
  page_number: number;
  document_type: string;
  case_key: string;
  suggested_case_key?: string;
  fields: Fields;
  confirmed: boolean;
  review_status: string;
  note: string;
  version: number;
  confidence: number;
};
type Finding = {
  code: string;
  severity: "ERROR" | "REVIEW";
  message: string;
  pageIds: string[];
  field?: keyof Fields;
};
type Batch = {
  id: string;
  name: string;
  created_at: string;
  file_count: number;
  completed_count: number;
  failed_count: number;
};
type FileRow = { id: string; original_name: string; status: string; error: string | null };
type BatchData = { batch: Batch; files: FileRow[]; pages: Page[]; findings: Finding[] };
type Ocr = {
  text: string;
  width: number;
  height: number;
  confidence: number;
  lines: {
    text: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
};
const types = [
  { value: "STATEMENT", label: "Bảng kê" },
  { value: "PRESCRIPTION", label: "Đơn thuốc" },
  { value: "ORDER", label: "Phiếu chỉ định" },
  { value: "CONTINUATION", label: "Trang tiếp / trang ký" },
  { value: "UNKNOWN", label: "Chưa xác định" },
];
const fieldLabels: Record<keyof Fields, string> = {
  patientId: "Mã bệnh nhân",
  encounterId: "Mã lượt khám / hồ sơ",
  name: "Họ tên",
  birthDate: "Ngày sinh (DD/MM/YYYY)",
  gender: "Giới tính",
  visitDate: "Ngày khám (DD/MM/YYYY)",
  weight: "Cân nặng (kg)",
  icd: "ICD (ngăn cách bằng dấu ;)",
};
const ruleLabels = {
  requiredBirthDate: "Kiểm tra thiếu ngày sinh",
  requiredGender: "Kiểm tra thiếu giới tính",
  requiredIcd: "Kiểm tra thiếu ICD trên bảng kê / đơn thuốc",
  requiredWeight: "Yêu cầu cân nặng trên các trang thông tin chính",
  compareIdentity: "Đối chiếu thông tin bệnh nhân giữa các giấy",
  icdCoverage: "Kiểm tra ICD trên đơn có trong bảng kê đã ghép",
};
type Rules = Record<keyof typeof ruleLabels, boolean>;
const reviewLabels: Record<string, string> = {
  PENDING: "Chưa xử lý",
  NEEDS_FIX: "Cần bổ sung",
  RESOLVED: "Đã xử lý",
};
function errorText(e: unknown) {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    "Không kết nối được máy chủ. Vui lòng thử lại."
  );
}
function statusFor(page: Page, findings: Finding[]) {
  const own = findings.filter((f) => f.pageIds.includes(page.id));
  return own.some((f) => f.severity === "ERROR") ? "ERROR" : own.length ? "REVIEW" : "PASS";
}
function norm(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toUpperCase();
}
export default function PaperReview() {
  const { user } = useAuth();
  return (
    <App>
      <PaperReviewScreen key={user?.branchId} />
    </App>
  );
}
function PaperReviewScreen() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]),
    [batchId, setBatchId] = useState(""),
    [data, setData] = useState<BatchData | null>(null);
  const [cap, setCap] = useState<{ ready: boolean; message: string } | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [uploadBatchId, setUploadBatchId] = useState("");
  const [createOpen, setCreateOpen] = useState(false),
    [batchName, setBatchName] = useState(""),
    [files, setFiles] = useState<File[]>([]),
    [uploading, setUploading] = useState(false),
    [uploaded, setUploaded] = useState(0);
  const [filter, setFilter] = useState("ALL"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<React.Key[]>([]),
    [groupKey, setGroupKey] = useState("");
  const [rulesOpen, setRulesOpen] = useState(false),
    [rules, setRules] = useState<Rules | null>(null),
    [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Page | null>(null),
    [ocr, setOcr] = useState<Ocr | null>(null),
    [imageUrl, setImageUrl] = useState(""),
    [pageError, setPageError] = useState(""),
    [highlight, setHighlight] = useState<keyof Fields | undefined>(),
    [zoom, setZoom] = useState(100);
  const uploadAbort = useRef<AbortController | null>(null),
    [form] = Form.useForm();
  const activeData = data?.batch.id === batchId ? data : null;
  const refreshBatches = useCallback(async (signal?: AbortSignal) => {
    const r = await api.get<Batch[]>("/paper-review/batches", { signal });
    setBatches(r.data);
    return r.data;
  }, []);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!batchId) return;
      const r = await api.get<BatchData>(`/paper-review/batches/${batchId}`, { signal });
      setData(r.data);
      setError("");
    },
    [batchId],
  );
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const c = await api.get("/paper-review/capabilities", { signal: controller.signal });
        setCap(c.data);
        if (c.data.ready) {
          const bs = await refreshBatches(controller.signal);
          if (bs[0]) setBatchId(bs[0].id);
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(errorText(e));
      }
    })();
    return () => {
      controller.abort();
      uploadAbort.current?.abort();
    };
  }, [user?.branchId, refreshBatches]);
  useEffect(() => {
    if (!batchId) return;
    const controller = new AbortController();
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        await refresh(controller.signal);
      } catch (e) {
        if (!controller.signal.aborted) setError(errorText(e));
      } finally {
        busy = false;
      }
    };
    void load();
    const timer = setInterval(() => {
      void load();
    }, 4000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [batchId, refresh]);
  useEffect(() => {
    if (!editing) return;
    form.setFieldsValue({ ...editing, fields: { ...editing.fields } });
    const controller = new AbortController();
    let url = "";
    void Promise.all([
      api.get(`/paper-review/pages/${editing.id}`, { signal: controller.signal }),
      api.get(`/paper-review/pages/${editing.id}/image`, {
        responseType: "blob",
        signal: controller.signal,
      }),
    ])
      .then(([detail, image]) => {
        if (controller.signal.aborted) return;
        setOcr(detail.data.ocr);
        url = URL.createObjectURL(image.data);
        setImageUrl(url);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setPageError(errorText(e));
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [editing, form]);
  async function uploadFiles() {
    if (!files.length || !batchName.trim()) return;
    const controller = new AbortController();
    uploadAbort.current = controller;
    setUploading(true);
    setUploaded(0);
    const failed: File[] = [];
    let duplicate = 0;
    try {
      let newId = uploadBatchId;
      if (!newId) {
        const created = await api.post(
          "/paper-review/batches",
          { name: batchName },
          { signal: controller.signal },
        );
        newId = created.data.id;
        setUploadBatchId(newId);
      }
      setData(null);
      setSelected([]);
      setBatchId(newId);
      for (let i = 0; i < files.length; i++) {
        if (controller.signal.aborted) break;
        const payload = new FormData();
        payload.append("files", files[i]);
        try {
          const r = await api.post(`/paper-review/batches/${newId}/files`, payload, {
            signal: controller.signal,
            timeout: 120000,
          });
          duplicate += r.data.duplicates.length;
        } catch (e) {
          if (controller.signal.aborted) break;
          failed.push(files[i]);
          setError(errorText(e));
        }
        setUploaded(i + 1);
      }
      if (!controller.signal.aborted) {
        await refreshBatches();
        setFiles(failed);
        if (!failed.length) setCreateOpen(false);
        message.info(
          `Đã tải ${files.length - failed.length} file (${duplicate} file trùng được bỏ qua).${failed.length ? " Các file lỗi vẫn được giữ trong danh sách." : ""}`,
        );
      }
    } catch (e) {
      if (!controller.signal.aborted) message.error(errorText(e));
    } finally {
      setUploading(false);
    }
  }
  async function savePage() {
    if (!editing) return;
    setSaving(true);
    try {
      const values = await form.validateFields();
      await api.patch(`/paper-review/pages/${editing.id}`, {
        ...values,
        fields: { ...values.fields, gender: values.fields.gender || "" },
        version: editing.version,
      });
      setEditing(null);
      await refresh();
      message.success("Đã lưu và kiểm tra lại các rule.");
    } catch (e) {
      if (!(e as { errorFields?: unknown }).errorFields) message.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  async function assignGroup() {
    if (!groupKey.trim() || !selected.length) return;
    setSaving(true);
    try {
      await api.post("/paper-review/pages/group", {
        case_key: groupKey,
        pages: (activeData?.pages ?? [])
          .filter((p) => selected.includes(p.id))
          .map((p) => ({ id: p.id, version: p.version })),
      });
      setSelected([]);
      await refresh();
      message.success("Đã ghép trang. Cần xác nhận lại nội dung sau khi ghép.");
    } catch (e) {
      message.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  async function exportExcel() {
    if (!batchId) return;
    try {
      const r = await api.get(`/paper-review/batches/${batchId}/export`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data),
        a = document.createElement("a");
      a.href = url;
      a.download = `ra-soat-bhyt-${batchId}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      message.error(errorText(e));
    }
  }
  async function openRules() {
    try {
      const r = await api.get("/paper-review/rules");
      setRules(r.data);
      setRulesOpen(true);
    } catch (e) {
      message.error(errorText(e));
    }
  }
  async function saveRules() {
    setSaving(true);
    try {
      await api.put("/paper-review/rules", rules);
      setRulesOpen(false);
      await refresh();
      message.success("Đã lưu rule cho chi nhánh hiện tại.");
    } catch (e) {
      message.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  const findings = activeData?.findings ?? [],
    pages = activeData?.pages ?? [],
    fileRows = activeData?.files ?? [];
  const complete = fileRows.filter((f) => ["COMPLETED", "FAILED"].includes(f.status)).length;
  const filtered = pages.filter(
    (p) =>
      (filter === "ALL" ||
        (filter === "UNASSIGNED" ? !p.case_key : statusFor(p, findings) === filter)) &&
      norm(`${p.fields.name} ${p.fields.patientId} ${p.case_key} ${p.original_name}`).includes(
        norm(search),
      ),
  );
  const editingFindings = editing ? findings.filter((f) => f.pageIds.includes(editing.id)) : [];
  const counts = { ERROR: 0, REVIEW: 0, PASS: 0 };
  pages.forEach((p) => counts[statusFor(p, findings)]++);
  const labelsForHighlight: Partial<Record<keyof Fields, string>> = {
    birthDate: "SINH",
    gender: "GIOI TINH",
    weight: "CAN NANG",
    icd: "CHAN DOAN",
    name: "HO TEN",
    patientId: "MA SO",
  };
  return (
    <div className="pr-page">
      <div className="pr-heading">
        <div>
          <Title level={3}>
            <FileSearchOutlined /> Rà soát hồ sơ BHYT
          </Title>
          <Text type="secondary">
            Bảng kê · Đơn thuốc · Phiếu chỉ định — {user?.branchName || user?.branchId}
          </Text>
        </div>
        <Space wrap>
          <Button
            icon={<SettingOutlined />}
            onClick={() => void openRules()}
            disabled={!cap?.ready}
          >
            Rule kiểm tra
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!cap?.ready || uploading}
            onClick={() => {
              setBatchName(`Hồ sơ ${new Date().toLocaleDateString("vi-VN")}`);
              setFiles([]);
              setUploadBatchId("");
              setCreateOpen(true);
            }}
          >
            Tải lô hồ sơ
          </Button>
        </Space>
      </div>
      {error && <Alert type="error" title={error} showIcon closable onClose={() => setError("")} />}
      {cap && !cap.ready && (
        <Alert type="warning" showIcon title="Chức năng chưa sẵn sàng" description={cap.message} />
      )}
      <Alert
        className="pr-info"
        type="info"
        showIcon
        title="Phạm vi bản đầu: thông tin bệnh nhân và ICD"
        description="Ảnh đọc được cần xác nhận trước khi kết luận lỗi. Chưa đối chiếu thuốc, dịch vụ, chữ ký hay XML. Mỗi ảnh chỉ nên có một mặt giấy; trang ký cần ghép thủ công với đúng lượt khám."
      />
      <Card size="small">
        <div className="pr-toolbar">
          <Select
            className="pr-batch-select"
            placeholder="Chọn lô hồ sơ"
            value={batchId || undefined}
            onChange={(v) => {
              setData(null);
              setSelected([]);
              setBatchId(v);
            }}
            options={batches.map((b) => ({
              value: b.id,
              label: `${b.name} · ${b.file_count} file`,
            }))}
          />
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => {
              setLoading(true);
              void Promise.all([refresh(), refreshBatches()])
                .catch((e) => setError(errorText(e)))
                .finally(() => setLoading(false));
            }}
          >
            Làm mới
          </Button>
          <Popconfirm
            title="Ghép các trang có mã lượt/số phiếu và ngày khám đọc được?"
            description="Đây là gợi ý OCR. Sau khi ghép vẫn cần xác nhận từng trang; không ghép bằng riêng mã bệnh nhân."
            onConfirm={async () => {
              try {
                const r = await api.post(`/paper-review/batches/${batchId}/suggest-groups`);
                await refresh();
                message.info(`Đã ghép gợi ý ${r.data.grouped} trang.`);
              } catch (e) {
                message.error(errorText(e));
              }
            }}
          >
            <Button
              disabled={!pages.some((p) => !p.case_key && !p.confirmed && p.suggested_case_key)}
            >
              Ghép gợi ý
            </Button>
          </Popconfirm>
          <Button
            icon={<DownloadOutlined />}
            disabled={!pages.length}
            onClick={() => void exportExcel()}
          >
            Xuất Excel
          </Button>
          {batchId && (
            <Popconfirm
              title="Xóa lô và toàn bộ ảnh đã tải?"
              description="Chỉ xóa được khi lô đã xử lý xong."
              onConfirm={async () => {
                try {
                  await api.delete(`/paper-review/batches/${batchId}`);
                  setBatchId("");
                  setData(null);
                  await refreshBatches();
                } catch (e) {
                  message.error(errorText(e));
                }
              }}
            >
              <Button
                danger
                disabled={
                  uploading || fileRows.some((f) => ["QUEUED", "PROCESSING"].includes(f.status))
                }
              >
                Xóa lô
              </Button>
            </Popconfirm>
          )}
        </div>
        {fileRows.length > 0 && (
          <>
            <Progress
              percent={Math.round((complete / fileRows.length) * 100)}
              status={fileRows.some((f) => f.status === "FAILED") ? "exception" : undefined}
            />
            <Text type="secondary">
              Đã xử lý {complete}/{fileRows.length} file · {pages.length} trang ·{" "}
              {new Set(pages.map((p) => p.case_key).filter(Boolean)).size} nhóm lượt khám
            </Text>
          </>
        )}
      </Card>
      {fileRows.some((f) => f.status === "FAILED") && (
        <Card size="small" title="File cần kiểm tra">
          <Space orientation="vertical" style={{ width: "100%" }}>
            {fileRows
              .filter((f) => f.status === "FAILED")
              .map((f) => (
                <div key={f.id} className="pr-failed">
                  <Text>
                    {f.original_name}: {f.error}
                  </Text>
                  <Button
                    size="small"
                    onClick={async () => {
                      try {
                        await api.post(`/paper-review/files/${f.id}/retry`);
                        await refresh();
                      } catch (e) {
                        message.error(errorText(e));
                      }
                    }}
                  >
                    Thử lại
                  </Button>
                </div>
              ))}
          </Space>
        </Card>
      )}
      <div className="pr-stats">
        {[
          ["ERROR", "Có lỗi"],
          ["REVIEW", "Cần xác minh"],
          ["PASS", "Đạt rule đã bật"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`pr-stat pr-${key.toLowerCase()} ${filter === key ? "pr-selected" : ""}`}
            onClick={() => setFilter(filter === key ? "ALL" : key)}
          >
            <strong>{counts[key as keyof typeof counts]}</strong>
            <span>{label} (trang)</span>
          </button>
        ))}
      </div>
      <Card size="small">
        <div className="pr-toolbar">
          <Input.Search
            placeholder="Tìm tên, mã bệnh nhân, nhóm lượt khám…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 360 }}
            allowClear
          />
          <Select
            value={filter}
            onChange={setFilter}
            options={[
              { value: "ALL", label: "Tất cả trang" },
              { value: "ERROR", label: "Có lỗi" },
              { value: "REVIEW", label: "Cần xác minh" },
              { value: "PASS", label: "Đạt rule đã bật" },
              { value: "UNASSIGNED", label: "Chưa ghép lượt khám" },
            ]}
          />
        </div>
        {selected.length > 0 && (
          <div className="pr-group">
            <Text>Đã chọn {selected.length} trang</Text>
            <Input
              placeholder="Mã nhóm lượt khám duy nhất (ví dụ mã hồ sơ + ngày)"
              value={groupKey}
              maxLength={100}
              onChange={(e) => setGroupKey(e.target.value)}
            />
            <Button loading={saving} disabled={!groupKey.trim()} onClick={() => void assignGroup()}>
              Ghép vào lượt khám
            </Button>
          </div>
        )}
        <Table<Page>
          rowKey="id"
          size="small"
          dataSource={filtered}
          pagination={{
            pageSize: 30,
            showSizeChanger: true,
            pageSizeOptions: [30, 50, 100],
            showTotal: (n) => `${n} trang`,
          }}
          scroll={{ x: 1100 }}
          rowSelection={{
            selectedRowKeys: selected,
            onChange: setSelected,
            preserveSelectedRowKeys: true,
          }}
          locale={{
            emptyText: (
              <Empty
                description={
                  batchId
                    ? "Trang sẽ xuất hiện khi OCR xử lý xong."
                    : "Tải một lô hồ sơ để bắt đầu."
                }
              />
            ),
          }}
          columns={[
            {
              title: "File / trang",
              width: 220,
              render: (_, p) => (
                <>
                  <Text ellipsis style={{ maxWidth: 200 }}>
                    {p.original_name}
                  </Text>
                  <br />
                  <Text type="secondary">
                    Trang {p.page_number} · {types.find((t) => t.value === p.document_type)?.label}
                  </Text>
                </>
              ),
            },
            {
              title: "Bệnh nhân / lượt khám",
              width: 220,
              render: (_, p) => (
                <>
                  <Text strong>{p.fields.name || "Chưa đọc được họ tên"}</Text>
                  <br />
                  <Text type="secondary">{p.fields.patientId || "Chưa có mã BN"}</Text>
                  <br />
                  {p.case_key ? <Tag>{p.case_key}</Tag> : <Tag color="warning">Chưa ghép ca</Tag>}
                </>
              ),
            },
            {
              title: "Kết quả",
              width: 170,
              render: (_, p) => {
                const s = statusFor(p, findings);
                return (
                  <>
                    <Tag color={s === "ERROR" ? "error" : s === "REVIEW" ? "warning" : "success"}>
                      {s === "ERROR"
                        ? "Có lỗi"
                        : s === "REVIEW"
                          ? "Cần xác minh"
                          : "Đạt rule đã bật"}
                    </Tag>
                    <br />
                    <Text type="secondary">
                      {p.confirmed ? "Đã xác nhận OCR" : "Chưa xác nhận OCR"}
                    </Text>
                  </>
                );
              },
            },
            {
              title: "Phát hiện",
              render: (_, p) => {
                const own = findings.filter((f) => f.pageIds.includes(p.id));
                return (
                  <>
                    <Text>{own[0]?.message || "Chưa phát hiện lỗi trong phạm vi rule."}</Text>
                    {own.length > 1 && <Text type="secondary"> (+{own.length - 1})</Text>}
                  </>
                );
              },
            },
            {
              title: "Xử lý",
              width: 125,
              render: (_, p) => (
                <Tag color={p.review_status === "RESOLVED" ? "blue" : undefined}>
                  {reviewLabels[p.review_status]}
                </Tag>
              ),
            },
            {
              title: "",
              width: 105,
              fixed: "right",
              render: (_, p) => (
                <Button
                  size="small"
                  onClick={() => {
                    setOcr(null);
                    setImageUrl("");
                    setPageError("");
                    setZoom(100);
                    setHighlight(undefined);
                    setEditing(p);
                  }}
                >
                  Xem / sửa
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <Modal
        title="Tải lô hồ sơ"
        open={createOpen}
        onCancel={() => {
          if (!uploading) setCreateOpen(false);
        }}
        footer={null}
        mask={{ closable: !uploading }}
        closable={!uploading}
        destroyOnHidden
      >
        <Space orientation="vertical" style={{ width: "100%" }} size="middle">
          <Input
            value={batchName}
            maxLength={160}
            disabled={uploading}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder="Tên lô hồ sơ"
          />
          <label className="pr-upload">
            <UploadOutlined />
            <strong>Chọn nhiều ảnh hoặc PDF</strong>
            <span>PNG, JPEG, PDF · Tối đa 20 MB/file · 500 trang/PDF</span>
            <input
              aria-label="Chọn nhiều hồ sơ"
              type="file"
              accept="image/png,image/jpeg,application/pdf"
              multiple
              disabled={uploading}
              onChange={(e) => {
                const chosen = Array.from(e.target.files ?? []);
                if (chosen.some((f) => f.size > 20 * 1024 * 1024)) {
                  message.error("Có file vượt quá 20 MB.");
                  return;
                }
                setFiles(chosen);
              }}
            />
          </label>
          <Text>{files.length} file đã chọn</Text>
          <div className="pr-file-list">
            {files.map((f, i) => (
              <div key={`${i}-${f.name}`}>{f.name}</div>
            ))}
          </div>
          {uploading && (
            <Progress percent={files.length ? Math.round((uploaded / files.length) * 100) : 0} />
          )}
          <Button
            block
            type="primary"
            loading={uploading}
            disabled={!files.length || !batchName.trim()}
            onClick={() => void uploadFiles()}
          >
            Tải lên và đưa vào hàng đợi
          </Button>
          <Text type="secondary">
            File được tải lần lượt để hạn chế tải mạng. Có thể rời màn hình sau khi tải xong; máy
            chủ tiếp tục OCR. Không đóng trang trong khi đang tải.
          </Text>
        </Space>
      </Modal>
      <Modal
        title="Rule kiểm tra — chi nhánh hiện tại"
        open={rulesOpen}
        onCancel={() => setRulesOpen(false)}
        onOk={() => void saveRules()}
        confirmLoading={saving}
        okText="Lưu rule"
      >
        <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
          {rules &&
            (Object.keys(ruleLabels) as (keyof Rules)[]).map((key) => (
              <div className="pr-rule" key={key}>
                <Text>{ruleLabels[key]}</Text>
                <Switch checked={rules[key]} onChange={(v) => setRules({ ...rules, [key]: v })} />
              </div>
            ))}
          <Alert
            type="info"
            title="Đây là cấu hình rà soát nội bộ."
            description="Rule cân nặng mặc định tắt. Điều kiện chi tiết theo tuổi/loại hồ sơ sẽ bổ sung sau. Định dạng ICD chưa thay thế đối chiếu danh mục ICD hợp lệ."
          />
        </Space>
      </Modal>
      <Modal
        className="pr-detail-modal"
        title={editing ? `${editing.original_name} — trang ${editing.page_number}` : ""}
        open={!!editing}
        onCancel={() => {
          if (!saving) setEditing(null);
        }}
        width="95vw"
        footer={
          <Space>
            <Button onClick={() => setEditing(null)} disabled={saving}>
              Đóng
            </Button>
            <Button type="primary" loading={saving} disabled={!ocr} onClick={() => void savePage()}>
              Lưu và kiểm tra lại
            </Button>
          </Space>
        }
        destroyOnHidden
      >
        {pageError ? (
          <Alert type="error" title={pageError} />
        ) : !ocr || !imageUrl ? (
          <div className="pr-wait">
            <Spin />
          </div>
        ) : (
          <div className="pr-detail">
            <div className="pr-image-pane">
              <div className="pr-toolbar">
                <Text>
                  Ảnh đối chiếu · điểm OCR {Math.round(ocr.confidence)}/100 (không phải xác suất
                  đúng)
                </Text>
                <Button size="small" onClick={() => setZoom((z) => Math.max(100, z - 25))}>
                  −
                </Button>
                <Text>{zoom}%</Text>
                <Button size="small" onClick={() => setZoom((z) => Math.min(250, z + 25))}>
                  +
                </Button>
              </div>
              <div className="pr-image-scroll">
                <div className="pr-image-wrap" style={{ width: `${zoom}%` }}>
                  <img src={imageUrl} alt="Trang hồ sơ cần đối chiếu" />
                  {highlight &&
                    ocr.lines
                      .filter(
                        (line) =>
                          norm(line.text).includes(
                            norm(editing?.fields[highlight] || "__NONE__"),
                          ) ||
                          norm(line.text).includes(labelsForHighlight[highlight] || "__NONE__"),
                      )
                      .map((line, i) => (
                        <div
                          key={i}
                          className="pr-highlight"
                          style={{
                            left: `${(line.x / ocr.width) * 100}%`,
                            top: `${(line.y / ocr.height) * 100}%`,
                            width: `${(line.width / ocr.width) * 100}%`,
                            height: `${(line.height / ocr.height) * 100}%`,
                          }}
                          title={line.text}
                        />
                      ))}
                </div>
              </div>
            </div>
            <div className="pr-form-pane">
              <Alert
                type="warning"
                title="Đối chiếu với ảnh trước khi xác nhận"
                description="Thông tin bên dưới là gợi ý OCR. Để trống nếu giấy không có thông tin; sửa OCR không làm thay đổi bản giấy."
              />
              <div className="pr-findings">
                {editingFindings.map((f, i) => (
                  <button
                    type="button"
                    key={i}
                    className={`pr-finding pr-${f.severity.toLowerCase()}`}
                    onClick={() => setHighlight(f.field)}
                  >
                    {f.message}
                  </button>
                ))}
              </div>
              <Form form={form} layout="vertical">
                <div className="pr-field-grid">
                  <Form.Item name="document_type" label="Loại giấy">
                    <Select options={types} />
                  </Form.Item>
                  <Form.Item name="case_key" label="Nhóm lượt khám">
                    <Input maxLength={100} placeholder="Dùng cùng mã cho các trang cùng lượt" />
                  </Form.Item>
                  {(Object.keys(fieldLabels) as (keyof Fields)[]).map((key) => (
                    <Form.Item
                      key={key}
                      name={["fields", key]}
                      label={fieldLabels[key]}
                      className={key === "icd" ? "pr-wide" : ""}
                    >
                      {key === "gender" ? (
                        <Select
                          allowClear
                          options={[
                            { value: "NAM", label: "Nam" },
                            { value: "NU", label: "Nữ" },
                          ]}
                          onChange={(v) => {
                            if (!v) form.setFieldValue(["fields", key], "");
                          }}
                          onFocus={() => setHighlight(key)}
                        />
                      ) : key === "icd" ? (
                        <Input.TextArea
                          rows={2}
                          maxLength={2000}
                          onFocus={() => setHighlight(key)}
                        />
                      ) : (
                        <Input maxLength={200} onFocus={() => setHighlight(key)} />
                      )}
                    </Form.Item>
                  ))}
                </div>
                <Form.Item name="confirmed" valuePropName="checked">
                  <Checkbox>
                    Tôi đã đối chiếu nội dung, loại giấy và nhóm lượt khám với ảnh.
                  </Checkbox>
                </Form.Item>
                <Form.Item name="review_status" label="Trạng thái xử lý">
                  <Select
                    options={Object.entries(reviewLabels).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                  />
                </Form.Item>
                <Form.Item name="note" label="Ghi chú">
                  <Input.TextArea maxLength={2000} rows={2} />
                </Form.Item>
              </Form>
              <details>
                <summary>Văn bản OCR gốc</summary>
                <pre className="pr-ocr-text">{ocr.text || "Không đọc được chữ."}</pre>
              </details>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
