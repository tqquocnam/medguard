import type {
  Request,
  Response,
} from "express";

import {
  rebuildMedicalEvents,
} from "../medical-event/event.service.js"

export async function rebuildEvents(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const result =
      await rebuildMedicalEvents();

    res.status(200).json({
      success: true,
      message:
        "Đã rebuild medical events.",
      data: result,
    });
  } catch (error) {
    console.error(
      "Rebuild medical events error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Không thể rebuild medical events.",
    });
  }
}