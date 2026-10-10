import axios from "axios";

import {
  notifyUnauthorized,
} from "../auth/AuthContext";




const ENV_API_URL =
  String(
    import.meta.env
      .VITE_API_URL ??
      ""
  ).trim();


export const API_BASE_URL =
  (
    ENV_API_URL ||
    "http://localhost:3000/api"
  ).replace(
    /\/+$/,
    ""
  );


// ======================================================
// HELPERS
// ======================================================

function buildApiUrl(
  input:
    string
) {
  const value =
    String(
      input ??
      ""
    ).trim();


  if (
    value.startsWith(
      "http://"
    ) ||
    value.startsWith(
      "https://"
    )
  ) {
    return value;
  }


  const path =
    value.startsWith(
      "/"
    )
      ? value
      : `/${value}`;


  return `${API_BASE_URL}${path}`;
}


function isLoginUrl(
  url:
    unknown
) {
  return String(
    url ??
    ""
  ).includes(
    "/auth/login"
  );
}


// ======================================================
// AXIOS CLIENT
// ======================================================
//
// Dùng cho:
// - XML Import
// - API GET / POST / PUT / DELETE
// - upload FormData
//
// Cookie medguard_token được gửi tự động.
//
// ======================================================

const apiClient =
  axios.create({
    baseURL:
      API_BASE_URL,

    withCredentials:
      true,

    headers: {
      Accept:
        "application/json",
    },
  });


// ======================================================
// AXIOS RESPONSE INTERCEPTOR
// ======================================================
//
// Backend trả 401:
//
// JWT hết hạn
// USER bị khóa
// USER bị xóa
// JWT không hợp lệ
//
//        ↓
//
// notifyUnauthorized()
//
//        ↓
//
// AuthContext user = null
//
//        ↓
//
// ProtectedRoute → /login
//
// Login sai mật khẩu KHÔNG được xem là hết phiên.
//
// ======================================================

apiClient.interceptors.response.use(
  (
    response
  ) => {
    return response;
  },

  (
    error
  ) => {
    const status =
      error?.response
        ?.status;


    const requestUrl =
      String(
        error?.config
          ?.url ??
        ""
      );


    if (
      status ===
        401 &&
      !isLoginUrl(
        requestUrl
      )
    ) {
      notifyUnauthorized();
    }


    return Promise.reject(
      error
    );
  }
);




export async function apiFetch(
  input:
    string,

  init:
    RequestInit =
    {}
) {
  const url =
    buildApiUrl(
      input
    );


  const response =
    await fetch(
      url,
      {
        ...init,

        credentials:
          "include",

        headers: {
          Accept:
            "application/json",

          ...init.headers,
        },
      }
    );


  if (
    response.status ===
      401 &&
    !isLoginUrl(
      url
    )
  ) {
    notifyUnauthorized();
  }


  return response;
}


// ======================================================
// EXPORT
// ======================================================

export default apiClient;