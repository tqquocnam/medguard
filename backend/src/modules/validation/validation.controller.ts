import type {

  Request,

  Response,

} from "express";



import {

  startValidation,

  getValidationProgress

} from "./validation.service.js";



import {

  rebuildMedicalEvents,

} from "../medical-event/event.service.js";



import {

  getCaseResults,

} from "./case-results.service.js";



import {

  getCheckRuns,

  getCheckRunResults as getCheckRunResultsService,

} from "./check-runs.service.js";

import {

  getCheckRunCaseResults,

} from "./check-run-case-results.service.js";



import {

  getCheckDatasets,

} from "./check-datasets.service.js";



// ======================================================

// TYPES

// ======================================================



interface RunChecksBody {

  year?: number;

  month?: number;

  paymentDate?: string;
  treatmentGroup?: "GENERAL" | "YHCT";
  importBatchId?: string;

}





// ======================================================

// UUID

// ======================================================



function isUuid(

  value: string

) {

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    .test(value);

}





// ======================================================

// RUN CHECKS

// ======================================================



export async function runChecks(

  req: Request,

  res: Response

): Promise<void> {



  try {



    const body: RunChecksBody =

      req.body ?? {};





    let year:

      number |

      undefined;





    let month:

      number |

      undefined;





    let paymentDate:

      string |

      undefined;





    // ==================================================

    // YEAR

    // ==================================================



    if (

      body.year !== undefined &&

      body.year !== null

    ) {



      year =

        Number(

          body.year

        );





      if (

        !Number.isInteger(year) ||

        year < 2000 ||

        year > 2100

      ) {



        res.status(400).json({

          success: false,



          message:

            "Năm kiểm tra không hợp lệ.",

        });



        return;

      }

    }





    // ==================================================

    // MONTH

    // ==================================================



    if (

      body.month !== undefined &&

      body.month !== null

    ) {



      month =

        Number(

          body.month

        );





      if (

        !Number.isInteger(month) ||

        month < 1 ||

        month > 12

      ) {



        res.status(400).json({

          success: false,



          message:

            "Tháng kiểm tra không hợp lệ.",

        });



        return;

      }

    }





    // ==================================================

    // PAYMENT DATE

    // ==================================================



    if (

      body.paymentDate

    ) {



      paymentDate =

        String(

          body.paymentDate

        ).trim();





      if (

        !/^\d{4}-\d{2}-\d{2}$/

          .test(paymentDate)

      ) {



        res.status(400).json({

          success: false,



          message:

            "Ngày thanh toán phải có định dạng YYYY-MM-DD.",

        });



        return;

      }





      if (

        year === undefined

      ) {



        year =

          Number(

            paymentDate.slice(

              0,

              4

            )

          );

      }





      if (

        month === undefined

      ) {



        month =

          Number(

            paymentDate.slice(

              5,

              7

            )

          );

      }

    }





    // ==================================================

    // YEAR BẮT BUỘC

    // ==================================================



    if (

      year === undefined

    ) {



      res.status(400).json({

        success: false,



        message:

          "Vui lòng chọn năm cần kiểm tra.",

      });



      return;

    }





    const treatmentGroup = body.treatmentGroup;
    const importBatchId = body.importBatchId;
    if (treatmentGroup != null && treatmentGroup !== "GENERAL" && treatmentGroup !== "YHCT") {
      res.status(400).json({success:false,message:"Nhóm KCB không hợp lệ."}); return;
    }
    if (importBatchId != null && (!isUuid(importBatchId) || !treatmentGroup)) {
      res.status(400).json({success:false,message:"Batch ID hoặc nhóm hồ sơ không hợp lệ."}); return;
    }

    // ==================================================

    // REBUILD EVENTS

    // ==================================================



    const eventResult =

      (treatmentGroup || importBatchId) ? null : await rebuildMedicalEvents();





    // ==================================================

    // RUN VALIDATION

    // ==================================================



   const validation =

  await startValidation({

    year,

    month,

    paymentDate,
    treatmentGroup,
    importBatchId,

  });





    // ==================================================

    // RESPONSE

    // ==================================================



    res.status(200).json({

      success: true,



      message:

        "Kiểm tra dữ liệu hoàn tất.",



      data: {



        scope: {

          year,



          month:

            month ??

            null,



          paymentDate:

            paymentDate ??

            null,
          treatmentGroup: treatmentGroup ?? null,
          importBatchId: importBatchId ?? null,

        },



        events:

          eventResult,



        validation:

          validation,

      },

    });



  } catch (

    error

  ) {



    console.error(

      "Run checks error:",

      error

    );





    res.status(500).json({

      success: false,



      message:

        error instanceof Error

          ? error.message

          : "Kiểm tra dữ liệu thất bại.",

    });

  }

}





