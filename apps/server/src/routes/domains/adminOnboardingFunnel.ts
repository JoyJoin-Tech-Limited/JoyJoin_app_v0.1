import type { Express } from "express";
import { z } from "zod";

import { requireAdmin } from "../../adminAuth";
import { logger } from "../../lib/logger";
import { getOnboardingFunnelStats } from "../../repositories/onboardingFunnelRepo";

const isoDateParam = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid ISO date" });

const onboardingFunnelQuerySchema = z
  .object({
    days: z.coerce.number().int().min(1).max(365).default(30),
    // PR-2: optional explicit [from, to) window for baseline segmentation
    // (e.g. pre/post the 2026-08-18 ceremony auto-advance retune). When both
    // are absent the rolling `days` window is used.
    from: isoDateParam.optional(),
    to: isoDateParam.optional(),
  })
  .refine((data) => !data.from || !data.to || Date.parse(data.from) < Date.parse(data.to), {
    message: "from must be before to",
  });

export function registerAdminOnboardingFunnelRoutes(app: Express): void {
  /**
   * GET /api/admin/analytics/onboarding-funnel?days=30
   * GET /api/admin/analytics/onboarding-funnel?from=2026-08-01&to=2026-08-18
   *
   * Live V4 onboarding funnel: per-step enter/complete/abandon aggregates with
   * p50/p90 step durations, anonymous → login stitch rate, experiment bucket
   * breakdown, and emotion metrics (ceremony advance mode, slot skip rate,
   * result stage dwell medians, commentary read-completion) from the
   * onboarding_analytics event stream. Aggregate counts only — no user-level
   * data — so no audit log entry is required (read-only GET).
   */
  app.get("/api/admin/analytics/onboarding-funnel", requireAdmin, async (req, res) => {
    try {
      const parsed = onboardingFunnelQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid query parameters" });
      }

      const { days, from, to } = parsed.data;
      const funnel = await getOnboardingFunnelStats(days, {
        ...(from ? { from: new Date(from) } : {}),
        ...(to ? { to: new Date(to) } : {}),
      });
      res.json(funnel);
    } catch (error) {
      logger.error("Error fetching onboarding funnel analytics", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch onboarding funnel analytics" });
    }
  });
}
