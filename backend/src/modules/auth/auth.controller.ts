import type {
  Request,
  Response,
} from "express";

import {
  loginUser,
} from "./auth.service.js";

import type {
  AuthRequest,
} from "./auth.middleware.js";


// ======================================================
// COOKIE CONFIG
// ======================================================

function getCookieOptions() {
  const isProduction =
    process.env.NODE_ENV ===
    "production";


  return {
    httpOnly:
      true,

    secure:
      isProduction,

    sameSite:
      (
        isProduction
          ? "none"
          : "lax"
      ) as
        | "none"
        | "lax",

    maxAge:
      8 *
      60 *
      60 *
      1000,

    path:
      "/",
  };
}


// ======================================================
// LOGIN
// ======================================================

export async function login(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const username =
      String(
        req.body?.username ??
        ""
      ).trim();


    const password =
      String(
        req.body?.password ??
        ""
      );


    if (
      !username ||
      !password
    ) {
      res
        .status(
          400
        )
        .json({
          success:
            false,

          message:
            "Vui lòng nhập tài khoản và mật khẩu.",
        });

      return;
    }


    const result =
      await loginUser(
        username,
        password
      );


    if (
      !result
    ) {
      res
        .status(
          401
        )
        .json({
          success:
            false,

          message:
            "Sai tài khoản hoặc mật khẩu.",
        });

      return;
    }


    res.cookie(
      "medguard_token",
      result.token,
      getCookieOptions()
    );


    res.json({
      success:
        true,

      message:
        "Đăng nhập thành công.",

      user:
        result.user,
    });

  } catch (
    error
  ) {
    console.error(
      "Login error:",
      error
    );


    res
      .status(
        500
      )
      .json({
        success:
          false,

        message:
          error instanceof Error
            ? error.message
            : "Đăng nhập thất bại.",
      });
  }
}


// ======================================================
// ME
// ======================================================

export async function me(
  req: AuthRequest,
  res: Response
): Promise<void> {
  res.json({
    success:
      true,

    user: {
      id:
        req.user?.id,

      username:
        req.user?.username,

      role:
        req.user?.role,
    },
  });
}


// ======================================================
// LOGOUT
// ======================================================

export async function logout(
  _req: Request,
  res: Response
): Promise<void> {
  const cookieOptions =
    getCookieOptions();


  res.clearCookie(
    "medguard_token",
    {
      httpOnly:
        cookieOptions.httpOnly,

      secure:
        cookieOptions.secure,

      sameSite:
        cookieOptions.sameSite,

      path:
        cookieOptions.path,
    }
  );


  res.json({
    success:
      true,

    message:
      "Đã đăng xuất.",
  });
}