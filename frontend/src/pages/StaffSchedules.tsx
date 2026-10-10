import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  TimePicker,
  Typography,
  message,
} from "antd";

import {
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import dayjs, {
  type Dayjs,
} from "dayjs";

import {
  apiFetch,
} from "../api/apiClient";


// ======================================================
// TYPES
// ======================================================

interface MedicalStaff {
  id:
    string;

  fullName:
    string;

  socialInsuranceCode?:
    string |
    null;

  licenseNumber?:
    string |
    null;

  dailyTime?:
    string |
    null;

  weeklyTime?:
    string |
    null;
}


interface StaffSchedule {
  id:
    string;

  staffId:
    string;

  fullName:
    string;

  socialInsuranceCode?:
    string |
    null;

  licenseNumber?:
    string |
    null;

  workDate:
    string;

  startTime:
    string;

  endTime:
    string;

  status:
    | "ACTIVE"
    | "OFF";

  source:
    | "MANUAL"
    | "DEFAULT";

  note?:
    string |
    null;
}


interface ScheduleFormValues {
  staffId:
    string;

  workDate:
    Dayjs;

  startTime:
    Dayjs;

  endTime:
    Dayjs;

  status:
    | "ACTIVE"
    | "OFF";

  note?:
    string;
}


// ======================================================
// HELPERS
// ======================================================

function getWeekdayLabel(
  value:
    string
) {
  const date =
    dayjs(
      value
    );


  switch (
    date.day()
  ) {
    case 0:
      return "Chủ nhật";

    case 1:
      return "Thứ 2";

    case 2:
      return "Thứ 3";

    case 3:
      return "Thứ 4";

    case 4:
      return "Thứ 5";

    case 5:
      return "Thứ 6";

    case 6:
      return "Thứ 7";

    default:
      return "";
  }
}


function normalizeTime(
  value:
    string
) {
  return String(
    value ??
    ""
  ).slice(
    0,
    5
  );
}


async function readJson(
  response:
    Response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}


// ======================================================
// PAGE
// ======================================================

export default function StaffSchedules() {
  const [
    form,
  ] =
    Form.useForm<
      ScheduleFormValues
    >();


  const [
    staffList,
    setStaffList,
  ] =
    useState<
      MedicalStaff[]
    >([]);


  const [
    schedules,
    setSchedules,
  ] =
    useState<
      StaffSchedule[]
    >([]);


  const [
    total,
    setTotal,
  ] =
    useState(
      0
    );


  const [
    loading,
    setLoading,
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
    generating,
    setGenerating,
  ] =
    useState(
      false
    );


  const [
    selectedStaffId,
    setSelectedStaffId,
  ] =
    useState<
      string |
      undefined
    >();


  const [
    year,
    setYear,
  ] =
    useState<number>(
      dayjs().year()
    );


  const [
    month,
    setMonth,
  ] =
    useState<number>(
      dayjs().month() +
      1
    );


  const [
    status,
    setStatus,
  ] =
    useState<
      string |
      undefined
    >();


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
      50
    );


  const [
    modalOpen,
    setModalOpen,
  ] =
    useState(
      false
    );


  const [
    editingSchedule,
    setEditingSchedule,
  ] =
    useState<
      StaffSchedule |
      null
    >(
      null
    );


  // ====================================================
  // LOAD STAFF
  // ====================================================

  async function loadStaff() {
    try {
      const response =
        await apiFetch(
          "/catalog/medical-staff?page=1&pageSize=500&active=true",
          {
            method:
              "GET",
          }
        );


      const json =
        await readJson(
          response
        );


      if (
        !response.ok ||
        json?.success !==
          true
      ) {
        throw new Error(
          json?.message ||
          "Không thể tải danh sách nhân viên."
        );
      }


      const items =
        Array.isArray(
          json?.data?.items
        )
          ? json.data.items
          : [];


      setStaffList(
        items
      );

    } catch (
      error
    ) {
      message.error(
        error instanceof Error
          ? error.message
          : "Không thể tải danh sách nhân viên."
      );
    }
  }


  // ====================================================
  // LOAD SCHEDULES
  // ====================================================

  async function loadSchedules() {
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
        selectedStaffId
      ) {
        params.set(
          "staffId",
          selectedStaffId
        );
      }


      if (
        year
      ) {
        params.set(
          "year",
          String(
            year
          )
        );
      }


      if (
        month
      ) {
        params.set(
          "month",
          String(
            month
          )
        );
      }


      if (
        status
      ) {
        params.set(
          "status",
          status
        );
      }


      const response =
        await apiFetch(
          `/catalog/staff-schedules?${params.toString()}`,
          {
            method:
              "GET",
          }
        );


      const json =
        await readJson(
          response
        );


      if (
        !response.ok ||
        json?.success !==
          true
      ) {
        throw new Error(
          json?.message ||
          "Không thể tải lịch làm việc."
        );
      }


      setSchedules(
        Array.isArray(
          json?.data?.items
        )
          ? json.data.items
          : []
      );


      setTotal(
        Number(
          json?.data?.total ??
          0
        )
      );

    } catch (
      error
    ) {
      message.error(
        error instanceof Error
          ? error.message
          : "Không thể tải lịch làm việc."
      );

    } finally {
      setLoading(
        false
      );
    }
  }


  // ====================================================
  // EFFECTS
  // ====================================================

  useEffect(
    () => {
      void loadStaff();
    },
    []
  );


  useEffect(
    () => {
      void loadSchedules();
    },
    [
      selectedStaffId,
      year,
      month,
      status,
      page,
      pageSize,
    ]
  );


  // ====================================================
  // STAFF OPTIONS
  // ====================================================

  const staffOptions =
    useMemo(
      () =>
        staffList.map(
          (
            staff
          ) => ({
            value:
              staff.id,

            label:
              `${staff.fullName}` +
              (
                staff.licenseNumber
                  ? ` - ${staff.licenseNumber}`
                  : staff.socialInsuranceCode
                    ? ` - ${staff.socialInsuranceCode}`
                    : ""
              ),
          })
        ),
      [
        staffList,
      ]
    );


  // ====================================================
  // SUMMARY
  // ====================================================

  const summary =
    useMemo(
      () => {
        let active =
          0;

        let off =
          0;

        let manual =
          0;

        let defaultCount =
          0;


        for (
          const item
          of schedules
        ) {
          if (
            item.status ===
            "ACTIVE"
          ) {
            active++;
          }


          if (
            item.status ===
            "OFF"
          ) {
            off++;
          }


          if (
            item.source ===
            "MANUAL"
          ) {
            manual++;
          }


          if (
            item.source ===
            "DEFAULT"
          ) {
            defaultCount++;
          }
        }


        return {
          active,
          off,
          manual,
          defaultCount,
        };
      },
      [
        schedules,
      ]
    );


  // ====================================================
  // CREATE MODAL
  // ====================================================

  function openCreateModal() {
    setEditingSchedule(
      null
    );


    form.resetFields();


    form.setFieldsValue({
      staffId:
        selectedStaffId,

      workDate:
        dayjs(),

      startTime:
        dayjs(
          "07:00",
          "HH:mm"
        ),

      endTime:
        dayjs(
          "17:00",
          "HH:mm"
        ),

      status:
        "ACTIVE",

      note:
        "",
    });


    setModalOpen(
      true
    );
  }


  // ====================================================
  // EDIT MODAL
  // ====================================================

  function openEditModal(
    record:
      StaffSchedule
  ) {
    setEditingSchedule(
      record
    );


    form.setFieldsValue({
      staffId:
        record.staffId,

      workDate:
        dayjs(
          record.workDate
        ),

      startTime:
        dayjs(
          normalizeTime(
            record.startTime
          ),
          "HH:mm"
        ),

      endTime:
        dayjs(
          normalizeTime(
            record.endTime
          ),
          "HH:mm"
        ),

      status:
        record.status,

      note:
        record.note ??
        "",
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
        await form
          .validateFields();


      setSaving(
        true
      );


      const body = {
        staffId:
          values.staffId,

        workDate:
          values.workDate.format(
            "YYYY-MM-DD"
          ),

        startTime:
          values.startTime.format(
            "HH:mm"
          ),

        endTime:
          values.endTime.format(
            "HH:mm"
          ),

        status:
          values.status,

        source:
          "MANUAL",

        note:
          values.note?.trim() ||
          null,
      };


      const url =
        editingSchedule
          ? `/catalog/staff-schedules/${editingSchedule.id}`
          : "/catalog/staff-schedules";


      const response =
        await apiFetch(
          url,
          {
            method:
              editingSchedule
                ? "PUT"
                : "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                body
              ),
          }
        );


      const json =
        await readJson(
          response
        );


      if (
        !response.ok ||
        json?.success !==
          true
      ) {
        throw new Error(
          json?.message ||
          "Không thể lưu lịch."
        );
      }


      message.success(
        editingSchedule
          ? "Cập nhật lịch thành công."
          : "Thêm lịch thành công."
      );


      setModalOpen(
        false
      );


      setEditingSchedule(
        null
      );


      form.resetFields();


      await loadSchedules();

    } catch (
      error
    ) {
      if (
        error instanceof
        Error
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


  // ====================================================
  // DELETE
  // ====================================================

  async function handleDelete(
    id:
      string
  ) {
    try {
      const response =
        await apiFetch(
          `/catalog/staff-schedules/${id}`,
          {
            method:
              "DELETE",
          }
        );


      const json =
        await readJson(
          response
        );


      if (
        !response.ok ||
        json?.success !==
          true
      ) {
        throw new Error(
          json?.message ||
          "Không thể xóa lịch."
        );
      }


      message.success(
        "Xóa lịch thành công."
      );


      await loadSchedules();

    } catch (
      error
    ) {
      message.error(
        error instanceof Error
          ? error.message
          : "Không thể xóa lịch."
      );
    }
  }


  // ====================================================
  // GENERATE DEFAULT
  // ====================================================

  function handleGenerateDefault() {
    if (
      !selectedStaffId
    ) {
      message.warning(
        "Vui lòng chọn nhân viên trước."
      );

      return;
    }


    const staff =
      staffList.find(
        (
          item
        ) =>
          item.id ===
          selectedStaffId
      );


    Modal.confirm({
      title:
        "Tạo lịch mặc định?",

      icon:
        <ThunderboltOutlined />,

      width:
        560,

      content: (
        <div
          style={{
            marginTop:
              12,
          }}
        >
          <Typography.Paragraph>
            Nhân viên:{" "}

            <strong>
              {
                staff?.fullName ??
                ""
              }
            </strong>
          </Typography.Paragraph>


          <Typography.Paragraph>
            Tháng:{" "}

            <strong>
              {month}/{year}
            </strong>
          </Typography.Paragraph>


          <Typography.Paragraph>
            Thời gian ngày:{" "}

            <strong>
              {
                staff?.dailyTime ??
                "Chưa cấu hình"
              }
            </strong>
          </Typography.Paragraph>


          <Typography.Paragraph>
            Thời gian tuần:{" "}

            <strong>
              {
                staff?.weeklyTime ??
                "Chưa cấu hình"
              }
            </strong>
          </Typography.Paragraph>


          <Typography.Text
            type="secondary"
          >
            Hệ thống sẽ tự tạo lịch theo thông tin trong Danh mục Nhân viên y tế.
            Những ngày đã có lịch sẽ được bỏ qua và không ghi đè.
          </Typography.Text>
        </div>
      ),

      okText:
        "Tạo lịch",

      cancelText:
        "Hủy",

      onOk:
        async () => {
          try {
            setGenerating(
              true
            );


            const response =
              await apiFetch(
                "/catalog/staff-schedules/generate-default",
                {
                  method:
                    "POST",

                  headers: {
                    "Content-Type":
                      "application/json",
                  },

                  body:
                    JSON.stringify({
                      staffId:
                        selectedStaffId,

                      year,

                      month,
                    }),
                }
              );


            const json =
              await readJson(
                response
              );


            if (
              !response.ok ||
              json?.success !==
                true
            ) {
              throw new Error(
                json?.message ||
                "Không thể tạo lịch mặc định."
              );
            }


            message.success(
              json?.message ||
              "Tạo lịch mặc định thành công."
            );


            await loadSchedules();

          } catch (
            error
          ) {
            message.error(
              error instanceof Error
                ? error.message
                : "Không thể tạo lịch mặc định."
            );

          } finally {
            setGenerating(
              false
            );
          }
        },
    });
  }


  // ====================================================
  // RESET FILTER
  // ====================================================

  function handleReset() {
    setSelectedStaffId(
      undefined
    );


    setYear(
      dayjs().year()
    );


    setMonth(
      dayjs().month() +
      1
    );


    setStatus(
      undefined
    );


    setPage(
      1
    );
  }


  // ====================================================
  // RENDER
  // ====================================================

  return (
    <div
      className="schedule-page"
    >
      <div
        className="schedule-header"
      >
        <div>
          <Typography.Title
            level={
              3
            }

            style={{
              margin:
                0,

              color:
                "#172033",

              fontWeight:
                800,
            }}
          >
            <CalendarOutlined
              style={{
                marginRight:
                  10,

                color:
                  "#1677ff",
              }}
            />

            Lịch trực
          </Typography.Title>


          <Typography.Text
            type="secondary"

            style={{
              display:
                "block",

              marginTop:
                4,
            }}
          >
            Quản lý lịch làm việc của nhân viên y tế và làm dữ liệu đối chiếu hồ sơ XML
          </Typography.Text>
        </div>


        <Button
          type="primary"

          icon={
            <PlusOutlined />
          }

          onClick={
            openCreateModal
          }

          style={{
            borderRadius:
              8,

            fontWeight:
              700,

            height:
              36,

            paddingInline:
              16,

            boxShadow:
              "0 4px 12px rgba(22,119,255,0.2)",
          }}
        >
          Thêm lịch
        </Button>
      </div>


      <div
        className="schedule-stat-grid"
      >
        <Card
          className="schedule-stat-card schedule-stat-total"
        >
          <div
            className="schedule-stat-icon"
          >
            <CalendarOutlined />
          </div>

          <div>
            <div
              className="schedule-stat-label"
            >
              Tổng lịch
            </div>

            <div
              className="schedule-stat-value"
            >
              {total}
            </div>
          </div>
        </Card>


        <Card
          className="schedule-stat-card schedule-stat-active"
        >
          <div
            className="schedule-stat-icon"
          >
            <CheckCircleFilled />
          </div>

          <div>
            <div
              className="schedule-stat-label"
            >
              Đang làm
            </div>

            <div
              className="schedule-stat-value"
            >
              {
                summary.active
              }
            </div>
          </div>
        </Card>


        <Card
          className="schedule-stat-card schedule-stat-off"
        >
          <div
            className="schedule-stat-icon"
          >
            <StopOutlined />
          </div>

          <div>
            <div
              className="schedule-stat-label"
            >
              Nghỉ
            </div>

            <div
              className="schedule-stat-value"
            >
              {
                summary.off
              }
            </div>
          </div>
        </Card>


        <Card
          className="schedule-stat-card schedule-stat-default"
        >
          <div
            className="schedule-stat-icon"
          >
            <ThunderboltOutlined />
          </div>

          <div>
            <div
              className="schedule-stat-label"
            >
              Lịch mặc định
            </div>

            <div
              className="schedule-stat-value"
            >
              {
                summary.defaultCount
              }
            </div>
          </div>
        </Card>
      </div>


      <Card
        className="schedule-filter-card"
      >
        <div
          className="schedule-filter-header"
        >
          <div>
            <Typography.Text
              strong
            >
              Bộ lọc lịch làm việc
            </Typography.Text>


            <Typography.Text
              type="secondary"

              style={{
                display:
                  "block",

                marginTop:
                  2,

                fontSize:
                  12,
              }}
            >
              Lọc theo nhân viên, thời gian và trạng thái
            </Typography.Text>
          </div>


          <Space
            size={
              8
            }
          >
            <Button
              icon={
                <ReloadOutlined />
              }

              onClick={
                handleReset
              }

              style={{
                borderRadius:
                  8,

                fontWeight:
                  600,
              }}
            >
              Làm mới
            </Button>


            <Button
              icon={
                <ThunderboltOutlined />
              }

              loading={
                generating
              }

              onClick={
                handleGenerateDefault
              }

              style={{
                borderRadius:
                  8,

                fontWeight:
                  600,
              }}
            >
              Tạo lịch mặc định
            </Button>
          </Space>
        </div>


        <div
          className="schedule-filter-grid"
        >
          <div
            className="schedule-filter-field schedule-filter-staff"
          >
            <Typography.Text
              className="schedule-filter-label"
            >
              Nhân viên
            </Typography.Text>


            <Select
              showSearch

              allowClear

              value={
                selectedStaffId
              }

              placeholder="Chọn nhân viên"

              optionFilterProp="label"

              options={
                staffOptions
              }

              style={{
                width:
                  "100%",
              }}

              onChange={(
                value
              ) => {
                setSelectedStaffId(
                  value
                );

                setPage(
                  1
                );
              }}
            />
          </div>


          <div
            className="schedule-filter-field"
          >
            <Typography.Text
              className="schedule-filter-label"
            >
              Năm
            </Typography.Text>


            <Select
              value={
                year
              }

              style={{
                width:
                  "100%",
              }}

              options={[
                {
                  value:
                    2024,

                  label:
                    "2024",
                },

                {
                  value:
                    2025,

                  label:
                    "2025",
                },

                {
                  value:
                    2026,

                  label:
                    "2026",
                },

                {
                  value:
                    2027,

                  label:
                    "2027",
                },
              ]}

              onChange={(
                value
              ) => {
                setYear(
                  value
                );

                setPage(
                  1
                );
              }}
            />
          </div>


          <div
            className="schedule-filter-field"
          >
            <Typography.Text
              className="schedule-filter-label"
            >
              Tháng
            </Typography.Text>


            <Select
              value={
                month
              }

              style={{
                width:
                  "100%",
              }}

              options={
                Array.from(
                  {
                    length:
                      12,
                  },
                  (
                    _,
                    index
                  ) => ({
                    value:
                      index +
                      1,

                    label:
                      `Tháng ${index + 1}`,
                  })
                )
              }

              onChange={(
                value
              ) => {
                setMonth(
                  value
                );

                setPage(
                  1
                );
              }}
            />
          </div>


          <div
            className="schedule-filter-field"
          >
            <Typography.Text
              className="schedule-filter-label"
            >
              Trạng thái
            </Typography.Text>


            <Select
              allowClear

              value={
                status
              }

              placeholder="Tất cả"

              style={{
                width:
                  "100%",
              }}

              options={[
                {
                  value:
                    "ACTIVE",

                  label:
                    "Đang làm việc",
                },

                {
                  value:
                    "OFF",

                  label:
                    "Nghỉ",
                },
              ]}

              onChange={(
                value
              ) => {
                setStatus(
                  value
                );

                setPage(
                  1
                );
              }}
            />
          </div>
        </div>
      </Card>


      <Card
        className="schedule-table-card"

        styles={{
          body: {
            padding:
              0,
          },
        }}
      >
        <div
          className="schedule-table-header"
        >
          <div>
            <Typography.Text
              strong

              style={{
                fontSize:
                  15,
              }}
            >
              Danh sách lịch làm việc
            </Typography.Text>


            <Typography.Text
              type="secondary"

              style={{
                marginLeft:
                  8,

                fontSize:
                  12,
              }}
            >
              Tổng {total} lịch
            </Typography.Text>
          </div>


          <Typography.Text
            type="secondary"

            style={{
              fontSize:
                12,
            }}
          >
            Bấm biểu tượng bút để chỉnh sửa lịch
          </Typography.Text>
        </div>


        <Table<StaffSchedule>
          rowKey="id"

          loading={
            loading
          }

          dataSource={
            schedules
          }

          size="middle"

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

          rowClassName={(
            record
          ) =>
            record.status ===
            "OFF"
              ? "schedule-row-off"
              : ""
          }

          columns={[
            {
              title:
                "Nhân viên",

              dataIndex:
                "fullName",

              width:
                220,

              fixed:
                "left",

              render:
                (
                  value
                ) => (
                  <div
                    className="schedule-staff-cell"
                  >
                    <div
                      className="schedule-staff-avatar"
                    >
                      <TeamOutlined />
                    </div>

                    <Typography.Text
                      strong
                    >
                      {value}
                    </Typography.Text>
                  </div>
                ),
            },

            {
              title:
                "Mã BHXH",

              dataIndex:
                "socialInsuranceCode",

              width:
                145,

              render:
                (
                  value
                ) =>
                  value ||
                  "-",
            },

            {
              title:
                "Mã CCHN/GPHN",

              dataIndex:
                "licenseNumber",

              width:
                175,

              render:
                (
                  value
                ) =>
                  value ||
                  "-",
            },

            {
              title:
                "Ngày",

              dataIndex:
                "workDate",

              width:
                120,

              render:
                (
                  value
                ) => (
                  <Typography.Text
                    strong
                  >
                    {
                      dayjs(
                        value
                      ).format(
                        "DD/MM/YYYY"
                      )
                    }
                  </Typography.Text>
                ),
            },

            {
              title:
                "Thứ",

              dataIndex:
                "workDate",

              width:
                100,

              render:
                getWeekdayLabel,
            },

            {
              title:
                "Bắt đầu",

              dataIndex:
                "startTime",

              width:
                95,

              align:
                "center",

              render:
                (
                  value
                ) => (
                  <span
                    className="schedule-time"
                  >
                    <ClockCircleOutlined />

                    {
                      normalizeTime(
                        value
                      )
                    }
                  </span>
                ),
            },

            {
              title:
                "Kết thúc",

              dataIndex:
                "endTime",

              width:
                95,

              align:
                "center",

              render:
                (
                  value
                ) => (
                  <span
                    className="schedule-time"
                  >
                    {
                      normalizeTime(
                        value
                      )
                    }
                  </span>
                ),
            },

            {
              title:
                "Trạng thái",

              dataIndex:
                "status",

              width:
                125,

              render:
                (
                  value
                ) => {
                  if (
                    value ===
                    "ACTIVE"
                  ) {
                    return (
                      <Tag
                        color="success"

                        icon={
                          <CheckCircleFilled />
                        }

                        className="schedule-status-tag"
                      >
                        Đang làm
                      </Tag>
                    );
                  }


                  return (
                    <Tag
                      icon={
                        <StopOutlined />
                      }

                      className="schedule-status-tag"
                    >
                      Nghỉ
                    </Tag>
                  );
                },
            },

            {
              title:
                "Nguồn",

              dataIndex:
                "source",

              width:
                125,

              render:
                (
                  value
                ) => {
                  if (
                    value ===
                    "DEFAULT"
                  ) {
                    return (
                      <Tag
                        icon={
                          <ThunderboltOutlined />
                        }

                        color="blue"

                        className="schedule-status-tag"
                      >
                        Mặc định
                      </Tag>
                    );
                  }


                  return (
                    <Tag
                      icon={
                        <EditOutlined />
                      }

                      className="schedule-status-tag"
                    >
                      Thủ công
                    </Tag>
                  );
                },
            },

            {
              title:
                "Ghi chú",

              dataIndex:
                "note",

              width:
                180,

              ellipsis:
                true,

              render:
                (
                  value
                ) =>
                  value ||
                  "-",
            },

            {
              title:
                "Thao tác",

              key:
                "action",

              fixed:
                "right",

              width:
                115,

              align:
                "center",

              render:
                (
                  _,
                  record
                ) => (
                  <Space
                    size={
                      4
                    }
                  >
                    <Button
                      type="text"

                      className="schedule-action-edit"

                      icon={
                        <EditOutlined />
                      }

                      onClick={() =>
                        openEditModal(
                          record
                        )
                      }
                    />


                    <Popconfirm
                      title="Xóa lịch?"

                      description="Bạn có chắc muốn xóa lịch này?"

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

                        className="schedule-action-delete"

                        icon={
                          <DeleteOutlined />
                        }
                      />
                    </Popconfirm>
                  </Space>
                ),
            },
          ]}
        />
      </Card>


      <Modal
        open={
          modalOpen
        }

        className="schedule-form-modal"

        title={
          <div>
            <div
              style={{
                fontSize:
                  19,

                fontWeight:
                  800,

                color:
                  "#172033",
              }}
            >
              {
                editingSchedule
                  ? "Cập nhật lịch làm việc"
                  : "Thêm lịch làm việc"
              }
            </div>


            <div
              style={{
                marginTop:
                  3,

                color:
                  "#64748b",

                fontSize:
                  12,

                fontWeight:
                  400,
              }}
            >
              {
                editingSchedule
                  ? "Điều chỉnh thông tin lịch trực của nhân viên"
                  : "Tạo lịch làm việc mới cho nhân viên y tế"
              }
            </div>
          </div>
        }

        width={
          650
        }

        okText={
          editingSchedule
            ? "Cập nhật"
            : "Thêm lịch"
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


          setEditingSchedule(
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
            label="Nhân viên"

            name="staffId"

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
            />
          </Form.Item>


          <Form.Item
            label="Ngày làm việc"

            name="workDate"

            rules={[
              {
                required:
                  true,

                message:
                  "Vui lòng chọn ngày.",
              },
            ]}
          >
            <DatePicker
              format="DD/MM/YYYY"

              style={{
                width:
                  "100%",
              }}
            />
          </Form.Item>


          <div
            className="schedule-form-time-grid"
          >
            <Form.Item
              label="Giờ bắt đầu"

              name="startTime"

              rules={[
                {
                  required:
                    true,

                  message:
                    "Vui lòng chọn giờ bắt đầu.",
                },
              ]}
            >
              <TimePicker
                format="HH:mm"

                minuteStep={
                  5
                }

                style={{
                  width:
                    "100%",
                }}
              />
            </Form.Item>


            <Form.Item
              label="Giờ kết thúc"

              name="endTime"

              rules={[
                {
                  required:
                    true,

                  message:
                    "Vui lòng chọn giờ kết thúc.",
                },
              ]}
            >
              <TimePicker
                format="HH:mm"

                minuteStep={
                  5
                }

                style={{
                  width:
                    "100%",
                }}
              />
            </Form.Item>
          </div>


          <Form.Item
            label="Trạng thái"

            name="status"

            rules={[
              {
                required:
                  true,
              },
            ]}
          >
            <Select
              options={[
                {
                  value:
                    "ACTIVE",

                  label:
                    "Đang làm việc",
                },

                {
                  value:
                    "OFF",

                  label:
                    "Nghỉ",
                },
              ]}
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
        </Form>
      </Modal>


      <style>
        {`
          .schedule-page {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .schedule-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }

          .schedule-stat-grid {
            display: grid;
            grid-template-columns:
              repeat(
                4,
                minmax(
                  160px,
                  1fr
                )
              );
            gap: 14px;
          }

          .schedule-stat-card {
            border:
              1px solid
              #edf0f5;

            border-radius:
              14px;

            box-shadow:
              0
              4px
              18px
              rgba(
                15,
                23,
                42,
                0.04
              );

            transition:
              all
              0.2s
              ease;
          }

          .schedule-stat-card:hover {
            transform:
              translateY(
                -2px
              );

            box-shadow:
              0
              8px
              24px
              rgba(
                15,
                23,
                42,
                0.08
              );
          }

          .schedule-stat-card
          .ant-card-body {
            display: flex;
            align-items: center;
            gap: 13px;

            padding:
              16px
              17px;
          }

          .schedule-stat-icon {
            width: 40px;
            height: 40px;

            display: flex;
            align-items: center;
            justify-content: center;

            flex-shrink: 0;

            border-radius:
              11px;

            font-size:
              18px;
          }

          .schedule-stat-label {
            color:
              #64748b;

            font-size:
              12px;

            font-weight:
              500;
          }

          .schedule-stat-value {
            margin-top:
              2px;

            color:
              #172033;

            font-size:
              23px;

            line-height:
              1.2;

            font-weight:
              800;
          }

          .schedule-stat-total {
            border-left:
              4px solid
              #1677ff;
          }

          .schedule-stat-total
          .schedule-stat-icon {
            color:
              #1677ff;

            background:
              #e6f4ff;
          }

          .schedule-stat-active {
            border-left:
              4px solid
              #52c41a;
          }

          .schedule-stat-active
          .schedule-stat-icon {
            color:
              #52c41a;

            background:
              #f6ffed;
          }

          .schedule-stat-off {
            border-left:
              4px solid
              #ff4d4f;
          }

          .schedule-stat-off
          .schedule-stat-icon {
            color:
              #ff4d4f;

            background:
              #fff1f0;
          }

          .schedule-stat-default {
            border-left:
              4px solid
              #722ed1;
          }

          .schedule-stat-default
          .schedule-stat-icon {
            color:
              #722ed1;

            background:
              #f9f0ff;
          }

          .schedule-filter-card {
            border:
              1px solid
              #edf0f5;

            border-radius:
              14px;

            box-shadow:
              0
              4px
              18px
              rgba(
                15,
                23,
                42,
                0.04
              );
          }

          .schedule-filter-card
          .ant-card-body {
            padding:
              15px;
          }

          .schedule-filter-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;

            margin-bottom:
              14px;
          }

          .schedule-filter-grid {
            display: grid;

            grid-template-columns:
              minmax(
                280px,
                2fr
              )
              minmax(
                100px,
                0.7fr
              )
              minmax(
                120px,
                0.8fr
              )
              minmax(
                145px,
                1fr
              );

            gap: 10px;

            align-items: end;
          }

          .schedule-filter-field {
            min-width: 0;
          }

          .schedule-filter-label {
            display: block;

            margin-bottom:
              6px;

            color:
              #475569;

            font-size:
              12px;

            font-weight:
              700;
          }

          .schedule-table-card {
            overflow:
              hidden;

            border:
              1px solid
              #edf0f5;

            border-radius:
              14px;

            box-shadow:
              0
              4px
              18px
              rgba(
                15,
                23,
                42,
                0.04
              );
          }

          .schedule-table-header {
            display: flex;
            align-items: center;
            justify-content: space-between;

            gap: 12px;

            padding:
              14px
              16px;

            border-bottom:
              1px solid
              #edf0f5;
          }

          .schedule-table-card
          .ant-table-thead
          > tr
          > th {
            background:
              #f8fafc !important;

            color:
              #334155 !important;

            font-size:
              12px;

            font-weight:
              700 !important;

            border-bottom:
              1px solid
              #e8edf3 !important;
          }

          .schedule-table-card
          .ant-table-tbody
          > tr
          > td {
            color:
              #334155;

            font-size:
              12px;

            transition:
              background
              0.18s
              ease;
          }

          .schedule-table-card
          .ant-table-tbody
          > tr:hover
          > td {
            background:
              #f5f9ff !important;
          }

          .schedule-row-off
          > td {
            background:
              #fffafa;
          }

          .schedule-row-off
          > td:first-child {
            box-shadow:
              inset
              3px
              0
              0
              #ff7875;
          }

          .schedule-staff-cell {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .schedule-staff-avatar {
            width: 28px;
            height: 28px;

            display: flex;
            align-items: center;
            justify-content: center;

            flex-shrink: 0;

            border-radius:
              8px;

            color:
              #1677ff;

            background:
              #e6f4ff;
          }

          .schedule-time {
            display:
              inline-flex;

            align-items:
              center;

            justify-content:
              center;

            gap:
              5px;

            min-width:
              60px;

            color:
              #334155;

            font-weight:
              600;
          }

          .schedule-status-tag {
            margin:
              0;

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

          .schedule-action-edit,
          .schedule-action-delete {
            width:
              31px;

            height:
              31px;

            border-radius:
              8px;
          }

          .schedule-action-edit {
            color:
              #1677ff;
          }

          .schedule-action-edit:hover {
            color:
              #1677ff !important;

            background:
              #e6f4ff !important;
          }

          .schedule-action-delete:hover {
            background:
              #fff1f0 !important;
          }

          .schedule-table-card
          .ant-pagination {
            padding:
              0
              16px
              12px;
          }

          .schedule-form-modal
          .ant-modal-content {
            border-radius:
              16px;

            overflow:
              hidden;
          }

          .schedule-form-modal
          .ant-modal-header {
            margin-bottom:
              16px;
          }

          .schedule-form-time-grid {
            display:
              grid;

            grid-template-columns:
              1fr
              1fr;

            gap:
              14px;
          }

          @media
          (
            max-width:
              1100px
          ) {
            .schedule-stat-grid {
              grid-template-columns:
                repeat(
                  2,
                  minmax(
                    160px,
                    1fr
                  )
                );
            }

            .schedule-filter-grid {
              grid-template-columns:
                repeat(
                  2,
                  minmax(
                    180px,
                    1fr
                  )
                );
            }
          }

          @media
          (
            max-width:
              700px
          ) {
            .schedule-header,
            .schedule-filter-header,
            .schedule-table-header {
              flex-direction:
                column;

              align-items:
                flex-start;
            }

            .schedule-stat-grid,
            .schedule-filter-grid {
              grid-template-columns:
                1fr;
            }

            .schedule-form-time-grid {
              grid-template-columns:
                1fr;
            }
          }
        `}
      </style>
    </div>
  );
}