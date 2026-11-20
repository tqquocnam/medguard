/** Run only against a disposable database named medguard_review_test.
 * TEST_DATABASE_URL=postgres://.../medguard_review_test node --import tsx --test tests/paper-review.integration.ts
 * Requires installed Tesseract vie+eng and Poppler. No production database may be used.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import pg from "pg";
import jwt from "jsonwebtoken";
import ExcelJS from "exceljs";
import sharp from "sharp";
function pdf(pages: string[]): Buffer {
  const objects = ["", ""];
  const kids: string[] = [];
  for (const text of pages) {
    const pageId = objects.length + 1,
      contentId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentId} 0 R >>`,
    );
    const stream = `BT /F1 20 Tf 40 780 Td (${text}) Tj ET`;
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(output));
    output += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const start = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((o) => {
    output += `${String(o).padStart(10, "0")} 00000 n \n`;
  });
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(output);
}
test("paper-review API, durable queue, PDF OCR, RLS, optimistic edits and Excel", async () => {
  const connection = process.env.TEST_DATABASE_URL;
  assert(
    connection && new URL(connection).pathname === "/medguard_review_test",
    "Use a fresh disposable database named medguard_review_test.",
  );
  process.env.DATABASE_URL = connection;
  process.env.JWT_SECRET = "disposable-paper-review-test-secret";
  process.env.PAPER_REVIEW_STORAGE = await mkdtemp(path.join(tmpdir(), "paper-review-test-"));
  const admin = new pg.Pool({ connectionString: connection });
  await admin.query(`CREATE SCHEMA auth; DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='medguard_branch') THEN CREATE ROLE medguard_branch NOLOGIN; END IF; END $$;
    CREATE TABLE auth.branches(id varchar(5) PRIMARY KEY,name text,active boolean DEFAULT true);
    CREATE TABLE auth.users(id uuid PRIMARY KEY,username text,full_name text,role text,active boolean DEFAULT true,branch_id varchar(5) REFERENCES auth.branches(id));
    CREATE FUNCTION auth.current_branch_id() RETURNS varchar(5) LANGUAGE SQL STABLE AS $$ SELECT NULLIF(current_setting('medguard.branch_id',true),'')::varchar(5) $$;
    GRANT USAGE ON SCHEMA auth TO medguard_branch; GRANT SELECT ON ALL TABLES IN SCHEMA auth TO medguard_branch;`);
  const userA = randomUUID(),
    userB = randomUUID();
  await admin.query(
    "INSERT INTO auth.branches(id,name) VALUES('96230','Test A'),('96172','Test B')",
  );
  await admin.query(
    "INSERT INTO auth.users(id,username,role,branch_id) VALUES($1,'test-a','ADMIN','96230'),($2,'test-b','ADMIN','96172')",
    [userA, userB],
  );
  await admin.query(await readFile(path.resolve("migrations/20261115_paper_review.sql"), "utf8"));
  await admin.query(
    await readFile(path.resolve("migrations/20261116_paper_review_ai.sql"), "utf8"),
  );
  const { default: routes } = await import("../src/modules/paper-review/review.routes.js");
  const { requireAuth } = await import("../src/modules/auth/auth.middleware.js");
  const { processNextFile } = await import("../src/modules/paper-review/review.worker.js");
  const { withBranch } = await import("../src/config/branch-context.js");
  const { db } = await import("../src/config/database.js");
  const { AUTH_COOKIE_NAME } = await import("../src/modules/auth/auth.cookies.js");
  const { capabilities } = await import("../src/modules/paper-review/review.ocr.js");
  assert((await capabilities()).ready, "OCR dependencies must be installed.");
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/review", requireAuth, routes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/review`;
  const cookie = (user: string) =>
    `${AUTH_COOKIE_NAME}=${jwt.sign({ sub: user }, process.env.JWT_SECRET!, { algorithm: "HS256", expiresIn: "1h" })}`;
  async function api(url: string, method = "GET", body?: unknown, user = userA) {
    return fetch(base + url, {
      method,
      headers: {
        cookie: cookie(user),
        ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  }
  try {
    assert.equal((await fetch(base + "/batches")).status, 401);
    const created = await api("/batches", "POST", { name: "Synthetic test batch" });
    assert.equal(created.status, 201);
    const batchId = (await created.json()).id;
    assert.equal((await api("/batches/" + batchId, "GET", undefined, userB)).status, 404);
    const payload = () => {
      const f = new FormData();
      f.append(
        "files",
        new Blob([pdf(["DON THUOC", "PHIEU CHI DINH"])], { type: "application/pdf" }),
        "synthetic.pdf",
      );
      return f;
    };
    assert.equal((await api(`/batches/${batchId}/files`, "POST", payload())).status, 202);
    assert.equal(
      (await (await api(`/batches/${batchId}/files`, "POST", payload())).json()).duplicates.length,
      1,
    );
    const [processedA, processedB] = await Promise.all([
      processNextFile("96230"),
      processNextFile("96230"),
    ]);
    assert.equal(Number(processedA) + Number(processedB), 1);
    let batch = await (await api("/batches/" + batchId)).json();
    assert.equal(batch.files[0].status, "COMPLETED", batch.files[0].error);
    assert.equal(batch.pages.length, 2);
    const p = batch.pages[0];
    assert.equal(p.confirmed, false);
    assert.equal(p.case_key, "");
    assert(batch.findings.some((f: { code: string }) => f.code === "CASE_UNASSIGNED"));
    assert.equal((await api(`/pages/${p.id}/image`, "GET", undefined, userB)).status, 404);
    assert.equal((await api(`/pages/${p.id}`, "GET", undefined, userB)).status, 404);
    assert.equal((await api(`/files/${batch.files[0].id}/retry`, "POST", {}, userB)).status, 409);
    const direct = await withBranch({ branchId: "96172", userId: userB }, () =>
      db.query("SELECT * FROM paper_review.pages WHERE id=$1", [p.id]),
    );
    assert.equal(direct.rowCount, 0);
    const image = await api(`/pages/${p.id}/image`);
    assert.equal(image.status, 200);
    assert(image.headers.get("content-type")?.includes("image/png"));
    await admin.query("UPDATE paper_review.pages SET fields=fields || $2::jsonb WHERE id=$1", [
      p.id,
      JSON.stringify({ encounterId: "TEST-VISIT", visitDate: "11/11/2026" }),
    ]);
    assert.equal(
      (await (await api(`/batches/${batchId}/suggest-groups`, "POST", {})).json()).grouped,
      1,
    );
    batch = await (await api("/batches/" + batchId)).json();
    assert.equal(batch.pages.find((x: { id: string }) => x.id === p.id).confirmed, false);
    assert.equal(
      (
        await api("/pages/group", "POST", {
          case_key: "test-visit",
          pages: batch.pages.map((x: { id: string; version: number }) => ({
            id: x.id,
            version: x.version,
          })),
        })
      ).status,
      200,
    );
    batch = await (await api("/batches/" + batchId)).json();
    const edit = batch.pages[0];
    const values = {
      ...edit,
      document_type: "STATEMENT",
      confirmed: true,
      review_status: "NEEDS_FIX",
      fields: { ...edit.fields, birthDate: "01/01/1975", gender: "NU", icd: "K58.8" },
    };
    assert.equal((await api(`/pages/${p.id}`, "PATCH", values)).status, 200);
    assert.equal((await api(`/pages/${p.id}`, "PATCH", values)).status, 409);
    const detail = await (await api(`/pages/${p.id}`)).json();
    assert(detail.ocr.text.length > 0);
    const exported = await api(`/batches/${batchId}/export`);
    assert.equal(exported.status, 200);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(await exported.arrayBuffer()));
    assert.equal(book.worksheets[0]?.rowCount, 3);
    const audit = await withBranch({ branchId: "96230", userId: userA }, () =>
      db.query("SELECT * FROM paper_review.audit"),
    );
    assert.equal(audit.rowCount, 4);
    // Exercise raster preprocessing and reject deletion while work is queued.
    const imageBatch = (await (await api("/batches", "POST", { name: "Synthetic JPEG" })).json())
      .id;
    const jpeg = await sharp(
      Buffer.from(
        '<svg width="800" height="1200"><rect width="800" height="1200" fill="white"/><text x="60" y="100" font-size="40">SAMPLE IMAGE</text></svg>',
      ),
    )
      .jpeg()
      .toBuffer();
    const imagePayload = new FormData();
    imagePayload.append("files", new Blob([new Uint8Array(jpeg)]), "sample.jpg");
    assert.equal((await api(`/batches/${imageBatch}/files`, "POST", imagePayload)).status, 202);
    assert.equal((await api(`/batches/${imageBatch}`, "DELETE")).status, 409);
    assert(await processNextFile("96230"));
    const imageResult = await (await api(`/batches/${imageBatch}`)).json();
    assert.equal(imageResult.files[0].status, "COMPLETED", imageResult.files[0].error);
    assert.equal(imageResult.pages.length, 1);
    assert.equal((await api(`/batches/${imageBatch}`, "DELETE")).status, 200);
    // Simulate a crashed worker: persisted original survives; lease expires; pages are retained.
    await admin.query(
      "UPDATE paper_review.files SET status='PROCESSING',attempts=1,lease_until=now()-interval '1 second',lease_token=$1 WHERE id=$2",
      [randomUUID(), batch.files[0].id],
    );
    assert(await processNextFile("96230"));
    const recovered = await (await api("/batches/" + batchId)).json();
    assert.equal(recovered.pages.length, 2);
    assert.equal(recovered.pages.find((x: { id: string }) => x.id === p.id).confirmed, true);
    assert.equal((await api(`/batches/${batchId}`, "DELETE")).status, 200);
    assert.equal((await api(`/pages/${p.id}/image`)).status, 404);
  } finally {
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
    await db.end();
    await admin.end();
    await rm(process.env.PAPER_REVIEW_STORAGE, { recursive: true, force: true });
  }
});
