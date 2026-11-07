
import { Router } from "express";
import type { Request, Response } from "express";

import { db } from "../../config/database.js";

// ======================================================
// CONFIG
// ======================================================

const router = Router();

const RULE_CODE =
  "SERVICE_CALCIUM_ELECTROLYTE_EXCLUSION";

const DEFAULT_SERVICE_A = "23.0029.1473";
const DEFAULT_SERVICE_B = "23.0058.1487";

interface RuleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
  severity: string;
  required: boolean;
  blocks_ok: boolean;
  config: Record<string, unknown> | null;
}

function normalizeCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function formatRule(row: RuleRow) {
  const config = row.config ?? {};

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    severity: row.severity,
    required: row.required,
    blocksOk: row.blocks_ok,

    config: {
      ...config,
      serviceACode:
        typeof config.serviceACode === "string"
          ? config.serviceACode
          : DEFAULT_SERVICE_A,

      serviceBCode:
        typeof config.serviceBCode === "string"
          ? config.serviceBCode
          : DEFAULT_SERVICE_B,

      treatmentGroup: "GENERAL",
      interactionType: "MUTUALLY_EXCLUSIVE",
    },
  };
}

// ======================================================
// GET CONFIG
// GET /api/catalog/service-calcium-electrolyte
// ======================================================

router.get(
  "/",
  async (_req: Request, res: Response) => {
    try {
      const result = await db.query<RuleRow>(
        `
        SELECT
          id,
          code,
          name,
          description,
          enabled,
          severity,
          required,
          blocks_ok,
          config
        FROM validation.branch_rules
        WHERE code = $1
        LIMIT 1
        `,
        [RULE_CODE]
      );

      const rule = result.rows[0];

      if (!rule) {
        res.status(404).json({
          success: false,
          message:
            "Chưa tìm thấy rule Canxi toàn phần - Điện giải đồ.",
        });
        return;
      }

      res.json({
        success: true,
        data: formatRule(rule),
      });
    } catch (error) {
      console.error(
        "[CALCIUM ELECTROLYTE] GET error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Không thể tải cấu hình quy luật.",
      });
    }
  }
);

// ======================================================
// SAVE CONFIG
// PUT /api/catalog/service-calcium-electrolyte
// ======================================================

router.put(
  "/",
  async (req: Request, res: Response) => {
    try {
      const body: unknown = req.body;

      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body)
      ) {
        res.status(400).json({
          success: false,
          message: "Dữ liệu cấu hình không hợp lệ.",
        });
        return;
      }

      const input = body as Record<string, unknown>;

      if (typeof input.enabled !== "boolean") {
        res.status(400).json({
          success: false,
          message: "Trạng thái quy luật không hợp lệ.",
        });
        return;
      }

      if (typeof input.severity !== "string") {
        res.status(400).json({
          success: false,
          message: "Mức cảnh báo không hợp lệ.",
        });
        return;
      }

      const severity = input.severity
        .trim()
        .toUpperCase();

      if (
        severity !== "WARNING" &&
        severity !== "ERROR"
      ) {
        res.status(400).json({
          success: false,
          message:
            "Chỉ chấp nhận mức WARNING hoặc ERROR.",
        });
        return;
      }

      if (
        typeof input.serviceACode !== "string" ||
        typeof input.serviceBCode !== "string"
      ) {
        res.status(400).json({
          success: false,
          message: "Mã DVKT A và B phải là chuỗi ký tự.",
        });
        return;
      }

      const serviceACode = normalizeCode(
        input.serviceACode
      );

      const serviceBCode = normalizeCode(
        input.serviceBCode
      );

      if (!serviceACode || !serviceBCode) {
        res.status(400).json({
          success: false,
          message:
            "Không được để trống mã DVKT A hoặc B.",
        });
        return;
      }

      if (
        serviceACode.length > 100 ||
        serviceBCode.length > 100
      ) {
        res.status(400).json({
          success: false,
          message:
            "Mỗi mã DVKT không được vượt quá 100 ký tự.",
        });
        return;
      }

      if (serviceACode === serviceBCode) {
        res.status(400).json({
          success: false,
          message:
            "DVKT A và DVKT B không được trùng mã.",
        });
        return;
      }

      const configPatch = {
        serviceACode,
        serviceBCode,
        treatmentGroup: "GENERAL",
        interactionType: "MUTUALLY_EXCLUSIVE",
        note:
          "Chỉ cho phép một trong hai DVKT trong cùng hồ sơ.",
      };

      const result = await db.query<RuleRow>(
        `
        UPDATE validation.branch_rules
        SET
          enabled = $2,
          severity = $3,
          config =
            COALESCE(config, '{}'::jsonb)
            || $4::jsonb,
          updated_at = NOW()
        WHERE code = $1
        RETURNING
          id,
          code,
          name,
          description,
          enabled,
          severity,
          required,
          blocks_ok,
          config
        `,
        [
          RULE_CODE,
          input.enabled,
          severity,
          JSON.stringify(configPatch),
        ]
      );

      const rule = result.rows[0];

      if (!rule) {
        res.status(404).json({
          success: false,
          message:
            "Không tìm thấy rule để cập nhật.",
        });
        return;
      }

      res.json({
        success: true,
        message:
          "Lưu cấu hình Canxi toàn phần - Điện giải đồ thành công.",
        data: formatRule(rule),
      });
    } catch (error) {
      console.error(
        "[CALCIUM ELECTROLYTE] PUT error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Không thể cập nhật cấu hình quy luật.",
      });
    }
  }
);

export default router;
