import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useApolloClient } from "@apollo/client/react";

const ENV_API_URL = String(import.meta.env.VITE_API_URL ?? "").trim();

const API = (ENV_API_URL || "http://localhost:3000/api").replace(/\/+$/, "");

export const AUTH_UNAUTHORIZED_EVENT = "medguard:unauthorized";

export function notifyUnauthorized(): void {
  window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
}

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  fullName?: string | null;
  branchId: string;
  branchName?: string | null;
}

interface AuthResponse {
  success?: boolean;
  message?: string;
  user?: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const apolloClient = useApolloClient();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clearCache = useCallback(async (): Promise<void> => {
    try {
      await apolloClient.clearStore();
    } catch (error) {
      console.error("Không thể xóa bộ nhớ đệm Apollo:", error);
    }
  }, [apolloClient]);

  const clearSession = useCallback((): void => {
    setUser(null);
    void clearCache();
  }, [clearCache]);

  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${API}/auth/me`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        clearSession();
        return;
      }

      const json = (await response.json()) as AuthResponse;

      if (json.success === true && json.user) {
        setUser(json.user);
        return;
      }

      clearSession();
    } catch (error) {
      console.error("Không thể kiểm tra phiên đăng nhập:", error);
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    let mounted = true;

    async function loadSession(): Promise<void> {
      try {
        await refreshUser();
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      mounted = false;
    };
  }, [refreshUser]);

  useEffect(() => {
    const handleUnauthorized = (): void => {
      clearSession();
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);

    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    };
  }, [clearSession]);

  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      let json: AuthResponse;

      try {
        json = (await response.json()) as AuthResponse;
      } catch {
        throw new Error("Backend trả dữ liệu không hợp lệ.");
      }

      if (!response.ok || json?.success !== true) {
        throw new Error(json?.message || "Đăng nhập thất bại.");
      }

      if (!json.user) {
        throw new Error("Backend không trả về thông tin tài khoản.");
      }

      setUser(null);
      await clearCache();
      setUser(json.user);
    },
    [clearCache],
  );

  const logout = useCallback(async (): Promise<void> => {
    const response = await fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok && response.status !== 401) {
      throw new Error("Không thể đăng xuất. Vui lòng thử lại.");
    }

    setUser(null);
    await clearCache();
  }, [clearCache]);

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

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth phải được sử dụng bên trong AuthProvider.");
  }

  return context;
}
