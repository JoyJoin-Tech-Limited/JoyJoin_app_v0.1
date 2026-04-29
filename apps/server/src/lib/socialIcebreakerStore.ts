/**
 * Social Icebreaker persistent session store.
 *
 * Replaces the previous module-level in-memory Maps with a PostgreSQL-backed
 * store using Drizzle ORM.  This provides:
 *
 * - Durability across server restarts.
 * - Correctness in multi-instance deployments.
 * - Explicit TTL / expiry semantics (sessions have a stored `expiresAt`
 *   timestamp; clients receive a structured error rather than an opaque 404).
 * - Separated roster (joined-ever) from active presence (heartbeat-based).
 * - Server-only lie-truth storage that is never returned to clients.
 */

import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  socialIcebreakerSessions,
  socialIcebreakerParticipants,
  socialIcebreakerLieTruths,
  socialIcebreakerPhasePulseChecks,
  momentCardInteractions,
  preGenerationJobs,
  preGenerationResults,
} from '@shared/schema';
import { socialIcebreakerMiniscriptSecrets } from '@shared/schemaAnalytics';
import type {
  SocialSessionParticipantSummary,
  SocialSessionState,
} from '@shared/socialIcebreaker';
import type {
  MiniScriptClue,
  MiniScriptSolution,
  MiniScriptPlayerKnowledge,
  MiniScriptRedHerring,
  MiniScriptDeductionChain,
} from '@shared/miniscriptStoryFramework';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
/** A participant is "active" if their last heartbeat is within this window. */
export const PRESENCE_THRESHOLD_MS = 30_000; // 30 seconds

// ---------------------------------------------------------------------------
// ID helpers
// ---------------------------------------------------------------------------

export function getSocialSessionId(icebreakerSessionId: string): string {
  return `social_${icebreakerSessionId}`;
}

