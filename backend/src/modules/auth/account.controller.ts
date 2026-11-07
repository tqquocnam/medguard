import type { Response } from "express";

import type { AuthRequest, AuthUser } from "./auth.middleware.js";

import {
  AccountError,
  changeOwnPassword,
  createUser,
  getUsers,
  resetUserPassword,
  setUserActive,
  setUserRole,
  updateUserFullName,
} from "./account.service.js";

type Result = {
  data?: unknown;
  message?: string;
  status?: number;
};

async function handle(
  req: AuthRequest,
  res: Response,
  action: (user: AuthUser) => Promise<Result>,
): Promise<void> {
  res.setHeader("Cache-Control", "no-store");

  if (!req.user?.branchId) {
    res.status(403).json({
      success: false,
      message: "Chưa xác định tài khoản và chi nhánh.",
    });

    return;
  }

  try {
    const { status = 200, ...result } = await action(req.user);

    res.status(status).json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof AccountError) {
      res.status(error.status).json({
        success: false,
        message: error.message,
      });

      return;
    }

    console.error("Account error:", error);

    res.status(500).json({
      success: false,
      message: "Không thể xử lý tài khoản. Vui lòng thử lại.",
    });
  }
}

export async function listUsers(req: AuthRequest, res: Response): Promise<void> {
  await handle(req, res, async (user) => ({
    data: await getUsers(user.branchId),
  }));
}

export async function addUser(req: AuthRequest, res: Response): Promise<void> {
  await handle(req, res, async (user) => ({
    status: 201,
    message: "Tạo tài khoản thành công.",

    // Chi nhánh và quyền được xác định ở backend.
    data: await createUser(user.branchId, {
      username: String(req.body?.username ?? ""),
      password: String(req.body?.password ?? ""),
      fullName: String(req.body?.fullName ?? ""),
    }),
  }));
}

export async function updateOwnProfile(req: AuthRequest, res: Response): Promise<void> {
  await handle(req, res, async (user) => ({
    message: "Cập nhật tên hiển thị thành công.",

    // Chỉ cập nhật tài khoản đang đăng nhập.
    data: await updateUserFullName(user.branchId, user.id, req.body?.fullName),
  }));
}

export async function updateUserActive(req: AuthRequest, res: Response): Promise<void> {
  await handle(req, res, async (user) => {
    const userId = String(req.params.userId ?? "");
    const active = req.body?.active;

    if (typeof active !== "boolean") {
      throw new AccountError("Trạng thái tài khoản không hợp lệ.");
    }

    if (userId.toLowerCase() === user.id.toLowerCase() && !active) {
      throw new AccountError("Bạn không thể tự khóa tài khoản của mình.");
    }

    return {
      message: active ? "Đã mở tài khoản." : "Đã khóa tài khoản.",
      data: await setUserActive(user.branchId, userId, active),
    };
  });
}

export async function updateUserRole(req: AuthRequest, res: Response): Promise<void> {
  await handle(req, res, async (user) => ({
    message: "Tài khoản sử dụng quyền ADMIN.",

    data: await setUserRole(
      user.branchId,
      String(req.params.userId ?? ""),
      String(req.body?.role ?? "").toUpperCase(),
    ),
  }));
}

export async function adminResetPassword(req: AuthRequest, res: Response): Promise<void> {
  await handle(req, res, async (user) => {
    await resetUserPassword(
      user.branchId,
      String(req.params.userId ?? ""),
      String(req.body?.password ?? ""),
    );

    return {
      message: "Đặt lại mật khẩu thành công.",
    };
  });
}

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  await handle(req, res, async (user) => {
    const oldPassword = String(req.body?.oldPassword ?? "");
    const newPassword = String(req.body?.newPassword ?? "");

    if (!oldPassword || !newPassword) {
      throw new AccountError("Vui lòng nhập đầy đủ mật khẩu.");
    }

    await changeOwnPassword(user.branchId, user.id, oldPassword, newPassword);

    return {
      message: "Đổi mật khẩu thành công.",
    };
  });
}
