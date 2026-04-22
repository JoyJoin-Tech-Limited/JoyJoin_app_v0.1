import type { Express } from "express";
import { registerAdminAuthRoutes, requireAdmin } from "../../adminAuth";
import {
  CHEMISTRY_CALIBRATION_MAX_DELTA,
  CHEMISTRY_CALIBRATION_MIN_SAMPLES,
  listArchetypePairCalibrationDetails,
} from "../../archetypeChemistryCalibration";
import { getRuntimeLLMFallbackConfig, getRuntimeLLMFallbackStats } from "../../inference/runtimeLLMFallback";
import { registerAdminMatchingShadowRoutes } from "./adminMatchingShadow";
import { adminOutcomeAnalyticsRepo } from "../../repositories/adminOutcomeAnalyticsRepo";
import { socialIcebreakerAiFeedbackRepo } from "../../repositories/socialIcebreakerAiFeedbackRepo";
import { queryAdminAuditLogs } from "../../repositories/adminAuditLogsRepo";  

export function registerAdminRoutes(app: Express): void {
  registerAdminAuthRoutes(app);
  registerAdminMatchingShadowRoutes(app);

  // Amap config endpoint - provides map API keys for frontend (Admin Portal only)
  app.get('/api/config/amap', requireAdmin, (_req, res) => {
    const apiKey = process.env.AMAP_API_KEY;
    const securityKey = process.env.AMAP_SECURITY_KEY;

    if (!apiKey || !securityKey) {
      return res.status(503).json({ error: 'Amap configuration not available' });
    }

    res.json({
      apiKey,
      securityKey,
    });
  });

  app.get("/api/admin/matching/chemistry-calibration", requireAdmin, async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === "1";
      const rows = await listArchetypePairCalibrationDetails(forceRefresh);

      res.json({
        minSamples: CHEMISTRY_CALIBRATION_MIN_SAMPLES,
        maxDelta: CHEMISTRY_CALIBRATION_MAX_DELTA,
        generatedAt: new Date().toISOString(),
        rows,
      });
    } catch (error) {
      console.error("Error fetching chemistry calibration details:", error);
      res.status(500).json({ message: "Failed to fetch chemistry calibration details" });
    }
  });

  app.get('/api/admin/inference/runtime-fallback', requireAdmin, (_req, res) => {
    res.json({
      config: getRuntimeLLMFallbackConfig(),
      stats: getRuntimeLLMFallbackStats(),
    });
  });

  app.get("/api/admin/outcome-analytics", requireAdmin, async (_req, res) => {
    try {
      const dashboard = await adminOutcomeAnalyticsRepo.getDashboard();
      res.json(dashboard);
    } catch (error) {
      console.error("[AdminOutcomeAnalytics] Failed to build dashboard:", error);
      res.status(500).json({ message: "Failed to load outcome analytics dashboard" });
    }
  });

  app.get("/api/admin/icebreaker-ai-feedback/summary", requireAdmin, async (req, res) => {
    try {
      const daysRaw = req.query.days;
      const days =
        typeof daysRaw === "string" && /^\d+$/.test(daysRaw)
          ? Math.min(365, Math.max(1, parseInt(daysRaw, 10)))
          : 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const summary = await socialIcebreakerAiFeedbackRepo.getSummary({ since });
      res.json({
        days,
        since: since.toISOString(),
        generatedAt: new Date().toISOString(),
        ...summary,
      });
    } catch (error) {
      console.error("[AdminIcebreakerAiFeedback] summary failed:", error);
      res.status(500).json({ message: "Failed to load icebreaker AI feedback summary" });
    }
  });

  // Admin audit logs — read-only query endpoint
  app.get("/api/admin/audit-logs", requireAdmin, async (req, res) => {
    try {
      const { adminId, action, targetEntityType, targetEntityId, startDate, endDate, limit, offset } = req.query;

      const result = await queryAdminAuditLogs({
        adminId: typeof adminId === "string" ? adminId : undefined,
        action: typeof action === "string" ? action : undefined,
        targetEntityType: typeof targetEntityType === "string" ? targetEntityType : undefined,
        targetEntityId: typeof targetEntityId === "string" ? targetEntityId : undefined,
        startDate: typeof startDate === "string" ? new Date(startDate) : undefined,
        endDate: typeof endDate === "string" ? new Date(endDate) : undefined,
        limit: typeof limit === "string" ? parseInt(limit, 10) : undefined,
        offset: typeof offset === "string" ? parseInt(offset, 10) : undefined,
      });

      res.json(result);
    } catch (error) {
      console.error("[AdminAuditLogs] query failed:", error);
      res.status(500).json({ message: "Failed to load audit logs" });
    }
  });
}
