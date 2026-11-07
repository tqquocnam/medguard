import type { Response } from "express";

import type { AuthRequest } from "../auth/auth.middleware.js";

import {
  ScheduleError,
  listStaffSchedules,
  createStaffSchedule,
  updateStaffSchedule,
  deleteStaffSchedule,
  generateDefaultSchedule,
} from "./staff-schedule.service.js";

async function handle(
  req: AuthRequest,
  res: Response,
  action: (branchId: string) => Promise<{
    data?: unknown;
    message?: string;
  }>,
  status = 200,
) {
  res.setHeader("Cache-Control", "no-store");

  const branchId = req.user?.branchId;

  if (!branchId) {
    res.status(403).json({
      success: false,
      message: "Chưa xác định chi nhánh.",
    });

    return;
  }

  try {
    res.status(status).json({
      success: true,
      ...(await action(branchId)),
    });
  } catch (error) {
    console.error("Staff schedule error:", error);

    res.status(error instanceof ScheduleError ? error.status : 500).json({
      success: false,

      message: error instanceof ScheduleError ? error.message : "Không thể xử lý lịch làm việc.",
    });
  }
}

export async function getStaffSchedules(req: AuthRequest, res: Response) {
  await handle(req, res, async (branchId) => {
    const page = Number(req.query.page ?? 1);

    const pageSize = Number(req.query.pageSize ?? 50);

    const year = req.query.year ? Number(req.query.year) : undefined;

    const month = req.query.month ? Number(req.query.month) : undefined;

    const status = String(req.query.status ?? "");

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      (year !== undefined && !Number.isInteger(year)) ||
      (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) ||
      (status && !["ACTIVE", "OFF"].includes(status))
    ) {
      throw new ScheduleError("Bộ lọc không hợp lệ.");
    }

    const size = Math.min(pageSize, 500);

    const result = await listStaffSchedules({
      branchId,

      staffId: String(req.query.staffId ?? ""),

      year,
      month,
      status,
      limit: size,
      offset: (page - 1) * size,
    });

    return {
      data: {
        ...result,
        page,
        pageSize: size,
      },
    };
  });
}

export async function addStaffSchedule(req: AuthRequest, res: Response) {
  await handle(
    req,
    res,
    async (branchId) => ({
      data: await createStaffSchedule(branchId, req.body ?? {}),

      message: "Thêm lịch làm việc thành công.",
    }),
    201,
  );
}

export async function editStaffSchedule(req: AuthRequest, res: Response) {
  await handle(req, res, async (branchId) => ({
    data: await updateStaffSchedule(branchId, String(req.params.id ?? ""), req.body ?? {}),

    message: "Cập nhật lịch làm việc thành công.",
  }));
}

export async function removeStaffSchedule(req: AuthRequest, res: Response) {
  await handle(req, res, async (branchId) => {
    await deleteStaffSchedule(branchId, String(req.params.id ?? ""));

    return {
      message: "Xóa lịch làm việc thành công.",
    };
  });
}

export async function generateDefaultStaffSchedule(req: AuthRequest, res: Response) {
  await handle(req, res, async (branchId) => {
    const result = await generateDefaultSchedule(branchId, {
      staffId: String(req.body?.staffId ?? ""),

      year: Number(req.body?.year),
      month: Number(req.body?.month),
    });

    return {
      data: result,

      message:
        `Tạo lịch mặc định: ${result.inserted} ngày, ` +
        `bỏ qua ${result.skipped} ngày đã có lịch.`,
    };
  });
}
