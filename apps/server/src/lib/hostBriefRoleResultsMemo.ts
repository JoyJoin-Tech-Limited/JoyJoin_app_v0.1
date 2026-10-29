/**
 * FU-02 — memoized ACOEXP lookup for the warmup host brief.
 *
 * `buildClientState` runs on every 3s session poll. `deriveTablePersona` can
 * sharpen its energy band from roster-average ACOEXP extraversion, but reading
 * `role_results` on every poll would put a batch query on the hottest read path
 * of the icebreaker session. This module is the single gate in front of that
 * read:
 *
 * - at most one query per `socialSessionId` per TTL window;
 * - a bounded map (`HOST_BRIEF_ROLE_RESULTS_MAX_SESSIONS`) with oldest-first
 *   eviction, so a long-lived process cannot accumulate sessions;
 * - fail-open: any error resolves to an empty map, which `deriveTablePersona`
 *   already treats as "no ACOEXP signal" and degrades to the archetype
 *   composition. Nothing here can block or fail a poll.
 *
 * The caller owns the authority guard (requesting user is the host, phase is
 * `warmup`, `icebreakerMatchingAwareEnabled` is on). This module never decides
 * who may ask — it only decides how often the answer is recomputed.
 *
 * `role_results` rows are normalized to 0–100 by `assessmentRepo` (the V1 0–10
 * upscale lives there, not here), so this module stays a pure cache.
 */

import {
  getLatestRoleResultsForUsers,
  type LatestRoleTraitScores,
} from '../repositories/assessmentRepo';
import { logger } from './logger';
import type { TablePersonaRoleResults } from './tablePersona';

/** One `role_results` batch read per session per 5 minutes. */
export const HOST_BRIEF_ROLE_RESULTS_TTL_MS = 300_000;

/** Hard bound on memoized sessions; oldest entry is evicted first. */
export const HOST_BRIEF_ROLE_RESULTS_MAX_SESSIONS = 200;

interface HostBriefRoleResultsMemoEntry {
  expiresAt: number;
  value: TablePersonaRoleResults;
}

const memo = new Map<string, HostBriefRoleResultsMemoEntry>();

function pruneExpired(now: number): void {
  for (const [key, entry] of memo) {
    if (entry.expiresAt <= now) memo.delete(key);
  }
}

function remember(
  socialSessionId: string,
  value: TablePersonaRoleResults,
  now: number,
): void {
  pruneExpired(now);
  while (memo.size >= HOST_BRIEF_ROLE_RESULTS_MAX_SESSIONS) {
    const oldest = memo.keys().next();
    if (oldest.done) break;
    memo.delete(oldest.value);
  }
  memo.set(socialSessionId, {
    expiresAt: now + HOST_BRIEF_ROLE_RESULTS_TTL_MS,
    value,
  });
}

/**
 * Latest ACOEXP slice for the roster, memoized per session.
 *
 * Returns an empty map when the session id is missing or the lookup fails, so
 * the caller never has to branch on failure.
 */
export async function getHostBriefRoleResults(
  socialSessionId: string,
  userIds: ReadonlyArray<string>,
): Promise<TablePersonaRoleResults> {
  const key = typeof socialSessionId === 'string' ? socialSessionId.trim() : '';
  if (!key) return new Map();

  const now = Date.now();
  const cached = memo.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  let value: TablePersonaRoleResults;
  try {
    value = await getLatestRoleResultsForUsers(userIds);
  } catch (error) {
    logger.warn('[HostTableBrief] role-results lookup failed; falling back to archetype energy', {
      socialSessionId: key,
      error: error instanceof Error ? error.message : String(error),
    });
    value = new Map<string, LatestRoleTraitScores>();
  }

  // Negative results are memoized too. "One query per session per TTL window"
  // has to hold on the failure path as well, otherwise a broken database turns
  // the 3s poll into a retry storm. The cost is a bounded 5-minute archetype
  // fallback — exactly the documented degradation, never a broken session.
  remember(key, value, Date.now());
  return value;
}

/** Test seam: the memo is process-global and keyed by session id. */
export function resetHostBriefRoleResultsMemo(): void {
  memo.clear();
}

/** Test seam: proves the bound and the TTL eviction without a database. */
export function getHostBriefRoleResultsMemoSize(): number {
  return memo.size;
}
