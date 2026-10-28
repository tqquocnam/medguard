
import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../../config/database.js";

// ======================================================
// ROUTER
// ======================================================

const router = Router();

// ======================================================
// TYPES
// ======================================================

interface ServiceIcdRule {
  id: string;
  service_code: string;
  icd_code: string;
  allowed: boolean;
  active: boolean;
  note: string | null;
  created_at: Date | string;
}

interface RuleInput {
  service_code: string;
  icd_code: string;
  allowed: boolean;
  active: boolean;
  note: string | null;
}

interface RequestBody {
  service_code?: unknown;
  serviceCode?: unknown;
  icd_code?: unknown;
  icdCode?: unknown;
  allowed?: unknown;
  active?: unknown;
  note?: unknown;
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// ======================================================
// HELPERS
// ======================================================

function normalizeCode(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toUpperCase();
}

function parseBoolean(
  value: unknown,
  defaultValue: boolean
): boolean {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new ValidationError(
    "Giá trị trạng thái phải là true hoặc false."
  );
}

function normalizeBody(body: RequestBody): RuleInput {
  const service_code = normalizeCode(
    body.service_code ?? body.serviceCode
  );

  const icd_code = normalizeCode(
    body.icd_code ?? body.icdCode
  );

  if (!service_code || !icd_code) {
    throw new ValidationError(
      "Vui lòng nhập mã DVKT và mã ICD."
    );
  }

  if (service_code.length > 100) {
    throw new ValidationError(
      "Mã DVKT không được vượt quá 100 ký tự."
    );
  }

  if (icd_code.length > 100) {
    throw new ValidationError(
      "Mã ICD không được vượt quá 100 ký tự."
    );
  }

  if (
    body.note !== null &&
    body.note !== undefined &&
    typeof body.note !== "string"
  ) {
    throw new ValidationError(
      "Ghi chú phải là chuỗi ký tự."
    );
  }

  const note =
    typeof body.note === "string"
      ? body.note.trim() || null
      : null;

  if (note && note.length > 2000) {
    throw new ValidationError(
      "Ghi chú không được vượt quá 2000 ký tự."
    );
  }

  return {
    service_code,
    icd_code,
    allowed: parseBoolean(body.allowed, true),
    active: parseBoolean(body.active, false),
    note,
  };
}

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getId(req: Request): string {
  const id = String(req.params.id ?? "");

  if (!validUuid(id)) {
    throw new ValidationError("ID quy tắc không hợp lệ.");
  }

  return id;
}

function getBody(req: Request): RequestBody {
  const body: unknown = req.body;

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw new ValidationError(
      "Dữ liệu gửi lên không hợp lệ."
    );
  }

  return body as RequestBody;
}

function handleError(
  res: Response,
  error: unknown
): Response {
  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  const databaseError = error as {
    code?: string;
    message?: string;
  } | null;

  const code = databaseError?.code;

  if (code === "23505") {
    return res.status(409).json({
      success: false,
      message: "Cặp DVKT - ICD đã tồn tại.",
    });
  }

  if (code === "22P02") {
    return res.status(400).json({
      success: false,
      message: "Dữ liệu hoặc ID không hợp lệ.",
    });
  }

  if (code === "23502" || code === "23503") {
    return res.status(400).json({
      success: false,
      message: "Dữ liệu không đáp ứng ràng buộc database.",
    });
  }

  console.error("Service ICD error:", error);

  return res.status(500).json({
    success: false,
    message: "Lỗi xử lý danh mục DVKT - ICD.",
  });
}

// ======================================================
// GET - DANH SÁCH DVKT - ICD
//
// GET /api/catalog/service-icd-rules
// ======================================================

