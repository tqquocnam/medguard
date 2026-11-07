import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { db } from "../../config/database.js";

export interface AuthUser {
  id: string;
  username: string;
  fullName: string | null;
  role: string;
  branchId: string;
  branchName: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: number = 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function loginUser(
  username: string,
  password: string,
): Promise<{
  user: AuthUser;
  token: string;
} | null> {
  const result = await db.query(
    `
    SELECT
      u.id,
      u.username,
      u.password_hash,
      u.full_name,
      u.role,
      u.active,
      u.branch_id,
      b.name AS branch_name,
      b.active AS branch_active
    FROM auth.users u
    LEFT JOIN auth.branches b
      ON b.id = u.branch_id
    WHERE LOWER(u.username) = LOWER($1)
    LIMIT 1
    `,
    [username.trim()],
  );

  const account = result.rows[0];

  if (!account) {
    return null;
  }

  const passwordOk = await bcrypt.compare(password, account.password_hash);

  if (!passwordOk) {
    return null;
  }

  if (account.active !== true) {
    throw new AuthError("Tài khoản đã bị khóa.");
  }

  if (!account.branch_id) {
    throw new AuthError("Tài khoản chưa được gán chi nhánh. Vui lòng liên hệ quản trị.");
  }

  if (account.branch_active !== true) {
    throw new AuthError("Chi nhánh không tồn tại hoặc đã ngừng hoạt động.");
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET chưa được cấu hình.");
  }

  const user: AuthUser = {
    id: String(account.id),
    username: account.username,
    fullName: account.full_name ?? null,
    role: account.role,
    branchId: account.branch_id,
    branchName: account.branch_name,
  };

  // JWT xác định tài khoản.
  // Quyền và chi nhánh luôn được đọc lại từ database.
  const token = jwt.sign(
    {
      sub: user.id,
    },
    secret,
    {
      algorithm: "HS256",
      expiresIn: "8h",
    },
  );

  await db.query(
    `
    UPDATE auth.users
    SET
      last_login_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    `,
    [user.id],
  );

  return {
    user,
    token,
  };
}
