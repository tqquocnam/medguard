import { randomUUID } from "node:crypto";
import { db } from "../../config/database.js";
import { requireBranch } from "../../config/branch-context.js";
import { aiDailyLimit, aiModel, type AiAnalysis } from "./review.ai.js";
export async function reserveAiRequest(fileId: string, page: number): Promise<string> {
  const branch = requireBranch(),
    client = await db.connect(),
    id = randomUUID();
  try {
    await client.query("BEGIN");
    // One short transaction per branch; failed provider calls count toward the cap too.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`paper-review-ai:${branch}`]);
    const count = await client.query(
      `SELECT count(*)::int AS n FROM paper_review.ai_requests
      WHERE branch_id=$1 AND created_at >= date_trunc('day',now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh'`,
      [branch],
    );
    if (count.rows[0].n >= aiDailyLimit())
      throw new Error("AI: đã đạt giới hạn số trang gọi API trong ngày của chi nhánh.");
    await client.query(
      "INSERT INTO paper_review.ai_requests(id,branch_id,file_id,page_number,model) VALUES($1,$2,$3,$4,$5)",
      [id, branch, fileId, page, aiModel()],
    );
    await client.query("COMMIT");
    return id;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function finishAiRequest(id: string, analysis: AiAnalysis): Promise<void> {
  await db.query(
    "UPDATE paper_review.ai_requests SET succeeded=true,input_tokens=$3,output_tokens=$4 WHERE id=$1 AND branch_id=$2",
    [id, requireBranch(), analysis.inputTokens, analysis.outputTokens],
  );
}
