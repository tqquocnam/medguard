import {
  Button,
  Card,
  DatePicker,
  Select,
  Table,
  Tag,
  Typography,
  message,
} from "antd";

import {
  CalendarOutlined,
  CheckCircleFilled,
  MedicineBoxOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import dayjs, {
  Dayjs,
} from "dayjs";

import {
  apiFetch,
} from "../api/apiClient";


interface MedicalStaff {
  id: string;

  fullName: string;

  socialInsuranceCode?:
    string |
    null;

  licenseNumber?:
    string |
    null;
}


interface DoctorVisitItem {
  staffId: string;

  fullName: string;

  socialInsuranceCode?:
    string |
    null;

  licenseNumber?:
    string |
    null;

  month: number;

  year: number;

  examDate: string;

  visitCount: number;
}


export default function DoctorVisits() {
  const [
    staffList,
    setStaffList,
  ] =
    useState<
      MedicalStaff[]
    >([]);


  const [
    items,
    setItems,
  ] =
    useState<
      DoctorVisitItem[]
    >([]);


  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );


  const [
    total,
    setTotal,
  ] =
    useState(
      0
    );


  const [
    staffId,
    setStaffId,
  ] =
    useState<
      string |
      undefined
    >();


  const [
    year,
    setYear,
  ] =
    useState(
      dayjs().year()
    );


  const [
    month,
    setMonth,
  ] =
    useState(
      dayjs().month() +
        1
    );


  const [
    paymentDate,
    setPaymentDate,
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
      10
    );


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
        await response.json();


      if (
        !response.ok ||
        json.success !==
          true
      ) {
        throw new Error(
          json.message ||
            "Không thể tải danh sách nhân viên."
        );
      }


      setStaffList(
        Array.isArray(
          json?.data?.items
        )
          ? json.data.items
          : []
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


  async function loadDoctorVisits() {
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
        staffId
      ) {
        params.set(
          "staffId",
          staffId
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
        paymentDate
      ) {
        params.set(
          "paymentDate",
          paymentDate
        );
      }


      const response =
        await apiFetch(
          `/reports/doctor-visits?${params.toString()}`,
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
            "Không thể tải lượt khám bác sĩ."
        );
      }


      setItems(
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
          : "Không thể tải lượt khám bác sĩ."
      );

    } finally {
      setLoading(
        false
      );
    }
  }


  useEffect(
    () => {
      void loadStaff();
    },
    []
  );


  useEffect(
    () => {
      void loadDoctorVisits();
    },
    [
      staffId,
      year,
      month,
      paymentDate,
      page,
      pageSize,
    ]
  );


  const staffOptions =
    useMemo(
      () => {
        return staffList.map(
          (
            staff
          ) => {
            const code =
              staff.licenseNumber ||
              staff.socialInsuranceCode ||
              "";


            return {
              value:
                staff.id,

              label:
                code
                  ? `${staff.fullName} - ${code}`
                  : staff.fullName,
            };
          }
        );
      },
      [
        staffList,
      ]
    );


  const summary =
    useMemo(
      () => {
        const uniqueStaff =
          new Set(
            items.map(
              (
                item
              ) =>
                item.staffId
            )
          ).size;


        const uniqueDates =
          new Set(
            items.map(
              (
                item
              ) =>
                item.examDate
            )
          ).size;


        const totalVisits =
          items.reduce(
            (
              sum,
              item
            ) =>
              sum +
              Number(
                item.visitCount ||
                  0
              ),
            0
          );


        return {
          uniqueStaff,
          uniqueDates,
          totalVisits,
        };
      },
      [
        items,
      ]
    );


  function handleReset() {
    setStaffId(
      undefined
    );

    setYear(
      dayjs().year()
    );

    setMonth(
      dayjs().month() +
        1
    );

    setPaymentDate(
      undefined
    );

    setPage(
      1
    );
  }


  const columns = [
    {
      title:
        "Nhân viên",

      dataIndex:
        "fullName",

      key:
        "fullName",

      width:
        270,

      fixed:
        "left" as const,

      render:
        (
          value:
            string,

          record:
            DoctorVisitItem
        ) => {
          const code =
            record.licenseNumber ||
            record.socialInsuranceCode ||
            "";


          return (
            <div
              className="doctor-staff-cell"
            >
              <div
                className="doctor-staff-avatar"
              >
                <UserOutlined />
              </div>


              <div
                style={{
                  minWidth:
                    0,
                }}
              >
                <Typography.Text
                  strong

                  style={{
                    display:
                      "block",

                    color:
                      "#172033",

                    lineHeight:
                      1.35,
                  }}
                >
                  {value}
                </Typography.Text>


                {code && (
                  <Typography.Text
                    type="secondary"

                    style={{
                      display:
                        "block",

                      marginTop:
                        2,

                      fontSize:
                        11,
                    }}
                  >
                    {code}
                  </Typography.Text>
                )}
              </div>
            </div>
          );
        },
    },

    {
      title:
        "Mã BHXH",

      dataIndex:
        "socialInsuranceCode",

      key:
        "socialInsuranceCode",

      width:
        155,

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
        "Mã CCHN/GPHN",

      dataIndex:
        "licenseNumber",

      key:
        "licenseNumber",

      width:
        175,

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
        "Tháng",

      dataIndex:
        "month",

      key:
        "month",

      width:
        90,

      align:
        "center" as const,

      render:
        (
          value:
            number
        ) => (
          <span
            className="doctor-month-pill"
          >
            {value}
          </span>
        ),
    },

    {
      title:
        "Năm",

      dataIndex:
        "year",

      key:
        "year",

      width:
        90,

      align:
        "center" as const,

      render:
        (
          value:
            number
        ) => (
          <Typography.Text
            strong
          >
            {value}
          </Typography.Text>
        ),
    },

    {
      title:
        "Ngày khám",

      dataIndex:
        "examDate",

      key:
        "examDate",

      width:
        140,

      render:
        (
          value:
            string
        ) => (
          <span
            className="doctor-date-cell"
          >
            <CalendarOutlined />

            {
              dayjs(
                value
              ).format(
                "DD/MM/YYYY"
              )
            }
          </span>
        ),
    },

    {
      title:
        "Lượt khám",

      dataIndex:
        "visitCount",

      key:
        "visitCount",

      width:
        130,

      align:
        "center" as const,

      render:
        (
          value:
            number
        ) => (
          <Tag
            color="success"

            icon={
              <CheckCircleFilled />
            }

            className="doctor-visit-tag"
          >
            {value}
          </Tag>
        ),
    },
  ];


  return (
    <div
      className="doctor-page"
    >
      <div
        className="doctor-header"
      >
        <div>
          <Typography.Title
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
            <MedicineBoxOutlined
              style={{
                marginRight:
                  10,

                color:
                  "#1677ff",
              }}
            />

            Bác sĩ khám
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
            Thống kê lượt khám theo bác sĩ và ngày khám
          </Typography.Text>
        </div>
      </div>


      <div
        className="doctor-stat-grid"
      >
        {/* <Card
          className="
            doctor-stat-card
            doctor-stat-total
          "
        >
          <div
            className="doctor-stat-icon"
          >
            <MedicineBoxOutlined />
          </div>

          <div>
            <div
              className="doctor-stat-label"
            >
             Danh sách lượt khám
            </div>

            <div
              className="doctor-stat-value"
            >
              {total}
            </div>
          </div>
        </Card> */}


        <Card
          className="
            doctor-stat-card
            doctor-stat-doctor
          "
        >
          <div
            className="doctor-stat-icon"
          >
            <TeamOutlined />
          </div>

          <div>
            <div
              className="doctor-stat-label"
            >
              Bác sĩ khám
            </div>

            <div
              className="doctor-stat-value"
            >
              {
                summary
                  .uniqueStaff
              }
            </div>
          </div>
        </Card>


        <Card
          className="
            doctor-stat-card
            doctor-stat-visits
          "
        >
          <div
            className="doctor-stat-icon"
          >
            <CheckCircleFilled />
          </div>

          <div>
            <div
              className="doctor-stat-label"
            >
              Số lượt khám
            </div>

            <div
              className="doctor-stat-value"
            >
              {
                summary
                  .totalVisits
              }
            </div>
          </div>
        </Card>


        {/* <Card
          className="
            doctor-stat-card
            doctor-stat-date
          "
        >
          <div
            className="doctor-stat-icon"
          >
            <CalendarOutlined />
          </div>

          <div>
            <div
              className="doctor-stat-label"
            >
              Tổng số ngày khám trên tháng
            </div>

            <div
              className="doctor-stat-value"
            >
              {
                summary
                  .uniqueDates
              }
            </div>
          </div>
        </Card> */}
      </div>


      <Card
        className="doctor-filter-card"
      >
        <div
          className="doctor-filter-header"
        >
          <div>
            <Typography.Text
              strong
            >
              Bộ lọc lượt khám
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
              Lọc theo bác sĩ, thời gian và ngày thanh toán
            </Typography.Text>
          </div>


          <Button
            icon={
              <ReloadOutlined />
            }

            loading={
              loading
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
        </div>


        <div
          className="doctor-filter-grid"
        >
          <div
            className="
              doctor-filter-field
              doctor-filter-staff
            "
          >
            <Typography.Text
              className="doctor-filter-label"
            >
              Nhân viên
            </Typography.Text>


            <Select
              showSearch

              allowClear

              value={
                staffId
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
                setStaffId(
                  value
                );

                setPage(
                  1
                );
              }}
            />
          </div>


          <div
            className="doctor-filter-field"
          >
            <Typography.Text
              className="doctor-filter-label"
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
                2024,
                2025,
                2026,
                2027,
              ].map(
                (
                  value
                ) => ({
                  value,

                  label:
                    String(
                      value
                    ),
                })
              )}

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
            className="doctor-filter-field"
          >
            <Typography.Text
              className="doctor-filter-label"
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
            className="doctor-filter-field"
          >
            <Typography.Text
              className="doctor-filter-label"
            >
              Ngày thanh toán
            </Typography.Text>


            <DatePicker
              value={
                paymentDate
                  ? dayjs(
                      paymentDate
                    )
                  : null
              }

              format="DD/MM/YYYY"

              placeholder="Ngày thanh toán"

              allowClear

              style={{
                width:
                  "100%",
              }}

              onChange={(
                value:
                  Dayjs |
                  null
              ) => {
                setPaymentDate(
                  value
                    ? value.format(
                        "YYYY-MM-DD"
                      )
                    : undefined
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
        className="doctor-table-card"

        styles={{
          body: {
            padding:
              0,
          },
        }}
      >
        <div
          className="doctor-table-header"
        >
          <div>
            <Typography.Text
              strong

              style={{
                fontSize:
                  15,
              }}
            >
              Danh sách lượt khám
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
              Tổng {total} dòng
            </Typography.Text>
          </div>


          <Typography.Text
            type="secondary"

            style={{
              fontSize:
                12,
            }}
          >
            Thống kê số lượt khám theo từng bác sĩ
          </Typography.Text>
        </div>


        <Table<
          DoctorVisitItem
        >
          rowKey={(
            record
          ) =>
            `${record.staffId}-${record.examDate}`
          }

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

          scroll={{
            x:
              1150,
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
      </Card>


      <style>
        {`
          .doctor-page {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .doctor-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }

          .doctor-stat-grid {
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

          .doctor-stat-card {
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

          .doctor-stat-card:hover {
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

          .doctor-stat-card
          .ant-card-body {
            display: flex;
            align-items: center;
            gap: 13px;

            padding:
              16px
              17px;
          }

          .doctor-stat-icon {
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

          .doctor-stat-label {
            color:
              #64748b;

            font-size:
              12px;

            font-weight:
              500;
          }

          .doctor-stat-value {
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

          .doctor-stat-total {
            border-left:
              4px solid
              #1677ff;
          }

          .doctor-stat-total
          .doctor-stat-icon {
            color:
              #1677ff;

            background:
              #e6f4ff;
          }

          .doctor-stat-doctor {
            border-left:
              4px solid
              #722ed1;
          }

          .doctor-stat-doctor
          .doctor-stat-icon {
            color:
              #722ed1;

            background:
              #f9f0ff;
          }

          .doctor-stat-visits {
            border-left:
              4px solid
              #52c41a;
          }

          .doctor-stat-visits
          .doctor-stat-icon {
            color:
              #52c41a;

            background:
              #f6ffed;
          }

          .doctor-stat-date {
            border-left:
              4px solid
              #faad14;
          }

          .doctor-stat-date
          .doctor-stat-icon {
            color:
              #d48806;

            background:
              #fffbe6;
          }

          .doctor-filter-card {
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

          .doctor-filter-card
          .ant-card-body {
            padding:
              15px;
          }

          .doctor-filter-header {
            display: flex;
            align-items: center;
            justify-content: space-between;

            gap: 12px;

            margin-bottom:
              14px;
          }

          .doctor-filter-grid {
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
                170px,
                1fr
              );

            gap: 10px;

            align-items: end;
          }

          .doctor-filter-field {
            min-width: 0;
          }

          .doctor-filter-label {
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

          .doctor-table-card {
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

          .doctor-table-header {
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

          .doctor-table-card
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

          .doctor-table-card
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

          .doctor-table-card
          .ant-table-tbody
          > tr:hover
          > td {
            background:
              #f5f9ff !important;
          }

          .doctor-staff-cell {
            display: flex;
            align-items: center;

            gap: 9px;
          }

          .doctor-staff-avatar {
            width: 30px;
            height: 30px;

            display: flex;
            align-items: center;
            justify-content: center;

            flex-shrink: 0;

            border-radius:
              9px;

            color:
              #1677ff;

            background:
              #e6f4ff;
          }

          .doctor-month-pill {
            display: inline-flex;
            align-items: center;
            justify-content: center;

            min-width:
              34px;

            padding:
              2px
              8px;

            border-radius:
              999px;

            color:
              #1677ff;

            background:
              #e6f4ff;

            font-weight:
              700;
          }

          .doctor-date-cell {
            display: inline-flex;
            align-items: center;

            gap: 6px;

            color:
              #334155;

            font-weight:
              600;
          }

          .doctor-date-cell
          .anticon {
            color:
              #1677ff;
          }

          .doctor-visit-tag {
            min-width:
              48px;

            margin:
              0;

            padding:
              3px
              9px;

            border-radius:
              999px;

            text-align:
              center;

            font-size:
              12px;

            font-weight:
              800;
          }

          .doctor-table-card
          .ant-pagination {
            padding:
              0
              16px
              12px;
          }

          @media
          (
            max-width:
              1100px
          ) {
            .doctor-stat-grid {
              grid-template-columns:
                repeat(
                  2,
                  minmax(
                    160px,
                    1fr
                  )
                );
            }

            .doctor-filter-grid {
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
            .doctor-header,
            .doctor-filter-header,
            .doctor-table-header {
              flex-direction:
                column;

              align-items:
                flex-start;
            }

            .doctor-stat-grid,
            .doctor-filter-grid {
              grid-template-columns:
                1fr;
            }
          }
        `}
      </style>
    </div>
  );
}