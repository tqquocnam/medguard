import {
  Router,
} from "express";

import {
  requireAuth,
} from "../auth/auth.middleware.js";

import {
  dashboardSummary,
} from "./dashboard.controller.js";


const router =
  Router();


// ======================================================
// DASHBOARD
//
// ADMIN ✅
// USER  ✅
// Chưa login ❌
// ======================================================

router.get(
  "/summary",
  requireAuth,
  dashboardSummary
);


export default router;