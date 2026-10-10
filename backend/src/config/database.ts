import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL chưa được cấu hình"
  );
}

export const db = new Pool({
  connectionString:
    process.env.DATABASE_URL,
});

db.on("error", (error) => {
  console.error(
    "PostgreSQL error:",
    error
  );
});