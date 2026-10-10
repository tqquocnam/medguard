import type {
  Request,
  Response,
} from "express";

import {

  listStaffSchedules,

  createStaffSchedule,

  updateStaffSchedule,

  deleteStaffSchedule,

  generateDefaultSchedule,

} from "./staff-schedule.service.js";


// ======================================================
// LIST
// ======================================================

export async function getStaffSchedules(
  req:
    Request,

  res:
    Response
) {

  try {

    const page =
      Math.max(
        Number(
          req.query.page ??
          1
        ),
        1
      );


    const pageSize =
      Math.min(
        Math.max(
          Number(
            req.query.pageSize ??
            50
          ),
          1
        ),
        500
      );


    const result =
      await listStaffSchedules({

        staffId:
          req.query.staffId
            ? String(
                req.query.staffId
              )
            : undefined,

        year:
          req.query.year
            ? Number(
                req.query.year
              )
            : undefined,

        month:
          req.query.month
            ? Number(
                req.query.month
              )
            : undefined,

        status:
          req.query.status
            ? String(
                req.query.status
              )
            : undefined,

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

        ...result,

        page,

        pageSize,

      },

    });

  } catch (
    error
  ) {

    res.status(
      500
    ).json({

      success:
        false,

      message:
        error instanceof
        Error

          ? error.message

          : "Không thể tải lịch làm việc.",

    });

  }

}


// ======================================================
// CREATE
// ======================================================

export async function addStaffSchedule(
  req:
    Request,

  res:
    Response
) {

  try {

    const result =
      await createStaffSchedule(
        req.body ??
        {}
      );


    res.status(
      201
    ).json({

      success:
        true,

      message:
        "Thêm lịch làm việc thành công.",

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

          : "Không thể thêm lịch làm việc.",

    });

  }

}


// ======================================================
// UPDATE
// ======================================================

export async function editStaffSchedule(
  req:
    Request,

  res:
    Response
) {

  try {

    const id =
      String(
        req.params.id ??
        ""
      );


    const result =
      await updateStaffSchedule(
        id,
        req.body ??
        {}
      );


    res.status(
      200
    ).json({

      success:
        true,

      message:
        "Cập nhật lịch làm việc thành công.",

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

          : "Không thể cập nhật lịch làm việc.",

    });

  }

}


// ======================================================
// DELETE
// ======================================================

export async function removeStaffSchedule(
  req:
    Request,

  res:
    Response
) {

  try {

    const id =
      String(
        req.params.id ??
        ""
      );


    await deleteStaffSchedule(
      id
    );


    res.status(
      200
    ).json({

      success:
        true,

      message:
        "Xóa lịch làm việc thành công.",

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

          : "Không thể xóa lịch làm việc.",

    });

  }

}


// ======================================================
// GENERATE DEFAULT
// ======================================================

export async function generateDefaultStaffSchedule(
  req:
    Request,

  res:
    Response
) {

  try {

    const result =
      await generateDefaultSchedule({

        staffId:
          String(
            req.body
              ?.staffId ??
            ""
          ),

        year:
          Number(
            req.body
              ?.year
          ),

        month:
          Number(
            req.body
              ?.month
          ),

      });


    res.status(
      200
    ).json({

      success:
        true,

      message:
        `Tạo lịch mặc định thành công: ${result.inserted} ngày, bỏ qua ${result.skipped} ngày đã có lịch.`,

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

          : "Không thể tạo lịch mặc định.",

    });

  }

}