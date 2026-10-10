import type {
  Request,
  Response,
} from "express";

import {
  importServicesFromExcel,
  ServiceImportValidationError,
} from "./service-import.service.js";


// ======================================================
// IMPORT DVKT EXCEL
// ======================================================

export async function importServicesExcel(
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


    const fileName =
      String(
        req.file.originalname ??
        ""
      ).toLowerCase();


    if (
      !fileName.endsWith(
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
      await importServicesFromExcel(
        req.file.buffer
      );


    res.status(
      200
    ).json({
      success:
        true,

      message:
        `Import thành công ${result.totalRows} DVKT.`,

      data:
        result,
    });

  } catch (
    error
  ) {

    if (
      error instanceof
      ServiceImportValidationError
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
      "Import services Excel error:",
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
          : "Import DVKT thất bại.",
    });
  }
}