import type { Request, Response } from "express";
import ExcelJS from "exceljs";
import { db } from "../../config/database.js";

interface MachineImportRow {
  code: string;
  name: string;
  note: string | null;
  warnTimeOverlap: boolean;
}

const HEADERS = ["MA_MAY", "TEN_TB"];

function parseBoolean(value: string): boolean | null {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (["1", "true", "co", "yes", "x"].includes(normalized)) {
    return true;
  }

  if (["", "0", "false", "khong", "no"].includes(normalized)) {
    return false;
  }

  return null;
}

export async function importMachinesExcel(req: Request, res: Response): Promise<void> {
  const file = req.file;

  if (!file) {
    res.status(400).json({
      success: false,
      message: "Vui lòng chọn file Excel.",
    });
    return;
  }

  if (!/\.xlsx$/i.test(file.originalname)) {
    res.status(400).json({
      success: false,
      message: "Chỉ hỗ trợ file Excel .xlsx.",
    });
    return;
  }

  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(file.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    res.status(400).json({
      success: false,
      message: "Không đọc được file Excel. Vui lòng kiểm tra lại file.",
    });
    return;
  }

  const sheet = workbook.worksheets[0];

  if (!sheet) {
    res.status(400).json({
      success: false,
      message: "File Excel không có trang tính.",
    });
    return;
  }

  if (sheet.rowCount > 10001) {
    res.status(400).json({
      success: false,
      message: "Mỗi lần import tối đa 10.000 dòng.",
    });
    return;
  }

  const columns = new Map<string, number>();
  const duplicatedHeaders = new Set<string>();

  sheet.getRow(1).eachCell((cell, index) => {
    const header = cell.text
      .replace(/^\uFEFF/, "")
      .trim()
      .toUpperCase();

    if (columns.has(header)) {
      duplicatedHeaders.add(header);
    }

    columns.set(header, index);
  });

  const missing = HEADERS.filter((header) => !columns.has(header));

  if (missing.length > 0 || HEADERS.some((header) => duplicatedHeaders.has(header))) {
    res.status(400).json({
      success: false,
      message:
        missing.length > 0 ? `Thiếu cột: ${missing.join(", ")}.` : "File có tiêu đề cột bị trùng.",
    });
    return;
  }

  const rows: MachineImportRow[] = [];
  const errors: string[] = [];
  const codes = new Set<string>();

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const getText = (header: string) => {
      const column = columns.get(header);

      return column ? row.getCell(column).text.trim() : "";
    };
    const code = getText("MA_MAY");
    const name = getText("TEN_TB");
    const note = getText("GHI_CHU");
    const warning = getText("CANH_BAO_TRUNG_TGTH");

    if (![code, name, note, warning].some(Boolean)) return;

    const warnTimeOverlap = parseBoolean(warning);
    const rowErrors: string[] = [];

    if (!code) rowErrors.push("thiếu mã máy");
    if (!name) rowErrors.push("thiếu tên máy");

    if (code && codes.has(code)) {
      rowErrors.push(`mã máy "${code}" bị trùng trong file`);
    }

    if (warnTimeOverlap === null) {
      rowErrors.push("cảnh báo trùng TGTH phải là 1/0 hoặc Có/Không");
    }

    if (code) codes.add(code);

    if (rowErrors.length > 0) {
      errors.push(`Dòng ${rowNumber}: ${rowErrors.join("; ")}.`);
      return;
    }

    rows.push({
      code,
      name,
      note: note || null,
      warnTimeOverlap: warnTimeOverlap!,
    });
  });

  if (errors.length > 0) {
    res.status(400).json({
      success: false,
      message: "File có dữ liệu chưa hợp lệ. Chưa nhập dòng nào.",
      errors: errors.slice(0, 100),
    });
    return;
  }

  if (rows.length === 0) {
    res.status(400).json({
      success: false,
      message: "File chưa có dữ liệu máy.",
    });
    return;
  }

  try {
    // Dùng kết nối có ngữ cảnh chi nhánh và transaction.
    const client = await db.connect();

    let inserted = 0;
    let skipped = 0;

    try {
      await client.query("BEGIN");

      for (const row of rows) {
        const existing = await client.query(
          `
            SELECT code
            FROM catalog.machines
            WHERE code = $1
            LIMIT 1
          `,
          [row.code],
        );

        if ((existing.rowCount ?? 0) > 0) {
          skipped++;
          continue;
        }

        const result = await client.query(
          `
            INSERT INTO catalog.machines (
              code,
              name,
              note,
              warn_time_overlap,
              active,
              created_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, true, NOW(), NOW())
            ON CONFLICT DO NOTHING
            RETURNING code
          `,
          [row.code, row.name, row.note, row.warnTimeOverlap],
        );

        if ((result.rowCount ?? 0) > 0) {
          inserted++;
        } else {
          skipped++;
        }
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      message: `Đã thêm ${inserted} máy, bỏ qua ${skipped} mã đã tồn tại.`,
      data: {
        totalRows: rows.length,
        inserted,
        skipped,
      },
    });
  } catch (error) {
    console.error("Import machines error:", error);

    res.status(500).json({
      success: false,
      message: "Không thể import danh mục máy. Dữ liệu chưa được lưu.",
    });
  }
}
