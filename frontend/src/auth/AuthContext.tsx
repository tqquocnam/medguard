import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  useApolloClient,
} from "@apollo/client/react";


// ======================================================
// CONFIG
// ======================================================

const API =
  "http://localhost:3000/api";


export const AUTH_UNAUTHORIZED_EVENT =
  "medguard:unauthorized";


// ======================================================
// THÔNG BÁO PHIÊN KHÔNG HỢP LỆ
// ======================================================
//
// apiClient / apiFetch / GraphQL có thể gọi:
//
// notifyUnauthorized();
//
// AuthProvider sẽ:
// - user = null
// - xóa Apollo cache
// - ProtectedRoute đưa về /login
//
// ======================================================

export function notifyUnauthorized() {

  window.dispatchEvent(
    new Event(
      AUTH_UNAUTHORIZED_EVENT
    )
  );
}


// ======================================================
// TYPES
// ======================================================

export interface AuthUser {

  id: string;

  username: string;

  role: string;
}


interface AuthContextValue {

  user:
    AuthUser |
    null;

  loading:
    boolean;


  login: (
    username: string,
    password: string
  ) => Promise<void>;


  logout:
    () => Promise<void>;


  refreshUser:
    () => Promise<void>;


  clearSession:
    () => void;
}


// ======================================================
// CONTEXT
// ======================================================

const AuthContext =
  createContext<
    AuthContextValue |
    undefined
  >(
    undefined
  );


// ======================================================
// PROVIDER
// ======================================================

