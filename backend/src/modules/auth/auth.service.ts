import bcrypt
  from "bcryptjs";

import jwt
  from "jsonwebtoken";

import {
  db,
} from "../../config/database.js";


export interface AuthUser {
  id: string;
  username: string;
  fullName: string | null;
  role: string;
}


export async function loginUser(
  username: string,
  password: string
): Promise<{
  user: AuthUser;
  token: string;
} | null> {

  const result =
    await db.query(
      `
      SELECT
        id,
        username,
        password_hash,
        full_name,
        role,
        active

      FROM auth.users

      WHERE
        LOWER(username) =
        LOWER($1)

      LIMIT 1
      `,
      [
        username.trim(),
      ]
    );


  if (
    result.rows.length === 0
  ) {
    return null;
  }


  const row =
    result.rows[0];


  if (
    row.active !== true
  ) {
    throw new Error(
      "Tài khoản đã bị khóa."
    );
  }


  const passwordOk =
    await bcrypt.compare(
      password,
      row.password_hash
    );


  if (!passwordOk) {
    return null;
  }


  const secret =
    process.env.JWT_SECRET;


  if (!secret) {
    throw new Error(
      "JWT_SECRET chưa được cấu hình."
    );
  }


  const user: AuthUser = {
    id:
      row.id,

    username:
      row.username,

    fullName:
      row.full_name ??
      null,

    role:
      row.role,
  };


  const token =
    jwt.sign(
      {
        sub:
          user.id,

        username:
          user.username,

        role:
          user.role,
      },

      secret,

      {
        expiresIn:
          "8h",
      }
    );


  await db.query(
    `
    UPDATE auth.users

    SET
      last_login_at =
        NOW(),

      updated_at =
        NOW()

    WHERE
      id = $1
    `,
    [
      user.id,
    ]
  );


  return {
    user,
    token,
  };
}