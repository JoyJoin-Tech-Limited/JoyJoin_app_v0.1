import { logger } from "../../lib/logger";
import { logAdminAudit } from "../../lib/adminAuditLogger";
import type { Express } from "express";
import { registerAdminAuthRoutes, requireAdmin, requireSuperAdmin } from "../../adminAuth";
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
import { getPhaseRatings, getMomentCardStats, getPhaseMetrics } from "../../lib/socialIcebreakerStore";
import { runSocialAIBenchmark, formatBenchmarkReport, getDefaultModelConfigs } from "../../benchmarks/socialAIBenchmark";
import { listFeatureFlags, getFeatureFlag, refreshFeatureFlag, FLAG_ENV_MAP } from "../../lib/featureFlags";
import { db } from "../../db";
import { featureFlags } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

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
      logger.error("Error fetching chemistry calibration details", { error: String(error) });
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
      logger.error("[AdminOutcomeAnalytics] Failed to build dashboard", { error: String(error) });
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
      logger.error("[AdminIcebreakerAiFeedback] summary failed", { error: String(error) });
      res.status(500).json({ message: "Failed to load icebreaker AI feedback summary" });
    }
  });

  app.get("/api/admin/icebreaker-analytics/summary", requireAdmin, async (req, res) => {
    try {
      const { socialSessionId } = req.query;
      if (typeof socialSessionId !== "string") {
        return res.status(400).json({ message: "socialSessionId query param required" });
      }
      const [phaseRatings, momentCardStats, phaseMetrics] = await Promise.all([
        getPhaseRatings(socialSessionId),
        getMomentCardStats(socialSessionId),
        getPhaseMetrics(socialSessionId),
      ]);
      res.json({
        socialSessionId,
        phaseRatings,
        momentCardStats,
        phaseMetrics,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("[AdminIcebreakerAnalytics] summary failed", { error: String(error) });
      res.status(500).json({ message: "Failed to load icebreaker analytics" });
    }
  });

  // Social AI benchmark — admin-triggered benchmark run
  app.get("/api/admin/benchmarks/social-ai", requireAdmin, async (req, res) => {
    const reqLogger = logger.child({ request_id: (req as any).requestId });
    try {
      const iterationsRaw = req.query.iterations;
      const modelsRaw = req.query.models;

      const maxIterations = 10;
      let iterations = 5;
      if (typeof iterationsRaw === "string" && iterationsRaw) {
        const parsed = parseInt(iterationsRaw, 10);
        if (!Number.isNaN(parsed)) {
          iterations = Math.min(maxIterations, Math.max(1, parsed));
        }
      }

      let modelsOverride: string[] | undefined;
      if (typeof modelsRaw === "string" && modelsRaw) {
        modelsOverride = modelsRaw.split(",").map((s) => s.trim()).filter(Boolean);
      }

      const defaultConfigs = getDefaultModelConfigs();
      const models = modelsOverride
        ? defaultConfigs.filter((m) => modelsOverride.includes(m.label))
        : defaultConfigs;

      if (models.length === 0) {
        return res.status(400).json({ message: "No valid models selected" });
      }

      const report = await runSocialAIBenchmark({ iterations, models });

      res.json({
        generatedAt: new Date().toISOString(),
        report: {
          ranAt: report.ranAt,
          iterationsPerFixture: report.iterationsPerFixture,
          models: report.models,
          summary: report.summary,
          formatted: formatBenchmarkReport(report),
        },
      });
    } catch (error) {
      reqLogger.error("[AdminBenchmarks] social-ai benchmark failed", { error: String(error) });
      res.status(500).json({ message: "Benchmark failed" });
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
      logger.error("[AdminAuditLogs] query failed", { error: String(error) });
      res.status(500).json({ message: "Failed to load audit logs" });
    }
  });

  // ── Feature Flags ───────────────────────────────────────────────

  app.get("/api/admin/feature-flags", requireAdmin, requireSuperAdmin, async (_req, res) => {
    try {
      const flags = await listFeatureFlags();
      res.json({ flags });
    } catch (error) {
      logger.error("[AdminFeatureFlags] list failed", { error: String(error) });
      res.status(500).json({ message: "Failed to load feature flags" });
    }
  });

  const VALID_FLAG_KEYS = Object.keys(FLAG_ENV_MAP);
  const updateFlagSchema = z.object({
    value: z.enum(["true", "false"]),
    description: z.string().max(500).optional(),
  });

  app.put("/api/admin/feature-flags/:key", requireAdmin, requireSuperAdmin, async (req, res) => {
    try {
      const { key } = req.params;
      if (!VALID_FLAG_KEYS.includes(key)) {
        return res.status(400).json({ message: "Unknown feature flag key", validKeys: VALID_FLAG_KEYS });
      }

      const parsed = updateFlagSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.format() });
      }
      const { value, description } = parsed.data;

      const adminId = req.adminAccount?.id ?? req.session?.adminAccountId ?? "unknown";

      await db
        .insert(featureFlags)
        .values({ key, value, description, updatedBy: adminId })
        .onConflictDoUpdate({
          target: featureFlags.key,
          set: { value, description, updatedAt: new Date(), updatedBy: adminId },
        });

      await refreshFeatureFlag(key);

      logAdminAudit({
        action: "FEATURE_FLAG_UPDATED",
        adminId,
        adminRole: req.adminRole ?? "unknown",
        targetEntityType: "feature_flag",
        targetEntityId: key,
        context: { value, description },
      });

      logger.info("[AdminFeatureFlags] updated", { key, value, adminId });
      res.json({ key, value, updated: true });
    } catch (error) {
      logger.error("[AdminFeatureFlags] update failed", { error: String(error) });
      res.status(500).json({ message: "Failed to update feature flag" });
    }
  });
}
