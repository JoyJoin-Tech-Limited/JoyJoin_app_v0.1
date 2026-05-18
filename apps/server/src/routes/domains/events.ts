/**
 * Events Domain Router — user-facing event endpoints
 *
 * GET /api/events/joined
 *   Returns all events the authenticated user has joined (legacy + pool),
 *   sorted by dateTime descending.
 */

import type { Express, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { getAuthenticatedUserId } from "../../lib/requestAuth";
import { getUserJoinedEventsSummary } from "../../repositories/joinedEventsRepo";
import { logger } from "../../lib/logger";

export function registerEventRoutes(app: Express): void {
  app.get("/api/events/joined", requireAuth, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const events = await getUserJoinedEventsSummary(userId);
      const durationMs = Date.now() - startMs;

      logger.info("events.joined", {
        request_id: req.requestId,
        userId,
        duration_ms: durationMs,
        count: events.length,
      });

      res.setHeader("X-Response-Time", `${durationMs}ms`);
      return res.json(events);
    } catch (error) {
      const durationMs = Date.now() - startMs;
      logger.error("events.joined failed", {
        request_id: req.requestId,
        userId,
        duration_ms: durationMs,
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({ message: "Failed to load joined events" });
    }
  });
}
