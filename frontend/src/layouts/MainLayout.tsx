import { useState } from "react";
import {
  AppstoreOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  LogoutOutlined,
  MedicineBoxOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Drawer, Grid, Layout, Menu, Space, Tag, Tooltip } from "antd";
import type { MenuProps } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const { Sider, Header, Content } = Layout;
const SIDEBAR_WIDTH = 242;
const COLLAPSED_WIDTH = 76;

type MenuItem = NonNullable<MenuProps["items"]>[number];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const sidebarCollapsed = collapsed ?? screens.xl === false;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const toggleMenu = () => {
    if (isMobile) setMobileMenuOpen((open) => !open);
    else setCollapsed(!sidebarCollapsed);
  };
  const navigateTo = (key: string) => {
    navigate(key);
    setMobileMenuOpen(false);
  };

  const selectedKey =
    location.pathname === "/dashboard"
      ? "/"
      : location.pathname.startsWith("/catalog")
        ? "/catalog"
        : location.pathname;

  const menuItems: MenuItem[] = [
    {
      type: "group",
      label: "TỔNG QUAN",
      children: [{ key: "/", icon: <DashboardOutlined />, label: "Dashboard" }],
    },
    {
      type: "group",
      label: "QUẢN LÝ HỒ SƠ",
      children: [
        { key: "/xml-import", icon: <UploadOutlined />, label: "XML Import" },
        { key: "/medical-cases", icon: <AppstoreOutlined />, label: "Danh sách hồ sơ" },
        { key: "/checks", icon: <CheckSquareOutlined />, label: "Kiểm tra hồ sơ" },
      ],
    },
    {
      type: "group",
      label: "NGHIỆP VỤ & HỆ THỐNG",
      children: [
        { key: "/schedule", icon: <CalendarOutlined />, label: "Lịch trực" },
        { key: "/doctors", icon: <MedicineBoxOutlined />, label: "Bác sĩ khám" },
        ...(isAdmin ? [{ key: "/catalog", icon: <AppstoreOutlined />, label: "Danh mục" }] : []),
      ],
    },
  ];

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <Layout
      className={`mg-shell${location.pathname === "/medical-cases" ? " mg-shell-fixed" : ""}`}
    >
      {!isMobile && (
        <Sider
          className="mg-sider"
          theme="light"
          width={SIDEBAR_WIDTH}
          collapsedWidth={COLLAPSED_WIDTH}
          collapsed={sidebarCollapsed}
          trigger={null}
          style={{
            position: "fixed",
            top: 0,
            bottom: 0,
            left: 0,
            height: "100dvh",
            overflow: "hidden",
            zIndex: 30,
            background: "#fff",
            borderRight: "1px solid #e8eef6",
            boxShadow: "3px 0 18px rgba(35, 59, 100, .035)",
          }}
        >
          <div className="mg-side-inner">
            <div className="mg-brand">
              <div className="mg-brand-mark">
                <SafetyCertificateOutlined />
              </div>
              {!sidebarCollapsed && (
                <div className="mg-brand-copy">
                  <strong>MedGuard</strong>
                  <small>BHYT MANAGEMENT</small>
                </div>
              )}
            </div>

            <div className="mg-menu-scroll">
              <Menu
                className="mg-menu"
                mode="inline"
                inlineCollapsed={sidebarCollapsed}
                selectedKeys={[selectedKey]}
                items={menuItems}
                onClick={({ key }) => navigateTo(key)}
              />
            </div>

            <div className="mg-side-bottom">
              <Tooltip title={sidebarCollapsed ? "Tài khoản" : ""} placement="right">
                <button
                  type="button"
                  className={`mg-account ${selectedKey === "/account" ? "mg-account-active" : ""}`}
                  onClick={() => navigateTo("/account")}
                >
                  <Avatar
                    size={34}
                    icon={<UserOutlined />}
                    style={{ background: "#e8f2ff", color: "#1677ff", flexShrink: 0 }}
                  />
                  {!sidebarCollapsed && (
                    <span className="mg-account-info">
                      <strong>{user?.username || "Tài khoản"}</strong>
                      <small>Chi nhánh {user?.branchId || "—"}</small>
                    </span>
                  )}
                </button>
              </Tooltip>
              <Tooltip title={sidebarCollapsed ? "Mở rộng menu" : ""} placement="right">
                <button
                  type="button"
                  className="mg-collapse-btn"
                  onClick={toggleMenu}
                  aria-label={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
                >
                  {sidebarCollapsed ? <DoubleRightOutlined /> : <DoubleLeftOutlined />}
                  {!sidebarCollapsed}
                </button>
              </Tooltip>
            </div>
          </div>
        </Sider>
      )}

      <Drawer
        title="MedGuard"
        placement="left"
        open={isMobile && mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        styles={{ wrapper: { width: "min(300px, 90vw)" }, body: { padding: 12 } }}
      >
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigateTo(key)}
        />
        <Button block icon={<UserOutlined />} onClick={() => navigateTo("/account")}>
          Tài khoản
        </Button>
      </Drawer>

      <Layout
        className="mg-main-layout"
        style={{ marginLeft: isMobile ? 0 : sidebarCollapsed ? COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
      >
        <Header className="mg-header">
          <div className="mg-header-left">
            <Tooltip title={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}>
              <Button
                type="text"
                className="mg-header-toggle"
                aria-label={
                  isMobile ? "Mở menu" : sidebarCollapsed ? "Mở rộng menu" : "Thu gọn menu"
                }
                icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={toggleMenu}
              />
            </Tooltip>
            <span className="mg-header-title">Hệ thống kiểm tra hồ sơ BHYT</span>
          </div>
          <Space size={10} className="mg-header-actions">
            <Avatar
              size={30}
              icon={<UserOutlined />}
              style={{ background: "#eff6ff", color: "#1677ff" }}
            />
            <strong className="mg-header-username">{user?.username}</strong>
            <Tooltip title={user?.branchName || "Chi nhánh hiện tại"}>
              <Tag
                color="blue"
                style={{
                  margin: 0,
                  borderRadius: 6,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                Chi nhánh {user?.branchId || "—"}
              </Tag>
            </Tooltip>
            <Button danger size="small" icon={<LogoutOutlined />} onClick={handleLogout}>
              <span className="mg-logout-label">Đăng xuất</span>
            </Button>
          </Space>
        </Header>

        <Content className="mg-content">
          <div className="mg-content-surface">
            <Outlet />
          </div>
        </Content>
      </Layout>

      <style>{`
        .mg-shell { min-height: 100dvh; background: #f5f7fb; }
        .mg-side-inner { height: 100%; display: flex; flex-direction: column; min-height: 0; }
        .mg-brand { height: 82px; min-height: 82px; display: flex; align-items: center; justify-content: flex-start; gap: 11px; padding: 0 16px; border-bottom: 1px solid #edf1f7; overflow: hidden; }
        .mg-brand-mark { width: 42px; height: 42px; flex-shrink: 0; border-radius: 13px; display: grid; place-items: center; background: linear-gradient(145deg,#1677ff,#4a9aff); box-shadow: 0 7px 17px rgba(22,119,255,.23); color: #fff; font-size: 23px; }
        .mg-brand-copy { display: flex; flex-direction: column; gap: 3px; white-space: nowrap; }
        .mg-brand-copy strong { font-size: 21px; letter-spacing: -.6px; font-weight: 800; color: #1669dc; line-height: 1; }
        .mg-brand-copy small { font-size: 9px; letter-spacing: 1.35px; color: #94a3b8; font-weight: 800; }
        .mg-menu-scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 13px 9px 12px; scrollbar-width: thin; scrollbar-color: #dbe5f2 transparent; }
        .mg-menu { border: 0 !important; background: transparent !important; }
        .mg-menu .ant-menu-item-group-title { padding: 14px 12px 7px !important; font-size: 10px !important; font-weight: 800 !important; letter-spacing: 1px; color: #95a4b9 !important; line-height: 16px !important; white-space: nowrap; }
        .mg-menu .ant-menu-item-group:first-child .ant-menu-item-group-title { padding-top: 3px !important; }
        .mg-menu .ant-menu-item { height: 43px; line-height: 43px; margin: 3px 0; width: 100%; border-radius: 10px; color: #45546c; font-size: 13px; font-weight: 600; padding-left: 14px !important; }
        .mg-menu .ant-menu-item .anticon { font-size: 17px; color: #76869e; }
        .mg-menu .ant-menu-item:hover { color: #1677ff !important; background: #f1f7ff !important; }
        .mg-menu .ant-menu-item:hover .anticon { color: #1677ff !important; }
        .mg-menu .ant-menu-item-selected { color: #1269e5 !important; background: #eaf3ff !important; font-weight: 800; box-shadow: inset 3px 0 0 #1677ff; }
        .mg-menu .ant-menu-item-selected .anticon { color: #1677ff !important; }
        .mg-sider.ant-layout-sider-collapsed .mg-brand { justify-content: center; padding: 0; }
        .mg-sider.ant-layout-sider-collapsed .mg-menu-scroll { padding: 12px 8px; }
        .mg-sider.ant-layout-sider-collapsed .mg-menu .ant-menu-item-group-title { display: none; }
        .mg-sider.ant-layout-sider-collapsed .mg-menu .ant-menu-item-group { padding-top: 14px; border-bottom: 1px solid #eff3f7; padding-bottom: 12px; }
        .mg-sider.ant-layout-sider-collapsed .mg-menu .ant-menu-item { padding: 0 !important; display: flex; justify-content: center; align-items: center; height: 46px; line-height: 46px; }
        .mg-sider.ant-layout-sider-collapsed .mg-menu .ant-menu-item .anticon { font-size: 19px; line-height: 1; }
        .mg-side-bottom { flex-shrink: 0; padding: 10px; border-top: 1px solid #edf1f7; background: #fff; }
        .mg-account, .mg-collapse-btn { border: 0; width: 100%; display: flex; align-items: center; text-align: left; cursor: pointer; border-radius: 10px; color: #52617a; background: transparent; transition: background .2s; }
        .mg-account { gap: 10px; padding: 9px 7px; min-height: 54px; }
        .mg-account:hover, .mg-account-active { background: #eef6ff; }
        .mg-account-info { display: flex; flex-direction: column; overflow: hidden; white-space: nowrap; gap: 3px; }
        .mg-account-info strong { font-size: 12px; color: #1d2a42; overflow: hidden; text-overflow: ellipsis; }
        .mg-account-info small { font-size: 11px; color: #94a3b8; }
        .mg-collapse-btn { gap: 12px; min-height: 36px; padding: 8px 15px; font-size: 12px; font-weight: 600; }
        .mg-collapse-btn:hover { background: #f2f6fc; color: #1677ff; }
        .mg-sider.ant-layout-sider-collapsed .mg-account, .mg-sider.ant-layout-sider-collapsed .mg-collapse-btn { justify-content: center; padding: 8px 0; }
        .mg-main-layout { flex: 1; width: 0; min-width: 0; min-height: 100dvh; transition: margin-left .2s ease; background: #f5f7fb; }
        .mg-header { height: 64px; line-height: normal; padding: 0 24px; background: #fff; border-bottom: 1px solid #e8edf3; display: flex; align-items: center; justify-content: space-between; gap: 12px; position: sticky; top: 0; z-index: 15; box-shadow: 0 2px 10px rgba(15,23,42,.02); }
        .mg-header-left { display: flex; align-items: center; min-width: 0; gap: 10px; }
        .mg-header-toggle { color: #64748b; font-size: 16px; }
        .mg-header-title { font-size: 14px; font-weight: 700; color: #334155; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mg-header-actions { flex-shrink: 0; }
        .mg-header-left { flex: 1; }
        .mg-header-toggle { flex-shrink: 0; }
        .mg-header-username { font-size: 13px; color: #172033; }
        .mg-role-tag { margin: 0; border-radius: 6px; font-weight: 700; }
        .mg-content { padding: 22px; background: #f5f7fb; min-width: 0; min-height: calc(100dvh - 64px); }
        .mg-content-surface { container-type: inline-size; background: #fff; border-radius: 12px; padding: 22px; min-height: 500px; min-width: 0; box-shadow: 0 4px 18px rgba(15,23,42,.025); }
        @media (max-width: 900px) { .mg-header { padding: 0 14px; } .mg-content { padding: 12px; } .mg-content-surface { padding: 14px; } }
        @media (max-width: 640px) { .mg-header-username, .mg-logout-label { display: none; } .mg-header-title { font-size: 12px; } .mg-role-tag { display: none; } .mg-header-actions { gap: 5px !important; } }
        @media (max-width: 1199px) { .mg-content { padding: 14px; } .mg-content-surface { padding: 16px; } }
        @media (max-width: 767px) { .mg-header-title { display: none; } .mg-header { padding: 0 10px; } .mg-content { padding: 8px; } .mg-content-surface { padding: 10px; min-height: 0; } }
      `}</style>
    </Layout>
  );
}
