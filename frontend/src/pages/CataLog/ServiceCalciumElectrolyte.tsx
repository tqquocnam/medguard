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
  ExperimentOutlined,
  HomeOutlined,
  ReloadOutlined,
  SaveOutlined,
  UndoOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../api/apiClient";

const { Title, Text } = Typography;

const API_PATH = "/catalog/service-calcium-electrolyte";

const DEFAULT_A = "23.0029.1473";
const DEFAULT_B = "23.0058.1487";

type Severity = "WARNING" | "ERROR";

interface RuleConfig {
  serviceACode: string;
  serviceBCode: string;
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

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

export default function ServiceCalciumElectrolyte() {
  const navigate = useNavigate();

  // ====================================================
  // STATE
  // ====================================================

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [original, setOriginal] = useState<RuleData | null>(null);

  const [enabled, setEnabled] = useState(true);

  const [severity, setSeverity] = useState<Severity>("WARNING");

  const [serviceACode, setServiceACode] = useState(DEFAULT_A);

  const [serviceBCode, setServiceBCode] = useState(DEFAULT_B);

  // ====================================================
  // VALIDATION
  // ====================================================

  const normalizedA = normalizeCode(serviceACode);
  const normalizedB = normalizeCode(serviceBCode);

  const validationError = useMemo(() => {
    if (!normalizedA || !normalizedB) {
      return "Không được để trống mã DVKT A hoặc B.";
    }

    if (normalizedA.length > 100 || normalizedB.length > 100) {
      return "Mỗi mã DVKT tối đa 100 ký tự.";
    }

    if (normalizedA === normalizedB) {
      return "DVKT A và DVKT B không được trùng mã.";
    }

    return null;
  }, [normalizedA, normalizedB]);

  const isDirty = useMemo(() => {
    if (!original) return false;

    return (
      original.enabled !== enabled ||
      original.severity !== severity ||
      normalizeCode(original.config.serviceACode) !== normalizedA ||
      normalizeCode(original.config.serviceBCode) !== normalizedB
    );
  }, [original, enabled, severity, normalizedA, normalizedB]);

  // ====================================================
  // APPLY DATA
  // ====================================================

  const applyRule = useCallback((rule: RuleData) => {
    setOriginal(rule);

    setEnabled(rule.enabled);
    setSeverity(rule.severity);

    setServiceACode(rule.config.serviceACode ?? DEFAULT_A);

    setServiceBCode(rule.config.serviceBCode ?? DEFAULT_B);
  }, []);

  // ====================================================
  // LOAD CONFIG
  // ====================================================

  const loadRule = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");

      const response = await apiFetch(API_PATH, {
        method: "GET",
      });

      const json = (await response.json()) as ApiResponse;

      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.message || "Không thể tải cấu hình rule.");
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

