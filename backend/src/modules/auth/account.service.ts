import bcrypt from "bcryptjs";

import { db } from "../../config/database.js";

export class AccountError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AccountError";
  }
}

const USER_COLUMNS = `
  id,
  username,
  full_name,
  role,
  active,
  branch_id,
  last_login_at,
  created_at,
  updated_at
`;

function checkBranch(branchId: string): void {
  if (!branchId?.trim()) {
    throw new AccountError("Chưa xác định chi nhánh.", 403);
  }
}

function checkUserId(userId: string): void {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(userId)) {
    throw new AccountError("ID tài khoản không hợp lệ.");
  }
}

function checkPassword(password: string): void {
  if (password.length < 6) {
    throw new AccountError("Mật khẩu phải có ít nhất 6 ký tự.");
  }
}

function requireRow(rows: any[]) {
  if (!rows[0]) {
    throw new AccountError("Không tìm thấy tài khoản trong chi nhánh.", 404);
  }

  return rows[0];
}

export async function getUsers(branchId: string) {
  checkBranch(branchId);

  const result = await db.query(
    `
    SELECT ${USER_COLUMNS}
    FROM auth.users
    WHERE branch_id = $1
    ORDER BY created_at DESC
    `,
    [branchId],
  );

  return result.rows;
}

export async function createUser(
  branchId: string,
  data: {
    username: string;
    password: string;
    fullName?: string;
  },
) {
  checkBranch(branchId);

  const username = data.username.trim();
  const fullName = String(data.fullName ?? "").trim();

  if (username.length < 3 || username.length > 100) {
    throw new AccountError("Tài khoản phải có từ 3 đến 100 ký tự.");
  }

  if (fullName.length > 255) {
    throw new AccountError("Họ tên tối đa 255 ký tự.");
  }

  checkPassword(data.password);

  const passwordHash = await bcrypt.hash(data.password, 12);

  try {
    const result = await db.query(
      `
      INSERT INTO auth.users (
        username,
        password_hash,
        full_name,
        role,
        active,
        branch_id
      )
      SELECT
        $1,
        $2,
        $3,
        'ADMIN',
        TRUE,
        b.id
      FROM auth.branches b
      WHERE
        b.id = $4
        AND b.active = TRUE
      RETURNING ${USER_COLUMNS}
      `,
      [username, passwordHash, fullName || null, branchId],
    );

    if (!result.rows[0]) {
      throw new AccountError("Chi nhánh không tồn tại hoặc đã ngừng hoạt động.");
    }

    return result.rows[0];
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      throw new AccountError("Tên tài khoản đã tồn tại.", 409);
    }

    throw error;
  }
}

export async function setUserActive(branchId: string, userId: string, active: boolean) {
  checkBranch(branchId);
  checkUserId(userId);

  const result = await db.query(
    `
    UPDATE auth.users
    SET
      active = $3,
      updated_at = NOW()
    WHERE
      id = $1
      AND branch_id = $2
    RETURNING ${USER_COLUMNS}
    `,
    [userId, branchId, active],
  );

  return requireRow(result.rows);
}

export async function setUserRole(branchId: string, userId: string, role: string) {
  checkBranch(branchId);
  checkUserId(userId);

  if (role !== "ADMIN") {
    throw new AccountError("Tất cả tài khoản đều sử dụng quyền ADMIN.");
  }

  const result = await db.query(
    `
    UPDATE auth.users
    SET
      role = 'ADMIN',
      updated_at = NOW()
    WHERE
      id = $1
      AND branch_id = $2
    RETURNING ${USER_COLUMNS}
    `,
    [userId, branchId],
  );

  return requireRow(result.rows);
}

export async function resetUserPassword(branchId: string, userId: string, password: string) {
  checkBranch(branchId);
  checkUserId(userId);
  checkPassword(password);

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await db.query(
    `
    UPDATE auth.users
    SET
      password_hash = $3,
      updated_at = NOW()
    WHERE
      id = $1
      AND branch_id = $2
    RETURNING
      id,
      username,
      branch_id
    `,
    [userId, branchId, passwordHash],
  );

  return requireRow(result.rows);
}

export async function changeOwnPassword(
  branchId: string,
  userId: string,
  oldPassword: string,
  newPassword: string,
) {
  checkBranch(branchId);
  checkUserId(userId);
  checkPassword(newPassword);

  const result = await db.query(
    `
    SELECT password_hash
    FROM auth.users
    WHERE
      id = $1
      AND branch_id = $2
      AND active = TRUE
    `,
    [userId, branchId],
  );

  const account = requireRow(result.rows);

  const passwordOk = await bcrypt.compare(oldPassword, account.password_hash);

  if (!passwordOk) {
    throw new AccountError("Mật khẩu hiện tại không đúng.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const updated = await db.query(
    `
    UPDATE auth.users
    SET
      password_hash = $3,
      updated_at = NOW()
    WHERE
      id = $1
      AND branch_id = $2
      AND active = TRUE
      AND password_hash = $4
    RETURNING id
    `,
    [userId, branchId, passwordHash, account.password_hash],
  );

  if (!updated.rows[0]) {
    throw new AccountError("Tài khoản vừa thay đổi. Vui lòng thử lại.", 409);
  }
}
