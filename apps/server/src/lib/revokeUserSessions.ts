import { sql } from "drizzle-orm";
import { db } from "../db";
import { logger } from "./logger";

type SessionStoreExecutor = Pick<typeof db, "execute">;

/**
 * Delete every stored session belonging to a user (cookie + X-Session-Token
 * both resolve through the same `sessions` store). Used on ban so a flagged
 * account is logged out immediately on all devices.
 */
export async function revokeUserSessions(userId: string, executor: SessionStoreExecutor = db): Promise<number> {
  const result = await executor.execute(
    sql`DELETE FROM sessions WHERE sess->>'userId' = ${userId}`,
  );
  const count = result.rowCount ?? 0;
  logger.info("[Auth] Revoked user sessions", { userId, count });
  return count;
}

export async function revokeAdminSessions(adminAccountId: string, executor: SessionStoreExecutor = db): Promise<number> {
  const result = await executor.execute(
    sql`DELETE FROM sessions WHERE sess->>'adminAccountId' = ${adminAccountId}`,
  );
  const count = result.rowCount ?? 0;
  logger.info("[Auth] Revoked admin sessions", { adminAccountId, count });
  return count;
}
