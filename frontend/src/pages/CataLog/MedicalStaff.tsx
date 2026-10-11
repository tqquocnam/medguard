import {
  Alert,
  Button,
  Dropdown,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";

import type {
  UploadFile,
} from "antd";

import {
  EllipsisOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
  UploadOutlined,
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
// HELPERS
// ======================================================

function formatDate(
  value:
    | string
    | null
    | undefined
) {

  if (
    !value
  ) {

    return "-";
  }


  const text =
    String(
      value
    ).trim();


  const match =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );


  if (
    match
  ) {

    return `${match[3]}/${match[2]}/${match[1]}`;
  }


  return text;
}


// ======================================================
// TYPES
// ======================================================

interface DepartmentOption {
  code: string;

  name: string;
}


interface MedicalStaffItem {
  id: string;

  fullName: string;

  socialInsuranceCode:
    | string
    | null;

  licenseNumber:
    | string
    | null;

  gender:
    | string
    | null;

  licenseIssueDate:
    | string
    | null;

  professionalTitle:
    | string
    | null;

  licenseIssuer:
    | string
    | null;

  professionalScope:
    | string
    | null;

  registrationTime:
    | string
    | null;

  dailyTime:
    | string
    | null;

  weeklyTime:
    | string
    | null;

  position:
    | string
    | null;

  note:
    | string
    | null;

  active:
    boolean;

  departments:
    DepartmentOption[];

  departmentCount?:
    number;
}


interface MedicalStaffFormValues {
  fullName: string;

  socialInsuranceCode?:
    string;

  licenseNumber?:
    string;

  gender?:
    string;

  licenseIssueDate?:
    string;

  professionalTitle?:
    string;

  licenseIssuer?:
    string;

  professionalScope?:
    string;

  registrationTime?:
    string;

  dailyTime?:
    string;

  weeklyTime?:
    string;

  position?:
    string;

  note?:
    string;

  departmentCodes:
    string[];

  active:
    boolean;
}


interface MedicalStaffImportError {
  row: number;

  field: string;

  message: string;
}


interface MedicalStaffImportResult {
  totalRows: number;

  inserted: number;

  updated: number;

  skipped: number;
}


// ======================================================
// COMPONENT
// ======================================================

export default function MedicalStaff() {

  // ====================================================
  // FILTER
  // ====================================================

  const [
    searchName,
    setSearchName,
  ] = useState(
    ""
  );


  const [
    searchLicense,
    setSearchLicense,
  ] = useState(
    ""
  );


  const [
    searchBhxh,
    setSearchBhxh,
  ] = useState(
    ""
  );


  const [
    searchDepartment,
    setSearchDepartment,
  ] = useState<
    string |
    undefined
  >();


  // ====================================================
  // DATA
  // ====================================================

  const [
    items,
    setItems,
  ] = useState<
    MedicalStaffItem[]
  >(
    []
  );


  const [
    departments,
    setDepartments,
  ] = useState<
    DepartmentOption[]
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


  // ====================================================
  // UI STATE
  // ====================================================

  const [
    loading,
    setLoading,
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
    modalOpen,
    setModalOpen,
  ] = useState(
    false
  );


  const [
    editingStaff,
    setEditingStaff,
  ] = useState<
    MedicalStaffItem |
    null
  >(
    null
  );


  const [
    form,
  ] =
    Form.useForm<
      MedicalStaffFormValues
    >();


  // ====================================================
  // IMPORT STATE
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
    MedicalStaffImportResult |
    null
  >(
    null
  );


  const [
    importErrors,
    setImportErrors,
  ] = useState<
    MedicalStaffImportError[]
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
  // LOAD DEPARTMENTS
  // ====================================================

  const loadDepartments =
    useCallback(
      async () => {

        try {

          const response =
            await apiFetch(
              "/catalog/departments?active=true&page=1&pageSize=100",
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
              "Không thể tải danh mục khoa."
            );
          }


          setDepartments(
            (
              json.data
                ?.items ??
              []
            ).map(
              (
                item:
                  DepartmentOption
              ) => ({
                code:
                  item.code,

                name:
                  item.name,
              })
            )
          );

        } catch (
          error
        ) {

          console.error(
            "Load departments error:",
            error
          );
        }
      },
      []
    );


  // ====================================================
  // LOAD MEDICAL STAFF
  // ====================================================

  const loadMedicalStaff =
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
            searchName.trim()
          ) {

            params.set(
              "fullName",
              searchName.trim()
            );
          }


          if (
            searchLicense.trim()
          ) {

            params.set(
              "licenseNumber",
              searchLicense.trim()
            );
          }


          if (
            searchBhxh.trim()
          ) {

            params.set(
              "socialInsuranceCode",
              searchBhxh.trim()
            );
          }


          if (
            searchDepartment
          ) {

            params.set(
              "departmentCode",
              searchDepartment
            );
          }


          const response =
            await apiFetch(
              `/catalog/medical-staff?${params.toString()}`,
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
              "Không thể tải danh mục nhân viên y tế."
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
              : "Không thể tải nhân viên y tế."
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
        searchName,
        searchLicense,
        searchBhxh,
        searchDepartment,
      ]
    );


  // ====================================================
  // INITIAL LOAD
  // ====================================================

  useEffect(
    () => {

      void loadDepartments();

      void loadMedicalStaff();

    },
    [
      loadDepartments,
      loadMedicalStaff,
    ]
  );


  // ====================================================
  // ADD
  // ====================================================

  function openAddModal() {

    setEditingStaff(
      null
    );


    form.resetFields();


    form.setFieldsValue({
      fullName:
        "",

      socialInsuranceCode:
        "",

      licenseNumber:
        "",

      gender:
        undefined,

      licenseIssueDate:
        "",

      professionalTitle:
        "",

      licenseIssuer:
        "",

      professionalScope:
        "",

      registrationTime:
        "",

      dailyTime:
        "",

      weeklyTime:
        "",

      position:
        "",

      note:
        "",

      departmentCodes:
        [],

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
      MedicalStaffItem
  ) {

    try {

      const response =
        await apiFetch(
          `/catalog/medical-staff/${encodeURIComponent(
            record.id
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
          "Không thể tải nhân viên y tế."
        );
      }


      const data =
        json.data;


      setEditingStaff(
        record
      );


      form.setFieldsValue({
        fullName:
          data.fullName ??
          "",

        socialInsuranceCode:
          data.socialInsuranceCode ??
          "",

        licenseNumber:
          data.licenseNumber ??
          "",

        gender:
          data.gender ??
          undefined,

        licenseIssueDate:
          data.licenseIssueDate ??
          "",

        professionalTitle:
          data.professionalTitle ??
          "",

        licenseIssuer:
          data.licenseIssuer ??
          "",

        professionalScope:
          data.professionalScope ??
          "",

        registrationTime:
          data.registrationTime ??
          "",

        dailyTime:
          data.dailyTime ??
          "",

        weeklyTime:
          data.weeklyTime ??
          "",

        position:
          data.position ??
          "",

        note:
          data.note ??
          "",

        departmentCodes:
          Array.isArray(
            data.departments
          )
            ? data.departments.map(
                (
                  item:
                    DepartmentOption
                ) =>
                  item.code
              )
            : [],

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
          : "Không thể tải nhân viên y tế."
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
        editingStaff !==
        null;


      const endpoint =
        isEdit
          ? `/catalog/medical-staff/${encodeURIComponent(
              editingStaff.id
            )}`
          : "/catalog/medical-staff";


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
                fullName:
                  values.fullName
                    .trim(),

                socialInsuranceCode:
                  values
                    .socialInsuranceCode
                    ?.trim() ||
                  null,

                licenseNumber:
                  values
                    .licenseNumber
                    ?.trim() ||
                  null,

                gender:
                  values.gender ||
                  null,

                licenseIssueDate:
                  values
                    .licenseIssueDate ||
                  null,

                professionalTitle:
                  values
                    .professionalTitle
                    ?.trim() ||
                  null,

                licenseIssuer:
                  values
                    .licenseIssuer
                    ?.trim() ||
                  null,

                professionalScope:
                  values
                    .professionalScope
                    ?.trim() ||
                  null,

                registrationTime:
                  values
                    .registrationTime
                    ?.trim() ||
                  null,

                dailyTime:
                  values
                    .dailyTime
                    ?.trim() ||
                  null,

                weeklyTime:
                  values
                    .weeklyTime
                    ?.trim() ||
                  null,

                position:
                  values
                    .position
                    ?.trim() ||
                  null,

                note:
                  values.note
                    ?.trim() ||
                  null,

                departmentCodes:
                  values
                    .departmentCodes ??
                  [],

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
          "Không thể lưu nhân viên y tế."
        );
      }


      message.success(
        isEdit
          ? "Cập nhật nhân viên y tế thành công."
          : "Thêm nhân viên y tế thành công."
      );


      setModalOpen(
        false
      );


      setEditingStaff(
        null
      );


      form.resetFields();


      await loadMedicalStaff();

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
          : "Không thể lưu nhân viên y tế."
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
      MedicalStaffItem
  ) {

    Modal.confirm({
      title:
        "Ngừng sử dụng nhân viên y tế?",

      content:
        `${record.fullName}${
          record.licenseNumber
            ? ` - ${record.licenseNumber}`
            : ""
        }`,

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
                `/catalog/medical-staff/${encodeURIComponent(
                  record.id
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
                "Không thể ngừng sử dụng nhân viên y tế."
              );
            }


            message.success(
              "Đã ngừng sử dụng nhân viên y tế."
            );


            await loadMedicalStaff();

          } catch (
            error
          ) {

            message.error(
              error instanceof
              Error
                ? error.message
                : "Không thể ngừng sử dụng nhân viên y tế."
            );
          }
        },
    });
  }


  // ====================================================
  // REFRESH
  // ====================================================

  function handleRefresh() {

    setSearchName(
      ""
    );


    setSearchLicense(
      ""
    );


    setSearchBhxh(
      ""
    );


    setSearchDepartment(
      undefined
    );


    setPage(
      1
    );
  }


  // ====================================================
  // IMPORT OPEN / CLOSE
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


  // ====================================================
  // IMPORT EXCEL
  // ====================================================

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
          "/catalog/medical-staff/import",
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

        // Backend không trả JSON.
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
          "Import nhân viên y tế thất bại."
        );


        message.error(
          json?.message ||
          "Import nhân viên y tế thất bại."
        );


        return;
      }


      const result:
        MedicalStaffImportResult = {

        totalRows:
          Number(
            json.data
              ?.totalRows ??
            0
          ),

        inserted:
          Number(
            json.data
              ?.inserted ??
            0
          ),

        updated:
          Number(
            json.data
              ?.updated ??
            0
          ),

        skipped:
          Number(
            json.data
              ?.skipped ??
            0
          ),
      };


      setImportResult(
        result
      );


      setImportMessage(
        json?.message ||
        "Import nhân viên y tế thành công."
      );


      message.success(
        json?.message ||
        "Import nhân viên y tế thành công."
      );


      if (
        page !==
        1
      ) {

        setPage(
          1
        );

      } else {

        await loadMedicalStaff();
      }

    } catch (
      error
    ) {

      const text =
        error instanceof
        Error
          ? error.message
          : "Import nhân viên y tế thất bại.";


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
  // TABLE COLUMNS
  // ====================================================

  const columns = [

    {
      title:
        "",

      key:
        "action",

      width:
        46,

      fixed:
        "left" as const,

      align:
        "center" as const,

      render:
        (
          _:
            unknown,

          record:
            MedicalStaffItem
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

              size="small"

              icon={
                <EllipsisOutlined />
              }
            />

          </Dropdown>
        ),
    },


    {
      title:
        "STT",

      key:
        "stt",

      width:
        58,

      align:
        "center" as const,

      render:
        (
          _:
            unknown,

          __:
            MedicalStaffItem,

          index:
            number
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
        "Họ tên",

      dataIndex:
        "fullName",

      width:
        180,

      ellipsis:
        true,
    },


    {
      title:
        "Mã BHXH",

      dataIndex:
        "socialInsuranceCode",

      width:
        135,

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
        "Mã CCHN",

      dataIndex:
        "licenseNumber",

      width:
        165,

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
        "Mã khoa",

      key:
        "departmentCodes",

      width:
        120,

      ellipsis:
        true,

      render:
        (
          _:
            unknown,

          record:
            MedicalStaffItem
        ) => {

        if (
          !Array.isArray(
            record.departments
          ) ||
          record.departments.length ===
            0
        ) {

          return "-";
        }


        return record.departments
          .map(
            (
              department
            ) =>
              department.code
          )
          .join(
            "; "
          );
      },
    },


    {
      title:
        "Khoa",

      key:
        "departmentNames",

      width:
        190,

      ellipsis:
        true,

      render:
        (
          _:
            unknown,

          record:
            MedicalStaffItem
        ) => {

        if (
          !Array.isArray(
            record.departments
          ) ||
          record.departments.length ===
            0
        ) {

          return "-";
        }


        return record.departments
          .map(
            (
              department
            ) =>
              department.name
          )
          .join(
            "; "
          );
      },
    },


    {
      title:
        "Giới tính",

      dataIndex:
        "gender",

      width:
        90,

      align:
        "center" as const,

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
        "Ngày cấp CCHN",

      dataIndex:
        "licenseIssueDate",

      width:
        125,

      render:
        (
          value:
            string |
            null
        ) =>
          formatDate(
            value
          ),
    },


    {
      title:
        "Chức danh NN",

      dataIndex:
        "professionalTitle",

      width:
        135,

      ellipsis:
        true,

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
        "Nơi cấp CCHN",

      dataIndex:
        "licenseIssuer",

      width:
        170,

      ellipsis:
        true,

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
        "Phạm vi CM",

      dataIndex:
        "professionalScope",

      width:
        200,

      ellipsis:
        true,

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
        "Thời gian ĐK",

      dataIndex:
        "registrationTime",

      width:
        120,

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
        "Thời gian ngày",

      dataIndex:
        "dailyTime",

      width:
        145,

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
        "Thời gian tuần",

      dataIndex:
        "weeklyTime",

      width:
        165,

      ellipsis:
        true,

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
        "Vị trí",

      dataIndex:
        "position",

      width:
        125,

      ellipsis:
        true,

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
        110,

      fixed:
        "right" as const,

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

                className="medical-staff-status"
              >
                Đang dùng
              </Tag>
            )
            : (
              <Tag
                className="medical-staff-status"
              >
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

      <div
        className="medical-staff-page"
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <div
          className="medical-staff-header"
        >

          <div>

            <div
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                gap:
                  10,
              }}
            >

              <TeamOutlined
                style={{
                  fontSize:
                    25,

                  color:
                    "#1677ff",
                }}
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
                Nhân viên y tế
              </Title>

            </div>


            <Text
              type="secondary"

              className="medical-staff-subtitle"
            >
              Quản lý danh mục bác sĩ và nhân viên y tế
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
              Import Excel
            </Button>


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

        </div>


        {/* =================================================
            FILTER
        ================================================= */}

        <div
          className="medical-staff-filters"
        >

          <div
            className="medical-staff-filter"
          >

            <Text
              strong

              className="medical-staff-filter-label"
            >
              Họ tên
            </Text>


            <Input
              value={
                searchName
              }

              placeholder="Họ tên"

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


          <div
            className="medical-staff-filter"
          >

            <Text
              strong

              className="medical-staff-filter-label"
            >
              Mã CCHN
            </Text>


            <Input
              value={
                searchLicense
              }

              placeholder="Mã CCHN"

              allowClear

              onChange={(
                event
              ) => {

                setSearchLicense(
                  event.target.value
                );


                setPage(
                  1
                );
              }}
            />

          </div>


          <div
            className="medical-staff-filter"
          >

            <Text
              strong

              className="medical-staff-filter-label"
            >
              Mã BHXH
            </Text>


            <Input
              value={
                searchBhxh
              }

              placeholder="Mã BHXH"

              allowClear

              onChange={(
                event
              ) => {

                setSearchBhxh(
                  event.target.value
                );


                setPage(
                  1
                );
              }}
            />

          </div>


          <div
            className="medical-staff-filter"
          >

            <Text
              strong

              className="medical-staff-filter-label"
            >
              Khoa
            </Text>


            <Select
              value={
                searchDepartment
              }

              allowClear

              showSearch

              optionFilterProp="label"

              placeholder="Tất cả khoa"

              style={{
                width:
                  "100%",
              }}

              options={
                departments.map(
                  (
                    item
                  ) => ({
                    value:
                      item.code,

                    label:
                      `${item.code} - ${item.name}`,
                  })
                )
              }

              onChange={(
                value
              ) => {

                setSearchDepartment(
                  value
                );


                setPage(
                  1
                );
              }}
            />

          </div>


          <Button
            type="primary"

            ghost

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

        <Table<MedicalStaffItem>
          className="medical-staff-table"

          rowKey="id"

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

          tableLayout="fixed"

          scroll={{
            x:
              2350,
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
              "Chưa có dữ liệu nhân viên y tế",
          }}
        />

      </div>


      {/* =================================================
          ADD / EDIT MODAL
      ================================================= */}

      <Modal
        open={
          modalOpen
        }

        title={
          editingStaff
            ? "Cập nhật Nhân viên y tế"
            : "Thêm Nhân viên y tế"
        }

        width={
          1050
        }

        okText={
          editingStaff
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


          setEditingStaff(
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

          className="medical-staff-form"
        >

          <div
            className="medical-staff-form-grid medical-staff-form-grid-3"
          >

            <Form.Item
              label="Họ tên"

              name="fullName"

              rules={[
                {
                  required:
                    true,

                  whitespace:
                    true,

                  message:
                    "Vui lòng nhập họ tên.",
                },
              ]}
            >

              <Input
                placeholder="Họ tên"
              />

            </Form.Item>


            <Form.Item
              label="Mã BHXH"

              name="socialInsuranceCode"
            >

              <Input
                placeholder="Mã BHXH"
              />

            </Form.Item>


            <Form.Item
              label="Mã CCHN"

              name="licenseNumber"
            >

              <Input
                placeholder="Mã CCHN"
              />

            </Form.Item>

          </div>


          <div
            className="medical-staff-form-grid medical-staff-form-grid-3"
          >

            <Form.Item
              label="Giới tính"

              name="gender"
            >

              <Select
                allowClear

                placeholder="Giới tính"

                options={[
                  {
                    value:
                      "Nam",

                    label:
                      "Nam",
                  },

                  {
                    value:
                      "Nữ",

                    label:
                      "Nữ",
                  },

                  {
                    value:
                      "Khác",

                    label:
                      "Khác",
                  },
                ]}
              />

            </Form.Item>


            <Form.Item
              label="Ngày cấp CCHN"

              name="licenseIssueDate"
            >

              <Input
                type="date"
              />

            </Form.Item>


            <Form.Item
              label="Chức danh nghề nghiệp"

              name="professionalTitle"
            >

              <Input
                placeholder="Chức danh nghề nghiệp"
              />

            </Form.Item>

          </div>


          <div
            className="medical-staff-form-grid medical-staff-form-grid-2"
          >

            <Form.Item
              label="Nơi cấp CCHN"

              name="licenseIssuer"
            >

              <Input
                placeholder="Nơi cấp CCHN"
              />

            </Form.Item>


            <Form.Item
              label="Vị trí"

              name="position"
            >

              <Input
                placeholder="Vị trí"
              />

            </Form.Item>

          </div>


          <Form.Item
            label="Khoa"

            name="departmentCodes"
          >

            <Select
              mode="multiple"

              allowClear

              showSearch

              optionFilterProp="label"

              placeholder="Chọn một hoặc nhiều khoa"

              options={
                departments.map(
                  (
                    item
                  ) => ({
                    value:
                      item.code,

                    label:
                      `${item.code} - ${item.name}`,
                  })
                )
              }
            />

          </Form.Item>


          <Form.Item
            label="Phạm vi chuyên môn"

            name="professionalScope"
          >

            <Input.TextArea
              rows={
                2
              }

              placeholder="Phạm vi chuyên môn"
            />

          </Form.Item>


          <div
            className="medical-staff-form-grid medical-staff-form-grid-3"
          >

            <Form.Item
              label="Thời gian đăng ký"

              name="registrationTime"
            >

              <Input
                placeholder="Ví dụ: 1"
              />

            </Form.Item>


            <Form.Item
              label="Thời gian ngày"

              name="dailyTime"
            >

              <Input
                placeholder="Ví dụ: 0700-1900"
              />

            </Form.Item>


            <Form.Item
              label="Thời gian tuần"

              name="weeklyTime"
            >

              <Input
                placeholder="Ví dụ: T2T3T4T5T6T7"
              />

            </Form.Item>

          </div>


          <Form.Item
            label="Ghi chú"

            name="note"
          >

            <Input.TextArea
              rows={
                2
              }

              placeholder="Ghi chú"
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


      {/* =================================================
          IMPORT EXCEL MODAL
      ================================================= */}

      <Modal
        open={
          importModalOpen
        }

        title="Import Danh mục Nhân viên y tế"

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

            message="Import Nhân viên y tế từ Excel"

            description={
              <>
                Hệ thống tự nhận diện sheet có các cột{" "}
                <b>MA_BHXH</b>,{" "}
                <b>HO_TEN</b>{" "}
                và{" "}
                <b>MACCHN</b>.
                {" "}
                MA_KHOA hỗ trợ nhiều khoa,
                phân cách bằng dấu chấm phẩy.
                {" "}
                Nhân viên đã tồn tại sẽ được
                nhận diện theo MA_BHXH hoặc
                MACCHN và được cập nhật.
                {" "}
                Nếu có mã khoa chưa tồn tại
                hoặc file có dữ liệu lỗi thì
                toàn bộ lần import sẽ bị hủy.
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

              className="medical-staff-import-alert"

              message={
                importMessage ||
                "Import nhân viên y tế thành công."
              }

              description={
                <div
                  className="medical-staff-import-summary"
                >

                  <div>
                    <span>
                      Tổng số nhân viên
                    </span>

                    <b>
                      {
                        importResult.totalRows
                      }
                    </b>
                  </div>


                  <div>
                    <span>
                      Thêm mới
                    </span>

                    <b>
                      {
                        importResult.inserted
                      }
                    </b>
                  </div>


                  <div>
                    <span>
                      Cập nhật
                    </span>

                    <b>
                      {
                        importResult.updated
                      }
                    </b>
                  </div>


                  <div>
                    <span>
                      Bỏ qua
                    </span>

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

                description="Không có nhân viên nào được import. Hãy sửa các dòng lỗi rồi import lại."

                style={{
                  marginBottom:
                    12,
                }}
              />


              <Table<MedicalStaffImportError>
                className="medical-staff-import-table"

                size="small"

                rowKey={(
                  record,
                  index
                ) =>
                  `${record.row}-${record.field}-${index}`
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
                      180,
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


      {/* =================================================
          STYLE
      ================================================= */}

      <style>
        {`
          .medical-staff-page {
            width: 100%;
          }

          .medical-staff-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 16px;
          }

          .medical-staff-header h3 {
            color: #172033 !important;
            font-size: 22px !important;
            font-weight: 800 !important;
          }

          .medical-staff-subtitle {
            display: block;
            margin-top: 3px;
            font-size: 12px;
          }

          .medical-staff-filters {
            display: grid;
            grid-template-columns:
              minmax(220px, 1.4fr)
              minmax(170px, 1fr)
              minmax(170px, 1fr)
              minmax(220px, 1.2fr)
              auto;
            gap: 10px;
            align-items: end;
            margin-bottom: 14px;
          }

          .medical-staff-filter {
            min-width: 0;
          }

          .medical-staff-filter-label {
            display: block;
            margin-bottom: 6px;
            color: #172033;
            font-size: 12px;
            font-weight: 700;
          }

          .medical-staff-table {
            border: 1px solid #e6ebf1;
            border-radius: 8px;
            overflow: hidden;
          }

          .medical-staff-table
          .ant-table {
            border-radius: 8px;
          }

          .medical-staff-table
          .ant-table-container {
            border-start-start-radius: 8px;
            border-start-end-radius: 8px;
          }

          .medical-staff-table
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

          .medical-staff-table
          .ant-table-tbody
          > tr
          > td {
            padding: 11px 10px !important;
            color: #202a3b;
            font-size: 12px;
            vertical-align: middle;
            border-bottom: 1px solid #edf0f5 !important;
          }

          .medical-staff-table
          .ant-table-tbody
          > tr:hover
          > td {
            background: #f7fbff !important;
          }

          .medical-staff-table
          .ant-table-cell-fix-left,
          .medical-staff-table
          .ant-table-cell-fix-right {
            background: #ffffff;
          }

          .medical-staff-table
          .ant-table-thead
          .ant-table-cell-fix-left,
          .medical-staff-table
          .ant-table-thead
          .ant-table-cell-fix-right {
            background: #f3f6f9 !important;
          }

          .medical-staff-table
          .ant-pagination {
            margin: 14px 8px 6px;
          }

          .medical-staff-status {
            margin: 0;
            border-radius: 6px;
            font-size: 11px;
          }

          .medical-staff-form {
            margin-top: 18px;
          }

          .medical-staff-form-grid {
            display: grid;
            gap: 16px;
          }

          .medical-staff-form-grid-3 {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .medical-staff-form-grid-2 {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .medical-staff-import-alert {
            margin-top: 20px;
          }

          .medical-staff-import-summary {
            display: grid;
            grid-template-columns:
              repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-top: 8px;
          }

          .medical-staff-import-summary > div {
            display: flex;
            flex-direction: column;
            gap: 3px;
            padding: 10px 12px;
            background: rgba(255, 255, 255, 0.65);
            border-radius: 7px;
          }

          .medical-staff-import-summary span {
            font-size: 12px;
            color: #667085;
          }

          .medical-staff-import-summary b {
            font-size: 18px;
            color: #172033;
          }

          .medical-staff-import-table {
            border: 1px solid #e6ebf1;
            border-radius: 8px;
            overflow: hidden;
          }

          @media (max-width: 1100px) {
            .medical-staff-filters {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .medical-staff-form-grid-3 {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 720px) {
            .medical-staff-header {
              flex-direction: column;
            }

            .medical-staff-filters {
              grid-template-columns: 1fr;
            }

            .medical-staff-form-grid-3,
            .medical-staff-form-grid-2 {
              grid-template-columns: 1fr;
            }

            .medical-staff-import-summary {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }
          }
        `}
      </style>

    </>
  );
}