  // ====================================================
  // SAVE CONFIG
  // ====================================================

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
          serviceACode: normalizedA,
          serviceBCode: normalizedB,
        }),
      });

      const json = (await response.json()) as ApiResponse;

      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.message || "Lưu cấu hình thất bại.");
      }

      applyRule(json.data);

      message.success(json.message || "Đã lưu cấu hình thành công.");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Không thể lưu cấu hình.");
    } finally {
      setSaving(false);
    }
  }

  // ====================================================
  // RESET
  // ====================================================

  function resetChanges() {
    if (!original) return;

    applyRule(original);
    message.info("Đã khôi phục cấu hình đã lưu.");
  }

  function resetDefaults() {
    setServiceACode(DEFAULT_A);
    setServiceBCode(DEFAULT_B);
  }

  // ====================================================
  // UI
  // ====================================================

  return (
    <div className="calcium-page">
      <Breadcrumb
        className="calcium-breadcrumb"
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
            title: "Canxi toàn phần - Điện giải đồ",
          },
        ]}
      />

      <div className="calcium-header">
        <div className="calcium-heading">
          <div className="calcium-header-icon">
            <ExperimentOutlined />
          </div>

          <div>
            <Title level={3} style={{ margin: 0 }}>
              Canxi toàn phần - Điện giải đồ
            </Title>

            <Text type="secondary">Cấu hình quy luật không thanh toán đồng thời hai DVKT</Text>
          </div>
        </div>

        <Space wrap size={8}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={loading || !original || !isDirty || Boolean(validationError)}
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
        <div className="calcium-content">
          {/* RULE SETTINGS */}
          <Card className="calcium-setting-card">
            <Row gutter={[18, 14]} align="middle">
              <Col xs={24} lg={12}>
                <div className="calcium-rule-info">
                  <Text strong>
                    <WarningOutlined
                      style={{
                        color: "#fa8c16",
                        marginRight: 8,
                      }}
                    />
                    Quy luật loại trừ DVKT
                  </Text>

                  <Space size={6} wrap>
                    <Tag color="blue">GENERAL</Tag>
                    <Tag>XML3</Tag>
                    <Tag color="orange">Chỉ cho phép 1 trong 2</Tag>
                  </Space>

                  <Text type="secondary">
                    Kiểm tra hai mã DVKT trong cùng một hồ sơ, không phụ thuộc thời gian thực hiện.
                  </Text>
                </div>
              </Col>

              <Col xs={24} sm={12} lg={6}>
                <div className="calcium-setting-field">
                  <Text strong>Trạng thái</Text>

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
                <div className="calcium-setting-field">
                  <Text strong>Mức độ cảnh báo</Text>

                  <Select<Severity>
                    value={severity}
                    disabled={!original || loading}
                    style={{ width: "100%" }}
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

          {/* TWO SERVICES */}
          <Row gutter={[14, 14]}>
            <Col xs={24} lg={12}>
              <Card className="calcium-service-card">
                <div className="calcium-service-top">
                  <Tag color="blue">DVKT A</Tag>
                  <Tag color="success">
                    <CheckCircleOutlined /> Được chọn riêng
                  </Tag>
                </div>

                <Text strong className="calcium-service-title">
                  Định lượng Canxi toàn phần [Máu]
                </Text>

                <Text className="calcium-field-label">Mã dịch vụ kỹ thuật</Text>

                <Input
                  size="large"
                  value={serviceACode}
                  disabled={!original || loading}
                  maxLength={100}
                  spellCheck={false}
                  placeholder="Nhập mã DVKT A"
                  onChange={(event) => setServiceACode(event.target.value)}
                />
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card className="calcium-service-card">
                <div className="calcium-service-top">
                  <Tag color="purple">DVKT B</Tag>
                  <Tag color="success">
                    <CheckCircleOutlined /> Được chọn riêng
                  </Tag>
                </div>

                <Text strong className="calcium-service-title">
                  Điện giải đồ (Na, K, Cl) [Máu]
                </Text>

                <Text className="calcium-field-label">Mã dịch vụ kỹ thuật</Text>

                <Input
                  size="large"
                  value={serviceBCode}
                  disabled={!original || loading}
                  maxLength={100}
                  spellCheck={false}
                  placeholder="Nhập mã DVKT B"
                  onChange={(event) => setServiceBCode(event.target.value)}
                />
              </Card>
            </Col>
          </Row>

          {validationError && <Alert type="error" showIcon message={validationError} />}

          {/* RULE EXPLANATION */}
          <Card className="calcium-explanation-card">
            <div className="calcium-explanation-title">
              <WarningOutlined style={{ color: "#fa8c16" }} />

              <Text strong>Nguyên tắc phát hiện</Text>
            </div>

            <div className="calcium-rule-cases">
              <span className="calcium-rule-pass">
                <CheckCircleOutlined /> Chỉ DVKT A: PASS
              </span>

              <span className="calcium-rule-pass">
                <CheckCircleOutlined /> Chỉ DVKT B: PASS
              </span>

              <span className="calcium-rule-pass">
                <CheckCircleOutlined /> Không có cả hai: PASS
              </span>

              <span className="calcium-rule-warning">
                <WarningOutlined /> Có cả A và B: Cảnh báo
              </span>
            </div>

            <Text type="secondary">
              Nếu cả hai mã xuất hiện trong cùng một hồ sơ XML3, hệ thống phát hiện quy luật loại
              trừ và yêu cầu rà soát điều kiện thanh toán BHYT.
            </Text>
          </Card>

          {/* BOTTOM ACTIONS */}
          <div className="calcium-footer">
            <Space size={8} wrap>
              {original && (
                <Tag color={enabled ? "success" : "default"}>
                  {enabled ? "Quy luật đang bật" : "Quy luật đã tắt"}
                </Tag>
              )}

              <Text type="secondary">
                {isDirty ? "Có thay đổi chưa được lưu" : "Cấu hình đã đồng bộ"}
              </Text>
            </Space>

            <Space size={8} wrap>
              <Button
                icon={<UndoOutlined />}
                disabled={!original || !isDirty}
                onClick={resetChanges}
              >
                Hủy thay đổi
              </Button>

              <Button disabled={!original} onClick={resetDefaults}>
                Mã mặc định
              </Button>

              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                disabled={loading || !original || !isDirty || Boolean(validationError)}
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
          .calcium-page {
            display: flex;
            flex-direction: column;
            width: 100%;
            gap: 12px;
            min-width: 0;
          }

          .calcium-breadcrumb {
            font-size: 12px;
          }

          .calcium-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
          }

          .calcium-heading {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
          }

          .calcium-header-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 42px;
            height: 42px;
            border-radius: 11px;
            background: #fff4e6;
            color: #fa8c16;
            font-size: 21px;
            flex-shrink: 0;
          }

          .calcium-heading h3 {
            font-size: 21px !important;
            font-weight: 800 !important;
            color: #172033;
          }

          .calcium-content {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          .calcium-setting-card,
          .calcium-service-card,
          .calcium-explanation-card {
            border: 1px solid #e9edf3;
            border-radius: 12px;
            box-shadow: 0 3px 12px rgba(15,23,42,.035);
          }

          .calcium-setting-card .ant-card-body {
            padding: 17px;
          }

          .calcium-rule-info {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 7px;
          }

          .calcium-rule-info .ant-typography {
            font-size: 12px;
          }

          .calcium-setting-field {
            display: flex;
            flex-direction: column;
            gap: 9px;
            font-size: 12px;
          }

          .calcium-setting-field .ant-switch {
            align-self: flex-start;
          }

          .calcium-service-card {
            height: 100%;
          }

          .calcium-service-card .ant-card-body {
            display: flex;
            flex-direction: column;
            padding: 18px;
            gap: 12px;
          }

          .calcium-service-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 6px;
          }

          .calcium-service-top .ant-tag {
            margin: 0;
          }

          .calcium-service-title {
            display: block;
            min-height: 24px;
            color: #172033;
            font-size: 16px;
          }

          .calcium-field-label {
            display: block;
            font-size: 12px;
            color: #64748b;
            font-weight: 600;
          }

          .calcium-service-card .ant-input {
            font-family: Consolas, "Courier New", monospace;
            font-weight: 700;
            font-size: 15px;
          }

          .calcium-explanation-card .ant-card-body {
            padding: 16px 18px;
          }

          .calcium-explanation-title {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 14px;
          }

          .calcium-rule-cases {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 12px;
          }

          .calcium-rule-pass,
          .calcium-rule-warning {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 7px 11px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
          }

          .calcium-rule-pass {
            color: #389e0d;
            background: #f6ffed;
          }

          .calcium-rule-warning {
            color: #d48806;
            background: #fffbe6;
          }

          .calcium-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            padding: 8px 0 2px;
          }

          @media (max-width: 768px) {
            .calcium-heading h3 {
              font-size: 17px !important;
            }

            .calcium-service-card .ant-card-body,
            .calcium-setting-card .ant-card-body,
            .calcium-explanation-card .ant-card-body {
              padding: 12px;
            }

            .calcium-header,
            .calcium-footer {
              align-items: flex-start;
              flex-direction: column;
            }
          }
        `}
      </style>
    </div>
  );
}
