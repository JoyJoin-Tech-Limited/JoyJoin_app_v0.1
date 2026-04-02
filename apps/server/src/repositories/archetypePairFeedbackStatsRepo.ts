import { archetypePairFeedbackStats } from "@shared/schema";
import { sql } from "drizzle-orm";

import { db } from "../db";

export interface AggregatedArchetypePairFeedbackRow {
  archetypeA: string;
  archetypeB: string;
  sampleCount: number;
  avgMeetAgain: number;
  avgAtmosphere: number;
}

export async function aggregateArchetypePairFeedbackRows(): Promise<AggregatedArchetypePairFeedbackRow[]> {
  const result = await db.execute(sql`
    SELECT
      LEAST(COALESCE(u1.archetype, u1.primary_archetype), COALESCE(u2.archetype, u2.primary_archetype)) AS archetype_a,
      GREATEST(COALESCE(u1.archetype, u1.primary_archetype), COALESCE(u2.archetype, u2.primary_archetype)) AS archetype_b,
      COUNT(*)::int AS sample_count,
      AVG(CASE WHEN mh.would_meet_again THEN 1.0 ELSE 0.0 END)::float8 AS avg_meet_again,
      AVG(mh.connection_quality::numeric)::float8 AS avg_atmosphere
    FROM match_history mh
    INNER JOIN users u1 ON u1.id = mh.user1_id
    INNER JOIN users u2 ON u2.id = mh.user2_id
    WHERE mh.would_meet_again IS NOT NULL
      AND mh.connection_quality IS NOT NULL
      AND COALESCE(u1.archetype, u1.primary_archetype) IS NOT NULL
      AND COALESCE(u2.archetype, u2.primary_archetype) IS NOT NULL
    GROUP BY 1, 2
  `);

  return result.rows.map((row: any) => ({
    archetypeA: row.archetype_a,
    archetypeB: row.archetype_b,
    sampleCount: Number(row.sample_count ?? 0),
    avgMeetAgain: Number(row.avg_meet_again ?? 0),
    avgAtmosphere: Number(row.avg_atmosphere ?? 0),
  }));
}

export async function listArchetypePairFeedbackStats() {
  return db
    .select()
    .from(archetypePairFeedbackStats);
}

export async function upsertArchetypePairFeedbackStats(
  rows: Array<typeof archetypePairFeedbackStats.$inferInsert>,
) {
  if (rows.length === 0) {
    return [];
  }

  return db
    .insert(archetypePairFeedbackStats)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        archetypePairFeedbackStats.archetypeA,
        archetypePairFeedbackStats.archetypeB,
      ],
      set: {
        baseScore: sql`excluded.base_score`,
        sampleCount: sql`excluded.sample_count`,
        avgMeetAgain: sql`excluded.avg_meet_again`,
        avgAtmosphere: sql`excluded.avg_atmosphere`,
        empiricalScore: sql`excluded.empirical_score`,
        appliedDelta: sql`excluded.applied_delta`,
        calibratedScore: sql`excluded.calibrated_score`,
        lastAggregatedAt: sql`excluded.last_aggregated_at`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
    .returning();
}
