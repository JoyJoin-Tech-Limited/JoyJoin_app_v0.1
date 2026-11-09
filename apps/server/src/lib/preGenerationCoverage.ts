/**
 * Pre-generation coverage — the publishable reliability number.
 *
 * Why this file exists
 * --------------------
 * Table-for-Six markets a 印厂 Agent that sends files to a print shop and
 * photo-checks table numbers. We have no print layer, so copying that agent
 * would be copying a cost. The equivalent reliability promise on our side is
 * different and stronger: **the content for a phase already exists before the
 * host opens it**. This module turns that promise into one number an operator,
 * an investor, or a host can read without a database console.
 *
 * The definition (read this before quoting the number)
 * ---------------------------------------------------
 * `strictOnTimeRate` = share of phase-uses where a `pre_generation_results` row
 * existed at or before `social_icebreaker_phase_metrics.started_at`.
 *
 * Two exclusions are structural, not cosmetic:
 *   1. **The first phase of every session is excluded.** Pre-generation is
 *      enqueued when the host calls `/start` (`scheduleStartBackgroundGeneration`),
 *      so the first phase begins before generation can possibly finish. Counting
 *      it would make a healthy pipeline report ~0% forever.
 *   2. **`recap` is excluded.** It is terminal and never pre-generated.
 *
 * `openReadyRate` adds a 15s grace window (`PRE_GENERATION_OPEN_GRACE_MS`) —
 * content that lands while the host is still reading the phase intro is not a
 * host-visible wait. `eventualCoverageRate` ignores timing entirely and answers
 * "did content ever arrive".
 *
 * Never report `strictOnTimeRate` without the sample size. Below
 * `PRE_GENERATION_MIN_SAMPLE` measured phase-uses the report returns
 * `INSUFFICIENT_DATA`, mirroring `audit-icebreaker-profile-context.ts`: an
 * empty staging database must never produce a 100% claim.
 */

import { and, eq, gte, isNotNull, lt, ne } from "drizzle-orm";

import {
  preGenerationJobs,
  preGenerationResults,
  socialIcebreakerPhaseMetrics,
  socialIcebreakerSessions,
} from "@shared/schema";

import { db } from "../db";
import type { AdminMetricRange } from "./adminMetrics";

/** Content arriving inside this window after phase start is not a visible wait. */
export const PRE_GENERATION_OPEN_GRACE_MS = 15_000;

/** Below this many measured phase-uses the report refuses to publish a rate. */
export const PRE_GENERATION_MIN_SAMPLE = 20;

/** Phases that can never be pre-generated, so they must not sit in a denominator. */
export const NON_PRE_GENERATABLE_PHASES: ReadonlySet<string> = new Set(["recap"]);

export interface PreGenerationPhaseUse {
  socialSessionId: string;
  phase: string;
  /** When the host actually opened the phase. */
  startedAt: Date;
}

export interface PreGenerationStoredResult {
  socialSessionId: string;
  phase: string;
  createdAt: Date;
  /** True when the stored content came from a curated fallback, not a live model. */
  fallbackUsed: boolean;
}

export interface PreGenerationJobRow {
  status: string;
  errorCode: string | null;
  phase: string;
}

export interface PreGenerationCoverageInput {
  phaseUses: PreGenerationPhaseUse[];
  results: PreGenerationStoredResult[];
  jobs: PreGenerationJobRow[];
  sessionCount: number;
  windowDays: number;
}

export type CoverageVerdict = "OK" | "INSUFFICIENT_DATA";

export interface PhaseCoverageRow {
  phase: string;
  used: number;
  readyBeforeOpen: number;
  readyWithinGrace: number;
  late: number;
  missing: number;
  fallback: number;
  /** readyBeforeOpen / used. Null when used = 0. */
  strictOnTimeRate: number | null;
  /** (readyBeforeOpen + readyWithinGrace) / used. */
  openReadyRate: number | null;
  /** (used - missing) / used. */
  eventualCoverageRate: number | null;
}

