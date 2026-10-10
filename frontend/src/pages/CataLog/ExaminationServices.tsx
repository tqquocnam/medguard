import {
  Button,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";

import {
  EllipsisOutlined,
  PlusOutlined,
  ReloadOutlined,
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
    string |
    null;

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

  const columns = [

    {
      title:
        "",

      key:
        "action",

      width:
        55,

      render:
        (
          _:
            unknown,

          record:
            ExaminationServiceItem
        ) => (

          <Dropdown
            trigger={[
              "click",
            ]}

            menu={{
              items: [
                {
                  key:
                    "edit",

                  label:
                    "Cập nhật",
                },

                {
                  key:
                    "disable",

                  label:
                    "Ngừng sử dụng",

                  danger:
                    true,

                  disabled:
                    !record.active,
                },
              ],

              onClick:
                ({
                  key,
                }) => {

                  if (
                    key ===
                    "edit"
                  ) {

                    void openEditModal(
                      record
                    );
                  }


                  if (
                    key ===
                    "disable"
                  ) {

                    confirmDisable(
                      record
                    );
                  }
                },
            }}
          >

            <Button
              type="text"

              icon={
                <EllipsisOutlined />
              }
            />

          </Dropdown>
        ),
    },


    {
      title:
        "ID",

      dataIndex:
        "id",

      width:
        90,

      align:
        "center" as const,
    },


    {
      title:
        "Mã công khám",

      dataIndex:
        "code",

      width:
        190,
    },


    {
      title:
        "Tên công khám",

      dataIndex:
        "name",

      width:
        350,
    },


    {
      title:
        "Đơn giá",

      dataIndex:
        "unitPrice",

      width:
        160,

      align:
        "right" as const,

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

      width:
        300,

      render:
        (
          value:
            string |
            null
        ) =>
          value ||
          "-",
    },


    {
      title:
        "Trạng thái",

      dataIndex:
        "active",

      width:
        130,

      align:
        "center" as const,

      render:
        (
          value:
            boolean
        ) =>
          value
            ? (
              <Tag
                color="success"
              >
                Đang dùng
              </Tag>
            )
            : (
              <Tag>
                Ngừng dùng
              </Tag>
            ),
    },
  ];


  // ====================================================
  // UI
  // ====================================================

  return (
    <>

      {/* HEADER */}

      <Space
        style={{
          width:
            "100%",

          justifyContent:
            "space-between",

          marginBottom:
            20,
        }}
      >

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

      </Space>


      {/* FILTER */}

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "1fr 1.4fr auto",

          gap:
            10,

          alignItems:
            "end",

          marginBottom:
            16,
        }}
      >

        <div>

          <Text>
            Mã công khám
          </Text>


          <Input
            value={
              searchCode
            }

            placeholder="Mã công khám"

            allowClear

            style={{
              marginTop:
                5,
            }}

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


        <div>

          <Text>
            Tên công khám
          </Text>


          <Input
            value={
              searchName
            }

            placeholder="Tên công khám"

            allowClear

            style={{
              marginTop:
                5,
            }}

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


      {/* TABLE */}

      <Table<ExaminationServiceItem>
        rowKey="id"

        bordered

        size="middle"

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
            1300,
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
      />


      {/* ADD / EDIT */}

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

          style={{
            marginTop:
              20,
          }}
        >

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr 1fr",

              gap:
                16,
            }}
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
  min={0}

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

            <Switch />

          </Form.Item>

        </Form>

      </Modal>

    </>
  );
}