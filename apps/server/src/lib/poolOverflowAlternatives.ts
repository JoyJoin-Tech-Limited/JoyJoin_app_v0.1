import { and, asc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { eventPoolRegistrations, eventPools } from "@shared/schema";
import type { PoolOverflowAlternative } from "@shared/api/eventPools";
import { db } from "../db";

/**
 * 撞满后的改签出口（D4, 2026-11-11）。
 *
 * 63/72 的席位填充率说明「撞满」多数是库存错配，不是真的没有座位：同一个区、
 * 同一个时段，隔壁那场往往还空着。所以满员不该是一句「本场活动报名已满」的
 * 死胡同，而应把最近的空位直接递到用户手上。
 *
 * 规则（刻意保守）：
 * - 同城、同区（有区名时），近 7 天内，`spotsLeft > 0`；
 * - 排除当前场、非 active、测试池；
 * - 最多 3 个，按时间升序（尽快能去的那场排前面）。
 *
 * 只做「指向」，不做静默换场：用户必须自己点，绝不替用户改签。
 */
export const POOL_OVERFLOW_ALTERNATIVE_LIMIT = 3;

/** 只看近 7 天，避免把一个月后的场推给一个今晚就想出门的人。 */
const ALTERNATIVE_LOOKAHEAD_MS = 7 * 24 * 60 * 60 * 1000;

export type { PoolOverflowAlternative } from "@shared/api/eventPools";

interface CandidateRow {
  id: string;
  title: string;
  eventType: string | null;
  dateTime: Date | string;
  city: string | null;
  district: string | null;
  price: number | null;
  minGroupSize: number | null;
  maxGroupSize: number | null;
  targetGroups: number | null;
}

function capacityOf(pool: {
  minGroupSize: number | null;
  maxGroupSize: number | null;
  targetGroups: number | null;
}): number {
  const minGroupSize = Math.max(pool.minGroupSize ?? 4, 1);
  const maxGroupSize = Math.max(pool.maxGroupSize ?? minGroupSize, minGroupSize);
  const targetGroups = Math.max(pool.targetGroups ?? 1, 1);
  return maxGroupSize * targetGroups;
}

/**
 * 返回同城同区里还有名额的其他场次。任何查询失败都返回空数组 —— 出口是
 * 额外的好意，不能因为查不到候选而把满员响应也搞坏。
 */
export async function findPoolOverflowAlternatives(
  poolId: string,
  limit: number = POOL_OVERFLOW_ALTERNATIVE_LIMIT,
  now: Date = new Date(),
): Promise<PoolOverflowAlternative[]> {
  try {
    const [source] = await db
      .select({ city: eventPools.city, district: eventPools.district })
      .from(eventPools)
      .where(eq(eventPools.id, poolId))
      .limit(1);

    if (!source?.city) return [];

    const nowIso = now;
    const candidates = (await db
      .select({
        id: eventPools.id,
        title: eventPools.title,
        eventType: eventPools.eventType,
        dateTime: eventPools.dateTime,
        city: eventPools.city,
        district: eventPools.district,
        price: eventPools.price,
        minGroupSize: eventPools.minGroupSize,
        maxGroupSize: eventPools.maxGroupSize,
        targetGroups: eventPools.targetGroups,
      })
      .from(eventPools)
      .where(
        and(
          ne(eventPools.id, poolId),
          eq(eventPools.status, "active"),
          eq(eventPools.city, source.city),
          source.district ? eq(eventPools.district, source.district) : sql`true`,
          gt(eventPools.registrationDeadline, nowIso),
          gt(eventPools.dateTime, nowIso),
          sql`${eventPools.dateTime} <= ${new Date(nowIso.getTime() + ALTERNATIVE_LOOKAHEAD_MS)}`,
          or(isNull(eventPools.isTestPool), eq(eventPools.isTestPool, false)),
        ),
      )
      .orderBy(asc(eventPools.dateTime))
      .limit(12)) as CandidateRow[];

    if (candidates.length === 0) return [];

    const counts = (await db
      .select({
        poolId: eventPoolRegistrations.poolId,
        count: sql<number>`count(*)::int`,
      })
      .from(eventPoolRegistrations)
      .where(
        and(
          inArray(
            eventPoolRegistrations.poolId,
            candidates.map((candidate) => candidate.id),
          ),
          inArray(eventPoolRegistrations.matchStatus, ["pending", "matched"]),
        ),
      )
      .groupBy(eventPoolRegistrations.poolId)) as Array<{ poolId: string; count: number }>;

    const countByPool = new Map<string, number>(
      counts.map((row) => [row.poolId, Number(row.count ?? 0)]),
    );

    return candidates
      .map((candidate) => ({
        poolId: candidate.id,
        title: candidate.title,
        eventType: candidate.eventType ?? null,
        dateTime: new Date(candidate.dateTime).toISOString(),
        city: candidate.city ?? null,
        district: candidate.district ?? null,
        price: candidate.price ?? null,
        spotsLeft: capacityOf(candidate) - (countByPool.get(candidate.id) ?? 0),
      }))
      .filter((candidate) => candidate.spotsLeft > 0)
      .slice(0, Math.max(1, limit));
  } catch {
    return [];
  }
}
