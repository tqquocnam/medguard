import type {
  Request,
  Response,
} from "express";

import {
  IcdWarningImportValidationError,
  importIcdWarningsFromExcel,
} from "./icd-warning-import.service.js";


// ======================================================
// IMPORT ICD WARNING EXCEL
//
// POST /api/catalog/icd-warnings/import
// form-data:
// file = *.xlsx
// ======================================================

export async function importIcdWarningsExcel(
  req:
    Request,

  res:
    Response
) {

  try {

    if (
      !req.file
    ) {

      res.status(
        400
      ).json({
        success:
          false,

        message:
          "Vui lòng chọn file Excel.",
      });

      return;
    }


    const originalName =
      String(
        req.file.originalname ??
        ""
      ).toLowerCase();


    if (
      !originalName.endsWith(
        ".xlsx"
      )
    ) {

      res.status(
        400
      ).json({
        success:
          false,

        message:
          "Chỉ hỗ trợ file Excel .xlsx.",
      });

      return;
    }


    const result =
      await importIcdWarningsFromExcel(
        req.file.buffer
      );


    res.status(
      200
    ).json({
      success:
        true,

      message:
        `Import thành công ${result.totalRows} dòng ICD cảnh báo.`,

      data:
        result,
    });

  } catch (
    error
  ) {

    if (
      error instanceof
      IcdWarningImportValidationError
    ) {

      res.status(
        400
      ).json({
        success:
          false,

        message:
          error.message,

        errors:
          error.errors,
      });

      return;
    }


    console.error(
      "Import ICD warnings error:",
      error
    );


    res.status(
      500
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Import ICD cảnh báo thất bại.",
    });
  }
}