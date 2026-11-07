import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Input,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  HomeOutlined,
  MedicineBoxOutlined,
  SaveOutlined,
  UndoOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../api/apiClient";

const { Title, Text } = Typography;
type Severity = "WARNING" | "ERROR";

type RuleConfig = {
  topicCode: string;
  rejectionCode: string;
  treatmentGroup: string;
  endoscopyCodes: string[];
  foreignBodyCodes: string[];
};
type RuleData = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
  severity: Severity;
  required: boolean;
  blocksOk: boolean;
  config: RuleConfig;
};
type ApiResponse = {
  success: boolean;
  message?: string;
  data?: RuleData;
};

const DEFAULT_ENDOSCOPY = ["20.0013.0933", "20.0013.2048"];
const DEFAULT_FOREIGN_BODY = [
  "15.0143.0907",
  "15.0143.0906",
  "15.0212.0900",
  "03.2117.0903",
  "15.0054.0903",
  "03.2117.0902",
  "03.2117.0901",
  "15.0054.0902",
];

function parseCodes(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\s,;|]+/)
        .map((v) => v.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}
function codesText(codes: string[]): string {
  return codes.join("\n");
}
function validateCodes(a: string[], b: string[]): string | null {
  if (!a.length || !b.length) return "Mỗi nhóm phải có ít nhất một mã DVKT.";
  if ([...a, ...b].some((code) => code.length > 100))
    return "Mã DVKT không được vượt quá 100 ký tự.";
  const duplicates = b.filter((code) => new Set(a).has(code));
  if (duplicates.length) return `Mã DVKT trùng giữa hai nhóm: ${duplicates.join(", ")}`;
  return null;
}

type CodeEditorProps = {
  title: string;
  description: string;
  tone: "blue" | "orange";
  value: string;
  codes: string[];
  disabled: boolean;
  onChange: (v: string) => void;
};
function CodeEditor({
  title,
  description,
  tone,
  value,
  codes,
  disabled,
  onChange,
}: CodeEditorProps) {
  const removeCode = (code: string) => onChange(codes.filter((v) => v !== code).join("\n"));
  return (
    <Card className={`ent-compact-group ent-compact-${tone}`} bordered={false}>
      <div className="ent-compact-group-title">
        <div className="ent-compact-group-label">
          <Text strong>{title}</Text>
          <Text type="secondary" className="ent-compact-muted">
            {description}
          </Text>
        </div>
        <Tag color={tone === "blue" ? "blue" : "orange"} style={{ margin: 0 }}>
          {codes.length} mã
        </Tag>
      </div>
      <Input.TextArea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={4}
        spellCheck={false}
        placeholder="Nhập mã DVKT, mỗi dòng một mã..."
        className="ent-compact-editor"
      />
      <div className="ent-compact-code-list">
        {codes.map((code) => (
          <Tag
            key={code}
            color={tone === "blue" ? "blue" : "orange"}
            closable={!disabled}
            onClose={(event) => {
              event.preventDefault();
              removeCode(code);
            }}
          >
            {code}
          </Tag>
        ))}
      </div>
    </Card>
  );
}

