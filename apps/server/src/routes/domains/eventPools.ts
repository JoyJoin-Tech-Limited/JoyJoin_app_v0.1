import type { Express, Request, Response } from "express";
import { eventPoolGroups, eventPoolRegistrations, eventPools, users } from "@shared/schema";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../../db";
import { logger } from "../../lib/logger";

const DEFAULT_MIN_GROUP_SIZE = 4;

/**
 * Event Pool stats response.
 *
 * Separation of concerns — every field belongs to one of two layers:
 *   [Event Pool]  — signals about the pool itself (registrations, archetype mix).
 *   [成桌 outcome] — historical data produced *from* the pool after matching ran.
 *
 * Never treat pool-layer fields as evidence that a 成桌 has formed.
 */
export interface EventPoolStatsResponse {
  /** [Event Pool] Total number of registrations currently in this pool. */
  totalRegistrations: number;
  /** [Event Pool] Breakdown of participant personality archetypes in the pool. */
  archetypeBreakdown: Record<string, number>;
  /**
   * [Event Pool] How many groups *could* be formed right now if matching ran
   * immediately.  Computed as floor(totalRegistrations / minGroupSize).
   *
   * floor() is intentional: a partial batch cannot form a complete group.
   * This is a pool-readiness signal, NOT confirmation that groups have formed.
   * Do NOT surface this as "X tables ready" — groups form only after the
   * matching service runs and produces actual 成桌 records.
   */
  poolFormableGroupCount: number;
  /** [成桌 outcome] Average match score across historically formed groups from this pool. */
  avgMatchScore: number;
  /** [成桌 outcome] Theme titles from previously formed groups (past 成桌 data, not current pool). */
  recentThemeTitles: Array<{ themeTitle: string | null; themeEmoji: string }>;
}

export function buildEventPoolStatsResponse(input: {
  totalRegistrations: number;
  minGroupSize: number;
  archetypeRows: Array<{ archetype: string; count: number }>;
  avgMatchScore: number;
  recentThemeTitles: Array<{ themeTitle: string | null; themeEmoji: string }>;
}): EventPoolStatsResponse {
  return {
    totalRegistrations: input.totalRegistrations,
    archetypeBreakdown: Object.fromEntries(
      input.archetypeRows.map((row) => [row.archetype, row.count]),
    ),
    // floor(): a partial batch does not produce a complete group.
    // This is a pool-readiness signal — not a confirmation that groups exist.
    poolFormableGroupCount: Math.floor(input.totalRegistrations / Math.max(input.minGroupSize, 1)),
    avgMatchScore: input.avgMatchScore,
    recentThemeTitles: input.recentThemeTitles,
  };
}

export function registerEventPoolRoutes(app: Express): void {
  app.get("/api/event-pools/:poolId/stats", async (req: Request, res: Response) => {
    try {
      const [pool] = await db
        .select({
          id: eventPools.id,
          minGroupSize: eventPools.minGroupSize,
        })
        .from(eventPools)
        .where(eq(eventPools.id, req.params.poolId))
        .limit(1);

      if (!pool) {
        return res.status(404).json({ message: "Event pool not found" });
      }

      const [registrationCountRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(eventPoolRegistrations)
        .where(eq(eventPoolRegistrations.poolId, req.params.poolId));

      const archetypeRows = await db
        .select({
          archetype: sql<string>`coalesce(${users.primaryArchetype}, ${users.archetype}, '未设置')`,
          count: sql<number>`count(*)::int`,
        })
        .from(eventPoolRegistrations)
        .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
        .where(eq(eventPoolRegistrations.poolId, req.params.poolId))
        .groupBy(sql`coalesce(${users.primaryArchetype}, ${users.archetype}, '未设置')`);

      const [avgMatchScoreRow] = await db
        .select({
          avgMatchScore: sql<number>`coalesce(round(avg(${eventPoolGroups.overallScore})::numeric), 0)::int`,
        })
        .from(eventPoolGroups)
        .where(eq(eventPoolGroups.poolId, req.params.poolId));

      const recentThemeTitles = await db
        .select({
          themeTitle: eventPoolGroups.theme,
          themeEmoji: sql<string>`coalesce(${eventPoolGroups.themeEmoji}, '✨')`,
        })
        .from(eventPoolGroups)
        .where(
          and(eq(eventPoolGroups.poolId, req.params.poolId), isNotNull(eventPoolGroups.theme)),
        )
        .orderBy(desc(eventPoolGroups.createdAt))
        .limit(3);

      const totalRegistrations = registrationCountRow?.count ?? 0;
      const minGroupSize = Math.max(pool.minGroupSize ?? DEFAULT_MIN_GROUP_SIZE, 1);

      return res.json(
        buildEventPoolStatsResponse({
          totalRegistrations,
          minGroupSize,
          archetypeRows: archetypeRows as Array<{ archetype: string; count: number }>,
          avgMatchScore: avgMatchScoreRow?.avgMatchScore ?? 0,
          recentThemeTitles,
        }),
      );
    } catch (error) {
      logger.error("Failed to get event pool stats", {
        route: "/api/event-pools/:poolId/stats",
        poolId: req.params.poolId,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ message: "Failed to fetch stats" });
    }
  });
}
