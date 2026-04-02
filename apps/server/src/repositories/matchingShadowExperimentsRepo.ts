import { db } from "../db";
import {
  eventFeedback,
  eventPools,
  matchingShadowExperiments,
  type InsertMatchingShadowExperiment,
} from "@shared/schema";
import { desc, eq, sql } from "drizzle-orm";

export type OutcomeCalibrationSnapshot = {
  sampleCount: number;
  positiveRate: number;
  avgAtmosphereScore: number | null;
};

export async function getOutcomeCalibrationSnapshot(): Promise<OutcomeCalibrationSnapshot> {
  const positiveFeedbackPredicate = sql`
    coalesce(${eventFeedback.atmosphereScore}, 0) >= 4
    or ${eventFeedback.wouldAttendAgain} = true
    or ${eventFeedback.connectionStatus} in ('已交换联系方式', '有但还没联系')
  `;

  const [aggregateRow] = await db
    .select({
      sampleCount: sql<number>`count(*)::int`,
      positiveCount: sql<number>`count(*) filter (where ${positiveFeedbackPredicate})::int`,
      avgAtmosphereScore: sql<string | null>`avg(${eventFeedback.atmosphereScore})::text`,
    })
    .from(eventFeedback);

  if (!aggregateRow || aggregateRow.sampleCount === 0) {
    return {
      sampleCount: 0,
      positiveRate: 0,
      avgAtmosphereScore: null,
    };
  }

  const avgAtmosphereScore = aggregateRow.avgAtmosphereScore === null
    ? null
    : Number.parseFloat(aggregateRow.avgAtmosphereScore);

  return {
    sampleCount: aggregateRow.sampleCount,
    positiveRate: aggregateRow.positiveCount / aggregateRow.sampleCount,
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

export async function getMatchingShadowExperimentById(id: string) {
  const [experiment] = await db
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
    .leftJoin(eventPools, eq(eventPools.id, matchingShadowExperiments.poolId))
    .where(eq(matchingShadowExperiments.id, id))
    .limit(1);

  return experiment ?? null;
}
