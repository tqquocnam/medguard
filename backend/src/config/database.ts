import pg, { type PoolClient, type QueryResult } from "pg";

import "dotenv/config";

import { currentBranch } from "./branch-context.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL chưa được cấu hình");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const releases = new WeakMap<PoolClient, (error?: Error | boolean) => Promise<void>>();

async function connect(): Promise<PoolClient> {
  const branchId = currentBranch();

  const client = await pool.connect();

  const originalRelease = client.release.bind(client);

  try {
    // Xóa trạng thái cũ khi lấy kết nối từ pool.
    await client.query("RESET ROLE");

    await client.query(
      `
      SELECT set_config(
        'medguard.branch_id',
        $1,
        false
      )
      `,
      [branchId ?? ""],
    );

    await client.query("SET ROLE medguard_branch");
  } catch (error) {
    originalRelease(true);
    throw error;
  }

  let released = false;

  const release = async (error?: Error | boolean): Promise<void> => {
    if (released) {
      return;
    }

    released = true;
    releases.delete(client);

    if (error) {
      originalRelease(error);
      return;
    }

    try {
      // Không trả transaction lỗi hoặc chưa đóng về pool.
      await client.query("ROLLBACK");

      await client.query("RESET ROLE");

      await client.query(
        `
        SELECT set_config(
          'medguard.branch_id',
          '',
          false
        )
        `,
      );

      originalRelease();
    } catch {
      originalRelease(true);
    }
  };

  releases.set(client, release);

  client.release = (error?: Error | boolean): void => {
    void release(error);
  };

  return client;
}

async function runQuery(args: unknown[]): Promise<QueryResult> {
  const client = await connect();

  const release = releases.get(client)!;

  try {
    const execute = client.query.bind(client) as (...values: unknown[]) => Promise<QueryResult>;

    return await execute(...args);
  } finally {
    await release();
  }
}

function query(...args: unknown[]): Promise<QueryResult> | void {
  const callback =
    typeof args[args.length - 1] === "function"
      ? (args.pop() as (error: Error | null, result?: QueryResult) => void)
      : null;

  const result = runQuery(args);

  if (!callback) {
    return result;
  }

  void result.then(
    (value) => callback(null, value),
    (error) => callback(error),
  );
}

export const db: pg.Pool = new Proxy(pool, {
  get(target, property) {
    if (property === "query") {
      return query;
    }

    if (property === "connect") {
      return (
        callback?: (
          error: Error | undefined,
          client?: PoolClient,
          release?: PoolClient["release"],
        ) => void,
      ) => {
        if (!callback) {
          return connect();
        }

        void connect().then(
          (client) => callback(undefined, client, client.release),

          (error) => callback(error instanceof Error ? error : new Error(String(error))),
        );
      };
    }

    const value: unknown = Reflect.get(target, property, target);

    if (typeof value !== "function") {
      return value;
    }

    return (...args: unknown[]) => {
      const result: unknown = Reflect.apply(value, target, args);

      return result === target ? db : result;
    };
  },
});

pool.on("error", (error) => {
  console.error("PostgreSQL error:", error);
});
