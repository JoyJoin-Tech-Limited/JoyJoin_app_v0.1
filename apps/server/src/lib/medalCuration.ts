import type { SocialSessionState, Medal } from '@joyjoin/shared/socialIcebreaker';
import { GLOW_MEDAL_COPY } from '@shared/copy/sessionGlow';
import { hasFullGlowAttendance, resolveOfferedGlowPhases } from './sessionGlow';

type RosterEntry = { displayName: string; userId: string };

const CATEGORIES: Array<{ title: string; emoji: string; description: string }> = [
  { title: '最佳侦探', emoji: '🕵️', description: '在侦探环节中表现最为出色' },
  { title: '挑战先锋', emoji: '⚡', description: '率先完成挑战任务' },
  { title: '话题王', emoji: '💬', description: '在话题卡环节中最活跃' },
];

/** DJB2-like 32-bit hash for seeding the PRNG. */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0; // force 32-bit signed int
  }
  return Math.abs(hash) || 1;
}

/** Simple LCG returning values in [0, 1). */
function makePrng(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return (seed >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle driven by a string seed. 100 % deterministic. */
function deterministicShuffle<T>(array: readonly T[], seedStr: string): T[] {
  const arr = array.slice();
  const rng = makePrng(hashString(seedStr));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sortByWeightDescThenName(
  roster: readonly RosterEntry[],
  weights: ReadonlyMap<string, number>,
): RosterEntry[] {
  return roster.slice().sort((a, b) => {
    const wa = weights.get(a.userId) ?? 0;
    const wb = weights.get(b.userId) ?? 0;
    if (wb !== wa) return wb - wa;
    const nameCmp = a.displayName.localeCompare(b.displayName, 'zh-CN');
    if (nameCmp !== 0) return nameCmp;
    return a.userId.localeCompare(b.userId);
  });
}

function computeDetectiveWeights(state: SocialSessionState): Map<string, number> {
  const weights = new Map<string, number>();

  // Exact correct guesses from the current reveal
  if (state.votes?.length && state.currentLieDetectiveReveal) {
    const lieIndex = state.currentLieDetectiveReveal.lieIndex;
    for (const vote of state.votes) {
      if (vote.guessedStatementIndex === lieIndex) {
        weights.set(vote.voterId, (weights.get(vote.voterId) ?? 0) + 1);
      }
    }
  }

  // Fallback to total votes cast as engagement signal
  if (weights.size === 0 && state.votes?.length) {
    for (const vote of state.votes) {
      weights.set(vote.voterId, (weights.get(vote.voterId) ?? 0) + 1);
    }
  }

  // Fallback to players who completed their detective turn
  if (weights.size === 0 && state.lieDetectiveCompletedUserIds?.length) {
    for (const uid of state.lieDetectiveCompletedUserIds) {
      weights.set(uid, 1);
    }
  }

  return weights;
}

function getDetectiveCandidates(
  state: SocialSessionState,
  roster: readonly RosterEntry[],
): RosterEntry[] {
  const weights = computeDetectiveWeights(state);

  if (weights.size === 0) {
    return deterministicShuffle(roster, `${state.socialSessionId}:detective`);
  }

  return sortByWeightDescThenName(roster, weights);
}

function computeChallengeWeights(state: SocialSessionState): Map<string, number> {
  const weights = new Map<string, number>();

  if (state.challengeCompletedBy?.length) {
    for (const uid of state.challengeCompletedBy) {
      weights.set(uid, (weights.get(uid) ?? 0) + 1);
    }
  }

  return weights;
}

function getChallengeCandidates(
  state: SocialSessionState,
  roster: readonly RosterEntry[],
): RosterEntry[] {
  const weights = computeChallengeWeights(state);

  if (weights.size === 0) {
    return deterministicShuffle(roster, `${state.socialSessionId}:challenge`);
  }

  return sortByWeightDescThenName(roster, weights);
}

function computeTopicKingWeights(state: SocialSessionState): Map<string, number> {
  const weights = new Map<string, number>();

  if (state.pulseChecks?.length) {
    for (const pc of state.pulseChecks) {
      weights.set(pc.userId, (weights.get(pc.userId) ?? 0) + pc.vibe);
    }
  } else if (state.warmupReadyUserIds?.length) {
    for (const uid of state.warmupReadyUserIds) {
      weights.set(uid, 1);
    }
  }

  return weights;
}

function getTopicKingCandidates(
  state: SocialSessionState,
  roster: readonly RosterEntry[],
): RosterEntry[] {
  const weights = computeTopicKingWeights(state);

  if (weights.size === 0) {
    return deterministicShuffle(roster, `${state.socialSessionId}:topic`);
  }

  return sortByWeightDescThenName(roster, weights);
}

const CATEGORY_GETTERS: Record<
  string,
  (state: SocialSessionState, roster: readonly RosterEntry[]) => RosterEntry[]
> = {
  '最佳侦探': getDetectiveCandidates,
  '挑战先锋': getChallengeCandidates,
  '话题王': getTopicKingCandidates,
};

// ─── Wave 4 高光值: honest medal path (sprint wave4-sessionGlow, AC-06) ─────

/** Cap on total medals per session (spec D2 — most players win, no inflation). */
export const GLOW_MEDAL_MAX_PER_SESSION = 4;

type GlowMedalCandidate = {
  def: { title: string; emoji: string; description: string };
  /** Data-strength of the medal's top candidate (drives award priority). */
  strength: number;
  /** Fixed declaration order — deterministic tie-break between medals. */
  order: number;
  /** This medal's candidates, strongest first (deterministic). */
  sortedRoster: RosterEntry[];
};

function weightMapCandidates(
  roster: readonly RosterEntry[],
  weights: ReadonlyMap<string, number>,
): { sortedRoster: RosterEntry[]; strength: number } | undefined {
  if (weights.size === 0) return undefined;
  const sorted = sortByWeightDescThenName(roster, weights);
  const top = sorted[0];
  if (!top) return undefined;
  return { sortedRoster: sorted, strength: weights.get(top.userId) ?? 0 };
}

/**
 * Wave 4 medal honesty iron rule (contract AC-06, verifier R4): on the
 * flag-ON path a medal is NEVER awarded without underlying data — the
 * deterministicShuffle no-data fallbacks are structurally unreachable here
 * (every candidate list comes from a non-empty weight map or a thresholded
 * glow source). Zero-data session → zero medals → honest empty state (D5).
 *
 * Cap 4 medals/session; distinct winners; ties deterministic via
 * sortByWeightDescThenName (weight → zh-CN name → userId); award priority =
 * data strength descending, declaration order ascending.
 */
function curateGlowMedals(
  state: SocialSessionState,
  roster: RosterEntry[],
): Medal[] {
  const candidates: GlowMedalCandidate[] = [];

  const consider = (
    order: number,
    def: { title: string; emoji: string; description: string },
    computed: { sortedRoster: RosterEntry[]; strength: number } | undefined,
  ): void => {
    if (!computed || computed.strength <= 0) return;
    candidates.push({ def, strength: computed.strength, order, sortedRoster: computed.sortedRoster });
  };

  // 接梗王 — quip votes received ≥ 2 (i.e. ≥ 4 glow points), highest first.
  {
    const weights = new Map<string, number>();
    for (const [userId, breakdown] of Object.entries(state.glowPoints ?? {})) {
      if (breakdown.quip >= 4) weights.set(userId, breakdown.quip);
    }
    consider(0, GLOW_MEDAL_COPY.quipKing, weightMapCandidates(roster, weights));
  }

  // 暖心雷达 — mirror nominations received ≥ 2 (i.e. ≥ 4 points).
  {
    const weights = new Map<string, number>();
    for (const [userId, breakdown] of Object.entries(state.glowPoints ?? {})) {
      if (breakdown.mirror >= 4) weights.set(userId, breakdown.mirror);
    }
    consider(1, GLOW_MEDAL_COPY.warmRadar, weightMapCandidates(roster, weights));
  }

  // 豪气担当 — ≥ 1 lot won, most wins; tie → earliest first winning lot.
  {
    const wins = new Map<string, { count: number; firstLotIndex: number }>();
    for (const result of state.auctionLotResults ?? []) {
      if (!result.winnerUserId) continue;
      const entry = wins.get(result.winnerUserId);
      if (entry) {
        entry.count += 1;
        entry.firstLotIndex = Math.min(entry.firstLotIndex, result.lotIndex);
      } else {
        wins.set(result.winnerUserId, { count: 1, firstLotIndex: result.lotIndex });
      }
    }
    if (wins.size > 0) {
      const sorted = roster.slice().sort((a, b) => {
        const wa = wins.get(a.userId);
        const wb = wins.get(b.userId);
        const ca = wa?.count ?? 0;
        const cb = wb?.count ?? 0;
        if (cb !== ca) return cb - ca;
        const fa = wa?.firstLotIndex ?? Number.MAX_SAFE_INTEGER;
        const fb = wb?.firstLotIndex ?? Number.MAX_SAFE_INTEGER;
        if (fa !== fb) return fa - fb;
        const nameCmp = a.displayName.localeCompare(b.displayName, 'zh-CN');
        if (nameCmp !== 0) return nameCmp;
        return a.userId.localeCompare(b.userId);
      });
      const top = sorted[0];
      const topWins = top ? wins.get(top.userId) : undefined;
      if (top && topWins) {
        consider(2, GLOW_MEDAL_COPY.bigSpender, { sortedRoster: sorted, strength: topWins.count });
      }
    }
  }

  // 全勤小可爱 — completed EVERY offered full-participation phase (V-5:
  // runPlan.segments else enabledPhases ∩ the 8 source phases), judged on
  // participation marks (points ≠ participation, verifier R2).
  {
    const offeredCount = resolveOfferedGlowPhases(state).length;
    if (offeredCount > 0) {
      const weights = new Map<string, number>();
      for (const entry of roster) {
        if (hasFullGlowAttendance(state, entry.userId)) {
          weights.set(entry.userId, offeredCount);
        }
      }
      consider(3, GLOW_MEDAL_COPY.fullAttendance, weightMapCandidates(roster, weights));
    }
  }

  // 最佳侦探 — existing weight chain (current-reveal correct guesses →
  // total votes cast → completed turns); empty chain → NOT awarded.
  consider(
    4,
    { title: '最佳侦探', emoji: '🕵️', description: '在侦探环节中表现最为出色' },
    weightMapCandidates(roster, computeDetectiveWeights(state)),
  );

  // 挑战先锋 — existing completion weights; empty → NOT awarded.
  consider(
    5,
    { title: '挑战先锋', emoji: '⚡', description: '率先完成挑战任务' },
    weightMapCandidates(roster, computeChallengeWeights(state)),
  );

  // 话题王 — existing pulse/ready weights; empty → NOT awarded.
  consider(
    6,
    { title: '话题王', emoji: '💬', description: '在话题卡环节中最活跃' },
    weightMapCandidates(roster, computeTopicKingWeights(state)),
  );

  candidates.sort((a, b) => b.strength - a.strength || a.order - b.order);

  const usedUserIds = new Set<string>();
  const medals: Medal[] = [];
  for (const candidate of candidates) {
    if (medals.length >= GLOW_MEDAL_MAX_PER_SESSION) break;
    const winner = candidate.sortedRoster.find((entry) => !usedUserIds.has(entry.userId));
    if (!winner) continue;
    usedUserIds.add(winner.userId);
    medals.push({
      emoji: candidate.def.emoji,
      title: candidate.def.title,
      recipientDisplayName: winner.displayName,
      description: candidate.def.description,
    });
  }
  return medals;
}

/**
 * Deterministically curate medals for a Social Icebreaker session.
 *
 * Rules (legacy / flag-OFF path — byte-for-byte pre-Wave-4 behavior):
 * - One medal per category, awarded to distinct recipients.
 * - Weights are derived from actual session state; missing data falls back to
 *   a deterministic shuffle seeded by the session id.
 * - Same input (state + roster) always produces the same output.
 *
 * Wave 4 (contract AC-06, verifier R4): when `state.sessionGlowEnabled ===
 * true` the honest path runs instead — medals derive ONLY from real session
 * data (glowPoints / auctionLotResults / participation marks / the existing
 * weight chains), the shuffle fallback is structurally unreachable, and a
 * zero-data session earns zero medals. The flag-OFF path below is
 * intentionally untouched byte-for-byte.
 */
export function curateMedals(
  state: SocialSessionState,
  roster: RosterEntry[],
): Medal[] {
  if (!roster.length) return [];

  if (state.sessionGlowEnabled === true) {
    return curateGlowMedals(state, roster);
  }

  const usedUserIds = new Set<string>();
  const medals: Medal[] = [];

  for (const cat of CATEGORIES) {
    const candidates = CATEGORY_GETTERS[cat.title](state, roster);
    const winner = candidates.find((c) => !usedUserIds.has(c.userId));
    if (winner) {
      usedUserIds.add(winner.userId);
      medals.push({
        emoji: cat.emoji,
        title: cat.title,
        recipientDisplayName: winner.displayName,
        description: cat.description,
      });
    }
  }

  return medals;
}
