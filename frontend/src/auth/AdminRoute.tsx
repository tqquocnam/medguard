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


export default function AdminRoute() {

  const {
    user,
    loading,
  } =
    useAuth();


  if (loading) {

    return (
      <div
        style={{
          minHeight:
            "100vh",

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "center",
        }}
      >
        <Spin
          size="large"
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


  if (
    user.role !==
    "ADMIN"
  ) {

    return (
      <Navigate
        to="/"
        replace
      />
    );
  }


  return (
    <Outlet />
  );
}