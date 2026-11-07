import {
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";

import {
  Breadcrumb,
  Button,
  Card,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";

import { useEffect, useMemo, useState } from "react";

import type { ColumnsType } from "antd/es/table";

import { useNavigate } from "react-router-dom";

import { apiFetch } from "../../api/apiClient";

const { Title, Text } = Typography;

interface ServiceDiagnosisRow {
  id: string;

  service_code: string;

  diagnosis_pattern: string;

  match_type: string;

  active: boolean;

  note?: string | null;
}

interface GroupedServiceDiagnosis {
  serviceCode: string;

  rows: ServiceDiagnosisRow[];
}

interface FormValues {
  service_code: string;

  diagnosis_pattern: string;

  match_type: string;

  active: boolean;

  note?: string;
}

const MATCH_OPTIONS = [
  {
    label: "Có chứa",

    value: "CONTAINS",
  },

  {
    label: "Chính xác",

    value: "EXACT",
  },

  {
    label: "Bắt đầu bằng",

    value: "STARTS_WITH",
  },
];

function getMatchLabel(value: string) {
  return MATCH_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export default function ServiceDiagnosis() {
  const navigate = useNavigate();

  const [form] = Form.useForm<FormValues>();

  const [rows, setRows] = useState<ServiceDiagnosisRow[]>([]);

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);

  const [editing, setEditing] = useState<ServiceDiagnosisRow | null>(null);

  const [selectedServiceCode, setSelectedServiceCode] = useState<string | undefined>();

  async function loadData() {
    try {
      setLoading(true);

      const response = await apiFetch("/catalog/service-diagnosis", {
        method: "GET",
      });

      let json: any = null;

      try {
        json = await response.json();
      } catch {
        json = null;
      }

      if (!response.ok || json?.success !== true) {
        throw new Error(json?.message || "Không thể tải dữ liệu.");
      }

      const data = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.data?.items)
          ? json.data.items
          : [];

      setRows(data);
    } catch (error) {
      console.error("Load service diagnosis error:", error);

      message.error(error instanceof Error ? error.message : "Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const serviceOptions = useMemo(() => {
    const values = Array.from(
      new Set(rows.map((item) => String(item.service_code ?? "").trim()).filter(Boolean)),
    );

    values.sort((a, b) => a.localeCompare(b));

    return values.map((value) => ({
      value,

      label: value,
    }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!selectedServiceCode) {
      return rows;
    }

    return rows.filter((item) => item.service_code === selectedServiceCode);
  }, [rows, selectedServiceCode]);

  const groupedRows: GroupedServiceDiagnosis[] = useMemo(() => {
    const map = new Map<string, ServiceDiagnosisRow[]>();

    for (const item of filteredRows) {
      const key = String(item.service_code ?? "").trim();

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key)!.push(item);
    }

    return Array.from(map.entries()).map(([serviceCode, values]) => ({
      serviceCode,

      rows: values,
    }));
  }, [filteredRows]);

  function openCreate() {
    setEditing(null);

    form.resetFields();

    form.setFieldsValue({
      service_code: selectedServiceCode ?? "",

      diagnosis_pattern: "",

      match_type: "CONTAINS",

      active: true,

      note: "",
    });

    setModalOpen(true);
  }

  function openEdit(record: ServiceDiagnosisRow) {
    setEditing(record);

    form.resetFields();

    form.setFieldsValue({
      service_code: record.service_code,

      diagnosis_pattern: record.diagnosis_pattern,

      match_type: record.match_type,

      active: record.active,

      note: record.note ?? "",
    });

    setModalOpen(true);
  }

  async function handleSave() {
    try {
      const values = await form.validateFields();

      setSaving(true);

      const url = editing
        ? `/catalog/service-diagnosis/${editing.id}`
        : "/catalog/service-diagnosis";

      const response = await apiFetch(url, {
        method: editing ? "PUT" : "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          service_code: values.service_code.trim(),

          diagnosis_pattern: values.diagnosis_pattern.trim(),

          match_type: values.match_type,

          active: values.active,

          note: values.note?.trim() || null,
        }),
      });

      let json: any = null;

      try {
        json = await response.json();
      } catch {
        json = null;
      }

      if (!response.ok || json?.success !== true) {
        throw new Error(
          json?.message || (editing ? "Không thể cập nhật cấu hình." : "Không thể thêm cấu hình."),
        );
      }

      message.success(editing ? "Cập nhật thành công." : "Thêm mới thành công.");

      setModalOpen(false);

      setEditing(null);

      form.resetFields();

      await loadData();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const response = await apiFetch(`/catalog/service-diagnosis/${id}`, {
        method: "DELETE",
      });

      let json: any = null;

      try {
        json = await response.json();
      } catch {
        json = null;
      }

      if (!response.ok || json?.success !== true) {
        throw new Error(json?.message || "Không thể xóa cấu hình.");
      }

      message.success("Đã xóa cấu hình.");

      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Không thể xóa cấu hình.");
    }
  }

  const columns: ColumnsType<GroupedServiceDiagnosis> = [
    {
      title: "DVKT",

      dataIndex: "serviceCode",

      key: "serviceCode",

      width: 280,

      render: (value: string) => (
        <Text
          strong
          style={{
            color: "#172033",
          }}
        >
          {value}
        </Text>
      ),
    },

    {
      title: "Chẩn đoán vào",

      key: "diagnosis",

      render: (
        _: unknown,

        record: GroupedServiceDiagnosis,
      ) => (
        <div className="service-diagnosis-tags">
          {record.rows.map((item) => (
            <Tag
              key={item.id}
              color={item.active ? "blue" : "default"}
              className="service-diagnosis-tag"
              closable
              onClose={(event) => {
                event.preventDefault();

                event.stopPropagation();

                Modal.confirm({
                  title: "Xóa chẩn đoán này?",

                  content: (
                    <div
                      style={{
                        marginTop: 10,
                      }}
                    >
                      <div
                        style={{
                          marginBottom: 6,

                          color: "#64748b",
                        }}
                      >
                        Bạn có chắc muốn xóa:
                      </div>

                      <div
                        style={{
                          padding: "8px 10px",

                          borderRadius: 8,

                          background: "#f5f7fa",

                          color: "#1677ff",

                          fontWeight: 700,
                        }}
                      >
                        {item.diagnosis_pattern}
                      </div>
                    </div>
                  ),

                  okText: "Xóa",

                  cancelText: "Hủy",

                  centered: true,

                  okButtonProps: {
                    danger: true,
                  },

                  onOk: async () => {
                    await handleDelete(item.id);
                  },
                });
              }}
            >
              <span
                onClick={(event) => {
                  event.stopPropagation();

                  openEdit(item);
                }}
                style={{
                  cursor: "pointer",
                }}
              >
                {item.diagnosis_pattern}
              </span>
            </Tag>
          ))}
        </div>
      ),
    },

    {
      title: "Kiểu so khớp",

      key: "matchType",

      width: 150,

      render: (
        _: unknown,

        record: GroupedServiceDiagnosis,
      ) => {
        const values = Array.from(new Set(record.rows.map((item) => item.match_type)));

        return (
          <Space wrap size={[4, 4]}>
            {values.map((value) => (
              <Tag key={value} className="service-match-tag">
                {getMatchLabel(value)}
              </Tag>
            ))}
          </Space>
        );
      },
    },

    {
      title: "Hoạt động",

      key: "active",

      width: 110,

      align: "center",

      render: (
        _: unknown,

        record: GroupedServiceDiagnosis,
      ) => {
        const activeCount = record.rows.filter((item) => item.active).length;

        return (
          <Tag
            color={activeCount === record.rows.length ? "success" : "warning"}
            className="service-status-tag"
          >
            {activeCount}/{record.rows.length}
          </Tag>
        );
      },
    },
  ];

  return (
    <div className="service-diagnosis-page">
      <div className="service-breadcrumb">
        <Breadcrumb
          items={[
            {
              title: (
                <HomeOutlined
                  onClick={() => navigate("/")}
                  style={{
                    cursor: "pointer",
                  }}
                />
              ),
            },

            {
              title: (
                <span
                  onClick={() => navigate("/catalog")}
                  style={{
                    cursor: "pointer",
                  }}
                >
                  Danh mục
                </span>
              ),
            },

            {
              title: "DVKT - Chẩn đoán vào",
            },
          ]}
        />
      </div>

      <div className="service-page-header">
        <div>
          <Title
            level={3}
            style={{
              margin: 0,

              color: "#172033",

              fontWeight: 800,
            }}
          >
            <SafetyCertificateOutlined
              style={{
                marginRight: 9,

                color: "#1677ff",
              }}
            />
            DVKT - Chẩn đoán vào
          </Title>

          <Text
            type="secondary"
            style={{
              display: "block",

              marginTop: 4,
            }}
          >
            Quản lý chẩn đoán phù hợp theo từng dịch vụ kỹ thuật
          </Text>
        </div>

        <Space size={8}>
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => void loadData()}
            className="service-header-button"
          >
            Làm mới
          </Button>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            className="service-header-button service-add-button"
          >
            Thêm mới
          </Button>
        </Space>
      </div>

      <div className="service-filter-block">
        <div className="service-filter-label">DVKT</div>

        <div className="service-filter-row">
          <Select
            showSearch
            allowClear
            value={selectedServiceCode}
            placeholder="Chọn DVKT"
            optionFilterProp="label"
            options={serviceOptions}
            className="service-filter-select"
            onChange={(value) => setSelectedServiceCode(value)}
          />

          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => {
              setSelectedServiceCode(undefined);

              void loadData();
            }}
            className="service-filter-refresh"
          >
            Làm mới
          </Button>
        </div>
      </div>

      <Card
        className="service-table-card"
        styles={{
          body: {
            padding: 0,
          },
        }}
      >
        <Table<GroupedServiceDiagnosis>
          rowKey="serviceCode"
          loading={loading}
          dataSource={groupedRows}
          columns={columns}
          size="middle"
          pagination={{
            pageSize: 10,

            showSizeChanger: true,

            pageSizeOptions: ["10", "20", "50"],

            showTotal: (total) => `Tổng số: ${total}`,
          }}
          locale={{
            emptyText: "Chưa có dữ liệu",
          }}
        />
      </Card>

      <Modal
        open={modalOpen}
        className="service-diagnosis-modal"
        title={
          <div>
            <div className="service-modal-title">
              {editing ? "Cập nhật chẩn đoán vào" : "Thêm chẩn đoán vào"}
            </div>

            <div className="service-modal-description">Thiết lập điều kiện phù hợp cho DVKT</div>
          </div>
        }
        width={620}
        okText={editing ? "Cập nhật" : "Thêm mới"}
        cancelText="Hủy"
        confirmLoading={saving}
        onOk={() => void handleSave()}
        onCancel={() => {
          if (saving) {
            return;
          }

          setModalOpen(false);

          setEditing(null);

          form.resetFields();
        }}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          style={{
            marginTop: 18,
          }}
        >
          <Form.Item
            name="service_code"
            label="Mã DVKT"
            rules={[
              {
                required: true,

                message: "Vui lòng nhập mã DVKT.",
              },
            ]}
          >
            <Input placeholder="Ví dụ: 21.0014.1778" />
          </Form.Item>

          <Form.Item
            name="diagnosis_pattern"
            label="Chẩn đoán vào"
            rules={[
              {
                required: true,

                message: "Vui lòng nhập chẩn đoán vào.",
              },
            ]}
          >
            <Input placeholder="Ví dụ: đau ngực" />
          </Form.Item>

          <Form.Item
            name="match_type"
            label="Kiểu so khớp"
            rules={[
              {
                required: true,

                message: "Vui lòng chọn kiểu so khớp.",
              },
            ]}
          >
            <Select options={MATCH_OPTIONS} />
          </Form.Item>

          {/* <Form.Item
            name="active"

            label="Hoạt động"

            valuePropName="checked"
          >
            <Switch
              checkedChildren="Bật"

              unCheckedChildren="Tắt"
            />
          </Form.Item> */}

          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={3} placeholder="Ghi chú nếu có" />
          </Form.Item>
        </Form>
      </Modal>

      <style>
        {`
          .service-diagnosis-page {
            display: flex;
            flex-direction: column;
            gap: 15px;
          }

          .service-breadcrumb {
            margin-bottom: -2px;
          }

          .service-page-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }

          .service-header-button {
            height: 36px;
            border-radius: 8px;
            font-weight: 600;
          }

          .service-add-button {
            box-shadow:
              0
              4px
              12px
              rgba(
                22,
                119,
                255,
                0.20
              );
          }

          .service-filter-block {
            padding:
              2px
              0
              3px;
          }

          .service-filter-label {
            margin-bottom: 6px;
            color: #172033;
            font-size: 13px;
            font-weight: 700;
          }

          .service-filter-row {
            display: flex;
            align-items: center;
            gap: 9px;
          }

          .service-filter-select {
            width: 310px;
          }

          .service-filter-refresh {
            height: 34px;
            min-width: 105px;
            border-radius: 7px;
            font-weight: 600;
          }

          .service-table-card {
            overflow: hidden;
            border:
              1px solid
              #dfe6ee;
            border-radius: 8px;
            box-shadow:
              0
              2px
              8px
              rgba(
                15,
                23,
                42,
                0.03
              );
          }

          .service-table-card
          .ant-table-thead
          > tr
          > th {
            background:
              #f2f5f8 !important;

            color:
              #334155 !important;

            font-size: 12px;

            font-weight:
              700 !important;

            border-bottom:
              1px solid
              #d8e0e8 !important;
          }

          .service-table-card
          .ant-table-tbody
          > tr
          > td {
            padding:
              11px
              12px !important;

            color:
              #334155;

            font-size:
              12px;

            vertical-align:
              middle;
          }

          .service-table-card
          .ant-table-tbody
          > tr:hover
          > td {
            background:
              #f7fbff !important;
          }

        .service-diagnosis-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.service-diagnosis-tag {
  display: inline-flex;
  align-items: center;

  margin: 0;

  padding:
    3px
    7px
    3px
    9px;

  border-radius:
    999px;

  font-size:
    11px;

  font-weight:
    600;

  cursor:
    pointer;

  transition:
    all
    0.18s
    ease;
}

.service-diagnosis-tag:hover {
  transform:
    translateY(
      -1px
    );

  box-shadow:
    0
    3px
    8px
    rgba(
      22,
      119,
      255,
      0.18
    );
}

.service-diagnosis-tag
.ant-tag-close-icon {
  margin-left:
    5px;

  font-size:
    10px;

  opacity:
    0.7;
}

.service-diagnosis-tag:hover
.ant-tag-close-icon {
  opacity:
    1;
}

.service-match-tag {
  margin: 0;

  padding:
    2px
    8px;

  border-radius:
    999px;

  color:
    #475569;

  background:
    #f8fafc;

  border:
    1px solid
    #e2e8f0;

  font-size:
    11px;

  font-weight:
    600;
}

.service-status-tag {
  min-width:
    46px;

  margin:
    0;

  text-align:
    center;

  border-radius:
    999px;

  font-size:
    11px;

  font-weight:
    700;
}

          .service-match-tag {
            margin: 0;

            border-radius:
              999px;

            font-size:
              11px;
          }






          .service-table-card
          .ant-pagination {
            padding:
              0
              12px
              10px;
          }

          .service-diagnosis-modal
          .ant-modal-content {
            border-radius:
              14px;

            overflow:
              hidden;
          }

          .service-modal-title {
            color:
              #172033;

            font-size:
              18px;

            font-weight:
              800;
          }

          .service-modal-description {
            margin-top:
              3px;

            color:
              #64748b;

            font-size:
              12px;
          }

          @media
          (
            max-width:
              700px
          ) {
            .service-page-header {
              flex-direction:
                column;
            }

            .service-filter-row {
              align-items:
                stretch;

              flex-direction:
                column;
            }

            .service-filter-select {
              width:
                100%;
            }
          }
        `}
      </style>
    </div>
  );
}
