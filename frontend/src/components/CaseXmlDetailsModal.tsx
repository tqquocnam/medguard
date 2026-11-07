import { useEffect, useState } from "react";
import { Alert, Button, Empty, Modal, Spin, Table, Tabs } from "antd";
import type { ColumnsType } from "antd/es/table";
import { FileTextOutlined, ReloadOutlined } from "@ant-design/icons";
import { apiFetch } from "../api/apiClient";

type XmlRow = Record<string, unknown>;

type XmlFile = {
  type: string;
  data: unknown;
};

type StaffLookupItem = {
  name: string | null;
  status: "FOUND" | "NOT_FOUND" | "AMBIGUOUS";
};

type StaffLookup = Record<string, StaffLookupItem>;

type CaseDetails = {
  id: string;
  ma_lk?: string | null;
  ma_bn?: string | null;
  ho_ten?: string | null;
  files: XmlFile[];
  staffLookup: StaffLookup;
};

type Props = {
  open: boolean;
  caseId: string | null;
  onClose: () => void;
};

type XmlType = "XML1" | "XML2" | "XML3" | "XML4" | "XML5";

const XML_TYPES: XmlType[] = ["XML1", "XML2", "XML3", "XML4", "XML5"];

const TAB_NAMES: Record<XmlType, string> = {
  XML1: "Tổng hợp",
  XML2: "Thuốc",
  XML3: "Dịch vụ",
  XML4: "Cận lâm sàng",
  XML5: "Diễn biến",
};

const NODE_NAMES: Record<XmlType, string> = {
  XML1: "TONG_HOP",
  XML2: "CHI_TIET_THUOC",
  XML3: "CHI_TIET_DVKT",
  XML4: "CHI_TIET_CLS",
  XML5: "CHI_TIET_DIEN_BIEN_BENH",
};

