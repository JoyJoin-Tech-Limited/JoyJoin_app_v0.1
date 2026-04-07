import type { Express, Request, Response } from "express";
import { eventPoolGroups, eventPoolRegistrations, eventPools, users } from "@shared/schema";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../../db";
import { logger } from "../../lib/logger";

const DEFAULT_MIN_GROUP_SIZE = 4;

export interface EventPoolStatsResponse {
  /** [Event Pool layer] — total registrations in the pool (not table members). */
  totalRegistrations: number;
  /** [Event Pool layer] — archetype distribution across pool registrants. */
  archetypeBreakdown: Record<string, number>;
  /**
   * [Event Pool layer] — floor-based estimate of how many 成桌 groups the current
   * pool could support.  Uses Math.floor (not ceil) so the value is conservative
   * and honest: partial groups are not counted as formable.
   *
   * TODO (later PR): rename to `projectedGroups` and split stats response into
   * separate `poolSignals` and `groupOutcomes` sections to avoid mixing pool-layer
   * data with historical 成桌 outcomes on the same response object.
   */
  estimatedGroups: number;
  /**
   * [成桌 layer] — average match score across already-formed groups in this pool.
   * This is a historical outcome metric, not a current pool-state signal.
   */
  avgMatchScore: number;
  /**
   * [成桌 layer] — theme titles from groups already formed from this pool.
   * Historical 成桌 examples; do NOT present these as the current pool's state.
   */
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
    // Math.floor: conservative — only fully-formable groups are counted.
    // (ceil was previously used but over-counted: 7 people ÷ min 4 → ceil=2, floor=1.
    //  With floor, a partial remainder is not presented as a complete group.)
    estimatedGroups: Math.floor(input.totalRegistrations / Math.max(input.minGroupSize, 1)),
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
