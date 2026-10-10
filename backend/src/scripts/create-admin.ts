import bcrypt
  from "bcryptjs";

import {
  db,
} from "../config/database.js";


async function main() {

  const username =
    "admin";

  const password =
    "Admin@123";

  const passwordHash =
    await bcrypt.hash(
      password,
      12
    );


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
      'ADMIN',
      true
    )

    ON CONFLICT (
      username
    )

    DO UPDATE SET
      password_hash =
        EXCLUDED.password_hash,

      full_name =
        EXCLUDED.full_name,

      role =
        'ADMIN',

      active =
        true,

      updated_at =
        NOW()
    `,
    [
      username,
      passwordHash,
      "Quản trị MedGuard",
    ]
  );


  console.log(
    "Tạo tài khoản ADMIN thành công"
  );

  console.log(
    "Username:",
    username
  );

  console.log(
    "Password:",
    password
  );


  await db.end();
}


main()
  .catch(
    (
      error
    ) => {

      console.error(
        error
      );

      process.exit(
        1
      );
    }
  );