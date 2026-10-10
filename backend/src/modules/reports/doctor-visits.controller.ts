import type {
  Request,
  Response,
} from "express";

import {
  listDoctorVisits,
} from "./doctor-visits.service.js";


export async function getDoctorVisits(
  req:
    Request,
  res:
    Response
) {

  try {

    const page =
      Math.max(
        1,
        Number(
          req.query.page ??
          1
        )
      );


    const pageSize =
      Math.min(
        200,
        Math.max(
          1,
          Number(
            req.query.pageSize ??
            10
          )
        )
      );


    const year =
      req.query.year
        ? Number(
            req.query.year
          )
        : undefined;


    const month =
      req.query.month
        ? Number(
            req.query.month
          )
        : undefined;


    const staffId =
      req.query.staffId
        ? String(
            req.query.staffId
          ).trim()
        : undefined;


    const paymentDate =
      req.query.paymentDate
        ? String(
            req.query.paymentDate
          ).trim()
        : undefined;


    const result =
      await listDoctorVisits({

        staffId,

        year,

        month,

        paymentDate,

        page,

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
      "Get doctor visits error:",
      error
    );


    res.status(
      500
    ).json({

      success:
        false,

      message:
        error instanceof Error
          ? error.message
          : "Không thể tải lượt khám bác sĩ.",

    });

  }

}