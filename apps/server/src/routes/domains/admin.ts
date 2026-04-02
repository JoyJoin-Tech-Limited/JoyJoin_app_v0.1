import type { Express } from "express";
import { registerAdminAuthRoutes, requireAdmin } from "../../adminAuth";
import { getRuntimeLLMFallbackConfig, getRuntimeLLMFallbackStats } from "../../inference/runtimeLLMFallback";
import { registerAdminMatchingShadowRoutes } from "./adminMatchingShadow";
import { adminOutcomeAnalyticsRepo } from "../../repositories/adminOutcomeAnalyticsRepo";

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

  app.get('/api/admin/inference/runtime-fallback', requireAdmin, (_req, res) => {
    res.json({
      config: getRuntimeLLMFallbackConfig(),
      stats: getRuntimeLLMFallbackStats(),
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
}
