import type { Express } from "express";
import { registerAdminAuthRoutes, requireAdmin } from "../../adminAuth";
import { registerAdminMatchingShadowRoutes } from "./adminMatchingShadow";

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
}