export function AuthProvider({
  children,
}: {
  children:
    ReactNode;
}) {

  // ====================================================
  // APOLLO
  // ====================================================

  const apolloClient =
    useApolloClient();


  // ====================================================
  // USER
  // ====================================================

  const [
    user,
    setUser,
  ] =
    useState<
      AuthUser |
      null
    >(
      null
    );


  // ====================================================
  // LOADING
  // ====================================================

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  // ====================================================
  // CLEAR SESSION
  // ====================================================
  //
  // Dùng khi:
  // - JWT hết hạn
  // - tài khoản bị khóa
  // - tài khoản bị xóa
  // - logout
  //
  // ====================================================

  const clearSession =
    useCallback(
      () => {

        // Xóa user trước để ProtectedRoute
        // chuyển về /login ngay.

        setUser(
          null
        );


        // Xóa dữ liệu GraphQL của tài khoản cũ.
        //
        // Dùng clearStore thay vì resetStore
        // để KHÔNG refetch các query cũ.

        void apolloClient
          .clearStore()
          .catch(
            (
              error
            ) => {

              console.error(
                "Apollo clearStore error:",
                error
              );
            }
          );

      },
      [
        apolloClient,
      ]
    );


  // ====================================================
  // GET CURRENT USER
  // ====================================================

  const refreshUser =
    useCallback(
      async () => {

        try {

          const response =
            await fetch(
              `${API}/auth/me`,
              {
                method:
                  "GET",

                credentials:
                  "include",
              }
            );


          // ============================================
          // CHƯA LOGIN / JWT HẾT / USER BỊ KHÓA
          // ============================================

          if (
            response.status ===
            401
          ) {

            setUser(
              null
            );

            return;
          }


          // ============================================
          // API ERROR
          // ============================================

          if (
            !response.ok
          ) {

            setUser(
              null
            );

            return;
          }


          // ============================================
          // JSON
          // ============================================

          const json =
            await response.json();


          // ============================================
          // SUCCESS
          // ============================================

          if (
            json.success &&
            json.user
          ) {

            setUser(
              json.user
            );

          } else {

            setUser(
              null
            );
          }

        } catch (
          error
        ) {

          console.error(
            "Auth me error:",
            error
          );


          setUser(
            null
          );
        }
      },
      []
    );


  // ====================================================
  // INITIAL SESSION
  // ====================================================

  useEffect(
    () => {

      let mounted =
        true;


      async function load() {

        setLoading(
          true
        );


        await refreshUser();


        if (
          mounted
        ) {

          setLoading(
            false
          );
        }
      }


      void load();


      return () => {

        mounted =
          false;
      };

    },
    [
      refreshUser,
    ]
  );


  // ====================================================
  // LẮNG NGHE HTTP 401
  // ====================================================
  //
  // apiClient / apiFetch / GraphQL
  //
  //        ↓
  //
  // HTTP 401
  //
  //        ↓
  //
  // notifyUnauthorized()
  //
  //        ↓
  //
  // clearSession()
  //
  //        ↓
  //
  // user = null
  // Apollo cache bị xóa
  //
  // ====================================================

  useEffect(
    () => {

      const handleUnauthorized =
        () => {

          console.warn(
            "MedGuard session invalidated."
          );


          clearSession();
        };


      window.addEventListener(
        AUTH_UNAUTHORIZED_EVENT,
        handleUnauthorized
      );


      return () => {

        window.removeEventListener(
          AUTH_UNAUTHORIZED_EVENT,
          handleUnauthorized
        );
      };

    },
    [
      clearSession,
    ]
  );


  // ====================================================
  // LOGIN
  // ====================================================

  const login =
    useCallback(
      async (
        username: string,
        password: string
      ) => {

        const response =
          await fetch(
            `${API}/auth/login`,
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
                  username,
                  password,
                }),
            }
          );


        let json:
          any = null;


        try {

          json =
            await response.json();

        } catch {

          // Backend trả dữ liệu không phải JSON.
        }


        // ==============================================
        // LOGIN FAIL
        // ==============================================

        if (
          !response.ok ||
          !json?.success
        ) {

          throw new Error(
            json?.message ||
            "Đăng nhập thất bại."
          );
        }


        // ==============================================
        // BACKEND KHÔNG TRẢ USER
        // ==============================================

        if (
          !json.user
        ) {

          throw new Error(
            "Backend không trả về thông tin tài khoản."
          );
        }


        // ==============================================
        // XÓA CACHE CỦA TÀI KHOẢN TRƯỚC
        // ==============================================

        try {

          await apolloClient
            .clearStore();

        } catch (
          error
        ) {

          console.error(
            "Apollo clearStore after login error:",
            error
          );
        }


        // ==============================================
        // SET USER MỚI
        // ==============================================

        setUser(
          json.user
        );
      },
      [
        apolloClient,
      ]
    );


  // ====================================================
  // LOGOUT
  // ====================================================

  const logout =
    useCallback(
      async () => {

        try {

          await fetch(
            `${API}/auth/logout`,
            {
              method:
                "POST",

              credentials:
                "include",
            }
          );

        } catch (
          error
        ) {

          console.error(
            "Logout error:",
            error
          );

        } finally {

          // ============================================
          // DÙ BACKEND LOGOUT CÓ LỖI
          // FRONTEND VẪN PHẢI THOÁT PHIÊN
          // ============================================

          setUser(
            null
          );


          // ============================================
          // XÓA APOLLO CACHE
          // ============================================

          try {

            await apolloClient
              .clearStore();

          } catch (
            error
          ) {

            console.error(
              "Apollo clearStore logout error:",
              error
            );
          }
        }
      },
      [
        apolloClient,
      ]
    );


  // ====================================================
  // PROVIDER
  // ====================================================

  return (

    <AuthContext.Provider
      value={{
        user,

        loading,

        login,

        logout,

        refreshUser,

        clearSession,
      }}
    >

      {children}

    </AuthContext.Provider>
  );
}


// ======================================================
// HOOK
// ======================================================

export function useAuth() {

  const context =
    useContext(
      AuthContext
    );


  if (!context) {

    throw new Error(
      "useAuth phải được sử dụng bên trong AuthProvider."
    );
  }


  return context;
}