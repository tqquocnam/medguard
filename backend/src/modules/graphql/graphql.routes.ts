import { Router, type Response } from "express";

import { requireAuth, type AuthRequest } from "../auth/auth.middleware.js";

const router = Router();

router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  res.setHeader("Cache-Control", "no-store");

  if (!req.user?.branchId) {
    res.status(403).json({
      errors: [
        {
          message: "Tài khoản chưa được xác định chi nhánh.",
        },
      ],
    });

    return;
  }

  const query = req.body?.query;
  const variables = req.body?.variables;
  const operationName = req.body?.operationName;

  if (typeof query !== "string" || !query.trim()) {
    res.status(400).json({
      errors: [
        {
          message: "Thiếu GraphQL query hợp lệ.",
        },
      ],
    });

    return;
  }

  if (
    (variables != null && (typeof variables !== "object" || Array.isArray(variables))) ||
    (operationName != null && typeof operationName !== "string")
  ) {
    res.status(400).json({
      errors: [
        {
          message: "GraphQL variables hoặc operationName không hợp lệ.",
        },
      ],
    });

    return;
  }

  const hasuraUrl = process.env.HASURA_GRAPHQL_URL || "http://localhost:8080/v1/graphql";

  const adminSecret = process.env.HASURA_ADMIN_SECRET;

  if (!adminSecret) {
    console.error("HASURA_ADMIN_SECRET chưa được cấu hình.");

    res.status(500).json({
      errors: [
        {
          message: "Hệ thống chưa cấu hình kết nối Hasura.",
        },
      ],
    });

    return;
  }

  try {
    // Mọi tài khoản đều dùng cùng quyền Hasura.
    // Chi nhánh lấy từ tài khoản đã xác thực.
    // Không chuyển tiếp role hoặc chi nhánh
    // do trình duyệt tự gửi lên.
    const response = await fetch(hasuraUrl, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        "x-hasura-admin-secret": adminSecret,

        "x-hasura-role": "branch_admin",

        "x-hasura-user-id": req.user.id,

        "x-hasura-branch-id": req.user.branchId,
      },

      body: JSON.stringify({
        query,
        variables,
        operationName,
      }),

      signal: AbortSignal.timeout(30_000),
    });

    const body = await response.text();

    res.status(response.status);

    res.setHeader("Content-Type", response.headers.get("content-type") || "application/json");

    res.send(body);
  } catch (error) {
    console.error("GraphQL proxy error:", error);

    res.status(502).json({
      errors: [
        {
          message: "Không thể kết nối Hasura. Vui lòng thử lại.",
        },
      ],
    });
  }
});

export default router;
