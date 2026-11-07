import {
  CheckCircleFilled,
  CloseCircleFilled,
  CloudUploadOutlined,
  DeleteOutlined,
  DownOutlined,
  FileTextOutlined,
  InboxOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Alert, Button, Input, Progress, Radio, Steps, Table, Tag, Upload, message } from "antd";
import type { TableColumnsType, UploadFile } from "antd";
import { useEffect, useId, useRef, useState } from "react";
import apiClient from "../api/apiClient";

const { Dragger } = Upload;

type TreatmentGroup = "GENERAL" | "YHCT";
type CaseFilter = "all" | "valid" | "invalid";
type ImportStatus = "idle" | "running" | "done" | "error";

interface ValidationError {
  code: string;
  message: string;
}

interface MedicalCase {
  index: number;
  maLk?: string | null;
  maBn?: string | null;
  hoTen?: string | null;
  ngayVao?: string | null;
  ngayRa?: string | null;
  tongChi?: string | number | null;
  xmlTypes?: string[];
  valid: boolean;
  errors: ValidationError[];
}

interface AnalyzeResult {
  facilityCode?: string;
  createdDate?: string;
  declaredTotal: number;
  actualTotal: number;
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
  cases: MedicalCase[];
}

interface ImportProgress {
  percent?: number;
  status?: string;
  message?: string;
  error?: string;
}

interface ApiErrorLike {
  response?: {
    status?: number;
    data?: {
      message?: string;
      data?: AnalyzeResult;
    };
  };
  message?: string;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const apiError = error as ApiErrorLike | null;

  if (apiError?.response?.status === 401) {
    return "Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.";
  }

  if (apiError?.response?.status === 403) {
    return "Bạn không có quyền thực hiện chức năng này.";
  }

  return apiError?.response?.data?.message || apiError?.message || fallback;
}

