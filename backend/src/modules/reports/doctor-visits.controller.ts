import type { Response } from "express";

import type { AuthRequest } from "../auth/auth.middleware.js";

import { listDoctorVisits } from "./doctor-visits.service.js";

export async function getDoctorVisits(req: AuthRequest, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store");

  const branchId = req.user?.branchId;

  if (!branchId) {
    res.status(403).json({
      success: false,
      message: "Chưa xác định chi nhánh.",
    });

    return;
  }

  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 10);

  const year = req.query.year ? Number(req.query.year) : undefined;

  const month = req.query.month ? Number(req.query.month) : undefined;

  const staffId = String(req.query.staffId ?? "").trim();

  const paymentDate = String(req.query.paymentDate ?? "").trim();

  const uuidPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    (year !== undefined && !Number.isInteger(year)) ||
    (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) ||
    (staffId && !uuidPattern.test(staffId)) ||
    (paymentDate && !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate))
  ) {
    res.status(400).json({
      success: false,
      message: "Bộ lọc không hợp lệ.",
    });

    return;
  }

  try {
    const size = Math.min(pageSize, 200);

    const result = await listDoctorVisits({
      branchId,
      page,
      pageSize: size,
      staffId,
      year,
      month,
      paymentDate,
    });

    res.json({
      success: true,
      data: {
        ...result,
        page,
        pageSize: size,
      },
    });
  } catch (error) {
    console.error("Get doctor visits error:", error);

    res.status(500).json({
      success: false,
      message: "Không thể tải lượt khám bác sĩ.",
    });
  }
}