export async function getCheckProgress(

  req: Request,

  res: Response

) {

  try {

    const checkRunId =

      String(

        req.params.checkRunId ??

        ""

      ).trim();



    if (

      !checkRunId

    ) {

      return res

        .status(400)

        .json({

          success: false,



          message:

            "Thiếu mã phiên kiểm tra.",

        });

    }





    const progress =

      await getValidationProgress(

        checkRunId

      );





    return res.json({

      success: true,



      data: {

        progress,

      },

    });



  } catch (

    error

  ) {

    console.error(

      "Get check progress error:",

      error

    );





    return res

      .status(400)

      .json({

        success: false,



        message:

          error instanceof

          Error

            ? error.message

            : "Không thể lấy tiến độ kiểm tra.",

      });

  }

}



// ======================================================

// GET CHECK RUN HISTORY

// ======================================================



export async function getCheckRunHistory(

  req: Request,

  res: Response

): Promise<void> {



  try {



    // ==================================================

    // YEAR

    // ==================================================



    const year =

      Number(

        req.query.year

      );





    if (

      !Number.isInteger(year) ||

      year < 2000 ||

      year > 2100

    ) {



      res.status(400).json({

        success: false,



        message:

          "Năm không hợp lệ.",

      });



      return;

    }





    // ==================================================

    // MONTH

    // ==================================================



    const month =

      Number(

        req.query.month

      );





    if (

      !Number.isInteger(month) ||

      month < 1 ||

      month > 12

    ) {



      res.status(400).json({

        success: false,



        message:

          "Tháng không hợp lệ.",

      });



      return;

    }





    // ==================================================

    // LIMIT

    // ==================================================



    const rawLimit =

      Number(

        req.query.limit ??

        10

      );





    const limit =

      Number.isInteger(

        rawLimit

      )

        ? Math.min(

            100,

            Math.max(

              1,

              rawLimit

            )

          )

        : 10;





    // ==================================================

    // OFFSET

    // ==================================================



    const rawOffset =

      Number(

        req.query.offset ??

        0

      );





    const offset =

      Number.isInteger(

        rawOffset

      )

        ? Math.max(

            0,

            rawOffset

          )

        : 0;





    // ==================================================

    // QUERY

    // ==================================================



    const result =

      await getCheckRuns({

        year,

        month,

        limit,

        offset,

      });





    res.status(200).json({

      success: true,



      data:

        result,

    });



  } catch (

    error

  ) {



    console.error(

      "Get check runs error:",

      error

    );





    res.status(500).json({

      success: false,



      message:

        error instanceof Error

          ? error.message

          : "Không thể tải lịch sử kiểm tra.",

    });

  }

}





// ======================================================

// GET ONE CHECK RUN RESULTS

// ======================================================

//

// GET

// /api/checks/runs/:runId/results

//

// Trả:

//

// - thông tin lần kiểm tra

// - tổng hồ sơ

// - hồ sơ TỐT

// - hồ sơ lỗi

// - danh sách hồ sơ lỗi

//

// ======================================================



