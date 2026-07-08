import type { Express } from "express";
import { logger } from "../../lib/logger";
import { requireAuthenticatedUserId } from "../../lib/requestAuth";
import { startSingleTestSession, cleanupSingleTestData } from "../../services/singleTestService";
import { isSingleTestMode } from "../../lib/isSingleTestMode";

export function registerSingleTestRoutes(app: Express): void {
  app.post("/api/test/single-test/start", async (req: any, res: any) => {
    if (!isSingleTestMode()) {
      return res.status(403).json({ error: "Only available in single test mode" });
    }

    const userId = requireAuthenticatedUserId(req, res);
    if (!userId) return;

    try {
      const result = await startSingleTestSession(userId);
      res.json({
        socialSessionId: result.socialSessionId,
        groupId: result.groupId,
        testerRegistrationId: result.testerRegistrationId,
        registrationId: result.registrationId,
        bots: result.bots,
      });
    } catch (error: any) {
      logger.error("[SingleTest] start error", { error: String(error) });
      res.status(500).json({ error: "FAILED_TO_START", message: error?.message });
    }
  });

  app.post("/api/test/single-test/reset", async (_req: any, res: any) => {
    if (!isSingleTestMode()) {
      return res.status(403).json({ error: "Only available in single test mode" });
    }

    try {
      const result = await cleanupSingleTestData();
      res.json({ ok: true, ...result });
    } catch (error: any) {
      logger.error("[SingleTest] reset error", {
        error: String(error),
        message: error?.message,
        code: error?.code,
      });
      res.status(500).json({ error: "FAILED_TO_RESET", message: error?.message });
    }
  });
}
