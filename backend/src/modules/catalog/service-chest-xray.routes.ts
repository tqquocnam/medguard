
import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../../config/database.js";

const router = Router();

const RULE_CODE = "SERVICE_CHEST_XRAY_EXCLUSION";

const DEFAULT_GROUP_A = [
  "18.0119.0029",
  "18.0119.0028",
];

const DEFAULT_GROUP_B = [
  "18.0120.0028",
];

type RuleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
  severity: string;
  required: boolean;
  blocks_ok: boolean;
  config: Record<string, unknown> | null;
};

function normalizeCodes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("Danh sách mã DVKT không hợp lệ.");
  }

  if (value.some((item) => typeof item !== "string")) {
    throw new Error("Mã DVKT phải là chuỗi ký tự.");
  }

  const codes = value.map((item) =>
    String(item).trim().toUpperCase()
  );

  if (codes.some((code) => !code)) {
    throw new Error("Không được nhập mã DVKT trống.");
  }

  if (codes.some((code) => code.length > 100)) {
    throw new Error("Mã DVKT tối đa 100 ký tự.");
  }

  return Array.from(new Set(codes));
}

function readCodes(
  value: unknown,
  defaults: string[]
): string[] {
  if (!Array.isArray(value)) {
    return [...defaults];
  }

  return Array.from(
    new Set(
      value
        .filter(
          (item): item is string =>
            typeof item === "string"
        )
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
    )
  );
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
      groupACodes: readCodes(
        config.groupACodes,
        DEFAULT_GROUP_A
      ),
      groupBCodes: readCodes(
        config.groupBCodes,
        DEFAULT_GROUP_B
      ),
      treatmentGroup: "GENERAL",
      interactionType: "MUTUALLY_EXCLUSIVE",
    },
  };
}

// ======================================================
// GET /api/catalog/service-chest-xray
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
        FROM validation.rules
        WHERE code = $1
        LIMIT 1
        `,
        [RULE_CODE]
      );

      const rule = result.rows[0];

      if (!rule) {
        res.status(404).json({
          success: false,
          message: "Chưa đăng ký rule X-quang ngực.",
        });
        return;
      }

      res.json({
        success: true,
        data: formatRule(rule),
      });
    } catch (error) {
      console.error("[CHEST XRAY] GET error:", error);

      res.status(500).json({
        success: false,
        message: "Không thể tải cấu hình X-quang ngực.",
      });
    }
  }
);

// ======================================================
// PUT /api/catalog/service-chest-xray
// ======================================================

router.put(
  "/",
  async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;

      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body)
      ) {
        res.status(400).json({
          success: false,
          message: "Dữ liệu không hợp lệ.",
        });
        return;
      }

      if (typeof body.enabled !== "boolean") {
        res.status(400).json({
          success: false,
          message: "Trạng thái bật/tắt không hợp lệ.",
        });
        return;
      }

      const severity = String(
        body.severity ?? ""
      ).trim().toUpperCase();

      if (
        severity !== "WARNING" &&
        severity !== "ERROR"
      ) {
        res.status(400).json({
          success: false,
          message: "Mức độ phải là WARNING hoặc ERROR.",
        });
        return;
      }

      let groupACodes: string[];
      let groupBCodes: string[];

      try {
        groupACodes = normalizeCodes(body.groupACodes);
        groupBCodes = normalizeCodes(body.groupBCodes);
      } catch (error) {
        res.status(400).json({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Mã DVKT không hợp lệ.",
        });
        return;
      }

      if (
        groupACodes.length === 0 ||
        groupBCodes.length === 0
      ) {
        res.status(400).json({
          success: false,
          message:
            "Mỗi nhóm cần có ít nhất một mã DVKT.",
        });
        return;
      }

      const groupASet = new Set(groupACodes);
      const duplicates = groupBCodes.filter(
        (code) => groupASet.has(code)
      );

      if (duplicates.length > 0) {
        res.status(400).json({
          success: false,
          message:
            "Mã DVKT không được nằm trong cả hai nhóm: " +
            duplicates.join(", "),
        });
        return;
      }

      const configPatch = {
        groupACodes,
        groupBCodes,
        treatmentGroup: "GENERAL",
        interactionType: "MUTUALLY_EXCLUSIVE",
        note:
          "Không thanh toán đồng thời X-quang ngực thẳng và nghiêng/chếch.",
      };

      const result = await db.query<RuleRow>(
        `
        UPDATE validation.rules
        SET
          enabled = $2,
          severity = $3,
          config = COALESCE(config, '{}'::jsonb)
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
          body.enabled,
          severity,
          JSON.stringify(configPatch),
        ]
      );

      const rule = result.rows[0];

      if (!rule) {
        res.status(404).json({
          success: false,
          message: "Không tìm thấy rule cần cập nhật.",
        });
        return;
      }

      res.json({
        success: true,
        message: "Lưu cấu hình X-quang ngực thành công.",
        data: formatRule(rule),
      });
    } catch (error) {
      console.error("[CHEST XRAY] PUT error:", error);

      res.status(500).json({
        success: false,
        message: "Không thể lưu cấu hình X-quang ngực.",
      });
    }
  }
);

export default router;
