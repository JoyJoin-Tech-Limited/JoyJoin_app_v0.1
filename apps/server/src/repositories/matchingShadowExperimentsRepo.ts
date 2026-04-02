import { db } from "../db";
import {
  eventGroupOutcomes,
  eventFeedback,
  eventPoolGroups,
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

export type PredictiveRerankOutcomeMetric = {
  arm: "control" | "treatment";
  sampleCount: number;
  positiveRate: number;
  avgAtmosphereScore: number | null;
};

export type PredictiveRerankOutcomeMetrics = PredictiveRerankOutcomeMetric[];

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

export async function countMatchingShadowExperimentPools(): Promise<number> {
  const [row] = await db
    .select({
      count: sql<number>`count(distinct ${matchingShadowExperiments.poolId})::int`,
    })
    .from(matchingShadowExperiments);

  return row?.count ?? 0;
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

export async function getPredictiveRerankOutcomeMetrics(days = 14): Promise<PredictiveRerankOutcomeMetric[]> {
  const positivePredicate = sql<number>`
    case
      when ${eventGroupOutcomes.wouldMeetAgain} = true or coalesce(${eventGroupOutcomes.atmosphereScore}, 0) >= 4
        then 1
      else 0
    end
  `;

  const rows = await db
    .select({
      arm: eventPoolGroups.predictiveExperimentArm,
      sampleCount: sql<number>`count(*)::int`,
      positiveRate: sql<string>`avg(${positivePredicate})::text`,
      avgAtmosphereScore: sql<string | null>`avg(${eventGroupOutcomes.atmosphereScore})::text`,
    })
    .from(eventGroupOutcomes)
    .innerJoin(eventPoolGroups, eq(eventPoolGroups.id, eventGroupOutcomes.groupId))
    .where(sql`
      ${eventPoolGroups.predictiveExperimentArm} in ('control', 'treatment')
      and ${eventGroupOutcomes.updatedAt} >= now() - (${days} * interval '1 day')
    `)
    .groupBy(eventPoolGroups.predictiveExperimentArm);

  type OutcomeRow = { arm: string | null; sampleCount: number; positiveRate: string; avgAtmosphereScore: string | null };
  type NarrowedRow = OutcomeRow & { arm: "control" | "treatment" };

  return (rows as OutcomeRow[])
    .filter((row): row is NarrowedRow => row.arm === "control" || row.arm === "treatment")
    .map((row) => ({
      arm: row.arm,
      sampleCount: row.sampleCount,
      positiveRate: Number.parseFloat(row.positiveRate ?? "0"),
      avgAtmosphereScore: row.avgAtmosphereScore === null ? null : Number.parseFloat(row.avgAtmosphereScore),
    }));
}
