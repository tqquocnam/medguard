import {
  Router,
} from "express";

import {
  runChecks,
  getCaseCheckResults,
  getCheckRunHistory,
  getCheckRunResults,
  getCheckRunCaseCheckResults,
  getCheckDatasetList,
  getCheckProgress
} from "./validation.controller.js";

import {
  requireAuth,
} from "../auth/auth.middleware.js";


const router =
  Router();


// ======================================================
// CHẠY KIỂM TRA
// ======================================================

router.post(
  "/run",
  requireAuth,
  runChecks
);

router.get(
  "/runs/:checkRunId/progress",
  requireAuth,
  getCheckProgress
);

// ======================================================
// LỊCH SỬ KIỂM TRA
// ======================================================
//
// GET:
// /api/checks/runs?year=2026&month=10
//
// ======================================================
router.get(
  "/datasets",
  requireAuth,
  getCheckDatasetList
);

router.get(
  "/runs",
  requireAuth,
  getCheckRunHistory
);


// ======================================================
// KẾT QUẢ MỘT LẦN KIỂM TRA
// ======================================================
//
// GET:
// /api/checks/runs/:runId/results
//
// ======================================================

router.get(
  "/runs/:runId/results",
  requireAuth,
  getCheckRunResults
);


// ======================================================
// KẾT QUẢ MỘT HỒ SƠ
// ======================================================
router.get(
  "/runs/:runId/cases/:caseId/results",
  requireAuth,
  getCheckRunCaseCheckResults
);
router.get(
  "/cases/:caseId/results",
  requireAuth,
  getCaseCheckResults
);


export default router;