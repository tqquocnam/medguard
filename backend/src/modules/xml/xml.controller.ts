import type { Request, Response } from "express";

import { parseBhytXml } from "./bhytXmlParser.js";
import { saveBhytImport } from "./xml.service.js";
import {
  validateImportFile,
} from "./import-validator.js";
import {
  randomUUID,
} from "crypto";

import {
  createImportProgress,
  updateImportProgress,
  finishImportProgress,
  failImportProgress,
  getImportProgress,
} from "./import-progress.service.js";




export async function uploadXml(
  req: Request,
  res: Response
): Promise<void> {

  try {

    if (!req.file) {

      res
        .status(400)
        .json({
          success:
            false,

          canImport:
            false,

          message:
            "Vui lòng chọn file XML.",
        });

      return;
    }


    // ==========================================
    // PARSE
    // ==========================================

    const xmlText =
      req.file.buffer
        .toString(
          "utf8"
        );


    const parsed =
      parseBhytXml(
        xmlText
      );


    // ==========================================
    // KIỂM TRA LẠI TOÀN FILE
    // ==========================================

    const validation =
      validateImportFile(
        parsed
      );


    // ==========================================
    // CÓ BẤT KỲ CA LỖI
    // => KHÔNG IMPORT
    // ==========================================

    if (
      !validation.canImport
    ) {

      res
        .status(422)
        .json({

          success:
            false,

          canImport:
            false,

          message:
            `Không thể import. Có ${validation.summary.invalid} hồ sơ bị lỗi.`,

          data: {

            summary:
              validation.summary,

            cases:
              validation.cases,
          },
        });


      return;
    }


    // ==========================================
    // TẠO IMPORT JOB
    // ==========================================

    const importId =
      randomUUID();


    createImportProgress(
      importId,
      parsed.cases.length
    );


    const fileName =
      req.file.originalname;


    // ==========================================
    // TRẢ ID NGAY CHO FRONTEND
    // ==========================================

    res
      .status(202)
      .json({

        success:
          true,

        canImport:
          true,

        importId,

        total:
          parsed.cases.length,

        message:
          "Đã bắt đầu import dữ liệu.",
      });


    // ==========================================
    // IMPORT
    // ==========================================

    void (
      async () => {

        try {

          const saved =
            await saveBhytImport(
              fileName,

              parsed,

              (
                current,
                total
              ) => {

                updateImportProgress(
                  importId,
                  current,
                  total
                );
              }
            );


          // saveBhytImport chỉ return sau COMMIT
          finishImportProgress(
            importId,
            saved
          );

        } catch (
          error
        ) {

          console.error(
            "Background XML import error:",
            error
          );


          failImportProgress(
            importId,
            error
          );
        }

      }
    )();

  } catch (
    error
  ) {

    console.error(
      "XML import error:",
      error
    );


    res
      .status(400)
      .json({

        success:
          false,

        canImport:
          false,

        message:
          error instanceof Error
            ? error.message
            : "Không thể xử lý XML.",
      });
  }
}


// ======================================================
// GET PROGRESS
// ======================================================

export async function importProgress(
  req: Request,
  res: Response
): Promise<void> {

  const importId =
    String(
      req.params
        .importId ??
      ""
    ).trim();


  if (!importId) {

    res
      .status(400)
      .json({
        success:
          false,

        message:
          "Thiếu importId.",
      });

    return;
  }


  const progress =
    getImportProgress(
      importId
    );


  if (!progress) {

    res
      .status(404)
      .json({
        success:
          false,

        message:
          "Không tìm thấy tiến trình import.",
      });

    return;
  }


  res.json({
    success:
      true,

    data:
      progress,
  });
}
export async function analyzeXml(
  req: Request,
  res: Response
): Promise<void> {

  try {

    if (!req.file) {

      res
        .status(400)
        .json({
          success:
            false,

          message:
            "Vui lòng chọn file XML.",
        });

      return;
    }


    // ========================================
    // ĐỌC FILE
    // ========================================

    const xmlText =
      req.file.buffer
        .toString(
          "utf8"
        );


    // ========================================
    // PARSE
    //
    // Nếu XML sai cấu trúc,
    // parseBhytXml sẽ throw.
    // ========================================

    const parsed =
      parseBhytXml(
        xmlText
      );


    // ========================================
    // KIỂM TRA
    // ========================================

    const validation =
      validateImportFile(
        parsed
      );


    // ========================================
    // CHƯA LƯU DB Ở ĐÂY
    // ========================================

    res.json({

      success:
        true,

      canImport:
        validation
          .canImport,


      message:
        validation.canImport

          ? "Dữ liệu XML hợp lệ. Có thể import."

          : `Không thể import. Có ${validation.summary.invalid} hồ sơ bị lỗi.`,


      file: {

        name:
          req.file
            .originalname,

        size:
          req.file
            .size,
      },


      data: {

        facilityCode:
          parsed
            .facilityCode,

        createdDate:
          parsed
            .createdDate,

        declaredTotal:
          parsed
            .declaredTotal,

        actualTotal:
          parsed
            .actualTotal,


        summary:
          validation
            .summary,


        cases:
          validation
            .cases,
      },
    });

  } catch (error) {

    console.error(
      "Analyze XML error:",
      error
    );


    res
      .status(400)
      .json({

        success:
          false,

        canImport:
          false,

        message:
          error instanceof Error

            ? error.message

            : "File XML không hợp lệ.",
      });
  }
}