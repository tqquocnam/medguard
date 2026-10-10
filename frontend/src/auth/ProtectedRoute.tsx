import {
  Navigate,
  Outlet,
} from "react-router-dom";

import {
  Spin,
} from "antd";

import {
  useAuth,
} from "./AuthContext";


export default function ProtectedRoute() {

  const {
    user,
    loading,
  } =
    useAuth();


  if (loading) {

    return (
      <div
        style={{
          width:
            "100vw",

          height:
            "100vh",

          display:
            "flex",

          justifyContent:
            "center",

          alignItems:
            "center",
        }}
      >
        <Spin
          size="large"
          tip="Đang kiểm tra đăng nhập..."
        />
      </div>
    );
  }


  if (!user) {

    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }


  return (
    <Outlet />
  );
}