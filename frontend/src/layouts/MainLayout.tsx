import {
  AppstoreOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
  LogoutOutlined,
  MedicineBoxOutlined,
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons";

import {
  Button,
  Layout,
  Menu,
  Space,
  Tag,
} from "antd";

import {
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../auth/AuthContext";


const {
  Sider,
  Header,
  Content,
} = Layout;


export default function MainLayout() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const {
    user,
    logout,
  } =
    useAuth();


  const isAdmin =
    user?.role ===
    "ADMIN";


  const menuItems = [
    {
      key: "/",
      icon: <DashboardOutlined />,
      label: "Dashboard",
    },

    {
      key: "/xml-import",
      icon: <UploadOutlined />,
      label: "XML Import",
    },

    {
      key: "/medical-cases",
      icon: <AppstoreOutlined />,
      label: "Danh sách hồ sơ",
    },

    {
      key: "/checks",
      icon: <CheckSquareOutlined />,
      label: "Kiểm tra hồ sơ",
    },

    {
      key: "/schedule",
      icon: <CalendarOutlined />,
      label: "Lịch trực",
    },

    {
      key: "/doctors",
      icon: <MedicineBoxOutlined />,
      label: "Bác sĩ khám",
    },

    ...(isAdmin
      ? [
          {
            key: "/catalog",
            icon: <AppstoreOutlined />,
            label: "Danh mục",
          },
        ]
      : []),

    {
      key: "/account",
      icon: <UserOutlined />,
      label: "Tài khoản",
    },
  ];


  let selectedKey =
    location.pathname;


  if (
    location.pathname.startsWith(
      "/catalog"
    )
  ) {
    selectedKey =
      "/catalog";
  }


  if (
    location.pathname ===
    "/dashboard"
  ) {
    selectedKey =
      "/";
  }


  async function handleLogout() {
    await logout();

    navigate(
      "/login",
      {
        replace: true,
      }
    );
  }


  return (
    <Layout
      style={{
        minHeight:
          "100vh",
      }}
    >
      <Sider
        width={220}
        theme="light"

        style={{
          borderRight:
            "1px solid #e8edf3",

          position:
            "fixed",

          left: 0,
          top: 0,
          bottom: 0,

          height:
            "100vh",

          overflow:
            "auto",

          background:
            "#ffffff",

          boxShadow:
            "4px 0 18px rgba(15, 23, 42, 0.03)",

          zIndex:
            20,
        }}
      >
        <div
          style={{
            height:
              76,

            display:
              "flex",

            alignItems:
              "center",

            gap:
              10,

            padding:
              "0 18px",

            borderBottom:
              "1px solid #f1f5f9",

            userSelect:
              "none",
          }}
        >
          <div
            style={{
              width:
                34,

              height:
                34,

              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "center",

              borderRadius:
                10,

              color:
                "#ffffff",

              fontSize:
                18,

              fontWeight:
                900,

              background:
                "linear-gradient(135deg, #1677ff 0%, #4096ff 100%)",

              boxShadow:
                "0 6px 16px rgba(22, 119, 255, 0.28)",
            }}
          >
            M
          </div>


          <div
            style={{
              display:
                "flex",

              flexDirection:
                "column",

              lineHeight:
                1.05,
            }}
          >
            <div
              style={{
                fontSize:
                  21,

                fontWeight:
                  900,

                color:
                  "#1677ff",

                letterSpacing:
                  "-0.5px",
              }}
            >
              MedGuard
            </div>

            <div
              style={{
                marginTop:
                  4,

                fontSize:
                  9,

                fontWeight:
                  700,

                letterSpacing:
                  "1.4px",

                color:
                  "#94a3b8",

                textTransform:
                  "uppercase",
              }}
            >
              BHYT SYSTEM
            </div>
          </div>
        </div>


        <Menu
          className="medguard-sidebar-menu"

          mode="inline"

          selectedKeys={[
            selectedKey,
          ]}

          items={
            menuItems
          }

          onClick={(
            item
          ) => {
            navigate(
              item.key
            );
          }}
        />


        <style>
          {`
            .medguard-sidebar-menu {
              border-inline-end: none !important;

              padding:
                10px
                7px;

              background:
                transparent !important;
            }

            .medguard-sidebar-menu
            .ant-menu-item {
              height:
                44px;

              line-height:
                44px;

              margin:
                3px
                0;

              padding-left:
                16px !important;

              border-radius:
                9px;

              color:
                #334155;

              font-size:
                14px;

              font-weight:
                600;

              transition:
                all
                0.2s
                ease;
            }

            .medguard-sidebar-menu
            .ant-menu-item
            .ant-menu-title-content {
              font-size:
                14px;

              font-weight:
                600;
            }

            .medguard-sidebar-menu
            .ant-menu-item
            .anticon {
              min-width:
                18px;

              font-size:
                16px;

              color:
                #64748b;

              transition:
                all
                0.2s
                ease;
            }

            .medguard-sidebar-menu
            .ant-menu-item:hover {
              color:
                #1677ff !important;

              background:
                #f0f7ff !important;
            }

            .medguard-sidebar-menu
            .ant-menu-item:hover
            .anticon {
              color:
                #1677ff !important;
            }

            .medguard-sidebar-menu
            .ant-menu-item-selected {
              color:
                #1677ff !important;

              background:
                linear-gradient(
                  90deg,
                  #e6f4ff,
                  #f0f8ff
                ) !important;

              font-weight:
                800;

              box-shadow:
                inset
                3px
                0
                0
                #1677ff;
            }

            .medguard-sidebar-menu
            .ant-menu-item-selected
            .ant-menu-title-content {
              font-weight:
                800;
            }

            .medguard-sidebar-menu
            .ant-menu-item-selected
            .anticon {
              color:
                #1677ff !important;
            }
          `}
        </style>
      </Sider>


      <Layout
        style={{
          marginLeft:
            220,
        }}
      >
        <Header
          style={{
            height:
              64,

            padding:
              "0 24px",

            background:
              "#ffffff",

            borderBottom:
              "1px solid #e8edf3",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "space-between",

            boxShadow:
              "0 2px 10px rgba(15, 23, 42, 0.025)",

            position:
              "sticky",

            top:
              0,

            zIndex:
              15,
          }}
        >
          <div
            style={{
              fontWeight:
                700,

              fontSize:
                15,

              color:
                "#334155",

              letterSpacing:
                "-0.1px",
            }}
          >
            Hệ thống kiểm tra hồ sơ BHYT
          </div>


          <Space
            size={
              12
            }
          >
            <UserOutlined
              style={{
                fontSize:
                  15,

                color:
                  "#64748b",
              }}
            />


            <strong
              style={{
                color:
                  "#172033",

                fontSize:
                  14,
              }}
            >
              {
                user?.username
              }
            </strong>


            {isAdmin ? (
              <Tag
                color="red"

                style={{
                  margin:
                    0,

                  borderRadius:
                    6,

                  fontWeight:
                    700,
                }}
              >
                ADMIN
              </Tag>
            ) : (
              <Tag
                color="blue"

                style={{
                  margin:
                    0,

                  borderRadius:
                    6,

                  fontWeight:
                    700,
                }}
              >
                USER
              </Tag>
            )}


            <Button
              danger

              size="small"

              icon={
                <LogoutOutlined />
              }

              onClick={
                handleLogout
              }

              style={{
                borderRadius:
                  7,

                fontWeight:
                  600,
              }}
            >
              Đăng xuất
            </Button>
          </Space>
        </Header>


        <Content
          style={{
            padding:
              24,

            background:
              "#f5f7fa",

            minHeight:
              "calc(100vh - 64px)",
          }}
        >
          <div
            style={{
              background:
                "#ffffff",

              padding:
                24,

              minHeight:
                500,

              borderRadius:
                10,

              boxShadow:
                "0 4px 18px rgba(15, 23, 42, 0.025)",
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}