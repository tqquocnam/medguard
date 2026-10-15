import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import {
  Alert,
  Breadcrumb,
  Button,
  Card,
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
  Upload,
} from "antd";

import type {
  UploadFile,
} from "antd";

import type {
  ColumnsType,
} from "antd/es/table";

import {
  useEffect,
  useRef,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  apiFetch,
} from "../../api/apiClient";

const {
  Title,
  Text,
} = Typography;

interface ServiceItem {
  code: string;
  name: string;
  active?: boolean;
}

interface MedicalStaff {
  id: string;
  fullName: string;
  socialInsuranceCode?: string | null;
  licenseNumber?: string | null;
  active?: boolean;
}

interface ServiceStaffRow {
  id: string;

  service_code: string;

  staff_code: string;

  specialty_code?: string | null;

  activity_type: string;

  allowed: boolean;

  active: boolean;

  note?: string | null;

  created_at?: string;
}

interface FormValues {
  service_code: string;

  staff_code: string;

  specialty_code?: string;

  activity_type: string;

  allowed: boolean;

  active: boolean;

  note?: string;
}

interface ServiceListResponse {
  success?: boolean;

  message?: string;

  data?: {
    items?: ServiceItem[];

    total?: number;
  };
}

interface ServiceStaffImportPreviewRow {
  row: number;

  status:
    | "VALID"
    | "ERROR"
    | "DUPLICATE";

  serviceCode: string;

  staffCode: string;

  activityType: string;

  message: string;
}

interface ServiceStaffImportPreviewData {
  totalRows: number;

  valid: number;

  invalid: number;

  duplicate: number;

  rows: ServiceStaffImportPreviewRow[];
}

const ACTIVITY_OPTIONS = [
  {
    value:
      "CONGKHAM",

    label:
      "CONGKHAM - Công khám",
  },

  {
    value:
      "THUCHIEN_CDHA",

    label:
      "THUCHIEN_CDHA - Thực hiện CĐHA",
  },

  {
    value:
      "KETQUA_CDHA",

    label:
      "KETQUA_CDHA - Kết quả CĐHA",
  },

  {
    value:
      "THUCHIEN_PTTT",

    label:
      "THUCHIEN_PTTT - Thực hiện thủ thuật/Phẫu thuật",
  },

  {
    value:
      "THUCHIEN_XN",

    label:
      "THUCHIEN_XN - Thực hiện Xét nghiệm",
  },

  {
    value:
      "KETQUAXN",

    label:
      "KETQUAXN - Kết quả Xét nghiệm",
  },
];

function getActivityLabel(
  value: string
) {
  return (
    ACTIVITY_OPTIONS.find(
      (item) =>
        item.value ===
        value
    )?.label ??
    value
  );
}

