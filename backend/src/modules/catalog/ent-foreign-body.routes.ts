
import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../../config/database.js";

const router = Router();

const RULE_CODE = "ENT_FOREIGN_BODY_COMBINED_PAYMENT";

const DEFAULT_ENDOSCOPY = [
  "20.0013.0933",
  "20.0013.2048",
];

const DEFAULT_FOREIGN_BODY = [
  "15.0143.0907",
  "15.0143.0906",
  "15.0212.0900",
  "03.2117.0903",
  "15.0054.0903",
  "03.2117.0902",
  "03.2117.0901",
  "15.0054.0902",
];

interface RuleRecord {
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

function normalizeCodes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("Danh sách mã DVKT phải là một mảng.");
  }

  if (
    value.some(
      (item) => typeof item !== "string"
    )
  ) {
    throw new Error("Mỗi mã DVKT phải là chuỗi ký tự.");
  }

  const codes = value.map((item) =>
    String(item).trim().toUpperCase()
  );

  if (codes.some((code) => !code)) {
    throw new Error("Danh sách chứa mã DVKT trống.");
  }

  if (codes.some((code) => code.length > 100)) {
    throw new Error("Mã DVKT không được vượt quá 100 ký tự.");
  }

  return Array.from(new Set(codes));
}

function readConfigCodes(
  value: unknown,
  fallback: string[]
): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
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

function formatRule(row: RuleRecord) {
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
      topicCode:
        typeof config.topicCode === "string"
          ? config.topicCode
          : "TINH.DV.107",
      rejectionCode:
        typeof config.rejectionCode === "string"
          ? config.rejectionCode
          : "S.005.655",
      treatmentGroup: "GENERAL",
      endoscopyCodes: readConfigCodes(
        config.endoscopyCodes,
        DEFAULT_ENDOSCOPY
      ),
      foreignBodyCodes: readConfigCodes(
        config.foreignBodyCodes,
        DEFAULT_FOREIGN_BODY
      ),
    },
  };
}

async function findRule() {
  const result = await db.query<RuleRecord>(
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

  return result.rows[0] ?? null;
}

// ======================================================
// GET /api/catalog/ent-foreign-body
// ======================================================

router.get(
  "/",
  async (_req: Request, res: Response) => {
    try {
      const rule = await findRule();

      if (!rule) {
        res.status(404).json({
          success: false,
          message:
            "Chưa đăng ký rule ENT_FOREIGN_BODY_COMBINED_PAYMENT.",
        });
        return;
      }

      res.json({
        success: true,
        data: formatRule(rule),
      });
    } catch (error) {
      console.error(
        "[ENT FOREIGN BODY] Load config error:",
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
// PUT /api/catalog/ent-foreign-body
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
          message: "Dữ liệu cấu hình không hợp lệ.",
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
      ).toUpperCase();

      if (
        severity !== "WARNING" &&
        severity !== "ERROR"
      ) {
        res.status(400).json({
          success: false,
          message:
            "Mức cảnh báo chỉ được chọn WARNING hoặc ERROR.",
        });
        return;
      }

      let endoscopyCodes: string[];
      let foreignBodyCodes: string[];

      try {
        endoscopyCodes = normalizeCodes(
          body.endoscopyCodes
        );

        foreignBodyCodes = normalizeCodes(
          body.foreignBodyCodes
        );
      } catch (error) {
        res.status(400).json({
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "Danh sách mã DVKT không hợp lệ.",
        });
        return;
      }

      if (
        endoscopyCodes.length === 0 ||
        foreignBodyCodes.length === 0
      ) {
        res.status(400).json({
          success: false,
          message:
            "Phải có ít nhất một mã DVKT cho mỗi nhóm.",
        });
        return;
      }

      const endoscopySet = new Set(endoscopyCodes);

      const overlappingCodes = foreignBodyCodes.filter(
        (code) => endoscopySet.has(code)
      );

      if (overlappingCodes.length > 0) {
        res.status(400).json({
          success: false,
          message:
            "Một mã DVKT không được nằm trong cả hai nhóm: " +
            overlappingCodes.join(", "),
        });
        return;
      }

      const configPatch = {
        topicCode: "TINH.DV.107",
        rejectionCode: "S.005.655",
        treatmentGroup: "GENERAL",
        endoscopyCodes,
        foreignBodyCodes,
      };

      const updated = await db.query<RuleRecord>(
        `
        UPDATE validation.rules
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
          body.enabled,
          severity,
          JSON.stringify(configPatch),
        ]
      );

      const rule = updated.rows[0];

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
        message: "Đã lưu cấu hình TINH.DV.107.",
        data: formatRule(rule),
      });
    } catch (error) {
      console.error(
        "[ENT FOREIGN BODY] Save config error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Không thể lưu cấu hình quy luật.",
      });
    }
  }
);

export default router;
