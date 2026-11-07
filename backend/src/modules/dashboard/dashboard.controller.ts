import type { Response } from "express";

import type { AuthRequest } from "../auth/auth.middleware.js";

import { getDashboardSummary } from "./dashboard.service.js";

export async function dashboardSummary(req: AuthRequest, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store");

  const branchId = req.user?.branchId;

  if (!branchId) {
    res.status(403).json({
      success: false,
      message: "Tài khoản chưa được xác định chi nhánh.",
    });

    return;
  }

  try {
    const data = await getDashboardSummary(branchId);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);

    res.status(500).json({
      success: false,
      message: "Không thể tải dữ liệu Dashboard.",
    });
  }
}
