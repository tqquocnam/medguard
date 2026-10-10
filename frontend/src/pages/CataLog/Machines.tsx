import {
  Button,
  Dropdown,
  Form,
  Input,
  Modal,
  Popconfirm,
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

interface MachineItem {

  code: string;

  name: string;

  legacyServiceCode:
    string |
    null;

  warnTimeOverlap:
    boolean;

  note:
    string |
    null;

  active:
    boolean;

  serviceCount:
    number;

  createdAt?:
    string;

  updatedAt?:
    string;
}


interface MachineListResponse {

  success?: boolean;

  message?: string;

  data?: {

    items:
      MachineItem[];

    total:
      number;

    page:
      number;

    pageSize:
      number;
  };
}


interface MachineFormValues {

  code:
    string;

  name:
    string;

  warnTimeOverlap:
    boolean;

  note?:
    string;

  active:
    boolean;
}


// ======================================================
// COMPONENT
// ======================================================

export default function Machines() {

  // ====================================================
  // SEARCH
  // ====================================================

  const [
    searchCode,
    setSearchCode,
  ] =
    useState(
      ""
    );


  const [
    searchName,
    setSearchName,
  ] =
    useState(
      ""
    );


  // ====================================================
  // TABLE
  // ====================================================

  const [
    items,
    setItems,
  ] =
    useState<
      MachineItem[]
    >([]);


  const [
    total,
    setTotal,
  ] =
    useState(
      0
    );


  const [
    page,
    setPage,
  ] =
    useState(
      1
    );


  const [
    pageSize,
    setPageSize,
  ] =
    useState(
      10
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );


  // ====================================================
  // MODAL
  // ====================================================

  const [
    modalOpen,
    setModalOpen,
  ] =
    useState(
      false
    );


  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );


  const [
    editingMachine,
    setEditingMachine,
  ] =
    useState<
      MachineItem |
      null
    >(
      null
    );


  const [
    form,
  ] =
    Form.useForm<
      MachineFormValues
    >();


  // ====================================================
  // LOAD
  // ====================================================

  const loadMachines =
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
              `/catalog/machines?${params.toString()}`,
              {
                method:
                  "GET",
              }
            );


          let json:
            MachineListResponse;


          try {

            json =
              await response.json();

          } catch {

            throw new Error(
              "Backend trả dữ liệu không hợp lệ."
            );
          }


          if (
            !response.ok ||
            json.success !==
              true
          ) {

            throw new Error(
              json.message ||
              "Không thể tải danh mục máy."
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

          console.error(
            "Load machines error:",
            error
          );


          message.error(
            error instanceof
            Error
              ? error.message
              : "Không thể tải danh mục máy."
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


  // ====================================================
  // INITIAL LOAD
  // ====================================================

  useEffect(
    () => {

      const timer =
        window.setTimeout(
          () => {

            void loadMachines();

          },
          0
        );


      return () => {

        window.clearTimeout(
          timer
        );
      };

    },
    [
      loadMachines,
    ]
  );


  // ====================================================
  // ADD
  // ====================================================

  function openAddModal() {

    setEditingMachine(
      null
    );


    form.resetFields();


    form.setFieldsValue({

      code:
        "",

      name:
        "",

      warnTimeOverlap:
        false,

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

  function openEditModal(
    machine:
      MachineItem
  ) {

    setEditingMachine(
      machine
    );


    form.setFieldsValue({

      code:
        machine.code,

      name:
        machine.name,

      warnTimeOverlap:
        machine.warnTimeOverlap,

      note:
        machine.note ??
        "",

      active:
        machine.active,
    });


    setModalOpen(
      true
    );
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
        editingMachine !==
        null;


      const endpoint =
        isEdit
          ? `/catalog/machines/${encodeURIComponent(
              editingMachine.code
            )}`
          : "/catalog/machines";


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

                warnTimeOverlap:
                  values.warnTimeOverlap,

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
          (
            isEdit
              ? "Không thể cập nhật máy."
              : "Không thể thêm máy."
          )
        );
      }


      message.success(
        isEdit
          ? "Cập nhật máy thành công."
          : "Thêm máy thành công."
      );


      setModalOpen(
        false
      );


      setEditingMachine(
        null
      );


      form.resetFields();


      await loadMachines();

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


      console.error(
        "Save machine error:",
        error
      );


      message.error(
        error instanceof
        Error
          ? error.message
          : "Không thể lưu máy."
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

  async function handleDisable(
    machine:
      MachineItem
  ) {

    try {

      const response =
        await apiFetch(
          `/catalog/machines/${encodeURIComponent(
            machine.code
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
          "Không thể ngừng sử dụng máy."
        );
      }


      message.success(
        "Đã ngừng sử dụng máy."
      );


      await loadMachines();

    } catch (
      error
    ) {

      message.error(
        error instanceof
        Error
          ? error.message
          : "Không thể ngừng sử dụng máy."
      );
    }
  }


  // ====================================================
  // RESET SEARCH
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
  // COLUMNS
  // ====================================================

  const columns = [

    // ==================================================
    // ACTION
    // ==================================================

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
            MachineItem
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

                  label: (

                    <Popconfirm
                      title="Ngừng sử dụng máy?"

                      description={
                        record.name
                      }

                      okText="Đồng ý"

                      cancelText="Hủy"

                      onConfirm={() =>
                        void handleDisable(
                          record
                        )
                      }
                    >

                      <span>
                        Ngừng sử dụng
                      </span>

                    </Popconfirm>
                  ),
                },
              ],

              onClick: ({
                key,
                domEvent,
              }) => {

                domEvent
                  .stopPropagation();


                if (
                  key ===
                  "edit"
                ) {

                  openEditModal(
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


    // ==================================================
    // CODE
    // ==================================================

    {
      title:
        "Mã máy",

      dataIndex:
        "code",

      width:
        280,
    },


    // ==================================================
    // NAME
    // ==================================================

    {
      title:
        "Tên máy",

      dataIndex:
        "name",

      width:
        360,
    },


    // ==================================================
    // WARN OVERLAP
    // ==================================================

    {
      title:
        "Cảnh báo trùng TGTH",

      dataIndex:
        "warnTimeOverlap",

      width:
        180,

      align:
        "center" as const,

      render:
        (
          value:
            boolean
        ) =>
          value
            ? (

              <Text
                style={{
                  color:
                    "#1677ff",
                }}
              >
                Có
              </Text>

            )
            : (

              <Text
                type="danger"
              >
                Không
              </Text>
            ),
    },


    // ==================================================
    // SERVICES
    // ==================================================

    {
      title:
        "Số DVKT liên kết",

      dataIndex:
        "serviceCount",

      width:
        150,

      align:
        "center" as const,

      render:
        (
          value:
            number
        ) => (

          <Tag
            color={
              value >
              0
                ? "blue"
                : "default"
            }
          >
            {value}
          </Tag>
        ),
    },


    // ==================================================
    // NOTE
    // ==================================================

    {
      title:
        "Ghi chú",

      dataIndex:
        "note",

      ellipsis:
        true,
    },


    // ==================================================
    // ACTIVE
    // ==================================================

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

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

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
          Danh mục máy
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


      {/* ================================================= */}
      {/* SEARCH */}
      {/* ================================================= */}

      <Space
        wrap

        style={{
          width:
            "100%",

          marginBottom:
            16,
        }}
      >

        <div>

          <Text>
            Mã máy
          </Text>


          <Input
            value={
              searchCode
            }

            placeholder="Mã máy"

            style={{
              width:
                300,

              marginTop:
                5,
            }}

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


        <div>

          <Text>
            Tên máy
          </Text>


          <Input
            value={
              searchName
            }

            placeholder="Tên máy"

            style={{
              width:
                400,

              marginTop:
                5,
            }}

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

          style={{
            marginTop:
              25,
          }}

          onClick={
            handleRefresh
          }
        >
          Làm mới
        </Button>

      </Space>


      {/* ================================================= */}
      {/* TABLE */}
      {/* ================================================= */}

      <Table<MachineItem>
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

        scroll={{
          x:
            1200,
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


      {/* ================================================= */}
      {/* CREATE / UPDATE MODAL */}
      {/* ================================================= */}

      <Modal
        open={
          modalOpen
        }

        title={
          editingMachine
            ? "Cập nhật Máy"
            : "Thêm Máy"
        }

        width={
          720
        }

        okText={
          editingMachine
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


          setEditingMachine(
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

            {/* =========================================== */}
            {/* CODE */}
            {/* =========================================== */}

            <Form.Item
              label="Mã máy"

              name="code"

              rules={[
                {
                  required:
                    true,

                  whitespace:
                    true,

                  message:
                    "Vui lòng nhập mã máy.",
                },
              ]}
            >

              <Input
                placeholder="Mã máy"
              />

            </Form.Item>


            {/* =========================================== */}
            {/* NAME */}
            {/* =========================================== */}

            <Form.Item
              label="Tên máy"

              name="name"

              rules={[
                {
                  required:
                    true,

                  whitespace:
                    true,

                  message:
                    "Vui lòng nhập tên máy.",
                },
              ]}
            >

              <Input
                placeholder="Tên máy"
              />

            </Form.Item>

          </div>


          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr 2fr",

              gap:
                16,
            }}
          >

            {/* =========================================== */}
            {/* OVERLAP */}
            {/* =========================================== */}

            <Form.Item
              label="Cảnh báo trùng TGTH"

              name="warnTimeOverlap"

              valuePropName="checked"
            >

              <Switch
                checkedChildren="Có"

                unCheckedChildren="Không"
              />

            </Form.Item>


            {/* =========================================== */}
            {/* NOTE */}
            {/* =========================================== */}

            <Form.Item
              label="Ghi chú"

              name="note"
            >

              <Input
                placeholder="Ghi chú"
              />

            </Form.Item>

          </div>


          {/* ============================================= */}
          {/* ACTIVE */}
          {/* ============================================= */}

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