export default function EntForeignBody() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [original, setOriginal] = useState<RuleData | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [severity, setSeverity] = useState<Severity>("WARNING");
  const [endoscopyText, setEndoscopyText] = useState("");
  const [foreignBodyText, setForeignBodyText] = useState("");

  const endoscopyCodes = useMemo(() => parseCodes(endoscopyText), [endoscopyText]);
  const foreignBodyCodes = useMemo(() => parseCodes(foreignBodyText), [foreignBodyText]);
  const error = useMemo(
    () => validateCodes(endoscopyCodes, foreignBodyCodes),
    [endoscopyCodes, foreignBodyCodes],
  );

  const applyRule = useCallback((data: RuleData) => {
    setOriginal(data);
    setEnabled(data.enabled);
    setSeverity(data.severity);
    setEndoscopyText(codesText(data.config.endoscopyCodes));
    setForeignBodyText(codesText(data.config.foreignBodyCodes));
  }, []);
  const loadRule = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await apiFetch("/catalog/ent-foreign-body", { method: "GET" });
      const json = (await response.json()) as ApiResponse;
      if (!response.ok || !json.success || !json.data)
        throw new Error(json.message || "Không thể tải cấu hình.");
      applyRule(json.data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Không thể tải cấu hình.");
    } finally {
      setLoading(false);
    }
  }, [applyRule]);
  useEffect(() => {
    void loadRule();
  }, [loadRule]);

  const dirty = useMemo(() => {
    if (!original) return false;
    const canonical = (codes: string[]) => [...codes].sort().join("|");
    return (
      original.enabled !== enabled ||
      original.severity !== severity ||
      canonical(original.config.endoscopyCodes) !== canonical(endoscopyCodes) ||
      canonical(original.config.foreignBodyCodes) !== canonical(foreignBodyCodes)
    );
  }, [original, enabled, severity, endoscopyCodes, foreignBodyCodes]);

  async function saveRule() {
    if (!original) return message.error("Chưa tải được cấu hình.");
    if (error) return message.error(error);
    try {
      setSaving(true);
      const response = await apiFetch("/catalog/ent-foreign-body", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, severity, endoscopyCodes, foreignBodyCodes }),
      });
      const json = (await response.json()) as ApiResponse;
      if (!response.ok || !json.success || !json.data)
        throw new Error(json.message || "Lưu cấu hình thất bại.");
      applyRule(json.data);
      message.success(json.message || "Đã lưu cấu hình.");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Lưu cấu hình thất bại.");
    } finally {
      setSaving(false);
    }
  }

  const unavailable = !original || loading || saving;
  const cannotSave = unavailable || !dirty || Boolean(error);
  return (
    <div className="ent-compact-page">
      <div className="ent-compact-top">
        <div className="ent-compact-heading">
          <Breadcrumb
            items={[
              {
                title: (
                  <a onClick={() => navigate("/")}>
                    <HomeOutlined />
                  </a>
                ),
              },
              { title: <a onClick={() => navigate("/catalog")}>Danh mục</a> },
              { title: "Nội soi TMH - Lấy dị vật" },
            ]}
          />
          <div className="ent-compact-title-row">
            <span className="ent-compact-icon">
              <MedicineBoxOutlined />
            </span>
            <div>
              <Title level={4} style={{ margin: 0 }}>
                Nội soi TMH và Lấy dị vật
              </Title>
              <Text type="secondary" className="ent-compact-muted">
                Cấu hình thanh toán đồng thời DVKT
              </Text>
            </div>
          </div>
        </div>
        <Space size={8} wrap>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={cannotSave}
            onClick={() => void saveRule()}
          >
            Lưu cấu hình
          </Button>
        </Space>
      </div>

      {loadError && (
        <Alert
          type="error"
          showIcon
          message={loadError}
          action={
            <Button size="small" onClick={() => void loadRule()}>
              Thử lại
            </Button>
          }
        />
      )}

      <Spin spinning={loading}>
        <div className="ent-compact-body">
          <Card bordered={false} className="ent-compact-options">
            <div className="ent-compact-identifiers">
              <Text strong>Chuyên đề TINH.DV.107</Text>
              <Space size={4} wrap>
                <Tag color="blue">S.005.655</Tag>
                <Tag>GENERAL</Tag>
                <Tag>XML3</Tag>
              </Space>
            </div>
            <div className="ent-compact-control">
              <Text className="ent-compact-control-label">Trạng thái</Text>
              <Switch
                checked={enabled}
                disabled={unavailable}
                checkedChildren="Đang bật"
                unCheckedChildren="Đã tắt"
                onChange={setEnabled}
              />
            </div>
            <div className="ent-compact-control">
              <Text className="ent-compact-control-label">Mức cảnh báo</Text>
              <Select<Severity>
                value={severity}
                disabled={unavailable}
                onChange={setSeverity}
                style={{ width: 175 }}
                options={[
                  { value: "WARNING", label: "WARNING" },
                  { value: "ERROR", label: "ERROR" },
                ]}
              />
            </div>
          </Card>

          <div className="ent-compact-groups">
            <CodeEditor
              title="Nhóm 1 · Nội soi TMH"
              description="Các mã nội soi tai mũi họng"
              tone="blue"
              value={endoscopyText}
              codes={endoscopyCodes}
              disabled={unavailable}
              onChange={setEndoscopyText}
            />
            <CodeEditor
              title="Nhóm 2 · Lấy dị vật"
              description="Các mã lấy dị vật tai, mũi, họng"
              tone="orange"
              value={foreignBodyText}
              codes={foreignBodyCodes}
              disabled={unavailable}
              onChange={setForeignBodyText}
            />
          </div>

          {error && <Alert showIcon type="error" message={error} />}

          <div className="ent-compact-rule-note">
            <WarningOutlined style={{ color: "#d48806", fontSize: 17 }} />
            <div className="ent-compact-note-text">
              <Text strong>
                Nguyên tắc: Có cả nội soi TMH và lấy dị vật trong cùng hồ sơ → Cảnh báo rà soát.
              </Text>
              <Text type="secondary" className="ent-compact-muted">
                Không kiểm tra trùng thời gian · Công khám TMH không tính là nội soi ·{" "}
                {endoscopyCodes.length * foreignBodyCodes.length} cặp mã có thể đối chiếu.
              </Text>
            </div>
          </div>

          <div className="ent-compact-actions">
            <Space size={8} wrap>
              <span className={dirty ? "ent-compact-unsaved" : "ent-compact-saved"}>
                {dirty ? <WarningOutlined /> : <CheckCircleOutlined />}
                {dirty ? "Có thay đổi chưa lưu" : "Đã đồng bộ cấu hình"}
              </span>
            </Space>
            <Space size={8} wrap>
              <Button
                icon={<UndoOutlined />}
                disabled={!original || !dirty || saving}
                onClick={() => {
                  if (original) applyRule(original);
                }}
              >
                Hủy thay đổi
              </Button>
              <Button
                disabled={unavailable}
                onClick={() => {
                  setEndoscopyText(codesText(DEFAULT_ENDOSCOPY));
                  setForeignBodyText(codesText(DEFAULT_FOREIGN_BODY));
                }}
              >
                Mã mặc định
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                disabled={cannotSave}
                onClick={() => void saveRule()}
              >
                Lưu cấu hình
              </Button>
            </Space>
          </div>
        </div>
      </Spin>

      <style>{`
        .ent-compact-page { width:100%; display:flex; flex-direction:column; gap:12px; min-height:0; }
        .ent-compact-top { display:flex; justify-content:space-between; align-items:flex-end; gap:12px; flex-wrap:wrap; }
        .ent-compact-heading { display:flex; flex-direction:column; gap:8px; }
        .ent-compact-heading .ant-breadcrumb { font-size:12px; }
        .ent-compact-title-row { display:flex; align-items:center; gap:10px; }
        .ent-compact-title-row h4 { font-size:19px!important; color:#172033; font-weight:800; }
        .ent-compact-icon { display:grid; place-items:center; background:#e6f4ff; color:#1677ff; border-radius:11px; width:37px; height:37px; font-size:20px; }
        .ent-compact-muted { display:block; font-size:11px; line-height:1.4; }
        .ent-compact-body { display:flex; flex-direction:column; gap:12px; min-height:0; }
        .ent-compact-options, .ent-compact-group { border:1px solid #e9eef5; border-radius:12px; box-shadow:0 3px 12px rgba(15,23,42,.035); }
        .ent-compact-options .ant-card-body { padding:13px 16px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px 18px; }
        .ent-compact-identifiers { display:flex; flex-direction:column; gap:6px; min-width:230px; flex:1; }
        .ent-compact-identifiers .ant-tag { margin-inline-end:0; }
        .ent-compact-control { display:flex; align-items:center; gap:10px; }
        .ent-compact-control-label { font-size:12px; font-weight:600; white-space:nowrap; }
        .ent-compact-groups { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:12px; }
        .ent-compact-group .ant-card-body { padding:14px; }
        .ent-compact-group-title { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
        .ent-compact-group-label { display:flex; flex-direction:column; gap:2px; }
        .ent-compact-editor { font:12px/1.5 Consolas, 'Courier New', monospace; resize:none; border-radius:8px; }
        .ent-compact-code-list { display:flex; align-content:flex-start; flex-wrap:wrap; gap:6px; margin-top:10px; }
        .ent-compact-code-list .ant-tag { margin:0; padding:2px 7px; border-radius:6px; font-size:11px; }
        .ent-compact-rule-note { display:flex; align-items:flex-start; gap:10px; padding:12px 14px; border:1px solid #ffe58f; border-radius:10px; background:#fffbe6; }
        .ent-compact-note-text { display:flex; flex-direction:column; gap:3px; min-width:0; font-size:12px; }
        .ent-compact-actions { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; padding-bottom:4px; }
        .ent-compact-saved, .ent-compact-unsaved { display:inline-flex; align-items:center; gap:6px; font-size:12px; }
        .ent-compact-saved { color:#389e0d; } .ent-compact-unsaved { color:#d48806; }
        @media(max-width:950px) { .ent-compact-options .ant-card-body { align-items:flex-start; } .ent-compact-control { flex-wrap:wrap; } }
        @media(max-width:760px) { .ent-compact-groups { grid-template-columns:1fr; } .ent-compact-top { align-items:flex-start; } .ent-compact-actions { align-items:flex-start; } }
        @media(max-height:780px) and (min-width:1000px) { .ent-compact-page { gap:8px; } .ent-compact-body { gap:8px; } .ent-compact-group .ant-card-body { padding:10px 12px; } .ent-compact-editor { min-height:75px!important; } .ent-compact-rule-note { padding:9px 12px; } }
      `}</style>
    </div>
  );
}
