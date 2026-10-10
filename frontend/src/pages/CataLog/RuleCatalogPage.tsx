import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";

import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  ColumnsType,
} from "antd/es/table";


import {
  apiFetch,
} from "../../api/apiClient";

const {
  Title,
  Text,
} = Typography;

export interface FieldConfig {
  name: string;
  label: string;
  type?:
    | "text"
    | "select"
    | "switch";
  options?: {
    label: string;
    value: string;
  }[];
  required?: boolean;
}

interface Props {
  title: string;
  type: string;
  fields: FieldConfig[];
}

// const API =
//   "http://localhost:3000/api";

export default function RuleCatalogPage({
  title,
  type,
  fields,
}: Props) {
  const [
    data,
    setData,
  ] = useState<any[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    editing,
    setEditing,
  ] = useState<any>(
    null
  );

  const [
    keyword,
    setKeyword,
  ] = useState("");

  const [
    form,
  ] = Form.useForm();

  async function loadData() {
    try {
      setLoading(true);

    const response =
  await apiFetch(
    `/catalog/${type}`,
    {
      method: "GET",
    }
  );
      const json =
        await response.json();

      if (!json.success) {
        throw new Error(
          json.message
        );
      }

      setData(
        Array.isArray(
          json.data
        )
          ? json.data
          : []
      );
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : "Không thể tải dữ liệu."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [type]);

  function openCreate() {
    setEditing(null);

    form.resetFields();

    const defaultValues:
      Record<
        string,
        unknown
      > = {
      active: true,
    };

    const matchTypeField =
      fields.find(
        (field) =>
          field.name ===
          "match_type"
      );

    if (
      matchTypeField
    ) {
      defaultValues.match_type =
        matchTypeField
          .options?.[0]
          ?.value ??
        "CONTAINS";
    }

    form.setFieldsValue(
      defaultValues
    );

    setOpen(true);
  }

  function openEdit(
    record: any
  ) {
    setEditing(
      record
    );

    form.setFieldsValue({
      ...record,
      active:
        !!record.active,
    });

    setOpen(true);
  }

  async function save() {
    try {
      const values =
        await form.validateFields();

      const url =
  editing
    ? `/catalog/${type}/${editing.id}`
    : `/catalog/${type}`;

const response =
  await apiFetch(
    url,
    {
      method:
        editing
          ? "PUT"
          : "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify(
          values
        ),
    }
  );

      const json =
        await response.json();

      if (!json.success) {
        throw new Error(
          json.message
        );
      }

      message.success(
        editing
          ? "Đã cập nhật cấu hình."
          : "Đã thêm mới cấu hình."
      );

      setOpen(false);

      await loadData();
    } catch (error) {
      if (
        error instanceof Error
      ) {
        message.error(
          error.message
        );
      }
    }
  }

  async function remove(
    id: string
  ) {
    try {
      const response =
  await apiFetch(
    `/catalog/${type}/${id}`,
    {
      method:
        "DELETE",
    }
  );  

      const json =
        await response.json();

      if (!json.success) {
        throw new Error(
          json.message
        );
      }

      message.success(
        "Đã xóa cấu hình."
      );

      await loadData();
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : "Không thể xóa."
      );
    }
  }

  const filteredData =
    useMemo(() => {
      const search =
        keyword
          .trim()
          .toLowerCase();

      if (!search) {
        return data;
      }

      return data.filter(
        (record) =>
          fields.some(
            (field) => {
              const rawValue =
                record[
                  field.name
                ];

              if (
                rawValue ===
                  undefined ||
                rawValue ===
                  null
              ) {
                return false;
              }

              const optionLabel =
                field.options?.find(
                  (
                    option
                  ) =>
                    option.value ===
                    String(
                      rawValue
                    )
                )?.label ?? "";

              const text =
                `${String(
                  rawValue
                )} ${optionLabel}`
                  .toLowerCase();

              return text.includes(
                search
              );
            }
          )
      );
    }, [
      data,
      keyword,
      fields,
    ]);

  const columns:
    ColumnsType<any> =
    fields.map(
      (field) => ({
        title: (
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color:
                "#334155",
            }}
          >
            {
              field.label
            }
          </span>
        ),
        dataIndex:
          field.name,
        key:
          field.name,
        ellipsis: true,
        render: (
          value: unknown
        ) => {
          if (
            field.type ===
            "switch"
          ) {
            return (
              <Tag
                color={
                  value
                    ? "green"
                    : "default"
                }
                style={{
                  borderRadius: 999,
                  padding:
                    "2px 10px",
                  fontWeight: 600,
                }}
              >
                {value
                  ? "Hoạt động"
                  : "Tắt"}
              </Tag>
            );
          }

          if (
            field.type ===
              "select" &&
            field.options
          ) {
            const option =
              field.options.find(
                (
                  item
                ) =>
                  item.value ===
                  String(
                    value ?? ""
                  )
              );

            return (
              <span
                style={{
                  color:
                    "#475569",
                }}
              >
                {option?.label ??
                  String(
                    value ?? ""
                  )}
              </span>
            );
          }

          return (
            <span
              style={{
                color:
                  "#0f172a",
              }}
            >
              {String(
                value ?? ""
              )}
            </span>
          );
        },
      })
    );

  columns.push({
    title: (
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color:
            "#334155",
        }}
      >
        Thao tác
      </span>
    ),
    dataIndex:
      "__action",
    key:
      "__action",
    width: 110,
    align: "center",
    render:
      (
        _: unknown,
        record: any
      ) => (
        <Space
          size={4}
        >
          <Button
            type="text"
            icon={
              <EditOutlined />
            }
            style={{
              color:
                "#1677ff",
            }}
            onClick={() =>
              openEdit(
                record
              )
            }
          />

          <Popconfirm
            title="Xóa cấu hình này?"
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() =>
              remove(
                record.id
              )
            }
          >
            <Button
              type="text"
              danger
              icon={
                <DeleteOutlined />
              }
            />
          </Popconfirm>
        </Space>
      ),
  });

  return (
    <>
      <div
        style={{
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "flex-start",
            gap: 16,
            flexWrap:
              "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                color:
                  "#64748b",
                marginBottom: 10,
              }}
            >
              Danh mục / Quy luật kiểm tra
            </div>

            <Space
              align="start"
              size={12}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background:
                    "#eff6ff",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  color:
                    "#1677ff",
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                <SafetyCertificateOutlined />
              </div>

              <div>
                <Title
                  level={3}
                  style={{
                    margin: 0,
                    color:
                      "#0f172a",
                  }}
                >
                  {title}
                </Title>

                <Text
                  style={{
                    fontSize: 14,
                    color:
                      "#64748b",
                  }}
                >
                  Quản lý cấu hình quy luật dùng để đối chiếu hồ sơ BHYT
                </Text>
              </div>
            </Space>
          </div>

          <Space
            wrap
          >
            <Button
              icon={
                <ReloadOutlined />
              }
              onClick={
                loadData
              }
              style={{
                height: 40,
                borderRadius: 10,
                fontWeight: 600,
              }}
            >
              Làm mới
            </Button>

            <Button
              type="primary"
              icon={
                <PlusOutlined />
              }
              onClick={
                openCreate
              }
              style={{
                height: 40,
                borderRadius: 10,
                fontWeight: 600,
                boxShadow:
                  "0 8px 20px rgba(22,119,255,0.22)",
              }}
            >
              Thêm mới
            </Button>
          </Space>
        </div>
      </div>

      <div
        style={{
          background:
            "#ffffff",
          border:
            "1px solid #eef2f7",
          borderRadius: 16,
          overflow:
            "hidden",
          boxShadow:
            "0 8px 24px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div
          style={{
            padding:
              "18px 20px 14px",
            borderBottom:
              "1px solid #f1f5f9",
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: 12,
            flexWrap:
              "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color:
                  "#0f172a",
              }}
            >
              Danh sách cấu hình
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                color:
                  "#94a3b8",
              }}
            >
              {filteredData.length} cấu hình
              {keyword
                ? " phù hợp bộ lọc"
                : ""}
            </div>
          </div>

          <Input
            allowClear
            value={
              keyword
            }
            onChange={(
              e
            ) =>
              setKeyword(
                e.target
                  .value
              )
            }
            prefix={
              <SearchOutlined />
            }
            placeholder="Tìm theo mã DVKT, chẩn đoán, ghi chú..."
            style={{
              width: 320,
              maxWidth:
                "100%",
              borderRadius: 10,
              height: 40,
            }}
          />
        </div>

        <Table
          rowKey="id"
          loading={
            loading
          }
          dataSource={
            filteredData
          }
          columns={
            columns
          }
          size="middle"
          scroll={{
            x: "max-content",
          }}
          locale={{
            emptyText:
              "Chưa có dữ liệu",
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger:
              true,
            pageSizeOptions:
              [
                "10",
                "20",
                "50",
              ],
            showTotal:
              (
                total
              ) =>
                `Tổng số: ${total}`,
          }}
        />
      </div>

      <Modal
        title={
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color:
                "#0f172a",
            }}
          >
            {editing
              ? "Cập nhật cấu hình"
              : "Thêm mới cấu hình"}
          </span>
        }
        open={
          open
        }
        onCancel={() =>
          setOpen(false)
        }
        onOk={
          save
        }
        okText="Lưu"
        cancelText="Hủy"
        width={760}
        centered
        destroyOnClose
      >
        <Form
          layout="vertical"
          form={
            form
          }
          style={{
            marginTop: 16,
          }}
        >
          {fields.map(
            (
              field
            ) => (
              <Form.Item
                key={
                  field.name
                }
                name={
                  field.name
                }
                label={
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        "#334155",
                    }}
                  >
                    {
                      field.label
                    }
                  </span>
                }
                valuePropName={
                  field.type ===
                  "switch"
                    ? "checked"
                    : "value"
                }
                rules={
                  field.required
                    ? [
                        {
                          required:
                            true,
                          message:
                            `Vui lòng nhập ${field.label.toLowerCase()}`,
                        },
                      ]
                    : []
                }
              >
                {field.type ===
                "select" ? (
                  <Select
                    options={
                      field.options
                    }
                    placeholder={`Chọn ${field.label.toLowerCase()}`}
                    style={{
                      height: 42,
                    }}
                  />
                ) : field.type ===
                  "switch" ? (
                  <Switch />
                ) : (
                  <Input
                    placeholder={`Nhập ${field.label.toLowerCase()}`}
                    style={{
                      height: 42,
                      borderRadius: 10,
                    }}
                  />
                )}
              </Form.Item>
            )
          )}
        </Form>
      </Modal>
    </>
  );
}