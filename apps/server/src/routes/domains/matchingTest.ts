import type { Express, Request, Response } from "express";
import { z } from "zod";
import { matchEventPool, saveMatchResults } from "../../poolMatchingService";
import type { MatchGroup } from "../../poolMatchingService";
import {
  ensureMatchingTestPool,
  seedMatchingTestBots,
  finalizeMatchingTestGroups,
  cleanupMatchingTestData,
} from "../../services/matchingTestService";
import { isMatchingTestMode } from "../../lib/isSingleTestMode";
import { requireAuthenticatedUserId } from "../../lib/requestAuth";
import { logger } from "../../lib/logger";

function gate(res: Response): boolean {
  if (!isMatchingTestMode()) {
    res.status(403).json({ error: "Matching test mode is not enabled" });
    return false;
  }
  return true;
}

export function registerMatchingTestRoutes(app: Express): void {
  app.post("/api/test/matching-test/start", async (req: Request, res: Response) => {
    if (!gate(res)) return;

    const userId = requireAuthenticatedUserId(req, res);
    if (!userId) return;

    try {
      const poolId = await ensureMatchingTestPool(userId);
      const { botUsers } = await seedMatchingTestBots(poolId, userId);

      logger.info("[MatchingTest] session started", {
        testerUserId: userId,
        poolId,
        botCount: botUsers.length,
      });

      res.json({
        poolId,
        botUsers,
        nextStep: {
          register: `POST /api/event-pools/${poolId}/register-with-payment`,
          match: `POST /api/test/matching-test/${poolId}/match`,
        },
      });
    } catch (error: any) {
      logger.error("[MatchingTest] start failed", {
        testerUserId: userId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: "FAILED_TO_START",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/test/matching-test/:poolId/match", async (req: Request, res: Response) => {
    if (!gate(res)) return;

    const userId = requireAuthenticatedUserId(req, res);
    if (!userId) return;

    const parseResult = z.object({ poolId: z.string().min(1) }).safeParse(req.params);
    if (!parseResult.success) {
      res.status(400).json({ error: "INVALID_POOL_ID" });
      return;
    }
    const { poolId } = parseResult.data;

    try {
      const groups = await matchEventPool(poolId);
      await saveMatchResults(poolId, groups);

      // Test-only finalizer: sets group.finalDateTime and backfills the
      // reserved test venue for groups the venue assignment skipped (e.g.
      // when the operator-review gate held post-match side effects), so the
      // squad-unboxing 今晚这桌 brief renders fully.
      const finalize = await finalizeMatchingTestGroups(poolId);

      logger.info("[MatchingTest] match completed", {
        testerUserId: userId,
        poolId,
        groupCount: groups.length,
        memberCount: groups.reduce((sum: number, g: MatchGroup) => sum + g.members.length, 0),
        ...finalize,
      });

      res.json({
        poolId,
        groupCount: groups.length,
        totalMatched: groups.reduce((sum: number, g: MatchGroup) => sum + g.members.length, 0),
        ...finalize,
        groups: groups.map((g: MatchGroup) => ({
          memberCount: g.members.length,
          avgChemistryScore: g.avgChemistryScore,
          diversityScore: g.diversityScore,
          overallScore: g.overallScore,
          temperatureLevel: g.temperatureLevel,
        })),
      });
    } catch (error: any) {
      logger.error("[MatchingTest] match failed", {
        testerUserId: userId,
        poolId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: "MATCH_FAILED",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post("/api/test/matching-test/cleanup", async (req: Request, res: Response) => {
    if (!gate(res)) return;

    const userId = requireAuthenticatedUserId(req, res);
    if (!userId) return;

    try {
      const result = await cleanupMatchingTestData();
      res.json(result);
    } catch (error: any) {
      logger.error("[MatchingTest] cleanup failed", {
        testerUserId: userId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: "CLEANUP_FAILED",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
