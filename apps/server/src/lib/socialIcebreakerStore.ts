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
} from '@shared/schema';
import type { SocialSessionState } from '@shared/socialIcebreaker';

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

  return rows[0] ? (rows[0].stateJson as SocialSessionState) : null;
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
    state: expired ? null : (rows[0].stateJson as SocialSessionState),
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
    state: rows[0].stateJson as SocialSessionState,
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
    stateJson: { ...state, expiresAt: expiresAt.toISOString() } as Record<string, unknown>,
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
      stateJson: state as Record<string, unknown>,
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
export async function getAllSessionLieTruths(
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
// TTL sweep (run periodically from route module)
// ---------------------------------------------------------------------------

/** Delete sessions whose expiresAt has passed. */
export async function sweepExpiredSessions(): Promise<void> {
  await db
    .delete(socialIcebreakerSessions)
    .where(lt(socialIcebreakerSessions.expiresAt, new Date()));
}
