import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Col,
  Input,
  Row,
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
  ReloadOutlined,
  SaveOutlined,
  UndoOutlined,
  WarningOutlined,
  FileImageOutlined,
} from "@ant-design/icons";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../api/apiClient";

const { Title, Text } = Typography;

const API_PATH = "/catalog/service-chest-xray";

const DEFAULT_GROUP_A = ["18.0119.0029", "18.0119.0028"];

const DEFAULT_GROUP_B = ["18.0120.0028"];

type Severity = "WARNING" | "ERROR";

interface RuleConfig {
  groupACodes: string[];
  groupBCodes: string[];
  treatmentGroup?: string;
  interactionType?: string;
  note?: string;
}

interface RuleData {
  id: string;
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
  severity: Severity;
  required: boolean;
  blocksOk: boolean;
  config: RuleConfig;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  data?: RuleData;
}

function parseCodes(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[\s,;|]+/)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

function codeText(codes: string[]): string {
  return codes.join("\n");
}

function validateCodes(groupA: string[], groupB: string[]): string | null {
  if (!groupA.length || !groupB.length) {
    return "Mỗi nhóm phải có ít nhất một mã DVKT.";
  }

  const invalid = [...groupA, ...groupB].find((code) => code.length > 100);

  if (invalid) {
    return "Mã DVKT không được vượt quá 100 ký tự.";
  }

  const groupASet = new Set(groupA);

  const duplicates = groupB.filter((code) => groupASet.has(code));

  if (duplicates.length) {
    return "Mã DVKT không được nằm ở cả hai nhóm: " + duplicates.join(", ");
  }

  return null;
}

function sameCodes(first: string[], second: string[]): boolean {
  return [...first].sort().join("|") === [...second].sort().join("|");
}

