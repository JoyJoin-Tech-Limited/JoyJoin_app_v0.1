import type { Express } from "express";
import { registerAdminAuthRoutes, requireAdmin } from "../../adminAuth";
import { getRuntimeLLMFallbackConfig, getRuntimeLLMFallbackStats } from "../../inference/runtimeLLMFallback";

export function registerAdminRoutes(app: Express): void {
  registerAdminAuthRoutes(app);

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
  });
}
