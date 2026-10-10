import express
  from "express";

import cors
  from "cors";

import "dotenv/config";

import cookieParser
  from "cookie-parser";

import {
  db,
} from "./config/database.js";


// ======================================================
// ROUTES
// ======================================================

import authRoutes
  from "./modules/auth/auth.routes.js";

import graphqlRoutes
  from "./modules/graphql/graphql.routes.js";

import xmlRoutes
  from "./modules/xml/xml.routes.js";

import eventRoutes
  from "./modules/medical-event/event.routes.js";

import validationRoutes
  from "./modules/validation/validation.routes.js";

import catalogRoutes
  from "./modules/catalog/catalog.routes.js";

import dashboardRoutes
  from "./modules/dashboard/dashboard.routes.js";

import reportsRoutes
  from "./modules/reports/reports.routes.js";  


// ======================================================
// APP
// ======================================================

const app =
  express();


const PORT =
  Number(
    process.env.PORT
  ) || 3000;


// ======================================================
// CORS
// ======================================================
//
// Cho frontend Vite gửi cookie medguard_token.
//
// ======================================================

app.use(
  cors({
    origin:
      "http://localhost:5173",

    credentials:
      true,
  })
);


// ======================================================
// COOKIE
// ======================================================

app.use(
  cookieParser()
);


// ======================================================
// JSON BODY
// ======================================================

app.use(
  express.json({
    limit:
      "50mb",
  })
);

app.use(
  "/api/reports",
  reportsRoutes
);
// ======================================================
// HEALTH CHECK
// ======================================================

app.get(
  "/api/health",

  async (
    _req,
    res
  ) => {

    try {

      const result =
        await db.query(
          "SELECT NOW() AS time"
        );


      res.json({
        success:
          true,

        app:
          "MedGuard",

        service:
          "MedGuard API",

        database:
          "connected",

        databaseTime:
          result.rows[0]
            .time,

        timestamp:
          new Date()
            .toISOString(),
      });

    } catch (
      error
    ) {

      console.error(
        "Health check error:",
        error
      );


      res
        .status(500)
        .json({
          success:
            false,

          database:
            "disconnected",

          message:
            error instanceof
            Error
              ? error.message
              : "Database error",
        });
    }
  }
);


// ======================================================
// AUTH
// ======================================================
//
// /api/auth/login
// /api/auth/me
// /api/auth/logout
// ...
//
// ======================================================

app.use(
  "/api/auth",
  authRoutes
);


// ======================================================
// GRAPHQL PROXY
// ======================================================
//
// Frontend:
//
// POST /api/graphql
//
//        ↓
//
// graphqlRoutes
//
//        ↓
//
// requireAuth
//
//        ↓
//
// ADMIN / USER permissions
//
//        ↓
//
// Hasura
//
// QUAN TRỌNG:
// Không tạo app.post("/api/graphql") lần thứ hai.
//
// ======================================================

app.use(
  "/api/graphql",
  graphqlRoutes
);


// ======================================================
// DASHBOARD
// ======================================================
//
// ADMIN ✅
// USER  ✅
// Chưa login ❌
//
// GET /api/dashboard/summary
//
// ======================================================

app.use(
  "/api/dashboard",
  dashboardRoutes
);


// ======================================================
// XML
// ======================================================

app.use(
  "/api/xml",
  xmlRoutes
);


// ======================================================
// MEDICAL EVENTS
// ======================================================

app.use(
  "/api/events",
  eventRoutes
);


// ======================================================
// VALIDATION
// ======================================================

app.use(
  "/api/checks",
  validationRoutes
);


// ======================================================
// CATALOG
// ======================================================

app.use(
  "/api/catalog",
  catalogRoutes
);


// ======================================================
// START SERVER
// ======================================================

app.listen(
  PORT,
  () => {

    console.log(
      `MedGuard API running at http://localhost:${PORT}`
    );
  }
);