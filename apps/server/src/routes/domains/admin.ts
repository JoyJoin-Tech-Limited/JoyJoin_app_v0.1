import type { Express } from "express";
import { registerAdminAuthRoutes, requireAdmin } from "../../adminAuth";
import {
  CHEMISTRY_CALIBRATION_MAX_DELTA,
  CHEMISTRY_CALIBRATION_MIN_SAMPLES,
  listArchetypePairCalibrationDetails,
} from "../../archetypeChemistryCalibration";

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
}
