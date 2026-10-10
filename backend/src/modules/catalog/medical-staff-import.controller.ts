import type {
  Request,
  Response,
} from "express";

import {
  importMedicalStaffFromExcel,
  MedicalStaffImportValidationError,
} from "./medical-staff-import.service.js";


// ======================================================
// IMPORT MEDICAL STAFF
// ======================================================

export async function importMedicalStaffExcel(
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
      await importMedicalStaffFromExcel(
        req.file.buffer
      );


    res.status(
      200
    ).json({
      success:
        true,

      message:
        `Import thành công ${result.totalRows} nhân viên y tế.`,

      data:
        result,
    });

  } catch (
    error
  ) {

    if (
      error instanceof
      MedicalStaffImportValidationError
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
      "Import medical staff Excel error:",
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
          : "Import nhân viên y tế thất bại.",
    });
  }
}