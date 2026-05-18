/**
 * Connections Domain Router — user-facing connection endpoints
 *
 * GET /api/my-connections
 *   Returns all mutual connections for the authenticated user, with peer
 *   name, archetype, event title, and WeChat ID.
 */

import type { Express, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { getAuthenticatedUserId } from "../../lib/requestAuth";
import { getUserConnections } from "../../repositories/connectionsRepo";
import { logger } from "../../lib/logger";

export function registerConnectionRoutes(app: Express): void {
  app.get("/api/my-connections", requireAuth, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const connections = await getUserConnections(userId);
      const durationMs = Date.now() - startMs;

      logger.info("connections.my", {
        request_id: req.requestId,
        userId,
        duration_ms: durationMs,
        count: connections.length,
      });

      res.setHeader("X-Response-Time", `${durationMs}ms`);
      return res.json(connections);
    } catch (error) {
      const durationMs = Date.now() - startMs;
      logger.error("connections.my failed", {
        request_id: req.requestId,
        userId,
        duration_ms: durationMs,
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({ message: "Failed to load connections" });
    }
  });
}