export async function getCheckRunResults(

  req: Request,

  res: Response

): Promise<void> {



  try {



    const runId =

      String(

        req.params.runId ??

        ""

      ).trim();





    // ==================================================

    // VALIDATE ID

    // ==================================================



    if (

      !runId

    ) {



      res.status(400).json({

        success: false,



        message:

          "Thiếu ID lần kiểm tra.",

      });



      return;

    }





    if (

      !isUuid(runId)

    ) {



      res.status(400).json({

        success: false,



        message:

          "ID lần kiểm tra không hợp lệ.",

      });



      return;

    }





    // ==================================================

    // LOAD

    // ==================================================



    const result =

      await getCheckRunResultsService(

        runId

      );





    // ==================================================

    // NOT FOUND

    // ==================================================



    if (

      !result

    ) {



      res.status(404).json({

        success: false,



        message:

          "Không tìm thấy lần kiểm tra.",

      });



      return;

    }





    // ==================================================

    // SUCCESS

    // ==================================================



    res.status(200).json({

      success: true,



      data:

        result,

    });



  } catch (

    error

  ) {



    console.error(

      "Get check run results error:",

      error

    );





    res.status(500).json({

      success: false,



      message:

        error instanceof Error

          ? error.message

          : "Không thể tải kết quả lần kiểm tra.",

    });

  }

}





// ======================================================

// GET CASE CHECK RESULTS

// ======================================================



export async function getCaseCheckResults(

  req: Request,

  res: Response

): Promise<void> {



  try {



    const caseId =

      String(

        req.params.caseId ??

        ""

      ).trim();





    if (

      !caseId

    ) {



      res.status(400).json({

        success: false,



        message:

          "Thiếu ID hồ sơ.",

      });



      return;

    }





    const result =

      await getCaseResults(

        caseId

      );





    res.status(200).json({

      success: true,



      data:

        result,

    });



  } catch (

    error

  ) {



    console.error(

      "Get case results error:",

      error

    );





    res.status(500).json({

      success: false,



      message:

        error instanceof Error

          ? error.message

          : "Không thể lấy kết quả kiểm tra.",

    });

  }

}



// ======================================================

// GET CASE RESULTS OF ONE CHECK RUN

// ======================================================



export async function getCheckRunCaseCheckResults(

  req: Request,

  res: Response

): Promise<void> {



  try {



    const runId =

      String(

        req.params.runId ??

        ""

      ).trim();





    const caseId =

      String(

        req.params.caseId ??

        ""

      ).trim();





    if (

      !runId ||

      !caseId

    ) {



      res

        .status(400)

        .json({

          success:

            false,



          message:

            "Thiếu ID lần kiểm tra hoặc ID hồ sơ.",

        });



      return;

    }





    const result =

      await getCheckRunCaseResults(

        runId,

        caseId

      );





    if (

      !result

    ) {



      res

        .status(404)

        .json({

          success:

            false,



          message:

            "Không tìm thấy lần kiểm tra.",

        });



      return;

    }





    res

      .status(200)

      .json({

        success:

          true,



        data:

          result,

      });



  } catch (

    error

  ) {



    console.error(

      "Get historical case results error:",

      error

    );





    res

      .status(500)

      .json({

        success:

          false,



        message:

          error instanceof Error

            ? error.message

            : "Không thể tải chi tiết lỗi hồ sơ.",

      });

  }

}

// ======================================================

// GET IMPORTED DATASETS

// ======================================================



export async function getCheckDatasetList(

  req: Request,

  res: Response

): Promise<void> {



  try {



    const year =

      Number(

        req.query.year

      );





    const month =

      Number(

        req.query.month

      );





    if (

      !Number.isInteger(year) ||

      year < 2000 ||

      year > 2100

    ) {



      res.status(400).json({

        success: false,



        message:

          "Năm không hợp lệ.",

      });



      return;

    }





    if (

      !Number.isInteger(month) ||

      month < 1 ||

      month > 12

    ) {



      res.status(400).json({

        success: false,



        message:

          "Tháng không hợp lệ.",

      });



      return;

    }





    const data =

      await getCheckDatasets({

        year,

        month,

      });





    res.status(200).json({

      success: true,



      data,

    });



  } catch (

    error

  ) {



    console.error(

      "Get check datasets error:",

      error

    );





    res.status(500).json({

      success: false,



      message:

        error instanceof Error

          ? error.message

          : "Không thể tải trạng thái dữ liệu import.",

    });

  }

}