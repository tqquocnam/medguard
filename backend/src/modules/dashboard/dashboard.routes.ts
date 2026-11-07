import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware.js";

import { dashboardSummary } from "./dashboard.controller.js";

const router = Router();

router.get("/summary", requireAuth, dashboardSummary);

export default router;
