import type {
  NextFunction,
  Request,
  Response,
} from "express";

import jwt, {
  type JwtPayload,
} from "jsonwebtoken";

import {
  db,
} from "../../config/database.js";


// ======================================================
// USER GẮN VÀO REQUEST
// ======================================================

export interface AuthUser {

  id: string;

  username: string;

  role: string;
}


export interface AuthRequest
  extends Request {

  user?:
    AuthUser;
}


// ======================================================
// XÓA COOKIE ĐĂNG NHẬP
// ======================================================

function clearAuthCookie(
  res: Response
) {

  res.clearCookie(
    "medguard_token",
    {
      httpOnly:
        true,

      sameSite:
        "lax",

      secure:
        false,

      path:
        "/",
    }
  );
}


// ======================================================
// REQUIRE AUTH
// ======================================================
//
// 1. Đọc cookie medguard_token
// 2. Verify JWT
// 3. Lấy user ID từ JWT
// 4. Kiểm tra lại auth.users
// 5. Kiểm tra active
// 6. Lấy role MỚI NHẤT từ database
//
// Như vậy:
//
// ADMIN khóa user
//      ↓
// request tiếp theo
//      ↓
// active = false
//      ↓
// 401 ngay lập tức
//
// ADMIN đổi role
//      ↓
// request tiếp theo
//      ↓
// req.user.role lấy role mới từ DB
//
// ======================================================

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {

  // ====================================================
  // 1. LẤY TOKEN
  // ====================================================

  const token =
    req.cookies
      ?.medguard_token;


  if (!token) {

    res
      .status(401)
      .json({
        success:
          false,

        message:
          "Bạn chưa đăng nhập.",
      });

    return;
  }


  // ====================================================
  // 2. KIỂM TRA JWT SECRET
  // ====================================================

  const secret =
    process.env
      .JWT_SECRET;


  if (!secret) {

    console.error(
      "JWT_SECRET chưa được cấu hình."
    );


    res
      .status(500)
      .json({
        success:
          false,

        message:
          "Hệ thống đăng nhập chưa được cấu hình đúng.",
      });

    return;
  }


  // ====================================================
  // 3. VERIFY JWT
  // ====================================================

  let decoded:
    JwtPayload;


  try {

    const verified =
      jwt.verify(
        token,
        secret
      );


    if (
      typeof verified ===
      "string"
    ) {

      clearAuthCookie(
        res
      );


      res
        .status(401)
        .json({
          success:
            false,

          message:
            "Phiên đăng nhập không hợp lệ.",
        });

      return;
    }


    decoded =
      verified;

  } catch (
    error
  ) {

    clearAuthCookie(
      res
    );


    if (
      error instanceof
      jwt.TokenExpiredError
    ) {

      res
        .status(401)
        .json({
          success:
            false,

          message:
            "Phiên đăng nhập đã hết hạn.",
        });

      return;
    }


    res
      .status(401)
      .json({
        success:
          false,

        message:
          "Phiên đăng nhập không hợp lệ.",
      });

    return;
  }


  // ====================================================
  // 4. LẤY USER ID TỪ JWT
  // ====================================================

  const userId =
    decoded.sub;


  if (
    !userId ||
    typeof userId !==
      "string"
  ) {

    clearAuthCookie(
      res
    );


    res
      .status(401)
      .json({
        success:
          false,

        message:
          "Phiên đăng nhập không hợp lệ.",
      });

    return;
  }


  // ====================================================
  // 5. KIỂM TRA USER TRONG DATABASE
  // ====================================================

  try {

    const result =
      await db.query(
        `
        SELECT
          id,
          username,
          role,
          active

        FROM auth.users

        WHERE
          id = $1

        LIMIT 1
        `,
        [
          userId,
        ]
      );


    // ==================================================
    // USER KHÔNG CÒN TỒN TẠI
    // ==================================================

    if (
      result.rows.length ===
      0
    ) {

      clearAuthCookie(
        res
      );


      res
        .status(401)
        .json({
          success:
            false,

          message:
            "Tài khoản không còn tồn tại.",
        });

      return;
    }


    const account =
      result.rows[0];


    // ==================================================
    // USER ĐÃ BỊ KHÓA
    // ==================================================

    if (
      account.active !==
      true
    ) {

      clearAuthCookie(
        res
      );


      res
        .status(401)
        .json({
          success:
            false,

          message:
            "Tài khoản đã bị khóa.",
        });

      return;
    }


    // ==================================================
    // 6. GẮN THÔNG TIN MỚI NHẤT VÀO REQUEST
    // ==================================================
    //
    // Không dùng role nằm trong JWT nữa.
    // Role được lấy trực tiếp từ database.
    //
    // ==================================================

    req.user = {

      id:
        String(
          account.id
        ),

      username:
        String(
          account.username
        ),

      role:
        String(
          account.role
        ),
    };


    // ==================================================
    // 7. CHO REQUEST ĐI TIẾP
    // ==================================================

    next();

  } catch (
    error
  ) {

    console.error(
      "Auth database error:",
      error
    );


    res
      .status(500)
      .json({
        success:
          false,

        message:
          "Không thể xác thực tài khoản.",
      });
  }
}