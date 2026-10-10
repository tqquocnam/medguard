import {
  Router,
  type Response,
} from "express";

import {
  Kind,
  parse,
} from "graphql";

import {
  requireAuth,
  type AuthRequest,
} from "../auth/auth.middleware.js";


const router =
  Router();


// ======================================================
// KIỂM TRA GRAPHQL QUERY CỦA USER
// ======================================================
//
// ADMIN:
// - query
// - mutation
//
// USER:
// - chỉ query
// - không mutation
// - không subscription
// - không introspection
//
// ======================================================

function checkUserGraphql(
  query: string
): {
  allowed: boolean;
  message?: string;
} {

  try {

    const document =
      parse(query);


    for (
      const definition
      of document.definitions
    ) {

      if (
        definition.kind !==
        Kind.OPERATION_DEFINITION
      ) {

        continue;
      }


      // ==================================================
      // USER CHỈ ĐƯỢC QUERY
      // ==================================================

      if (
        definition.operation !==
        "query"
      ) {

        return {
          allowed: false,

          message:
            "Tài khoản USER chỉ được phép đọc dữ liệu.",
        };
      }


      // ==================================================
      // KHÔNG CHO USER DÙNG INTROSPECTION
      // ==================================================

      for (
        const selection
        of definition.selectionSet.selections
      ) {

        if (
          selection.kind !==
          Kind.FIELD
        ) {

          continue;
        }


        const fieldName =
          selection.name.value;


        if (
          fieldName.startsWith(
            "__"
          )
        ) {

          return {
            allowed: false,

            message:
              "Tài khoản USER không được phép truy vấn cấu trúc GraphQL.",
          };
        }
      }
    }


    return {
      allowed: true,
    };

  } catch {

    return {
      allowed: false,

      message:
        "GraphQL query không hợp lệ.",
    };
  }
}


// ======================================================
// GRAPHQL PROXY
// ======================================================
//
// Browser
//    │
//    │ medguard_token
//    ▼
//
// Backend MedGuard
//    │
//    │ requireAuth
//    │ kiểm tra ADMIN / USER
//    ▼
//
// Hasura
//    │
//    │ ADMIN:
//    │ x-hasura-admin-secret
//    │
//    │ USER:
//    │ x-hasura-admin-secret
//    │ x-hasura-role: user
//    │ x-hasura-user-id: UUID
//    ▼
//
// PostgreSQL
//
// ======================================================

router.post(
  "/",
  requireAuth,

  async (
    req: AuthRequest,
    res: Response
  ) => {

    try {

      // ==================================================
      // 1. KIỂM TRA ĐĂNG NHẬP
      // ==================================================

      if (
        !req.user
      ) {

        res
          .status(401)
          .json({
            errors: [
              {
                message:
                  "Bạn chưa đăng nhập.",
              },
            ],
          });

        return;
      }


      // ==================================================
      // 2. LẤY GRAPHQL QUERY
      // ==================================================

      const query =
        String(
          req.body?.query ??
          ""
        );


      if (!query) {

        res
          .status(400)
          .json({
            errors: [
              {
                message:
                  "Thiếu GraphQL query.",
              },
            ],
          });

        return;
      }


      // ==================================================
      // 3. KIỂM TRA ROLE
      // ==================================================

      const isAdmin =
        req.user.role ===
        "ADMIN";


      // ==================================================
      // 4. USER CHỈ ĐƯỢC QUERY
      // ==================================================

      if (!isAdmin) {

        const check =
          checkUserGraphql(
            query
          );


        if (
          !check.allowed
        ) {

          res
            .status(403)
            .json({
              errors: [
                {
                  message:
                    check.message ||
                    "Bạn không có quyền thực hiện thao tác này.",
                },
              ],
            });

          return;
        }
      }


      // ==================================================
      // 5. HASURA CONFIG
      // ==================================================

      const hasuraUrl =
        process.env
          .HASURA_GRAPHQL_URL ||
        "http://localhost:8080/v1/graphql";


      const adminSecret =
        process.env
          .HASURA_ADMIN_SECRET;


      if (
        !adminSecret
      ) {

        console.error(
          "HASURA_ADMIN_SECRET chưa được cấu hình."
        );


        res
          .status(500)
          .json({
            errors: [
              {
                message:
                  "Backend chưa cấu hình HASURA_ADMIN_SECRET.",
              },
            ],
          });

        return;
      }


      // ==================================================
      // 6. TẠO HEADER GỬI SANG HASURA
      // ==================================================

      const hasuraHeaders:
        Record<
          string,
          string
        > = {

          "Content-Type":
            "application/json",

          "x-hasura-admin-secret":
            adminSecret,
        };


      // ==================================================
      // 7. USER -> ÉP HASURA CHẠY ROLE user
      // ==================================================
      //
      // Mặc dù backend biết admin secret,
      // USER vẫn phải chạy theo Hasura Permission.
      //
      // ==================================================

      if (!isAdmin) {

        hasuraHeaders[
          "x-hasura-role"
        ] =
          "user";


        hasuraHeaders[
          "x-hasura-user-id"
        ] =
          String(
            req.user.id
          );
      }


      // ==================================================
      // 8. GỬI REQUEST SANG HASURA
      // ==================================================

      const response =
        await fetch(
          hasuraUrl,
          {
            method:
              "POST",

            headers:
              hasuraHeaders,

            body:
              JSON.stringify({
                query:
                  req.body.query,

                variables:
                  req.body.variables ??
                  undefined,

                operationName:
                  req.body.operationName ??
                  undefined,
              }),
          }
        );


      // ==================================================
      // 9. NHẬN RESPONSE TỪ HASURA
      // ==================================================

      const responseText =
        await response.text();


      // ==================================================
      // 10. TRẢ RESPONSE VỀ FRONTEND
      // ==================================================

      res.status(
        response.status
      );


      res.setHeader(
        "Content-Type",
        response.headers.get(
          "content-type"
        ) ||
        "application/json"
      );


      res.send(
        responseText
      );

    } catch (
      error
    ) {

      console.error(
        "GraphQL proxy error:",
        error
      );


      res
        .status(500)
        .json({
          errors: [
            {
              message:
                error instanceof Error
                  ? error.message
                  : "Không thể kết nối Hasura.",
            },
          ],
        });
    }
  }
);


export default router;