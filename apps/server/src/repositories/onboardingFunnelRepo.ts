import { sql } from "drizzle-orm";
import type {
  AdminOnboardingFunnelResponse,
  OnboardingEmotionMetrics,
  OnboardingFunnelExperimentBucket,
  OnboardingFunnelStepStats,
  OnboardingFunnelStitchStats,
  OnboardingResultStageDwellStats,
} from "@shared/api";

import { db } from "../db";

/**
 * Onboarding funnel aggregation (admin analytics, roadmap R1-4).
 *
 * All aggregation happens in SQL over `onboarding_analytics` — the route never
 * iterates raw rows in JS. `step_enter` is the V4 per-substep enter event;
 * legacy `step_started` is counted as entered for continuity.
 *
 * Reporting window: `days` (rolling, default path) or an explicit
 * `[from, to)` range (PR-2, e.g. the 2026-08-18 ceremony-baseline split).
 *
 * Index note: a composite (event_type, timestamp) index was added via
 * migration 0002_onboarding_analytics_event_type_timestamp_idx (PR-2) to
 * cover the per-step GROUP BY + interaction-row scans below.
 */

type StepRow = {
  step: string;
  step_index: number | null;
  entered: number;
  completed: number;
  abandoned: number;
  unique_sessions: number;
  p50_step_duration: number | string | null;
  p90_step_duration: number | string | null;
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

type EmotionCountRow = {
  ceremony_auto: number;
  ceremony_tap: number;
  slot_starts: number;
  slot_skips: number;
  commentary_read_complete: number;
  commentary_cut_short: number;
};

type StageDwellRow = {
  stage: string;
  median_dwell_ms: number | string | null;
  samples: number;
};

function toInt(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** percentile_cont returns double precision (number via node-pg); guard strings/null. */
function toFloatOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export interface OnboardingFunnelRange {
  /** Inclusive window start. Defaults to `days` rolling back from now. */
  from?: Date;
  /** Exclusive window end. Omit for an open-ended window. */
  to?: Date;
}

export async function getOnboardingFunnelStats(
  days: number,
  range: OnboardingFunnelRange = {},
): Promise<AdminOnboardingFunnelResponse> {
  const windowFrom = range.from ?? new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const windowTo = range.to ?? null;
  const windowClause = windowTo
    ? sql`timestamp >= ${windowFrom} AND timestamp < ${windowTo}`
    : sql`timestamp >= ${windowFrom}`;

  const stepResult = await db.execute(sql`
    SELECT
      step,
      MIN(CASE WHEN metadata->>'stepIndex' ~ '^[0-9]+$' THEN (metadata->>'stepIndex')::int END) AS step_index,
      COUNT(*) FILTER (WHERE event_type IN ('step_enter', 'step_started'))::int AS entered,
      COUNT(*) FILTER (WHERE event_type = 'step_completed')::int AS completed,
      COUNT(*) FILTER (WHERE event_type = 'step_abandoned')::int AS abandoned,
      COUNT(DISTINCT session_id) FILTER (WHERE event_type IN ('step_enter', 'step_started'))::int AS unique_sessions,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY step_duration)
        FILTER (WHERE step_duration > 0 AND event_type IN ('step_completed', 'step_abandoned')) AS p50_step_duration,
      percentile_cont(0.9) WITHIN GROUP (ORDER BY step_duration)
        FILTER (WHERE step_duration > 0 AND event_type IN ('step_completed', 'step_abandoned')) AS p90_step_duration
    FROM onboarding_analytics
    WHERE ${windowClause}
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
      WHERE ${windowClause}
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
    WHERE ${windowClause}
      AND metadata->'experiment'->>'flagKey' IS NOT NULL
      AND metadata->'experiment'->>'bucket' IS NOT NULL
    GROUP BY 1, 2
    ORDER BY 1, 2
  `);

  // PR-2 emotion metrics — interaction rows keyed by metadata->>'action'.
  const emotionCountResult = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE metadata->>'action' = 'ceremony_advance' AND metadata->>'mode' = 'auto')::int AS ceremony_auto,
      COUNT(*) FILTER (WHERE metadata->>'action' = 'ceremony_advance' AND metadata->>'mode' = 'tap')::int AS ceremony_tap,
      COUNT(*) FILTER (WHERE metadata->>'action' = 'slot_animation_start')::int AS slot_starts,
      COUNT(*) FILTER (WHERE metadata->>'action' = 'skip_animation')::int AS slot_skips,
      COUNT(*) FILTER (WHERE metadata->>'action' = 'commentary_read_complete')::int AS commentary_read_complete,
      COUNT(*) FILTER (WHERE metadata->>'action' = 'commentary_cut_short')::int AS commentary_cut_short
    FROM onboarding_analytics
    WHERE ${windowClause}
      AND event_type = 'interaction'
  `);

  const stageDwellResult = await db.execute(sql`
    SELECT
      metadata->>'stage' AS stage,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY (metadata->>'dwellMs')::numeric) AS median_dwell_ms,
      COUNT(*)::int AS samples
    FROM onboarding_analytics
    WHERE ${windowClause}
      AND event_type = 'interaction'
      AND metadata->>'action' = 'result_stage_dwell'
      AND metadata->>'stage' IS NOT NULL
      AND metadata->>'dwellMs' ~ '^[0-9]+$'
    GROUP BY 1
    ORDER BY 1
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
        p50StepDurationMs: toFloatOrNull(row.p50_step_duration),
        p90StepDurationMs: toFloatOrNull(row.p90_step_duration),
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

  const emotionRow = (emotionCountResult.rows as unknown as EmotionCountRow[])[0];
  const ceremonyAuto = toInt(emotionRow?.ceremony_auto);
  const ceremonyTap = toInt(emotionRow?.ceremony_tap);
  const slotStarts = toInt(emotionRow?.slot_starts);
  const slotSkips = toInt(emotionRow?.slot_skips);
  const commentaryReadComplete = toInt(emotionRow?.commentary_read_complete);
  const commentaryCutShort = toInt(emotionRow?.commentary_cut_short);

  const resultStageDwell: OnboardingResultStageDwellStats[] = (
    stageDwellResult.rows as unknown as StageDwellRow[]
  ).map((row) => ({
    stage: row.stage,
    medianDwellMs: toFloatOrNull(row.median_dwell_ms),
    samples: toInt(row.samples),
  }));

  const emotion: OnboardingEmotionMetrics = {
    ceremonyAdvance: {
      auto: ceremonyAuto,
      tap: ceremonyTap,
      autoRatio: ceremonyAuto + ceremonyTap > 0 ? ceremonyAuto / (ceremonyAuto + ceremonyTap) : 0,
    },
    slotSkip: {
      starts: slotStarts,
      skips: slotSkips,
      skipRate: slotStarts > 0 ? slotSkips / slotStarts : 0,
    },
    resultStageDwell,
    commentaryRead: {
      readComplete: commentaryReadComplete,
      cutShort: commentaryCutShort,
      readCompleteRatio:
        commentaryReadComplete + commentaryCutShort > 0
          ? commentaryReadComplete / (commentaryReadComplete + commentaryCutShort)
          : 0,
    },
  };

  return {
    days,
    since: windowFrom.toISOString(),
    until: windowTo ? windowTo.toISOString() : null,
    steps,
    stitch,
    experiments,
    emotion,
  };
}
