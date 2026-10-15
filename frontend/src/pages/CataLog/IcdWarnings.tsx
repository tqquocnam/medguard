import {
  Alert,
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
  Upload,
  message,
} from "antd";

import type {
  TableColumnsType,
  UploadFile,
} from "antd";

import {
  CheckCircleOutlined,
  EditOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StopOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import {
  useCallback,
  useEffect,
  useRef,
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

interface IcdWarningItem {
  id: string;

  icdCode: string;

  errorCode: string;

  diseaseName:
    | string
    | null;

  errorMessage:
    | string
    | null;

  active: boolean;

  note:
    | string
    | null;

  createdAt?:
    | string
    | null;

  updatedAt?:
    | string
    | null;
}


interface IcdWarningFormValues {
  icdCode: string;

  errorCode: string;

  diseaseName?: string;

  errorMessage: string;

  active: boolean;

  note?: string;
}


interface IcdWarningImportError {
  row: number;

  field: string;

  message: string;
}


interface IcdWarningImportResult {
  totalRows: number;

  inserted: number;

  updated: number;

  skipped: number;
}


interface IcdWarningFilters {
  icdCode: string;

  errorCode: string;

  diseaseName: string;
}


// ======================================================
// COMPONENT
// ======================================================

export default function IcdWarnings() {

  // Đo chiều cao khả dụng dựa trên vị trí thực tế của trang.
  // Table chỉ cuộn nội bộ; pagination luôn nằm ngoài vùng cuộn.
  const pageRef = useRef<HTMLDivElement>(null);
  const tableRegionRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [tableScrollY, setTableScrollY] = useState(300);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const pageElement = pageRef.current;
        const tableElement = tableRegionRef.current;
        if (!pageElement || !tableElement) return;

        const isCompact = window.matchMedia(
          "(max-width: 900px), (max-height: 650px)"
        ).matches;

        if (isCompact) {
          setViewportHeight(null);
          setTableScrollY(320);
          return;
        }

        const pageTop = pageElement.getBoundingClientRect().top;
        const availablePageHeight = Math.max(
          320,
          Math.floor(window.innerHeight - pageTop - 18)
        );
        setViewportHeight((previous) =>
          previous === availablePageHeight
            ? previous
            : availablePageHeight
        );

        // Ant Design: ~44px tiêu đề bảng + ~64px phân trang/đệm.
        const regionHeight = tableElement.getBoundingClientRect().height;
        const nextY = Math.max(90, Math.floor(regionHeight - 115));
        setTableScrollY((previous) =>
          previous === nextY ? previous : nextY
        );
      });
    };

    const observer = new ResizeObserver(measure);
    if (pageRef.current) observer.observe(pageRef.current);
    if (tableRegionRef.current) observer.observe(tableRegionRef.current);
    window.addEventListener("resize", measure);
    measure();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, []);

  // ====================================================
  // FORM
  // ====================================================

  const [
    form,
  ] =
    Form.useForm<
      IcdWarningFormValues
    >();


  // ====================================================
  // LIST
  // ====================================================

  const [
    items,
    setItems,
  ] = useState<
    IcdWarningItem[]
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
  // SEARCH
  // ====================================================

  const [
    icdInput,
    setIcdInput,
  ] = useState(
    ""
  );


  const [
    errorCodeInput,
    setErrorCodeInput,
  ] = useState(
    ""
  );


  const [
    diseaseNameInput,
    setDiseaseNameInput,
  ] = useState(
    ""
  );


  const [
    filters,
    setFilters,
  ] = useState<
    IcdWarningFilters
  >({
    icdCode:
      "",

    errorCode:
      "",

    diseaseName:
      "",
  });


  // ====================================================
  // CREATE / EDIT
  // ====================================================

  const [
    formModalOpen,
    setFormModalOpen,
  ] = useState(
    false
  );


  const [
    editingItem,
    setEditingItem,
  ] = useState<
    IcdWarningItem |
    null
  >(
    null
  );


  const [
    saving,
    setSaving,
  ] = useState(
    false
  );


  const [
    togglingId,
    setTogglingId,
  ] = useState<
    string |
    null
  >(
    null
  );


  // ====================================================
  // IMPORT
  // ====================================================

  const [
    importModalOpen,
    setImportModalOpen,
  ] = useState(
    false
  );


  const [
    importFileList,
    setImportFileList,
  ] = useState<
    UploadFile[]
  >(
    []
  );


  const [
    importing,
    setImporting,
  ] = useState(
    false
  );


  const [
    importResult,
    setImportResult,
  ] = useState<
    IcdWarningImportResult |
    null
  >(
    null
  );


  const [
    importErrors,
    setImportErrors,
  ] = useState<
    IcdWarningImportError[]
  >(
    []
  );


  const [
    importMessage,
    setImportMessage,
  ] = useState(
    ""
  );


  // ====================================================
  // LOAD LIST
  // ====================================================

  const loadIcdWarnings =
    useCallback(
      async () => {

        try {

          setLoading(
            true
          );


          const params =
            new URLSearchParams();


          params.set(
            "page",
            String(
              page
            )
          );


          params.set(
            "pageSize",
            String(
              pageSize
            )
          );


          if (
            filters.icdCode
              .trim()
          ) {

            params.set(
              "icdCode",
              filters.icdCode
                .trim()
            );
          }


          if (
            filters.errorCode
              .trim()
          ) {

            params.set(
              "errorCode",
              filters.errorCode
                .trim()
            );
          }


          if (
            filters.diseaseName
              .trim()
          ) {

            params.set(
              "diseaseName",
              filters.diseaseName
                .trim()
            );
          }


          const response =
            await apiFetch(
              `/catalog/icd-warnings?${params.toString()}`,
              {
                method:
                  "GET",
              }
            );


          let json:
            any =
            null;


          try {

            json =
              await response.json();

          } catch {

            // backend không trả JSON
          }


          if (
            !response.ok ||
            json?.success !==
              true
          ) {

            throw new Error(
              json?.message ||
              "Không thể tải danh mục ICD cảnh báo."
            );
          }


          setItems(
            Array.isArray(
              json?.data
                ?.items
            )
              ? json.data.items
              : []
          );


          setTotal(
            Number(
              json?.data
                ?.total ??
              0
            )
          );

        } catch (
          error
        ) {

          console.error(
            "Load ICD warnings error:",
            error
          );


          setItems(
            []
          );


          setTotal(
            0
          );


          message.error(
            error instanceof
            Error
              ? error.message
              : "Không thể tải danh mục ICD cảnh báo."
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
        filters,
      ]
    );


  useEffect(
    () => {

      void loadIcdWarnings();

    },
    [
      loadIcdWarnings,
    ]
  );


  // ====================================================
  // SEARCH
  // ====================================================

  function handleSearch() {

    setPage(
      1
    );


    setFilters({
      icdCode:
        icdInput.trim(),

      errorCode:
        errorCodeInput.trim(),

      diseaseName:
        diseaseNameInput.trim(),
    });
  }


  function handleResetSearch() {

    setIcdInput(
      ""
    );


    setErrorCodeInput(
      ""
    );


    setDiseaseNameInput(
      ""
    );


    setPage(
      1
    );


    setFilters({
      icdCode:
        "",

      errorCode:
        "",

      diseaseName:
        "",
    });
  }


  // ====================================================
  // CREATE
  // ====================================================

  function openCreateModal() {

    setEditingItem(
      null
    );


    form.resetFields();


    form.setFieldsValue({
      icdCode:
        "",

      errorCode:
        "",

      diseaseName:
        "",

      errorMessage:
        "",

      active:
        true,

      note:
        "",
    });


    setFormModalOpen(
      true
    );
  }


  // ====================================================
  // EDIT
  // ====================================================

  function openEditModal(
    item:
      IcdWarningItem
  ) {

    setEditingItem(
      item
    );


    form.setFieldsValue({
      icdCode:
        item.icdCode,

      errorCode:
        item.errorCode,

      diseaseName:
        item.diseaseName ??
        "",

      errorMessage:
        item.errorMessage ??
        "",

      active:
        item.active,

      note:
        item.note ??
        "",
    });


    setFormModalOpen(
      true
    );
  }


  function closeFormModal() {

    if (
      saving
    ) {

      return;
    }


    setFormModalOpen(
      false
    );


    setEditingItem(
      null
    );


    form.resetFields();
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
        Boolean(
          editingItem
        );


      const endpoint =
        isEdit
          ? `/catalog/icd-warnings/${editingItem!.id}`
          : "/catalog/icd-warnings";


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
                icdCode:
                  values.icdCode
                    .trim(),

                errorCode:
                  values.errorCode
                    .trim(),

                diseaseName:
                  values.diseaseName
                    ?.trim() ||
                  null,

                errorMessage:
                  values.errorMessage
                    .trim(),

                active:
                  values.active,

                note:
                  values.note
                    ?.trim() ||
                  null,
              }),
          }
        );


      let json:
        any =
        null;


      try {

        json =
          await response.json();

      } catch {

        // backend không trả JSON
      }


      if (
        !response.ok ||
        json?.success !==
          true
      ) {

        throw new Error(
          json?.message ||
          (
            isEdit
              ? "Cập nhật ICD cảnh báo thất bại."
              : "Thêm ICD cảnh báo thất bại."
          )
        );
      }


      message.success(
        json?.message ||
        (
          isEdit
            ? "Cập nhật ICD cảnh báo thành công."
            : "Thêm ICD cảnh báo thành công."
        )
      );


      setFormModalOpen(
        false
      );


      setEditingItem(
        null
      );


      form.resetFields();


      if (
        !isEdit &&
        page !==
          1
      ) {

        setPage(
          1
        );

      } else {

        await loadIcdWarnings();
      }

    } catch (
      error:
        any
    ) {

      if (
        error?.errorFields
      ) {

        return;
      }


      message.error(
        error instanceof
        Error
          ? error.message
          : "Không thể lưu ICD cảnh báo."
      );

    } finally {

      setSaving(
        false
      );
    }
  }


  // ====================================================
  // TOGGLE ACTIVE
  // ====================================================

  function confirmToggleActive(
    item:
      IcdWarningItem
  ) {

    Modal.confirm({
      title:
        item.active
          ? "Ngừng sử dụng ICD cảnh báo?"
          : "Kích hoạt lại ICD cảnh báo?",

      content:
        item.active
          ? `Mã ${item.icdCode} sẽ không còn được Rule Engine dùng để cảnh báo.`
          : `Mã ${item.icdCode} sẽ được Rule Engine sử dụng lại.`,

      okText:
        item.active
          ? "Ngừng sử dụng"
          : "Kích hoạt",

      cancelText:
        "Hủy",

      okButtonProps: {
        danger:
          item.active,
      },

      onOk:
        async () => {

          try {

            setTogglingId(
              item.id
            );


            const response =
              await apiFetch(
                `/catalog/icd-warnings/${item.id}/toggle-active`,
                {
                  method:
                    "PATCH",
                }
              );


            let json:
              any =
              null;


            try {

              json =
                await response.json();

            } catch {

              // backend không trả JSON
            }


            if (
              !response.ok ||
              json?.success !==
                true
            ) {

              throw new Error(
                json?.message ||
                "Không thể thay đổi trạng thái."
              );
            }


            message.success(
              json?.message ||
              "Đã cập nhật trạng thái."
            );


            await loadIcdWarnings();

          } catch (
            error
          ) {

            message.error(
              error instanceof
              Error
                ? error.message
                : "Không thể thay đổi trạng thái."
            );

          } finally {

            setTogglingId(
              null
            );
          }
        },
    });
  }


  // ====================================================
  // IMPORT
  // ====================================================

  function openImportModal() {

    setImportFileList(
      []
    );


    setImportResult(
      null
    );


    setImportErrors(
      []
    );


    setImportMessage(
      ""
    );


    setImportModalOpen(
      true
    );
  }


  function closeImportModal() {

    if (
      importing
    ) {

      return;
    }


    setImportModalOpen(
      false
    );


    setImportFileList(
      []
    );


    setImportResult(
      null
    );


    setImportErrors(
      []
    );


    setImportMessage(
      ""
    );
  }


  async function handleImportExcel() {

    const file =
      importFileList[0]
        ?.originFileObj;


    if (
      !file
    ) {

      message.warning(
        "Vui lòng chọn file Excel."
      );

      return;
    }


    if (
      !file.name
        .toLowerCase()
        .endsWith(
          ".xlsx"
        )
    ) {

      message.error(
        "Chỉ hỗ trợ file Excel .xlsx."
      );

      return;
    }


    try {

      setImporting(
        true
      );


      setImportResult(
        null
      );


      setImportErrors(
        []
      );


      setImportMessage(
        ""
      );


      const formData =
        new FormData();


      formData.append(
        "file",
        file
      );


      const response =
        await apiFetch(
          "/catalog/icd-warnings/import",
          {
            method:
              "POST",

            body:
              formData,
          }
        );


      let json:
        any =
        null;


      try {

        json =
          await response.json();

      } catch {

        // backend không trả JSON
      }


      if (
        !response.ok ||
        json?.success !==
          true
      ) {

        const errors =
          Array.isArray(
            json?.errors
          )
            ? json.errors
            : [];


        setImportErrors(
          errors
        );


        setImportMessage(
          json?.message ||
          "Import ICD cảnh báo thất bại."
        );


        message.error(
          json?.message ||
          "Import ICD cảnh báo thất bại."
        );


        return;
      }


      const result:
        IcdWarningImportResult = {

        totalRows:
          Number(
            json?.data
              ?.totalRows ??
            0
          ),

        inserted:
          Number(
            json?.data
              ?.inserted ??
            0
          ),

        updated:
          Number(
            json?.data
              ?.updated ??
            0
          ),

        skipped:
          Number(
            json?.data
              ?.skipped ??
            0
          ),
      };


      setImportResult(
        result
      );


      setImportMessage(
        json?.message ||
        "Import ICD cảnh báo thành công."
      );


      message.success(
        json?.message ||
        "Import ICD cảnh báo thành công."
      );


      await loadIcdWarnings();

    } catch (
      error
    ) {

      const text =
        error instanceof
        Error
          ? error.message
          : "Import ICD cảnh báo thất bại.";


      setImportMessage(
        text
      );


      message.error(
        text
      );

    } finally {

      setImporting(
        false
      );
    }
  }


  // ====================================================
  // TEXT CLAMP
  // ====================================================

  function renderClampText(
    value:
      string |
      null |
      undefined,

    lines =
      2
  ) {

    const text =
      value?.trim() ||
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

        mouseEnterDelay={
          0.3
        }
      >
        <div
          style={{
            display:
              "-webkit-box",

            WebkitBoxOrient:
              "vertical",

            WebkitLineClamp:
              lines,

            overflow:
              "hidden",

            textOverflow:
              "ellipsis",

            lineHeight:
              "20px",

            maxHeight:
              `${lines * 20}px`,
          }}
        >
          {
            text
          }
        </div>
      </Tooltip>
    );
  }


  // ====================================================
  // COLUMNS
  // ====================================================

  const columns:
    TableColumnsType<
      IcdWarningItem
    > = [

    {
      title:
        "STT",

      key:
        "stt",

      width:
        55,

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
        "ICD",

      dataIndex:
        "icdCode",

      key:
        "icdCode",

      width:
        90,

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
        "Mã lỗi",

      dataIndex:
        "errorCode",

      key:
        "errorCode",

      width:
        95,

      align:
        "center",

      render:
        (
          value:
            string
        ) => (
          <Tag
            color="error"

            style={{
              margin:
                0,
            }}
          >
            {
              value ||
              "-"
            }
          </Tag>
        ),
    },

    {
      title:
        "Tên bệnh",

      dataIndex:
        "diseaseName",

      key:
        "diseaseName",

      width:
        190,

      render:
        (
          value:
            string |
            null
        ) =>
          renderClampText(
            value,
            2
          ),
    },

    {
      title:
        "Nội dung cảnh báo",

      dataIndex:
        "errorMessage",

      key:
        "errorMessage",

      width:
        360,

      render:
        (
          value:
            string |
            null
        ) =>
          renderClampText(
            value,
            2
          ),
    },

    {
      title:
        "Trạng thái",

      dataIndex:
        "active",

      key:
        "active",

      width:
        105,

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

                style={{
                  margin:
                    0,
                }}
              >
                Hoạt động
              </Tag>
            )
            : (
              <Tag
                style={{
                  margin:
                    0,
                }}
              >
                Ngừng
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
        200,

      render:
        (
          value:
            string |
            null
        ) =>
          renderClampText(
            value,
            2
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

      fixed:
        "right",

      render:
        (
          _,
          record
        ) => (

          <Space
            size={
              12
            }
          >

            <Tooltip
              title="Sửa"
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
                  : "Kích hoạt lại"
              }
            >
              <Button
                type="text"

                size="small"

                loading={
                  togglingId ===
                  record.id
                }

                icon={
                  record.active
                    ? (
                      <StopOutlined
                        style={{
                          color:
                            "#ff4d4f",
                        }}
                      />
                    )
                    : (
                      <CheckCircleOutlined
                        style={{
                          color:
                            "#52c41a",
                        }}
                      />
                    )
                }

                onClick={() =>
                  confirmToggleActive(
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
        ref={pageRef}
        className="icd-warning-page"
        style={viewportHeight ? { height: viewportHeight } : undefined}
      >

        {/* ===============================================
            BREADCRUMB
        =============================================== */}

        <Breadcrumb
          className="icd-breadcrumb"

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
                "ICD - Cảnh báo",
            },
          ]}
        />


        {/* ===============================================
            HEADER
        =============================================== */}

        <div
          className="icd-header"
        >

          <div>

            <div
              className="icd-title-row"
            >

              <SafetyCertificateOutlined
                className="icd-title-icon"
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
                ICD - Cảnh báo
              </Title>

            </div>


            <Text
              type="secondary"

              className="icd-subtitle"
            >
              Cấu hình các mã ICD cần cảnh báo khi kiểm tra hồ sơ BHYT
            </Text>

          </div>


          <Space
            size={
              8
            }
          >

            <Button
              icon={
                <UploadOutlined />
              }

              onClick={
                openImportModal
              }
            >
              Import
            </Button>


            <Button
              type="primary"

              icon={
                <PlusOutlined />
              }

              onClick={
                openCreateModal
              }
            >
              Thêm mới
            </Button>

          </Space>

        </div>


        {/* ===============================================
            FILTER
        =============================================== */}

        <div
          className="icd-filter-grid"
        >

          <div
            className="icd-filter-item"
          >

            <Text
              strong

              className="icd-filter-label"
            >
              Mã ICD
            </Text>


            <Input
              value={
                icdInput
              }

              placeholder="Nhập mã ICD"

              allowClear

              onChange={(
                event
              ) => {

                setIcdInput(
                  event.target.value
                );
              }}

              onPressEnter={
                handleSearch
              }
            />

          </div>


          <div
            className="icd-filter-item"
          >

            <Text
              strong

              className="icd-filter-label"
            >
              Mã lỗi
            </Text>


            <Input
              value={
                errorCodeInput
              }

              placeholder="Nhập mã lỗi"

              allowClear

              onChange={(
                event
              ) => {

                setErrorCodeInput(
                  event.target.value
                );
              }}

              onPressEnter={
                handleSearch
              }
            />

          </div>


          <div
            className="icd-filter-item"
          >

            <Text
              strong

              className="icd-filter-label"
            >
              Tên bệnh
            </Text>


            <Input
              value={
                diseaseNameInput
              }

              placeholder="Nhập tên bệnh"

              allowClear

              onChange={(
                event
              ) => {

                setDiseaseNameInput(
                  event.target.value
                );
              }}

              onPressEnter={
                handleSearch
              }
            />

          </div>


          <div
            className="icd-filter-actions"
          >

            <Button
              type="primary"

              icon={
                <SearchOutlined />
              }

              onClick={
                handleSearch
              }
            >
              Tìm kiếm
            </Button>


            <Button
              icon={
                <ReloadOutlined />
              }

              onClick={
                handleResetSearch
              }
            >
              Làm mới
            </Button>

          </div>

        </div>


        {/* ===============================================
            TABLE
        =============================================== */}

        <div className="icd-table-region" ref={tableRegionRef}>
        <Table<IcdWarningItem>
          className="medguard-icd-table"

          rowKey="id"

          loading={
            loading
          }

          dataSource={
            items
          }

          columns={
            columns
          }

          size="middle"

          tableLayout="fixed"

          scroll={{
            x: 1200,
            y: tableScrollY,
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
              "20",
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
              "Chưa có dữ liệu ICD cảnh báo",
          }}
        />
        </div>

      </div>


      {/* ==================================================
          CREATE / EDIT MODAL
      ================================================== */}

      <Modal
        open={
          formModalOpen
        }

        title={
          editingItem
            ? "Cập nhật ICD Cảnh báo"
            : "Thêm ICD Cảnh báo"
        }

        width={
          760
        }

        okText={
          editingItem
            ? "Cập nhật"
            : "Thêm mới"
        }

        cancelText="Đóng"

        confirmLoading={
          saving
        }

        onOk={() =>
          void handleSave()
        }

        onCancel={
          closeFormModal
        }

        destroyOnHidden
      >

        <Form
          form={
            form
          }

          layout="vertical"

          style={{
            marginTop:
              18,
          }}
        >

          <div
            className="icd-form-grid"
          >

            <Form.Item
              label="Mã ICD"

              name="icdCode"

              rules={[
                {
                  required:
                    true,

                  message:
                    "Vui lòng nhập mã ICD.",
                },
              ]}
            >
              <Input
                placeholder="Ví dụ: M62.9"

                maxLength={
                  50
                }
              />
            </Form.Item>


            <Form.Item
              label="Mã lỗi"

              name="errorCode"

              rules={[
                {
                  required:
                    true,

                  message:
                    "Vui lòng nhập mã lỗi.",
                },
              ]}
            >
              <Input
                placeholder="Ví dụ: ERR-26"

                maxLength={
                  100
                }
              />
            </Form.Item>

          </div>


          <Form.Item
            label="Tên bệnh"

            name="diseaseName"
          >
            <Input
              placeholder="Nhập tên bệnh"
            />
          </Form.Item>


          <Form.Item
            label="Nội dung cảnh báo"

            name="errorMessage"

            rules={[
              {
                required:
                  true,

                message:
                  "Vui lòng nhập nội dung cảnh báo.",
              },
            ]}
          >
            <Input.TextArea
              rows={
                4
              }

              placeholder="Nhập nội dung cảnh báo..."
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

              placeholder="Nhập ghi chú"
            />
          </Form.Item>


          <Form.Item
            label="Trạng thái"

            name="active"

            valuePropName="checked"
          >
            <Switch
              checkedChildren="Hoạt động"

              unCheckedChildren="Ngừng"
            />
          </Form.Item>

        </Form>

      </Modal>


      {/* ==================================================
          IMPORT MODAL
      ================================================== */}

      <Modal
        open={
          importModalOpen
        }

        title="Import ICD Cảnh báo"

        width={
          900
        }

        okText="Import"

        cancelText="Đóng"

        confirmLoading={
          importing
        }

        okButtonProps={{
          disabled:
            importFileList.length ===
              0 ||
            importResult !==
              null,
        }}

        onOk={() =>
          void handleImportExcel()
        }

        onCancel={
          closeImportModal
        }
      >

        <div
          style={{
            marginTop:
              16,
          }}
        >

          <Alert
            type="info"

            showIcon

            message="Import danh mục ICD cảnh báo từ Excel"

            description={
              <>
                File Excel cần có tối thiểu{" "}
                <b>ICD</b>
                {" "}
                và{" "}
                <b>MA_LOI</b>.
                {" "}

                Có thể sử dụng thêm các cột{" "}
                <b>TEN_BENH</b>,
                {" "}
                <b>NOI_DUNG_LOI</b>,
                {" "}
                <b>TRANG_THAI</b>
                {" "}
                và{" "}
                <b>GHI_CHU</b>.
                {" "}

                Mã đã tồn tại sẽ được cập nhật,
                mã mới sẽ được thêm mới.
              </>
            }

            style={{
              marginBottom:
                16,
            }}
          />


          <Upload
            accept=".xlsx"

            maxCount={
              1
            }

            fileList={
              importFileList
            }

            beforeUpload={() =>
              false
            }

            disabled={
              importing
            }

            onRemove={() => {

              setImportFileList(
                []
              );


              setImportResult(
                null
              );


              setImportErrors(
                []
              );


              setImportMessage(
                ""
              );


              return true;
            }}

            onChange={(
              info
            ) => {

              setImportFileList(
                info.fileList.slice(
                  -1
                )
              );


              setImportResult(
                null
              );


              setImportErrors(
                []
              );


              setImportMessage(
                ""
              );
            }}
          >

            <Button
              icon={
                <UploadOutlined />
              }

              disabled={
                importing
              }
            >
              Chọn file Excel
            </Button>

          </Upload>


          {importResult && (

            <Alert
              type="success"

              showIcon

              style={{
                marginTop:
                  20,
              }}

              message={
                importMessage ||
                "Import thành công"
              }

              description={
                <div
                  className="icd-import-result"
                >

                  <div>
                    Tổng số dòng:{" "}
                    <b>
                      {
                        importResult.totalRows
                      }
                    </b>
                  </div>


                  <div>
                    Thêm mới:{" "}
                    <b>
                      {
                        importResult.inserted
                      }
                    </b>
                  </div>


                  <div>
                    Cập nhật:{" "}
                    <b>
                      {
                        importResult.updated
                      }
                    </b>
                  </div>


                  <div>
                    Bỏ qua:{" "}
                    <b>
                      {
                        importResult.skipped
                      }
                    </b>
                  </div>

                </div>
              }
            />

          )}


          {!importResult &&
            importMessage &&
            importErrors.length ===
              0 && (

              <Alert
                type="error"

                showIcon

                message={
                  importMessage
                }

                style={{
                  marginTop:
                    20,
                }}
              />

            )}


          {importErrors.length >
            0 && (

            <div
              style={{
                marginTop:
                  20,
              }}
            >

              <Alert
                type="error"

                showIcon

                message={
                  importMessage ||
                  `File có ${importErrors.length} lỗi.`
                }

                description="Không có dữ liệu nào được import. Hãy sửa các dòng lỗi rồi import lại."

                style={{
                  marginBottom:
                    12,
                }}
              />


              <Table<IcdWarningImportError>
                size="small"

                bordered

                rowKey={(
                  record
                ) =>
                  `${record.row}-${record.field}-${record.message}`
                }

                dataSource={
                  importErrors
                }

                pagination={{
                  pageSize:
                    10,

                  showSizeChanger:
                    false,

                  showTotal:
                    (
                      value
                    ) =>
                      `Tổng lỗi: ${value}`,
                }}

                scroll={{
                  y:
                    320,
                }}

                columns={[
                  {
                    title:
                      "Dòng",

                    dataIndex:
                      "row",

                    width:
                      80,

                    align:
                      "center",
                  },

                  {
                    title:
                      "Cột",

                    dataIndex:
                      "field",

                    width:
                      170,
                  },

                  {
                    title:
                      "Lỗi",

                    dataIndex:
                      "message",
                  },
                ]}
              />

            </div>

          )}

        </div>

      </Modal>


      {/* ==================================================
          STYLE
      ================================================== */}

      <style>
        {`
          /* Trang ICD không làm cuộn khung trình duyệt trên desktop. */
          body:has(.icd-warning-page) {
            overflow-y: hidden !important;
          }

          .icd-warning-page {
            width: 100%;
            min-width: 0;
            min-height: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .icd-warning-page > .icd-breadcrumb,
          .icd-warning-page > .icd-header,
          .icd-warning-page > .icd-filter-grid {
            flex: 0 0 auto;
          }

          .icd-table-region {
            flex: 1 1 auto;
            min-height: 0;
            min-width: 0;
            overflow: hidden;
          }

          .icd-table-region .ant-table-body {
            overflow-y: auto !important;
          }

          .icd-table-region .ant-pagination {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: flex-end;
            gap: 4px;
            margin: 10px 10px 8px !important;
          }

          @media (max-width: 900px), (max-height: 650px) {
            body:has(.icd-warning-page) {
              overflow-y: auto !important;
            }
            .icd-warning-page {
              height: auto !important;
              overflow: visible;
            }
            .icd-table-region {
              overflow: visible;
            }
          }

          .icd-breadcrumb {
            margin-bottom: 14px;
            font-size: 12px;
          }

          .icd-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 16px;
          }

          .icd-title-row {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .icd-title-row h3 {
            color: #172033 !important;
            font-weight: 800 !important;
            font-size: 22px !important;
          }

          .icd-title-icon {
            font-size: 25px;
            color: #1677ff;
          }

          .icd-subtitle {
            display: block;
            margin-top: 3px;
            font-size: 12px;
          }

          .icd-filter-grid {
            display: grid;
            grid-template-columns:
              minmax(180px, 1fr)
              minmax(180px, 1fr)
              minmax(260px, 1.4fr)
              auto;

            align-items: end;
            gap: 10px;
            margin-bottom: 14px;
          }

          .icd-filter-item {
            min-width: 0;
          }

          .icd-filter-label {
            display: block;
            margin-bottom: 6px;
            color: #172033;
            font-size: 12px;
            font-weight: 700;
          }

          .icd-filter-actions {
            display: flex;
            gap: 8px;
            align-items: center;
          }

          .medguard-icd-table {
            border: 1px solid #e5eaf0;
            border-radius: 8px;
            overflow: hidden;
          }

          .medguard-icd-table .ant-table {
            border-radius: 8px;
          }

          .medguard-icd-table
          .ant-table-thead
          > tr
          > th {
            background: #f3f6f9 !important;
            color: #172033;
            font-size: 12px;
            font-weight: 700;
            padding: 11px 10px !important;
            border-bottom: 1px solid #e5eaf0 !important;
          }

          .medguard-icd-table
          .ant-table-tbody
          > tr
          > td {
            padding: 11px 10px !important;
            font-size: 12px;
            vertical-align: middle;
            border-bottom: 1px solid #edf0f5 !important;
          }

          .medguard-icd-table
          .ant-table-tbody
          > tr:hover
          > td {
            background: #f7fbff !important;
          }

          .medguard-icd-table
          .ant-table-cell-fix-right {
            background: #ffffff;
          }

          .medguard-icd-table
          .ant-table-thead
          .ant-table-cell-fix-right {
            background: #f3f6f9 !important;
          }

          .medguard-icd-table
          .ant-pagination {
            margin: 14px 8px 8px;
          }

          .icd-form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }

          .icd-import-result {
            line-height: 2;
          }

          @media (max-width: 1000px) {
            .icd-filter-grid {
              grid-template-columns: 1fr 1fr;
            }

            .icd-header {
              flex-direction: column;
            }
          }

          @media (max-width: 700px) {
            .icd-filter-grid {
              grid-template-columns: 1fr;
            }

            .icd-filter-actions {
              width: 100%;
            }

            .icd-form-grid {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>

    </>
  );
}