function withExpiry(
  state: SocialSessionState,
  expiresAt: Date,
): SocialSessionState {
  return {
    ...state,
    expiresAt: expiresAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Session read helpers
// ---------------------------------------------------------------------------

/** Returns the full session state, or null if not found. */
export async function getSession(
  socialSessionId: string,
): Promise<SocialSessionState | null> {
  const rows = await db
    .select({
      stateJson: socialIcebreakerSessions.stateJson,
      expiresAt: socialIcebreakerSessions.expiresAt,
    })
    .from(socialIcebreakerSessions)
    .where(eq(socialIcebreakerSessions.id, socialSessionId))
    .limit(1);

  return rows[0]
    ? withExpiry(rows[0].stateJson as SocialSessionState, rows[0].expiresAt)
    : null;
}

/**
 * Returns the session state (or null if not found) AND whether it is expired.
 * Use this in route handlers so they can distinguish "never existed" from
 * "existed but expired".
 */
export async function getSessionWithExpiry(socialSessionId: string): Promise<{
  state: SocialSessionState | null;
  expired: boolean;
}> {
  const rows = await db
    .select({
      stateJson: socialIcebreakerSessions.stateJson,
      expiresAt: socialIcebreakerSessions.expiresAt,
    })
    .from(socialIcebreakerSessions)
    .where(eq(socialIcebreakerSessions.id, socialSessionId))
    .limit(1);

  if (!rows[0]) return { state: null, expired: false };

  const expired = rows[0].expiresAt < new Date();
  return {
    state: expired
      ? null
      : withExpiry(rows[0].stateJson as SocialSessionState, rows[0].expiresAt),
    expired,
  };
}

/** Look up socialSessionId by the upstream icebreakerSessionId key. */
export async function getSessionByIcebreakerSessionId(
  icebreakerSessionId: string,
): Promise<{ socialSessionId: string; state: SocialSessionState; expired: boolean } | null> {
  const rows = await db
    .select({
      id: socialIcebreakerSessions.id,
      stateJson: socialIcebreakerSessions.stateJson,
      expiresAt: socialIcebreakerSessions.expiresAt,
    })
    .from(socialIcebreakerSessions)
    .where(eq(socialIcebreakerSessions.icebreakerSessionId, icebreakerSessionId))
    .limit(1);

  if (!rows[0]) return null;

  const expired = rows[0].expiresAt < new Date();
  return {
    socialSessionId: rows[0].id,
    state: withExpiry(rows[0].stateJson as SocialSessionState, rows[0].expiresAt),
    expired,
  };
}

// ---------------------------------------------------------------------------
// Session write helpers
// ---------------------------------------------------------------------------

/** Persist a newly created session. */
export async function createSession(state: SocialSessionState): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(socialIcebreakerSessions).values({
    id: state.socialSessionId,
    icebreakerSessionId: state.icebreakerSessionId,
    hostUserId: state.hostUserId,
    hostDisplayName: state.hostDisplayName,
    currentPhase: state.currentPhase,
    phaseStartedAt: new Date(state.phaseStartedAt),
    sessionStartedAt: new Date(state.sessionStartedAt),
    expiresAt,
    stateJson: state as unknown as Record<string, unknown>,
  });
}

/** Persist an updated session state.  Only the mutable fields are updated. */
export async function updateSession(
  socialSessionId: string,
  state: SocialSessionState,
): Promise<void> {
  await db
    .update(socialIcebreakerSessions)
    .set({
      currentPhase: state.currentPhase,
      phaseStartedAt: new Date(state.phaseStartedAt),
      stateJson: state as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(socialIcebreakerSessions.id, socialSessionId));
}

// ---------------------------------------------------------------------------
// Participant roster & presence
// ---------------------------------------------------------------------------

/**
 * Record a participant joining (or re-joining) the session.
 * Upserts the row and bumps `lastSeenAt` to now.
 */
export async function upsertParticipant(
  socialSessionId: string,
  userId: string,
  displayName: string,
): Promise<void> {
  const now = new Date();
  await db
    .insert(socialIcebreakerParticipants)
    .values({ socialSessionId, userId, displayName, lastSeenAt: now })
    .onConflictDoUpdate({
      target: [
        socialIcebreakerParticipants.socialSessionId,
        socialIcebreakerParticipants.userId,
      ],
      set: { displayName, lastSeenAt: now },
    });
}

/** Bump lastSeenAt for presence tracking (call from heartbeat endpoint). */
export async function heartbeat(
  socialSessionId: string,
  userId: string,
): Promise<void> {
  await db
    .update(socialIcebreakerParticipants)
    .set({ lastSeenAt: new Date() })
    .where(
      and(
        eq(socialIcebreakerParticipants.socialSessionId, socialSessionId),
        eq(socialIcebreakerParticipants.userId, userId),
      ),
    );
}

/** Total number of users who have ever joined this session (roster size). */
export async function getRosterCount(socialSessionId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(socialIcebreakerParticipants)
    .where(eq(socialIcebreakerParticipants.socialSessionId, socialSessionId));
  return rows[0]?.count ?? 0;
}

/**
 * Number of participants who have been seen within `thresholdMs` milliseconds.
 * Defaults to PRESENCE_THRESHOLD_MS (30 s).
 */
export async function getActiveParticipantCount(
  socialSessionId: string,
  thresholdMs: number = PRESENCE_THRESHOLD_MS,
): Promise<number> {
  const since = new Date(Date.now() - thresholdMs);
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(socialIcebreakerParticipants)
    .where(
      and(
        eq(socialIcebreakerParticipants.socialSessionId, socialSessionId),
        gte(socialIcebreakerParticipants.lastSeenAt, since),
      ),
    );
  return rows[0]?.count ?? 0;
}

/** Retrieve a participant row for rejoin/name-preservation logic. */
export async function getParticipant(
  socialSessionId: string,
  userId: string,
): Promise<{ displayName: string } | null> {
  const rows = await db
    .select({ displayName: socialIcebreakerParticipants.displayName })
    .from(socialIcebreakerParticipants)
    .where(
      and(
        eq(socialIcebreakerParticipants.socialSessionId, socialSessionId),
        eq(socialIcebreakerParticipants.userId, userId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function listParticipants(
  socialSessionId: string,
  thresholdMs: number = PRESENCE_THRESHOLD_MS,
): Promise<SocialSessionParticipantSummary[]> {
  const rows = await db
    .select({
      userId: socialIcebreakerParticipants.userId,
      displayName: socialIcebreakerParticipants.displayName,
      joinedAt: socialIcebreakerParticipants.joinedAt,
      lastSeenAt: socialIcebreakerParticipants.lastSeenAt,
    })
    .from(socialIcebreakerParticipants)
    .where(eq(socialIcebreakerParticipants.socialSessionId, socialSessionId));

  const cutoff = Date.now() - thresholdMs;

  return rows
    .sort(
      (left: (typeof rows)[number], right: (typeof rows)[number]) =>
        left.joinedAt.getTime() - right.joinedAt.getTime(),
    )
    .map((participant: (typeof rows)[number]) => ({
      userId: participant.userId,
      displayName: participant.displayName,
      joinedAt: participant.joinedAt.toISOString(),
      lastSeenAt: participant.lastSeenAt.toISOString(),
      isActive: participant.lastSeenAt.getTime() >= cutoff,
    }));
}

// ---------------------------------------------------------------------------
// Lie-truth storage (server-only; never returned to clients)
// ---------------------------------------------------------------------------

/** Persist or replace the server-only lie-truth statements for a player. */
export async function setLieTruths(
  socialSessionId: string,
  userId: string,
  statements: Array<{ index: number; text: string; isLie: boolean }>,
): Promise<void> {
  const now = new Date();
  await db
    .insert(socialIcebreakerLieTruths)
    .values({ socialSessionId, userId, statementsJson: statements, updatedAt: now })
    .onConflictDoUpdate({
      target: [
        socialIcebreakerLieTruths.socialSessionId,
        socialIcebreakerLieTruths.userId,
      ],
      set: { statementsJson: statements, updatedAt: now },
    });
}

/**
 * Retrieve the server-only lie-truth statements for a specific player.
 * Returns null if not found.
 */
export async function getLieTruths(
  socialSessionId: string,
  userId: string,
): Promise<Array<{ index: number; text: string; isLie: boolean }> | null> {
  const rows = await db
    .select({ statementsJson: socialIcebreakerLieTruths.statementsJson })
    .from(socialIcebreakerLieTruths)
    .where(
      and(
        eq(socialIcebreakerLieTruths.socialSessionId, socialSessionId),
        eq(socialIcebreakerLieTruths.userId, userId),
      ),
    )
    .limit(1);
  return rows[0]?.statementsJson ?? null;
}

/**
 * Retrieve all lie-truth entries for a session (used in recap/medal computation).
 * Returns a Map of userId → statements with isLie.
 */
export async function loadSessionLieTruths(
  socialSessionId: string,
): Promise<Map<string, Array<{ index: number; text: string; isLie: boolean }>>> {
  const rows = await db
    .select({
      userId: socialIcebreakerLieTruths.userId,
      statementsJson: socialIcebreakerLieTruths.statementsJson,
    })
    .from(socialIcebreakerLieTruths)
    .where(eq(socialIcebreakerLieTruths.socialSessionId, socialSessionId));

  const result = new Map<string, Array<{ index: number; text: string; isLie: boolean }>>();
  for (const row of rows) {
    result.set(row.userId, row.statementsJson);
  }
  return result;
}

// ---------------------------------------------------------------------------
// MiniScript secrets storage (server-only; never returned to clients)
// ---------------------------------------------------------------------------

export interface MiniScriptSecrets {
  solution: MiniScriptSolution;
  playerKnowledge: MiniScriptPlayerKnowledge[];
  redHerrings: MiniScriptRedHerring[];
  deductionChain: MiniScriptDeductionChain[];
  allClues: MiniScriptClue[];
}

export async function setMiniScriptSecrets(
  socialSessionId: string,
  secrets: MiniScriptSecrets,
): Promise<void> {
  await db
    .insert(socialIcebreakerMiniscriptSecrets)
    .values({
      socialSessionId,
      secretsJson: JSON.stringify(secrets),
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: socialIcebreakerMiniscriptSecrets.socialSessionId,
      set: { secretsJson: JSON.stringify(secrets) },
    });
}

export async function getMiniScriptSecrets(
  socialSessionId: string,
): Promise<MiniScriptSecrets | null> {
  const rows = await db
    .select({ secretsJson: socialIcebreakerMiniscriptSecrets.secretsJson })
    .from(socialIcebreakerMiniscriptSecrets)
    .where(eq(socialIcebreakerMiniscriptSecrets.socialSessionId, socialSessionId))
    .limit(1);

  if (!rows[0]?.secretsJson) return null;
  try {
    return JSON.parse(rows[0].secretsJson) as MiniScriptSecrets;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// TTL sweep (run periodically from route module)
// ---------------------------------------------------------------------------

/** Delete sessions whose expiresAt has passed. */
export async function sweepExpiredSessions(): Promise<void> {
  await db
    .delete(socialIcebreakerSessions)
    .where(lt(socialIcebreakerSessions.expiresAt, new Date()));
}

// ---------------------------------------------------------------------------
// Pulse checks
// ---------------------------------------------------------------------------

/** Save a per-phase pulse check rating (1-3). Idempotent per user+phase. */
export async function savePulseCheck(
  socialSessionId: string,
  userId: string,
  phase: string,
  rating: number,
): Promise<void> {
  await db
    .insert(socialIcebreakerPhasePulseChecks)
    .values({ socialSessionId, userId, phase, rating })
    .onConflictDoNothing({
      target: [
        socialIcebreakerPhasePulseChecks.socialSessionId,
        socialIcebreakerPhasePulseChecks.userId,
        socialIcebreakerPhasePulseChecks.phase,
      ],
    });
}

/** Get average pulse-check rating per phase for a session. */
export async function getPhaseRatings(
  socialSessionId: string,
): Promise<Array<{ phase: string; avgRating: number; count: number }>> {
  const rows = await db
    .select({
      phase: socialIcebreakerPhasePulseChecks.phase,
      avgRating: sql<string | null>`avg(${socialIcebreakerPhasePulseChecks.rating})`,
      count: sql<string | null>`count(*)`,
    })
    .from(socialIcebreakerPhasePulseChecks)
    .where(eq(socialIcebreakerPhasePulseChecks.socialSessionId, socialSessionId))
    .groupBy(socialIcebreakerPhasePulseChecks.phase);

  return rows.map((r: { phase: string; avgRating: string | null; count: string | null }) => ({
    phase: r.phase,
    avgRating: Math.round((parseFloat(r.avgRating ?? '0') ?? 0) * 100) / 100,
    count: Number(r.count ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Moment Card interactions
// ---------------------------------------------------------------------------

/** Log a Moment Card interaction (save, share, qr_scan). */
export async function logMomentCardInteraction(
  socialSessionId: string,
  userId: string,
  action: string,
  deviceInfo?: Record<string, unknown>,
): Promise<void> {
  await db.insert(momentCardInteractions).values({
    socialSessionId,
    userId,
    action,
    deviceInfo: deviceInfo ?? null,
  });
}

/** Get Moment Card interaction counts by action for a session. */
export async function getMomentCardStats(
  socialSessionId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      action: momentCardInteractions.action,
      count: sql<number>`count(*)`,
    })
    .from(momentCardInteractions)
    .where(eq(momentCardInteractions.socialSessionId, socialSessionId))
    .groupBy(momentCardInteractions.action);

  const stats: Record<string, number> = {};
  for (const r of rows) {
    stats[r.action] = Number(r.count ?? 0);
  }
  return stats;
}


// ---------------------------------------------------------------------------
// Pre-generation pipeline
// ---------------------------------------------------------------------------

export async function enqueuePreGenerationJob(
  socialSessionId: string,
  phase: string,
  priority: number = 0,
  payload: Record<string, unknown> = {},
): Promise<string> {
  const result = await db
    .insert(preGenerationJobs)
    .values({ socialSessionId, phase, priority, payload, status: 'pending' })
    .onConflictDoUpdate({
      target: [preGenerationJobs.socialSessionId, preGenerationJobs.phase],
      set: { priority, payload, status: 'pending', updatedAt: new Date() },
    })
    .returning({ id: preGenerationJobs.id });
  return result[0]?.id;
}

export async function dequeuePendingJob(): Promise<{
  id: string;
  socialSessionId: string;
  phase: string;
  payload: Record<string, unknown>;
} | null> {
  const rows = await db
    .select({
      id: preGenerationJobs.id,
      socialSessionId: preGenerationJobs.socialSessionId,
      phase: preGenerationJobs.phase,
      payload: preGenerationJobs.payload,
    })
    .from(preGenerationJobs)
    .where(eq(preGenerationJobs.status, 'pending'))
    .orderBy(sql`${preGenerationJobs.priority} desc`, preGenerationJobs.createdAt)
    .limit(1);

  if (!rows[0]) return null;

  // Mark as running
  await db
    .update(preGenerationJobs)
    .set({ status: 'running', updatedAt: new Date() })
    .where(eq(preGenerationJobs.id, rows[0].id));

  return {
    id: rows[0].id,
    socialSessionId: rows[0].socialSessionId,
    phase: rows[0].phase,
    payload: (rows[0].payload as Record<string, unknown>) || {},
  };
}

export async function completePreGenerationJob(
  jobId: string,
  resultId: string,
): Promise<void> {
  await db
    .update(preGenerationJobs)
    .set({ status: 'completed', resultId, updatedAt: new Date() })
    .where(eq(preGenerationJobs.id, jobId));
}

export async function failPreGenerationJob(
  jobId: string,
  errorCode: string,
): Promise<void> {
  await db
    .update(preGenerationJobs)
    .set({ status: 'failed', errorCode, updatedAt: new Date() })
    .where(eq(preGenerationJobs.id, jobId));
}

export async function storePreGenerationResult(
  socialSessionId: string,
  phase: string,
  contentJson: Record<string, unknown>,
  aiMeta?: Record<string, unknown>,
  judgeScores?: Record<string, unknown>,
): Promise<string> {
  const result = await db
    .insert(preGenerationResults)
    .values({ socialSessionId, phase, contentJson, aiMeta: aiMeta ?? null, judgeScores: judgeScores ?? null })
    .onConflictDoUpdate({
      target: [preGenerationResults.socialSessionId, preGenerationResults.phase],
      set: { contentJson, aiMeta: aiMeta ?? null, judgeScores: judgeScores ?? null },
    })
    .returning({ id: preGenerationResults.id });
  return result[0]?.id;
}

export async function getPreGenerationResult(
  socialSessionId: string,
  phase: string,
): Promise<{ contentJson: Record<string, unknown>; aiMeta?: Record<string, unknown> } | null> {
  const rows = await db
    .select({
      contentJson: preGenerationResults.contentJson,
      aiMeta: preGenerationResults.aiMeta,
    })
    .from(preGenerationResults)
    .where(
      and(
        eq(preGenerationResults.socialSessionId, socialSessionId),
        eq(preGenerationResults.phase, phase),
      ),
    )
    .limit(1);

  if (!rows[0]) return null;
  return {
    contentJson: (rows[0].contentJson as Record<string, unknown>) || {},
    aiMeta: (rows[0].aiMeta as Record<string, unknown>) || undefined,
  };
}

export async function getPreGenerationJobStatus(
  socialSessionId: string,
  phase: string,
): Promise<string | null> {
  const rows = await db
    .select({ status: preGenerationJobs.status })
    .from(preGenerationJobs)
    .where(
      and(
        eq(preGenerationJobs.socialSessionId, socialSessionId),
        eq(preGenerationJobs.phase, phase),
      ),
    )
    .limit(1);

  return rows[0]?.status ?? null;
}

export async function listPendingPreGenerationJobs(): Promise<
  Array<{ id: string; socialSessionId: string; phase: string; priority: number }>
> {
  return db
    .select({
      id: preGenerationJobs.id,
      socialSessionId: preGenerationJobs.socialSessionId,
      phase: preGenerationJobs.phase,
      priority: preGenerationJobs.priority,
    })
    .from(preGenerationJobs)
    .where(eq(preGenerationJobs.status, 'pending'))
    .orderBy(sql`${preGenerationJobs.priority} desc`, preGenerationJobs.createdAt);
}

export async function getInFlightJobForPhase(
  socialSessionId: string,
  phase: string,
): Promise<{ id: string; status: string } | null> {
  const rows = await db
    .select({ id: preGenerationJobs.id, status: preGenerationJobs.status })
    .from(preGenerationJobs)
    .where(
      and(
        eq(preGenerationJobs.socialSessionId, socialSessionId),
        eq(preGenerationJobs.phase, phase),
        eq(preGenerationJobs.status, 'running'),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}
