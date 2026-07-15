import { drizzle } from "drizzle-orm/node-postgres";
import { is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "@shared/schema";
import { wrapDb } from "./db_proxy";
import { logger } from "./lib/logger";

const DATABASE_URL_MISSING_MESSAGE =
  "DATABASE_URL must be set. Please check your environment variables.";

function resolveDatabaseUrl(): string | undefined {
  const isTestMode = (process.env.APP_MODE ?? "production") === "test";
  if (isTestMode && process.env.TEST_DATABASE_URL?.trim()) {
    return process.env.TEST_DATABASE_URL.trim();
  }
  return process.env.DATABASE_URL?.trim();
}

type WrappedDb = ReturnType<typeof wrapDb>;

function createUnavailableDb(): WrappedDb {
  const throwUnavailable = () => {
    throw new Error(DATABASE_URL_MISSING_MESSAGE);
  };

  return new Proxy({} as WrappedDb, {
    get(_target, prop) {
      if (prop === Symbol.toStringTag) {
        return "UnavailableDb";
      }

      return throwUnavailable;
    },
  });
}

const databaseUrl = resolveDatabaseUrl();

export const pool = new Pool({ connectionString: databaseUrl });

const wrappedDb = pool
  ? wrapDb(drizzle(pool, { schema }))
  : null;

export const db: WrappedDb = wrappedDb ?? createUnavailableDb();

/**
 * Fail-fast schema validation: run a LIMIT 0 SELECT on every table in the
 * Drizzle schema. PostgreSQL parses column references before applying LIMIT,
 * so a missing column triggers an immediate error even with no rows returned.
 *
 * The table list is derived dynamically from the schema barrel so newly added
 * tables and columns are covered automatically — a hardcoded list was the
 * reason a missing `social_icebreaker_participants.is_test_bot` column slipped
 * through to staging and hung every icebreaker /start request.
 *
 * This catches the common deployment mistake where code is deployed but
 * the corresponding Drizzle migration / db:push was skipped.
 */
/**
 * Enumerate every Drizzle table exported by the shared schema barrel.
 * Derived dynamically so newly added tables are covered automatically — a
 * hardcoded list was the reason a missing
 * `social_icebreaker_participants.is_test_bot` column slipped through to
 * staging and hung every icebreaker /start request.
 */
export function listSchemaTables(): Array<{ exportName: string; table: PgTable }> {
  return Object.entries(schema)
    .filter(([, value]) => is(value, PgTable))
    .map(([exportName, table]) => ({ exportName, table: table as PgTable }));
}

export async function validateDbSchema(): Promise<void> {
  if (!pool) {
    logger.warn("[DB] Skipping schema validation — DATABASE_URL not set");
    return;
  }

  const schemaTables = listSchemaTables();

  if (schemaTables.length === 0) {
    logger.warn("[DB] Schema validation found no tables to check — falling back to no-op");
    return;
  }

  await Promise.all(
    schemaTables.map(async ({ exportName, table }) => {
      try {
        await db.select().from(table as never).limit(0);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("does not exist")) {
          logger.error(`[DB] Schema mismatch detected on ${exportName}`, { error: message });
          throw new Error(
            `Database schema mismatch: ${message}. ` +
              `Run migrations or 'npm run db:push' before starting the server.`
          );
        }
        throw err;
      }
    })
  );
  logger.info(`[DB] Schema OK — ${schemaTables.length} tables verified`);

  // Warn if admin_accounts table is empty — no admin can log in
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.adminAccounts);
    if (result.count === 0) {
      logger.warn(
        "[DB] admin_accounts table is EMPTY — no admin users can log in. " +
        "Run 'npm run admin:create <username> <password> <secretKey> super_admin' to add one."
      );
    }
  } catch (err) {
    // Non-fatal: admin_accounts may not exist yet during initial setup
    logger.warn("[DB] Could not verify admin_accounts count", { error: err instanceof Error ? err.message : String(err) });
  }
}
