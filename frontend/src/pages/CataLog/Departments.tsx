import {
  Button,
  Dropdown,
  Form,
  Input,
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

interface DepartmentItem {
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}


interface DepartmentFormValues {
  code: string;
  name: string;
  description?: string;
  active: boolean;
}


interface DepartmentListResponse {
  success?: boolean;

  message?: string;

  data?: {
    items: DepartmentItem[];
    total: number;
    page: number;
    pageSize: number;
  };
}


// ======================================================
// COMPONENT
// ======================================================

export default function Departments() {
  const [
    searchCode,
    setSearchCode,
  ] = useState("");

  const [
    searchName,
    setSearchName,
  ] = useState("");

  const [
    items,
    setItems,
  ] = useState<
    DepartmentItem[]
  >([]);

  const [
    total,
    setTotal,
  ] = useState(0);

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    pageSize,
    setPageSize,
  ] = useState(10);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    editingDepartment,
    setEditingDepartment,
  ] = useState<
    DepartmentItem |
    null
  >(null);

  const [
    form,
  ] =
    Form.useForm<
      DepartmentFormValues
    >();


  // ====================================================
  // LOAD
  // ====================================================

  const loadDepartments =
    useCallback(
      async () => {
        try {
          setLoading(true);

          const params =
            new URLSearchParams({
              page:
                String(page),

              pageSize:
                String(pageSize),
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
              `/catalog/departments?${params.toString()}`,
              {
                method:
                  "GET",
              }
            );


          const json:
            DepartmentListResponse =
            await response.json();


          if (
            !response.ok ||
            json.success !==
              true
          ) {
            throw new Error(
              json.message ||
              "Không thể tải danh mục khoa."
            );
          }


          setItems(
            json.data?.items ??
            []
          );


          setTotal(
            Number(
              json.data?.total ??
              0
            )
          );

        } catch (
          error
        ) {
          console.error(
            "Load departments error:",
            error
          );

          message.error(
            error instanceof
            Error
              ? error.message
              : "Không thể tải danh mục khoa."
          );

        } finally {
          setLoading(false);
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
      void loadDepartments();
    },
    [
      loadDepartments,
    ]
  );


  // ====================================================
  // ADD
  // ====================================================

  function openAddModal() {
    setEditingDepartment(
      null
    );

    form.resetFields();

    form.setFieldsValue({
      code: "",
      name: "",
      description: "",
      active: true,
    });

    setModalOpen(true);
  }


  // ====================================================
  // EDIT
  // ====================================================

  async function openEditModal(
    record:
      DepartmentItem
  ) {
    try {
      const response =
        await apiFetch(
          `/catalog/departments/${encodeURIComponent(
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
          "Không thể tải thông tin khoa."
        );
      }


      const data =
        json.data;


      setEditingDepartment(
        record
      );


      form.setFieldsValue({
        code:
          data.code,

        name:
          data.name,

        description:
          data.description ??
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
          : "Không thể tải khoa."
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


      setSaving(true);


      const isEdit =
        editingDepartment !==
        null;


      const endpoint =
        isEdit
          ? `/catalog/departments/${encodeURIComponent(
              editingDepartment.code
            )}`
          : "/catalog/departments";


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

                description:
                  values.description
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
          "Không thể lưu khoa."
        );
      }


      message.success(
        isEdit
          ? "Cập nhật khoa thành công."
          : "Thêm khoa thành công."
      );


      setModalOpen(
        false
      );

      setEditingDepartment(
        null
      );

      form.resetFields();


      await loadDepartments();

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
          : "Không thể lưu khoa."
      );

    } finally {
      setSaving(false);
    }
  }


  // ====================================================
  // DISABLE
  // ====================================================

  function confirmDisable(
    record:
      DepartmentItem
  ) {
    Modal.confirm({
      title:
        "Ngừng sử dụng khoa?",

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
                `/catalog/departments/${encodeURIComponent(
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
                "Không thể ngừng sử dụng khoa."
              );
            }


            message.success(
              "Đã ngừng sử dụng khoa."
            );


            await loadDepartments();

          } catch (
            error
          ) {
            message.error(
              error instanceof
              Error
                ? error.message
                : "Không thể ngừng sử dụng khoa."
            );
          }
        },
    });
  }


  // ====================================================
  // REFRESH
  // ====================================================

  function handleRefresh() {
    setSearchCode("");
    setSearchName("");
    setPage(1);
  }


  // ====================================================
  // TABLE
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
            DepartmentItem
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

                  danger:
                    true,

                  disabled:
                    !record.active,

                  label:
                    "Ngừng sử dụng",
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
        "Mã khoa",

      dataIndex:
        "code",

      width:
        180,
    },


    {
      title:
        "Tên khoa",

      dataIndex:
        "name",

      width:
        300,
    },


    {
      title:
        "Mô tả",

      dataIndex:
        "description",

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
        140,

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
          level={3}

          style={{
            margin:
              0,
          }}
        >
          Danh mục Khoa
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
            "1fr 1.5fr auto",

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
            Mã khoa
          </Text>

          <Input
            value={
              searchCode
            }

            placeholder="Mã khoa"

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
            Tên khoa
          </Text>

          <Input
            value={
              searchName
            }

            placeholder="Tên khoa"

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

      <Table<DepartmentItem>
        rowKey="code"

        bordered

        loading={
          loading
        }

        dataSource={
          items
        }

        columns={
          columns
        }

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


      {/* MODAL */}

      <Modal
        open={
          modalOpen
        }

        title={
          editingDepartment
            ? "Cập nhật Khoa"
            : "Thêm Khoa"
        }

        width={
          650
        }

        okText={
          editingDepartment
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

          setEditingDepartment(
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
          <Form.Item
            label="Mã khoa"

            name="code"

            rules={[
              {
                required:
                  true,

                whitespace:
                  true,

                message:
                  "Vui lòng nhập mã khoa.",
              },
            ]}
          >
            <Input
              placeholder="Ví dụ: KKB"
            />
          </Form.Item>


          <Form.Item
            label="Tên khoa"

            name="name"

            rules={[
              {
                required:
                  true,

                whitespace:
                  true,

                message:
                  "Vui lòng nhập tên khoa.",
              },
            ]}
          >
            <Input
              placeholder="Ví dụ: Khoa Khám bệnh"
            />
          </Form.Item>


          <Form.Item
            label="Mô tả"

            name="description"
          >
            <Input.TextArea
              rows={3}

              placeholder="Mô tả khoa"
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