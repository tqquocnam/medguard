/** Disposable database only. Provider responses are mocked: no patient data or paid API calls. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import pg from "pg";
import sharp from "sharp";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
test("AI queue: auto extract/group/check, safe reread, per-branch quota and API isolation", async () => {
  const connection = process.env.TEST_DATABASE_URL;
  assert(
    connection && new URL(connection).pathname === "/medguard_review_ai_test",
    "Use a new disposable medguard_review_ai_test database.",
  );
  process.env.DATABASE_URL = connection;
  process.env.JWT_SECRET = "test-only-secret";
  process.env.PAPER_REVIEW_READER = "openai";
  process.env.OPENAI_API_KEY = "test-only-not-real";
  process.env.PAPER_REVIEW_AI_DAILY_LIMIT = "4";
  process.env.PAPER_REVIEW_STORAGE = await mkdtemp(path.join(tmpdir(), "paper-ai-integration-"));
  const admin = new pg.Pool({ connectionString: connection });
  await admin.query(`CREATE SCHEMA auth;
 DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='medguard_branch') THEN CREATE ROLE medguard_branch NOLOGIN; END IF; END $$;
 CREATE TABLE auth.branches(id varchar(5) PRIMARY KEY,name text,active boolean DEFAULT true);
 CREATE TABLE auth.users(id uuid PRIMARY KEY,username text,full_name text,role text,active boolean DEFAULT true,branch_id varchar(5) REFERENCES auth.branches(id));
 CREATE FUNCTION auth.current_branch_id() RETURNS varchar(5) LANGUAGE SQL STABLE AS $$ SELECT NULLIF(current_setting('medguard.branch_id',true),'')::varchar(5) $$;
 GRANT USAGE ON SCHEMA auth TO medguard_branch;GRANT SELECT ON ALL TABLES IN SCHEMA auth TO medguard_branch;`);
  const userA = randomUUID(),
    userB = randomUUID();
  await admin.query(
    "INSERT INTO auth.branches(id,name) VALUES('96230','Test A'),('96172','Test B')",
  );
  await admin.query(
    "INSERT INTO auth.users(id,username,role,branch_id) VALUES($1,'test-a','ADMIN','96230'),($2,'test-b','ADMIN','96172')",
    [userA, userB],
  );
  for (const migration of ["20261115_paper_review.sql", "20261116_paper_review_ai.sql"])
    await admin.query(await readFile(path.resolve("migrations", migration), "utf8"));
  const { default: routes } = await import("../src/modules/paper-review/review.routes.js");
  const { requireAuth } = await import("../src/modules/auth/auth.middleware.js");
  const { processNextFile } = await import("../src/modules/paper-review/review.worker.js");
  const { db } = await import("../src/config/database.js");
  const { withBranch } = await import("../src/config/branch-context.js");
  const { AUTH_COOKIE_NAME } = await import("../src/modules/auth/auth.cookies.js");
  let providerCalls = 0,
    providerFail = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url, init) => {
    if (String(url) !== "https://api.openai.com/v1/responses") return originalFetch(url, init);
    providerCalls++;
    if (providerFail) return new Response("do-not-expose-provider-content", { status: 429 });
    const values = {
      patientId: "TEST-PATIENT",
      encounterId: "TEST-VISIT",
      name: "SYNTHETIC PERSON",
      birthDate: "01/01/1975",
      gender: "NU",
      visitDate: "11/11/2026",
      weight: "",
      icd: "K58.8",
    };
    const observations = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [
        k,
        { value: v, status: v ? "PRESENT" : "MISSING", evidence: v ? `${k}: ${v}` : "" },
      ]),
    );
    return new Response(
      JSON.stringify({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({ documentType: "STATEMENT", observations, issues: [] }),
              },
            ],
          },
        ],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    );
  }) as typeof fetch;
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/review", requireAuth, routes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address();
  assert(address && typeof address !== "string");
  async function api(url: string, method = "GET", body?: unknown, user = userA) {
    return originalFetch(`http://127.0.0.1:${address.port}/review${url}`, {
      method,
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=${jwt.sign({ sub: user }, process.env.JWT_SECRET!, { expiresIn: "1h" })}`,
        ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  }
  try {
    const cap = await (await api("/capabilities")).json();
    assert.equal(cap.ready, true);
    assert.equal(cap.reader, "openai");
    assert.equal(JSON.stringify(cap).includes("test-only-not-real"), false);
    const batchId = (await (await api("/batches", "POST", { name: "Synthetic AI batch" })).json())
      .id;
    const image = await sharp({
      create: { width: 600, height: 800, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const payload = new FormData();
    payload.append("files", new Blob([new Uint8Array(image)]), "synthetic.png");
    assert.equal((await api(`/batches/${batchId}/files`, "POST", payload)).status, 202);
    process.env.PAPER_REVIEW_READER = "tesseract";
    assert.equal(await processNextFile("96230"), false);
    assert.equal(providerCalls, 0);
    process.env.PAPER_REVIEW_READER = "openai";
    assert(await processNextFile("96230"));
    let batch = await (await api(`/batches/${batchId}`)).json();
    assert.equal(batch.files[0].status, "COMPLETED", batch.files[0].error);
    assert.equal(batch.pages.length, 1);
    assert.equal(batch.pages[0].ai_processed, true);
    assert.equal(batch.pages[0].confirmed, false);
    assert.equal(batch.pages[0].case_key, "TEST-VISIT@11/11/2026");
    assert.equal(batch.findings.length, 0);
    assert.equal(batch.pages[0].ocr, undefined);
    const initialPage = batch.pages[0];
    const usage = await (await api("/ai-usage")).json();
    assert.equal(usage.requests, 1);
    assert.equal(usage.input_tokens, 100);
    assert.equal((await api(`/batches/${batchId}/read-ai`, "POST", {}, userB)).status, 404);
    const foreign = await withBranch({ branchId: "96172", userId: userB }, () =>
      db.query("SELECT * FROM paper_review.ai_requests"),
    );
    assert.equal(foreign.rowCount, 0);
    assert.equal((await (await api(`/batches/${batchId}/read-ai`, "POST", {})).json()).queued, 1);
    // Force a provider error: page and its previous data must survive for a retry.
    providerFail = true;
    await processNextFile("96230");
    batch = await (await api(`/batches/${batchId}`)).json();
    assert.equal(batch.files[0].status, "FAILED");
    assert(!batch.files[0].error.includes("do-not-expose"));
    assert.equal(batch.pages[0].id, initialPage.id);
    providerFail = false;
    assert.equal((await api(`/files/${batch.files[0].id}/retry`, "POST", {})).status, 200);
    await processNextFile("96230");
    batch = await (await api(`/batches/${batchId}`)).json();
    assert.equal(batch.files[0].status, "COMPLETED");
    assert.equal(batch.pages[0].id, initialPage.id);
    assert(batch.pages[0].version > initialPage.version);
    // Exhaust the daily budget: worker must not make an outbound request.
    process.env.PAPER_REVIEW_AI_DAILY_LIMIT = "3";
    const before = providerCalls;
    await api(`/batches/${batchId}/read-ai`, "POST", {});
    await processNextFile("96230");
    assert.equal(providerCalls, before);
    batch = await (await api(`/batches/${batchId}`)).json();
    assert.equal(batch.files[0].status, "FAILED");
    assert(batch.files[0].error.includes("giới hạn"));
    // A human edit protects the page from all subsequent AI rereads.
    const p = batch.pages[0];
    assert.equal(
      (
        await api(`/pages/${p.id}`, "PATCH", {
          ...p,
          fields: { ...p.fields, name: "HUMAN CORRECTION" },
          review_status: "NEEDS_FIX",
          note: "Manually checked",
          confirmed: false,
        })
      ).status,
      200,
    );
    assert.equal((await (await api(`/batches/${batchId}/read-ai`, "POST", {})).json()).queued, 0);
    assert.equal(
      (await (await api(`/batches/${batchId}`)).json()).pages[0].fields.name,
      "HUMAN CORRECTION",
    );
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
    await db.end();
    await admin.end();
    await rm(process.env.PAPER_REVIEW_STORAGE, { recursive: true, force: true });
  }
});
