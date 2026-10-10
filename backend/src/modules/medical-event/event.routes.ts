import {
  Router,
} from "express";

import {
  rebuildEvents,
} from "./event.controller.js";

const router =
  Router();

router.post(
  "/rebuild",
  rebuildEvents
);

export default router;