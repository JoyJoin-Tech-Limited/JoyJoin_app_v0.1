import type { Express, Request } from "express";
import { getMetricsText } from "../../middleware/metrics";
import { logger } from "../../lib/logger";
import { db } from "../../db";
import { participationExperimentEvents } from "@shared/schema";

export function registerAnalyticsRoutes(app: Express): void {
  // Prometheus-style metrics endpoint — internal use only.
  // Returns plain-text Prometheus exposition format for scraping.
  app.get("/api/metrics", async (req, res) => {
    try {
      const text = await getMetricsText();
      res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
      res.status(200).send(text);
    } catch (error) {
      logger.error("Error generating /api/metrics", {
        request_id: req.requestId,
        error: String(error),
      });
      res.status(500).send("# Error generating metrics\n");
    }
  });

  /**
   * POST /api/analytics/participation_experiment
   *
   * Wave 2 experiment event collection. Accepts fire-and-forget events from the
   * client-side `participationExperimentAnalytics` module.
   *
   * Always returns 200 so that analytics failures never block the user flow.
   * Auth is optional: events are accepted from both authenticated and anonymous
   * sessions (anonymous events have userId = null).
   */
  app.post("/api/analytics/participation_experiment", async (req: Request, res) => {
    try {
      const { eventType, poolId, metadata, timestamp } = req.body as {
        eventType?: string;
        poolId?: string;
        metadata?: Record<string, unknown>;
        timestamp?: number;
      };

      if (!eventType) {
        // Silently ignore malformed events — analytics must never error loudly
        return res.status(200).json({ success: false, error: "eventType required" });
      }

      const userId: string | null = (req.session as any)?.userId ?? null;
      const sessionId: string | null = (req.session as any)?.id ?? null;

      await db.insert(participationExperimentEvents).values({
        userId,
        sessionId,
        eventType,
        poolId: poolId ?? null,
        metadata: metadata ?? null,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.warn("participation_experiment analytics write failed (non-fatal)", {
        request_id: req.requestId,
        error: String(error),
      });
      // Silent fail — analytics must never break the user flow
      return res.status(200).json({ success: false, error: "analytics write failed" });
    }
  });
}
