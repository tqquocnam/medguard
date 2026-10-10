import type {
  NextFunction,
  Response,
} from "express";

import type {
  AuthRequest,
} from "./auth.middleware.js";


export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {

  if (
    !req.user
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


  if (
    req.user.role !==
    "ADMIN"
  ) {

    res
      .status(403)
      .json({
        success: false,
        message:
          "Bạn không có quyền quản trị.",
      });

    return;
  }


  next();
}