import { Router } from "express";

import { login, logout, me } from "./auth.controller.js";

import { requireAuth } from "./auth.middleware.js";

import {
  addUser,
  adminResetPassword,
  changePassword,
  listUsers,
  updateUserActive,
  updateUserRole,
} from "./account.controller.js";

const router = Router();

router.post("/login", login);

router.get("/me", requireAuth, me);

router.post("/logout", requireAuth, logout);

router.post("/change-password", requireAuth, changePassword);

router.get("/users", requireAuth, listUsers);

router.post("/users", requireAuth, addUser);

router.patch("/users/:userId/active", requireAuth, updateUserActive);

router.patch("/users/:userId/role", requireAuth, updateUserRole);

router.post("/users/:userId/reset-password", requireAuth, adminResetPassword);

export default router;
