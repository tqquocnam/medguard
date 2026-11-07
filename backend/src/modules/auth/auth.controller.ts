import type { Request, Response } from "express";

import { AuthError, loginUser } from "./auth.service.js";

import type { AuthRequest } from "./auth.middleware.js";

import { AUTH_COOKIE_NAME, getAuthCookieOptions } from "./auth.cookies.js";

export async function login(req: Request, res: Response): Promise<void> {
  const username = String(req.body?.username ?? "").trim();

  const password = String(req.body?.password ?? "");

  if (!username || !password) {
    res.status(400).json({
      success: false,
      message: "Vui lòng nhập tài khoản và mật khẩu.",
    });

    return;
  }

  try {
    const result = await loginUser(username, password);

    if (!result) {
      res.status(401).json({
        success: false,
        message: "Sai tài khoản hoặc mật khẩu.",
      });

      return;
    }

    res.cookie(AUTH_COOKIE_NAME, result.token, {
      ...getAuthCookieOptions(),
      maxAge: 8 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: "Đăng nhập thành công.",
      user: result.user,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.status).json({
        success: false,
        message: error.message,
      });

      return;
    }

    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Không thể đăng nhập. Vui lòng thử lại.",
    });
  }
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Bạn chưa đăng nhập.",
    });

    return;
  }

  res.setHeader("Cache-Control", "no-store");

  res.json({
    success: true,
    user: req.user,
  });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());

  res.json({
    success: true,
    message: "Đã đăng xuất.",
  });
}