const LABELS: Record<string, string> = {
  MA_LK: "Mã liên kết",
  MA_BN: "Mã bệnh nhân",
  HO_TEN: "Họ tên",
  NGAY_SINH: "Ngày sinh",
  GIOI_TINH: "Giới tính",
  CAN_NANG: "Cân nặng",
  CAN_NANG_CON: "Cân nặng con",
  MA_DAN_TOC: "Mã dân tộc",
  DIA_CHI: "Địa chỉ",
  SO_CCCD: "Số CCCD",
  MA_THE_BHYT: "Mã thẻ BHYT",
  MA_DKBD: "Mã ĐK ban đầu",
  GT_THE_TU: "Giá trị thẻ từ",
  GT_THE_DEN: "Giá trị thẻ đến",
  NGAY_DU_5_NAM: "Ngày đủ 5 năm",
  NGAY_VAO: "Ngày vào viện",
  NGAY_VAO_NOI_TRU: "Ngày vào nội trú",
  NGAY_RA: "Ngày ra viện",
  NGAY_TTOAN: "Ngày thanh toán",
  NGAY_TAI_KHAM: "Ngày tái khám",
  LY_DO_VV: "Lý do vào viện",
  LY_DO_VNT: "Lý do vào nội trú",
  CHAN_DOAN_VAO: "Chẩn đoán vào viện",
  CHAN_DOAN_RV: "Chẩn đoán ra viện",
  TEN_BENH: "Tên bệnh",
  MA_BENH: "ICD chính",
  MA_BENH_CHINH: "ICD chính",
  MA_BENH_KT: "ICD kèm theo",
  MA_BENH_YHCT: "ICD YHCT",
  MA_LOAI_KCB: "Mã loại KCB",
  MA_DOITUONG_KCB: "Mã đối tượng KCB",
  SO_NGAY_DTRI: "Số ngày điều trị",
  MA_KHOA: "Mã khoa",
  MA_CSKCB: "Mã CSKCB",
  KET_QUA_DTRI: "Kết quả điều trị",
  MA_LOAI_RV: "Mã loại ra viện",
  T_TONGCHI: "Tổng chi phí",
  T_TONGCHI_BV: "Tổng chi phí BV",
  T_TONGCHI_BH: "Tổng chi phí BH",
  T_BHTT: "BHYT thanh toán",
  T_BNTT: "Bệnh nhân tự trả",
  T_BNCCT: "Bệnh nhân cùng chi trả",
  T_THUOC: "Chi phí thuốc",
  T_VTYT: "Chi phí vật tư",
  T_NGUONKHAC: "Nguồn khác",
  NAM_QT: "Năm quyết toán",
  THANG_QT: "Tháng quyết toán",
  STT: "STT",
  MA_THUOC: "Mã thuốc",
  TEN_THUOC: "Tên thuốc",
  MA_HOAT_CHAT: "Mã hoạt chất",
  HAM_LUONG: "Hàm lượng",
  DUONG_DUNG: "Đường dùng",
  LIEU_DUNG: "Liều dùng",
  CACH_DUNG: "Cách dùng",
  DANG_BAO_CHE: "Dạng bào chế",
  SO_DANG_KY: "Số đăng ký",
  DON_VI_TINH: "Đơn vị tính",
  SO_LUONG: "Số lượng",
  DON_GIA: "Đơn giá",
  DON_GIA_BV: "Đơn giá BV",
  DON_GIA_BH: "Đơn giá BH",
  THANH_TIEN: "Thành tiền",
  THANH_TIEN_BV: "Thành tiền BV",
  THANH_TIEN_BH: "Thành tiền BH",
  MA_BAC_SI: "Bác sĩ",
  NGUOI_THUC_HIEN: "Người thực hiện",
  NGAY_YL: "Ngày y lệnh",
  NGAY_TH_YL: "Ngày thực hiện y lệnh",
  NGAY_KQ: "Ngày kết quả",
  NGAY_KQ_DV: "Ngày kết quả dịch vụ",
  MA_DICH_VU: "Mã dịch vụ",
  TEN_DICH_VU: "Tên dịch vụ",
  MA_VAT_TU: "Mã vật tư",
  TEN_VAT_TU: "Tên vật tư",
  MA_NHOM: "Mã nhóm",
  MA_MAY: "Mã máy",
  MA_CHI_SO: "Mã chỉ số",
  TEN_CHI_SO: "Tên chỉ số",
  GIA_TRI: "Giá trị",
  DON_VI_DO: "Đơn vị đo",
  MO_TA: "Mô tả",
  KET_LUAN: "Kết luận",
  DIEN_BIEN_LS: "Diễn biến lâm sàng",
  GIAI_DOAN_BENH: "Giai đoạn bệnh",
  HOI_CHAN: "Hội chẩn",
  PHAU_THUAT: "Phẫu thuật",
  THOI_DIEM_DBLS: "Thời điểm diễn biến",
  DU_PHONG: "Dự phòng",
  GHI_CHU: "Ghi chú",
  MA_HSBA: "Mã hồ sơ bệnh án",
  MA_TTDV: "Mã thủ trưởng đơn vị",
  NHOM_MAU: "Nhóm máu",
  MA_BS_DOC_KQ: "Bác sĩ đọc kết quả",
};

const PRIORITIES: Partial<Record<XmlType, string[]>> = {
  XML2: [
    "STT",
    "MA_THUOC",
    "TEN_THUOC",
    "DON_VI_TINH",
    "HAM_LUONG",
    "DUONG_DUNG",
    "LIEU_DUNG",
    "SO_LUONG",
    "MA_BAC_SI",
    "NGAY_YL",
    "NGAY_TH_YL",
  ],
  XML3: [
    "STT",
    "MA_DICH_VU",
    "MA_VAT_TU",
    "TEN_VAT_TU",
    "TEN_DICH_VU",
    "DON_VI_TINH",
    "SO_LUONG",
    "MA_BAC_SI",
    "NGUOI_THUC_HIEN",
    "NGAY_YL",
    "NGAY_TH_YL",
    "NGAY_KQ",
  ],
  XML4: [
    "STT",
    "MA_DICH_VU",
    "MA_CHI_SO",
    "TEN_CHI_SO",
    "GIA_TRI",
    "DON_VI_DO",
    "MO_TA",
    "KET_LUAN",
    "MA_BS_DOC_KQ",
    "NGAY_KQ",
  ],
  XML5: [
    "STT",
    "DIEN_BIEN_LS",
    "GIAI_DOAN_BENH",
    "HOI_CHAN",
    "PHAU_THUAT",
    "THOI_DIEM_DBLS",
    "NGUOI_THUC_HIEN",
    "DU_PHONG",
  ],
};

