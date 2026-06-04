import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";
import { wrapDb } from "./db_proxy";
import { logger } from "./lib/logger";

const DATABASE_URL_MISSING_MESSAGE =
  "DATABASE_URL must be set. Please check your environment variables.";

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

const databaseUrl = process.env.DATABASE_URL?.trim();

export const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : null;

const wrappedDb = pool
  ? wrapDb(drizzle(pool, { schema }))
  : null;

export const db: WrappedDb = wrappedDb ?? createUnavailableDb();

/**
 * Fail-fast schema validation: run a LIMIT 0 SELECT on critical tables.
 * PostgreSQL parses column references before applying LIMIT, so a missing
 * column triggers an immediate error even with no rows returned.
 *
 * This catches the common deployment mistake where code is deployed but
 * the corresponding Drizzle migration / db:push was skipped.
 */
export async function validateDbSchema(): Promise<void> {
  if (!pool) {
    logger.warn("[DB] Skipping schema validation — DATABASE_URL not set");
    return;
  }

  const criticalTables = [
    { name: "users", table: schema.users },
    { name: "assessment_sessions", table: schema.assessmentSessions },
    { name: "assessment_answers", table: schema.assessmentAnswers },
    { name: "social_icebreaker_sessions", table: schema.socialIcebreakerSessions },
    { name: "event_pools", table: schema.eventPools },
  ] as const;

  await Promise.all(
    criticalTables.map(async ({ name, table }) => {
      try {
        await db.select().from(table).limit(0);
        logger.info(`[DB] Schema OK — ${name}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("does not exist")) {
          logger.error(`[DB] Schema mismatch detected on ${name}`, { error: message });
          throw new Error(
            `Database schema mismatch: ${message}. ` +
              `Run migrations or 'npm run db:push' before starting the server.`
          );
        }
        throw err;
      }
    })
  );
}
