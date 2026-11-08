import {
  Alert,
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
  Upload,
  message,
} from "antd";

import type { TableColumnsType, UploadFile } from "antd";

import {
  EditOutlined,
  ExperimentOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "../../api/apiClient";
import { Link } from "react-router-dom";

const { Title, Text } = Typography;

// ======================================================
// TYPES
// ======================================================

interface DrugItem {
  id: string;
  code: string;
  name: string;

  activeIngredient: string | null;

  strength: string | null;

  unit: string | null;

  groupCode: string | null;

  route: string | null;

  routeCode: string | null;

  dosageForm: string | null;

  registrationNumber: string | null;

  quantity: number | null;

  unitPrice: number;

  insuranceUnitPrice: number | null;

  packaging: string | null;

  manufacturer: string | null;

  country: string | null;

  contractor: string | null;

  tenderInfo: string | null;

  drugType: string | null;

  scientificName: string | null;

  origin: string | null;

  processingMethod: string | null;

  importedMaterialCode: string | null;

  processedMaterialCode: string | null;

  processingLossRate: number | null;

  preservationLossRate: number | null;

  qualityStandard: string | null;

  decisionNo: string | null;

  insurancePaymentRate: number;

  note: string | null;

  active: boolean;
}

interface DrugFormValues {
  code: string;
  name: string;

  activeIngredient?: string;
  strength?: string;
  unit?: string;
  groupCode?: string;
  route?: string;
  routeCode?: string;
  dosageForm?: string;
  registrationNumber?: string;

  quantity?: number | null;

  unitPrice?: number;

  insuranceUnitPrice?: number | null;

  packaging?: string;
  manufacturer?: string;
  country?: string;
  contractor?: string;
  tenderInfo?: string;
  drugType?: string;
  scientificName?: string;
  origin?: string;
  processingMethod?: string;
  importedMaterialCode?: string;
  processedMaterialCode?: string;

  processingLossRate?: number | null;

  preservationLossRate?: number | null;

  qualityStandard?: string;
  decisionNo?: string;
  insurancePaymentRate?: number;
  note?: string;

  active: boolean;
}

interface DrugImportError {
  row: number;
  field: string;
  message: string;
}

interface DrugImportResult {
  totalRows: number;
  inserted: number;
  updated: number;
  skipped: number;
}

// ======================================================
// HELPERS
// ======================================================

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return Number(value).toLocaleString("vi-VN");
}

function textOrDash(value: string | null | undefined) {
  return value && String(value).trim() ? value : "-";
}

function numberOrDash(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return Number(value).toLocaleString("vi-VN");
}

function trimOrNull(value: string | undefined) {
  const result = value?.trim();

  return result || null;
}

// ======================================================
// COMPONENT
// ======================================================

