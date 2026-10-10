import bcrypt
  from "bcryptjs";

import {
  db,
} from "../../config/database.js";


// ======================================================
// LIST USERS
// ======================================================

export async function getUsers() {

  const result =
    await db.query(
      `
      SELECT
        id,
        username,
        full_name,
        role,
        active,
        last_login_at,
        created_at,
        updated_at

      FROM auth.users

      ORDER BY
        created_at DESC
      `
    );


  return result.rows;
}


// ======================================================
// CREATE USER
// ======================================================

export async function createUser(
  data: {
    username: string;
    password: string;
    fullName?: string;
    role?: string;
  }
) {

  const username =
    data.username
      .trim();


  const password =
    data.password;


  const fullName =
    String(
      data.fullName ??
      ""
    ).trim();


  const role =
    data.role === "ADMIN"
      ? "ADMIN"
      : "USER";


  if (
    username.length < 3
  ) {

    throw new Error(
      "Tài khoản phải có ít nhất 3 ký tự."
    );
  }


  if (
    password.length < 6
  ) {

    throw new Error(
      "Mật khẩu phải có ít nhất 6 ký tự."
    );
  }


  const passwordHash =
    await bcrypt.hash(
      password,
      12
    );


  try {

    const result =
      await db.query(
        `
        INSERT INTO auth.users
        (
          username,
          password_hash,
          full_name,
          role,
          active
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          true
        )

        RETURNING
          id,
          username,
          full_name,
          role,
          active,
          created_at
        `,
        [
          username,
          passwordHash,
          fullName || null,
          role,
        ]
      );


    return result.rows[0];

  } catch (error: any) {

    if (
      error?.code ===
      "23505"
    ) {

      throw new Error(
        "Tên tài khoản đã tồn tại."
      );
    }


    throw error;
  }
}


// ======================================================
// SET ACTIVE
// ======================================================

export async function setUserActive(
  userId: string,
  active: boolean
) {

  const result =
    await db.query(
      `
      UPDATE auth.users

      SET
        active = $1,
        updated_at = NOW()

      WHERE
        id = $2

      RETURNING
        id,
        username,
        full_name,
        role,
        active
      `,
      [
        active,
        userId,
      ]
    );


  if (
    result.rows.length ===
    0
  ) {

    throw new Error(
      "Không tìm thấy tài khoản."
    );
  }


  return result.rows[0];
}


// ======================================================
// CHANGE ROLE
// ======================================================

export async function setUserRole(
  userId: string,
  role: string
) {

  if (
    role !== "ADMIN" &&
    role !== "USER"
  ) {

    throw new Error(
      "Quyền tài khoản không hợp lệ."
    );
  }


  const result =
    await db.query(
      `
      UPDATE auth.users

      SET
        role = $1,
        updated_at = NOW()

      WHERE
        id = $2

      RETURNING
        id,
        username,
        full_name,
        role,
        active
      `,
      [
        role,
        userId,
      ]
    );


  if (
    result.rows.length ===
    0
  ) {

    throw new Error(
      "Không tìm thấy tài khoản."
    );
  }


  return result.rows[0];
}


// ======================================================
// RESET PASSWORD BY ADMIN
// ======================================================

export async function resetUserPassword(
  userId: string,
  password: string
) {

  if (
    password.length < 6
  ) {

    throw new Error(
      "Mật khẩu phải có ít nhất 6 ký tự."
    );
  }


  const passwordHash =
    await bcrypt.hash(
      password,
      12
    );


  const result =
    await db.query(
      `
      UPDATE auth.users

      SET
        password_hash = $1,
        updated_at = NOW()

      WHERE
        id = $2

      RETURNING
        id,
        username
      `,
      [
        passwordHash,
        userId,
      ]
    );


  if (
    result.rows.length ===
    0
  ) {

    throw new Error(
      "Không tìm thấy tài khoản."
    );
  }


  return result.rows[0];
}


// ======================================================
// CHANGE OWN PASSWORD
// ======================================================

export async function changeOwnPassword(
  userId: string,
  oldPassword: string,
  newPassword: string
) {

  if (
    newPassword.length < 6
  ) {

    throw new Error(
      "Mật khẩu mới phải có ít nhất 6 ký tự."
    );
  }


  const result =
    await db.query(
      `
      SELECT
        password_hash

      FROM auth.users

      WHERE
        id = $1
        AND active = true

      LIMIT 1
      `,
      [
        userId,
      ]
    );


  if (
    result.rows.length ===
    0
  ) {

    throw new Error(
      "Không tìm thấy tài khoản."
    );
  }


  const passwordOk =
    await bcrypt.compare(
      oldPassword,
      result.rows[0]
        .password_hash
    );


  if (!passwordOk) {

    throw new Error(
      "Mật khẩu hiện tại không đúng."
    );
  }


  const passwordHash =
    await bcrypt.hash(
      newPassword,
      12
    );


  await db.query(
    `
    UPDATE auth.users

    SET
      password_hash = $1,
      updated_at = NOW()

    WHERE
      id = $2
    `,
    [
      passwordHash,
      userId,
    ]
  );
}