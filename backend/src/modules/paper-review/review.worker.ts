import { aiEnabled } from "./review.ai.js";
import { reserveAiRequest, finishAiRequest } from "./review.ai-budget.js";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { db } from "../../config/database.js";
import { withBranch } from "../../config/branch-context.js";
import { capabilities, fileDirectory, pageCount, recognizePage } from "./review.ocr.js";
import { extract, suggestedCaseKey } from "./review.engine.js";
let running = false;
let warned = false;
export async function processNextFile(branchId: string): Promise<boolean> {
  return withBranch({ branchId, userId: "paper-review-worker" }, async () => {
    const token = randomUUID();
    const claim = await db.query(
      `UPDATE paper_review.files SET status='PROCESSING', attempts=attempts+1,
      lease_token=$2, lease_until=now()+interval '2 minutes', error=NULL
      WHERE id=(SELECT id FROM paper_review.files WHERE branch_id=$1 AND reader=$3 AND attempts < 3
        AND (status='QUEUED' OR (status='PROCESSING' AND lease_until < now()))
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
      RETURNING *`,
      [branchId, token, aiEnabled() ? "openai" : "tesseract"],
    );
    const file = claim.rows[0];
    if (!file) {
      await db.query(
        `UPDATE paper_review.files SET status='FAILED', error='Đã gián đoạn 3 lần. Kiểm tra máy chủ rồi thử lại.', lease_token=NULL
        WHERE branch_id=$1 AND status='PROCESSING' AND lease_until < now() AND attempts>=3`,
        [branchId],
      );
      return false;
    }
    let leaseLost = false;
    const heartbeat = setInterval(() => {
      void db
        .query(
          `UPDATE paper_review.files SET lease_until=now()+interval '2 minutes' WHERE branch_id=$1 AND id=$2 AND lease_token=$3 RETURNING id`,
          [branchId, file.id, token],
        )
        .then((r) => {
          if (!r.rowCount) leaseLost = true;
        })
        .catch(() => {
          leaseLost = true;
        });
    }, 20000);
    heartbeat.unref();
    try {
      const dir = fileDirectory(branchId, file.id);
      const count = await pageCount(path.join(dir, "original"), file.mime_type);
      for (let page = 1; page <= count; page++) {
        if (leaseLost) throw new Error("Mất quyền xử lý; chờ hàng đợi phục hồi.");
        const exists = await db.query(
          "SELECT id,confirmed,reviewed_by,ocr FROM paper_review.pages WHERE branch_id=$1 AND file_id=$2 AND page_number=$3",
          [branchId, file.id, page],
        );
        const previous = exists.rows[0];
        if (
          previous &&
          (!file.reprocess_token ||
            previous.confirmed ||
            previous.reviewed_by ||
            previous.ocr?.ai?.reprocessToken === file.reprocess_token)
        )
          continue;
        const requestId = aiEnabled() ? await reserveAiRequest(file.id, page) : null;
        const { imageName, ocr } = await recognizePage(dir, file.mime_type, page);
        if (leaseLost) throw new Error("Mất quyền xử lý; chờ hàng đợi phục hồi.");
        if (ocr.ai) {
          if (file.reprocess_token) ocr.ai.reprocessToken = file.reprocess_token;
          if (requestId) await finishAiRequest(requestId, ocr.ai);
        }
        const parsed = ocr.ai
          ? { fields: ocr.ai.fields, documentType: ocr.ai.documentType }
          : extract(ocr);
        const autoCase = ocr.ai ? suggestedCaseKey(parsed.fields) : "";
        // AI uses explicit encounter+date only; patient-ID-only grouping stays disallowed.
        await db.query(
          `INSERT INTO paper_review.pages(id, branch_id, file_id, batch_id, page_number, image_name, ocr, fields, document_type, case_key)
          SELECT $1::uuid,$2::varchar(5),$3::uuid,$4::uuid,$5::integer,$6::text,$7::jsonb,$8::jsonb,$9::text,$11::text WHERE EXISTS(SELECT 1 FROM paper_review.files WHERE id=$3 AND branch_id=$2 AND lease_token=$10)
          ON CONFLICT(branch_id,file_id,page_number) DO UPDATE SET
            image_name=excluded.image_name,ocr=excluded.ocr,fields=excluded.fields,document_type=excluded.document_type,
            case_key=excluded.case_key,version=paper_review.pages.version+1,updated_at=now()
            WHERE paper_review.pages.confirmed=false AND paper_review.pages.reviewed_by IS NULL`,
          [
            randomUUID(),
            branchId,
            file.id,
            file.batch_id,
            page,
            imageName,
            JSON.stringify(ocr),
            JSON.stringify(parsed.fields),
            parsed.documentType,
            token,
            autoCase,
          ],
        );
      }
      await db.query(
        `UPDATE paper_review.files SET status='COMPLETED', lease_until=NULL, lease_token=NULL,reprocess_token=NULL WHERE id=$1 AND branch_id=$2 AND lease_token=$3`,
        [file.id, branchId, token],
      );
    } catch (error) {
      // Keep patient content and local paths out of operational logs and errors.
      const safeMessage =
        error instanceof Error && /^(PDF phải|Ảnh quá|Mất quyền|AI)/.test(error.message)
          ? error.message
          : "Không đọc được file. Kiểm tra PDF/ảnh, OCR và dung lượng ổ đĩa rồi thử lại.";
      await db.query(
        `UPDATE paper_review.files SET status='FAILED', error=$4, lease_until=NULL, lease_token=NULL WHERE id=$1 AND branch_id=$2 AND lease_token=$3`,
        [file.id, branchId, token, safeMessage],
      );
    } finally {
      clearInterval(heartbeat);
    }
    return true;
  });
}
export function startPaperReviewWorker(): void {
  if (process.env.PAPER_REVIEW_ENABLED === "false") return;
  // One file/page at a time per backend process. SQL leases prevent duplicate claims.
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      if (!(await capabilities()).ready) return;
      const branches = await db.query("SELECT id FROM auth.branches WHERE active=true ORDER BY id");
      for (const branch of branches.rows) await processNextFile(String(branch.id));
    } catch {
      if (!warned) {
        console.warn("Paper review worker chưa sẵn sàng. Kiểm tra migration và cấu hình OCR.");
        warned = true;
      }
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => {
    void tick();
  }, 3000);
  timer.unref();
  void tick();
}
