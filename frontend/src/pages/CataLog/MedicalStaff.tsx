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
    string |
    null |
    undefined
) {
  if (!value) {
    return "-";
  }

  const text =
    String(
      value
    ).trim();

  const yyyyMmDd =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  if (
    yyyyMmDd
  ) {
    return (
      `${yyyyMmDd[3]}/` +
      `${yyyyMmDd[2]}/` +
      `${yyyyMmDd[1]}`
    );
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
    string |
    null;

  licenseNumber:
    string |
    null;

  gender:
    string |
    null;

  licenseIssueDate:
    string |
    null;

  professionalTitle:
    string |
    null;

  licenseIssuer:
    string |
    null;

  professionalScope:
    string |
    null;

  registrationTime:
    string |
    null;

  dailyTime:
    string |
    null;

  weeklyTime:
    string |
    null;

  position:
    string |
    null;

  note:
    string |
    null;

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
  // IMPORT - OPEN
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


  // ====================================================
  // IMPORT - CLOSE
  // ====================================================

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

            // Không tự gắn Content-Type.
            // Browser tự tạo multipart/form-data + boundary.
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


      // ==================================================
      // ERROR
      // ==================================================

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


      // ==================================================
      // SUCCESS
      // ==================================================

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

    // ==================================================
    // ACTION
    // ==================================================

    {
      title:
        "",

      key:
        "action",

      width:
        50,

      fixed:
        "left" as const,

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

              icon={
                <EllipsisOutlined />
              }
            />

          </Dropdown>
        ),
    },


    // ==================================================
    // STT
    // ==================================================

    {
      title:
        "STT",

      key:
        "stt",

      width:
        70,

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


    // ==================================================
    // HỌ TÊN
    // ==================================================

    {
      title:
        "Họ tên",

      dataIndex:
        "fullName",

      width:
        200,
    },


    // ==================================================
    // MÃ BHXH
    // ==================================================

    {
      title:
        "Mã BHXH",

      dataIndex:
        "socialInsuranceCode",

      width:
        150,

      render:
        (
          value:
            string |
            null
        ) =>
          value ||
          "-",
    },


    // ==================================================
    // MÃ CCHN
    // ==================================================

    {
      title:
        "Mã CCHN",

      dataIndex:
        "licenseNumber",

      width:
        170,

      render:
        (
          value:
            string |
            null
        ) =>
          value ||
          "-",
    },


    // ==================================================
    // MÃ KHOA
    // ==================================================

    {
      title:
        "Mã khoa",

      key:
        "departmentCodes",

      width:
        150,

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


    // ==================================================
    // KHOA
    // ==================================================

    {
      title:
        "Khoa",

      key:
        "departmentNames",

      width:
        210,

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


    // ==================================================
    // GIỚI TÍNH
    // ==================================================

    {
      title:
        "Giới tính",

      dataIndex:
        "gender",

      width:
        100,

      render:
        (
          value:
            string |
            null
        ) =>
          value ||
          "-",
    },


    // ==================================================
    // NGÀY CẤP
    // ==================================================

    {
      title:
        "Ngày cấp CCHN",

      dataIndex:
        "licenseIssueDate",

      width:
        145,

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


    // ==================================================
    // CHỨC DANH
    // ==================================================

    {
      title:
        "Chức danh NN",

      dataIndex:
        "professionalTitle",

      width:
        150,

      render:
        (
          value:
            string |
            null
        ) =>
          value ||
          "-",
    },


    // ==================================================
    // NƠI CẤP
    // ==================================================

    {
      title:
        "Nơi cấp CCHN",

      dataIndex:
        "licenseIssuer",

      width:
        180,

      render:
        (
          value:
            string |
            null
        ) =>
          value ||
          "-",
    },


    // ==================================================
    // PHẠM VI
    // ==================================================

    {
      title:
        "Phạm vi CM",

      dataIndex:
        "professionalScope",

      width:
        200,

      render:
        (
          value:
            string |
            null
        ) =>
          value ||
          "-",
    },


    // ==================================================
    // THỜI GIAN ĐK
    // ==================================================

    {
      title:
        "Thời gian ĐK",

      dataIndex:
        "registrationTime",

      width:
        130,

      render:
        (
          value:
            string |
            null
        ) =>
          value ||
          "-",
    },


    // ==================================================
    // THỜI GIAN NGÀY
    // ==================================================

    {
      title:
        "Thời gian ngày",

      dataIndex:
        "dailyTime",

      width:
        150,

      render:
        (
          value:
            string |
            null
        ) =>
          value ||
          "-",
    },


    // ==================================================
    // THỜI GIAN TUẦN
    // ==================================================

    {
      title:
        "Thời gian tuần",

      dataIndex:
        "weeklyTime",

      width:
        180,

      render:
        (
          value:
            string |
            null
        ) =>
          value ||
          "-",
    },


    // ==================================================
    // VỊ TRÍ
    // ==================================================

    {
      title:
        "Vị trí",

      dataIndex:
        "position",

      width:
        140,

      render:
        (
          value:
            string |
            null
        ) =>
          value ||
          "-",
    },


    // ==================================================
    // STATUS
    // ==================================================

    {
      title:
        "Trạng thái",

      dataIndex:
        "active",

      width:
        120,

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

      {/* =================================================
          HEADER
      ================================================= */}

      <Space
        style={{
          width:
            "100%",

          justifyContent:
            "space-between",

          marginBottom:
            18,
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
          Nhân viên y tế
        </Title>


        <Space>

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

      </Space>


      {/* =================================================
          FILTER
      ================================================= */}

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "1.4fr 1fr 1fr 1.2fr auto",

          gap:
            10,

          alignItems:
            "end",

          marginBottom:
            16,
        }}
      >

        {/* HỌ TÊN */}

        <div>

          <Text>
            Họ tên
          </Text>

          <Input
            value={
              searchName
            }

            placeholder="Họ tên"

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


        {/* MÃ CCHN */}

        <div>

          <Text>
            Mã CCHN
          </Text>

          <Input
            value={
              searchLicense
            }

            placeholder="Mã CCHN"

            allowClear

            style={{
              marginTop:
                5,
            }}

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


        {/* MÃ BHXH */}

        <div>

          <Text>
            Mã BHXH
          </Text>

          <Input
            value={
              searchBhxh
            }

            placeholder="Mã BHXH"

            allowClear

            style={{
              marginTop:
                5,
            }}

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


        {/* KHOA */}

        <div>

          <Text>
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

              marginTop:
                5,
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


        {/* REFRESH */}

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


      {/* =================================================
          TABLE
      ================================================= */}

      <Table<MedicalStaffItem>
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
            2600,
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

          style={{
            marginTop:
              18,
          }}
        >

          {/* ROW 1 */}

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1.4fr 1fr 1fr",

              gap:
                16,
            }}
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


          {/* ROW 2 */}

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr 1fr 1.4fr",

              gap:
                16,
            }}
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

              <Input />

            </Form.Item>

          </div>


          {/* ROW 3 */}

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
              label="Nơi cấp CCHN"

              name="licenseIssuer"
            >

              <Input />

            </Form.Item>


            <Form.Item
              label="Vị trí"

              name="position"
            >

              <Input />

            </Form.Item>

          </div>


          {/* KHOA */}

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


          {/* PHẠM VI */}

          <Form.Item
            label="Phạm vi chuyên môn"

            name="professionalScope"
          >

            <Input.TextArea
              rows={
                2
              }
            />

          </Form.Item>


          {/* TIME */}

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr 1fr 1fr",

              gap:
                16,
            }}
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


          {/* NOTE */}

          <Form.Item
            label="Ghi chú"

            name="note"
          >

            <Input.TextArea
              rows={
                2
              }
            />

          </Form.Item>


          {/* ACTIVE */}

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
                Hệ thống tự nhận diện sheet có các cột <b>MA_BHXH</b>, <b>HO_TEN</b> và <b>MACCHN</b>.
                {" "}
                MA_KHOA hỗ trợ nhiều khoa, phân cách bằng dấu chấm phẩy.
                {" "}
                Nhân viên đã tồn tại sẽ được nhận diện theo MA_BHXH hoặc MACCHN và được cập nhật.
                {" "}
                Nếu có mã khoa chưa tồn tại hoặc file có dữ liệu lỗi thì toàn bộ lần import sẽ bị hủy.
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


          {/* =================================================
              SUCCESS
          ================================================= */}

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
                "Import nhân viên y tế thành công."
              }

              description={

                <div
                  style={{
                    lineHeight:
                      2,
                  }}
                >

                  <div>
                    Tổng số nhân viên:
                    {" "}
                    <b>
                      {importResult.totalRows}
                    </b>
                  </div>


                  <div>
                    Thêm mới:
                    {" "}
                    <b>
                      {importResult.inserted}
                    </b>
                  </div>


                  <div>
                    Cập nhật:
                    {" "}
                    <b>
                      {importResult.updated}
                    </b>
                  </div>


                  <div>
                    Bỏ qua:
                    {" "}
                    <b>
                      {importResult.skipped}
                    </b>
                  </div>

                </div>
              }
            />

          )}


          {/* =================================================
              GENERAL ERROR
          ================================================= */}

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


          {/* =================================================
              ROW ERRORS
          ================================================= */}

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
                  size="small"

                  bordered

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

    </>
  );
}