import type {
  Response,
} from "express";

import type {
  AuthRequest,
} from "./auth.middleware.js";

import {
  changeOwnPassword,
  createUser,
  getUsers,
  resetUserPassword,
  setUserActive,
  setUserRole,
} from "./account.service.js";


// ======================================================
// LIST
// ======================================================

export async function listUsers(
  _req: AuthRequest,
  res: Response
): Promise<void> {

  try {

    const users =
      await getUsers();


    res.json({
      success: true,
      data: users,
    });

  } catch (error) {

    res
      .status(500)
      .json({
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách tài khoản.",
      });
  }
}


// ======================================================
// CREATE
// ======================================================

export async function addUser(
  req: AuthRequest,
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
        .status(400)
        .json({
          success: false,
          message:
            "Vui lòng nhập tài khoản và mật khẩu.",
        });

      return;
    }


    const user =
      await createUser({
        username,

        password,

        fullName:
          req.body?.fullName,

        role:
          req.body?.role,
      });


    res
      .status(201)
      .json({
        success: true,
        message:
          "Tạo tài khoản thành công.",
        data: user,
      });

  } catch (error) {

    res
      .status(400)
      .json({
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Không thể tạo tài khoản.",
      });
  }
}


// ======================================================
// ACTIVE
// ======================================================

export async function updateUserActive(
  req: AuthRequest,
  res: Response
): Promise<void> {

  try {

    const userId =
      String(
        req.params.userId ??
        ""
      );


    const active =
      req.body?.active ===
      true;


    // Không cho admin tự khóa chính mình.
    if (
      req.user?.id === userId &&
      !active
    ) {

      res
        .status(400)
        .json({
          success: false,
          message:
            "Bạn không thể tự khóa tài khoản của mình.",
        });

      return;
    }


    const user =
      await setUserActive(
        userId,
        active
      );


    res.json({
      success: true,

      message:
        active
          ? "Đã mở tài khoản."
          : "Đã khóa tài khoản.",

      data: user,
    });

  } catch (error) {

    res
      .status(400)
      .json({
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật tài khoản.",
      });
  }
}


// ======================================================
// ROLE
// ======================================================

export async function updateUserRole(
  req: AuthRequest,
  res: Response
): Promise<void> {

  try {

    const userId =
      String(
        req.params.userId ??
        ""
      );


    const role =
      String(
        req.body?.role ??
        ""
      ).toUpperCase();


    if (
      req.user?.id ===
        userId &&
      role !== "ADMIN"
    ) {

      res
        .status(400)
        .json({
          success: false,
          message:
            "Bạn không thể tự bỏ quyền ADMIN của mình.",
        });

      return;
    }


    const user =
      await setUserRole(
        userId,
        role
      );


    res.json({
      success: true,
      message:
        "Cập nhật quyền thành công.",
      data: user,
    });

  } catch (error) {

    res
      .status(400)
      .json({
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật quyền.",
      });
  }
}


// ======================================================
// ADMIN RESET PASSWORD
// ======================================================

export async function adminResetPassword(
  req: AuthRequest,
  res: Response
): Promise<void> {

  try {

    const userId =
      String(
        req.params.userId ??
        ""
      );


    const password =
      String(
        req.body?.password ??
        ""
      );


    await resetUserPassword(
      userId,
      password
    );


    res.json({
      success: true,
      message:
        "Đặt lại mật khẩu thành công.",
    });

  } catch (error) {

    res
      .status(400)
      .json({
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Không thể đặt lại mật khẩu.",
      });
  }
}


// ======================================================
// CHANGE OWN PASSWORD
// ======================================================

export async function changePassword(
  req: AuthRequest,
  res: Response
): Promise<void> {

  try {

    if (
      !req.user?.id
    ) {

      res
        .status(401)
        .json({
          success: false,
          message:
            "Bạn chưa đăng nhập.",
        });

      return;
    }


    const oldPassword =
      String(
        req.body?.oldPassword ??
        ""
      );


    const newPassword =
      String(
        req.body?.newPassword ??
        ""
      );


    if (
      !oldPassword ||
      !newPassword
    ) {

      res
        .status(400)
        .json({
          success: false,
          message:
            "Vui lòng nhập đầy đủ mật khẩu.",
        });

      return;
    }


    await changeOwnPassword(
      req.user.id,
      oldPassword,
      newPassword
    );


    res.json({
      success: true,
      message:
        "Đổi mật khẩu thành công.",
    });

  } catch (error) {

    res
      .status(400)
      .json({
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Đổi mật khẩu thất bại.",
      });
  }
}