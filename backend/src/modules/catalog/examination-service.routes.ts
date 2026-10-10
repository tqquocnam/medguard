import {
  Router,
} from "express";

import {
  addExaminationService,
  editExaminationService,
  getExaminationServiceByCode,
  getExaminationServices,
  removeExaminationService,
} from "./examination-service.controller.js";


const router =
  Router();


// ======================================================
// LIST
// ======================================================

router.get(
  "/",
  getExaminationServices
);


// ======================================================
// GET ONE
// ======================================================

router.get(
  "/:code",
  getExaminationServiceByCode
);


// ======================================================
// CREATE
// ======================================================

router.post(
  "/",
  addExaminationService
);


// ======================================================
// UPDATE
// ======================================================

router.put(
  "/:code",
  editExaminationService
);


// ======================================================
// DISABLE
// ======================================================

router.delete(
  "/:code",
  removeExaminationService
);


export default router;