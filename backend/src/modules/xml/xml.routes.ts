import {
  Router,
} from "express";

import multer
  from "multer";

import {
  uploadXml,
  analyzeXml,
  importProgress,
} from "./xml.controller.js";

import {
  requireAuth,
} from "../auth/auth.middleware.js";


const router =
  Router();


// ======================================================
// MULTER
// ======================================================
//
// File được giữ trong RAM.
// Giới hạn tối đa: 50 MB.
//
// ======================================================

const upload =
  multer({

    storage:
      multer.memoryStorage(),

    limits: {

      fileSize:
        50 *
        1024 *
        1024,
    },
  });


// ======================================================
// PHÂN TÍCH FILE XML
// ======================================================
//
// ADMIN ✅
// USER  ✅
//
// Chưa đăng nhập ❌
//
// Chỉ parse + validate.
// KHÔNG ghi dữ liệu vào DB.
//
// ======================================================

router.post(
  "/analyze",

  requireAuth,

  upload.single(
    "file"
  ),

  analyzeXml
);


// ======================================================
// IMPORT XML VÀO DATABASE
// ======================================================
//
// ADMIN ✅
// USER  ✅
//
// Chưa đăng nhập ❌
//
// Backend vẫn phải validate lại
// trước khi import thật.
//
// ======================================================

router.post(
  "/upload",

  requireAuth,

  upload.single(
    "file"
  ),

  uploadXml
);


// ======================================================
// THEO DÕI TIẾN TRÌNH IMPORT
// ======================================================
//
// ADMIN ✅
// USER  ✅
//
// Chưa đăng nhập ❌
//
// ======================================================

router.get(
  "/import-progress/:importId",

  requireAuth,

  importProgress
);


export default router;