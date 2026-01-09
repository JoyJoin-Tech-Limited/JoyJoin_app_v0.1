import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "@shared/schema";
import { wrapDb } from "./db_proxy";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Please check your environment variables.");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const _db = drizzle(pool, { schema });
export const db = wrapDb(_db);