router.get(
  "/",
  async (req: Request, res: Response) => {
    try {
      const querySearch = req.query.search;

      const search =
        typeof querySearch === "string"
          ? querySearch.trim()
          : "";

      const result = await db.query(
        `
        SELECT
          id,
          service_code,
          icd_code,
          allowed,
          active,
          note,
          created_at
        FROM catalog.service_icd_rules
        WHERE (
          $1 = ''
          OR service_code ILIKE '%' || $1 || '%'
          OR icd_code ILIKE '%' || $1 || '%'
          OR COALESCE(note, '') ILIKE '%' || $1 || '%'
        )
        ORDER BY
          created_at DESC NULLS LAST,
          id
        `,
        [search]
      );

      const rows = result.rows as ServiceIcdRule[];

      return res.json({
        success: true,
        data: rows,
        total: rows.length,
      });
    } catch (error: unknown) {
      return handleError(res, error);
    }
  }
);

// ======================================================
// POST - THÊM QUY TẮC
//
// POST /api/catalog/service-icd-rules
// ======================================================

router.post(
  "/",
  async (req: Request, res: Response) => {
    try {
      const data = normalizeBody(getBody(req));

      const existing = await db.query(
        `
        SELECT id
        FROM catalog.service_icd_rules
        WHERE service_code = $1
          AND icd_code = $2
        LIMIT 1
        `,
        [data.service_code, data.icd_code]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Cặp DVKT - ICD đã tồn tại.",
        });
      }

      const result = await db.query(
        `
        INSERT INTO catalog.service_icd_rules (
          service_code,
          icd_code,
          allowed,
          active,
          note
        )
        VALUES (
          $1, $2, $3, $4, $5
        )
        RETURNING *
        `,
        [
          data.service_code,
          data.icd_code,
          data.allowed,
          data.active,
          data.note,
        ]
      );

      return res.status(201).json({
        success: true,
        message: "Thêm quy tắc DVKT - ICD thành công.",
        data: result.rows[0],
      });
    } catch (error: unknown) {
      return handleError(res, error);
    }
  }
);

// ======================================================
// PUT - CẬP NHẬT QUY TẮC
//
// PUT /api/catalog/service-icd-rules/:id
// ======================================================

router.put(
  "/:id",
  async (req: Request, res: Response) => {
    try {
      const id = getId(req);
      const data = normalizeBody(getBody(req));

      const result = await db.query(
        `
        UPDATE catalog.service_icd_rules
        SET
          service_code = $1,
          icd_code = $2,
          allowed = $3,
          active = $4,
          note = $5
        WHERE id = $6
        RETURNING *
        `,
        [
          data.service_code,
          data.icd_code,
          data.allowed,
          data.active,
          data.note,
          id,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy quy tắc DVKT - ICD.",
        });
      }

      return res.json({
        success: true,
        message: "Cập nhật quy tắc thành công.",
        data: result.rows[0],
      });
    } catch (error: unknown) {
      return handleError(res, error);
    }
  }
);

// ======================================================
// PATCH - BẬT / TẮT QUY TẮC
//
// PATCH /api/catalog/service-icd-rules/:id/toggle-active
// ======================================================

router.patch(
  "/:id/toggle-active",
  async (req: Request, res: Response) => {
    try {
      const id = getId(req);

      const result = await db.query(
        `
        UPDATE catalog.service_icd_rules
        SET active = NOT active
        WHERE id = $1
        RETURNING *
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy quy tắc DVKT - ICD.",
        });
      }

      return res.json({
        success: true,
        message: "Đã thay đổi trạng thái quy tắc.",
        data: result.rows[0],
      });
    } catch (error: unknown) {
      return handleError(res, error);
    }
  }
);

// ======================================================
// DELETE - XÓA QUY TẮC
//
// DELETE /api/catalog/service-icd-rules/:id
// ======================================================

router.delete(
  "/:id",
  async (req: Request, res: Response) => {
    try {
      const id = getId(req);

      const result = await db.query(
        `
        DELETE FROM catalog.service_icd_rules
        WHERE id = $1
        RETURNING id
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy quy tắc DVKT - ICD.",
        });
      }

      return res.json({
        success: true,
        message: "Đã xóa quy tắc DVKT - ICD.",
        data: result.rows[0],
      });
    } catch (error: unknown) {
      return handleError(res, error);
    }
  }
);

// ======================================================
// EXPORT
// ======================================================

export default router;
