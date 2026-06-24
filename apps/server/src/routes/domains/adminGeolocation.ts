import type { Express, Request, Response } from "express";
import { z } from "zod";
import { requireAdmin, requireSuperAdmin } from "../../adminAuth";
import {
  getAggregatedHeatmap,
  rollupSnapshotsForDate,
} from "../../repositories/userLocationRepo";
import { logger } from "../../lib/logger";

const heatmapQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  eventType: z.enum(["login", "onboarding_complete", "pool_registration"]).optional(),
  province: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
});

const rollupBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export function registerAdminGeolocationRoutes(app: Express): void {
  /**
   * GET /api/admin/geolocation/heatmap
   *
   * Returns daily aggregate counts per province/city/event_type for the
   * requested date range.  No raw IPs or user IDs are returned.
   */
  app.get("/api/admin/geolocation/heatmap", requireAdmin, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const parseResult = heatmapQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: parseResult.error.format(),
        });
      }

      const rows = await getAggregatedHeatmap(parseResult.data);
      res.json({ data: rows });
    } catch (error) {
      logger.error("[Admin Geolocation] Failed to fetch heatmap", { error });
      res.status(500).json({ message: "Failed to fetch heatmap" });
    }
  });

  /**
   * POST /api/admin/geolocation/rollup
   *
   * Recomputes aggregates for a single date from snapshots.  Useful for
   * backfilling after schema changes or reprocessing stale data.
   */
  app.post("/api/admin/geolocation/rollup", requireAdmin, requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const parseResult = rollupBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          message: "Invalid request body",
          errors: parseResult.error.format(),
        });
      }

      await rollupSnapshotsForDate(parseResult.data.date);
      res.json({ success: true, date: parseResult.data.date });
    } catch (error) {
      logger.error("[Admin Geolocation] Failed to rollup snapshots", { error });
      res.status(500).json({ message: "Failed to rollup snapshots" });
    }
  });
}
