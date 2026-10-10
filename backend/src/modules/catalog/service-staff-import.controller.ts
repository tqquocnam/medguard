import type {
  Request,
  Response,
} from "express";

import {
  createServiceStaffTemplate,
  importServiceStaffExcel,
  previewServiceStaffImport,
} from "./service-staff-import.service.js";


export async function previewServiceStaffExcel(
  req:
    Request,

  res:
    Response
) {
  try {
    if (
      !req.file
    ) {
      return res
        .status(
          400
        )
        .json({
          success:
            false,

          message:
            "Vui lòng chọn file Excel.",
        });
    }


    const result =
      await previewServiceStaffImport(
        req.file.buffer
      );


    return res.json({
      success:
        true,

      message:
        "Đã kiểm tra file Excel.",

      data:
        result,
    });

  } catch (
    error
  ) {
    console.error(
      "previewServiceStaffExcel error:",
      error
    );


    return res
      .status(
        400
      )
      .json({
        success:
          false,

        message:
          error instanceof
          Error
            ? error.message
            : "Không thể đọc file Excel.",
      });
  }
}


export async function importServiceStaffExcelController(
  req:
    Request,

  res:
    Response
) {
  try {
    if (
      !req.file
    ) {
      return res
        .status(
          400
        )
        .json({
          success:
            false,

          message:
            "Vui lòng chọn file Excel.",
        });
    }


    const result =
      await importServiceStaffExcel(
        req.file.buffer
      );


    return res.json({
      success:
        true,

      message:
        `Import hoàn tất: ${result.inserted} thêm mới, ${result.updated} cập nhật.`,

      data:
        result,
    });

  } catch (
    error
  ) {
    console.error(
      "importServiceStaffExcel error:",
      error
    );


    return res
      .status(
        400
      )
      .json({
        success:
          false,

        message:
          error instanceof
          Error
            ? error.message
            : "Import Excel thất bại.",
      });
  }
}


export async function downloadServiceStaffTemplate(
  _req:
    Request,

  res:
    Response
) {
  try {
    const buffer =
      await createServiceStaffTemplate();


    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );


    res.setHeader(
      "Content-Disposition",
      'attachment; filename="service_staff_template.xlsx"'
    );


    return res.send(
      buffer
    );

  } catch (
    error
  ) {
    console.error(
      "downloadServiceStaffTemplate error:",
      error
    );


    return res
      .status(
        500
      )
      .json({
        success:
          false,

        message:
          "Không thể tạo file mẫu.",
      });
  }
}