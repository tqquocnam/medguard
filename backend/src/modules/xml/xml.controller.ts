import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { parseBhytXml } from "./bhytXmlParser.js";
import {
  saveBhytImport,
  validateXmlBranch,
  validateRequestedTreatmentGroup,
} from "./xml.service.js";
import type { TreatmentGroup } from "./xml.service.js";
import { validateImportFile } from "./import-validator.js";
import {
  createImportProgress,
  updateImportProgress,
  finishImportProgress,
  failImportProgress,
  getImportProgress,
} from "./import-progress.service.js";

function requireGroup(req: Request): TreatmentGroup {
  const value = String(req.body?.treatmentGroup ?? "").trim().toUpperCase();
  if (value !== "GENERAL" && value !== "YHCT") {
    throw new Error("Hãy chọn nhóm dữ liệu GENERAL hoặc YHCT trước khi xử lý/import XML.");
  }
  return value;
}

export async function uploadXml(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, canImport: false, message: "Vui lòng chọn file XML." });
      return;
    }
    const treatmentGroup = requireGroup(req);
    const parsed = parseBhytXml(req.file.buffer.toString("utf8"));
    validateXmlBranch(parsed);
    const validation = validateImportFile(parsed);
    if (!validation.canImport) {
      res.status(422).json({
        success: false,
        canImport: false,
        message: `Không thể import. Có ${validation.summary.invalid} hồ sơ bị lỗi.`,
        data: { summary: validation.summary, cases: validation.cases },
      });
      return;
    }
    // Validate BEFORE sending a 202 Accepted and creating a background job.
    validateRequestedTreatmentGroup(parsed, treatmentGroup);
    const importId = randomUUID();
    createImportProgress(importId, parsed.cases.length);
    const fileName = req.file.originalname;
    res.status(202).json({
      success: true,
      canImport: true,
      importId,
      total: parsed.cases.length,
      treatmentGroup,
      message: "Đã bắt đầu import dữ liệu.",
    });
    void (async () => {
      try {
        const saved = await saveBhytImport(
          fileName,
          parsed,
          (current, total) => updateImportProgress(importId, current, total),
          treatmentGroup
        );
        finishImportProgress(importId, saved);
      } catch (error) {
        console.error("Background XML import error:", error);
        failImportProgress(importId, error);
      }
    })();
  } catch (error) {
    console.error("XML import error:", error);
    res.status(400).json({
      success: false,
      canImport: false,
      message: error instanceof Error ? error.message : "Không thể xử lý XML.",
    });
  }
}

export async function importProgress(req: Request, res: Response): Promise<void> {
  const importId = String(req.params.importId ?? "").trim();
  if (!importId) {
    res.status(400).json({ success: false, message: "Thiếu importId." });
    return;
  }
  const progress = getImportProgress(importId);
  if (!progress) {
    res.status(404).json({ success: false, message: "Không tìm thấy tiến trình import." });
    return;
  }
  res.json({ success: true, data: progress });
}

export async function analyzeXml(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: "Vui lòng chọn file XML." });
      return;
    }
    const treatmentGroup = requireGroup(req);
    const parsed = parseBhytXml(req.file.buffer.toString("utf8"));
    validateXmlBranch(parsed);
    const validation = validateImportFile(parsed);
    if (validation.canImport) {
      validateRequestedTreatmentGroup(parsed, treatmentGroup);
    }
    res.json({
      success: true,
      canImport: validation.canImport,
      treatmentGroup,
      message: validation.canImport
        ? "Dữ liệu XML hợp lệ và phù hợp nhóm đã chọn. Có thể import."
        : `Không thể import. Có ${validation.summary.invalid} hồ sơ bị lỗi.`,
      file: { name: req.file.originalname, size: req.file.size },
      data: {
        facilityCode: parsed.facilityCode,
        createdDate: parsed.createdDate,
        declaredTotal: parsed.declaredTotal,
        actualTotal: parsed.actualTotal,
        summary: validation.summary,
        cases: validation.cases,
      },
    });
  } catch (error) {
    console.error("Analyze XML error:", error);
    res.status(400).json({
      success: false,
      canImport: false,
      message: error instanceof Error ? error.message : "File XML không hợp lệ.",
    });
  }
}
