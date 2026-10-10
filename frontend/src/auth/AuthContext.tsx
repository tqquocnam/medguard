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



const ENV_API_URL =
  String(
    import.meta.env
      .VITE_API_URL ??
      ""
  ).trim();


const API =
  (
    ENV_API_URL ||
    "http://localhost:3000/api"
  ).replace(
    /\/+$/,
    ""
  );


// ======================================================
// UNAUTHORIZED EVENT
// ======================================================

export const AUTH_UNAUTHORIZED_EVENT =
  "medguard:unauthorized";


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
  id:
    string;

  username:
    string;

  role:
    string;

  fullName?:
    string;
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
  const apolloClient =
    useApolloClient();


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

  const clearSession =
    useCallback(
      () => {
        setUser(
          null
        );


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

                headers: {
                  Accept:
                    "application/json",
                },
              }
            );


          if (
            response.status ===
            401
          ) {
            setUser(
              null
            );

            return;
          }


          if (
            !response.ok
          ) {
            console.error(
              "Auth me HTTP error:",
              response.status
            );

            setUser(
              null
            );

            return;
          }


          const json =
            await response.json();


          if (
            json.success &&
            json.user
          ) {
            setUser(
              json.user
            );

            return;
          }


          setUser(
            null
          );

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
  // HANDLE GLOBAL 401
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
        username:
          string,

        password:
          string
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
                Accept:
                  "application/json",

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
          any =
          null;


        try {
          json =
            await response.json();
        } catch {
          throw new Error(
            "Backend trả dữ liệu không hợp lệ."
          );
        }


        if (
          !response.ok ||
          !json?.success
        ) {
          throw new Error(
            json?.message ||
            "Đăng nhập thất bại."
          );
        }


        if (
          !json.user
        ) {
          throw new Error(
            "Backend không trả về thông tin tài khoản."
          );
        }


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

              headers: {
                Accept:
                  "application/json",
              },
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
          setUser(
            null
          );


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


  if (
    !context
  ) {
    throw new Error(
      "useAuth phải được sử dụng bên trong AuthProvider."
    );
  }


  return context;
}