export interface PreGenerationCoverageReport {
  status: CoverageVerdict;
  windowDays: number;
  sessionCount: number;
  /** Phase-uses that entered the strict denominator (first phase + recap removed). */
  measuredPhaseUses: number;
  /** Phase-uses removed because they were the session's first phase. */
  excludedFirstPhaseUses: number;
  excludedNonGeneratableUses: number;
  /** Phase-uses dropped because `started_at` was null. */
  excludedUnmeasuredUses: number;
  strictOnTimeRate: number | null;
  openReadyRate: number | null;
  eventualCoverageRate: number | null;
  /** Share of sessions where every measured phase was ready before open. */
  sessionFullCoverageRate: number | null;
  sessionsWithFullCoverage: number;
  jobCompletionRate: number | null;
  jobCounts: Record<string, number>;
  jobFailureCodes: Array<{ code: string; count: number }>;
  /** Share of stored results that were live model output (not curated fallback). */
  liveContentShare: number | null;
  storedResultCount: number;
  phases: PhaseCoverageRow[];
  /** Machine-readable definition so a number can never be quoted without its scope. */
  definition: string;
  minSample: number;
  openGraceMs: number;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function round4(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10_000) / 10_000;
}

function keyOf(socialSessionId: string, phase: string): string {
  return `${socialSessionId}::${phase}`;
}

/**
 * Pure coverage computation. No DB, no clock — every input is explicit so the
 * unit test can pin the definition rather than mock a query.
 */
