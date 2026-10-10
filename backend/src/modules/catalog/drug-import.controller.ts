import type {
  Request,
  Response,
} from "express";

import {
  DrugImportValidationError,
  importDrugsFromExcel,
} from "./drug-import.service.js";


// ======================================================
// IMPORT DRUG EXCEL
//
// POST /api/catalog/drugs/import
// form-data:
// file = *.xlsx
// ======================================================

export async function importDrugsExcel(
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
      await importDrugsFromExcel(
        req.file.buffer
      );


    res.status(
      200
    ).json({
      success:
        true,

      message:
        `Import thành công ${result.totalRows} thuốc.`,

      data:
        result,
    });

  } catch (
    error
  ) {

    if (
      error instanceof
      DrugImportValidationError
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
      "Import drugs error:",
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
          : "Import thuốc thất bại.",
    });
  }
}