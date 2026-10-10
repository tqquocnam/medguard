import {
  Router,
} from "express";

import {
  login,
  logout,
  me,
} from "./auth.controller.js";

import {
  requireAuth,
} from "./auth.middleware.js";

import {
  requireAdmin,
} from "./admin.middleware.js";

import {
  addUser,
  adminResetPassword,
  changePassword,
  listUsers,
  updateUserActive,
  updateUserRole,
} from "./account.controller.js";


const router =
  Router();


// ======================================================
// LOGIN
// ======================================================

router.post(
  "/login",
  login
);


// ======================================================
// CURRENT USER
// ======================================================

router.get(
  "/me",
  requireAuth,
  me
);


router.post(
  "/logout",
  requireAuth,
  logout
);


router.post(
  "/change-password",
  requireAuth,
  changePassword
);


// ======================================================
// ADMIN
// ======================================================

router.get(
  "/users",
  requireAuth,
  requireAdmin,
  listUsers
);


router.post(
  "/users",
  requireAuth,
  requireAdmin,
  addUser
);


router.patch(
  "/users/:userId/active",
  requireAuth,
  requireAdmin,
  updateUserActive
);


router.patch(
  "/users/:userId/role",
  requireAuth,
  requireAdmin,
  updateUserRole
);


router.post(
  "/users/:userId/reset-password",
  requireAuth,
  requireAdmin,
  adminResetPassword
);


export default router;