export default function Drugs() {
  // ====================================================
  // FILTERS
  // ====================================================

  const [searchCode, setSearchCode] = useState("");

  const [searchName, setSearchName] = useState("");

  const [searchIngredient, setSearchIngredient] = useState("");

  const [searchGroup, setSearchGroup] = useState("");

  // ====================================================
  // TABLE
  // ====================================================

  const [items, setItems] = useState<DrugItem[]>([]);

  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(false);

  // ====================================================
  // ADD / EDIT
  // ====================================================

  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);

  const [editingDrug, setEditingDrug] = useState<DrugItem | null>(null);

  const [form] = Form.useForm<DrugFormValues>();

  // ====================================================
  // IMPORT
  // ====================================================

  const [importModalOpen, setImportModalOpen] = useState(false);

  const [importFileList, setImportFileList] = useState<UploadFile[]>([]);

  const [importing, setImporting] = useState(false);

  const [importResult, setImportResult] = useState<DrugImportResult | null>(null);

  const [importErrors, setImportErrors] = useState<DrugImportError[]>([]);

  const [importMessage, setImportMessage] = useState("");

  // ====================================================
  // LOAD DRUGS
  // ====================================================

  const loadDrugs = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(page),

        pageSize: String(pageSize),
      });

      if (searchCode.trim()) {
        params.set("code", searchCode.trim());
      }

      if (searchName.trim()) {
        params.set("name", searchName.trim());
      }

      if (searchIngredient.trim()) {
        params.set("activeIngredient", searchIngredient.trim());
      }

      if (searchGroup.trim()) {
        params.set("groupCode", searchGroup.trim());
      }

      const response = await apiFetch(`/catalog/drugs?${params.toString()}`, {
        method: "GET",
      });

      const json = await response.json();

      if (!response.ok || json.success !== true) {
        throw new Error(json.message || "Không thể tải danh mục thuốc.");
      }

      setItems(json.data?.items ?? []);

      setTotal(Number(json.data?.total ?? 0));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Không thể tải danh mục thuốc.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchCode, searchName, searchIngredient, searchGroup]);

  useEffect(() => {
    void loadDrugs();
  }, [loadDrugs]);

  // ====================================================
  // OPEN ADD
  // ====================================================

  function openAddModal() {
    setEditingDrug(null);

    form.resetFields();

    form.setFieldsValue({
      code: "",

      name: "",

      activeIngredient: "",

      strength: "",

      unit: "",

      groupCode: "",

      route: "",

      routeCode: "",

      dosageForm: "",

      registrationNumber: "",

      quantity: null,

      unitPrice: 0,

      insuranceUnitPrice: null,

      packaging: "",

      manufacturer: "",

      country: "",

      contractor: "",

      tenderInfo: "",

      drugType: "",

      scientificName: "",

      origin: "",

      processingMethod: "",

      importedMaterialCode: "",

      processedMaterialCode: "",

      processingLossRate: null,

      preservationLossRate: null,

      qualityStandard: "",

      decisionNo: "",

      insurancePaymentRate: 100,

      note: "",

      active: true,
    });

    setModalOpen(true);
  }

  // ====================================================
  // OPEN EDIT
  // ====================================================

  async function openEditModal(record: DrugItem) {
    try {
      const response = await apiFetch(`/catalog/drugs/${encodeURIComponent(record.id)}`, {
        method: "GET",
      });

      const json = await response.json();

      if (!response.ok || json.success !== true) {
        throw new Error(json.message || "Không thể tải thuốc.");
      }

      const data = json.data;

      setEditingDrug(data);

      form.setFieldsValue({
        code: data.code ?? "",

        name: data.name ?? "",

        activeIngredient: data.activeIngredient ?? "",

        strength: data.strength ?? "",

        unit: data.unit ?? "",

        groupCode: data.groupCode ?? "",

        route: data.route ?? "",

        routeCode: data.routeCode ?? "",

        dosageForm: data.dosageForm ?? "",

        registrationNumber: data.registrationNumber ?? "",

        quantity:
          data.quantity === null || data.quantity === undefined ? null : Number(data.quantity),

        unitPrice: Number(data.unitPrice ?? 0),

        insuranceUnitPrice:
          data.insuranceUnitPrice === null || data.insuranceUnitPrice === undefined
            ? null
            : Number(data.insuranceUnitPrice),

        packaging: data.packaging ?? "",

        manufacturer: data.manufacturer ?? "",

        country: data.country ?? "",

        contractor: data.contractor ?? "",

        tenderInfo: data.tenderInfo ?? "",

        drugType: data.drugType ?? "",

        scientificName: data.scientificName ?? "",

        origin: data.origin ?? "",

        processingMethod: data.processingMethod ?? "",

        importedMaterialCode: data.importedMaterialCode ?? "",

        processedMaterialCode: data.processedMaterialCode ?? "",

        processingLossRate:
          data.processingLossRate === null || data.processingLossRate === undefined
            ? null
            : Number(data.processingLossRate),

        preservationLossRate:
          data.preservationLossRate === null || data.preservationLossRate === undefined
            ? null
            : Number(data.preservationLossRate),

        qualityStandard: data.qualityStandard ?? "",

        decisionNo: data.decisionNo ?? "",

        insurancePaymentRate: Number(data.insurancePaymentRate ?? 100),

        note: data.note ?? "",

        active: Boolean(data.active),
      });

      setModalOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Không thể tải thuốc.");
    }
  }

  // ====================================================
  // SAVE
  // ====================================================

  async function handleSave() {
    try {
      const values = await form.validateFields();

      setSaving(true);

      const isEdit = editingDrug !== null;

      const endpoint = isEdit
        ? `/catalog/drugs/${encodeURIComponent(editingDrug.id)}`
        : "/catalog/drugs";

      const response = await apiFetch(endpoint, {
        method: isEdit ? "PUT" : "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          code: values.code.trim(),

          name: values.name.trim(),

          activeIngredient: trimOrNull(values.activeIngredient),

          strength: trimOrNull(values.strength),

          unit: trimOrNull(values.unit),

          groupCode: trimOrNull(values.groupCode),

          route: trimOrNull(values.route),

          routeCode: trimOrNull(values.routeCode),

          dosageForm: trimOrNull(values.dosageForm),

          registrationNumber: trimOrNull(values.registrationNumber),

          quantity: values.quantity ?? null,

          unitPrice: Number(values.unitPrice ?? 0),

          insuranceUnitPrice: values.insuranceUnitPrice ?? null,

          packaging: trimOrNull(values.packaging),

          manufacturer: trimOrNull(values.manufacturer),

          country: trimOrNull(values.country),

          contractor: trimOrNull(values.contractor),

          tenderInfo: trimOrNull(values.tenderInfo),

          drugType: trimOrNull(values.drugType),

          scientificName: trimOrNull(values.scientificName),

          origin: trimOrNull(values.origin),

          processingMethod: trimOrNull(values.processingMethod),

          importedMaterialCode: trimOrNull(values.importedMaterialCode),

          processedMaterialCode: trimOrNull(values.processedMaterialCode),

          processingLossRate: values.processingLossRate ?? null,

          preservationLossRate: values.preservationLossRate ?? null,

          qualityStandard: trimOrNull(values.qualityStandard),

          decisionNo: trimOrNull(values.decisionNo),

          insurancePaymentRate: Number(values.insurancePaymentRate ?? 100),

          note: trimOrNull(values.note),

          active: values.active,
        }),
      });

      const json = await response.json();

      if (!response.ok || json.success !== true) {
        throw new Error(json.message || "Không thể lưu thuốc.");
      }

      message.success(isEdit ? "Cập nhật thuốc thành công." : "Thêm thuốc thành công.");

      setModalOpen(false);

      setEditingDrug(null);

      form.resetFields();

      await loadDrugs();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) {
        return;
      }

      message.error(error instanceof Error ? error.message : "Không thể lưu thuốc.");
    } finally {
      setSaving(false);
    }
  }

  // ====================================================
  // DISABLE
  // ====================================================

  function confirmDisable(record: DrugItem) {
    Modal.confirm({
      title: "Ngừng sử dụng thuốc?",

      content: `${record.code} - ${record.name}`,

      okText: "Đồng ý",

      cancelText: "Hủy",

      okButtonProps: {
        danger: true,
      },

      onOk: async () => {
        try {
          const response = await apiFetch(`/catalog/drugs/${encodeURIComponent(record.id)}`, {
            method: "DELETE",
          });

          const json = await response.json();

          if (!response.ok || json.success !== true) {
            throw new Error(json.message || "Không thể ngừng sử dụng thuốc.");
          }

          message.success("Đã ngừng sử dụng thuốc.");

          await loadDrugs();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "Không thể ngừng sử dụng thuốc.");
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

    setSearchIngredient("");

    setSearchGroup("");

    setPage(1);
  }

  // ====================================================
  // IMPORT OPEN
  // ====================================================

  function openImportModal() {
    setImportFileList([]);

    setImportResult(null);

    setImportErrors([]);

    setImportMessage("");

    setImportModalOpen(true);
  }

  // ====================================================
  // IMPORT CLOSE
  // ====================================================

  function closeImportModal() {
    if (importing) {
      return;
    }

    setImportModalOpen(false);

    setImportFileList([]);

    setImportResult(null);

    setImportErrors([]);

    setImportMessage("");
  }

  // ====================================================
  // IMPORT EXCEL
  // ====================================================

  async function handleImportExcel() {
    const file = importFileList[0]?.originFileObj;

    if (!file) {
      message.warning("Vui lòng chọn file Excel.");

      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      message.error("Chỉ hỗ trợ file Excel .xlsx.");

      return;
    }

    try {
      setImporting(true);

      setImportResult(null);

      setImportErrors([]);

      setImportMessage("");

      const formData = new FormData();

      formData.append("file", file);

      const response = await apiFetch("/catalog/drugs/import", {
        method: "POST",

        body: formData,
      });

      let json: any = null;

      try {
        json = await response.json();
      } catch {
        // Backend không trả JSON.
      }

      if (!response.ok || json?.success !== true) {
        const errors = Array.isArray(json?.errors) ? json.errors : [];

        setImportErrors(errors);

        setImportMessage(json?.message || "Import thuốc thất bại.");

        message.error(json?.message || "Import thuốc thất bại.");

        return;
      }

      const result: DrugImportResult = {
        totalRows: Number(json.data?.totalRows ?? 0),

        inserted: Number(json.data?.inserted ?? 0),

        updated: Number(json.data?.updated ?? 0),

        skipped: Number(json.data?.skipped ?? 0),
      };

      setImportResult(result);

      setImportMessage(json?.message || "Import thuốc thành công.");

      message.success(json?.message || "Import thuốc thành công.");

      if (page !== 1) {
        setPage(1);
      } else {
        await loadDrugs();
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Import thuốc thất bại.";

      setImportMessage(text);

      message.error(text);
    } finally {
      setImporting(false);
    }
  }

  // ====================================================
  // TABLE COLUMNS
  // ====================================================

  const columns: TableColumnsType<DrugItem> = [
    {
      title: "STT",

      key: "stt",

      width: 60,

      fixed: "left",

      align: "center",

      render: (_, __, index) => (page - 1) * pageSize + index + 1,
    },

    {
      title: "Mã thuốc",

      dataIndex: "code",

      key: "code",

      width: 135,

      fixed: "left",

      render: (value: string) => <Text strong>{value || "-"}</Text>,
    },

    {
      title: "Tên thuốc",

      dataIndex: "name",

      key: "name",

      width: 220,

      fixed: "left",

      ellipsis: true,
    },

    {
      title: "Hoạt chất",

      dataIndex: "activeIngredient",

      key: "activeIngredient",

      width: 220,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "Hàm lượng",

      dataIndex: "strength",

      key: "strength",

      width: 150,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "ĐVT",

      dataIndex: "unit",

      key: "unit",

      width: 90,

      render: textOrDash,
    },

    {
      title: "Mã nhóm",

      dataIndex: "groupCode",

      key: "groupCode",

      width: 105,

      render: textOrDash,
    },

    {
      title: "Đường dùng",

      dataIndex: "route",

      key: "route",

      width: 125,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "Mã đường dùng",

      dataIndex: "routeCode",

      key: "routeCode",

      width: 120,

      render: textOrDash,
    },

    {
      title: "Dạng bào chế",

      dataIndex: "dosageForm",

      key: "dosageForm",

      width: 170,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "Số đăng ký",

      dataIndex: "registrationNumber",

      key: "registrationNumber",

      width: 145,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "Số lượng",

      dataIndex: "quantity",

      key: "quantity",

      width: 105,

      align: "right",

      render: numberOrDash,
    },

    {
      title: "Đơn giá",

      dataIndex: "unitPrice",

      key: "unitPrice",

      width: 120,

      align: "right",

      render: formatMoney,
    },

    {
      title: "Đơn giá BH",

      dataIndex: "insuranceUnitPrice",

      key: "insuranceUnitPrice",

      width: 125,

      align: "right",

      render: formatMoney,
    },

    {
      title: "Quy cách",

      dataIndex: "packaging",

      key: "packaging",

      width: 190,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "Nhà sản xuất",

      dataIndex: "manufacturer",

      key: "manufacturer",

      width: 190,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "Nước SX",

      dataIndex: "country",

      key: "country",

      width: 130,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "Nhà thầu",

      dataIndex: "contractor",

      key: "contractor",

      width: 190,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "Thông tin thầu",

      dataIndex: "tenderInfo",

      key: "tenderInfo",

      width: 210,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "Loại thuốc",

      dataIndex: "drugType",

      key: "drugType",

      width: 145,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "Tên khoa học",

      dataIndex: "scientificName",

      key: "scientificName",

      width: 190,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "Nguồn gốc",

      dataIndex: "origin",

      key: "origin",

      width: 150,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "PP chế biến",

      dataIndex: "processingMethod",

      key: "processingMethod",

      width: 170,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "Mã DL nhập",

      dataIndex: "importedMaterialCode",

      key: "importedMaterialCode",

      width: 140,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "Mã DL chế biến",

      dataIndex: "processedMaterialCode",

      key: "processedMaterialCode",

      width: 145,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "TLHH chế biến",

      dataIndex: "processingLossRate",

      key: "processingLossRate",

      width: 125,

      align: "right",

      render: numberOrDash,
    },

    {
      title: "TLHH bảo quản",

      dataIndex: "preservationLossRate",

      key: "preservationLossRate",

      width: 125,

      align: "right",

      render: numberOrDash,
    },

    {
      title: "Tiêu chuẩn CL",

      dataIndex: "qualityStandard",

      key: "qualityStandard",

      width: 170,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "Quyết định",

      dataIndex: "decisionNo",

      key: "decisionNo",

      width: 145,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "Tỷ lệ BHYT (%)",

      dataIndex: "insurancePaymentRate",

      key: "insurancePaymentRate",

      width: 125,

      align: "center",
    },

    {
      title: "Ghi chú",

      dataIndex: "note",

      key: "note",

      width: 170,

      ellipsis: true,

      render: textOrDash,
    },

    {
      title: "Trạng thái",

      dataIndex: "active",

      key: "active",

      width: 105,

      fixed: "right",

      align: "center",

      render: (value: boolean) =>
        value ? (
          <Tag color="success" className="drugs-status">
            Đang dùng
          </Tag>
        ) : (
          <Tag className="drugs-status">Ngừng dùng</Tag>
        ),
    },

    {
      title: "Thao tác",

      key: "actions",

      width: 100,

      fixed: "right",

      align: "center",

      render: (_, record) => (
        <Space size={8}>
          <Tooltip title="Cập nhật">
            <Button
              type="text"
              size="small"
              icon={
                <EditOutlined
                  style={{
                    color: "#1677ff",
                  }}
                />
              }
              onClick={() => void openEditModal(record)}
            />
          </Tooltip>

          <Tooltip title={record.active ? "Ngừng sử dụng" : "Đã ngừng sử dụng"}>
            <Button
              type="text"
              size="small"
              disabled={!record.active}
              icon={
                <StopOutlined
                  style={{
                    color: record.active ? "#ff4d4f" : "#bfbfbf",
                  }}
                />
              }
              onClick={() => confirmDisable(record)}
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
      <div className="drugs-page">
        {/* =================================================
            BREADCRUMB
        ================================================= */}
        <Breadcrumb
          className="drugs-breadcrumb"
          items={[
            {
              title: (
                <Link to="/">
                  {" "}
                  <HomeOutlined />
                </Link>
              ),
            },

            {
              title: <Link to="/catalog">Danh mục</Link>,
            },

            {
              title: "Thuốc",
            },
          ]}
        />

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="drugs-header">
          <div>
            <div className="drugs-title-row">
              <ExperimentOutlined className="drugs-title-icon" />

              <Title
                level={3}
                style={{
                  margin: 0,
                }}
              >
                Thuốc
              </Title>
            </div>

            <Text type="secondary" className="drugs-subtitle">
              Quản lý danh mục thuốc và thông tin sử dụng
            </Text>
          </div>

          <Space size={8}>
            <Button icon={<UploadOutlined />} onClick={openImportModal}>
              Import Excel
            </Button>

            <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
              Thêm mới
            </Button>
          </Space>
        </div>

        {/* =================================================
            FILTER
        ================================================= */}

        <div className="drugs-filter-grid">
          <div className="drugs-filter-item">
            <Text strong className="drugs-filter-label">
              Mã thuốc
            </Text>

            <Input
              value={searchCode}
              placeholder="Nhập mã thuốc"
              allowClear
              onChange={(event) => {
                setSearchCode(event.target.value);

                setPage(1);
              }}
            />
          </div>

          <div className="drugs-filter-item">
            <Text strong className="drugs-filter-label">
              Tên thuốc
            </Text>

            <Input
              value={searchName}
              placeholder="Nhập tên thuốc"
              allowClear
              onChange={(event) => {
                setSearchName(event.target.value);

                setPage(1);
              }}
            />
          </div>

          <div className="drugs-filter-item">
            <Text strong className="drugs-filter-label">
              Hoạt chất
            </Text>

            <Input
              value={searchIngredient}
              placeholder="Nhập hoạt chất"
              allowClear
              onChange={(event) => {
                setSearchIngredient(event.target.value);

                setPage(1);
              }}
            />
          </div>

          <div className="drugs-filter-item">
            <Text strong className="drugs-filter-label">
              Mã nhóm
            </Text>

            <Input
              value={searchGroup}
              placeholder="Mã nhóm"
              allowClear
              onChange={(event) => {
                setSearchGroup(event.target.value);

                setPage(1);
              }}
            />
          </div>

          <Button type="primary" icon={<ReloadOutlined />} onClick={handleRefresh}>
            Làm mới
          </Button>
        </div>

        {/* =================================================
            TABLE
        ================================================= */}

        <Table<DrugItem>
          className="drugs-table"
          rowKey="id"
          size="middle"
          tableLayout="fixed"
          loading={loading}
          dataSource={items}
          columns={columns}
          scroll={{
            x: 4900,
          }}
          pagination={{
            current: page,

            pageSize,

            total,

            showSizeChanger: true,

            pageSizeOptions: ["10", "50", "100"],

            showTotal: (value) => `Tổng số: ${value}`,

            onChange: (newPage, newPageSize) => {
              if (newPageSize !== pageSize) {
                setPageSize(newPageSize);

                setPage(1);

                return;
              }

              setPage(newPage);
            },
          }}
          locale={{
            emptyText: "Chưa có dữ liệu thuốc",
          }}
        />
      </div>

      {/* =================================================
          ADD / EDIT MODAL
      ================================================= */}

      <Modal
        open={modalOpen}
        title={editingDrug ? "Cập nhật Thuốc" : "Thêm Thuốc"}
        width={1250}
        okText={editingDrug ? "Cập nhật" : "Thêm mới"}
        cancelText="Hủy"
        confirmLoading={saving}
        onOk={() => void handleSave()}
        onCancel={() => {
          if (saving) {
            return;
          }

          setModalOpen(false);

          setEditingDrug(null);

          form.resetFields();
        }}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          style={{
            marginTop: 18,
          }}
        >
          {/* =============================================
              THÔNG TIN CƠ BẢN
          ============================================= */}

          <Title level={5}>Thông tin thuốc</Title>

          <div
            style={{
              display: "grid",

              gridTemplateColumns: "1fr 2fr",

              gap: 16,
            }}
          >
            <Form.Item
              label="Mã thuốc"
              name="code"
              rules={[
                {
                  required: true,

                  whitespace: true,

                  message: "Vui lòng nhập mã thuốc.",
                },
              ]}
            >
              <Input disabled={editingDrug !== null} />
            </Form.Item>

            <Form.Item
              label="Tên thuốc"
              name="name"
              rules={[
                {
                  required: true,

                  whitespace: true,

                  message: "Vui lòng nhập tên thuốc.",
                },
              ]}
            >
              <Input />
            </Form.Item>
          </div>

          <div
            style={{
              display: "grid",

              gridTemplateColumns: "2fr 1fr 1fr",

              gap: 16,
            }}
          >
            <Form.Item label="Tên hoạt chất" name="activeIngredient">
              <Input />
            </Form.Item>

            <Form.Item label="Hàm lượng" name="strength">
              <Input />
            </Form.Item>

            <Form.Item label="Đơn vị tính" name="unit">
              <Input />
            </Form.Item>
          </div>

          <div
            style={{
              display: "grid",

              gridTemplateColumns: "1fr 1fr 1fr 1fr",

              gap: 16,
            }}
          >
            <Form.Item label="Mã nhóm" name="groupCode">
              <Input />
            </Form.Item>

            <Form.Item label="Đường dùng" name="route">
              <Input />
            </Form.Item>

            <Form.Item label="Mã đường dùng" name="routeCode">
              <Input />
            </Form.Item>

            <Form.Item label="Dạng bào chế" name="dosageForm">
              <Input />
            </Form.Item>
          </div>

          {/* =============================================
              ĐĂNG KÝ / GIÁ
          ============================================= */}

          <Title level={5}>Đăng ký và giá</Title>

          <div
            style={{
              display: "grid",

              gridTemplateColumns: "1fr 1fr 1fr 1fr",

              gap: 16,
            }}
          >
            <Form.Item label="Số đăng ký" name="registrationNumber">
              <Input />
            </Form.Item>

            <Form.Item label="Số lượng" name="quantity">
              <InputNumber
                min={0}
                style={{
                  width: "100%",
                }}
              />
            </Form.Item>

            <Form.Item label="Đơn giá" name="unitPrice">
              <InputNumber
                min={0}
                style={{
                  width: "100%",
                }}
              />
            </Form.Item>

            <Form.Item label="Đơn giá BH" name="insuranceUnitPrice">
              <InputNumber
                min={0}
                style={{
                  width: "100%",
                }}
              />
            </Form.Item>
          </div>

          <Form.Item label="Quy cách" name="packaging">
            <Input />
          </Form.Item>

          {/* =============================================
              SẢN XUẤT / THẦU
          ============================================= */}

          <Title level={5}>Sản xuất và đấu thầu</Title>

          <div
            style={{
              display: "grid",

              gridTemplateColumns: "1fr 1fr",

              gap: 16,
            }}
          >
            <Form.Item label="Nhà sản xuất" name="manufacturer">
              <Input />
            </Form.Item>

            <Form.Item label="Nước sản xuất" name="country">
              <Input />
            </Form.Item>
          </div>

          <div
            style={{
              display: "grid",

              gridTemplateColumns: "1fr 2fr",

              gap: 16,
            }}
          >
            <Form.Item label="Nhà thầu" name="contractor">
              <Input />
            </Form.Item>

            <Form.Item label="Thông tin thầu" name="tenderInfo">
              <Input />
            </Form.Item>
          </div>

          {/* =============================================
              THÔNG TIN DƯỢC LIỆU
          ============================================= */}

          <Title level={5}>Thông tin bổ sung</Title>

          <div
            style={{
              display: "grid",

              gridTemplateColumns: "1fr 1fr",

              gap: 16,
            }}
          >
            <Form.Item label="Loại thuốc" name="drugType">
              <Input />
            </Form.Item>

            <Form.Item label="Tên khoa học" name="scientificName">
              <Input />
            </Form.Item>
          </div>

          <div
            style={{
              display: "grid",

              gridTemplateColumns: "1fr 1fr",

              gap: 16,
            }}
          >
            <Form.Item label="Nguồn gốc" name="origin">
              <Input />
            </Form.Item>

            <Form.Item label="Phương pháp chế biến" name="processingMethod">
              <Input />
            </Form.Item>
          </div>

          <div
            style={{
              display: "grid",

              gridTemplateColumns: "1fr 1fr",

              gap: 16,
            }}
          >
            <Form.Item label="Mã dược liệu nhập" name="importedMaterialCode">
              <Input />
            </Form.Item>

            <Form.Item label="Mã dược liệu chế biến" name="processedMaterialCode">
              <Input />
            </Form.Item>
          </div>

          <div
            style={{
              display: "grid",

              gridTemplateColumns: "1fr 1fr 2fr",

              gap: 16,
            }}
          >
            <Form.Item label="TLHH chế biến" name="processingLossRate">
              <InputNumber
                min={0}
                style={{
                  width: "100%",
                }}
              />
            </Form.Item>

            <Form.Item label="TLHH bảo quản" name="preservationLossRate">
              <InputNumber
                min={0}
                style={{
                  width: "100%",
                }}
              />
            </Form.Item>

            <Form.Item label="Tiêu chuẩn chất lượng" name="qualityStandard">
              <Input />
            </Form.Item>
          </div>

          {/* =============================================
              MEDGUARD
          ============================================= */}

          <Title level={5}>Cấu hình MedGuard</Title>

          <div
            style={{
              display: "grid",

              gridTemplateColumns: "1fr 1fr",

              gap: 16,
            }}
          >
            <Form.Item label="Quyết định" name="decisionNo">
              <Input />
            </Form.Item>

            <Form.Item
              label="Tỷ lệ thanh toán BHYT (%)"
              name="insurancePaymentRate"
              rules={[
                {
                  type: "number",

                  min: 0,

                  max: 100,

                  message: "Tỷ lệ phải từ 0 đến 100.",
                },
              ]}
            >
              <InputNumber
                min={0}
                max={100}
                style={{
                  width: "100%",
                }}
              />
            </Form.Item>
          </div>

          <Form.Item label="Ghi chú" name="note">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item label="Đang sử dụng" name="active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* =================================================
          IMPORT MODAL
      ================================================= */}

      <Modal
        open={importModalOpen}
        title="Import Danh mục Thuốc"
        width={900}
        okText="Import"
        cancelText="Đóng"
        confirmLoading={importing}
        okButtonProps={{
          disabled: importFileList.length === 0 || importResult !== null,
        }}
        onOk={() => void handleImportExcel()}
        onCancel={closeImportModal}
      >
        <div
          style={{
            marginTop: 16,
          }}
        >
          <Alert
            type="info"
            showIcon
            title="Import Danh mục Thuốc từ Excel"
            description={
              <>
                Hệ thống tự nhận diện sheet có cột <b>MA_THUOC</b> và <b>TEN_THUOC</b>. Hỗ trợ trực
                tiếp file mẫu <b>Generic 324</b>. Các cột DEN_NGAY và DENNGAY được bỏ qua. Nếu có
                lỗi dữ liệu thì toàn bộ lần import sẽ bị hủy. Mã thuốc đã tồn tại sẽ được cập nhật,
                mã mới sẽ được thêm mới. Nếu MA_THUOC xuất hiện nhiều lần thì giữ dòng đầu tiên và
                các dòng còn lại được tính vào Bỏ qua.
              </>
            }
            style={{
              marginBottom: 16,
            }}
          />

          <Upload
            accept=".xlsx"
            maxCount={1}
            fileList={importFileList}
            beforeUpload={() => false}
            disabled={importing}
            onRemove={() => {
              setImportFileList([]);

              setImportResult(null);

              setImportErrors([]);

              setImportMessage("");

              return true;
            }}
            onChange={(info) => {
              setImportFileList(info.fileList.slice(-1));

              setImportResult(null);

              setImportErrors([]);

              setImportMessage("");
            }}
          >
            <Button icon={<UploadOutlined />} disabled={importing}>
              Chọn file Excel
            </Button>
          </Upload>

          {importResult && (
            <Alert
              type="success"
              showIcon
              style={{
                marginTop: 20,
              }}
              title={importMessage || "Import thành công"}
              description={
                <div
                  style={{
                    lineHeight: 2,
                  }}
                >
                  <div>
                    Tổng số dòng: <b>{importResult.totalRows}</b>
                  </div>

                  <div>
                    Thêm mới: <b>{importResult.inserted}</b>
                  </div>

                  <div>
                    Cập nhật: <b>{importResult.updated}</b>
                  </div>

                  <div>
                    Bỏ qua: <b>{importResult.skipped}</b>
                  </div>
                </div>
              }
            />
          )}

          {!importResult && importMessage && importErrors.length === 0 && (
            <Alert
              type="error"
              showIcon
              title={importMessage}
              style={{
                marginTop: 20,
              }}
            />
          )}

          {importErrors.length > 0 && (
            <div
              style={{
                marginTop: 20,
              }}
            >
              <Alert
                type="error"
                showIcon
                title={importMessage || `File có ${importErrors.length} lỗi.`}
                description="Không có thuốc nào được import. Hãy sửa các dòng lỗi rồi import lại."
                style={{
                  marginBottom: 12,
                }}
              />

              <Table<DrugImportError>
                size="small"
                bordered
                rowKey={(record) => `${record.row}-${record.field}-${record.message}`}
                dataSource={importErrors}
                pagination={{
                  pageSize: 10,

                  showSizeChanger: false,

                  showTotal: (value) => `Tổng lỗi: ${value}`,
                }}
                scroll={{
                  y: 320,
                }}
                columns={[
                  {
                    title: "Dòng",

                    dataIndex: "row",

                    width: 80,

                    align: "center",
                  },

                  {
                    title: "Cột",

                    dataIndex: "field",

                    width: 170,
                  },

                  {
                    title: "Lỗi",

                    dataIndex: "message",
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
          .drugs-page {
            width: 100%;
          }

          .drugs-breadcrumb {
            margin-bottom: 14px;
            font-size: 12px;
          }

          .drugs-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 16px;
          }

          .drugs-title-row {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .drugs-title-row h3 {
            margin: 0 !important;
            color: #172033 !important;
            font-size: 22px !important;
            font-weight: 800 !important;
          }

          .drugs-title-icon {
            color: #fa8c16;
            font-size: 25px;
          }

          .drugs-subtitle {
            display: block;
            margin-top: 3px;
            font-size: 12px;
          }

          .drugs-filter-grid {
            display: grid;
            grid-template-columns:
              minmax(180px, 0.9fr)
              minmax(250px, 1.4fr)
              minmax(230px, 1.2fr)
              minmax(160px, 0.8fr)
              auto;
            gap: 10px;
            align-items: end;
            margin-bottom: 14px;
          }

          .drugs-filter-item {
            min-width: 0;
          }

          .drugs-filter-label {
            display: block;
            margin-bottom: 6px;
            color: #172033;
            font-size: 12px;
            font-weight: 700;
          }

          .drugs-table {
            overflow: hidden;
            border: 1px solid #e6ebf1;
            border-radius: 8px;
          }

          .drugs-table .ant-table {
            border-radius: 8px;
          }

          .drugs-table
          .ant-table-container {
            border-start-start-radius: 8px;
            border-start-end-radius: 8px;
          }

          .drugs-table
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

          .drugs-table
          .ant-table-tbody
          > tr
          > td {
            padding: 11px 10px !important;
            color: #202a3b;
            font-size: 12px;
            vertical-align: middle;
            border-bottom: 1px solid #edf0f5 !important;
          }

          .drugs-table
          .ant-table-tbody
          > tr:hover
          > td {
            background: #f7fbff !important;
          }

          .drugs-table
          .ant-table-cell-fix-left,
          .drugs-table
          .ant-table-cell-fix-right {
            background: #ffffff;
          }

          .drugs-table
          .ant-table-thead
          .ant-table-cell-fix-left,
          .drugs-table
          .ant-table-thead
          .ant-table-cell-fix-right {
            background: #f3f6f9 !important;
          }

          .drugs-table
          .ant-pagination {
            margin: 14px 8px 6px;
          }

          .drugs-status {
            margin: 0;
            border-radius: 6px;
            font-size: 11px;
          }

          @media (max-width: 1150px) {
            .drugs-filter-grid {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 760px) {
            .drugs-header {
              flex-direction: column;
            }

            .drugs-filter-grid {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>
    </>
  );
}
