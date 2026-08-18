import { sql } from "drizzle-orm";
import type {
  AdminOnboardingFunnelResponse,
  OnboardingFunnelExperimentBucket,
  OnboardingFunnelStepStats,
  OnboardingFunnelStitchStats,
} from "@shared/api";

import { db } from "../db";

/**
 * Onboarding funnel aggregation (admin analytics, roadmap R1-4).
 *
 * All aggregation happens in SQL over `onboarding_analytics` — the route never
 * iterates raw rows in JS. `step_enter` is the V4 per-substep enter event;
 * legacy `step_started` is counted as entered for continuity.
 *
 * Index note: the table has single-column indexes on event_type and timestamp
 * but no composite (event_type, timestamp) index. Current volume is low enough
 * that the per-step GROUP BY is fine; if the table grows large, add a
 * composite index via migration (deliberately not done here).
 */

type StepRow = {
  step: string;
  step_index: number | null;
  entered: number;
  completed: number;
  abandoned: number;
  unique_sessions: number;
};

type StitchRow = {
  anonymous_sessions: number;
  stitched_sessions: number;
};

type ExperimentRow = {
  flag_key: string;
  bucket: string;
  entered_sessions: number;
  completed_sessions: number;
};

function toInt(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.trunc(n) : 0;
}

export async function getOnboardingFunnelStats(days: number): Promise<AdminOnboardingFunnelResponse> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const stepResult = await db.execute(sql`
    SELECT
      step,
      MIN(CASE WHEN metadata->>'stepIndex' ~ '^[0-9]+$' THEN (metadata->>'stepIndex')::int END) AS step_index,
      COUNT(*) FILTER (WHERE event_type IN ('step_enter', 'step_started'))::int AS entered,
      COUNT(*) FILTER (WHERE event_type = 'step_completed')::int AS completed,
      COUNT(*) FILTER (WHERE event_type = 'step_abandoned')::int AS abandoned,
      COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('step_enter', 'step_started'))::int AS unique_sessions
    FROM onboarding_analytics
    WHERE timestamp >= ${since}
      AND event_type IN ('step_enter', 'step_started', 'step_completed', 'step_abandoned')
    GROUP BY step
  `);

  // Anonymous → login stitch rate: distinct session ids seen with a null
  // userId that later (timestamp >= first anonymous sighting) appear on an
  // event carrying a userId.
  const stitchResult = await db.execute(sql`
    WITH anon AS (
      SELECT session_id, MIN(timestamp) AS first_seen
      FROM onboarding_analytics
      WHERE timestamp >= ${since}
        AND session_id IS NOT NULL
        AND user_id IS NULL
      GROUP BY session_id
    ),
    stitched AS (
      SELECT DISTINCT a.session_id
      FROM anon a
      JOIN onboarding_analytics e
        ON e.session_id = a.session_id
       AND e.user_id IS NOT NULL
       AND e.timestamp >= a.first_seen
    )
    SELECT
      (SELECT COUNT(*) FROM anon)::int AS anonymous_sessions,
      (SELECT COUNT(*) FROM stitched)::int AS stitched_sessions
  `);

  const experimentResult = await db.execute(sql`
    SELECT
      metadata->'experiment'->>'flagKey' AS flag_key,
      metadata->'experiment'->>'bucket' AS bucket,
      COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('step_enter', 'step_started'))::int AS entered_sessions,
      COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'step_completed')::int AS completed_sessions
    FROM onboarding_analytics
    WHERE timestamp >= ${since}
      AND metadata->'experiment'->>'flagKey' IS NOT NULL
      AND metadata->'experiment'->>'bucket' IS NOT NULL
    GROUP BY 1, 2
    ORDER BY 1, 2
  `);

  const steps: OnboardingFunnelStepStats[] = (stepResult.rows as unknown as StepRow[])
    .map((row) => {
      const entered = toInt(row.entered);
      const completed = toInt(row.completed);
      const abandoned = toInt(row.abandoned);
      return {
        step: row.step,
        stepIndex: row.step_index === null ? null : toInt(row.step_index),
        entered,
        completed,
        abandoned,
        uniqueSessions: toInt(row.unique_sessions),
        completionRate: entered > 0 ? completed / entered : 0,
        abandonmentRate: entered > 0 ? abandoned / entered : 0,
      };
    })
    .sort((a, b) => {
      if (a.stepIndex !== null && b.stepIndex !== null) return a.stepIndex - b.stepIndex;
      if (a.stepIndex !== null) return -1;
      if (b.stepIndex !== null) return 1;
      return a.step.localeCompare(b.step);
    });

  const stitchRow = (stitchResult.rows as unknown as StitchRow[])[0];
  const anonymousSessions = toInt(stitchRow?.anonymous_sessions);
  const stitchedSessions = toInt(stitchRow?.stitched_sessions);
  const stitch: OnboardingFunnelStitchStats = {
    anonymousSessions,
    stitchedSessions,
    stitchRate: anonymousSessions > 0 ? stitchedSessions / anonymousSessions : 0,
  };

  const experiments: OnboardingFunnelExperimentBucket[] = (
    experimentResult.rows as unknown as ExperimentRow[]
  ).map((row) => ({
    flagKey: row.flag_key,
    bucket: row.bucket,
    enteredSessions: toInt(row.entered_sessions),
    completedSessions: toInt(row.completed_sessions),
  }));

  return {
    days,
    since: since.toISOString(),
    steps,
    stitch,
    experiments,
  };
}
