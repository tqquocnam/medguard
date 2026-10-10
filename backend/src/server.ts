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
  ) ||
  3000;


// ======================================================
// TRUST PROXY
// ======================================================
//
// Backend đang chạy sau Cloudflare Tunnel.
//
// ======================================================

app.set(
  "trust proxy",
  1
);


// ======================================================
// CORS
// ======================================================

const allowedOrigins =
  [
    "http://localhost:5173",

    "https://medguard-beta.vercel.app",
  ];


app.use(
  cors({
    origin: (
      origin,
      callback
    ) => {
      // Cho phép request không có Origin:
      // Postman, health check, server-to-server...
      if (
        !origin
      ) {
        callback(
          null,
          true
        );

        return;
      }


      if (
        allowedOrigins.includes(
          origin
        )
      ) {
        callback(
          null,
          true
        );

        return;
      }


      // Cho phép preview deployment của project MedGuard trên Vercel.
      //
      // Ví dụ:
      // https://medguard-xxxxx-tqquocnams-projects.vercel.app

      const isMedGuardVercelPreview =
        /^https:\/\/medguard(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(
          origin
        ) ||
        /^https:\/\/medguard-[a-z0-9-]+-tqquocnams-projects\.vercel\.app$/i.test(
          origin
        );


      if (
        isMedGuardVercelPreview
      ) {
        callback(
          null,
          true
        );

        return;
      }


      console.warn(
        "CORS blocked origin:",
        origin
      );


      callback(
        new Error(
          `Origin không được phép: ${origin}`
        )
      );
    },

    credentials:
      true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
    ],

    exposedHeaders: [
      "Content-Type",
    ],

    optionsSuccessStatus:
      204,
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
        .status(
          500
        )
        .json({
          success:
            false,

          database:
            "disconnected",

          message:
            error instanceof Error
              ? error.message
              : "Database error",
        });
    }
  }
);


// ======================================================
// AUTH
// ======================================================

app.use(
  "/api/auth",
  authRoutes
);


// ======================================================
// GRAPHQL PROXY
// ======================================================

app.use(
  "/api/graphql",
  graphqlRoutes
);


// ======================================================
// DASHBOARD
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
// REPORTS
// ======================================================

app.use(
  "/api/reports",
  reportsRoutes
);


// ======================================================
// 404
// ======================================================

app.use(
  (
    req,
    res
  ) => {
    res
      .status(
        404
      )
      .json({
        success:
          false,

        message:
          `Không tìm thấy API ${req.method} ${req.originalUrl}`,
      });
  }
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

    console.log(
      "Allowed frontend origins:",
      allowedOrigins
    );
  }
);