const SUMMARY_GROUPS = [
  {
    title: "Thông tin bệnh nhân",
    fields: ["MA_BN", "NGAY_SINH", "GIOI_TINH", "CAN_NANG", "MA_DAN_TOC", "SO_CCCD", "DIA_CHI"],
  },
  {
    title: "Thông tin bảo hiểm",
    fields: [
      "MA_THE_BHYT",
      "MA_DKBD",
      "MA_DOITUONG_KCB",
      "GT_THE_TU",
      "GT_THE_DEN",
      "NGAY_DU_5_NAM",
    ],
  },
  {
    title: "Thông tin khám chữa bệnh",
    fields: [
      "NGAY_VAO",
      "NGAY_RA",
      "NGAY_TTOAN",
      "NGAY_VAO_NOI_TRU",
      "NGAY_TAI_KHAM",
      "SO_NGAY_DTRI",
      "MA_LOAI_KCB",
      "MA_KHOA",
      "MA_CSKCB",
      "KET_QUA_DTRI",
      "MA_LOAI_RV",
    ],
  },
  {
    title: "Chẩn đoán",
    fields: [
      "MA_BENH",
      "MA_BENH_CHINH",
      "MA_BENH_KT",
      "MA_BENH_YHCT",
      "LY_DO_VV",
      "LY_DO_VNT",
      "CHAN_DOAN_VAO",
      "CHAN_DOAN_RV",
      "TEN_BENH",
    ],
  },
  {
    title: "Chi phí khám chữa bệnh",
    fields: [
      "T_TONGCHI",
      "T_TONGCHI_BV",
      "T_TONGCHI_BH",
      "T_BHTT",
      "T_BNTT",
      "T_BNCCT",
      "T_THUOC",
      "T_VTYT",
      "T_NGUONKHAC",
      "NAM_QT",
      "THANG_QT",
    ],
  },
];

const numberFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

function isRecord(value: unknown): value is XmlRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function isMoneyField(key: string): boolean {
  return key.startsWith("T_") || /^(DON_GIA|THANH_TIEN)(_|$)/.test(key);
}

function formatValue(key: string, value: unknown): string {
  if (!hasValue(value)) return "—";

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  const raw = String(value).trim();

  if (key === "GIOI_TINH") {
    return raw === "1" ? "Nam" : raw === "2" ? "Nữ" : raw;
  }

  const isDate = key.startsWith("NGAY_") || key.startsWith("GT_THE_") || key === "THOI_DIEM_DBLS";

  if (isDate && /^\d{8}(\d{4}|\d{6})?$/.test(raw)) {
    const date = `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`;

    if (raw.length === 8) return date;

    const time = `${raw.slice(8, 10)}:${raw.slice(10, 12)}`;
    const seconds = raw.length === 14 ? `:${raw.slice(12, 14)}` : "";

    return `${date} ${time}${seconds}`;
  }

  if (isMoneyField(key) && Number.isFinite(Number(raw))) {
    return `${numberFormatter.format(Number(raw))} ₫`;
  }

  if (key === "CAN_NANG" && Number.isFinite(Number(raw))) {
    return `${numberFormatter.format(Number(raw))} kg`;
  }

  return raw;
}