export default function ServiceStaff() {
  // Chiều cao vùng cuộn được tính theo không gian còn lại của màn hình.
  // Chỉ cuộn nội dung bảng, không thay đổi dữ liệu hoặc phân trang.
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableScrollHeight, setTableScrollHeight] = useState(320);

  // Phân trang được kiểm soát bằng state: đổi 10/20/50/100 sẽ không bị
  // reset về 10 khi React render lại.
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);


  useEffect(() => {
    const updateHeight = () => {
      const element = tableContainerRef.current;
      if (!element) return;

      // Tính theo CHIỀU CAO THỰC của vùng bảng, không theo khoảng cách
      // tới đáy cửa sổ. Trừ header bảng (~40px), pagination (~66px)
      // và khoảng đệm. Nếu không trừ, pagination sẽ bị cắt.
      const available = element.getBoundingClientRect().height - 130;
      setTableScrollHeight(Math.max(80, Math.floor(available)));
    };

    const raf = window.requestAnimationFrame(updateHeight);
    window.addEventListener("resize", updateHeight);

    const observer = new ResizeObserver(updateHeight);
    if (tableContainerRef.current) {
      observer.observe(tableContainerRef.current);
    }

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateHeight);
      observer.disconnect();
    };
  }, []);

  const navigate =
    useNavigate();

  const [
    form,
  ] =
    Form.useForm<FormValues>();

  const [
    rows,
    setRows,
  ] =
    useState<
      ServiceStaffRow[]
    >([]);

  const [
    services,
    setServices,
  ] =
    useState<
      ServiceItem[]
    >([]);

  const [
    staffList,
    setStaffList,
  ] =
    useState<
      MedicalStaff[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );

  const [
    serviceLoading,
    setServiceLoading,
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
    modalOpen,
    setModalOpen,
  ] =
    useState(
      false
    );

  const [
    editing,
    setEditing,
  ] =
    useState<
      ServiceStaffRow |
      null
    >(
      null
    );

  const [
    filterServiceCode,
    setFilterServiceCode,
  ] =
    useState<
      string |
      undefined
    >();

  const [
    filterStaffCode,
    setFilterStaffCode,
  ] =
    useState<
      string |
      undefined
    >();

  const [
    filterActivityType,
    setFilterActivityType,
  ] =
    useState<
      string |
      undefined
    >();

  const [
    importOpen,
    setImportOpen,
  ] =
    useState(
      false
    );

  const [
    importing,
    setImporting,
  ] =
    useState(
      false
    );

  const [
    previewing,
    setPreviewing,
  ] =
    useState(
      false
    );

  const [
    importFileList,
    setImportFileList,
  ] =
    useState<
      UploadFile[]
    >([]);

  const [
    importPreview,
    setImportPreview,
  ] =
    useState<
      ServiceStaffImportPreviewData |
      null
    >(
      null
    );

  async function loadRules() {
    try {
      setLoading(
        true
      );

      const response =
        await apiFetch(
          "/catalog/service-staff",
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
        json =
          null;
      }

      if (
        !response.ok ||
        json?.success !==
          true
      ) {
        throw new Error(
          json?.message ||
          "Không thể tải cấu hình DVKT - Nhân viên."
        );
      }

      const data =
        Array.isArray(
          json?.data
        )
          ? json.data
          : Array.isArray(
              json?.data?.items
            )
            ? json.data.items
            : [];

      setRows(
        data
      );
    } catch (
      error
    ) {
      console.error(
        "Load service staff error:",
        error
      );

      message.error(
        error instanceof Error
          ? error.message
          : "Không thể tải cấu hình DVKT - Nhân viên."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  async function requestServices(
    params:
      URLSearchParams
  ) {
    const response =
      await apiFetch(
        `/catalog/services?${params.toString()}`,
        {
          method:
            "GET",
        }
      );

    const json:
      ServiceListResponse =
      await response.json();

    if (
      !response.ok ||
      json.success !==
        true
    ) {
      throw new Error(
        json.message ||
        "Không thể tải danh mục DVKT."
      );
    }

    return Array.isArray(
      json.data?.items
    )
      ? json.data.items
      : [];
  }

  async function loadServices(
    keyword =
      ""
  ) {
    try {
      setServiceLoading(
        true
      );

      const search =
        keyword
          .trim();

      if (
        !search
      ) {
        const params =
          new URLSearchParams({
            page:
              "1",

            pageSize:
              "50",

            active:
              "true",
          });

        const items =
          await requestServices(
            params
          );

        setServices(
          items
        );

        return;
      }

      const nameParams =
        new URLSearchParams({
          page:
            "1",

          pageSize:
            "50",

          active:
            "true",

          name:
            search,
        });

      const codeParams =
        new URLSearchParams({
          page:
            "1",

          pageSize:
            "50",

          active:
            "true",

          code:
            search,
        });

      const [
        byName,
        byCode,
      ] =
        await Promise.all([
          requestServices(
            nameParams
          ),

          requestServices(
            codeParams
          ),
        ]);

      const map =
        new Map<
          string,
          ServiceItem
        >();

      for (
        const item
        of [
          ...byName,
          ...byCode,
        ]
      ) {
        map.set(
          item.code,
          item
        );
      }

      const result =
        Array.from(
          map.values()
        );

      result.sort(
        (
          a,
          b
        ) => {
          const nameCompare =
            String(
              a.name ??
              ""
            ).localeCompare(
              String(
                b.name ??
                ""
              ),
              "vi"
            );

          if (
            nameCompare !==
            0
          ) {
            return nameCompare;
          }

          return a.code.localeCompare(
            b.code
          );
        }
      );

      setServices(
        result
      );
    } catch (
      error
    ) {
      console.error(
        "Load services error:",
        error
      );

      message.error(
        error instanceof Error
          ? error.message
          : "Không thể tải danh mục DVKT."
      );
    } finally {
      setServiceLoading(
        false
      );
    }
  }

  async function loadStaff() {
    try {
      const response =
        await apiFetch(
          "/catalog/medical-staff?page=1&pageSize=1000&active=true",
          {
            method:
              "GET",
          }
        );

      const json =
        await response.json();

      if (
        !response.ok ||
        json?.success !==
          true
      ) {
        throw new Error(
          json?.message ||
          "Không thể tải danh mục nhân viên."
        );
      }

      setStaffList(
        Array.isArray(
          json?.data?.items
        )
          ? json.data.items
          : Array.isArray(
              json?.data
            )
            ? json.data
            : []
      );
    } catch (
      error
    ) {
      console.error(
        "Load staff error:",
        error
      );

      message.error(
        error instanceof Error
          ? error.message
          : "Không thể tải danh mục nhân viên."
      );
    }
  }

  useEffect(
    () => {
      void Promise.all([
        loadRules(),
        loadServices(),
        loadStaff(),
      ]);
    },
    []
  );

  const serviceOptions =
    useMemo(
      () =>
        services.map(
          (
            item
          ) => ({
            value:
              item.code,

            label:
              `${item.code} - ${item.name}`,
          })
        ),
      [
        services,
      ]
    );

  const staffOptions =
    useMemo(
      () => {
        const options:
          Array<{
            value:
              string;

            label:
              string;
          }> =
          [];

        const seen =
          new Set<
            string
          >();

        for (
          const staff
          of staffList
        ) {
          const license =
            String(
              staff.licenseNumber ??
              ""
            ).trim();

          const socialInsurance =
            String(
              staff.socialInsuranceCode ??
              ""
            ).trim();

          const code =
            license ||
            socialInsurance;

          if (
            !code ||
            seen.has(
              code
            )
          ) {
            continue;
          }

          seen.add(
            code
          );

          options.push({
            value:
              code,

            label:
              `${staff.fullName} - ${code}`,
          });
        }

        options.sort(
          (
            a,
            b
          ) =>
            a.label.localeCompare(
              b.label,
              "vi"
            )
        );

        return options;
      },
      [
        staffList,
      ]
    );

  const serviceMap =
    useMemo(
      () =>
        new Map(
          services.map(
            (
              item
            ) => [
              item.code,
              item,
            ]
          )
        ),
      [
        services,
      ]
    );

  const staffMap =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            MedicalStaff
          >();

        for (
          const staff
          of staffList
        ) {
          const license =
            String(
              staff.licenseNumber ??
              ""
            ).trim();

          const socialInsurance =
            String(
              staff.socialInsuranceCode ??
              ""
            ).trim();

          if (
            license
          ) {
            map.set(
              license,
              staff
            );
          }

          if (
            socialInsurance
          ) {
            map.set(
              socialInsurance,
              staff
            );
          }
        }

        return map;
      },
      [
        staffList,
      ]
    );

  const filteredRows =
    useMemo(
      () =>
        rows.filter(
          (
            item
          ) => {
            if (
              filterServiceCode &&
              item.service_code !==
                filterServiceCode
            ) {
              return false;
            }

            if (
              filterStaffCode &&
              item.staff_code !==
                filterStaffCode
            ) {
              return false;
            }

            if (
              filterActivityType &&
              item.activity_type !==
                filterActivityType
            ) {
              return false;
            }

            return true;
          }
        ),
      [
        rows,
        filterServiceCode,
        filterStaffCode,
        filterActivityType,
      ]
    );

  // Khi thay đổi bộ lọc, quay về trang đầu để không bị rỗng bảng.
  useEffect(() => {
    setCurrentPage(1);
  }, [filterServiceCode, filterStaffCode, filterActivityType]);

  // Khi số bản ghi giảm (xóa/import/lọc), đảm bảo currentPage vẫn hợp lệ.
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    setCurrentPage((page) => Math.min(page, maxPage));
  }, [filteredRows.length, pageSize]);

  function resetFilters() {
    setFilterServiceCode(
      undefined
    );

    setFilterStaffCode(
      undefined
    );

    setFilterActivityType(
      undefined
    );

    void loadServices();

    void loadRules();
  }

  function openCreate() {
    setEditing(
      null
    );

    form.resetFields();

    form.setFieldsValue({
      service_code:
        filterServiceCode ??
        "",

      staff_code:
        filterStaffCode ??
        "",

      activity_type:
        filterActivityType ??
        "THUCHIEN_CDHA",

      specialty_code:
        "",

      allowed:
        true,

      active:
        true,

      note:
        "",
    });

    setModalOpen(
      true
    );

    if (
      services.length ===
      0
    ) {
      void loadServices();
    }
  }

  function openEdit(
    record:
      ServiceStaffRow
  ) {
    setEditing(
      record
    );

    form.resetFields();

    form.setFieldsValue({
      service_code:
        record.service_code,

      staff_code:
        record.staff_code,

      specialty_code:
        record.specialty_code ??
        "",

      activity_type:
        record.activity_type,

      allowed:
        record.allowed,

      active:
        record.active,

      note:
        record.note ??
        "",
    });

    setModalOpen(
      true
    );

    const existingService =
      services.some(
        (
          item
        ) =>
          item.code ===
          record.service_code
      );

    if (
      !existingService
    ) {
      void loadServices(
        record.service_code
      );
    }
  }

  async function handleSave() {
    try {
      const values =
        await form
          .validateFields();

      setSaving(
        true
      );

      const url =
        editing
          ? `/catalog/service-staff/${editing.id}`
          : "/catalog/service-staff";

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
              JSON.stringify({
                service_code:
                  values.service_code,

                staff_code:
                  values.staff_code,

                specialty_code:
                  values.specialty_code
                    ?.trim() ||
                  null,

                activity_type:
                  values.activity_type,

                allowed:
                  values.allowed,

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
        json =
          null;
      }

      if (
        !response.ok ||
        json?.success !==
          true
      ) {
        throw new Error(
          json?.message ||
          "Không thể lưu cấu hình."
        );
      }

      message.success(
        editing
          ? "Cập nhật cấu hình thành công."
          : "Thêm cấu hình thành công."
      );

      setModalOpen(
        false
      );

      setEditing(
        null
      );

      form.resetFields();

      await loadRules();
    } catch (
      error
    ) {
      if (
        error instanceof Error
      ) {
        message.error(
          error.message
        );
      }
    } finally {
      setSaving(
        false
      );
    }
  }

  async function handleDelete(
    id:
      string
  ) {
    try {
      const response =
        await apiFetch(
          `/catalog/service-staff/${id}`,
          {
            method:
              "DELETE",
          }
        );

      let json:
        any =
        null;

      try {
        json =
          await response.json();
      } catch {
        json =
          null;
      }

      if (
        !response.ok ||
        json?.success !==
          true
      ) {
        throw new Error(
          json?.message ||
          "Không thể xóa cấu hình."
        );
      }

      message.success(
        "Đã xóa cấu hình."
      );

      await loadRules();
    } catch (
      error
    ) {
      message.error(
        error instanceof Error
          ? error.message
          : "Không thể xóa cấu hình."
      );
    }
  }

  async function downloadTemplate() {
    try {
      const response =
        await apiFetch(
          "/catalog/service-staff/template",
          {
            method:
              "GET",
          }
        );

      if (
        !response.ok
      ) {
        let json:
          any =
          null;

        try {
          json =
            await response.json();
        } catch {
          json =
            null;
        }

        throw new Error(
          json?.message ||
          "Không thể tải file mẫu."
        );
      }

      const blob =
        await response.blob();

      const url =
        window.URL
          .createObjectURL(
            blob
          );

      const anchor =
        document.createElement(
          "a"
        );

      anchor.href =
        url;

      anchor.download =
        "service_staff_template.xlsx";

      document.body
        .appendChild(
          anchor
        );

      anchor.click();

      anchor.remove();

      window.URL
        .revokeObjectURL(
          url
        );
    } catch (
      error
    ) {
      message.error(
        error instanceof Error
          ? error.message
          : "Không thể tải file mẫu."
      );
    }
  }

  function openImportModal() {
    setImportFileList(
      []
    );

    setImportPreview(
      null
    );

    setImportOpen(
      true
    );
  }

  function closeImportModal() {
    if (
      importing ||
      previewing
    ) {
      return;
    }

    setImportOpen(
      false
    );

    setImportFileList(
      []
    );

    setImportPreview(
      null
    );
  }

  async function previewExcel(
    file:
      File
  ) {
    try {
      setPreviewing(
        true
      );

      setImportPreview(
        null
      );

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response =
        await apiFetch(
          "/catalog/service-staff/import/preview",
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
        json =
          null;
      }

      if (
        !response.ok ||
        json?.success !==
          true
      ) {
        throw new Error(
          json?.message ||
          "Không thể kiểm tra file Excel."
        );
      }

      const data:
        ServiceStaffImportPreviewData =
        {
          totalRows:
            Number(
              json?.data
                ?.totalRows ??
              0
            ),

          valid:
            Number(
              json?.data
                ?.valid ??
              0
            ),

          invalid:
            Number(
              json?.data
                ?.invalid ??
              0
            ),

          duplicate:
            Number(
              json?.data
                ?.duplicate ??
              0
            ),

          rows:
            Array.isArray(
              json?.data?.rows
            )
              ? json.data.rows
              : [],
        };

      setImportPreview(
        data
      );

      if (
        data.invalid >
        0
      ) {
        message.warning(
          `File có ${data.invalid} dòng lỗi.`
        );
      } else {
        message.success(
          "Đã kiểm tra file Excel."
        );
      }
    } catch (
      error
    ) {
      message.error(
        error instanceof Error
          ? error.message
          : "Không thể kiểm tra file Excel."
      );
    } finally {
      setPreviewing(
        false
      );
    }
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
      !importPreview
    ) {
      message.warning(
        "Vui lòng kiểm tra file trước khi import."
      );

      return;
    }

    if (
      importPreview.valid <=
      0
    ) {
      message.warning(
        "Không có dòng hợp lệ để import."
      );

      return;
    }

    try {
      setImporting(
        true
      );

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response =
        await apiFetch(
          "/catalog/service-staff/import",
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
        json =
          null;
      }

      if (
        !response.ok ||
        json?.success !==
          true
      ) {
        throw new Error(
          json?.message ||
          "Import thất bại."
        );
      }

      const inserted =
        Number(
          json?.data
            ?.inserted ??
          0
        );

      const updated =
        Number(
          json?.data
            ?.updated ??
          0
        );

      const skipped =
        Number(
          json?.data
            ?.skipped ??
          0
        );

      message.success(
        `Import thành công: ${inserted} thêm mới, ${updated} cập nhật, ${skipped} bỏ qua.`
      );

      setImportOpen(
        false
      );

      setImportFileList(
        []
      );

      setImportPreview(
        null
      );

      await loadRules();
    } catch (
      error
    ) {
      message.error(
        error instanceof Error
          ? error.message
          : "Import thất bại."
      );
    } finally {
      setImporting(
        false
      );
    }
  }

  const columns:
    ColumnsType<
      ServiceStaffRow
    > = [
      
{
  title: "STT",
  key: "stt",
  width: 65,
  align: "center" as const,
  render: (
    _value: unknown,
    _record: ServiceStaffRow,
    index: number
  ) => (
    <span style={{ fontWeight: 600 }}>
      {(currentPage - 1) * pageSize + index + 1}
    </span>
  ),
},

      {
        title:
          "DVKT",

        dataIndex:
          "service_code",

        key:
          "service_code",

        width:
          300,

        render:
          (
            value:
              string
          ) => {
            const service =
              serviceMap.get(
                value
              );

            return (
              <div
                className="service-staff-service"
              >
                <Text
                  strong
                >
                  {value}
                </Text>

                {service?.name && (
                  <Text
                    type="secondary"
                  >
                    {
                      service.name
                    }
                  </Text>
                )}
              </div>
            );
          },
      },

      {
        title:
          "Nhân viên",

        dataIndex:
          "staff_code",

        key:
          "staff_code",

        width:
          300,

        render:
          (
            value:
              string
          ) => {
            const staff =
              staffMap.get(
                value
              );

            return (
              <div
                className="service-staff-person"
              >
                <div
                  className="service-staff-avatar"
                >
                  <TeamOutlined />
                </div>

                <div>
                  <Text
                    strong
                  >
                    {
                      staff?.fullName ??
                      value
                    }
                  </Text>

                  <Text
                    type="secondary"

                    style={{
                      display:
                        "block",

                      fontSize:
                        11,
                    }}
                  >
                    {value}
                  </Text>
                </div>
              </div>
            );
          },
      },

      {
        title:
          "Loại",

        dataIndex:
          "activity_type",

        key:
          "activity_type",

        width:
          300,

        render:
          (
            value:
              string
          ) => (
            <Tag
              color="blue"

              className="service-staff-type-tag"
            >
              {
                getActivityLabel(
                  value
                )
              }
            </Tag>
          ),
      },

      {
        title:
          "Cho phép",

        dataIndex:
          "allowed",

        key:
          "allowed",

        width:
          120,

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

                  className="service-staff-status-tag"
                >
                  Cho phép
                </Tag>
              )
              : (
                <Tag
                  color="error"

                  className="service-staff-status-tag"
                >
                  Không cho phép
                </Tag>
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
          110,

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

                  className="service-staff-status-tag"
                >
                  Hoạt động
                </Tag>
              )
              : (
                <Tag
                  className="service-staff-status-tag"
                >
                  Tắt
                </Tag>
              ),
      },

      {
        title:
          "Thao tác",

        key:
          "actions",

        width:
          110,

        fixed:
          "right",

        align:
          "center",

        render:
          (
            _:
              unknown,

            record:
              ServiceStaffRow
          ) => (
            <Space
              size={
                4
              }
            >
              <Button
                type="text"

                icon={
                  <EditOutlined />
                }

                className="service-staff-edit"

                onClick={() =>
                  openEdit(
                    record
                  )
                }
              />

              <Popconfirm
                title="Xóa cấu hình?"

                description="Bạn có chắc muốn xóa quyền thực hiện này?"

                okText="Xóa"

                cancelText="Hủy"

                okButtonProps={{
                  danger:
                    true,
                }}

                onConfirm={() =>
                  void handleDelete(
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

                  className="service-staff-delete"
                />
              </Popconfirm>
            </Space>
          ),
      },
    ];

  const importColumns:
    ColumnsType<
      ServiceStaffImportPreviewRow
    > = [
      {
        title:
          "Trạng thái",

        dataIndex:
          "status",

        key:
          "status",

        width:
          115,

        render:
          (
            value:
              ServiceStaffImportPreviewRow["status"]
          ) => {
            if (
              value ===
              "VALID"
            ) {
              return (
                <Tag
                  color="success"
                  className="import-status-tag"
                >
                  Hợp lệ
                </Tag>
              );
            }

            if (
              value ===
              "DUPLICATE"
            ) {
              return (
                <Tag
                  color="warning"
                  className="import-status-tag"
                >
                  Trùng
                </Tag>
              );
            }

            return (
              <Tag
                color="error"
                className="import-status-tag"
              >
                Lỗi
              </Tag>
            );
          },
      },

      {
        title:
          "STT",

        dataIndex:
          "row",

        key:
          "row",

        width:
          70,

        align:
          "center",
      },

      {
        title:
          "Mã DVKT",

        dataIndex:
          "serviceCode",

        key:
          "serviceCode",

        width:
          170,
      },

      {
        title:
          "Mã bác sĩ",

        dataIndex:
          "staffCode",

        key:
          "staffCode",

        width:
          210,
      },

      {
        title:
          "Loại",

        dataIndex:
          "activityType",

        key:
          "activityType",

        width:
          210,

        render:
          (
            value:
              string
          ) => (
            <Tag
              color="blue"
              className="import-type-tag"
            >
              {
                value
              }
            </Tag>
          ),
      },

      {
        title:
          "Ghi chú",

        dataIndex:
          "message",

        key:
          "message",

        render:
          (
            value:
              string,

            record:
              ServiceStaffImportPreviewRow
          ) => (
            <span
              style={{
                color:
                  record.status ===
                  "ERROR"
                    ? "#ff4d4f"
                    : record.status ===
                        "DUPLICATE"
                      ? "#d48806"
                      : "#64748b",
              }}
            >
              {value}
            </span>
          ),
      },
    ];

  return (
    <div
      className="service-staff-page"
    >
      <Breadcrumb
        items={[
          {
            title: (
              <HomeOutlined
                onClick={() =>
                  navigate(
                    "/"
                  )
                }

                style={{
                  cursor:
                    "pointer",
                }}
              />
            ),
          },

          {
            title: (
              <span
                onClick={() =>
                  navigate(
                    "/catalog"
                  )
                }

                style={{
                  cursor:
                    "pointer",
                }}
              >
                Danh mục
              </span>
            ),
          },

          {
            title:
              "DVKT - Nhân viên",
          },
        ]}
      />

      <div
        className="service-staff-header"
      >
        <div>
          <Title
            level={3}

            style={{
              margin:
                0,

              color:
                "#172033",

              fontWeight:
                800,
            }}
          >
            <TeamOutlined
              style={{
                marginRight:
                  9,

                color:
                  "#1677ff",
              }}
            />

            DVKT - Nhân viên
          </Title>

          <Text
            type="secondary"
          >
            Cấu hình bác sĩ và nhân viên được phép thực hiện từng DVKT
          </Text>
        </div>

        <Space
          wrap
        >
          <Button
            icon={
              <DownloadOutlined />
            }

            onClick={() =>
              void downloadTemplate()
            }
          >
            File mẫu Import
          </Button>

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
              openCreate
            }
          >
            Thêm mới
          </Button>
        </Space>
      </div>

      <div
        className="service-staff-filter"
      >
        <div>
          <Text
            className="service-staff-filter-label"
          >
            DVKT
          </Text>

          <Select
            showSearch

            allowClear

            value={
              filterServiceCode
            }

            placeholder="Nhập mã hoặc tên DVKT"

            filterOption={
              false
            }

            loading={
              serviceLoading
            }

            options={
              serviceOptions
            }

            notFoundContent={
              serviceLoading
                ? "Đang tìm..."
                : "Không tìm thấy DVKT"
            }

            onFocus={() => {
              if (
                services.length ===
                0
              ) {
                void loadServices();
              }
            }}

            onSearch={(
              value
            ) => {
              void loadServices(
                value
              );
            }}

            onChange={(
              value
            ) => {
              setFilterServiceCode(
                value
              );

              if (
                !value
              ) {
                void loadServices();
              }
            }}
          />
        </div>

        <div>
          <Text
            className="service-staff-filter-label"
          >
            Nhân viên
          </Text>

          <Select
            showSearch

            allowClear

            value={
              filterStaffCode
            }

            placeholder="Chọn nhân viên"

            optionFilterProp="label"

            options={
              staffOptions
            }

            onChange={
              setFilterStaffCode
            }
          />
        </div>

        <div>
          <Text
            className="service-staff-filter-label"
          >
            Loại
          </Text>

          <Select
            allowClear

            value={
              filterActivityType
            }

            placeholder="Tất cả"

            options={
              ACTIVITY_OPTIONS
            }

            onChange={
              setFilterActivityType
            }
          />
        </div>

        <Button
          type="primary"

          icon={
            <ReloadOutlined />
          }

          loading={
            loading
          }

          onClick={
            resetFilters
          }
        >
          Làm mới
        </Button>
      </div>

      <div className="service-staff-table-wrap" ref={tableContainerRef}>
      <Card
        className="service-staff-table-card"

        styles={{
          body: {
            padding:
              0,
          },
        }}
      >
        <Table<
          ServiceStaffRow
        >
          rowKey="id"

          loading={
            loading
          }

          dataSource={
            filteredRows
          }

          columns={
            columns
          }

          size="middle"

          scroll={{
            x: 1250,
            y: tableScrollHeight,
          }}

          pagination={{
            current: currentPage,
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
            onChange: (nextPage, nextPageSize) => {
              // Khi chọn pageSize, Ant Design gọi onChange cùng pageSize mới.
              // Chuyển về trang 1 để tránh trạng thái trang không còn tồn tại.
              if (nextPageSize !== pageSize) {
                setPageSize(nextPageSize);
                setCurrentPage(1);
              } else {
                setCurrentPage(nextPage);
              }
            },
            showTotal: (total, range) =>
              `Hiển thị ${range[0]}-${range[1]} / Tổng số: ${total}`,
          }}

          locale={{
            emptyText:
              "Chưa có cấu hình DVKT - Nhân viên",
          }}
        />
      </Card>
      </div>

      <Modal
        className="service-staff-modal"

        open={
          modalOpen
        }

        title={
          <div>
            <div
              className="service-staff-modal-title"
            >
              {
                editing
                  ? "Cập nhật DVKT - Nhân viên"
                  : "Thêm DVKT - Nhân viên"
              }
            </div>

            <div
              className="service-staff-modal-description"
            >
              Cấu hình quyền thực hiện DVKT cho nhân viên
            </div>
          </div>
        }

        width={
          680
        }

        okText={
          editing
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

          setEditing(
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
          <Form.Item
            name="service_code"

            label="DVKT"

            rules={[
              {
                required:
                  true,

                message:
                  "Vui lòng chọn DVKT.",
              },
            ]}
          >
            <Select
              showSearch

              allowClear

              placeholder="Nhập mã hoặc tên DVKT"

              filterOption={
                false
              }

              loading={
                serviceLoading
              }

              options={
                serviceOptions
              }

              notFoundContent={
                serviceLoading
                  ? "Đang tìm DVKT..."
                  : "Không tìm thấy DVKT"
              }

              onFocus={() => {
                if (
                  services.length ===
                  0
                ) {
                  void loadServices();
                }
              }}

              onSearch={(
                value
              ) => {
                void loadServices(
                  value
                );
              }}

              onClear={() => {
                void loadServices();
              }}
            />
          </Form.Item>

          <Form.Item
            name="staff_code"

            label="Nhân viên"

            rules={[
              {
                required:
                  true,

                message:
                  "Vui lòng chọn nhân viên.",
              },
            ]}
          >
            <Select
              showSearch

              placeholder="Chọn nhân viên"

              optionFilterProp="label"

              options={
                staffOptions
              }

              notFoundContent="Không tìm thấy nhân viên"
            />
          </Form.Item>

          <Form.Item
            name="activity_type"

            label="Loại thực hiện"

            rules={[
              {
                required:
                  true,

                message:
                  "Vui lòng chọn loại thực hiện.",
              },
            ]}
          >
            <Select
              options={
                ACTIVITY_OPTIONS
              }
            />
          </Form.Item>

          <Form.Item
            name="specialty_code"

            label="Mã chuyên khoa"
          >
            <Input
              placeholder="Không bắt buộc"
            />
          </Form.Item>

          <div
            className="service-staff-switch-grid"
          >
            <Form.Item
              name="allowed"

              label="Cho phép"

              valuePropName="checked"
            >
              <Switch
                checkedChildren="Cho phép"

                unCheckedChildren="Không"
              />
            </Form.Item>

            <Form.Item
              name="active"

              label="Hoạt động"

              valuePropName="checked"
            >
              <Switch
                checkedChildren="Bật"

                unCheckedChildren="Tắt"
              />
            </Form.Item>
          </div>

          <Form.Item
            name="note"

            label="Ghi chú"
          >
            <Input.TextArea
              rows={
                3
              }

              placeholder="Ghi chú nếu có"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        className="service-staff-import-modal"

        open={
          importOpen
        }

        title={
          <div>
            <div
              className="service-staff-modal-title"
            >
              Import DVKT - Nhân viên
            </div>

            <div
              className="service-staff-modal-description"
            >
              Chọn file Excel theo đúng mẫu để kiểm tra trước khi import
            </div>
          </div>
        }

        width={
          1000
        }

        centered

        destroyOnClose

        maskClosable={
          !importing &&
          !previewing
        }

        onCancel={
          closeImportModal
        }

        footer={[
          <Button
            key="cancel"

            disabled={
              importing ||
              previewing
            }

            onClick={
              closeImportModal
            }
          >
            Hủy
          </Button>,

          <Button
            key="import"

            type="primary"

            icon={
              <UploadOutlined />
            }

            loading={
              importing
            }

            disabled={
              !importPreview ||
              importPreview.valid <=
                0 ||
              previewing
            }

            onClick={() =>
              void handleImportExcel()
            }
          >
            Import
          </Button>,
        ]}
      >
        <div
          className="import-upload-area"
        >
          <Upload
            accept=".xlsx"

            maxCount={
              1
            }

            fileList={
              importFileList
            }

            beforeUpload={(
              file
            ) => {
              const uploadFile:
                UploadFile =
                {
                  uid:
                    file.uid,

                  name:
                    file.name,

                  status:
                    "done",

                  originFileObj:
                    file,
                };

              setImportFileList(
                [
                  uploadFile,
                ]
              );

              void previewExcel(
                file
              );

              return false;
            }}

            onRemove={() => {
              if (
                importing ||
                previewing
              ) {
                return false;
              }

              setImportFileList(
                []
              );

              setImportPreview(
                null
              );

              return true;
            }}
          >
            <Button
              icon={
                <UploadOutlined />
              }

              loading={
                previewing
              }

              disabled={
                importing
              }
            >
              Chọn file Excel
            </Button>
          </Upload>

          <Button
            type="link"

            icon={
              <DownloadOutlined />
            }

            onClick={() =>
              void downloadTemplate()
            }
          >
            Tải file mẫu
          </Button>
        </div>

        {previewing && (
          <Alert
            type="info"

            showIcon

            message="Đang kiểm tra dữ liệu Excel..."

            style={{
              marginTop:
                16,
            }}
          />
        )}

        {
          importPreview &&
          !previewing &&
          (
            <>
              <div
                className="import-summary"
              >
                <div
                  className="import-summary-item"
                >
                  <div
                    className="import-summary-label"
                  >
                    Tổng số
                  </div>

                  <div
                    className="import-summary-value"
                  >
                    {
                      importPreview.totalRows
                    }
                  </div>
                </div>

                <div
                  className="import-summary-item import-summary-success"
                >
                  <div
                    className="import-summary-label"
                  >
                    Hợp lệ
                  </div>

                  <div
                    className="import-summary-value"
                  >
                    {
                      importPreview.valid
                    }
                  </div>
                </div>

                <div
                  className="import-summary-item import-summary-error"
                >
                  <div
                    className="import-summary-label"
                  >
                    Lỗi
                  </div>

                  <div
                    className="import-summary-value"
                  >
                    {
                      importPreview.invalid
                    }
                  </div>
                </div>

                <div
                  className="import-summary-item import-summary-warning"
                >
                  <div
                    className="import-summary-label"
                  >
                    Trùng
                  </div>

                  <div
                    className="import-summary-value"
                  >
                    {
                      importPreview.duplicate
                    }
                  </div>
                </div>
              </div>

              {
                importPreview.invalid >
                0 &&
                (
                  <Alert
                    type="warning"

                    showIcon

                    message="File có dòng lỗi"

                    description="Các dòng lỗi sẽ không được import. Bạn có thể xem chi tiết trong cột Ghi chú."

                    style={{
                      marginBottom:
                        12,
                    }}
                  />
                )
              }

              <div
                className="import-preview-table"
              >
                <Table<
                  ServiceStaffImportPreviewRow
                >
                  size="small"

                  rowKey={(
                    record
                  ) =>
                    `${record.row}-${record.serviceCode}-${record.staffCode}-${record.activityType}`
                  }

                  dataSource={
                    importPreview.rows
                  }

                  columns={
                    importColumns
                  }

                  pagination={{
                    pageSize:
                      10,

                    showSizeChanger:
                      false,

                    showTotal:
                      (
                        total
                      ) =>
                        `Tổng số: ${total}`,
                  }}

                  scroll={{
                    x:
                      950,

                    y:
                      350,
                  }}
                />
              </div>
            </>
          )
        }
      </Modal>

      <style>
        {`
          /* Chỉ áp dụng khi mở trang DVKT - Nhân viên */
          body:has(.service-staff-page) {
            overflow: hidden !important;
          }

          .service-staff-page {
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 100%;
            min-width: 0;
            height: calc(100dvh - 165px);
            min-height: 0;
            overflow: hidden;
          }

          .service-staff-page > .ant-breadcrumb,
          .service-staff-page > .service-staff-header,
          .service-staff-page > .service-staff-filter {
            flex-shrink: 0;
          }

          .service-staff-table-wrap {
            flex: 1 1 auto;
            min-height: 0;
            min-width: 0;
            overflow: hidden;
          }

          .service-staff-table-wrap .ant-table-body {
            overflow-y: auto !important;
          }

          @media (max-height: 650px), (max-width: 700px) {
            body:has(.service-staff-page) {
              overflow-y: auto !important;
            }
            .service-staff-page {
              height: auto;
              overflow: visible;
            }
            .service-staff-table-wrap {
              overflow: visible;
            }
          }

          .service-staff-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }

          .service-staff-header .ant-btn {
            height: 36px;
            border-radius: 8px;
            font-weight: 600;
          }

          .service-staff-filter {
            display: grid;
            grid-template-columns:
              minmax(260px, 1.3fr)
              minmax(260px, 1.3fr)
              minmax(230px, 1fr)
              110px;
            gap: 10px;
            align-items: end;
          }

          .service-staff-filter
          .ant-select {
            width: 100%;
          }

          .service-staff-filter
          .ant-btn {
            height: 32px;
            border-radius: 7px;
            font-weight: 600;
          }

          .service-staff-filter-label {
            display: block;
            margin-bottom: 6px;
            color: #172033;
            font-size: 12px;
            font-weight: 700;
          }

          .service-staff-table-card {
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

          .service-staff-table-card
          .ant-table-thead
          > tr
          > th {
            background:
              #f2f5f8 !important;
            color:
              #334155 !important;
            font-size: 12px;
            font-weight: 700 !important;
          }

          .service-staff-table-card
          .ant-table-tbody
          > tr
          > td {
            padding:
              11px
              12px !important;
            color:
              #334155;
            font-size: 12px;
          }

          .service-staff-table-card
          .ant-table-tbody
          > tr:hover
          > td {
            background:
              #f7fbff !important;
          }

          .service-staff-service {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .service-staff-person {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .service-staff-avatar {
            width: 29px;
            height: 29px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            border-radius: 8px;
            color:
              #1677ff;
            background:
              #e6f4ff;
          }

          .service-staff-type-tag {
            margin: 0;
            padding:
              2px
              8px;
            border-radius:
              999px;
            font-size:
              11px;
            font-weight:
              600;
          }

          .service-staff-status-tag {
            margin: 0;
            padding:
              2px
              8px;
            border-radius:
              999px;
            font-size:
              11px;
            font-weight:
              700;
          }

          .service-staff-edit,
          .service-staff-delete {
            width: 30px;
            height: 30px;
            border-radius: 7px;
          }

          .service-staff-edit {
            color:
              #1677ff;
          }

          .service-staff-edit:hover {
            color:
              #1677ff !important;
            background:
              #e6f4ff !important;
          }

          .service-staff-delete:hover {
            background:
              #fff1f0 !important;
          }

          .service-staff-table-card
          .ant-pagination {
            margin: 10px 12px 8px !important;
            padding: 0;
          }

          .service-staff-modal
          .ant-modal-content,
          .service-staff-import-modal
          .ant-modal-content {
            border-radius: 14px;
            overflow: hidden;
          }

          .service-staff-modal-title {
            color:
              #172033;
            font-size: 18px;
            font-weight: 800;
          }

          .service-staff-modal-description {
            margin-top: 3px;
            color:
              #64748b;
            font-size: 12px;
            font-weight: 400;
          }

          .service-staff-switch-grid {
            display: grid;
            grid-template-columns:
              1fr
              1fr;
            gap: 16px;
          }

          .import-upload-area {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding:
              14px
              16px;
            border:
              1px dashed
              #d9e2ec;
            border-radius:
              10px;
            background:
              #fafcff;
          }

          .import-summary {
            display: grid;
            grid-template-columns:
              repeat(
                4,
                minmax(
                  120px,
                  1fr
                )
              );
            gap: 10px;
            margin:
              16px
              0
              12px;
          }

          .import-summary-item {
            padding:
              10px
              12px;
            border:
              1px solid
              #e5e7eb;
            border-radius:
              10px;
            background:
              #ffffff;
          }

          .import-summary-label {
            color:
              #64748b;
            font-size:
              11px;
            font-weight:
              600;
          }

          .import-summary-value {
            margin-top:
              2px;
            color:
              #172033;
            font-size:
              19px;
            font-weight:
              800;
          }

          .import-summary-success {
            background:
              #f6ffed;
            border-color:
              #d9f7be;
          }

          .import-summary-error {
            background:
              #fff2f0;
            border-color:
              #ffccc7;
          }

          .import-summary-warning {
            background:
              #fffbe6;
            border-color:
              #ffe58f;
          }

          .import-preview-table {
            overflow:
              hidden;
            border:
              1px solid
              #e5e7eb;
            border-radius:
              8px;
          }

          .import-preview-table
          .ant-table-thead
          > tr
          > th {
            background:
              #f2f5f8 !important;
            color:
              #334155;
            font-size:
              12px;
            font-weight:
              700;
          }

          .import-preview-table
          .ant-table-tbody
          > tr
          > td {
            font-size:
              12px;
          }

          .import-status-tag,
          .import-type-tag {
            margin: 0;
            border-radius:
              999px;
            font-size:
              11px;
            font-weight:
              600;
          }

          @media
          (
            max-width:
              1000px
          ) {
            .service-staff-filter {
              grid-template-columns:
                1fr
                1fr;
            }

            .import-summary {
              grid-template-columns:
                1fr
                1fr;
            }
          }

          @media
          (
            max-width:
              700px
          ) {
            .service-staff-header {
              flex-direction:
                column;
            }

            .service-staff-filter {
              grid-template-columns:
                1fr;
            }

            .service-staff-switch-grid {
              grid-template-columns:
                1fr;
            }

            .import-summary {
              grid-template-columns:
                1fr;
            }

            .import-upload-area {
              align-items:
                flex-start;
              flex-direction:
                column;
            }
          }
        `}
      </style>
    </div>
  );
}