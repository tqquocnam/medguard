import {
  Router,
} from "express";

import {
  getDoctorVisits,
} from "./doctor-visits.controller.js";

import {
  requireAuth,
} from "../auth/auth.middleware.js";


const router =
  Router();


router.get(
  "/doctor-visits",
  requireAuth,
  getDoctorVisits
);


export default router;