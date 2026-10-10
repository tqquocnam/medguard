import type {
  Response,
} from "express";

import type {
  AuthRequest,
} from "../auth/auth.middleware.js";

import {
  getDashboardSummary,
} from "./dashboard.service.js";


// ======================================================
// GET DASHBOARD SUMMARY
// ======================================================

export async function dashboardSummary(
  _req: AuthRequest,
  res: Response
) {

  try {

    const data =
      await getDashboardSummary();


    res.json({
      success:
        true,

      data,
    });

  } catch (
    error
  ) {

    console.error(
      "Dashboard summary error:",
      error
    );


    res
      .status(500)
      .json({
        success:
          false,

        message:
          "Không thể tải dữ liệu Dashboard.",
      });
  }
}   