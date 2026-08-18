import type { Express } from "express";
import { z } from "zod";

import { requireAdmin } from "../../adminAuth";
import { logger } from "../../lib/logger";
import { getOnboardingFunnelStats } from "../../repositories/onboardingFunnelRepo";

const onboardingFunnelQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export function registerAdminOnboardingFunnelRoutes(app: Express): void {
  /**
   * GET /api/admin/analytics/onboarding-funnel?days=30
   *
   * Live V4 onboarding funnel: per-step enter/complete/abandon aggregates,
   * anonymous → login stitch rate, and experiment bucket breakdown from the
   * onboarding_analytics event stream. Aggregate counts only — no user-level
   * data — so no audit log entry is required (read-only GET).
   */
  app.get("/api/admin/analytics/onboarding-funnel", requireAdmin, async (req, res) => {
    try {
      const parsed = onboardingFunnelQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid query parameters" });
      }

      const funnel = await getOnboardingFunnelStats(parsed.data.days);
      res.json(funnel);
    } catch (error) {
      logger.error("Error fetching onboarding funnel analytics", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch onboarding funnel analytics" });
    }
  });
}
