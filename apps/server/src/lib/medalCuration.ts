import type { SocialSessionState, Medal } from '@joyjoin/shared/socialIcebreaker';

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

function getDetectiveCandidates(
  state: SocialSessionState,
  roster: readonly RosterEntry[],
): RosterEntry[] {
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

  if (weights.size === 0) {
    return deterministicShuffle(roster, `${state.socialSessionId}:detective`);
  }

  return sortByWeightDescThenName(roster, weights);
}

function getChallengeCandidates(
  state: SocialSessionState,
  roster: readonly RosterEntry[],
): RosterEntry[] {
  const weights = new Map<string, number>();

  if (state.challengeCompletedBy?.length) {
    for (const uid of state.challengeCompletedBy) {
      weights.set(uid, (weights.get(uid) ?? 0) + 1);
    }
  }

  if (weights.size === 0) {
    return deterministicShuffle(roster, `${state.socialSessionId}:challenge`);
  }

  return sortByWeightDescThenName(roster, weights);
}

function getTopicKingCandidates(
  state: SocialSessionState,
  roster: readonly RosterEntry[],
): RosterEntry[] {
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

/**
 * Deterministically curate up to 3 medals for a Social Icebreaker session.
 *
 * Rules:
 * - One medal per category, awarded to distinct recipients.
 * - Weights are derived from actual session state; missing data falls back to
 *   a deterministic shuffle seeded by the session id.
 * - Same input (state + roster) always produces the same output.
 */
export function curateMedals(
  state: SocialSessionState,
  roster: RosterEntry[],
): Medal[] {
  if (!roster.length) return [];

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