function formatSize(bytes?: number) {
  if (bytes === undefined) return "File XML";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  if (/^\d{8}$/.test(value)) {
    return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)}`;
  }

  if (/^\d{12}(\d{2})?$/.test(value)) {
    const date = `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)}`;
    const time = `${value.slice(8, 10)}:${value.slice(10, 12)}`;
    const seconds = value.length === 14 ? `:${value.slice(12, 14)}` : "";

    return `${date} ${time}${seconds}`;
  }

  return value;
}

export default function XmlImport() {
  const [messageApi, contextHolder] = message.useMessage();
  const tableContentId = useId();

  const [treatmentGroup, setTreatmentGroup] = useState<TreatmentGroup>("GENERAL");
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<AnalyzeResult>();
  const [canImport, setCanImport] = useState(false);
  const [importPercent, setImportPercent] = useState(0);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [caseFilter, setCaseFilter] = useState<CaseFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tableOpen, setTableOpen] = useState(false);

  const mounted = useRef(true);
  const operationLock = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const busy = analyzing || importing;
  const selectedFile = fileList[0];
  const imported = importStatus === "done";
  const hasError = importStatus === "error" || (!canImport && !imported);
  const groupLabel = treatmentGroup === "GENERAL" ? "KCB thông thường" : "Y học cổ truyền";

  function resetAnalysis() {
    setResult(undefined);
    setCanImport(false);
    setImportPercent(0);
    setImportStatus("idle");
    setNotice("");
    setSearch("");
    setCaseFilter("all");
    setPage(1);
    setTableOpen(false);
  }

  function removeFile() {
    if (operationLock.current) return;

    setFileList([]);
    resetAnalysis();
  }

  async function handleAnalyze() {
    const file = selectedFile?.originFileObj;

    if (!file || operationLock.current) return;

    operationLock.current = true;
    resetAnalysis();
    setAnalyzing(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("treatmentGroup", treatmentGroup);

    try {
      const response = await apiClient.post("/xml/analyze", formData);

      if (!mounted.current) return;

      const data = response.data;

      if (!data?.data) {
        throw new Error(data?.message || "Không nhận được kết quả kiểm tra XML.");
      }

      setResult(data.data);
      setCanImport(data.canImport === true);

      if (data.canImport !== true) {
        setNotice(
          data.message || "Dữ liệu chưa đạt điều kiện import. Kiểm tra hồ sơ lỗi bên dưới.",
        );
      }
    } catch (error: unknown) {
      if (!mounted.current) return;

      const apiError = error as ApiErrorLike | null;
      setResult(apiError?.response?.data?.data);
      setCanImport(false);
      setNotice(getApiErrorMessage(error, "Không thể xử lý file XML."));
    } finally {
      operationLock.current = false;

      if (mounted.current) setAnalyzing(false);
    }
  }

  async function waitForImport(importId: string) {
    while (mounted.current) {
      const response = await apiClient.get(`/xml/import-progress/${encodeURIComponent(importId)}`);

      if (!mounted.current) return;

      const progress: ImportProgress | undefined = response.data?.data;

      if (progress) {
        const rawPercent = Number(progress.percent ?? 0);

        setImportPercent(Number.isFinite(rawPercent) ? Math.max(0, Math.min(100, rawPercent)) : 0);

        if (progress.status === "DONE") {
          setImportPercent(100);
          setImportStatus("done");
          setCanImport(false);
          setNotice(progress.message || "Dữ liệu đã được ghi vào hệ thống.");
          return;
        }

        if (progress.status === "ERROR") {
          throw new Error(progress.error || progress.message || "Import XML thất bại.");
        }
      }

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 500);
      });
    }
  }

  async function handleImport() {
    const file = selectedFile?.originFileObj;

    if (!file || !result || !canImport || imported || operationLock.current) {
      return;
    }

    operationLock.current = true;
    setImporting(true);
    setImportStatus("running");
    setImportPercent(0);
    setNotice("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("treatmentGroup", treatmentGroup);

    try {
      const response = await apiClient.post("/xml/upload", formData);

      if (!mounted.current) return;

      const importId = response.data?.importId;

      if (!importId) {
        throw new Error("Không nhận được mã tiến trình import.");
      }

      await waitForImport(String(importId));
    } catch (error: unknown) {
      if (!mounted.current) return;

      setImportStatus("error");
      setNotice(getApiErrorMessage(error, "Import XML thất bại."));
    } finally {
      operationLock.current = false;

      if (mounted.current) setImporting(false);
    }
  }

  const keyword = search.trim().toLocaleLowerCase("vi");

  const filteredCases = (result?.cases ?? []).filter((record) => {
    const matchesStatus =
      caseFilter === "all" ||
      (caseFilter === "valid" && record.valid) ||
      (caseFilter === "invalid" && !record.valid);

    const matchesSearch =
      !keyword ||
      [record.hoTen, record.maBn, record.maLk].some((value) =>
        value?.toLocaleLowerCase("vi").includes(keyword),
      );

    return matchesStatus && matchesSearch;
  });

  const columns: TableColumnsType<MedicalCase> = [
    {
      title: "Trạng thái",
      key: "status",
      width: 115,
      fixed: "left",
      render: (_, record) => (
        <Tag
          color={record.valid ? "success" : "error"}
          icon={record.valid ? <CheckCircleFilled /> : <CloseCircleFilled />}
        >
          {record.valid ? "Hợp lệ" : "Có lỗi"}
        </Tag>
      ),
    },
    {
      title: "STT",
      dataIndex: "index",
      width: 65,
      align: "center",
    },
    {
      title: "Mã bệnh nhân",
      dataIndex: "maBn",
      width: 135,
      render: (value) => value || "—",
    },
    {
      title: "Họ và tên",
      dataIndex: "hoTen",
      width: 205,
      render: (value) => <strong>{value || "—"}</strong>,
    },
    {
      title: "Mã liên kết",
      dataIndex: "maLk",
      width: 260,
      ellipsis: true,
      render: (value) => value || "—",
    },
    {
      title: "Ngày vào",
      dataIndex: "ngayVao",
      width: 170,
      render: (value: MedicalCase["ngayVao"]) => formatDate(value),
    },
    {
      title: "Ngày ra",
      dataIndex: "ngayRa",
      width: 170,
      render: (value: MedicalCase["ngayRa"]) => formatDate(value),
    },
    {
      title: "Tổng chi",
      dataIndex: "tongChi",
      width: 135,
      align: "right",
      render: (value: MedicalCase["tongChi"]) => {
        if (value === null || value === undefined || value === "") {
          return "—";
        }

        const amount = Number(value);

        return Number.isFinite(amount) ? amount.toLocaleString("vi-VN") : value;
      },
    },
    {
      title: "XML",
      dataIndex: "xmlTypes",
      width: 160,
      render: (value?: string[]) => value?.join(", ") || "—",
    },
    {
      title: "Nội dung kiểm tra",
      key: "validation",
      width: 340,
      render: (_, record) =>
        record.valid ? (
          <span className="mgxi-valid-text">Không phát hiện lỗi</span>
        ) : (
          <div className="mgxi-errors">
            {(record.errors ?? []).map((error, index) => (
              <span key={`${error.code}-${index}`}>{error.message}</span>
            ))}
          </div>
        ),
    },
  ];

  const currentStep = imported ? 3 : result && canImport ? 2 : selectedFile ? 1 : 0;

  const statusTitle = importing
    ? "Đang import hồ sơ"
    : imported
      ? "Import hồ sơ đã hoàn tất"
      : importStatus === "error"
        ? "Import chưa hoàn tất"
        : canImport
          ? "Dữ liệu XML hợp lệ"
          : "Dữ liệu chưa đủ điều kiện import";

  const statusDescription = importing
    ? `Đã xử lý ${Math.round(importPercent)}%. Vui lòng giữ trang mở.`
    : notice ||
      (canImport
        ? "Dữ liệu đã sẵn sàng để import vào hệ thống."
        : "Mở danh sách hồ sơ để xem chi tiết lỗi.");

  return (
    <div className="mgxi">
      {contextHolder}

      <header className="mgxi-header">
        <div className="mgxi-heading">
          <span className="mgxi-heading-icon">
            <CloudUploadOutlined />
          </span>
          <div>
            <h1>Import hồ sơ XML</h1>
            <p>Kiểm tra và import dữ liệu khám chữa bệnh BHYT.</p>
          </div>
        </div>

        <Tag className="mgxi-security" icon={<SafetyCertificateOutlined />}>
          Kiểm tra trước khi import
        </Tag>
      </header>

      <section className="mgxi-panel">
        <div className="mgxi-steps">
          <Steps
            current={currentStep}
            size="small"
            responsive
            items={[
              { title: "Chọn file" },
              { title: "Kiểm tra dữ liệu" },
              { title: "Import hồ sơ" },
            ]}
          />
        </div>

        <div className="mgxi-upload-layout">
          <div className="mgxi-group-section">
            <div className="mgxi-section-label">
              <span className="mgxi-number">1</span>
              Chọn nhóm dữ liệu
            </div>

            <p className="mgxi-caption">Chọn nhóm khám chữa bệnh tương ứng với file XML.</p>

            <Radio.Group
              className="mgxi-group-options"
              value={treatmentGroup}
              disabled={busy}
              onChange={(event) => {
                if (operationLock.current) return;

                setTreatmentGroup(event.target.value as TreatmentGroup);
                resetAnalysis();
              }}
            >
              <Radio
                value="GENERAL"
                className={`mgxi-group-option ${treatmentGroup === "GENERAL" ? "is-selected" : ""}`}
              >
                <span className="mgxi-option-copy">
                  <strong>KCB thông thường</strong>
                  <span>Nhóm hồ sơ GENERAL</span>
                </span>
              </Radio>

              <Radio
                value="YHCT"
                className={`mgxi-group-option ${treatmentGroup === "YHCT" ? "is-selected" : ""}`}
              >
                <span className="mgxi-option-copy">
                  <strong>Y học cổ truyền</strong>
                  <span>Nhóm hồ sơ YHCT</span>
                </span>
              </Radio>
            </Radio.Group>

            <div className="mgxi-group-note">
              <SafetyCertificateOutlined />
              <span>Import lại chỉ thay thế dữ liệu cùng nhóm, cùng cơ sở và cùng ngày.</span>
            </div>
          </div>

          <div className="mgxi-file-section">
            <div className="mgxi-section-label">
              <span className="mgxi-number">2</span>
              Tải file XML
              <span className="mgxi-file-type">.XML</span>
            </div>

            <div className="mgxi-drop-zone">
              <Dragger
                accept=".xml"
                maxCount={1}
                multiple={false}
                disabled={busy}
                fileList={fileList}
                showUploadList={false}
                beforeUpload={(file) => {
                  if (!file.name.toLowerCase().endsWith(".xml")) {
                    void messageApi.error("Vui lòng chọn file có định dạng .xml.");
                    return Upload.LIST_IGNORE;
                  }

                  return false;
                }}
                onChange={({ fileList: nextFiles }) => {
                  if (operationLock.current) return;

                  setFileList(nextFiles.slice(-1));
                  resetAnalysis();
                }}
              >
                <span className="mgxi-drop-icon">
                  <InboxOutlined />
                </span>
                <div className="mgxi-drop-title">Kéo thả file XML vào đây</div>
                <div className="mgxi-drop-description">
                  hoặc <span>nhấn để chọn file</span> từ máy tính
                </div>
                <div className="mgxi-drop-note">Hỗ trợ 1 file XML hồ sơ KCB BHYT mỗi lần</div>
              </Dragger>
            </div>

            {selectedFile && (
              <div className="mgxi-selected-file">
                <span className="mgxi-file-icon">
                  <FileTextOutlined />
                </span>
                <div className="mgxi-file-copy">
                  <strong title={selectedFile.name}>{selectedFile.name}</strong>
                  <span>
                    {formatSize(selectedFile.size)} ·{" "}
                    {imported ? "Đã import" : result ? "Đã kiểm tra" : "Sẵn sàng kiểm tra"}
                  </span>
                </div>
                <Button
                  className="mgxi-remove-file"
                  type="text"
                  icon={<DeleteOutlined />}
                  disabled={busy}
                  aria-label="Xóa file đã chọn"
                  title="Xóa file"
                  onClick={removeFile}
                />
              </div>
            )}
          </div>
        </div>

        <div className="mgxi-actions">
          <span className="mgxi-action-hint">
            {imported
              ? "Chọn file mới để tiếp tục."
              : canImport
                ? "Dữ liệu đã sẵn sàng để import."
                : "Kiểm tra file XML trước khi import hồ sơ."}
          </span>

          <div className="mgxi-buttons">
            <Button
              icon={<SearchOutlined />}
              loading={analyzing}
              disabled={!selectedFile || busy}
              onClick={handleAnalyze}
            >
              {analyzing ? "Đang kiểm tra" : "Kiểm tra dữ liệu"}
            </Button>
            <Button
              type="primary"
              icon={imported ? <CheckCircleFilled /> : <CloudUploadOutlined />}
              loading={importing}
              disabled={!canImport || busy || imported}
              onClick={handleImport}
            >
              {importing ? "Đang import" : imported ? "Đã import" : "Import hồ sơ"}
            </Button>
          </div>
        </div>
      </section>

      {!busy && !result && notice && (
        <Alert
          className="mgxi-alert"
          showIcon
          type="error"
          title="Không thể xử lý file"
          description={notice}
        />
      )}

      {result && (
        <>
          <section className="mgxi-panel mgxi-overview" aria-label="Kết quả kiểm tra XML">
            <div className="mgxi-overview-head">
              <div className="mgxi-overview-status">
                <span
                  className={`mgxi-status-icon ${
                    importing ? "info" : hasError ? "error" : "success"
                  }`}
                >
                  {importing ? (
                    <CloudUploadOutlined />
                  ) : hasError ? (
                    <CloseCircleFilled />
                  ) : (
                    <CheckCircleFilled />
                  )}
                </span>
                <div>
                  <h2>{statusTitle}</h2>
                  <p role="status" aria-live="polite">
                    {statusDescription}
                  </p>
                </div>
              </div>

              <Tag className="mgxi-overview-group">{groupLabel}</Tag>
            </div>

            {importing && (
              <div className="mgxi-progress">
                <Progress
                  percent={importPercent}
                  status="active"
                  strokeColor="#1677ff"
                  format={(percent) => `${Math.round(percent ?? 0)}%`}
                />
              </div>
            )}

            {/* <div className="mgxi-overview-metrics">
              {[
                {
                  label: "Tổng hồ sơ",
                  value: result.summary.total,
                  tone: "",
                },
                {
                  label: "Hợp lệ",
                  value: result.summary.valid,
                  tone: "success",
                },
                {
                  label: "Có lỗi",
                  value: result.summary.invalid,
                  tone: "error",
                },
                {
                  label: "Đọc được",
                  value: result.actualTotal,
                  tone: "info",
                },
              ].map((item) => (
                <div className="mgxi-overview-metric" key={item.label}>
                  <span>{item.label}</span>
                  <strong className={item.tone}>{item.value.toLocaleString("vi-VN")}</strong>
                </div>
              ))}
            </div> */}

            <div className="mgxi-overview-meta">
              <span>
                Mã CSKCB
                <strong>{result.facilityCode || "—"}</strong>
              </span>
              <span>
                Ngày lập
                <strong>{formatDate(result.createdDate)}</strong>
              </span>
              <span>
                Khai báo
                <strong>{result.declaredTotal} hồ sơ</strong>
              </span>
            </div>
          </section>

          <section className="mgxi-panel mgxi-table-panel">
            <button
              type="button"
              className={`mgxi-table-toggle ${tableOpen ? "is-open" : ""}`}
              onClick={() => setTableOpen((previous) => !previous)}
              aria-expanded={tableOpen}
              aria-controls={tableContentId}
            >
              <span className="mgxi-toggle-title">
                <span className="mgxi-toggle-icon">
                  <FileTextOutlined />
                </span>
                <strong>Danh sách hồ sơ</strong>
                <span className="mgxi-toggle-count">{result.summary.total}</span>
              </span>

              <span className="mgxi-toggle-action">
                <span>{tableOpen ? "Thu gọn" : "Xem danh sách"}</span>
                <DownOutlined />
              </span>
            </button>

            <div id={tableContentId} className="mgxi-table-content" hidden={!tableOpen}>
              <div className="mgxi-list-head">
                <div className="mgxi-list-tabs" role="group" aria-label="Lọc trạng thái hồ sơ">
                  {(
                    [
                      {
                        value: "all",
                        label: "Tất cả",
                        count: result.summary.total,
                      },
                      {
                        value: "valid",
                        label: "Hợp lệ",
                        count: result.summary.valid,
                      },
                      {
                        value: "invalid",
                        label: "Có lỗi",
                        count: result.summary.invalid,
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      type="button"
                      key={item.value}
                      className={caseFilter === item.value ? "is-active" : ""}
                      aria-pressed={caseFilter === item.value}
                      onClick={() => {
                        setCaseFilter(item.value);
                        setPage(1);
                      }}
                    >
                      {item.label}
                      <span>{item.count}</span>
                    </button>
                  ))}
                </div>

                <Input
                  className="mgxi-list-search"
                  prefix={<SearchOutlined />}
                  placeholder="Tìm tên hoặc mã hồ sơ..."
                  aria-label="Tìm kiếm hồ sơ"
                  allowClear
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <Table<MedicalCase>
                rowKey={(record) => `${record.index}-${record.maLk ?? ""}`}
                columns={columns}
                dataSource={filteredCases}
                size="middle"
                scroll={{ x: 1855 }}
                locale={{ emptyText: "Không có hồ sơ phù hợp" }}
                rowClassName={(record) => (record.valid ? "" : "mgxi-error-row")}
                pagination={{
                  current: page,
                  pageSize,
                  pageSizeOptions: [10, 50, 100],
                  showSizeChanger: true,
                  showTotal: (total, range) => `${range[0]}–${range[1]} / ${total} hồ sơ`,
                  onChange: (nextPage, nextSize) => {
                    setPage(nextSize !== pageSize ? 1 : nextPage);
                    setPageSize(nextSize);
                  },
                }}
              />
            </div>
          </section>
        </>
      )}

      <style>{`
        .mgxi {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-width: 0;
          color: #26364d;
        }

        .mgxi *, .mgxi *::before, .mgxi *::after {
          box-sizing: border-box;
        }

        .mgxi h1, .mgxi h2, .mgxi p { margin: 0; }

        .mgxi h2 {
          color: #26364d;
          font-size: 14px;
          font-weight: 650;
        }

        .mgxi-header, .mgxi-heading, .mgxi-actions,
        .mgxi-overview-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .mgxi-header { padding: 4px 0; }
        .mgxi-heading { justify-content: flex-start; }

        .mgxi-heading-icon {
          display: grid;
          place-items: center;
          width: 46px;
          height: 46px;
          flex-shrink: 0;
          border: 1px solid #dbeafe;
          border-radius: 13px;
          background: #eff6ff;
          color: #1677ff;
          font-size: 24px;
        }

        .mgxi h1 {
          color: #172033;
          font-size: 23px;
          font-weight: 700;
          letter-spacing: -.4px;
          line-height: 1.4;
        }

        .mgxi-heading p {
          margin-top: 5px;
          color: #8190a5;
          font-size: 13px;
          line-height: 1.6;
        }

        .mgxi .mgxi-security {
          margin: 0;
          padding: 5px 10px;
          border: 1px solid #e4eaf2;
          border-radius: 8px;
          background: #fff;
          color: #7b8799;
          font-size: 11px;
          white-space: nowrap;
        }

        .mgxi .mgxi-panel {
          min-width: 0;
          overflow: hidden;
          border: 1px solid #e4eaf2;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 4px 20px rgba(15, 23, 42, .025);
        }

        .mgxi .mgxi-steps {
          padding: 19px 28px;
          border-bottom: 1px solid #eef2f7;
          background: #fcfdff;
        }

        .mgxi .mgxi-steps .ant-steps {
          max-width: 860px;
          margin: auto;
        }

        .mgxi .mgxi-steps .ant-steps-item-title {
          font-size: 13px;
          font-weight: 500;
        }

        .mgxi .mgxi-upload-layout {
          display: grid;
          grid-template-columns: minmax(250px, .8fr) minmax(0, 1.6fr);
          align-items: start;
          gap: 28px;
          padding: 24px;
        }

        .mgxi .mgxi-group-section {
          padding-right: 28px;
          border-right: 1px solid #eef2f7;
        }

        .mgxi .mgxi-section-label {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 12px;
          color: #334155;
          font-size: 13px;
          font-weight: 650;
        }

        .mgxi .mgxi-number {
          display: grid;
          place-items: center;
          width: 23px;
          height: 23px;
          flex-shrink: 0;
          border-radius: 7px;
          background: #edf4ff;
          color: #1677ff;
          font-size: 12px;
        }

        .mgxi .mgxi-caption {
          margin-bottom: 15px;
          color: #8794a6;
          font-size: 12px;
          line-height: 1.7;
        }

        .mgxi .mgxi-group-options {
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
        }

        .mgxi .mgxi-group-option {
          display: flex;
          align-items: center;
          margin: 0;
          padding: 13px 14px;
          border: 1px solid #e4eaf2;
          border-radius: 10px;
          background: #fff;
          transition: border-color .2s, background .2s;
        }

        .mgxi .mgxi-group-option.is-selected {
          border-color: #91bfff;
          background: #f3f8ff;
        }

        .mgxi .mgxi-group-option:hover { border-color: #91bfff; }

        .mgxi .mgxi-option-copy {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-left: 3px;
        }

        .mgxi .mgxi-option-copy strong {
          font-size: 13px;
          font-weight: 600;
        }

        .mgxi .mgxi-option-copy > span {
          color: #8794a6;
          font-size: 11px;
        }

        .mgxi .mgxi-group-note {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-top: 15px;
          color: #8794a6;
          font-size: 12px;
          line-height: 1.7;
        }

        .mgxi .mgxi-group-note > .anticon {
          margin-top: 4px;
          color: #7295c4;
        }

        .mgxi .mgxi-file-section {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .mgxi .mgxi-file-type {
          margin-left: auto;
          padding: 2px 7px;
          border-radius: 5px;
          background: #f1f5f9;
          color: #8794a6;
          font-size: 10px;
          letter-spacing: .5px;
        }

        .mgxi .mgxi-drop-zone {
          width: 100%;
          min-width: 0;
          flex: none;
        }

        .mgxi .mgxi-drop-zone .ant-upload-wrapper {
          display: block;
          width: 100%;
          height: auto;
        }

        .mgxi .mgxi-drop-zone .ant-upload.ant-upload-drag {
          height: auto !important;
          min-height: 0;
          overflow: hidden;
          border: 1.5px dashed #bad2f5;
          border-radius: 11px;
          background: #f8fbff;
          transition: background .2s, border-color .2s;
        }

        .mgxi .mgxi-drop-zone .ant-upload.ant-upload-drag:hover {
          border-color: #1677ff;
          background: #f0f7ff;
        }

        .mgxi .mgxi-drop-zone .ant-upload-drag .ant-upload-btn {
          height: auto;
          padding: 24px 18px !important;
        }

        .mgxi .mgxi-drop-icon {
          display: grid;
          place-items: center;
          width: 48px;
          height: 48px;
          margin: 0 auto 12px;
          border: 1px solid #d9eaff;
          border-radius: 13px;
          background: #fff;
          color: #1677ff;
          font-size: 25px;
          box-shadow: 0 3px 10px rgba(22, 119, 255, .05);
        }

        .mgxi .mgxi-drop-title {
          color: #334155;
          font-size: 14px;
          font-weight: 600;
        }

        .mgxi .mgxi-drop-description {
          margin-top: 6px;
          color: #8794a6;
          font-size: 12px;
        }

        .mgxi .mgxi-drop-description > span {
          color: #1677ff;
          font-weight: 500;
        }

        .mgxi .mgxi-drop-note {
          margin-top: 12px;
          color: #94a0b2;
          font-size: 11px;
        }

        .mgxi .mgxi-selected-file {
          display: grid;
          grid-template-columns: 35px minmax(0, 1fr) 34px;
          align-items: center;
          gap: 11px;
          width: 100%;
          margin-top: 12px;
          padding: 10px 12px;
          flex: none;
          border: 1px solid #e4eaf2;
          border-radius: 10px;
          background: #fff;
        }

        .mgxi .mgxi-file-icon {
          display: grid;
          place-items: center;
          width: 35px;
          height: 39px;
          border-radius: 8px;
          background: #eff6ff;
          color: #1677ff;
          font-size: 20px;
        }

        .mgxi .mgxi-file-copy {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .mgxi .mgxi-file-copy strong {
          overflow: hidden;
          color: #475569;
          font-size: 12px;
          font-weight: 500;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .mgxi .mgxi-file-copy > span {
          color: #94a0b2;
          font-size: 11px;
        }

        .mgxi .mgxi-remove-file {
          position: static;
          width: 34px;
          min-width: 34px;
          height: 34px;
          padding: 0;
          border-radius: 8px;
          color: #94a3b8;
        }

        .mgxi .mgxi-remove-file:not(:disabled):hover {
          background: #fff1f0;
          color: #ef4444;
        }

        .mgxi .mgxi-actions {
          position: static;
          min-height: 70px;
          padding: 15px 24px;
          border-top: 1px solid #eef2f7;
          background: #fcfdff;
        }

        .mgxi .mgxi-action-hint {
          color: #8794a6;
          font-size: 12px;
        }

        .mgxi .mgxi-buttons {
          display: flex;
          flex-shrink: 0;
          gap: 10px;
        }

        .mgxi .mgxi-buttons .ant-btn {
          height: 38px;
          padding-inline: 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
        }

        .mgxi .mgxi-alert { border-radius: 12px; }

        .mgxi .mgxi-overview-head {
          padding: 17px 22px;
          border-bottom: 1px solid #f0f3f7;
        }

        .mgxi .mgxi-overview-status {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .mgxi .mgxi-status-icon {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          border-radius: 11px;
          font-size: 20px;
        }

        .mgxi .mgxi-status-icon.success {
          background: #edf9f3;
          color: #16a36a;
        }

        .mgxi .mgxi-status-icon.error {
          background: #fff1f0;
          color: #e45858;
        }

        .mgxi .mgxi-status-icon.info {
          background: #edf4ff;
          color: #1677ff;
        }

        .mgxi .mgxi-overview-head p {
          margin-top: 4px;
          color: #8190a5;
          font-size: 12px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .mgxi .mgxi-overview-group {
          flex-shrink: 0;
          margin: 0;
          padding: 3px 9px;
          border: 0;
          border-radius: 6px;
          background: #f0f5ff;
          color: #5275b5;
          font-size: 11px;
        }

        .mgxi .mgxi-progress { padding: 10px 22px 0; }

        .mgxi .mgxi-overview-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          padding: 20px 0;
        }

        .mgxi .mgxi-overview-metric {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 24px;
          border-right: 1px solid #edf1f6;
        }

        .mgxi .mgxi-overview-metric:last-child { border-right: 0; }

        .mgxi .mgxi-overview-metric > span {
          color: #7b8799;
          font-size: 13px;
        }

        .mgxi .mgxi-overview-metric > strong {
          color: #26364d;
          font-size: 25px;
          font-weight: 700;
          line-height: 1.3;
          font-variant-numeric: tabular-nums;
        }

        .mgxi .mgxi-overview-metric > strong.success { color: #16a36a; }
        .mgxi .mgxi-overview-metric > strong.error { color: #df6262; }
        .mgxi .mgxi-overview-metric > strong.info { color: #5279cf; }

        .mgxi .mgxi-overview-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 28px;
          padding: 11px 22px;
          border-top: 1px solid #edf1f6;
          background: #fbfcfe;
        }

        .mgxi .mgxi-overview-meta > span {
          color: #8a97a9;
          font-size: 12px;
        }

        .mgxi .mgxi-overview-meta strong {
          margin-left: 7px;
          color: #526078;
          font-weight: 500;
        }

        /* Thu gọn toàn bộ bảng */
        .mgxi .mgxi-table-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          width: 100%;
          padding: 17px 20px;
          border: 0;
          background: #fff;
          color: #334155;
          font: inherit;
          text-align: left;
          cursor: pointer;
          transition: background .2s;
        }

        .mgxi .mgxi-table-toggle:hover { background: #f8fbff; }

        .mgxi .mgxi-table-toggle:focus-visible {
          outline: 2px solid #91caff;
          outline-offset: -3px;
        }

        .mgxi .mgxi-table-toggle.is-open {
          border-bottom: 1px solid #edf1f6;
        }

        .mgxi .mgxi-toggle-title {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .mgxi .mgxi-toggle-icon {
          display: grid;
          place-items: center;
          width: 33px;
          height: 33px;
          flex-shrink: 0;
          border-radius: 9px;
          background: #eff6ff;
          color: #1677ff;
          font-size: 17px;
        }

        .mgxi .mgxi-toggle-title > strong {
          font-size: 14px;
          font-weight: 600;
        }

        .mgxi .mgxi-toggle-count {
          padding: 2px 8px;
          border-radius: 6px;
          background: #f1f5f9;
          color: #718096;
          font-size: 11px;
        }

        .mgxi .mgxi-toggle-action {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
          color: #8794a6;
          font-size: 12px;
        }

        .mgxi .mgxi-toggle-action > .anticon {
          font-size: 11px;
          transition: transform .2s;
        }

        .mgxi .mgxi-table-toggle.is-open .mgxi-toggle-action > .anticon {
          transform: rotate(180deg);
        }

        .mgxi .mgxi-table-content[hidden] {
          display: none !important;
        }

        /* Công cụ bảng */
        .mgxi .mgxi-list-head {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          padding: 14px 20px;
          border-bottom: 1px solid #edf1f6;
        }

        .mgxi .mgxi-list-search {
          width: 300px;
          max-width: 100%;
          min-height: 35px;
          margin-left: auto;
          border-color: #e5eaf1;
          border-radius: 8px;
          background: #fbfcfe;
          box-shadow: none;
        }

        .mgxi .mgxi-list-search:hover { border-color: #91bfff; }
        .mgxi .mgxi-list-search input { font-size: 12px; }

        .mgxi .mgxi-list-search .ant-input-prefix {
          margin-right: 7px;
          color: #94a3b8;
        }

        .mgxi .mgxi-list-tabs {
          display: flex;
          align-items: center;
          gap: 3px;
          padding: 3px;
          border: 1px solid #edf1f6;
          border-radius: 9px;
          background: #f6f8fb;
        }

        .mgxi .mgxi-list-tabs > button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 29px;
          padding: 4px 10px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #7b8799;
          font: inherit;
          font-size: 12px;
          white-space: nowrap;
          cursor: pointer;
          transition: background .2s, color .2s;
        }

        .mgxi .mgxi-list-tabs > button:hover { color: #1677ff; }

        .mgxi .mgxi-list-tabs > button.is-active {
          background: #fff;
          color: #1677ff;
          font-weight: 600;
          box-shadow: 0 1px 4px rgba(15, 23, 42, .08);
        }

        .mgxi .mgxi-list-tabs > button:focus-visible {
          outline: 2px solid #91caff;
          outline-offset: 2px;
        }

        .mgxi .mgxi-list-tabs > button > span {
          font-size: 11px;
          opacity: .75;
        }

        .mgxi .mgxi-table-panel .ant-table-thead > tr > th {
          height: 43px;
          padding: 10px 14px;
          border-bottom: 1px solid #e8edf4;
          background: #f8fafc;
          color: #7b8799;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
        }

        .mgxi .mgxi-table-panel .ant-table-thead > tr > th::before {
          display: none !important;
        }

        .mgxi .mgxi-table-panel .ant-table-tbody > tr > td {
          height: 49px;
          padding: 11px 14px;
          border-bottom: 1px solid #f0f3f7;
          background: #fff;
          color: #526078;
          font-size: 13px;
          line-height: 1.6;
        }

        .mgxi .mgxi-table-panel .ant-table-tbody > tr > td strong {
          color: #334155;
          font-weight: 600;
        }

        .mgxi .mgxi-table-panel .ant-table-tbody > tr:hover > td {
          background: #f7faff !important;
        }

        .mgxi .mgxi-table-panel .ant-tag {
          margin: 0;
          padding: 1px 7px;
          border: 0;
          border-radius: 5px;
          font-size: 11px;
          white-space: nowrap;
        }

        .mgxi .mgxi-table-panel .ant-tag-success {
          background: #edf9f2;
          color: #159461;
        }

        .mgxi .mgxi-table-panel .ant-tag-error {
          background: #fff0ef;
          color: #dc5454;
        }

        .mgxi .mgxi-valid-text {
          color: #389676;
          font-size: 12px;
        }

        .mgxi .mgxi-errors {
          display: flex;
          flex-direction: column;
          gap: 4px;
          color: #df5353;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .mgxi .mgxi-table-panel .mgxi-error-row > td {
          background: #fff8f7;
        }

        .mgxi .mgxi-table-panel .mgxi-error-row:hover > td {
          background: #fff0ed !important;
        }

        .mgxi .mgxi-table-panel .ant-table-content {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f8fafc;
        }

        .mgxi .mgxi-table-panel .ant-pagination {
          align-items: center;
          margin: 0 !important;
          padding: 15px 20px !important;
          border-top: 1px solid #edf1f6;
        }

        .mgxi .mgxi-table-panel .ant-pagination-total-text {
          margin-right: auto;
          color: #8794a6;
          font-size: 12px;
        }

        .mgxi .mgxi-table-panel .ant-pagination-item {
          border-radius: 7px;
        }

        @media (max-width: 1100px) {
          .mgxi .mgxi-upload-layout {
            grid-template-columns: minmax(230px, 1fr) minmax(0, 1.3fr);
            gap: 22px;
            padding: 22px;
          }
          .mgxi .mgxi-group-section { padding-right: 22px; }
          .mgxi .mgxi-security { display: none; }
          .mgxi .mgxi-overview-metric { padding-inline: 18px; }
          .mgxi .mgxi-overview-metric > span { font-size: 12px; }
        }

        @media (max-width: 800px) {
          .mgxi .mgxi-upload-layout { grid-template-columns: 1fr; }
          .mgxi .mgxi-group-section {
            padding: 0 0 20px;
            border-right: 0;
            border-bottom: 1px solid #eef2f7;
          }
          .mgxi .mgxi-group-options {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
          .mgxi .mgxi-action-hint { display: none; }
          .mgxi .mgxi-actions { justify-content: flex-end; }
        }

        @media (max-width: 700px) {
          .mgxi .mgxi-overview-head {
            align-items: flex-start;
            padding: 16px;
          }
          .mgxi .mgxi-overview-group { display: none; }
          .mgxi .mgxi-overview-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px 0;
            padding: 18px 0;
          }
          .mgxi .mgxi-overview-metric:nth-child(2) { border-right: 0; }
          .mgxi .mgxi-overview-meta {
            gap: 10px 18px;
            padding: 12px 16px;
          }
          .mgxi .mgxi-list-head { padding: 14px 16px; }
          .mgxi .mgxi-list-search {
            width: 100%;
            margin: 0;
          }
        }

        @media (max-width: 520px) {
          .mgxi { gap: 14px; }
          .mgxi h1 { font-size: 20px; }
          .mgxi .mgxi-heading { gap: 11px; }
          .mgxi .mgxi-heading-icon { width: 42px; height: 42px; }
          .mgxi .mgxi-heading p { font-size: 12px; }
          .mgxi .mgxi-steps { padding: 18px; }
          .mgxi .mgxi-upload-layout { padding: 18px; }
          .mgxi .mgxi-group-options { grid-template-columns: 1fr; }
          .mgxi .mgxi-actions { padding: 15px 18px; }
          .mgxi .mgxi-buttons { width: 100%; flex-wrap: wrap; }
          .mgxi .mgxi-buttons .ant-btn { flex: 1; }
          .mgxi .mgxi-table-toggle { padding: 15px 16px; }
          .mgxi .mgxi-toggle-action > span { display: none; }
          .mgxi .mgxi-list-tabs { width: 100%; }
          .mgxi .mgxi-list-tabs > button { flex: 1; }
          .mgxi .mgxi-table-panel .ant-pagination {
            flex-wrap: wrap;
            gap: 6px;
            padding: 14px !important;
          }
        }
      `}</style>
    </div>
  );
}
