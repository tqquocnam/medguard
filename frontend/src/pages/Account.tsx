import {
  CheckCircleOutlined,
  EditOutlined,
  LockOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiFetch } from "../api/apiClient";
import { useAuth } from "../auth/AuthContext";

interface AccountUser {
  id: string;
  username: string;
  full_name?: string | null;
  role?: string;
  branch_id?: string | null;
  active: boolean;
  last_login_at?: string | null;
  created_at?: string | null;
}

interface ProfileForm {
  fullName: string;
}

interface CreateUserForm {
  username: string;
  fullName?: string;
  password: string;
}

interface ChangePasswordForm {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

async function request<T>(
  path: string,
  fallbackMessage: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const response = await apiFetch(path, options);
  const json = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || json?.success !== true) {
    throw new Error(json?.message || fallbackMessage);
  }

  return json;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
}

const jsonHeaders = {
  "Content-Type": "application/json",
};

export default function Account() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();

  const [users, setUsers] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [updatingAccountId, setUpdatingAccountId] = useState<string | null>(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<AccountUser | null>(null);

  const [profileForm] = Form.useForm<ProfileForm>();
  const [createForm] = Form.useForm<CreateUserForm>();
  const [changePasswordForm] = Form.useForm<ChangePasswordForm>();
  const [resetPasswordForm] = Form.useForm<ResetPasswordForm>();

  const branchId = user?.branchId || "";
  const branchName = user?.branchName || "";

  const loadUsers = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!user?.id || !branchId) {
        setUsers([]);
        return;
      }

      setLoading(true);

      try {
        const json = await request<AccountUser[]>(
          "/auth/users",
          "Không thể tải danh sách tài khoản.",
          {
            method: "GET",
            cache: "no-store",
            signal,
          },
        );

        if (!signal?.aborted) {
          setUsers(Array.isArray(json.data) ? json.data : []);
        }
      } catch (error) {
        if (!signal?.aborted) {
          setUsers([]);
          void messageApi.error(errorMessage(error, "Không thể tải danh sách tài khoản."));
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [user?.id, branchId, messageApi],
  );

  useEffect(() => {
    const controller = new AbortController();

    setUsers([]);
    setProfileOpen(false);
    setCreateOpen(false);
    setChangePasswordOpen(false);
    setResetPasswordUser(null);

    void loadUsers(controller.signal);

    return () => controller.abort();
  }, [loadUsers]);

  const summary = useMemo(() => {
    const active = users.filter((account) => account.active).length;

    return {
      total: users.length,
      active,
      locked: users.length - active,
    };
  }, [users]);

  function openProfile(): void {
    profileForm.setFieldsValue({
      fullName: user?.fullName || "",
    });
    setProfileOpen(true);
  }

  async function handleUpdateProfile(values: ProfileForm): Promise<void> {
    setSavingProfile(true);

    try {
      await request("/auth/profile", "Không thể cập nhật tên hiển thị.", {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({
          fullName: values.fullName.trim(),
        }),
      });

      setProfileOpen(false);

      void messageApi.success("Cập nhật tên hiển thị thành công.");

      await Promise.all([refreshUser(), loadUsers()]);
    } catch (error) {
      void messageApi.error(errorMessage(error, "Không thể cập nhật tên hiển thị."));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleCreateUser(values: CreateUserForm): Promise<void> {
    if (!branchId) {
      void messageApi.error("Chưa xác định chi nhánh đăng nhập.");
      return;
    }

    setCreating(true);

    try {
      await request("/auth/users", "Không thể tạo tài khoản.", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          username: values.username.trim(),
          fullName: values.fullName?.trim() || undefined,
          password: values.password,
          role: "ADMIN",
        }),
      });

      void messageApi.success("Tạo tài khoản thành công.");
      setCreateOpen(false);
      createForm.resetFields();

      await loadUsers();
    } catch (error) {
      void messageApi.error(errorMessage(error, "Không thể tạo tài khoản."));
    } finally {
      setCreating(false);
    }
  }

  async function handleActive(account: AccountUser): Promise<void> {
    if (account.id === user?.id) {
      void messageApi.error("Bạn không thể khóa tài khoản đang đăng nhập.");
      return;
    }

    setUpdatingAccountId(account.id);

    try {
      await request(
        `/auth/users/${account.id}/active`,
        "Không thể cập nhật trạng thái tài khoản.",
        {
          method: "PATCH",
          headers: jsonHeaders,
          body: JSON.stringify({
            active: !account.active,
          }),
        },
      );

      void messageApi.success(account.active ? "Đã khóa tài khoản." : "Đã mở lại tài khoản.");

      await loadUsers();
    } catch (error) {
      void messageApi.error(errorMessage(error, "Không thể cập nhật trạng thái tài khoản."));
    } finally {
      setUpdatingAccountId(null);
    }
  }

  async function handleResetPassword(values: ResetPasswordForm): Promise<void> {
    if (!resetPasswordUser) return;

    if (values.password !== values.confirmPassword) {
      void messageApi.error("Xác nhận mật khẩu không khớp.");
      return;
    }

    setResettingPassword(true);

    try {
      await request(
        `/auth/users/${resetPasswordUser.id}/reset-password`,
        "Không thể đặt lại mật khẩu.",
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            password: values.password,
          }),
        },
      );

      void messageApi.success("Đặt lại mật khẩu thành công.");
      setResetPasswordUser(null);
      resetPasswordForm.resetFields();
    } catch (error) {
      void messageApi.error(errorMessage(error, "Không thể đặt lại mật khẩu."));
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleChangePassword(values: ChangePasswordForm): Promise<void> {
    if (values.newPassword !== values.confirmPassword) {
      void messageApi.error("Xác nhận mật khẩu mới không khớp.");
      return;
    }

    setChangingPassword(true);

    try {
      await request("/auth/change-password", "Không thể đổi mật khẩu.", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          oldPassword: values.oldPassword,
          newPassword: values.newPassword,
        }),
      });

      void messageApi.success("Đổi mật khẩu thành công.");
      setChangePasswordOpen(false);
      changePasswordForm.resetFields();
    } catch (error) {
      void messageApi.error(errorMessage(error, "Không thể đổi mật khẩu."));
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleLogout(): Promise<void> {
    setLoggingOut(true);

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      void messageApi.error(errorMessage(error, "Không thể đăng xuất."));
    } finally {
      setLoggingOut(false);
    }
  }

  const columns: ColumnsType<AccountUser> = [
    {
      title: "Tài khoản",
      dataIndex: "username",
      width: 210,
      fixed: "left",
      render: (value: string, record) => (
        <div className="account-user-cell">
          <Avatar size={34} icon={<UserOutlined />} className="account-user-avatar" />

          <div>
            <Typography.Text strong>{value}</Typography.Text>

            {record.id === user?.id && (
              <div className="account-current-label">Tài khoản hiện tại</div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Tên hiển thị",
      dataIndex: "full_name",
      width: 260,
      render: (value?: string | null) => (
        <span className="account-display-name">{value || "—"}</span>
      ),
    },
    {
      title: "Quyền",
      key: "permission",
      width: 170,
      render: () => (
        <Tag color="blue" icon={<SafetyOutlined />}>
          Quản trị chi nhánh
        </Tag>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "active",
      width: 130,
      align: "center",
      render: (active: boolean) => (
        <Tag color={active ? "success" : "error"} className="account-status-tag">
          {active ? "Hoạt động" : "Đã khóa"}
        </Tag>
      ),
    },
    {
      title: "Đăng nhập cuối",
      dataIndex: "last_login_at",
      width: 180,
      render: formatDate,
    },
    {
      title: "Ngày tạo",
      dataIndex: "created_at",
      width: 180,
      render: formatDate,
    },
    {
      title: "Thao tác",
      key: "actions",
      fixed: "right",
      width: 260,
      render: (_: unknown, record) => (
        <Space size={6} wrap>
          {/* {record.id === user?.id && (
            <Button size="small" icon={<EditOutlined />} onClick={openProfile}>
              Đổi tên
            </Button>
          )} */}

          <Button
            size="small"
            icon={<LockOutlined />}
            onClick={() => {
              resetPasswordForm.resetFields();
              setResetPasswordUser(record);
            }}
          >
            Đặt mật khẩu
          </Button>

          {record.id !== user?.id && (
            <Popconfirm
              title={record.active ? "Khóa tài khoản?" : "Mở lại tài khoản?"}
              description={
                record.active
                  ? `${record.username} sẽ không thể đăng nhập.`
                  : `Cho phép ${record.username} đăng nhập trở lại.`
              }
              okText={record.active ? "Khóa" : "Mở lại"}
              cancelText="Hủy"
              disabled={updatingAccountId !== null}
              onConfirm={() => handleActive(record)}
            >
              <Button
                size="small"
                danger={record.active}
                loading={updatingAccountId === record.id}
                disabled={updatingAccountId !== null && updatingAccountId !== record.id}
              >
                {record.active ? "Khóa" : "Mở"}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}

      <div className="account-page">
        <div className="account-page-header">
          <div>
            <Typography.Title level={3} className="account-page-title">
              <UserOutlined />
              Tài khoản
            </Typography.Title>

            <Typography.Text type="secondary">
              Quản lý tài khoản và mật khẩu trong chi nhánh của bạn
            </Typography.Text>
          </div>

          {/* <Tag color="blue" className="account-branch-tag">
            Chi nhánh {branchId || "—"}
          </Tag> */}
        </div>

        <Card className="account-profile-card">
          <div className="account-profile-main">
            <Avatar size={56} icon={<UserOutlined />} className="account-profile-avatar" />

            <div className="account-profile-info">
              <div className="account-profile-name">
                {user?.fullName || user?.username || "Tài khoản"}
              </div>

              <div className="account-profile-description">
                @{user?.username}
                {branchName ? ` · ${branchName}` : ""}
              </div>

              <div className="account-profile-meta">
                <Tag color="blue" icon={<SafetyOutlined />}>
                  Quản trị chi nhánh
                </Tag>

                <Tag color="success" icon={<CheckCircleOutlined />}>
                  Đang đăng nhập
                </Tag>
              </div>
            </div>

            <Space wrap className="account-profile-actions">
              <Button type="primary" ghost icon={<EditOutlined />} onClick={openProfile}>
                Đổi tên hiển thị
              </Button>

              <Button
                icon={<LockOutlined />}
                onClick={() => {
                  changePasswordForm.resetFields();
                  setChangePasswordOpen(true);
                }}
              >
                Đổi mật khẩu
              </Button>

              <Button
                danger
                icon={<LogoutOutlined />}
                loading={loggingOut}
                onClick={() => void handleLogout()}
              >
                Đăng xuất
              </Button>
            </Space>
          </div>
        </Card>

        <div className="account-stat-grid">
          <Card className="account-stat-card account-stat-total">
            <div className="account-stat-icon">
              <TeamOutlined />
            </div>
            <div>
              <div className="account-stat-label">Tổng tài khoản</div>
              <div className="account-stat-value">{summary.total}</div>
            </div>
          </Card>

          <Card className="account-stat-card account-stat-active">
            <div className="account-stat-icon">
              <CheckCircleOutlined />
            </div>
            <div>
              <div className="account-stat-label">Đang hoạt động</div>
              <div className="account-stat-value">{summary.active}</div>
            </div>
          </Card>

          <Card className="account-stat-card account-stat-locked">
            <div className="account-stat-icon">
              <LockOutlined />
            </div>
            <div>
              <div className="account-stat-label">Đã khóa</div>
              <div className="account-stat-value">{summary.locked}</div>
            </div>
          </Card>
        </div>

        <Card className="account-table-card" styles={{ body: { padding: 0 } }}>
          <div className="account-table-header">
            <div>
              <Typography.Text strong className="account-table-title">
                Danh sách tài khoản
              </Typography.Text>

              <div className="account-table-description">
                Mã CSKCB {branchId || "—"} - Các tài khoản có cùng quyền quản trị trong chi nhánh
              </div>
            </div>

            <Space wrap>
              <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadUsers()}>
                Làm mới
              </Button>

              <Button
                type="primary"
                icon={<PlusOutlined />}
                disabled={!branchId}
                onClick={() => {
                  createForm.resetFields();
                  setCreateOpen(true);
                }}
              >
                Tạo tài khoản
              </Button>
            </Space>
          </div>

          <Table<AccountUser>
            rowKey="id"
            loading={loading}
            dataSource={users}
            columns={columns}
            size="middle"
            rowClassName={(record) => (record.active ? "" : "account-row-locked")}
            locale={{
              emptyText: "Chưa có tài khoản trong chi nhánh",
            }}
            pagination={{
              defaultPageSize: 10,
              pageSizeOptions: ["10", "20", "50", "100"],
              showSizeChanger: true,
              showTotal: (total) => `Tổng số: ${total} tài khoản`,
            }}
            scroll={{ x: 1390 }}
          />
        </Card>

        <Modal
          title="Đổi tên hiển thị"
          className="account-form-modal"
          open={profileOpen}
          footer={null}
          closable={!savingProfile}
          mask={{ closable: !savingProfile }}
          keyboard={!savingProfile}
          onCancel={() => {
            if (!savingProfile) setProfileOpen(false);
          }}
        >
          <Form<ProfileForm>
            form={profileForm}
            layout="vertical"
            onFinish={handleUpdateProfile}
            disabled={savingProfile}
            className="account-form"
          >
            <Alert
              type="info"
              showIcon
              title="Tên hiển thị của tài khoản"
              description="Bạn có thể nhập tên phòng khám. Tên sau khi lưu sẽ hiển thị ở cuối sidebar."
              className="account-form-note"
            />

            <Form.Item
              label="Tên hiển thị"
              name="fullName"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: "Vui lòng nhập tên hiển thị.",
                },
                {
                  max: 255,
                  message: "Tên hiển thị tối đa 255 ký tự.",
                },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Phòng khám Đa khoa Sài Gòn Tâm Đức"
                maxLength={255}
              />
            </Form.Item>

            <div className="account-form-actions">
              <Button onClick={() => setProfileOpen(false)}>Hủy</Button>

              <Button type="primary" htmlType="submit" loading={savingProfile}>
                Lưu thay đổi
              </Button>
            </div>
          </Form>
        </Modal>

        <Modal
          title="Tạo tài khoản"
          className="account-form-modal"
          open={createOpen}
          footer={null}
          closable={!creating}
          mask={{ closable: !creating }}
          keyboard={!creating}
          onCancel={() => {
            if (!creating) setCreateOpen(false);
          }}
        >
          <Form<CreateUserForm>
            form={createForm}
            layout="vertical"
            onFinish={handleCreateUser}
            disabled={creating}
            className="account-form"
          >
            <Alert
              type="info"
              showIcon
              title={`Tài khoản thuộc chi nhánh ${branchId || "—"}`}
              description="Tài khoản mới có quyền quản trị trong chi nhánh này."
              className="account-form-note"
            />

            <Form.Item
              label="Tên đăng nhập"
              name="username"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: "Vui lòng nhập tên đăng nhập.",
                },
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder="Ví dụ: bacsi01" autoComplete="off" />
            </Form.Item>

            <Form.Item
              label="Tên hiển thị"
              name="fullName"
              rules={[
                {
                  max: 255,
                  message: "Tên hiển thị tối đa 255 ký tự.",
                },
              ]}
            >
              <Input placeholder="Tên người dùng hoặc tên phòng khám" maxLength={255} />
            </Form.Item>

            <Form.Item
              label="Mật khẩu"
              name="password"
              rules={[
                {
                  required: true,
                  message: "Vui lòng nhập mật khẩu.",
                },
                {
                  min: 6,
                  message: "Mật khẩu phải có ít nhất 6 ký tự.",
                },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Nhập mật khẩu"
                autoComplete="new-password"
              />
            </Form.Item>

            <div className="account-form-actions">
              <Button onClick={() => setCreateOpen(false)}>Hủy</Button>

              <Button type="primary" htmlType="submit" loading={creating}>
                Tạo tài khoản
              </Button>
            </div>
          </Form>
        </Modal>

        <Modal
          title="Đổi mật khẩu"
          className="account-form-modal"
          open={changePasswordOpen}
          footer={null}
          closable={!changingPassword}
          mask={{ closable: !changingPassword }}
          keyboard={!changingPassword}
          onCancel={() => {
            if (!changingPassword) setChangePasswordOpen(false);
          }}
        >
          <Form<ChangePasswordForm>
            form={changePasswordForm}
            layout="vertical"
            onFinish={handleChangePassword}
            disabled={changingPassword}
            className="account-form"
          >
            <Form.Item
              label="Mật khẩu hiện tại"
              name="oldPassword"
              rules={[
                {
                  required: true,
                  message: "Vui lòng nhập mật khẩu hiện tại.",
                },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
            </Form.Item>

            <Form.Item
              label="Mật khẩu mới"
              name="newPassword"
              rules={[
                {
                  required: true,
                  message: "Vui lòng nhập mật khẩu mới.",
                },
                {
                  min: 6,
                  message: "Mật khẩu phải có ít nhất 6 ký tự.",
                },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
            </Form.Item>

            <Form.Item
              label="Nhập lại mật khẩu mới"
              name="confirmPassword"
              dependencies={["newPassword"]}
              rules={[
                {
                  required: true,
                  message: "Vui lòng nhập lại mật khẩu mới.",
                },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("newPassword") === value) {
                      return Promise.resolve();
                    }

                    return Promise.reject(new Error("Xác nhận mật khẩu mới không khớp."));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
            </Form.Item>

            <Button type="primary" htmlType="submit" block loading={changingPassword}>
              Lưu mật khẩu mới
            </Button>
          </Form>
        </Modal>

        <Modal
          title="Đặt lại mật khẩu"
          className="account-form-modal"
          open={resetPasswordUser !== null}
          footer={null}
          closable={!resettingPassword}
          mask={{ closable: !resettingPassword }}
          keyboard={!resettingPassword}
          onCancel={() => {
            if (!resettingPassword) setResetPasswordUser(null);
          }}
        >
          <Form<ResetPasswordForm>
            form={resetPasswordForm}
            layout="vertical"
            onFinish={handleResetPassword}
            disabled={resettingPassword}
            className="account-form"
          >
            <Alert
              type="info"
              showIcon
              title={`Tài khoản: ${resetPasswordUser?.username || "—"}`}
              className="account-form-note"
            />

            <Form.Item
              label="Mật khẩu mới"
              name="password"
              rules={[
                {
                  required: true,
                  message: "Vui lòng nhập mật khẩu.",
                },
                {
                  min: 6,
                  message: "Mật khẩu phải có ít nhất 6 ký tự.",
                },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
            </Form.Item>

            <Form.Item
              label="Nhập lại mật khẩu"
              name="confirmPassword"
              dependencies={["password"]}
              rules={[
                {
                  required: true,
                  message: "Vui lòng nhập lại mật khẩu.",
                },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }

                    return Promise.reject(new Error("Xác nhận mật khẩu không khớp."));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
            </Form.Item>

            <Button type="primary" htmlType="submit" block loading={resettingPassword}>
              Đặt lại mật khẩu
            </Button>
          </Form>
        </Modal>
      </div>

      <style>{`
        .account-page {
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-width: 0;
        }

        .account-page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .account-page-title.ant-typography {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 0 5px;
          color: #172033;
          font-weight: 800;
        }

        .account-page-title > .anticon {
          color: #1677ff;
        }

        .account-branch-tag {
          margin: 0;
          padding: 5px 12px;
          border-radius: 8px;
          font-weight: 600;
          white-space: nowrap;
        }

        .account-profile-card,
        .account-stat-card,
        .account-table-card {
          border: 1px solid #e8edf4;
          border-radius: 14px;
          box-shadow: 0 4px 18px rgba(15, 23, 42, 0.035);
        }

        .account-profile-card .ant-card-body {
          padding: 22px;
        }

        .account-profile-main {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .account-profile-avatar {
          flex-shrink: 0;
          border-radius: 16px;
          background: #eaf3ff;
          color: #1677ff;
        }

        .account-profile-info {
          flex: 1;
          min-width: 0;
        }

        .account-profile-name {
          color: #172033;
          font-size: 20px;
          font-weight: 750;
          overflow-wrap: anywhere;
        }

        .account-profile-description {
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .account-profile-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
        }

        .account-profile-meta .ant-tag {
          margin: 0;
          border-radius: 6px;
        }

        .account-profile-actions {
          flex-shrink: 0;
        }

        .account-stat-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .account-stat-card .ant-card-body {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px;
        }

        .account-stat-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          border-radius: 12px;
          font-size: 20px;
        }

        .account-stat-label {
          color: #64748b;
          font-size: 12px;
        }

        .account-stat-value {
          margin-top: 3px;
          color: #172033;
          font-size: 26px;
          font-weight: 800;
          line-height: 1.2;
        }

        .account-stat-total {
          border-left: 4px solid #1677ff;
        }

        .account-stat-total .account-stat-icon {
          color: #1677ff;
          background: #eaf3ff;
        }

        .account-stat-active {
          border-left: 4px solid #52c41a;
        }

        .account-stat-active .account-stat-icon {
          color: #389e0d;
          background: #f0fae9;
        }

        .account-stat-locked {
          border-left: 4px solid #ff4d4f;
        }

        .account-stat-locked .account-stat-icon {
          color: #ff4d4f;
          background: #fff1f0;
        }

        .account-table-card {
          min-width: 0;
          overflow: hidden;
        }

        .account-table-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px;
          border-bottom: 1px solid #edf0f5;
        }

        .account-table-title {
          color: #172033;
          font-size: 15px;
        }

        .account-table-description {
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
        }

        .account-table-card .ant-table-thead > tr > th {
          color: #475569;
          background: #f8fafc;
          font-size: 12px;
          font-weight: 650;
        }

        .account-table-card .ant-table-tbody > tr > td {
          color: #334155;
          font-size: 12px;
        }

        .account-table-card .ant-table-tbody > tr:hover > td {
          background: #f5f9ff !important;
        }

        .account-display-name {
          white-space: normal;
          overflow-wrap: anywhere;
          line-height: 1.6;
        }

        .account-user-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .account-user-avatar {
          flex-shrink: 0;
          color: #1677ff;
          background: #eaf3ff;
          border-radius: 10px;
        }

        .account-current-label {
          margin-top: 2px;
          color: #94a3b8;
          font-size: 11px;
        }

        .account-status-tag {
          margin: 0;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 11px;
        }

        .account-row-locked > td {
          background: #fffafa;
        }

        .account-table-card .ant-pagination {
          padding: 0 16px;
        }

        .account-page .ant-btn {
          border-radius: 8px;
        }

        .account-form-modal .ant-modal-content {
          border-radius: 16px;
        }

        .account-form {
          margin-top: 20px;
        }

        .account-form-note {
          margin-bottom: 20px;
        }

        .account-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        @media (max-width: 1100px) {
          .account-profile-main {
            flex-wrap: wrap;
          }

          .account-profile-actions {
            width: 100%;
          }
        }

        @media (max-width: 900px) {
          .account-table-header {
            align-items: flex-start;
            flex-direction: column;
          }
        }

        @media (max-width: 600px) {
          .account-page-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .account-stat-grid {
            grid-template-columns: 1fr;
          }

          .account-profile-card .ant-card-body {
            padding: 16px;
          }

          .account-profile-name {
            font-size: 18px;
          }
        }
      `}</style>
    </>
  );
}
