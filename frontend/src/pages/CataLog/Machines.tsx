import {
  Breadcrumb,
  Button,
  Form,
  Input,
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
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  ToolOutlined,
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
    | string
    | null;

  warnTimeOverlap: boolean;

  note:
    | string
    | null;

  active: boolean;

  serviceCount: number;

  createdAt?: string;

  updatedAt?: string;
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
  code: string;

  name: string;

  warnTimeOverlap: boolean;

  note?: string;

  active: boolean;
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
  // TABLE
  // ====================================================

  const [
    items,
    setItems,
  ] = useState<
    MachineItem[]
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
  // MODAL
  // ====================================================

  const [
    modalOpen,
    setModalOpen,
  ] = useState(
    false
  );


  const [
    saving,
    setSaving,
  ] = useState(
    false
  );


  const [
    editingMachine,
    setEditingMachine,
  ] = useState<
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
  // CONFIRM DISABLE
  // ====================================================

  function confirmDisable(
    machine:
      MachineItem
  ) {

    Modal.confirm({
      title:
        "Ngừng sử dụng máy?",

      content:
        `${machine.code} - ${machine.name}`,

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

          await handleDisable(
            machine
          );
        },
    });
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

  const columns:
    TableColumnsType<
      MachineItem
    > = [

    {
      title:
        "STT",

      key:
        "stt",

      width:
        65,

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
        "Mã máy",

      dataIndex:
        "code",

      key:
        "code",

      width:
        280,

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
        "Tên máy",

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
        ) => {

        if (
          !value
        ) {

          return "-";
        }


        return (
          <Tooltip
            title={
              value
            }
          >
            <Text
              ellipsis
            >
              {
                value
              }
            </Text>
          </Tooltip>
        );
      },
    },


    {
      title:
        "Cảnh báo trùng TGTH",

      dataIndex:
        "warnTimeOverlap",

      key:
        "warnTimeOverlap",

      width:
        165,

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
                color="blue"

                className="machines-pill"
              >
                Có
              </Tag>
            )
            : (
              <Tag
                color="error"

                className="machines-pill"
              >
                Không
              </Tag>
            ),
    },


    {
      title:
        "Số DVKT liên kết",

      dataIndex:
        "serviceCount",

      key:
        "serviceCount",

      width:
        140,

      align:
        "center",

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

            className="machines-count"
          >
            {
              value ??
              0
            }
          </Tag>
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
        300,

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

            placement="topLeft"
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

      fixed:
        "right",

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

                className="machines-status"
              >
                Đang dùng
              </Tag>
            )
            : (
              <Tag
                className="machines-status"
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

      fixed:
        "right",

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
                  openEditModal(
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
        className="machines-page"
      >

        {/* =================================================
            BREADCRUMB
        ================================================= */}

        <Breadcrumb
          className="machines-breadcrumb"

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
                "Máy",
            },
          ]}
        />


        {/* =================================================
            HEADER
        ================================================= */}

        <div
          className="machines-header"
        >

          <div>

            <div
              className="machines-title-row"
            >

              <ToolOutlined
                className="machines-title-icon"
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
                Danh mục máy
              </Title>

            </div>


            <Text
              type="secondary"

              className="machines-subtitle"
            >
              Quản lý máy thực hiện dịch vụ kỹ thuật và cấu hình cảnh báo
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
            SEARCH
        ================================================= */}

        <div
          className="machines-filter-grid"
        >

          <div
            className="machines-filter-item"
          >

            <Text
              strong

              className="machines-filter-label"
            >
              Mã máy
            </Text>


            <Input
              value={
                searchCode
              }

              placeholder="Nhập mã máy"

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
            className="machines-filter-item"
          >

            <Text
              strong

              className="machines-filter-label"
            >
              Tên máy
            </Text>


            <Input
              value={
                searchName
              }

              placeholder="Nhập tên máy"

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

        <Table<MachineItem>
          className="machines-table"

          rowKey="code"

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
              1450,
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
              "Chưa có dữ liệu máy",
          }}
        />

      </div>


      {/* =================================================
          CREATE / UPDATE MODAL
      ================================================= */}

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

          className="machines-form"
        >

          <div
            className="machines-form-grid machines-form-grid-main"
          >

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
            className="machines-form-grid machines-form-grid-config"
          >

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


            <Form.Item
              label="Ghi chú"

              name="note"
            >

              <Input
                placeholder="Ghi chú"
              />

            </Form.Item>

          </div>


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
          .machines-page {
            width: 100%;
          }

          .machines-breadcrumb {
            margin-bottom: 14px;
            font-size: 12px;
          }

          .machines-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 16px;
          }

          .machines-title-row {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .machines-title-row h3 {
            margin: 0 !important;
            color: #172033 !important;
            font-size: 22px !important;
            font-weight: 800 !important;
          }

          .machines-title-icon {
            color: #1677ff;
            font-size: 25px;
          }

          .machines-subtitle {
            display: block;
            margin-top: 3px;
            font-size: 12px;
          }

          .machines-filter-grid {
            display: grid;
            grid-template-columns:
              minmax(260px, 1fr)
              minmax(380px, 1.4fr)
              auto;
            gap: 10px;
            align-items: end;
            margin-bottom: 14px;
          }

          .machines-filter-item {
            min-width: 0;
          }

          .machines-filter-label {
            display: block;
            margin-bottom: 6px;
            color: #172033;
            font-size: 12px;
            font-weight: 700;
          }

          .machines-table {
            overflow: hidden;
            border: 1px solid #e6ebf1;
            border-radius: 8px;
          }

          .machines-table
          .ant-table {
            border-radius: 8px;
          }

          .machines-table
          .ant-table-container {
            border-start-start-radius: 8px;
            border-start-end-radius: 8px;
          }

          .machines-table
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

          .machines-table
          .ant-table-tbody
          > tr
          > td {
            padding: 13px 10px !important;
            color: #202a3b;
            font-size: 12px;
            vertical-align: middle;
            border-bottom: 1px solid #edf0f5 !important;
          }

          .machines-table
          .ant-table-tbody
          > tr:hover
          > td {
            background: #f7fbff !important;
          }

          .machines-table
          .ant-table-cell-fix-right {
            background: #ffffff;
          }

          .machines-table
          .ant-table-thead
          .ant-table-cell-fix-right {
            background: #f3f6f9 !important;
          }

          .machines-table
          .ant-pagination {
            margin: 14px 8px 6px;
          }

          .machines-status,
          .machines-pill,
          .machines-count {
            margin: 0;
            border-radius: 6px;
            font-size: 11px;
          }

          .machines-form {
            margin-top: 18px;
          }

          .machines-form-grid {
            display: grid;
            gap: 16px;
          }

          .machines-form-grid-main {
            grid-template-columns:
              1fr 1.5fr;
          }

          .machines-form-grid-config {
            grid-template-columns:
              1fr 2fr;
          }

          @media (max-width: 800px) {
            .machines-header {
              flex-direction: column;
            }

            .machines-filter-grid,
            .machines-form-grid-main,
            .machines-form-grid-config {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>

    </>
  );
}