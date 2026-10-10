import {
  Router,
} from "express";

import {

  getStaffSchedules,

  addStaffSchedule,

  editStaffSchedule,

  removeStaffSchedule,

  generateDefaultStaffSchedule,

} from "./staff-schedule.controller.js";


const router =
  Router();


// ======================================================
// LIST
// ======================================================

router.get(
  "/",
  getStaffSchedules
);


// ======================================================
// GENERATE DEFAULT
//
// PHẢI ĐẶT TRƯỚC /:id
// ======================================================

router.post(
  "/generate-default",
  generateDefaultStaffSchedule
);


// ======================================================
// CREATE
// ======================================================

router.post(
  "/",
  addStaffSchedule
);


// ======================================================
// UPDATE
// ======================================================

router.put(
  "/:id",
  editStaffSchedule
);


// ======================================================
// DELETE
// ======================================================

router.delete(
  "/:id",
  removeStaffSchedule
);


export default router;