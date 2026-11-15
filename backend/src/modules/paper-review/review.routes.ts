import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { db } from "../../config/database.js";
import { requireBranch } from "../../config/branch-context.js";
import type { AuthRequest } from "../auth/auth.middleware.js";
import { storageRoot, capabilities, fileDirectory } from "./review.ocr.js";
import {
  checkPages,
  suggestedCaseKey,
  defaultRules,
  type Fields,
  type Rules,
  type ReviewPage,
} from "./review.engine.js";
const router = Router();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class InputError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const route =
  (fn: (req: AuthRequest, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void fn(req as AuthRequest, res).catch(next);
  };
function id(value: unknown): string {
  if (typeof value !== "string" || !uuid.test(value))
    throw new InputError("Mã dữ liệu không hợp lệ.");
  return value;
}
function text(value: unknown, limit: number): string {
  if (typeof value !== "string" || value.length > limit)
    throw new InputError("Nội dung không hợp lệ hoặc quá dài.");
  return value.trim();
}
async function getRules(): Promise<Rules> {
  const r = await db.query("SELECT rules FROM paper_review.settings WHERE branch_id=$1", [
    requireBranch(),
  ]);
  return { ...defaultRules, ...r.rows[0]?.rules };
}
async function batch(batchId: string) {
  const r = await db.query("SELECT * FROM paper_review.batches WHERE id=$1 AND branch_id=$2", [
    batchId,
    requireBranch(),
  ]);
  if (!r.rowCount) throw new InputError("Không tìm thấy lô hồ sơ.", 404);
  return r.rows[0];
}
async function pagesFor(batchId: string) {
  const r = await db.query(
    `SELECT p.id,p.file_id,p.page_number,p.document_type,p.case_key,p.confirmed,p.fields,p.review_status,p.note,p.version,
    p.updated_at,f.original_name,f.status AS file_status,round((p.ocr->>'confidence')::numeric,1) AS confidence
    FROM paper_review.pages p JOIN paper_review.files f ON f.id=p.file_id AND f.branch_id=p.branch_id
    WHERE p.branch_id=$1 AND p.batch_id=$2 ORDER BY f.created_at,p.page_number`,
    [requireBranch(), batchId],
  );
  return r.rows.map((p) => ({ ...p, suggested_case_key: suggestedCaseKey(p.fields) }));
}
router.get(
  "/capabilities",
  route(async (_req, res) => {
    const ocr = await capabilities();
    try {
      await db.query("SELECT id FROM paper_review.batches LIMIT 0");
    } catch {
      res.json({
        ready: false,
        message: "Cần chạy migration 20261115_paper_review.sql trước khi sử dụng.",
      });
      return;
    }
    res.json({ ...ocr, maxFileMB: 20, maxPdfPages: 500 });
  }),
);
router.get(
  "/rules",
  route(async (_req, res) => {
    res.json(await getRules());
  }),
);
router.put(
  "/rules",
  route(async (req, res) => {
    const rules = {} as Rules;
    for (const key of Object.keys(defaultRules) as (keyof Rules)[]) {
      if (typeof req.body?.[key] !== "boolean") throw new InputError("Cấu hình rule không hợp lệ.");
      rules[key] = req.body[key];
    }
    await db.query(
      `INSERT INTO paper_review.settings(branch_id,rules) VALUES($1,$2) ON CONFLICT(branch_id) DO UPDATE SET rules=excluded.rules`,
      [requireBranch(), JSON.stringify(rules)],
    );
    res.json(rules);
  }),
);
router.get(
  "/batches",
  route(async (_req, res) => {
    const r = await db.query(
      `SELECT b.*,count(f.id)::int AS file_count,
    count(f.id) FILTER(WHERE f.status='COMPLETED')::int AS completed_count,
    count(f.id) FILTER(WHERE f.status='FAILED')::int AS failed_count
    FROM paper_review.batches b LEFT JOIN paper_review.files f ON f.batch_id=b.id AND f.branch_id=b.branch_id
    WHERE b.branch_id=$1 GROUP BY b.id ORDER BY b.created_at DESC LIMIT 100`,
      [requireBranch()],
    );
    res.json(r.rows);
  }),
);
router.post(
  "/batches",
  route(async (req, res) => {
    const capability = await capabilities();
    if (!capability.ready) throw new InputError(capability.message, 503);
    const batchId = randomUUID(),
      name = text(req.body?.name, 160);
    if (!name) throw new InputError("Nhập tên lô hồ sơ.");
    await db.query(
      "INSERT INTO paper_review.batches(id,branch_id,name,created_by) VALUES($1,$2,$3,$4)",
      [batchId, requireBranch(), name, req.user!.id],
    );
    res.status(201).json({ id: batchId });
  }),
);
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      void mkdir(path.join(storageRoot, "incoming"), { recursive: true, mode: 0o700 }).then(
        () => cb(null, path.join(storageRoot, "incoming")),
        (e) => cb(e, ""),
      );
    },
    filename: (_req, _file, cb) => cb(null, randomUUID()),
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 10, fields: 0 },
}).array("files", 10);
router.post(
  "/batches/:batchId/files",
  route(async (req, res) => {
    const batchId = id(req.params.batchId),
      branch = requireBranch();
    await batch(batchId);
    const capability = await capabilities();
    if (!capability.ready) throw new InputError(capability.message, 503);
    await new Promise<void>((resolve, reject) =>
      upload(req, res, (e) => (e ? reject(e) : resolve())),
    );
    const files = req.files as Express.Multer.File[];
    if (!files?.length) throw new InputError("Chọn ảnh PNG/JPEG hoặc PDF.");
    const dirs: string[] = [];
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        "SELECT id FROM paper_review.batches WHERE id=$1 AND branch_id=$2 FOR UPDATE",
        [batchId, branch],
      );
      if (!locked.rowCount) throw new InputError("Lô hồ sơ đã bị xóa.", 404);
      const pending = await client.query(
        "SELECT count(*)::int AS n FROM paper_review.files WHERE branch_id=$1 AND status IN ('QUEUED','PROCESSING')",
        [branch],
      );
      if (pending.rows[0].n + files.length > 1000)
        throw new InputError("Hàng đợi đang đầy (tối đa 1.000 file chờ mỗi chi nhánh).", 429);
      const accepted: string[] = [],
        duplicates: string[] = [];
      for (const file of files) {
        const bytes = await readFile(file.path);
        const mime =
          bytes.subarray(0, 5).toString() === "%PDF-"
            ? "application/pdf"
            : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
                bytes.length >= 24
              ? "image/png"
              : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
                ? "image/jpeg"
                : "";
        if (!mime) throw new InputError("Chỉ nhận file PDF, PNG hoặc JPEG hợp lệ.");
        const digest = createHash("sha256").update(bytes).digest("hex");
        const exists = await client.query(
          "SELECT id FROM paper_review.files WHERE branch_id=$1 AND batch_id=$2 AND sha256=$3",
          [branch, batchId, digest],
        );
        if (exists.rowCount) {
          duplicates.push(file.originalname);
          continue;
        }
        const fileId = randomUUID(),
          dir = fileDirectory(branch, fileId);
        await mkdir(dir, { recursive: true, mode: 0o700 });
        dirs.push(dir);
        await rename(file.path, path.join(dir, "original"));
        await client.query(
          `INSERT INTO paper_review.files(id,branch_id,batch_id,original_name,mime_type,sha256) VALUES($1,$2,$3,$4,$5,$6)`,
          [fileId, branch, batchId, path.basename(file.originalname).slice(0, 255), mime, digest],
        );
        accepted.push(fileId);
      }
      await client.query("COMMIT");
      res.status(202).json({ accepted, duplicates });
    } catch (e) {
      await client.query("ROLLBACK");
      await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
      throw e;
    } finally {
      client.release();
      await Promise.all(files.map((f) => rm(f.path, { force: true })));
    }
  }),
);
router.get(
  "/batches/:batchId",
  route(async (req, res) => {
    const batchId = id(req.params.batchId),
      info = await batch(batchId);
    const files = await db.query(
      "SELECT id,original_name,status,error,attempts FROM paper_review.files WHERE branch_id=$1 AND batch_id=$2 ORDER BY created_at",
      [requireBranch(), batchId],
    );
    const pages = await pagesFor(batchId),
      rules = await getRules();
    res.json({
      batch: info,
      files: files.rows,
      pages,
      findings: checkPages(pages as ReviewPage[], rules),
    });
  }),
);
router.post(
  "/batches/:batchId/suggest-groups",
  route(async (req, res) => {
    const batchId = id(req.params.batchId);
    await batch(batchId);
    const pages = (await pagesFor(batchId)).filter(
      (p) => !p.confirmed && !p.case_key && p.suggested_case_key,
    );
    const client = await db.connect();
    let count = 0;
    try {
      await client.query("BEGIN");
      for (const p of pages) {
        const r = await client.query(
          "UPDATE paper_review.pages SET case_key=$3,version=version+1,updated_at=now(),reviewed_by=$4 WHERE id=$1 AND branch_id=$2 AND version=$5 AND confirmed=false AND case_key='' RETURNING id",
          [p.id, requireBranch(), p.suggested_case_key, req.user!.id, p.version],
        );
        if (r.rowCount) {
          count++;
          await client.query(
            "INSERT INTO paper_review.audit(branch_id,page_id,user_id,change) VALUES($1,$2,$3,$4)",
            [
              requireBranch(),
              p.id,
              req.user!.id,
              JSON.stringify({
                case_key: p.suggested_case_key,
                source: "OCR_SUGGESTION",
                confirmed: false,
              }),
            ],
          );
        }
      }
      await client.query("COMMIT");
      res.json({ grouped: count });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);
router.post(
  "/files/:fileId/retry",
  route(async (req, res) => {
    if (!(await capabilities()).ready) throw new InputError("OCR chưa sẵn sàng.", 503);
    const r = await db.query(
      `UPDATE paper_review.files SET status='QUEUED',attempts=0,error=NULL,lease_token=NULL,lease_until=NULL WHERE id=$1 AND branch_id=$2 AND status='FAILED' RETURNING id`,
      [id(req.params.fileId), requireBranch()],
    );
    if (!r.rowCount)
      throw new InputError("File không tồn tại hoặc chưa ở trạng thái thất bại.", 409);
    res.json({ success: true });
  }),
);
router.post(
  "/pages/group",
  route(async (req, res) => {
    const caseKey = text(req.body?.case_key, 100),
      pages = req.body?.pages;
    if (!caseKey || !Array.isArray(pages) || !pages.length || pages.length > 500)
      throw new InputError("Chọn từ 1 đến 500 trang và nhập mã nhóm.");
    const branch = requireBranch(),
      client = await db.connect();
    try {
      await client.query("BEGIN");
      for (const p of [...pages].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
        if (!Number.isInteger(p.version)) throw new InputError("Phiên bản trang không hợp lệ.");
        const r = await client.query(
          `UPDATE paper_review.pages SET case_key=$3,confirmed=false,review_status='PENDING',version=version+1,updated_at=now(),reviewed_by=$4
        WHERE id=$1 AND branch_id=$2 AND version=$5 RETURNING id`,
          [id(p.id), branch, caseKey, req.user!.id, p.version],
        );
        if (!r.rowCount)
          throw new InputError(
            "Có trang đã thay đổi hoặc không tồn tại. Tải lại lô rồi ghép lại.",
            409,
          );
        await client.query(
          "INSERT INTO paper_review.audit(branch_id,page_id,user_id,change) VALUES($1,$2,$3,$4)",
          [branch, p.id, req.user!.id, JSON.stringify({ case_key: caseKey, confirmed: false })],
        );
      }
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);
router.get(
  "/pages/:pageId",
  route(async (req, res) => {
    const r = await db.query(
      "SELECT id,ocr,fields,version FROM paper_review.pages WHERE id=$1 AND branch_id=$2",
      [id(req.params.pageId), requireBranch()],
    );
    if (!r.rowCount) throw new InputError("Không tìm thấy trang.", 404);
    res.json(r.rows[0]);
  }),
);
router.get(
  "/pages/:pageId/image",
  route(async (req, res) => {
    const r = await db.query(
      "SELECT file_id,image_name FROM paper_review.pages WHERE id=$1 AND branch_id=$2",
      [id(req.params.pageId), requireBranch()],
    );
    const p = r.rows[0];
    if (!p) throw new InputError("Không tìm thấy trang.", 404);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(path.join(fileDirectory(requireBranch(), p.file_id), path.basename(p.image_name)));
  }),
);
router.patch(
  "/pages/:pageId",
  route(async (req, res) => {
    const pageId = id(req.params.pageId),
      branch = requireBranch(),
      body = req.body ?? {};
    if (
      !["STATEMENT", "PRESCRIPTION", "ORDER", "CONTINUATION", "UNKNOWN"].includes(
        body.document_type,
      ) ||
      typeof body.confirmed !== "boolean" ||
      !["PENDING", "NEEDS_FIX", "RESOLVED"].includes(body.review_status) ||
      !Number.isInteger(body.version)
    )
      throw new InputError("Thông tin xác nhận không hợp lệ.");
    const fields = {} as Fields;
    for (const key of [
      "patientId",
      "encounterId",
      "name",
      "birthDate",
      "gender",
      "visitDate",
      "weight",
      "icd",
    ] as const)
      fields[key] = text(body.fields?.[key], key === "icd" ? 2000 : 200);
    const caseKey = text(body.case_key, 100),
      note = text(body.note, 2000);
    if (body.confirmed && (!caseKey || body.document_type === "UNKNOWN"))
      throw new InputError("Chọn loại giấy và mã nhóm lượt khám trước khi xác nhận.");
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE paper_review.pages SET fields=$3,document_type=$4,case_key=$5,confirmed=$6,review_status=$7,note=$8,
      reviewed_by=$9,updated_at=now(),version=version+1 WHERE id=$1 AND branch_id=$2 AND version=$10 RETURNING id,version`,
        [
          pageId,
          branch,
          JSON.stringify(fields),
          body.document_type,
          caseKey,
          body.confirmed,
          body.review_status,
          note,
          req.user!.id,
          body.version,
        ],
      );
      if (!result.rowCount)
        throw new InputError(
          "Trang đã được người khác sửa hoặc không tồn tại. Đóng và mở lại để tải bản mới.",
          409,
        );
      await client.query(
        "INSERT INTO paper_review.audit(branch_id,page_id,user_id,change) VALUES($1,$2,$3,$4)",
        [
          branch,
          pageId,
          req.user!.id,
          JSON.stringify({
            fields,
            document_type: body.document_type,
            case_key: caseKey,
            confirmed: body.confirmed,
            review_status: body.review_status,
            note,
          }),
        ],
      );
      await client.query("COMMIT");
      res.json(result.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);
router.get(
  "/batches/:batchId/export",
  route(async (req, res) => {
    const batchId = id(req.params.batchId);
    await batch(batchId);
    const pages = await pagesFor(batchId),
      findings = checkPages(pages as ReviewPage[], await getRules());
    const workbook = new ExcelJS.Workbook(),
      sheet = workbook.addWorksheet("Rà soát hồ sơ");
    sheet.columns = [
      { header: "Nhóm lượt khám", key: "case_key", width: 25 },
      { header: "File", key: "original_name", width: 30 },
      { header: "Trang", key: "page_number", width: 8 },
      { header: "Loại giấy", key: "document_type", width: 20 },
      { header: "Mã bệnh nhân", key: "patientId", width: 20 },
      { header: "Đã xác nhận OCR", key: "confirmed", width: 20 },
      { header: "Kết quả rule", key: "result", width: 25 },
      { header: "Nội dung phát hiện", key: "findings", width: 80 },
      { header: "Xử lý", key: "review_status", width: 18 },
      { header: "Ghi chú", key: "note", width: 45 },
    ];
    for (const p of pages) {
      const fs = findings.filter((f) => f.pageIds.includes(p.id));
      sheet.addRow({
        ...p,
        patientId: p.fields.patientId,
        confirmed: p.confirmed ? "Có" : "Chưa",
        result: fs.some((f) => f.severity === "ERROR")
          ? "Có lỗi"
          : fs.length
            ? "Cần xác minh"
            : "Đạt rule đã bật",
        findings: fs.map((f) => f.message).join("\n"),
      });
    }
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = "A1:J1";
    sheet.eachRow((row) => {
      row.alignment = { vertical: "top", wrapText: true };
    });
    const fileSummary = await db.query(
      "SELECT original_name,status,error FROM paper_review.files WHERE branch_id=$1 AND batch_id=$2 ORDER BY created_at",
      [requireBranch(), batchId],
    );
    const summary = workbook.addWorksheet("Trạng thái lô");
    summary.columns = [
      { header: "File", key: "original_name", width: 40 },
      { header: "Trạng thái OCR", key: "status", width: 20 },
      { header: "Lỗi xử lý", key: "error", width: 80 },
    ];
    fileSummary.rows.forEach((f) => summary.addRow(f));
    summary.addRow({
      original_name: "Lưu ý",
      error:
        "Kết quả từng trang chỉ phản ánh các rule đã bật. File chờ/thất bại hoặc trang chưa ghép/xác nhận cần xử lý tiếp. Không xác nhận hồ sơ đủ điều kiện thanh toán.",
    });
    summary.eachRow((row) => {
      row.alignment = { wrapText: true, vertical: "top" };
    });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="bhyt-review-${batchId}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  }),
);
router.delete(
  "/batches/:batchId",
  route(async (req, res) => {
    const batchId = id(req.params.batchId),
      branch = requireBranch();
    await batch(batchId);
    const client = await db.connect();
    let ids: string[] = [];
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT id FROM paper_review.batches WHERE id=$1 AND branch_id=$2 FOR UPDATE",
        [batchId, branch],
      );
      const files = await client.query(
        "SELECT id,status FROM paper_review.files WHERE batch_id=$1 AND branch_id=$2 FOR UPDATE",
        [batchId, branch],
      );
      if (files.rows.some((f) => ["QUEUED", "PROCESSING"].includes(f.status)))
        throw new InputError("Chờ lô xử lý xong trước khi xóa.", 409);
      ids = files.rows.map((f) => f.id);
      await client.query("DELETE FROM paper_review.batches WHERE id=$1 AND branch_id=$2", [
        batchId,
        branch,
      ]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    await Promise.all(
      ids.map((fileId) => rm(fileDirectory(branch, fileId), { recursive: true, force: true })),
    );
    res.json({ success: true });
  }),
);
router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof InputError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  if (error instanceof multer.MulterError) {
    res.status(400).json({ message: "Mỗi lần tải tối đa 10 file, mỗi file tối đa 20 MB." });
    return;
  }
  res.status(503).json({
    message:
      "Không thể xử lý hồ sơ. Kiểm tra migration, dung lượng lưu trữ và kết nối cơ sở dữ liệu.",
  });
});
export default router;
