import type { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import { db } from "../db";
import { logger } from "../lib/logger";

const BAN_CACHE_TTL_MS = 30_000;
const banCache = new Map<string, { banned: boolean; ts: number }>();

/** Drop the cached ban state for a user (call on ban/unban). */
export function clearUserBanCache(userId: string): void {
  banCache.delete(userId);
}

/**
 * Fail-closed ban lookup with a short TTL so the check costs at most one
 * primary-key SELECT per active user per 30s. Skipped in unit tests that have
 * no DB (NODE_ENV=test only; unreachable in production/staging).
 */
export async function isUserBanned(userId: string): Promise<boolean> {
  if (process.env.NODE_ENV === "test") {
    return false;
  }
  const now = Date.now();
  const cached = banCache.get(userId);
  if (cached && now - cached.ts < BAN_CACHE_TTL_MS) {
    return cached.banned;
  }
  const [row] = await db
    .select({ isBanned: users.isBanned })
    .from(users)
    .where(eq(users.id, userId));
  const banned = Boolean(row?.isBanned);
  banCache.set(userId, { banned, ts: now });
  return banned;
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    if (await isUserBanned(userId)) {
      return res
        .status(403)
        .json({ message: "账号已被封禁", code: "USER_BANNED" });
    }
  } catch (error) {
    logger.error("requireAuth ban check failed", {
      userId,
      error: String(error),
    });
    return res.status(503).json({ message: "Service temporarily unavailable" });
  }
  next();
};
