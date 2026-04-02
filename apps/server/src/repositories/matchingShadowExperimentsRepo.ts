import { db } from "../db";
import {
  eventFeedback,
  eventPools,
  matchingShadowExperiments,
  type InsertMatchingShadowExperiment,
} from "@shared/schema";
import { desc, eq } from "drizzle-orm";

const POSITIVE_CONNECTION_STATUSES = new Set([
  "已交换联系方式",
  "有但还没联系",
]);

export type OutcomeCalibrationSnapshot = {
  sampleCount: number;
  positiveRate: number;
  avgAtmosphereScore: number | null;
};

export async function getOutcomeCalibrationSnapshot(): Promise<OutcomeCalibrationSnapshot> {
  const feedbackRows = await db
    .select({
      atmosphereScore: eventFeedback.atmosphereScore,
      wouldAttendAgain: eventFeedback.wouldAttendAgain,
      connectionStatus: eventFeedback.connectionStatus,
    })
    .from(eventFeedback);

  if (feedbackRows.length === 0) {
    return {
      sampleCount: 0,
      positiveRate: 0,
      avgAtmosphereScore: null,
    };
  }

  const positiveCount = feedbackRows.filter((row) => {
    const atmospherePositive = (row.atmosphereScore ?? 0) >= 4;
    const wouldAttendAgainPositive = row.wouldAttendAgain === true;
    const connectionPositive = row.connectionStatus
      ? POSITIVE_CONNECTION_STATUSES.has(row.connectionStatus)
      : false;

    return atmospherePositive || wouldAttendAgainPositive || connectionPositive;
  }).length;

  const atmosphereRows = feedbackRows
    .map((row) => row.atmosphereScore)
    .filter((score): score is number => typeof score === "number");

  const avgAtmosphereScore = atmosphereRows.length > 0
    ? atmosphereRows.reduce((sum, score) => sum + score, 0) / atmosphereRows.length
    : null;

  return {
    sampleCount: feedbackRows.length,
    positiveRate: positiveCount / feedbackRows.length,
    avgAtmosphereScore,
  };
}

export async function createMatchingShadowExperiment(
  values: InsertMatchingShadowExperiment,
) {
  const [created] = await db
    .insert(matchingShadowExperiments)
    .values(values)
    .returning();

  return created;
}

export async function listMatchingShadowExperiments(options?: {
  poolId?: string;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(options?.limit ?? 10, 50));

  let query = db
    .select({
      id: matchingShadowExperiments.id,
      poolId: matchingShadowExperiments.poolId,
      poolTitle: eventPools.title,
      mode: matchingShadowExperiments.mode,
      modelVersion: matchingShadowExperiments.modelVersion,
      deterministicGroupCount: matchingShadowExperiments.deterministicGroupCount,
      deterministicAverageScore: matchingShadowExperiments.deterministicAverageScore,
      outcomeSampleCount: matchingShadowExperiments.outcomeSampleCount,
      outcomePositiveRate: matchingShadowExperiments.outcomePositiveRate,
      averageConfidence: matchingShadowExperiments.averageConfidence,
      rankAgreementRate: matchingShadowExperiments.rankAgreementRate,
      averageScoreDelta: matchingShadowExperiments.averageScoreDelta,
      results: matchingShadowExperiments.results,
      summary: matchingShadowExperiments.summary,
      createdBy: matchingShadowExperiments.createdBy,
      createdAt: matchingShadowExperiments.createdAt,
    })
    .from(matchingShadowExperiments)
    .leftJoin(eventPools, eq(eventPools.id, matchingShadowExperiments.poolId));

  if (options?.poolId) {
    query = query.where(eq(matchingShadowExperiments.poolId, options.poolId)) as typeof query;
  }

  return query
    .orderBy(desc(matchingShadowExperiments.createdAt))
    .limit(limit);
}
