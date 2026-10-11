import {
  Breadcrumb,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";

import type {
  TableColumnsType,
} from "antd";

import {
  EditOutlined,
  HomeOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  apiFetch,
} from "../../api/apiClient";


const {
  Title,
  Text,
} = Typography;


// ======================================================
// TYPES
// ======================================================

interface ExaminationServiceItem {
  id: string;

  code: string;

  name: string;

  unitPrice: number;

  note:
    | string
    | null;

  active: boolean;

  createdAt?: string;

  updatedAt?: string;
}


interface ExaminationServiceFormValues {
  code: string;

  name: string;

  unitPrice: number;

  note?: string;

  active: boolean;
}


interface ExaminationServiceListResponse {
  success?: boolean;

  message?: string;

  data?: {
    items:
      ExaminationServiceItem[];

    total:
      number;

    page:
      number;

    pageSize:
      number;
  };
}


// ======================================================
// COMPONENT
// ======================================================

export default function ExaminationServices() {

  // ====================================================
  // FILTERS
  // ====================================================

  const [
    searchCode,
    setSearchCode,
  ] = useState(
    ""
  );


  const [
    searchName,
    setSearchName,
  ] = useState(
    ""
  );


  // ====================================================
  // DATA
  // ====================================================

  const [
    items,
    setItems,
  ] = useState<
    ExaminationServiceItem[]
  >(
    []
  );


  const [
    total,
    setTotal,
  ] = useState(
    0
  );


  const [
    page,
    setPage,
  ] = useState(
    1
  );


  const [
    pageSize,
    setPageSize,
  ] = useState(
    10
  );


  const [
    loading,
    setLoading,
  ] = useState(
    false
  );


  // ====================================================
  // FORM
  // ====================================================

  const [
    saving,
    setSaving,
  ] = useState(
    false
  );


  const [
    modalOpen,
    setModalOpen,
  ] = useState(
    false
  );


  const [
    editingItem,
    setEditingItem,
  ] = useState<
    ExaminationServiceItem |
    null
  >(
    null
  );


  const [
    form,
  ] =
    Form.useForm<
      ExaminationServiceFormValues
    >();


  // ====================================================
  // LOAD DATA
  // ====================================================

  const loadData =
    useCallback(
      async () => {

        try {

          setLoading(
            true
          );


          const params =
            new URLSearchParams({
              page:
                String(
                  page
                ),

              pageSize:
                String(
                  pageSize
                ),
            });


          if (
            searchCode.trim()
          ) {

            params.set(
              "code",
              searchCode.trim()
            );
          }


          if (
            searchName.trim()
          ) {

            params.set(
              "name",
              searchName.trim()
            );
          }


          const response =
            await apiFetch(
              `/catalog/examination-services?${params.toString()}`,
              {
                method:
                  "GET",
              }
            );


          const json:
            ExaminationServiceListResponse =
            await response.json();


          if (
            !response.ok ||
            json.success !==
              true
          ) {

            throw new Error(
              json.message ||
              "Không thể tải danh mục công khám."
            );
          }


          setItems(
            json.data
              ?.items ??
            []
          );


          setTotal(
            Number(
              json.data
                ?.total ??
              0
            )
          );

        } catch (
          error
        ) {

          message.error(
            error instanceof
            Error
              ? error.message
              : "Không thể tải danh mục công khám."
          );

        } finally {

          setLoading(
            false
          );
        }
      },
      [
        page,
        pageSize,
        searchCode,
        searchName,
      ]
    );


  useEffect(
    () => {

      void loadData();

    },
    [
      loadData,
    ]
  );


  // ====================================================
  // ADD
  // ====================================================

  function openAddModal() {

    setEditingItem(
      null
    );


    form.resetFields();


    form.setFieldsValue({
      code:
        "",

      name:
        "",

      unitPrice:
        0,

      note:
        "",

      active:
        true,
    });


    setModalOpen(
      true
    );
  }


  // ====================================================
  // EDIT
  // ====================================================

  async function openEditModal(
    record:
      ExaminationServiceItem
  ) {

    try {

      const response =
        await apiFetch(
          `/catalog/examination-services/${encodeURIComponent(
            record.code
          )}`,
          {
            method:
              "GET",
          }
        );


      const json =
        await response.json();


      if (
        !response.ok ||
        json.success !==
          true
      ) {

        throw new Error(
          json.message ||
          "Không thể tải công khám."
        );
      }


      const data =
        json.data;


      setEditingItem(
        data
      );


      form.setFieldsValue({
        code:
          data.code,

        name:
          data.name,

        unitPrice:
          Number(
            data.unitPrice ??
            0
          ),

        note:
          data.note ??
          "",

        active:
          Boolean(
            data.active
          ),
      });


      setModalOpen(
        true
      );

    } catch (
      error
    ) {

      message.error(
        error instanceof
        Error
          ? error.message
          : "Không thể tải công khám."
      );
    }
  }


  // ====================================================
  // SAVE
  // ====================================================

  async function handleSave() {

    try {

      const values =
        await form.validateFields();


      setSaving(
        true
      );


      const isEdit =
        editingItem !==
        null;


      const endpoint =
        isEdit
          ? `/catalog/examination-services/${encodeURIComponent(
              editingItem.code
            )}`
          : "/catalog/examination-services";


      const response =
        await apiFetch(
          endpoint,
          {
            method:
              isEdit
                ? "PUT"
                : "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                code:
                  values.code.trim(),

                name:
                  values.name.trim(),

                unitPrice:
                  Number(
                    values.unitPrice ??
                    0
                  ),

                note:
                  values.note
                    ?.trim() ||
                  null,

                active:
                  values.active,
              }),
          }
        );


      const json =
        await response.json();


      if (
        !response.ok ||
        json.success !==
          true
      ) {

        throw new Error(
          json.message ||
          "Không thể lưu công khám."
        );
      }


      message.success(
        isEdit
          ? "Cập nhật công khám thành công."
          : "Thêm công khám thành công."
      );


      setModalOpen(
        false
      );


      setEditingItem(
        null
      );


      form.resetFields();


      await loadData();

    } catch (
      error
    ) {

      if (
        error &&
        typeof error ===
          "object" &&
        "errorFields" in
          error
      ) {

        return;
      }


      message.error(
        error instanceof
        Error
          ? error.message
          : "Không thể lưu công khám."
      );

    } finally {

      setSaving(
        false
      );
    }
  }


  // ====================================================
  // DISABLE
  // ====================================================

  function confirmDisable(
    record:
      ExaminationServiceItem
  ) {

    Modal.confirm({
      title:
        "Ngừng sử dụng công khám?",

      content:
        `${record.code} - ${record.name}`,

      okText:
        "Đồng ý",

      cancelText:
        "Hủy",

      okButtonProps: {
        danger:
          true,
      },

      onOk:
        async () => {

          try {

            const response =
              await apiFetch(
                `/catalog/examination-services/${encodeURIComponent(
                  record.code
                )}`,
                {
                  method:
                    "DELETE",
                }
              );


            const json =
              await response.json();


            if (
              !response.ok ||
              json.success !==
                true
            ) {

              throw new Error(
                json.message ||
                "Không thể ngừng sử dụng công khám."
              );
            }


            message.success(
              "Đã ngừng sử dụng công khám."
            );


            await loadData();

          } catch (
            error
          ) {

            message.error(
              error instanceof
              Error
                ? error.message
                : "Không thể ngừng sử dụng công khám."
            );
          }
        },
    });
  }


  // ====================================================
  // REFRESH
  // ====================================================

  function handleRefresh() {

    setSearchCode(
      ""
    );


    setSearchName(
      ""
    );


    setPage(
      1
    );
  }


  // ====================================================
  // TABLE COLUMNS
  // ====================================================

  const columns:
    TableColumnsType<
      ExaminationServiceItem
    > = [

    {
      title:
        "STT",

      key:
        "stt",

      width:
        70,

      align:
        "center",

      render:
        (
          _,
          __,
          index
        ) =>
          (
            page -
            1
          ) *
            pageSize +
          index +
          1,
    },


    {
      title:
        "ID",

      dataIndex:
        "id",

      key:
        "id",

      width:
        80,

      align:
        "center",
    },


    {
      title:
        "Mã công khám",

      dataIndex:
        "code",

      key:
        "code",

      width:
        180,

      render:
        (
          value:
            string
        ) => (
          <Text
            strong
          >
            {
              value ||
              "-"
            }
          </Text>
        ),
    },


    {
      title:
        "Tên công khám",

      dataIndex:
        "name",

      key:
        "name",

      width:
        340,

      ellipsis:
        true,

      render:
        (
          value:
            string
        ) =>
          value ||
          "-",
    },


    {
      title:
        "Đơn giá",

      dataIndex:
        "unitPrice",

      key:
        "unitPrice",

      width:
        150,

      align:
        "right",

      render:
        (
          value:
            number
        ) =>
          Number(
            value ??
            0
          ).toLocaleString(
            "vi-VN"
          ),
    },


    {
      title:
        "Ghi chú",

      dataIndex:
        "note",

      key:
        "note",

      width:
        280,

      ellipsis:
        true,

      render:
        (
          value:
            string |
            null
        ) => {

        const text =
          value ||
          "-";


        if (
          text ===
          "-"
        ) {

          return "-";
        }


        return (
          <Tooltip
            title={
              text
            }
          >
            <Text
              ellipsis
            >
              {
                text
              }
            </Text>
          </Tooltip>
        );
      },
    },


    {
      title:
        "Trạng thái",

      dataIndex:
        "active",

      key:
        "active",

      width:
        115,

      align:
        "center",

      render:
        (
          value:
            boolean
        ) =>
          value
            ? (
              <Tag
                color="success"

                className="examination-status"
              >
                Đang dùng
              </Tag>
            )
            : (
              <Tag
                className="examination-status"
              >
                Ngừng dùng
              </Tag>
            ),
    },


    {
      title:
        "Thao tác",

      key:
        "actions",

      width:
        105,

      align:
        "center",

      render:
        (
          _,
          record
        ) => (

          <Space
            size={
              10
            }
          >

            <Tooltip
              title="Cập nhật"
            >

              <Button
                type="text"

                size="small"

                icon={
                  <EditOutlined
                    style={{
                      color:
                        "#1677ff",
                    }}
                  />
                }

                onClick={() =>
                  void openEditModal(
                    record
                  )
                }
              />

            </Tooltip>


            <Tooltip
              title={
                record.active
                  ? "Ngừng sử dụng"
                  : "Đã ngừng sử dụng"
              }
            >

              <Button
                type="text"

                size="small"

                disabled={
                  !record.active
                }

                icon={
                  <StopOutlined
                    style={{
                      color:
                        record.active
                          ? "#ff4d4f"
                          : "#bfbfbf",
                    }}
                  />
                }

                onClick={() =>
                  confirmDisable(
                    record
                  )
                }
              />

            </Tooltip>

          </Space>
        ),
    },
  ];


  // ====================================================
  // UI
  // ====================================================

  return (
    <>

      <div
        className="examination-page"
      >

        {/* =================================================
            BREADCRUMB
        ================================================= */}

        <Breadcrumb
          className="examination-breadcrumb"

          items={[
            {
              title: (
                <HomeOutlined />
              ),
            },

            {
              title:
                "Danh mục",
            },

            {
              title:
                "Công khám",
            },
          ]}
        />


        {/* =================================================
            HEADER
        ================================================= */}

        <div
          className="examination-header"
        >

          <div>

            <div
              className="examination-title-row"
            >

              <MedicineBoxOutlined
                className="examination-title-icon"
              />


              <Title
                level={
                  3
                }

                style={{
                  margin:
                    0,
                }}
              >
                Công khám
              </Title>

            </div>


            <Text
              type="secondary"

              className="examination-subtitle"
            >
              Quản lý danh mục công khám và đơn giá khám bệnh
            </Text>

          </div>


          <Button
            type="primary"

            icon={
              <PlusOutlined />
            }

            onClick={
              openAddModal
            }
          >
            Thêm mới
          </Button>

        </div>


        {/* =================================================
            FILTER
        ================================================= */}

        <div
          className="examination-filter-grid"
        >

          <div
            className="examination-filter-item"
          >

            <Text
              strong

              className="examination-filter-label"
            >
              Mã công khám
            </Text>


            <Input
              value={
                searchCode
              }

              placeholder="Nhập mã công khám"

              allowClear

              onChange={(
                event
              ) => {

                setSearchCode(
                  event.target.value
                );


                setPage(
                  1
                );
              }}
            />

          </div>


          <div
            className="examination-filter-item"
          >

            <Text
              strong

              className="examination-filter-label"
            >
              Tên công khám
            </Text>


            <Input
              value={
                searchName
              }

              placeholder="Nhập tên công khám"

              allowClear

              onChange={(
                event
              ) => {

                setSearchName(
                  event.target.value
                );


                setPage(
                  1
                );
              }}
            />

          </div>


          <Button
            type="primary"

            icon={
              <ReloadOutlined />
            }

            onClick={
              handleRefresh
            }
          >
            Làm mới
          </Button>

        </div>


        {/* =================================================
            TABLE
        ================================================= */}

        <Table<ExaminationServiceItem>
          className="examination-table"

          rowKey="id"

          size="middle"

          tableLayout="fixed"

          loading={
            loading
          }

          dataSource={
            items
          }

          columns={
            columns
          }

          scroll={{
            x:
              1250,
          }}

          pagination={{
            current:
              page,

            pageSize,

            total,

            showSizeChanger:
              true,

            pageSizeOptions: [
              "10",
              "50",
              "100",
            ],

            showTotal:
              (
                value
              ) =>
                `Tổng số: ${value}`,

            onChange:
              (
                newPage,
                newPageSize
              ) => {

                if (
                  newPageSize !==
                  pageSize
                ) {

                  setPageSize(
                    newPageSize
                  );


                  setPage(
                    1
                  );


                  return;
                }


                setPage(
                  newPage
                );
              },
          }}

          locale={{
            emptyText:
              "Chưa có dữ liệu công khám",
          }}
        />

      </div>


      {/* =================================================
          ADD / EDIT
      ================================================= */}

      <Modal
        open={
          modalOpen
        }

        title={
          editingItem
            ? "Cập nhật Công khám"
            : "Thêm Công khám"
        }

        width={
          720
        }

        okText={
          editingItem
            ? "Cập nhật"
            : "Thêm mới"
        }

        cancelText="Hủy"

        confirmLoading={
          saving
        }

        onOk={() =>
          void handleSave()
        }

        onCancel={() => {

          if (
            saving
          ) {

            return;
          }


          setModalOpen(
            false
          );


          setEditingItem(
            null
          );


          form.resetFields();
        }}
      >

        <Form
          form={
            form
          }

          layout="vertical"

          requiredMark={
            false
          }

          className="examination-form"
        >

          <div
            className="examination-form-grid"
          >

            <Form.Item
              label="Mã công khám"

              name="code"

              rules={[
                {
                  required:
                    true,

                  whitespace:
                    true,

                  message:
                    "Vui lòng nhập mã công khám.",
                },
              ]}
            >

              <Input
                placeholder="Ví dụ: 02.03"

                disabled={
                  editingItem !==
                  null
                }
              />

            </Form.Item>


            <Form.Item
              label="Đơn giá"

              name="unitPrice"

              rules={[
                {
                  required:
                    true,

                  message:
                    "Vui lòng nhập đơn giá.",
                },

                {
                  type:
                    "number",

                  min:
                    0,

                  message:
                    "Đơn giá không hợp lệ.",
                },
              ]}
            >

              <InputNumber<number>
                min={
                  0
                }

                style={{
                  width:
                    "100%",
                }}

                placeholder="36500"

                formatter={(
                  value
                ) => {

                  if (
                    value ===
                      undefined ||
                    value ===
                      null
                  ) {

                    return "";
                  }


                  return Number(
                    value
                  ).toLocaleString(
                    "vi-VN"
                  );
                }}

                parser={(
                  value
                ) => {

                  const text =
                    String(
                      value ??
                      ""
                    )
                      .replace(
                        /\./g,
                        ""
                      )
                      .replace(
                        /,/g,
                        ""
                      )
                      .trim();


                  if (
                    !text
                  ) {

                    return 0;
                  }


                  const parsed =
                    Number(
                      text
                    );


                  return Number.isFinite(
                    parsed
                  )
                    ? parsed
                    : 0;
                }}
              />

            </Form.Item>

          </div>


          <Form.Item
            label="Tên công khám"

            name="name"

            rules={[
              {
                required:
                  true,

                whitespace:
                  true,

                message:
                  "Vui lòng nhập tên công khám.",
              },
            ]}
          >

            <Input
              placeholder="Ví dụ: Khám Nội tổng hợp"
            />

          </Form.Item>


          <Form.Item
            label="Ghi chú"

            name="note"
          >

            <Input.TextArea
              rows={
                3
              }

              placeholder="Ghi chú nếu có"
            />

          </Form.Item>


          <Form.Item
            label="Đang sử dụng"

            name="active"

            valuePropName="checked"
          >

            <Switch
              checkedChildren="Đang dùng"

              unCheckedChildren="Ngừng dùng"
            />

          </Form.Item>

        </Form>

      </Modal>


      {/* =================================================
          STYLE
      ================================================= */}

      <style>
        {`
          .examination-page {
            width: 100%;
          }

          .examination-breadcrumb {
            margin-bottom: 14px;
            font-size: 12px;
          }

          .examination-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 16px;
          }

          .examination-title-row {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .examination-title-row h3 {
            margin: 0 !important;
            color: #172033 !important;
            font-size: 22px !important;
            font-weight: 800 !important;
          }

          .examination-title-icon {
            color: #1677ff;
            font-size: 25px;
          }

          .examination-subtitle {
            display: block;
            margin-top: 3px;
            font-size: 12px;
          }

          .examination-filter-grid {
            display: grid;
            grid-template-columns:
              minmax(260px, 1fr)
              minmax(380px, 1.4fr)
              auto;
            gap: 10px;
            align-items: end;
            margin-bottom: 14px;
          }

          .examination-filter-item {
            min-width: 0;
          }

          .examination-filter-label {
            display: block;
            margin-bottom: 6px;
            color: #172033;
            font-size: 12px;
            font-weight: 700;
          }

          .examination-table {
            overflow: hidden;
            border: 1px solid #e6ebf1;
            border-radius: 8px;
          }

          .examination-table
          .ant-table {
            border-radius: 8px;
          }

          .examination-table
          .ant-table-thead
          > tr
          > th {
            padding: 11px 10px !important;
            color: #172033;
            font-size: 12px;
            font-weight: 700;
            background: #f3f6f9 !important;
            border-bottom: 1px solid #e5eaf0 !important;
          }

          .examination-table
          .ant-table-tbody
          > tr
          > td {
            padding: 13px 10px !important;
            color: #202a3b;
            font-size: 12px;
            vertical-align: middle;
            border-bottom: 1px solid #edf0f5 !important;
          }

          .examination-table
          .ant-table-tbody
          > tr:hover
          > td {
            background: #f7fbff !important;
          }

          .examination-table
          .ant-pagination {
            margin: 14px 8px 6px;
          }

          .examination-status {
            margin: 0;
            border-radius: 6px;
            font-size: 11px;
          }

          .examination-form {
            margin-top: 18px;
          }

          .examination-form-grid {
            display: grid;
            grid-template-columns:
              1fr 1fr;
            gap: 16px;
          }

          @media (max-width: 800px) {
            .examination-header {
              flex-direction: column;
            }

            .examination-filter-grid,
            .examination-form-grid {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>

    </>
  );
}