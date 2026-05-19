import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";
import { wrapDb } from "./db_proxy";

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
