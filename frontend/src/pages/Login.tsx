import {
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";

import {
  Button,
  Form,
  Input,
  Typography,
  message,
} from "antd";

import {
  useState,
} from "react";

import {
  Navigate,
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../auth/AuthContext";


interface LoginForm {
  username: string;
  password: string;
}


export default function Login() {
  const navigate =
    useNavigate();


  const {
    user,
    login,
  } =
    useAuth();


  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );


  if (
    user
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }


  async function handleSubmit(
    values:
      LoginForm
  ) {
    try {
      setLoading(
        true
      );


      await login(
        values.username,
        values.password
      );


      message.success(
        "Đăng nhập thành công"
      );


      navigate(
        "/",
        {
          replace:
            true,
        }
      );

    } catch (
      error
    ) {
      message.error(
        error instanceof Error
          ? error.message
          : "Đăng nhập thất bại."
      );

    } finally {
      setLoading(
        false
      );
    }
  }


  return (
    <>
      <div
        className="medguard-login-page"
      >
        <div
          className="medguard-login-decoration medguard-login-decoration-1"
        />

        <div
          className="medguard-login-decoration medguard-login-decoration-2"
        />


        <div
          className="medguard-login-card"
        >
          <div
            className="medguard-login-brand"
          >
            <div
              className="medguard-login-logo"
            >
              <SafetyCertificateOutlined />
            </div>


            <Typography.Title
              level={2}

              className="medguard-login-title"
            >
              MedGuard
            </Typography.Title>


            <Typography.Text
              className="medguard-login-subtitle"
            >
              Hệ thống kiểm tra hồ sơ BHYT
            </Typography.Text>
          </div>


          <div
            className="medguard-login-heading"
          >
            <Typography.Title
              level={4}

              style={{
                margin:
                  0,

                color:
                  "#172033",

                fontWeight:
                  800,
              }}
            >
              Đăng nhập hệ thống
            </Typography.Title>


            <Typography.Text
              type="secondary"

              style={{
                display:
                  "block",

                marginTop:
                  4,

                fontSize:
                  13,
              }}
            >
              Vui lòng nhập tài khoản để tiếp tục
            </Typography.Text>
          </div>


          <Form<LoginForm>
            layout="vertical"

            onFinish={
              handleSubmit
            }

            autoComplete="off"

            requiredMark={
              false
            }

            className="medguard-login-form"
          >
            <Form.Item
              label="Tài khoản"

              name="username"

              rules={[
                {
                  required:
                    true,

                  message:
                    "Vui lòng nhập tài khoản",
                },
              ]}
            >
              <Input
                size="large"

                prefix={
                  <UserOutlined
                    className="medguard-input-icon"
                  />
                }

                placeholder="Nhập tài khoản"

                autoComplete="username"
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
                    "Vui lòng nhập mật khẩu",
                },
              ]}
            >
              <Input.Password
                size="large"

                prefix={
                  <LockOutlined
                    className="medguard-input-icon"
                  />
                }

                placeholder="Nhập mật khẩu"

                autoComplete="current-password"
              />
            </Form.Item>


            <Button
              type="primary"

              htmlType="submit"

              size="large"

              block

              loading={
                loading
              }

              className="medguard-login-button"
            >
              Đăng nhập
            </Button>
          </Form>


          <div
            className="medguard-login-security"
          >
            <SafetyCertificateOutlined />

            <span>
              Kết nối bảo mật · Dữ liệu được bảo vệ
            </span>
          </div>


          <div
            className="medguard-login-footer"
          >
            MedGuard © 2026
          </div>
        </div>
      </div>


      <style>
        {`
          .medguard-login-page {
            min-height: 100vh;

            display: flex;

            align-items: center;

            justify-content: center;

            position: relative;

            overflow: hidden;

            padding: 24px;

            background:
              linear-gradient(
                135deg,
                #f7faff 0%,
                #edf4ff 45%,
                #f8fbff 100%
              );
          }


          .medguard-login-decoration {
            position: absolute;

            border-radius: 999px;

            pointer-events: none;

            filter: blur(1px);
          }


          .medguard-login-decoration-1 {
            width: 430px;

            height: 430px;

            top: -180px;

            right: -120px;

            background:
              rgba(
                22,
                119,
                255,
                0.07
              );
          }


          .medguard-login-decoration-2 {
            width: 360px;

            height: 360px;

            bottom: -170px;

            left: -100px;

            background:
              rgba(
                24,
                144,
                255,
                0.06
              );
          }


          .medguard-login-card {
            width: 100%;

            max-width: 430px;

            position: relative;

            z-index: 2;

            padding:
              34px
              34px
              24px;

            border:
              1px solid
              rgba(
                226,
                232,
                240,
                0.9
              );

            border-radius: 20px;

            background:
              rgba(
                255,
                255,
                255,
                0.96
              );

            box-shadow:
              0
              24px
              65px
              rgba(
                15,
                23,
                42,
                0.10
              );

            backdrop-filter:
              blur(
                12px
              );
          }


          .medguard-login-brand {
            display: flex;

            flex-direction: column;

            align-items: center;

            text-align: center;
          }


          .medguard-login-logo {
            width: 66px;

            height: 66px;

            display: flex;

            align-items: center;

            justify-content: center;

            margin-bottom: 14px;

            border-radius: 20px;

            color: #1677ff;

            background:
              linear-gradient(
                145deg,
                #e6f4ff,
                #f4f9ff
              );

            border:
              1px solid
              #d6e8ff;

            font-size: 34px;

            box-shadow:
              0
              8px
              22px
              rgba(
                22,
                119,
                255,
                0.12
              );
          }


          .medguard-login-title {
            margin:
              0 !important;

            color:
              #1677ff !important;

            font-size:
              30px !important;

            font-weight:
              800 !important;

            letter-spacing:
              -0.5px;
          }


          .medguard-login-subtitle {
            display: block;

            margin-top: 3px;

            color:
              #8a94a6 !important;

            font-size: 12px;

            letter-spacing:
              0.2px;
          }


          .medguard-login-heading {
            margin:
              28px
              0
              20px;
          }


          .medguard-login-form
          .ant-form-item {
            margin-bottom: 17px;
          }


          .medguard-login-form
          .ant-form-item-label {
            padding-bottom: 7px;
          }


          .medguard-login-form
          .ant-form-item-label
          > label {
            color:
              #334155;

            font-size:
              13px;

            font-weight:
              700;
          }


          .medguard-login-form
          .ant-input-affix-wrapper {
            height: 46px;

            padding:
              0
              13px;

            border:
              1px solid
              #dce3ec;

            border-radius: 10px;

            background:
              #ffffff;

            transition:
              all
              0.2s
              ease;
          }


          .medguard-login-form
          .ant-input-affix-wrapper:hover {
            border-color:
              #69b1ff;
          }


          .medguard-login-form
          .ant-input-affix-wrapper-focused {
            border-color:
              #1677ff;

            box-shadow:
              0
              0
              0
              3px
              rgba(
                22,
                119,
                255,
                0.08
              );
          }


          .medguard-login-form
          .ant-input {
            font-size:
              13px;
          }


          .medguard-input-icon {
            margin-right: 4px;

            color:
              #94a3b8;
          }


          .medguard-login-button {
            height: 47px;

            margin-top: 4px;

            border-radius: 10px;

            font-size: 14px;

            font-weight: 700;

            box-shadow:
              0
              8px
              18px
              rgba(
                22,
                119,
                255,
                0.22
              );

            transition:
              all
              0.2s
              ease;
          }


          .medguard-login-button:hover {
            transform:
              translateY(
                -1px
              );

            box-shadow:
              0
              10px
              24px
              rgba(
                22,
                119,
                255,
                0.26
              );
          }


          .medguard-login-security {
            margin-top: 22px;

            padding:
              10px
              12px;

            display: flex;

            align-items: center;

            justify-content: center;

            gap: 7px;

            border-radius: 9px;

            color:
              #64748b;

            background:
              #f8fafc;

            font-size:
              11px;
          }


          .medguard-login-security
          .anticon {
            color:
              #52c41a;

            font-size:
              13px;
          }


          .medguard-login-footer {
            margin-top: 17px;

            text-align: center;

            color:
              #a0a8b5;

            font-size:
              11px;
          }


          @media
          (
            max-width: 520px
          ) {
            .medguard-login-page {
              padding: 16px;
            }


            .medguard-login-card {
              padding:
                28px
                22px
                22px;

              border-radius:
                16px;
            }


            .medguard-login-logo {
              width: 58px;

              height: 58px;

              font-size: 30px;
            }


            .medguard-login-title {
              font-size:
                27px !important;
            }
          }
        `}
      </style>
    </>
  );
}