import { logger } from "../../lib/logger";
import type { Express } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { db } from "../../db";
import { matchingThresholds } from "@shared/schema";
import { matchEventPool } from "../../poolMatchingService";
import { buildMatchingShadowExperiment } from "../../matchingShadowService";
import { classifyShadowExperimentError } from "./matchingShadowErrors";
import {
  countMatchingShadowExperimentPools,
  createMatchingShadowExperiment,
  getMatchingShadowExperimentById,
  getOutcomeCalibrationSnapshot,
  getPredictiveRerankOutcomeMetrics,
  listMatchingShadowExperiments,
} from "../../repositories/matchingShadowExperimentsRepo";

const runMatchingShadowSchema = z.object({
  poolId: z.string().min(1),
});

export function registerAdminMatchingShadowRoutes(app: Express): void {
  app.get("/api/admin/predictive-rerank-status", requireAdmin, async (_req, res) => {
    try {
      const [config] = await db
        .select()
        .from(matchingThresholds)
        .where(eq(matchingThresholds.isActive, true))
        .limit(1);

      const [shadowPoolCount, outcomeMetrics] = await Promise.all([
        countMatchingShadowExperimentPools(),
        getPredictiveRerankOutcomeMetrics(),
      ]);

      res.json({
        shadowPoolCount,
        outcomeMetrics,
        config: config ? {
          predictiveRerankEnabled: config.predictiveRerankEnabled ?? false,
          predictiveRerankExposurePercent: config.predictiveRerankExposurePercent ?? 50,
          predictiveRerankMaxPositionShift: config.predictiveRerankMaxPositionShift ?? 2,
          predictiveRerankConfidenceThreshold: config.predictiveRerankConfidenceThreshold ?? 70,
          predictiveRerankAutoDisableEnabled: config.predictiveRerankAutoDisableEnabled ?? true,
          predictiveRerankMinShadowExperiments: config.predictiveRerankMinShadowExperiments ?? 10,
          predictiveRerankAutoDisabledAt: config.predictiveRerankAutoDisabledAt,
          predictiveRerankAutoDisabledReason: config.predictiveRerankAutoDisabledReason,
        } : null,
      });
    } catch (error: any) {
      logger.error("Error fetching predictive rerank status", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch predictive rerank status" });
    }
  });

  app.get("/api/admin/matching-shadow-experiments", requireAdmin, async (req: any, res) => {
    try {
      const poolId = typeof req.query.poolId === "string" ? req.query.poolId : undefined;
      const parsedLimit = Number.parseInt(String(req.query.limit ?? "10"), 10);
      const limit = Number.isFinite(parsedLimit) ? parsedLimit : 10;

      const experiments = await listMatchingShadowExperiments({ poolId, limit });
      res.json(experiments);
    } catch (error: any) {
      logger.error("Error fetching matching shadow experiments", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch matching shadow experiments" });
    }
  });

  app.get("/api/admin/matching-shadow-experiments/:id", requireAdmin, async (req, res) => {
    try {
      const experiment = await getMatchingShadowExperimentById(req.params.id);
      if (!experiment) {
        return res.status(404).json({ message: "Matching shadow experiment not found" });
      }

      res.json(experiment);
    } catch (error: any) {
      logger.error("Error fetching matching shadow experiment detail", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch matching shadow experiment" });
    }
  });

  app.post("/api/admin/matching-shadow-experiments", requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
    try {
      const { poolId } = runMatchingShadowSchema.parse(req.body);
      const groups = await matchEventPool(poolId);
      const calibration = await getOutcomeCalibrationSnapshot();
      const experiment = buildMatchingShadowExperiment(groups, calibration);

      const created = await createMatchingShadowExperiment({
        poolId,
        mode: experiment.mode,
        modelVersion: experiment.modelVersion,
        deterministicGroupCount: experiment.summary.deterministicGroupCount,
        deterministicAverageScore: experiment.summary.deterministicAverageScore,
        outcomeSampleCount: experiment.summary.outcomeValidation.sampleCount,
        outcomePositiveRate: experiment.summary.outcomeValidation.positiveRate.toFixed(4),
        averageConfidence: experiment.summary.averageConfidence.toFixed(4),
        rankAgreementRate: experiment.summary.rankAgreementRate.toFixed(4),
        averageScoreDelta: experiment.summary.averageScoreDelta,
        results: experiment.results,
        summary: experiment.summary,
        createdBy: req.adminAccount?.id ?? null,
      });

      res.status(201).json(created);
    } catch (error: any) {
      logger.error("Error running matching shadow experiment", { error: String(error) });
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid shadow experiment request", issues: error.issues });
      }

      const classified = classifyShadowExperimentError(error);
      res.status(classified.status).json({ message: classified.message });
    }
  });
}
