import type { NextFunction, Request, Response } from "express";

import jwt from "jsonwebtoken";

import { db } from "../../config/database.js";

import { AUTH_COOKIE_NAME, getAuthCookieOptions } from "./auth.cookies.js";

import type { AuthUser } from "./auth.service.js";

export type { AuthUser } from "./auth.service.js";

export interface AuthRequest extends Request {
  user?: AuthUser;
}

function rejectSession(res: Response, status: number, message: string): void {
  res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions());

  res.status(status).json({
    success: false,
    message,
  });
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token || typeof token !== "string") {
    res.status(401).json({
      success: false,
      message: "Bạn chưa đăng nhập.",
    });

    return;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({
      success: false,
      message: "Hệ thống đăng nhập chưa được cấu hình đúng.",
    });

    return;
  }

  let userId: string;

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    });

    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.sub)
    ) {
      rejectSession(res, 401, "Phiên đăng nhập không hợp lệ.");

      return;
    }

    userId = decoded.sub;
  } catch (error) {
    rejectSession(
      res,
      401,
      error instanceof jwt.TokenExpiredError
        ? "Phiên đăng nhập đã hết hạn."
        : "Phiên đăng nhập không hợp lệ.",
    );

    return;
  }

  try {
    const result = await db.query(
      `
      SELECT
        u.id,
        u.username,
        u.full_name,
        u.role,
        u.active,
        u.branch_id,
        b.name AS branch_name,
        b.active AS branch_active
      FROM auth.users u
      LEFT JOIN auth.branches b
        ON b.id = u.branch_id
      WHERE u.id = $1
      LIMIT 1
      `,
      [userId],
    );

    const account = result.rows[0];

    if (!account || account.active !== true) {
      rejectSession(res, 401, "Tài khoản không tồn tại hoặc đã bị khóa.");

      return;
    }

    if (!account.branch_id) {
      rejectSession(res, 403, "Tài khoản chưa được gán chi nhánh.");

      return;
    }

    if (account.branch_active !== true) {
      rejectSession(res, 403, "Chi nhánh không tồn tại hoặc đã ngừng hoạt động.");

      return;
    }

    // Chi nhánh lấy từ database theo tài khoản.
    // Không lấy từ body, query, header hoặc nội dung JWT.
    req.user = {
      id: String(account.id),
      username: account.username,
      fullName: account.full_name ?? null,
      role: account.role,
      branchId: account.branch_id,
      branchName: account.branch_name,
    };
  } catch (error) {
    console.error("Auth database error:", error);

    res.status(500).json({
      success: false,
      message: "Không thể xác thực tài khoản.",
    });

    return;
  }

  next();
}