function collectRows(value: unknown, nodeName: string): XmlRow[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectRows(item, nodeName));
  }

  if (!isRecord(value)) return [];

  const rows: XmlRow[] = [];

  for (const [key, child] of Object.entries(value)) {
    if (key === nodeName) {
      const values = Array.isArray(child) ? child : [child];
      rows.push(...values.filter(isRecord));
    } else {
      rows.push(...collectRows(child, nodeName));
    }
  }

  return rows;
}

function getRows(files: XmlFile[], type: XmlType): XmlRow[] {
  return files
    .filter((file) => file.type.trim().toUpperCase() === type)
    .flatMap((file) => collectRows(file.data, NODE_NAMES[type]));
}

function SummaryFields({ row, keys }: { row: XmlRow; keys: string[] }) {
  return (
    <div className="mg-xml-grid">
      {keys.map((key) => {
        const wide = /DIA_CHI|CHAN_DOAN|TEN_BENH|LY_DO|GHI_CHU|MA_BENH_KT/.test(key);

        return (
          <div key={key} className={`mg-xml-field${wide ? " mg-xml-field-wide" : ""}`}>
            <div className="mg-xml-label" title={key}>
              {LABELS[key] ?? key}
            </div>

            <div
              className={`mg-xml-value${
                isMoneyField(key) ? " mg-xml-money" : ""
              }${!hasValue(row[key]) ? " mg-xml-muted" : ""}`}
            >
              {formatValue(key, row[key])}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function XmlSummary({ row }: { row: XmlRow }) {
  const usedKeys = new Set(["HO_TEN", "MA_LK", ...SUMMARY_GROUPS.flatMap((group) => group.fields)]);

  const otherKeys = Object.keys(row).filter((key) => !usedKeys.has(key));

  return (
    <div className="mg-xml-summary">
      <div className="mg-xml-patient">
        <div className="mg-xml-avatar">
          {String(row.HO_TEN || "?")
            .trim()
            .charAt(0)
            .toUpperCase()}
        </div>

        <div className="mg-xml-patient-info">
          <div className="mg-xml-eyebrow">THÔNG TIN HỒ SƠ</div>

          <div className="mg-xml-patient-name">{formatValue("HO_TEN", row.HO_TEN)}</div>

          <div className="mg-xml-patient-meta">
            <span>Mã BN: {formatValue("MA_BN", row.MA_BN)}</span>

            {hasValue(row.GIOI_TINH) && <span>{formatValue("GIOI_TINH", row.GIOI_TINH)}</span>}

            {hasValue(row.NGAY_SINH) && (
              <span>Ngày sinh: {formatValue("NGAY_SINH", row.NGAY_SINH)}</span>
            )}
          </div>
        </div>
      </div>

      {SUMMARY_GROUPS.map((group) => {
        const fields = group.fields.filter((key) => Object.prototype.hasOwnProperty.call(row, key));

        if (!fields.length) return null;

        return (
          <section key={group.title} className="mg-xml-section">
            <div className="mg-xml-section-title">{group.title}</div>
            <SummaryFields row={row} keys={fields} />
          </section>
        );
      })}

      <details className="mg-xml-other">
        <summary>Thông tin bổ sung</summary>

        <div className="mg-xml-link">
          <span className="mg-xml-label">Mã liên kết</span>
          <span className="mg-xml-value">{formatValue("MA_LK", row.MA_LK)}</span>
        </div>

        {otherKeys.length > 0 && <SummaryFields row={row} keys={otherKeys} />}
      </details>
    </div>
  );
}

// Chỉ khai báo một lần.
function normalizeStaffCode(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function parseStaffLookup(value: unknown): StaffLookup {
  if (!isRecord(value)) return {};

  const result: StaffLookup = {};

  for (const [code, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue;

    const status = entry.status;

    if (status !== "FOUND" && status !== "NOT_FOUND" && status !== "AMBIGUOUS") {
      continue;
    }

    result[normalizeStaffCode(code)] = {
      name: typeof entry.name === "string" ? entry.name.trim() || null : null,
      status,
    };
  }

  return result;
}

function StaffCell({ value, lookup }: { value: unknown; lookup: StaffLookup }) {
  const uniqueCodes = new Map<string, string>();

  for (const code of String(value ?? "").split(/[;|,]+/)) {
    const original = code.trim();
    const normalized = normalizeStaffCode(original);

    if (normalized && !uniqueCodes.has(normalized)) {
      uniqueCodes.set(normalized, original);
    }
  }

  if (!uniqueCodes.size) {
    return <span className="mg-xml-muted">—</span>;
  }

  return (
    <div className="mg-xml-staff-list">
      {[...uniqueCodes.entries()].map(([normalized, original]) => {
        const staff = lookup[normalized];
        const resolved = staff?.status === "FOUND" && Boolean(staff.name);

        const name =
          staff?.status === "AMBIGUOUS"
            ? "Mã trùng nhiều nhân sự"
            : staff?.status === "FOUND"
              ? staff.name || "Chưa có tên trong danh mục"
              : "Chưa có trong danh mục";

        return (
          <div key={normalized} className="mg-xml-staff-item">
            <div className={`mg-xml-staff-name${resolved ? "" : " mg-xml-staff-unresolved"}`}>
              {name}
            </div>

            <div className="mg-xml-staff-code">{original}</div>
          </div>
        );
      })}
    </div>
  );
}

function XmlContent({
  type,
  rows,
  staffLookup,
}: {
  type: XmlType;
  rows: XmlRow[];
  staffLookup: StaffLookup;
}) {
  if (!rows.length) {
    return (
      <div className="mg-xml-empty">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`Không có dữ liệu ${type}`} />
      </div>
    );
  }

  if (type === "XML1") {
    return (
      <div className="mg-xml-summary-scroll">
        <XmlSummary row={rows[0]} />
      </div>
    );
  }

  const availableKeys = [...new Set(rows.flatMap(Object.keys))];
  const priority = PRIORITIES[type] ?? [];

  const keys = [
    ...priority.filter((key) => availableKeys.includes(key)),
    ...availableKeys.filter((key) => !priority.includes(key)),
  ];

  const columns: ColumnsType<XmlRow> = keys.map((key) => {
    const longText = /MO_TA|KET_LUAN|DIEN_BIEN|HOI_CHAN|PHAU_THUAT|GHI_CHU/.test(key);

    const money = isMoneyField(key);
    const staffField = key === "MA_BAC_SI" || key === "NGUOI_THUC_HIEN" || key === "MA_BS_DOC_KQ";
    return {
      key,
      dataIndex: key,
      title: <span title={key}>{LABELS[key] ?? key}</span>,
      width:
        key === "STT" ? 64 : staffField ? 250 : longText ? 360 : key.startsWith("TEN_") ? 240 : 180,
      fixed: key === "STT" ? "left" : undefined,
      align: money ? "right" : key === "STT" ? "center" : "left",
      render: (value: unknown) =>
        staffField ? (
          <StaffCell value={value} lookup={staffLookup} />
        ) : (
          <div
            className={`mg-xml-cell${money ? " mg-xml-money" : ""}${
              !hasValue(value) ? " mg-xml-muted" : ""
            }`}
          >
            {formatValue(key, value)}
          </div>
        ),
    };
  });

  return (
    <div className="mg-xml-table-panel">
      <div className="mg-xml-table-toolbar">
        <span>{TAB_NAMES[type]}</span>

        <span className="mg-xml-row-count">{numberFormatter.format(rows.length)} dòng</span>
      </div>

      <Table<XmlRow>
        size="small"
        pagination={false}
        columns={columns}
        dataSource={rows}
        rowKey={(_, index) => `${type}-${index}`}
        scroll={{
          x: "max-content",
          y: "max(120px, calc(100dvh - 330px))",
        }}
      />
    </div>
  );
}

export default function CaseXmlDetailsModal({ open, caseId, onClose }: Props) {
  const [details, setDetails] = useState<CaseDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<XmlType>("XML1");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!open || !caseId) return;

    const selectedCaseId = caseId;
    let cancelled = false;

    setDetails(null);
    setError("");
    setLoading(true);
    setActiveTab("XML1");

    async function load() {
      try {
        const response = await apiFetch(
          `/medical-cases/${encodeURIComponent(selectedCaseId)}/xml-details`,
        );

        const json = await response.json();

        if (!response.ok || !json.success || !json.data) {
          throw new Error(json.message || "Không tải được chi tiết hồ sơ.");
        }

        const data = json.data;

        if (!isRecord(data) || String(data.id) !== selectedCaseId || !Array.isArray(data.files)) {
          throw new Error("Dữ liệu chi tiết hồ sơ không hợp lệ.");
        }

        const files: XmlFile[] = data.files
          .filter(
            (file: unknown): file is XmlRow => isRecord(file) && typeof file.type === "string",
          )
          .map((file: XmlRow) => ({
            type: String(file.type),
            data: file.data,
          }));

        if (!cancelled) {
          setDetails({
            id: String(data.id),
            ma_lk: data.ma_lk == null ? null : String(data.ma_lk),
            ma_bn: data.ma_bn == null ? null : String(data.ma_bn),
            ho_ten: data.ho_ten == null ? null : String(data.ho_ten),
            files,
            staffLookup: parseStaffLookup(data.staffLookup),
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không tải được chi tiết hồ sơ.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, caseId, retry]);

  const currentDetails = details?.id === caseId ? details : null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnHidden
      width={1200}
      className="medguard-xml-modal"
      title={
        <div className="mg-xml-modal-heading">
          <div className="mg-xml-modal-icon">
            <FileTextOutlined />
          </div>

          <div className="mg-xml-modal-heading-text">
            <div className="mg-xml-modal-title">Chi tiết hồ sơ</div>

            <div className="mg-xml-modal-subtitle">
              {currentDetails
                ? `${currentDetails.ma_bn || currentDetails.ma_lk || ""} · ${
                    currentDetails.ho_ten || ""
                  }`
                : "Thông tin khám chữa bệnh"}
            </div>
          </div>
        </div>
      }
    >
      {loading || (open && caseId && !currentDetails && !error) ? (
        <div className="mg-xml-loading">
          <Spin size="large" />
          <div>Đang tải chi tiết hồ sơ...</div>
        </div>
      ) : error ? (
        <div className="mg-xml-error">
          <Alert
            type="error"
            showIcon
            title={error}
            action={
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => setRetry((value) => value + 1)}
              >
                Thử lại
              </Button>
            }
          />
        </div>
      ) : currentDetails ? (
        <Tabs
          className="mg-xml-tabs"
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as XmlType)}
          items={XML_TYPES.map((type) => {
            const rows = getRows(currentDetails.files, type);

            return {
              key: type,
              label: (
                <span className="mg-xml-tab-label">
                  <span>{type.replace("XML", "XML ")}</span>
                  <span className="mg-xml-tab-caption">{TAB_NAMES[type]}</span>
                </span>
              ),
              children: (
                <XmlContent type={type} rows={rows} staffLookup={currentDetails.staffLookup} />
              ),
            };
          })}
        />
      ) : (
        <Empty description="Chưa chọn hồ sơ" />
      )}

      <style>{`
        .medguard-xml-modal {
          max-width: calc(100vw - 32px);
          padding-bottom: 0;
        }

        .medguard-xml-modal .ant-modal-container,
        .medguard-xml-modal .ant-modal-content {
          padding: 20px 22px;
          border-radius: 16px;
          overflow: hidden;
        }

        .medguard-xml-modal .ant-modal-header {
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #edf1f7;
          background: transparent;
        }

        .medguard-xml-modal .ant-modal-body {
          min-width: 0;
        }

        .medguard-xml-modal .ant-modal-close {
          top: 20px;
          right: 20px;
          border-radius: 8px;
          color: #64748b;
        }

        .mg-xml-modal-heading {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-right: 36px;
        }

        .mg-xml-modal-heading-text {
          min-width: 0;
        }

        .mg-xml-modal-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          flex-shrink: 0;
          border: 1px solid #dbeafe;
          border-radius: 12px;
          background: #eff6ff;
          color: #1677ff;
          font-size: 21px;
        }

        .mg-xml-modal-title {
          color: #1e293b;
          font-size: 17px;
          font-weight: 700;
          line-height: 1.4;
        }

        .mg-xml-modal-subtitle {
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
          font-weight: 400;
          overflow-wrap: anywhere;
        }

        .mg-xml-tabs > .ant-tabs-nav {
          flex-shrink: 0;
          margin-bottom: 14px;
          padding: 4px;
          border: 1px solid #e8eef6;
          border-radius: 10px;
          background: #f5f7fb;
        }

        .mg-xml-tabs > .ant-tabs-nav::before {
          display: none;
        }

        .mg-xml-tabs .ant-tabs-tab {
          margin: 0 4px 0 0 !important;
          padding: 8px 14px !important;
          border-radius: 7px;
          transition: background 0.2s, box-shadow 0.2s;
        }

        .mg-xml-tabs .ant-tabs-tab-active {
          background: #fff;
          box-shadow: 0 2px 6px rgba(30, 58, 95, 0.08);
        }

        .mg-xml-tabs .ant-tabs-ink-bar {
          display: none;
        }

        .mg-xml-tab-label {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 700;
        }

        .mg-xml-tab-caption {
          color: #7c8ba1;
          font-size: 11px;
          font-weight: 500;
        }

        .mg-xml-tabs .ant-tabs-tab-active .mg-xml-tab-caption {
          color: #1677ff;
        }

        .mg-xml-summary-scroll {
          max-height: max(120px, calc(100dvh - 270px));
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-gutter: stable;
          padding-right: 8px;
        }

        .mg-xml-summary {
          display: flex;
          flex-direction: column;
          gap: 17px;
          padding-bottom: 8px;
        }

        .mg-xml-patient {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 15px 18px;
          border: 1px solid #dfebfb;
          border-radius: 12px;
          background: linear-gradient(110deg, #f0f6ff, #fbfdff);
        }

        .mg-xml-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: #dbeafe;
          color: #2563eb;
          font-size: 21px;
          font-weight: 700;
        }

        .mg-xml-patient-info {
          min-width: 0;
        }

        .mg-xml-eyebrow {
          margin-bottom: 3px;
          color: #7187a5;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .mg-xml-patient-name {
          color: #1456b8;
          font-size: 18px;
          font-weight: 700;
          line-height: 1.4;
          overflow-wrap: break-word;
        }

        .mg-xml-patient-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 5px 18px;
          margin-top: 5px;
          color: #61738c;
          font-size: 12px;
        }

        .mg-xml-section {
          min-width: 0;
        }

        .mg-xml-section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          color: #334155;
          font-size: 13px;
          font-weight: 700;
        }

        .mg-xml-section-title::before {
          content: "";
          width: 3px;
          height: 13px;
          border-radius: 2px;
          background: #4096ff;
        }

        .mg-xml-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          column-gap: 22px;
        }

        .mg-xml-field {
          display: grid;
          grid-template-columns: 112px minmax(0, 1fr);
          align-items: baseline;
          gap: 10px;
          min-width: 0;
          padding: 9px 0;
          border-bottom: 1px dashed #e4eaf3;
        }

        .mg-xml-field-wide {
          grid-column: 1 / -1;
        }

        .mg-xml-label {
          color: #718096;
          font-size: 12px;
          line-height: 1.65;
        }

        .mg-xml-value {
          min-width: 0;
          color: #334155;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.75;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          font-variant-numeric: tabular-nums;
        }

        .mg-xml-money {
          color: #1456b8;
          font-variant-numeric: tabular-nums;
        }

        .mg-xml-muted {
          color: #a0aec0;
          font-weight: 400;
        }

        .mg-xml-other {
          padding-top: 2px;
        }

        .mg-xml-other summary {
          width: fit-content;
          padding: 5px 0;
          color: #64748b;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .mg-xml-other summary:hover,
        .mg-xml-other[open] summary {
          color: #1677ff;
        }

        .mg-xml-other[open] summary {
          margin-bottom: 6px;
        }

        .mg-xml-link {
          display: grid;
          grid-template-columns: 112px minmax(0, 1fr);
          gap: 10px;
          padding: 9px 0;
          border-bottom: 1px dashed #e4eaf3;
        }

        .mg-xml-table-panel {
          overflow: hidden;
          border: 1px solid #e4eaf3;
          border-radius: 10px;
        }

        .mg-xml-table-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 13px;
          border-bottom: 1px solid #e4eaf3;
          background: #fff;
          color: #334155;
          font-size: 12px;
          font-weight: 700;
        }

        .mg-xml-row-count {
          padding: 2px 8px;
          border-radius: 6px;
          background: #eff6ff;
          color: #4277be;
          font-size: 11px;
          font-weight: 500;
        }

        .medguard-xml-modal .ant-table {
          font-size: 12px;
        }

        .medguard-xml-modal .ant-table-thead > tr > th {
          padding: 11px 12px !important;
          background: #f1f5fa;
          color: #3c506b;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          border-bottom-color: #e4eaf3;
        }

        .medguard-xml-modal .ant-table-tbody > tr > td {
          padding: 10px 12px !important;
          vertical-align: top;
          color: #475569;
          border-bottom-color: #edf1f6;
        }

        .medguard-xml-modal .ant-table-tbody > tr:nth-child(even) > td {
          background: #f8fafc;
        }

        .medguard-xml-modal .ant-table-tbody > tr:hover > td {
          background: #eef6ff !important;
        }

        .mg-xml-cell {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.7;
        }

        .mg-xml-summary-scroll,
        .medguard-xml-modal .ant-table-body,
        .medguard-xml-modal .ant-table-content {
          scrollbar-width: thin;
          scrollbar-color: #bdcadd #f4f7fb;
        }

        .mg-xml-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 18px;
          min-height: 240px;
          color: #64748b;
          font-size: 13px;
        }

        .mg-xml-error {
          padding: 12px 0 20px;
        }

        .mg-xml-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 220px;
        }

        .mg-xml-staff-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .mg-xml-staff-item + .mg-xml-staff-item {
          padding-top: 9px;
          border-top: 1px dashed #e2e8f0;
        }

        .mg-xml-staff-name {
          color: #245da8;
          font-size: 12px;
          font-weight: 650;
          line-height: 1.6;
        }

        .mg-xml-staff-code {
          margin-top: 3px;
          color: #7c8ba1;
          font-size: 11px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .mg-xml-staff-unresolved {
          color: #8a7351;
          font-weight: 500;
        }

        @media (max-width: 1100px) {
          .mg-xml-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            column-gap: 20px;
          }

          .mg-xml-tab-caption {
            display: none;
          }
        }

        @media (max-width: 640px) {
          .medguard-xml-modal {
            max-width: calc(100vw - 16px);
          }

          .medguard-xml-modal .ant-modal-container,
          .medguard-xml-modal .ant-modal-content {
            padding: 16px 12px;
            border-radius: 12px;
          }

          .medguard-xml-modal .ant-modal-close {
            top: 15px;
            right: 12px;
          }

          .mg-xml-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .mg-xml-field,
          .mg-xml-link {
            grid-template-columns: 110px minmax(0, 1fr);
          }

          .mg-xml-patient {
            padding: 12px;
          }

          .mg-xml-patient-name {
            font-size: 16px;
          }

          .mg-xml-tabs .ant-tabs-tab {
            margin-right: 2px !important;
            padding: 8px 10px !important;
          }

          .mg-xml-summary-scroll {
            padding-right: 4px;
          }
        }
      `}</style>
    </Modal>
  );
}
