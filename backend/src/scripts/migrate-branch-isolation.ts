import "dotenv/config";
import pg from "pg";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL chưa được cấu hình.");
  // Use the same DB identity as the API, without the scoped application pool.
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const sql = await readFile(resolve("migrations/20261107_branch_isolation.sql"), "utf8");
    const client = await pool.connect();
    try {
      await client.query(sql);
      console.log("Đã áp dụng phân tách chi nhánh. Reload metadata Hasura rồi khởi động lại backend.");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Migration thất bại.");
  process.exitCode = 1;
});
