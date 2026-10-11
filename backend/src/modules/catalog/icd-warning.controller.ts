import type {
  Request,
  Response,
} from "express";

import {
  getIcdWarnings,
  createIcdWarning,
  updateIcdWarning,
  toggleIcdWarningActive,
} from "./icd-warning.service.js";


// ======================================================
// GET ICD WARNING LIST
//
// GET /api/catalog/icd-warnings
// ======================================================

export async function getIcdWarningsList(
  req: Request,
  res: Response
) {

  try {

    const result =
      await getIcdWarnings({
        page:
          Number(
            req.query.page ??
            1
          ),

        pageSize:
          Number(
            req.query.pageSize ??
            10
          ),

        icdCode:
          String(
            req.query.icdCode ??
            ""
          ),

        errorCode:
          String(
            req.query.errorCode ??
            ""
          ),

        diseaseName:
          String(
            req.query.diseaseName ??
            ""
          ),
      });


    res.status(
      200
    ).json({
      success:
        true,

      data:
        result,
    });

  } catch (
    error
  ) {

    console.error(
      "Get ICD warnings error:",
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
          : "Không thể tải danh mục ICD cảnh báo.",
    });
  }
}


// ======================================================
// CREATE ICD WARNING
//
// POST /api/catalog/icd-warnings
// ======================================================

export async function createIcdWarningController(
  req: Request,
  res: Response
) {

  try {

    const {
      icdCode,
      errorCode,
      diseaseName,
      errorMessage,
      active,
      note,
    } =
      req.body ??
      {};


    const result =
      await createIcdWarning({
        icdCode:
          String(
            icdCode ??
            ""
          ),

        errorCode:
          String(
            errorCode ??
            ""
          ),

        diseaseName:
          diseaseName ===
            null ||
          diseaseName ===
            undefined
            ? null
            : String(
                diseaseName
              ),

        errorMessage:
          String(
            errorMessage ??
            ""
          ),

        active:
          typeof active ===
          "boolean"
            ? active
            : true,

        note:
          note ===
            null ||
          note ===
            undefined
            ? null
            : String(
                note
              ),
      });


    res.status(
      201
    ).json({
      success:
        true,

      message:
        "Thêm ICD cảnh báo thành công.",

      data:
        result,
    });

  } catch (
    error
  ) {

    console.error(
      "Create ICD warning error:",
      error
    );


    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể thêm ICD cảnh báo.",
    });
  }
}


// ======================================================
// UPDATE ICD WARNING
//
// PUT /api/catalog/icd-warnings/:id
// ======================================================

export async function updateIcdWarningController(
  req: Request,
  res: Response
) {

  try {

    const id =
      String(
        req.params.id ??
        ""
      );


    const {
      icdCode,
      errorCode,
      diseaseName,
      errorMessage,
      active,
      note,
    } =
      req.body ??
      {};


    const result =
      await updateIcdWarning(
        id,
        {
          icdCode:
            String(
              icdCode ??
              ""
            ),

          errorCode:
            String(
              errorCode ??
              ""
            ),

          diseaseName:
            diseaseName ===
              null ||
            diseaseName ===
              undefined
              ? null
              : String(
                  diseaseName
                ),

          errorMessage:
            String(
              errorMessage ??
              ""
            ),

          active:
            typeof active ===
            "boolean"
              ? active
              : undefined,

          note:
            note ===
              null ||
            note ===
              undefined
              ? null
              : String(
                  note
                ),
        }
      );


    res.status(
      200
    ).json({
      success:
        true,

      message:
        "Cập nhật ICD cảnh báo thành công.",

      data:
        result,
    });

  } catch (
    error
  ) {

    console.error(
      "Update ICD warning error:",
      error
    );


    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể cập nhật ICD cảnh báo.",
    });
  }
}


// ======================================================
// TOGGLE ICD WARNING ACTIVE
//
// PATCH /api/catalog/icd-warnings/:id/toggle-active
// ======================================================

export async function toggleIcdWarningActiveController(
  req: Request,
  res: Response
) {

  try {

    const id =
      String(
        req.params.id ??
        ""
      );


    const result =
      await toggleIcdWarningActive(
        id
      );


    res.status(
      200
    ).json({
      success:
        true,

      message:
        result.active
          ? "Đã kích hoạt ICD cảnh báo."
          : "Đã ngừng sử dụng ICD cảnh báo.",

      data:
        result,
    });

  } catch (
    error
  ) {

    console.error(
      "Toggle ICD warning active error:",
      error
    );


    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể thay đổi trạng thái ICD cảnh báo.",
    });
  }
}