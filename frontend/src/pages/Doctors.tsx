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
  useRef,
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


// ======================================================
// PAGE
// ======================================================

export default function DoctorVisits() {

  // ====================================================
  // RESPONSIVE PAGE
  // ====================================================

  const pageRef =
    useRef<HTMLDivElement | null>(
      null
    );


  const tableAreaRef =
    useRef<HTMLDivElement | null>(
      null
    );


  const [
    pageHeight,
    setPageHeight,
  ] =
    useState<number | undefined>(
      undefined
    );


  const [
    tableScrollY,
    setTableScrollY,
  ] =
    useState(
      220
    );


  // ====================================================
  // KHÓA SCROLL TOÀN TRANG
  // ====================================================

  useEffect(
    () => {

      const html =
        document.documentElement;


      const body =
        document.body;


      const oldHtmlOverflow =
        html.style.overflow;


      const oldBodyOverflow =
        body.style.overflow;


      html.style.overflow =
        "hidden";


      body.style.overflow =
        "hidden";


      return () => {

        html.style.overflow =
          oldHtmlOverflow;


        body.style.overflow =
          oldBodyOverflow;

      };

    },
    []
  );


  // ====================================================
  // TÍNH CHIỀU CAO PAGE THEO VIEWPORT THỰC
  // ====================================================

  useEffect(
    () => {

      let rafId =
        0;


      const updatePageHeight =
        () => {

          window.cancelAnimationFrame(
            rafId
          );


          rafId =
            window.requestAnimationFrame(
              () => {

                const element =
                  pageRef.current;


                if (
                  !element
                ) {
                  return;
                }


                const rect =
                  element.getBoundingClientRect();


                const bottomGap =
                  20;


                const availableHeight =
                  window.innerHeight -
                  rect.top -
                  bottomGap;


                setPageHeight(
                  Math.max(
                    300,

                    Math.floor(
                      availableHeight
                    )
                  )
                );

              }
            );

        };


      updatePageHeight();


      window.addEventListener(
        "resize",
        updatePageHeight
      );


      const observer =
        new ResizeObserver(
          updatePageHeight
        );


      const parent =
        pageRef.current
          ?.parentElement;


      if (
        parent
      ) {

        observer.observe(
          parent
        );

      }


      return () => {

        window.cancelAnimationFrame(
          rafId
        );


        window.removeEventListener(
          "resize",
          updatePageHeight
        );


        observer.disconnect();

      };

    },
    []
  );


  // ====================================================
  // TÍNH CHIỀU CAO BODY TABLE
  // ====================================================

  useEffect(
    () => {

      let rafId =
        0;


      const updateTableHeight =
        () => {

          window.cancelAnimationFrame(
            rafId
          );


          rafId =
            window.requestAnimationFrame(
              () => {

                const area =
                  tableAreaRef.current;


                if (
                  !area
                ) {
                  return;
                }


                const tableCardHeader =
                  area.querySelector<HTMLElement>(
                    ".doctor-table-header"
                  );


                const antTableHeader =
                  area.querySelector<HTMLElement>(
                    ".ant-table-thead"
                  );


                const pagination =
                  area.querySelector<HTMLElement>(
                    ".ant-pagination"
                  );


                const tableCardHeaderHeight =
                  tableCardHeader
                    ?.offsetHeight ??
                  0;


                const antTableHeaderHeight =
                  antTableHeader
                    ?.offsetHeight ??
                  0;


                let paginationHeight =
                  0;


                if (
                  pagination
                ) {

                  const paginationStyle =
                    window.getComputedStyle(
                      pagination
                    );


                  paginationHeight =
                    pagination.offsetHeight +
                    (
                      parseFloat(
                        paginationStyle.marginTop
                      ) ||
                      0
                    ) +
                    (
                      parseFloat(
                        paginationStyle.marginBottom
                      ) ||
                      0
                    );

                }


                /*
                 * Chừa một ít cho scrollbar ngang
                 * và mép an toàn dưới bảng.
                 */

                const extraSpace =
                  18;


                const availableHeight =
                  area.clientHeight -
                  tableCardHeaderHeight -
                  antTableHeaderHeight -
                  paginationHeight -
                  extraSpace;


                setTableScrollY(
                  Math.max(
                    80,

                    Math.floor(
                      availableHeight
                    )
                  )
                );

              }
            );

        };


      const timer1 =
        window.setTimeout(
          updateTableHeight,
          0
        );


      const timer2 =
        window.setTimeout(
          updateTableHeight,
          120
        );


      window.addEventListener(
        "resize",
        updateTableHeight
      );


      const resizeObserver =
        new ResizeObserver(
          updateTableHeight
        );


      if (
        tableAreaRef.current
      ) {

        resizeObserver.observe(
          tableAreaRef.current
        );

      }


      /*
       * Khi Ant Table render data / pagination,
       * tính lại chiều cao.
       */

      const mutationObserver =
        new MutationObserver(
          updateTableHeight
        );


      if (
        tableAreaRef.current
      ) {

        mutationObserver.observe(
          tableAreaRef.current,
          {
            childList:
              true,

            subtree:
              true,
          }
        );

      }


      return () => {

        window.cancelAnimationFrame(
          rafId
        );


        window.clearTimeout(
          timer1
        );


        window.clearTimeout(
          timer2
        );


        window.removeEventListener(
          "resize",
          updateTableHeight
        );


        resizeObserver.disconnect();


        mutationObserver.disconnect();

      };

    },
    []
  );


  // ====================================================
  // DATA STATE
  // ====================================================

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


  // ====================================================
  // FILTER
  // ====================================================

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


  // ====================================================
  // PAGINATION
  // ====================================================

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


  // ====================================================
  // LOAD DOCTOR VISITS
  // ====================================================

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


  // ====================================================
  // EFFECT LOAD
  // ====================================================

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


  // ====================================================
  // STAFF OPTIONS
  // ====================================================

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


  // ====================================================
  // SUMMARY
  // ====================================================

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
          totalVisits,
        };

      },
      [
        items,
      ]
    );


  // ====================================================
  // RESET
  // ====================================================

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


  // ====================================================
  // COLUMNS
  // ====================================================

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


                {
                  code && (

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

                  )
                }

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


  // ====================================================
  // RENDER
  // ====================================================

  return (
    <div
      ref={
        pageRef
      }

      className="doctor-page"

      style={{
        height:
          pageHeight
            ? `${pageHeight}px`
            : "calc(100dvh - 160px)",
      }}
    >

      {/* ==================================================
          HEADER
      ================================================== */}

      <div
        className="doctor-header"
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

              fontSize:
                21,

              lineHeight:
                1.25,

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

                fontSize:
                  20,
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
                2,

              fontSize:
                12,
            }}
          >
            Thống kê lượt khám theo bác sĩ và ngày khám
          </Typography.Text>

        </div>

      </div>


      {/* ==================================================
          THỐNG KÊ
      ================================================== */}

      <div
        className="doctor-stat-grid"
      >

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

      </div>


      {/* ==================================================
          FILTER
      ================================================== */}

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


      {/* ==================================================
          TABLE AREA
      ================================================== */}

      <div
        ref={
          tableAreaRef
        }

        className="doctor-table-area"
      >

        <Card
          className="doctor-table-card"

          styles={{
            body: {
              padding:
                0,

              height:
                "100%",

              display:
                "flex",

              flexDirection:
                "column",

              overflow:
                "hidden",
            },
          }}
        >

          {/* ==============================================
              TABLE TITLE
          ============================================== */}

          <div
            className="doctor-table-header"
          >

            <div>

              <Typography.Text
                strong

                style={{
                  fontSize:
                    14,
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
                    11,
                }}
              >
                Tổng {total} dòng
              </Typography.Text>

            </div>


            <Typography.Text
              type="secondary"

              style={{
                fontSize:
                  11,
              }}
            >
              Thống kê số lượt khám theo từng bác sĩ
            </Typography.Text>

          </div>


          {/* ==============================================
              TABLE
          ============================================== */}

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

              y:
                tableScrollY,
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

      </div>


      {/* ==================================================
          STYLE
      ================================================== */}

      <style>
        {`

          /* ===============================================
             PAGE
          =============================================== */

          .doctor-page {
            display: flex;

            flex-direction: column;

            gap: 10px;

            width: 100%;

            min-height: 0;

            overflow: hidden;

            box-sizing: border-box;
          }


          /* ===============================================
             HEADER
          =============================================== */

          .doctor-header {
            display: flex;

            align-items: center;

            justify-content: space-between;

            gap: 12px;

            flex-shrink: 0;
          }


          /* ===============================================
             STAT
          =============================================== */

          .doctor-stat-grid {
            display: grid;

            grid-template-columns:
              repeat(
                2,
                minmax(
                  160px,
                  1fr
                )
              );

            gap: 10px;

            flex-shrink: 0;
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
                -1px
              );

            box-shadow:
              0
              6px
              20px
              rgba(
                15,
                23,
                42,
                0.07
              );
          }


          .doctor-stat-card
          .ant-card-body {
            display: flex;

            align-items: center;

            gap: 10px;

            padding:
              10px
              14px;
          }


          .doctor-stat-icon {
            width: 34px;

            height: 34px;

            display: flex;

            align-items: center;

            justify-content: center;

            flex-shrink: 0;

            border-radius:
              9px;

            font-size:
              16px;
          }


          .doctor-stat-label {
            color:
              #64748b;

            font-size:
              11px;

            font-weight:
              500;
          }


          .doctor-stat-value {
            margin-top:
              1px;

            color:
              #172033;

            font-size:
              19px;

            line-height:
              1.2;

            font-weight:
              800;
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


          /* ===============================================
             FILTER
          =============================================== */

          .doctor-filter-card {
            flex-shrink: 0;

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
              10px
              14px;
          }


          .doctor-filter-header {
            display: flex;

            align-items: center;

            justify-content: space-between;

            gap: 10px;

            margin-bottom:
              8px;
          }


          .doctor-filter-header
          .ant-typography {
            font-size:
              13px;
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

            gap: 8px;

            align-items: end;
          }


          .doctor-filter-field {
            min-width: 0;
          }


          .doctor-filter-label {
            display: block;

            margin-bottom:
              4px;

            color:
              #475569;

            font-size:
              11px;

            font-weight:
              700;
          }


          /* ===============================================
             TABLE AREA
          =============================================== */

          .doctor-table-area {
            flex: 1;

            min-height: 0;

            overflow: hidden;
          }


          .doctor-table-card {
            height: 100%;

            overflow: hidden;

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


          .doctor-table-card
          .ant-card-body {
            height: 100%;

            padding: 0 !important;

            display: flex;

            flex-direction: column;

            overflow: hidden;
          }


          .doctor-table-header {
            display: flex;

            align-items: center;

            justify-content: space-between;

            gap: 10px;

            padding:
              10px
              14px;

            flex-shrink: 0;

            border-bottom:
              1px solid
              #edf0f5;
          }


          /* ===============================================
             ANT TABLE FLEX
          =============================================== */

          .doctor-table-card
          .ant-table-wrapper {
            flex: 1;

            min-height: 0;

            display: flex;

            flex-direction: column;
          }


          .doctor-table-card
          .ant-spin-nested-loading {
            flex: 1;

            min-height: 0;
          }


          .doctor-table-card
          .ant-spin-container {
            height: 100%;

            min-height: 0;

            display: flex;

            flex-direction: column;
          }


          .doctor-table-card
          .ant-table {
            flex: 1;

            min-height: 0;
          }


          /* ===============================================
             TABLE BODY SCROLL
          =============================================== */

          .doctor-table-card
          .ant-table-body {
            overflow-y:
              auto !important;

            overscroll-behavior:
              contain;
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


          /* ===============================================
             STAFF
          =============================================== */

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


          /* ===============================================
             MONTH
          =============================================== */

          .doctor-month-pill {
            display: inline-flex;

            align-items: center;

            justify-content: center;

            min-width: 34px;

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


          /* ===============================================
             DATE
          =============================================== */

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


          /* ===============================================
             VISIT TAG
          =============================================== */

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


          /* ===============================================
             PAGINATION
          =============================================== */

          .doctor-table-card
          .ant-pagination {
            flex-shrink:
              0;

            margin-top:
              8px;

            margin-bottom:
              0;

            padding:
              0
              14px
              6px;
          }


          /* ===============================================
             SCROLLBAR
          =============================================== */

          .doctor-table-card
          .ant-table-body::-webkit-scrollbar {
            width:
              8px;

            height:
              8px;
          }


          .doctor-table-card
          .ant-table-body::-webkit-scrollbar-thumb {
            background:
              #cbd5e1;

            border-radius:
              999px;
          }


          .doctor-table-card
          .ant-table-body::-webkit-scrollbar-track {
            background:
              #f8fafc;
          }


          /* ===============================================
             MÀN HÌNH THẤP <= 820PX
          =============================================== */

          @media (max-height: 820px) {

            .doctor-page {
              gap:
                8px;
            }


            .doctor-header h3 {
              font-size:
                19px !important;
            }


            .doctor-header
            .ant-typography-secondary {
              font-size:
                11px !important;
            }


            .doctor-stat-card
            .ant-card-body {
              padding:
                7px
                12px;
            }


            .doctor-stat-icon {
              width:
                30px;

              height:
                30px;

              font-size:
                14px;
            }


            .doctor-stat-label {
              font-size:
                10px;
            }


            .doctor-stat-value {
              font-size:
                17px;
            }


            .doctor-filter-card
            .ant-card-body {
              padding:
                7px
                12px;
            }


            .doctor-filter-header {
              margin-bottom:
                5px;
            }


            .doctor-filter-label {
              margin-bottom:
                3px;

              font-size:
                10px;
            }


            .doctor-table-header {
              padding:
                8px
                12px;
            }

          }


          /* ===============================================
             MÀN HÌNH THẤP <= 700PX
          =============================================== */

          @media (max-height: 700px) {

            .doctor-page {
              gap:
                6px;
            }


            .doctor-header
            .ant-typography-secondary {
              display:
                none !important;
            }


            .doctor-stat-card
            .ant-card-body {
              padding:
                5px
                10px;
            }


            .doctor-stat-icon {
              width:
                28px;

              height:
                28px;

              font-size:
                13px;
            }


            .doctor-stat-value {
              font-size:
                16px;
            }


            .doctor-filter-header
            .ant-typography-secondary {
              display:
                none !important;
            }


            .doctor-filter-card
            .ant-card-body {
              padding:
                6px
                10px;
            }


            .doctor-table-header {
              padding:
                6px
                10px;
            }

          }


          /* ===============================================
             RESPONSIVE WIDTH
          =============================================== */

          @media (max-width: 1100px) {

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


          @media (max-width: 700px) {

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