export function computePreGenerationCoverage(
  input: PreGenerationCoverageInput,
  options: { minSample?: number; openGraceMs?: number } = {},
): PreGenerationCoverageReport {
  const minSample = options.minSample ?? PRE_GENERATION_MIN_SAMPLE;
  const openGraceMs = options.openGraceMs ?? PRE_GENERATION_OPEN_GRACE_MS;

  const resultByKey = new Map<string, PreGenerationStoredResult>();
  for (const result of input.results) {
    resultByKey.set(keyOf(result.socialSessionId, result.phase), result);
  }

  // The first phase per session is structurally un-winnable (enqueued at /start).
  const firstPhaseBySession = new Map<string, { phase: string; startedAt: number }>();
  for (const use of input.phaseUses) {
    if (!use.startedAt || Number.isNaN(use.startedAt.getTime())) continue;
    const current = firstPhaseBySession.get(use.socialSessionId);
    const startedAt = use.startedAt.getTime();
    if (!current || startedAt < current.startedAt) {
      firstPhaseBySession.set(use.socialSessionId, { phase: use.phase, startedAt });
    }
  }

  const phaseAccumulator = new Map<
    string,
    {
      used: number;
      readyBeforeOpen: number;
      readyWithinGrace: number;
      late: number;
      missing: number;
      fallback: number;
    }
  >();

  let measuredPhaseUses = 0;
  let excludedFirstPhaseUses = 0;
  let excludedNonGeneratableUses = 0;
  let excludedUnmeasuredUses = 0;
  let readyBeforeOpenTotal = 0;
  let readyWithinGraceTotal = 0;
  let missingTotal = 0;

  /** sessionId -> every measured use was ready before open */
  const sessionFullCoverage = new Map<string, boolean>();

  for (const use of input.phaseUses) {
    if (NON_PRE_GENERATABLE_PHASES.has(use.phase)) {
      excludedNonGeneratableUses += 1;
      continue;
    }
    if (!use.startedAt || Number.isNaN(use.startedAt.getTime())) {
      excludedUnmeasuredUses += 1;
      continue;
    }

    const first = firstPhaseBySession.get(use.socialSessionId);
    // A session can revisit a phase; only the FIRST occurrence of the session's
    // first phase is structurally un-winnable. Later revisits stay measured.
    if (first && first.phase === use.phase && first.startedAt === use.startedAt.getTime()) {
      excludedFirstPhaseUses += 1;
      continue;
    }

    const row =
      phaseAccumulator.get(use.phase) ??
      { used: 0, readyBeforeOpen: 0, readyWithinGrace: 0, late: 0, missing: 0, fallback: 0 };

    row.used += 1;
    measuredPhaseUses += 1;

    const result = resultByKey.get(keyOf(use.socialSessionId, use.phase));
    if (!result) {
      row.missing += 1;
      missingTotal += 1;
      sessionFullCoverage.set(use.socialSessionId, false);
    } else {
      if (result.fallbackUsed) {
        row.fallback += 1;
      }
      const deltaMs = result.createdAt.getTime() - use.startedAt.getTime();
      if (deltaMs <= 0) {
        row.readyBeforeOpen += 1;
        readyBeforeOpenTotal += 1;
        if (!sessionFullCoverage.has(use.socialSessionId)) {
          sessionFullCoverage.set(use.socialSessionId, true);
        }
      } else if (deltaMs <= openGraceMs) {
        row.readyWithinGrace += 1;
        readyWithinGraceTotal += 1;
        sessionFullCoverage.set(use.socialSessionId, false);
      } else {
        row.late += 1;
        sessionFullCoverage.set(use.socialSessionId, false);
      }
    }

    phaseAccumulator.set(use.phase, row);
  }

  const phases: PhaseCoverageRow[] = [...phaseAccumulator.entries()]
    .map(([phase, row]) => ({
      phase,
      ...row,
      strictOnTimeRate: round4(rate(row.readyBeforeOpen, row.used)),
      openReadyRate: round4(rate(row.readyBeforeOpen + row.readyWithinGrace, row.used)),
      eventualCoverageRate: round4(rate(row.used - row.missing, row.used)),
    }))
    .sort((a, b) => b.used - a.used || a.phase.localeCompare(b.phase));

  const jobCounts: Record<string, number> = {};
  const failureCounts = new Map<string, number>();
  for (const job of input.jobs) {
    jobCounts[job.status] = (jobCounts[job.status] ?? 0) + 1;
    if (job.status === "failed") {
      const code = job.errorCode?.trim() || "unknown";
      failureCounts.set(code, (failureCounts.get(code) ?? 0) + 1);
    }
  }

  const settledJobs = (jobCounts.completed ?? 0) + (jobCounts.failed ?? 0);
  const jobFailureCodes = [...failureCounts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

  const sessionsWithFullCoverage = [...sessionFullCoverage.values()].filter(Boolean).length;
  const sessionsMeasured = sessionFullCoverage.size;

  // Live share is defined over stored results, not over used phase-uses: a result
  // can be stored for a phase the host never opened, and it still counts.
  const fallbackResults = input.results.filter((result) => result.fallbackUsed).length;

  return {
    status: measuredPhaseUses >= minSample ? "OK" : "INSUFFICIENT_DATA",
    windowDays: input.windowDays,
    sessionCount: input.sessionCount,
    measuredPhaseUses,
    excludedFirstPhaseUses,
    excludedNonGeneratableUses,
    excludedUnmeasuredUses,
    strictOnTimeRate: round4(rate(readyBeforeOpenTotal, measuredPhaseUses)),
    openReadyRate: round4(rate(readyBeforeOpenTotal + readyWithinGraceTotal, measuredPhaseUses)),
    eventualCoverageRate: round4(rate(measuredPhaseUses - missingTotal, measuredPhaseUses)),
    sessionFullCoverageRate: round4(rate(sessionsWithFullCoverage, sessionsMeasured)),
    sessionsWithFullCoverage,
    jobCompletionRate: round4(rate(jobCounts.completed ?? 0, settledJobs)),
    jobCounts,
    jobFailureCodes,
    liveContentShare: round4(rate(input.results.length - fallbackResults, input.results.length)),
    storedResultCount: input.results.length,
    phases,
    definition:
      "strictOnTimeRate = share of phase-uses where pre-generated content existed before the host opened the phase. " +
      "Excludes each session's first phase (pre-generation is enqueued at session start) and recap. " +
      "openReadyRate adds a 15s grace window; eventualCoverageRate ignores timing.",
    minSample,
    openGraceMs,
  };
}

// ============ DB loader ============

function readFallbackUsed(aiMeta: unknown): boolean {
  if (!aiMeta || typeof aiMeta !== "object") return false;
  const value = (aiMeta as Record<string, unknown>).fallbackUsed;
  return value === true;
}

/**
 * Load and compute coverage for sessions *created* inside `range`.
 *
 * Keying the window on `social_icebreaker_sessions.created_at` (not on result
 * or metric timestamps) keeps the denominator stable: a session either belongs
 * to the window or it does not.
 */
export async function loadPreGenerationCoverage(
  range: AdminMetricRange,
  options: { includeTest?: boolean; minSample?: number; openGraceMs?: number } = {},
): Promise<PreGenerationCoverageReport> {
  const includeTest = options.includeTest ?? false;
  const windowDays = Math.max(
    1,
    Math.round((range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000)),
  );

  const sessionConditions = [
    gte(socialIcebreakerSessions.createdAt, range.from),
    lt(socialIcebreakerSessions.createdAt, range.to),
  ];
  if (!includeTest) {
    sessionConditions.push(eq(socialIcebreakerSessions.isTestSession, false));
  }

  const sessionRows = (await db
    .select({ id: socialIcebreakerSessions.id })
    .from(socialIcebreakerSessions)
    .where(and(...sessionConditions))) as Array<{ id: string }>;

  const sessionIds = new Set(sessionRows.map((session) => session.id));
  if (sessionIds.size === 0) {
    return computePreGenerationCoverage(
      {
        phaseUses: [],
        results: [],
        jobs: [],
        sessionCount: 0,
        windowDays,
      },
      { minSample: options.minSample, openGraceMs: options.openGraceMs },
    );
  }

  const metricConditions = [
    gte(socialIcebreakerSessions.createdAt, range.from),
    lt(socialIcebreakerSessions.createdAt, range.to),
    isNotNull(socialIcebreakerPhaseMetrics.startedAt),
    ne(socialIcebreakerPhaseMetrics.phase, "recap"),
  ];
  if (!includeTest) {
    metricConditions.push(eq(socialIcebreakerSessions.isTestSession, false));
  }

  const [phaseUses, results, jobs] = (await Promise.all([
    db
      .select({
        socialSessionId: socialIcebreakerPhaseMetrics.socialSessionId,
        phase: socialIcebreakerPhaseMetrics.phase,
        startedAt: socialIcebreakerPhaseMetrics.startedAt,
      })
      .from(socialIcebreakerPhaseMetrics)
      .innerJoin(
        socialIcebreakerSessions,
        eq(socialIcebreakerSessions.id, socialIcebreakerPhaseMetrics.socialSessionId),
      )
      .where(and(...metricConditions)),
    db
      .select({
        socialSessionId: preGenerationResults.socialSessionId,
        phase: preGenerationResults.phase,
        createdAt: preGenerationResults.createdAt,
        aiMeta: preGenerationResults.aiMeta,
      })
      .from(preGenerationResults)
      .innerJoin(
        socialIcebreakerSessions,
        eq(socialIcebreakerSessions.id, preGenerationResults.socialSessionId),
      )
      .where(and(...sessionConditions)),
    db
      .select({
        status: preGenerationJobs.status,
        errorCode: preGenerationJobs.errorCode,
        phase: preGenerationJobs.phase,
      })
      .from(preGenerationJobs)
      .innerJoin(
        socialIcebreakerSessions,
        eq(socialIcebreakerSessions.id, preGenerationJobs.socialSessionId),
      )
      .where(and(...sessionConditions)),
  ])) as [
    Array<{ socialSessionId: string; phase: string; startedAt: Date | null }>,
    Array<{ socialSessionId: string; phase: string; createdAt: Date; aiMeta: unknown }>,
    Array<{ status: string; errorCode: string | null; phase: string }>,
  ];

  return computePreGenerationCoverage(
    {
      phaseUses: phaseUses
        .filter(
          (use): use is { socialSessionId: string; phase: string; startedAt: Date } =>
            use.startedAt !== null && sessionIds.has(use.socialSessionId),
        )
        .map((use) => ({
          socialSessionId: use.socialSessionId,
          phase: use.phase,
          startedAt: use.startedAt,
        })),
      results: results
        .filter((result) => sessionIds.has(result.socialSessionId))
        .map((result) => ({
          socialSessionId: result.socialSessionId,
          phase: result.phase,
          createdAt: result.createdAt,
          fallbackUsed: readFallbackUsed(result.aiMeta),
        })),
      jobs: jobs.filter((job) => job.status.length > 0),
      sessionCount: sessionIds.size,
      windowDays,
    },
    { minSample: options.minSample, openGraceMs: options.openGraceMs },
  );
}
