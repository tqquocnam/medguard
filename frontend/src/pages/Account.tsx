import {
  LockOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";

import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../auth/AuthContext";


interface AccountUser {
  id: string;

  username: string;

  full_name?:
    string |
    null;

  role:
    | "ADMIN"
    | "USER"
    | string;

  active:
    boolean;

  last_login_at?:
    string |
    null;

  created_at?:
    string |
    null;
}


interface CreateUserForm {
  username:
    string;

  fullName?:
    string;

  password:
    string;

  role:
    | "ADMIN"
    | "USER";
}


interface ChangePasswordForm {
  oldPassword:
    string;

  newPassword:
    string;

  confirmPassword:
    string;
}


interface ResetPasswordForm {
  password:
    string;

  confirmPassword:
    string;
}


export default function Account() {
  const navigate =
    useNavigate();


  const {
    user,
    logout,
  } =
    useAuth();


  const [
    users,
    setUsers,
  ] =
    useState<
      AccountUser[]
    >([]);


  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );


  const [
    createOpen,
    setCreateOpen,
  ] =
    useState(
      false
    );


  const [
    changePasswordOpen,
    setChangePasswordOpen,
  ] =
    useState(
      false
    );


  const [
    resetPasswordUser,
    setResetPasswordUser,
  ] =
    useState<
      AccountUser |
      null
    >(
      null
    );


  const [
    createForm,
  ] =
    Form.useForm<
      CreateUserForm
    >();


  const [
    changePasswordForm,
  ] =
    Form.useForm<
      ChangePasswordForm
    >();


  const [
    resetPasswordForm,
  ] =
    Form.useForm<
      ResetPasswordForm
    >();


  const isAdmin =
    user?.role ===
    "ADMIN";


  function formatDate(
    value?:
      string |
      null
  ) {
    if (
      !value
    ) {
      return "-";
    }


    const date =
      new Date(
        value
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }


    return date.toLocaleString(
      "vi-VN"
    );
  }


  async function loadUsers() {
    if (
      !isAdmin
    ) {
      return;
    }


    try {
      setLoading(
        true
      );


      const response =
        await fetch(
          "http://localhost:3000/api/auth/users",
          {
            method:
              "GET",

            credentials:
              "include",
          }
        );


      const json =
        await response.json();


      if (
        !response.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
          "Không thể tải danh sách tài khoản."
        );
      }


      setUsers(
        json.data ??
        []
      );

    } catch (
      error
    ) {
      message.error(
        error instanceof Error
          ? error.message
          : "Không thể tải danh sách tài khoản."
      );

    } finally {
      setLoading(
        false
      );
    }
  }


  useEffect(
    () => {
      void loadUsers();
    },
    [
      isAdmin,
    ]
  );


  const accountSummary =
    useMemo(
      () => {
        const total =
          users.length;

        const active =
          users.filter(
            (
              item
            ) =>
              item.active
          ).length;

        const locked =
          users.filter(
            (
              item
            ) =>
              !item.active
          ).length;

        const admins =
          users.filter(
            (
              item
            ) =>
              item.role ===
              "ADMIN"
          ).length;


        return {
          total,
          active,
          locked,
          admins,
        };
      },
      [
        users,
      ]
    );


  async function handleCreateUser(
    values:
      CreateUserForm
  ) {
    try {
      setLoading(
        true
      );


      const response =
        await fetch(
          "http://localhost:3000/api/auth/users",
          {
            method:
              "POST",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                values
              ),
          }
        );


      const json =
        await response.json();


      if (
        !response.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
          "Không thể tạo tài khoản."
        );
      }


      message.success(
        "Tạo tài khoản thành công."
      );


      setCreateOpen(
        false
      );


      createForm.resetFields();


      await loadUsers();

    } catch (
      error
    ) {
      message.error(
        error instanceof Error
          ? error.message
          : "Không thể tạo tài khoản."
      );

    } finally {
      setLoading(
        false
      );
    }
  }


  async function handleActive(
    account:
      AccountUser
  ) {
    try {
      const response =
        await fetch(
          `http://localhost:3000/api/auth/users/${account.id}/active`,
          {
            method:
              "PATCH",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                active:
                  !account.active,
              }),
          }
        );


      const json =
        await response.json();


      if (
        !response.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
          "Không thể cập nhật tài khoản."
        );
      }


      message.success(
        json.message
      );


      await loadUsers();

    } catch (
      error
    ) {
      message.error(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật tài khoản."
      );
    }
  }


  async function handleRole(
    account:
      AccountUser,

    role:
      string
  ) {
    try {
      const response =
        await fetch(
          `http://localhost:3000/api/auth/users/${account.id}/role`,
          {
            method:
              "PATCH",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                role,
              }),
          }
        );


      const json =
        await response.json();


      if (
        !response.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
          "Không thể cập nhật quyền."
        );
      }


      message.success(
        "Cập nhật quyền thành công."
      );


      await loadUsers();

    } catch (
      error
    ) {
      message.error(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật quyền."
      );
    }
  }


  async function handleResetPassword(
    values:
      ResetPasswordForm
  ) {
    if (
      !resetPasswordUser
    ) {
      return;
    }


    if (
      values.password !==
      values.confirmPassword
    ) {
      message.error(
        "Xác nhận mật khẩu không khớp."
      );

      return;
    }


    try {
      setLoading(
        true
      );


      const response =
        await fetch(
          `http://localhost:3000/api/auth/users/${resetPasswordUser.id}/reset-password`,
          {
            method:
              "POST",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                password:
                  values.password,
              }),
          }
        );


      const json =
        await response.json();


      if (
        !response.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
          "Không thể đặt lại mật khẩu."
        );
      }


      message.success(
        "Đặt lại mật khẩu thành công."
      );


      setResetPasswordUser(
        null
      );


      resetPasswordForm.resetFields();

    } catch (
      error
    ) {
      message.error(
        error instanceof Error
          ? error.message
          : "Không thể đặt lại mật khẩu."
      );

    } finally {
      setLoading(
        false
      );
    }
  }


  async function handleChangePassword(
    values:
      ChangePasswordForm
  ) {
    if (
      values.newPassword !==
      values.confirmPassword
    ) {
      message.error(
        "Xác nhận mật khẩu mới không khớp."
      );

      return;
    }


    try {
      setLoading(
        true
      );


      const response =
        await fetch(
          "http://localhost:3000/api/auth/change-password",
          {
            method:
              "POST",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                oldPassword:
                  values.oldPassword,

                newPassword:
                  values.newPassword,
              }),
          }
        );


      const json =
        await response.json();


      if (
        !response.ok ||
        !json.success
      ) {
        throw new Error(
          json.message ||
          "Đổi mật khẩu thất bại."
        );
      }


      message.success(
        "Đổi mật khẩu thành công."
      );


      setChangePasswordOpen(
        false
      );


      changePasswordForm
        .resetFields();

    } catch (
      error
    ) {
      message.error(
        error instanceof Error
          ? error.message
          : "Đổi mật khẩu thất bại."
      );

    } finally {
      setLoading(
        false
      );
    }
  }


  async function handleLogout() {
    await logout();


    message.success(
      "Đã đăng xuất."
    );


    navigate(
      "/login",
      {
        replace:
          true,
      }
    );
  }


  const columns = [
    {
      title:
        "Tài khoản",

      dataIndex:
        "username",

      width:
        170,

      fixed:
        "left" as const,

      render:
        (
          value:
            string,

          record:
            AccountUser
        ) => (
          <div
            className="account-user-cell"
          >
            <div
              className={
                record.role ===
                "ADMIN"
                  ? "account-avatar account-avatar-admin"
                  : "account-avatar"
              }
            >
              {
                record.role ===
                "ADMIN"
                  ? (
                    <SafetyOutlined />
                  )
                  : (
                    <UserOutlined />
                  )
              }
            </div>


            <div>
              <Typography.Text
                strong

                style={{
                  display:
                    "block",

                  color:
                    "#172033",
                }}
              >
                {value}
              </Typography.Text>


              {record.id ===
                user?.id && (
                  <Typography.Text
                    type="secondary"

                    style={{
                      fontSize:
                        10,
                    }}
                  >
                    Tài khoản hiện tại
                  </Typography.Text>
                )}
            </div>
          </div>
        ),
    },

    {
      title:
        "Họ tên",

      dataIndex:
        "full_name",

      width:
        210,

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
        "Quyền",

      dataIndex:
        "role",

      width:
        145,

      render:
        (
          value:
            string,

          record:
            AccountUser
        ) => (
          <Select
            value={
              value
            }

            style={{
              width:
                110,
            }}

            disabled={
              record.id ===
              user?.id
            }

            options={[
              {
                value:
                  "USER",

                label:
                  "USER",
              },

              {
                value:
                  "ADMIN",

                label:
                  "ADMIN",
              },
            ]}

            onChange={(
              role
            ) =>
              handleRole(
                record,
                role
              )
            }
          />
        ),
    },

    {
      title:
        "Trạng thái",

      dataIndex:
        "active",

      width:
        125,

      align:
        "center" as const,

      render:
        (
          active:
            boolean
        ) =>
          active
            ? (
              <Tag
                color="success"

                className="account-status-tag"
              >
                Hoạt động
              </Tag>
            )
            : (
              <Tag
                color="error"

                className="account-status-tag"
              >
                Đã khóa
              </Tag>
            ),
    },

    {
      title:
        "Đăng nhập cuối",

      dataIndex:
        "last_login_at",

      width:
        180,

      render:
        formatDate,
    },

    {
      title:
        "Ngày tạo",

      dataIndex:
        "created_at",

      width:
        180,

      render:
        formatDate,
    },

    {
      title:
        "Thao tác",

      fixed:
        "right" as const,

      width:
        235,

      render:
        (
          _:
            unknown,

          record:
            AccountUser
        ) => (
          <Space
            size={
              6
            }
          >
            <Button
              size="small"

              icon={
                <LockOutlined />
              }

              style={{
                borderRadius:
                  7,

                fontWeight:
                  600,
              }}

              onClick={() => {
                resetPasswordForm
                  .resetFields();


                setResetPasswordUser(
                  record
                );
              }}
            >
              Đặt mật khẩu
            </Button>


            {record.id !==
              user?.id && (
                <Popconfirm
                  title={
                    record.active
                      ? "Khóa tài khoản?"
                      : "Mở lại tài khoản?"
                  }

                  description={
                    record.active
                      ? `Tài khoản ${record.username} sẽ không thể đăng nhập.`
                      : `Cho phép ${record.username} đăng nhập lại?`
                  }

                  okText="Đồng ý"

                  cancelText="Hủy"

                  onConfirm={() =>
                    handleActive(
                      record
                    )
                  }
                >
                  <Button
                    size="small"

                    danger={
                      record.active
                    }

                    style={{
                      borderRadius:
                        7,

                      fontWeight:
                        600,
                    }}
                  >
                    {
                      record.active
                        ? "Khóa"
                        : "Mở"
                    }
                  </Button>
                </Popconfirm>
              )}
          </Space>
        ),
    },
  ];


  return (
    <div
      className="account-page"
    >
      <div
        className="account-page-header"
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
            <UserOutlined
              style={{
                marginRight:
                  10,

                color:
                  "#1677ff",
              }}
            />

            Tài khoản
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
            Quản lý thông tin đăng nhập, mật khẩu và phân quyền người dùng
          </Typography.Text>
        </div>
      </div>


      <Card
        className="account-profile-card"
      >
        <div
          className="account-profile-main"
        >
          <div
            className="account-profile-avatar"
          >
            <UserOutlined />
          </div>


          <div
            className="account-profile-info"
          >
            <div
              className="account-profile-name"
            >
              {
                user?.username
              }
            </div>


            <div
              className="account-profile-meta"
            >
              {user?.role ===
              "ADMIN" ? (
                <Tag
                  color="red"

                  icon={
                    <SafetyOutlined />
                  }

                  className="account-role-tag"
                >
                  ADMIN
                </Tag>
              ) : (
                <Tag
                  color="blue"

                  className="account-role-tag"
                >
                  USER
                </Tag>
              )}


              <Tag
                color="success"

                className="account-role-tag"
              >
                Đang đăng nhập
              </Tag>
            </div>
          </div>


          <div
            className="account-profile-actions"
          >
            <Button
              icon={
                <LockOutlined />
              }

              onClick={() => {
                changePasswordForm
                  .resetFields();


                setChangePasswordOpen(
                  true
                );
              }}

              style={{
                borderRadius:
                  8,

                fontWeight:
                  600,
              }}
            >
              Đổi mật khẩu
            </Button>


            <Button
              danger

              icon={
                <LogoutOutlined />
              }

              onClick={
                handleLogout
              }

              style={{
                borderRadius:
                  8,

                fontWeight:
                  600,
              }}
            >
              Đăng xuất
            </Button>
          </div>
        </div>
      </Card>


      {isAdmin && (
        <>
          <div
            className="account-stat-grid"
          >
            <Card
              className="
                account-stat-card
                account-stat-total
              "
            >
              <div
                className="account-stat-icon"
              >
                <TeamOutlined />
              </div>

              <div>
                <div
                  className="account-stat-label"
                >
                  Tổng tài khoản
                </div>

                <div
                  className="account-stat-value"
                >
                  {
                    accountSummary
                      .total
                  }
                </div>
              </div>
            </Card>


            <Card
              className="
                account-stat-card
                account-stat-active
              "
            >
              <div
                className="account-stat-icon"
              >
                <UserOutlined />
              </div>

              <div>
                <div
                  className="account-stat-label"
                >
                  Đang hoạt động
                </div>

                <div
                  className="account-stat-value"
                >
                  {
                    accountSummary
                      .active
                  }
                </div>
              </div>
            </Card>


            <Card
              className="
                account-stat-card
                account-stat-admin
              "
            >
              <div
                className="account-stat-icon"
              >
                <SafetyOutlined />
              </div>

              <div>
                <div
                  className="account-stat-label"
                >
                  Quản trị viên
                </div>

                <div
                  className="account-stat-value"
                >
                  {
                    accountSummary
                      .admins
                  }
                </div>
              </div>
            </Card>


            <Card
              className="
                account-stat-card
                account-stat-locked
              "
            >
              <div
                className="account-stat-icon"
              >
                <LockOutlined />
              </div>

              <div>
                <div
                  className="account-stat-label"
                >
                  Đã khóa
                </div>

                <div
                  className="account-stat-value"
                >
                  {
                    accountSummary
                      .locked
                  }
                </div>
              </div>
            </Card>
          </div>


          <Card
            className="account-table-card"

            styles={{
              body: {
                padding:
                  0,
              },
            }}
          >
            <div
              className="account-table-header"
            >
              <div>
                <Typography.Text
                  strong

                  style={{
                    fontSize:
                      15,
                  }}
                >
                  Quản lý tài khoản
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
                  Tạo tài khoản, phân quyền và quản lý trạng thái đăng nhập
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

                  loading={
                    loading
                  }

                  onClick={
                    loadUsers
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
                  type="primary"

                  icon={
                    <PlusOutlined />
                  }

                  onClick={() => {
                    createForm
                      .resetFields();


                    createForm
                      .setFieldsValue({
                        role:
                          "USER",
                      });


                    setCreateOpen(
                      true
                    );
                  }}

                  style={{
                    borderRadius:
                      8,

                    fontWeight:
                      700,

                    boxShadow:
                      "0 4px 12px rgba(22,119,255,0.2)",
                  }}
                >
                  Tạo tài khoản
                </Button>
              </Space>
            </div>


            <Table<AccountUser>
              rowKey="id"

              loading={
                loading
              }

              dataSource={
                users
              }

              columns={
                columns
              }

              size="middle"

              rowClassName={(
                record
              ) =>
                !record.active
                  ? "account-row-locked"
                  : ""
              }

              pagination={{
                pageSize:
                  10,

                pageSizeOptions: [
                  "10",
                  "50",
                  "100",
                ],

                showSizeChanger:
                  true,

                showTotal:
                  (
                    total
                  ) =>
                    `Tổng số: ${total}`,
              }}

              scroll={{
                x:
                  1050,
              }}
            />
          </Card>
        </>
      )}


      <Modal
        className="account-form-modal"

        title={
          <div>
            <div
              className="account-modal-title"
            >
              Tạo tài khoản
            </div>

            <div
              className="account-modal-description"
            >
              Tạo người dùng mới cho hệ thống MedGuard
            </div>
          </div>
        }

        open={
          createOpen
        }

        onCancel={() =>
          setCreateOpen(
            false
          )
        }

        footer={
          null
        }

        destroyOnHidden
      >
        <Form<CreateUserForm>
          form={
            createForm
          }

          layout="vertical"

          onFinish={
            handleCreateUser
          }

          style={{
            marginTop:
              18,
          }}
        >
          <Form.Item
            label="Tài khoản"

            name="username"

            rules={[
              {
                required:
                  true,

                message:
                  "Vui lòng nhập tài khoản.",
              },

              {
                min:
                  3,

                message:
                  "Tài khoản phải có ít nhất 3 ký tự.",
              },
            ]}
          >
            <Input
              prefix={
                <UserOutlined />
              }

              placeholder="Ví dụ: bacsi01"
            />
          </Form.Item>


          <Form.Item
            label="Họ và tên"

            name="fullName"
          >
            <Input
              placeholder="Nguyễn Văn A"
            />
          </Form.Item>


          <Form.Item
            label="Mật khẩu"

            name="password"

            rules={[
              {
                required:
                  true,

                message:
                  "Vui lòng nhập mật khẩu.",
              },

              {
                min:
                  6,

                message:
                  "Mật khẩu phải có ít nhất 6 ký tự.",
              },
            ]}
          >
            <Input.Password
              prefix={
                <LockOutlined />
              }

              placeholder="Mật khẩu"
            />
          </Form.Item>


          <Form.Item
            label="Quyền"

            name="role"

            initialValue="USER"
          >
            <Select
              options={[
                {
                  value:
                    "USER",

                  label:
                    "USER",
                },

                {
                  value:
                    "ADMIN",

                  label:
                    "ADMIN",
                },
              ]}
            />
          </Form.Item>


          <Space
            style={{
              width:
                "100%",

              justifyContent:
                "flex-end",
            }}
          >
            <Button
              onClick={() =>
                setCreateOpen(
                  false
                )
              }
            >
              Hủy
            </Button>


            <Button
              type="primary"

              htmlType="submit"

              loading={
                loading
              }
            >
              Tạo tài khoản
            </Button>
          </Space>
        </Form>
      </Modal>


      <Modal
        className="account-form-modal"

        title={
          <div>
            <div
              className="account-modal-title"
            >
              Đổi mật khẩu
            </div>

            <div
              className="account-modal-description"
            >
              Cập nhật mật khẩu đăng nhập hiện tại
            </div>
          </div>
        }

        open={
          changePasswordOpen
        }

        onCancel={() =>
          setChangePasswordOpen(
            false
          )
        }

        footer={
          null
        }

        destroyOnHidden
      >
        <Form<ChangePasswordForm>
          form={
            changePasswordForm
          }

          layout="vertical"

          onFinish={
            handleChangePassword
          }

          style={{
            marginTop:
              18,
          }}
        >
          <Form.Item
            label="Mật khẩu hiện tại"

            name="oldPassword"

            rules={[
              {
                required:
                  true,

                message:
                  "Vui lòng nhập mật khẩu hiện tại.",
              },
            ]}
          >
            <Input.Password
              prefix={
                <LockOutlined />
              }
            />
          </Form.Item>


          <Form.Item
            label="Mật khẩu mới"

            name="newPassword"

            rules={[
              {
                required:
                  true,

                message:
                  "Vui lòng nhập mật khẩu mới.",
              },

              {
                min:
                  6,

                message:
                  "Mật khẩu phải có ít nhất 6 ký tự.",
              },
            ]}
          >
            <Input.Password
              prefix={
                <LockOutlined />
              }
            />
          </Form.Item>


          <Form.Item
            label="Nhập lại mật khẩu mới"

            name="confirmPassword"

            rules={[
              {
                required:
                  true,

                message:
                  "Vui lòng nhập lại mật khẩu.",
              },
            ]}
          >
            <Input.Password
              prefix={
                <LockOutlined />
              }
            />
          </Form.Item>


          <Button
            type="primary"

            htmlType="submit"

            block

            loading={
              loading
            }
          >
            Đổi mật khẩu
          </Button>
        </Form>
      </Modal>


      <Modal
        className="account-form-modal"

        title={
          <div>
            <div
              className="account-modal-title"
            >
              Đặt lại mật khẩu
            </div>

            <div
              className="account-modal-description"
            >
              Tài khoản:{" "}
              <strong>
                {
                  resetPasswordUser
                    ?.username ??
                  ""
                }
              </strong>
            </div>
          </div>
        }

        open={
          resetPasswordUser !==
          null
        }

        onCancel={() =>
          setResetPasswordUser(
            null
          )
        }

        footer={
          null
        }

        destroyOnHidden
      >
        <Form<ResetPasswordForm>
          form={
            resetPasswordForm
          }

          layout="vertical"

          onFinish={
            handleResetPassword
          }

          style={{
            marginTop:
              18,
          }}
        >
          <Form.Item
            label="Mật khẩu mới"

            name="password"

            rules={[
              {
                required:
                  true,

                message:
                  "Vui lòng nhập mật khẩu.",
              },

              {
                min:
                  6,

                message:
                  "Mật khẩu phải có ít nhất 6 ký tự.",
              },
            ]}
          >
            <Input.Password
              prefix={
                <LockOutlined />
              }
            />
          </Form.Item>


          <Form.Item
            label="Nhập lại mật khẩu"

            name="confirmPassword"

            rules={[
              {
                required:
                  true,

                message:
                  "Vui lòng nhập lại mật khẩu.",
              },
            ]}
          >
            <Input.Password
              prefix={
                <LockOutlined />
              }
            />
          </Form.Item>


          <Button
            type="primary"

            htmlType="submit"

            block

            loading={
              loading
            }
          >
            Đặt lại mật khẩu
          </Button>
        </Form>
      </Modal>


      <style>
        {`
          .account-page {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .account-page-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .account-profile-card {
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

          .account-profile-card
          .ant-card-body {
            padding:
              20px;
          }

          .account-profile-main {
            display: flex;
            align-items: center;
            gap: 15px;
          }

          .account-profile-avatar {
            width: 56px;
            height: 56px;

            display: flex;
            align-items: center;
            justify-content: center;

            flex-shrink: 0;

            border-radius:
              16px;

            color:
              #1677ff;

            background:
              linear-gradient(
                135deg,
                #e6f4ff,
                #f0f7ff
              );

            font-size:
              24px;

            box-shadow:
              inset
              0
              0
              0
              1px
              #d6e4ff;
          }

          .account-profile-info {
            flex: 1;
          }

          .account-profile-name {
            color:
              #172033;

            font-size:
              20px;

            font-weight:
              800;
          }

          .account-profile-meta {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;

            margin-top:
              7px;
          }

          .account-role-tag {
            margin: 0;
            border-radius:
              999px;
            font-size:
              11px;
            font-weight:
              700;
          }

          .account-profile-actions {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .account-stat-grid {
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

          .account-stat-card {
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

          .account-stat-card:hover {
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

          .account-stat-card
          .ant-card-body {
            display: flex;
            align-items: center;
            gap: 13px;

            padding:
              16px
              17px;
          }

          .account-stat-icon {
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

          .account-stat-label {
            color:
              #64748b;

            font-size:
              12px;

            font-weight:
              500;
          }

          .account-stat-value {
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

          .account-stat-total {
            border-left:
              4px solid
              #1677ff;
          }

          .account-stat-total
          .account-stat-icon {
            color:
              #1677ff;

            background:
              #e6f4ff;
          }

          .account-stat-active {
            border-left:
              4px solid
              #52c41a;
          }

          .account-stat-active
          .account-stat-icon {
            color:
              #52c41a;

            background:
              #f6ffed;
          }

          .account-stat-admin {
            border-left:
              4px solid
              #722ed1;
          }

          .account-stat-admin
          .account-stat-icon {
            color:
              #722ed1;

            background:
              #f9f0ff;
          }

          .account-stat-locked {
            border-left:
              4px solid
              #ff4d4f;
          }

          .account-stat-locked
          .account-stat-icon {
            color:
              #ff4d4f;

            background:
              #fff1f0;
          }

          .account-table-card {
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

          .account-table-header {
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

          .account-table-card
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

          .account-table-card
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

          .account-table-card
          .ant-table-tbody
          > tr:hover
          > td {
            background:
              #f5f9ff !important;
          }

          .account-row-locked
          > td {
            background:
              #fffafa;
          }

          .account-row-locked
          > td:first-child {
            box-shadow:
              inset
              3px
              0
              0
              #ff7875;
          }

          .account-user-cell {
            display: flex;
            align-items: center;
            gap: 9px;
          }

          .account-avatar {
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

          .account-avatar-admin {
            color:
              #722ed1;

            background:
              #f9f0ff;
          }

          .account-status-tag {
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

          .account-table-card
          .ant-pagination {
            padding:
              0
              16px
              12px;
          }

          .account-form-modal
          .ant-modal-content {
            border-radius:
              16px;

            overflow:
              hidden;
          }

          .account-modal-title {
            color:
              #172033;

            font-size:
              19px;

            font-weight:
              800;
          }

          .account-modal-description {
            margin-top:
              3px;

            color:
              #64748b;

            font-size:
              12px;

            font-weight:
              400;
          }

          @media
          (
            max-width:
              1000px
          ) {
            .account-stat-grid {
              grid-template-columns:
                repeat(
                  2,
                  minmax(
                    160px,
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
            .account-profile-main,
            .account-table-header {
              align-items:
                flex-start;

              flex-direction:
                column;
            }

            .account-profile-actions {
              width:
                100%;

              flex-wrap:
                wrap;
            }

            .account-stat-grid {
              grid-template-columns:
                1fr;
            }
          }
        `}
      </style>
    </div>
  );
}