export default function ServiceChestXray() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [original, setOriginal] = useState<RuleData | null>(null);

  const [enabled, setEnabled] = useState(true);

  const [severity, setSeverity] = useState<Severity>("WARNING");

  const [groupAText, setGroupAText] = useState("");

  const [groupBText, setGroupBText] = useState("");

  const groupACodes = useMemo(() => parseCodes(groupAText), [groupAText]);

  const groupBCodes = useMemo(() => parseCodes(groupBText), [groupBText]);

  const validationError = useMemo(
    () => validateCodes(groupACodes, groupBCodes),
    [groupACodes, groupBCodes],
  );

  const applyRule = useCallback((rule: RuleData) => {
    setOriginal(rule);
    setEnabled(rule.enabled);
    setSeverity(rule.severity);

    setGroupAText(codeText(rule.config.groupACodes));

    setGroupBText(codeText(rule.config.groupBCodes));
  }, []);

  const loadRule = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");

      const response = await apiFetch(API_PATH, {
        method: "GET",
      });

      const json = (await response.json()) as ApiResponse;

      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.message || "Không tải được cấu hình X-quang ngực.");
      }

      applyRule(json.data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Không thể tải cấu hình.");
    } finally {
      setLoading(false);
    }
  }, [applyRule]);

  useEffect(() => {
    void loadRule();
  }, [loadRule]);

  const isDirty = useMemo(() => {
    if (!original) return false;

    return (
      original.enabled !== enabled ||
      original.severity !== severity ||
      !sameCodes(original.config.groupACodes, groupACodes) ||
      !sameCodes(original.config.groupBCodes, groupBCodes)
    );
  }, [original, enabled, severity, groupACodes, groupBCodes]);

  async function handleSave() {
    if (!original) {
      message.error("Chưa tải được cấu hình.");
      return;
    }

    if (validationError) {
      message.error(validationError);
      return;
    }

    try {
      setSaving(true);

      const response = await apiFetch(API_PATH, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled,
          severity,
          groupACodes,
          groupBCodes,
        }),
      });

      const json = (await response.json()) as ApiResponse;

      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.message || "Không thể lưu cấu hình.");
      }

      applyRule(json.data);

      message.success(json.message || "Đã lưu cấu hình.");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Lưu cấu hình thất bại.");
    } finally {
      setSaving(false);
    }
  }

  function resetChanges() {
    if (!original) return;

    applyRule(original);
    message.info("Đã khôi phục cấu hình đã lưu.");
  }

  function resetDefaults() {
    setGroupAText(codeText(DEFAULT_GROUP_A));
    setGroupBText(codeText(DEFAULT_GROUP_B));
  }

  const canSave = Boolean(original) && !loading && !saving && isDirty && !validationError;

  return (
    <div className="chest-rule-page">
      <Breadcrumb
        items={[
          {
            title: (
              <a onClick={() => navigate("/")}>
                <HomeOutlined />
              </a>
            ),
          },
          {
            title: <a onClick={() => navigate("/catalog")}>Danh mục</a>,
          },
          {
            title: "Tương tác DVKT - X-quang ngực",
          },
        ]}
      />

      <div className="chest-rule-header">
        <div className="chest-rule-heading">
          <div className="chest-rule-icon">
            <FileImageOutlined />
          </div>

          <div>
            <Title level={4} style={{ margin: 0 }}>
              Tương tác DVKT - X-quang ngực
            </Title>
            <Text type="secondary">
              Cấu hình cảnh báo thanh toán đồng thời X-quang ngực thẳng và nghiêng/chếch
            </Text>
          </div>
        </div>

        <Space size={8} wrap>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            disabled={!canSave}
            loading={saving}
            onClick={() => void handleSave()}
          >
            Lưu cấu hình
          </Button>
        </Space>
      </div>

      {loadError && (
        <Alert
          type="error"
          showIcon
          message="Không thể tải cấu hình"
          description={loadError}
          action={
            <Button size="small" onClick={() => void loadRule()}>
              Thử lại
            </Button>
          }
        />
      )}

      <Spin spinning={loading}>
        <div className="chest-rule-content">
          <Card className="chest-rule-card">
            <Row gutter={[16, 14]} align="middle">
              <Col xs={24} lg={12}>
                <div className="chest-rule-info">
                  <Text strong>Quy luật không thanh toán đồng thời</Text>

                  <Space size={5} wrap>
                    <Tag color="blue">GENERAL</Tag>
                    <Tag>XML3</Tag>
                    <Tag color="orange">Hai nhóm DVKT loại trừ</Tag>
                  </Space>

                  <Text type="secondary">
                    Kiểm tra trong cùng hồ sơ, không phụ thuộc thời gian thực hiện.
                  </Text>
                </div>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <div className="chest-rule-setting">
                  <Text strong>Trạng thái quy luật</Text>

                  <Switch
                    checked={enabled}
                    disabled={!original || loading}
                    checkedChildren="Đang bật"
                    unCheckedChildren="Đã tắt"
                    onChange={setEnabled}
                  />
                </div>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <div className="chest-rule-setting">
                  <Text strong>Mức độ cảnh báo</Text>

                  <Select<Severity>
                    value={severity}
                    style={{ width: "100%" }}
                    disabled={!original || loading}
                    onChange={setSeverity}
                    options={[
                      {
                        value: "WARNING",
                        label: "WARNING - Cảnh báo",
                      },
                      {
                        value: "ERROR",
                        label: "ERROR - Lỗi",
                      },
                    ]}
                  />
                </div>
              </Col>
            </Row>
          </Card>

          <Row gutter={[14, 14]}>
            <Col xs={24} lg={12}>
              <Card className="chest-rule-card chest-code-card">
                <div className="chest-code-heading">
                  <div>
                    <Text strong>Nhóm A - X-quang ngực thẳng</Text>
                    <Text type="secondary" className="chest-code-subtitle">
                      Các mã X-quang ngực thẳng
                    </Text>
                  </div>

                  <Tag color="blue">{groupACodes.length} mã</Tag>
                </div>

                <Input.TextArea
                  value={groupAText}
                  disabled={!original || loading}
                  onChange={(event) => setGroupAText(event.target.value)}
                  rows={4}
                  spellCheck={false}
                  placeholder="Mỗi dòng một mã DVKT"
                  className="chest-code-input"
                />

                <Text type="secondary" className="chest-code-hint">
                  Mỗi dòng một mã. Có thể dán danh sách mã từ Excel.
                </Text>

                <div className="chest-code-tags">
                  {groupACodes.map((code) => (
                    <Tag key={code} color="blue">
                      {code}
                    </Tag>
                  ))}
                </div>
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card className="chest-rule-card chest-code-card">
                <div className="chest-code-heading">
                  <div>
                    <Text strong>Nhóm B - X-quang ngực nghiêng/chếch</Text>
                    <Text type="secondary" className="chest-code-subtitle">
                      Các mã X-quang ngực nghiêng hoặc chếch
                    </Text>
                  </div>

                  <Tag color="purple">{groupBCodes.length} mã</Tag>
                </div>

                <Input.TextArea
                  value={groupBText}
                  disabled={!original || loading}
                  onChange={(event) => setGroupBText(event.target.value)}
                  rows={4}
                  spellCheck={false}
                  placeholder="Mỗi dòng một mã DVKT"
                  className="chest-code-input"
                />

                <Text type="secondary" className="chest-code-hint">
                  Phát hiện khi có cả nhóm A và nhóm B trong cùng một hồ sơ.
                </Text>

                <div className="chest-code-tags">
                  {groupBCodes.map((code) => (
                    <Tag key={code} color="purple">
                      {code}
                    </Tag>
                  ))}
                </div>
              </Card>
            </Col>
          </Row>

          {validationError && <Alert type="error" showIcon message={validationError} />}

          <Card className="chest-rule-card">
            <div className="chest-preview-heading">
              <Text strong>
                <WarningOutlined
                  style={{
                    color: "#fa8c16",
                    marginRight: 7,
                  }}
                />
                Nguyên tắc phát hiện
              </Text>

              <Tag color="processing">
                {groupACodes.length * groupBCodes.length} cặp mã có thể đối chiếu
              </Tag>
            </div>

            <div className="chest-preview-list">
              <span className="chest-pass">
                <CheckCircleOutlined />
                Chỉ nhóm A: PASS
              </span>

              <span className="chest-pass">
                <CheckCircleOutlined />
                Chỉ nhóm B: PASS
              </span>

              <span className="chest-pass">
                <CheckCircleOutlined />
                Không có cả hai: PASS
              </span>

              <span className="chest-warning">
                <WarningOutlined />
                Có cả A và B: Cảnh báo
              </span>
            </div>

            <Text type="secondary">
              Khi XML3 chứa mã thuộc cả hai nhóm trong cùng một hồ sơ GENERAL, hệ thống ghi nhận
              cảnh báo cần rà soát điều kiện thanh toán BHYT. Không tự động kết luận từ chối thanh
              toán.
            </Text>
          </Card>

          <div className="chest-rule-footer">
            <Space wrap>
              <Tag color={enabled ? "success" : "default"}>{enabled ? "Đang bật" : "Đã tắt"}</Tag>

              <Text type="secondary">
                {isDirty ? "Có thay đổi chưa lưu" : "Cấu hình đã đồng bộ"}
              </Text>
            </Space>

            <Space size={8} wrap>
              <Button
                icon={<UndoOutlined />}
                disabled={!original || !isDirty || saving}
                onClick={resetChanges}
              >
                Hủy thay đổi
              </Button>

              <Button disabled={!original || saving} onClick={resetDefaults}>
                Mã mặc định
              </Button>

              <Button
                icon={<SaveOutlined />}
                type="primary"
                disabled={!canSave}
                loading={saving}
                onClick={() => void handleSave()}
              >
                Lưu cấu hình
              </Button>
            </Space>
          </div>
        </div>
      </Spin>

      <style>
        {`
          .chest-rule-page {
            width: 100%;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .chest-rule-page .ant-breadcrumb {
            font-size: 12px;
          }

          .chest-rule-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
          }

          .chest-rule-heading {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .chest-rule-heading h4 {
            font-size: 19px !important;
            font-weight: 800 !important;
            color: #172033;
          }

          .chest-rule-heading .ant-typography {
            display: block;
          }

          .chest-rule-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            width: 38px;
            height: 38px;
            border-radius: 10px;
            background: #e6f4ff;
            color: #1677ff;
            font-size: 19px;
          }

          .chest-rule-content {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .chest-rule-card {
            border: 1px solid #e9edf3;
            border-radius: 12px;
            box-shadow:
              0 3px 12px rgba(15,23,42,.035);
          }

          .chest-rule-card > .ant-card-body {
            padding: 14px 16px;
          }

          .chest-rule-info,
          .chest-rule-setting {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .chest-rule-info .ant-typography {
            font-size: 12px;
          }

          .chest-rule-setting .ant-switch {
            align-self: flex-start;
          }

          .chest-code-card {
            height: 100%;
          }

          .chest-code-heading,
          .chest-preview-heading {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 8px;
            margin-bottom: 12px;
          }

          .chest-code-heading .ant-tag,
          .chest-preview-heading .ant-tag {
            margin: 0;
          }

          .chest-code-subtitle {
            display: block;
            margin-top: 3px;
            font-size: 12px;
          }

          .chest-code-input {
            font-family:
              Consolas, "Courier New", monospace;
            font-size: 13px;
            line-height: 1.6;
            border-radius: 8px;
          }

          .chest-code-hint {
            display: block;
            margin-top: 8px;
            font-size: 11px;
          }

          .chest-code-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 12px;
          }

          .chest-code-tags .ant-tag {
            margin: 0;
            padding: 2px 7px;
            border-radius: 6px;
          }

          .chest-preview-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 10px;
          }

          .chest-pass,
          .chest-warning {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 9px;
            border-radius: 7px;
            font-size: 12px;
            font-weight: 600;
          }

          .chest-pass {
            background: #f6ffed;
            color: #389e0d;
          }

          .chest-warning {
            background: #fffbe6;
            color: #ad6800;
          }

          .chest-rule-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            padding: 6px 0 2px;
          }

          @media (max-width: 768px) {
            .chest-rule-heading h4 {
              font-size: 17px !important;
            }

            .chest-rule-header,
            .chest-rule-footer {
              align-items: flex-start;
              flex-direction: column;
            }

            .chest-rule-card > .ant-card-body {
              padding: 12px;
            }
          }
        `}
      </style>
    </div>
  );
}
