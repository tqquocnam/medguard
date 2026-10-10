import type {
  Request,
  Response,
} from "express";

import {
  createExaminationService,
  deleteExaminationService,
  getExaminationService,
  listExaminationServices,
  updateExaminationService,
} from "./examination-service.service.js";


// ======================================================
// HELPERS
// ======================================================

function getQueryText(
  value:
    unknown
):
string |
undefined {

  if (
    typeof value ===
    "string"
  ) {

    const text =
      value.trim();


    return (
      text ||
      undefined
    );
  }


  if (
    Array.isArray(
      value
    ) &&
    typeof value[0] ===
      "string"
  ) {

    const text =
      value[0].trim();


    return (
      text ||
      undefined
    );
  }


  return undefined;
}


function getActiveQuery(
  value:
    unknown
):
boolean |
undefined {

  const text =
    getQueryText(
      value
    );


  if (
    text ===
    "true"
  ) {

    return true;
  }


  if (
    text ===
    "false"
  ) {

    return false;
  }


  return undefined;
}


// ======================================================
// LIST
//
// GET /api/catalog/examination-services
// ======================================================

export async function getExaminationServices(
  req:
    Request,

  res:
    Response
) {

  try {

    const rawPage =
      Number(
        getQueryText(
          req.query.page
        ) ??
        1
      );


    const page =
      Number.isInteger(
        rawPage
      )
        ? Math.max(
            1,
            rawPage
          )
        : 1;


    const rawPageSize =
      Number(
        getQueryText(
          req.query.pageSize
        ) ??
        10
      );


    const pageSize =
      Number.isInteger(
        rawPageSize
      )
        ? Math.min(
            100,
            Math.max(
              1,
              rawPageSize
            )
          )
        : 10;


    const result =
      await listExaminationServices({
        code:
          getQueryText(
            req.query.code
          ),

        name:
          getQueryText(
            req.query.name
          ),

        active:
          getActiveQuery(
            req.query.active
          ),

        limit:
          pageSize,

        offset:
          (
            page -
            1
          ) *
          pageSize,
      });


    res.status(
      200
    ).json({
      success:
        true,

      data: {
        items:
          result.items,

        total:
          result.total,

        page,

        pageSize,
      },
    });

  } catch (
    error
  ) {

    console.error(
      "Get examination services error:",
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
          : "Không thể tải danh mục công khám.",
    });
  }
}


// ======================================================
// GET ONE
//
// GET /api/catalog/examination-services/:code
// ======================================================

export async function getExaminationServiceByCode(
  req:
    Request,

  res:
    Response
) {

  try {

    const code =
      String(
        req.params.code ??
        ""
      ).trim();


    const result =
      await getExaminationService(
        code
      );


    if (
      !result
    ) {

      res.status(
        404
      ).json({
        success:
          false,

        message:
          "Không tìm thấy công khám.",
      });

      return;
    }


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

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể tải công khám.",
    });
  }
}


// ======================================================
// CREATE
//
// POST /api/catalog/examination-services
// ======================================================

export async function addExaminationService(
  req:
    Request,

  res:
    Response
) {

  try {

    const result =
      await createExaminationService(
        req.body ??
        {}
      );


    res.status(
      201
    ).json({
      success:
        true,

      message:
        "Thêm công khám thành công.",

      data:
        result,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể thêm công khám.",
    });
  }
}


// ======================================================
// UPDATE
//
// PUT /api/catalog/examination-services/:code
// ======================================================

export async function editExaminationService(
  req:
    Request,

  res:
    Response
) {

  try {

    const code =
      String(
        req.params.code ??
        ""
      ).trim();


    const result =
      await updateExaminationService(
        code,
        req.body ??
        {}
      );


    res.status(
      200
    ).json({
      success:
        true,

      message:
        "Cập nhật công khám thành công.",

      data:
        result,
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể cập nhật công khám.",
    });
  }
}


// ======================================================
// DISABLE
//
// DELETE /api/catalog/examination-services/:code
// ======================================================

export async function removeExaminationService(
  req:
    Request,

  res:
    Response
) {

  try {

    const code =
      String(
        req.params.code ??
        ""
      ).trim();


    await deleteExaminationService(
      code
    );


    res.status(
      200
    ).json({
      success:
        true,

      message:
        "Đã ngừng sử dụng công khám.",
    });

  } catch (
    error
  ) {

    res.status(
      400
    ).json({
      success:
        false,

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể ngừng sử dụng công khám.",
    });
  }
}