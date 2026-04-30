import { db } from "../../db";
import { userInterestSignals } from "@shared/schema";
import { inArray } from "drizzle-orm";

export type UserInterestSignalRow = typeof userInterestSignals.$inferSelect;

/**
 * Batch-load interest signals for multiple users.
 * Returns a Map<userId, UserInterestSignal[]>.
 */
export async function loadInterestSignalsByUserIds(
  userIds: string[],
): Promise<Map<string, UserInterestSignalRow[]>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(userInterestSignals)
    .where(inArray(userInterestSignals.userId, userIds));
  const map = new Map<string, UserInterestSignalRow[]>();
  for (const row of rows) {
    const existing = map.get(row.userId) ?? [];
    existing.push(row);
    map.set(row.userId, existing);
  }
  return map;
}

/**
 * Normalizes an optional duration value.
 * Returns the number if it's a non-negative number, otherwise null.
 */
export function normalizeOptionalDuration(value: unknown): number | null {
  if (typeof value !== "number") return null;
  if (value < 0) return null;
  return value;
}
