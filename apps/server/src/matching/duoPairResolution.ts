/**
 * 双人成行 S1 (one-partner-per-pool) — pool-formation overlap backstop.
 *
 * The write-side guard (`repositories/duoBindingRepo` +
 * `resolveOptionalRegistrationAttribution`) refuses new overlapping duo
 * bindings, but two sources can still present overlaps to the matcher:
 *   - legacy invitation_uses rows written before the guard existed
 *   - a concurrent double-consume race (the DB partial unique index is
 *     deliberately deferred — sprint-contract duo-s1-one-partner-per-pool
 *     Negotiation Log — on the precondition that THIS backstop exists)
 *
 * Previously `poolFormation.ts` built `duoPartnerOf` as a bare Map with
 * last-write-wins: in an A→B / A→C overlap, A's partner was whichever pair
 * landed last, and the leftover partner was silently deferred (顺延) with no
 * signal. This pure resolver replaces that with a deterministic rule:
 *
 *   ANY user appearing in 2+ distinct pairs → every pair touching them is
 *   dropped and EVERY user of those pairs is reported as conflict-involved.
 *   The caller removes conflicted users from the eligible roster entirely
 *   (整组顺延 — a duo never matches as a half-unit, so the other member of a
 *   dropped pair strands too) and emits a structured `duo_conflict` warn.
 *
 * Order-independent by construction (appearance counting over a deduped pair
 * set, sorted output) — the result does not depend on Map/iteration order
 * (Harness Reliability pillar).
 *
 * Sprint contract: duo-s1-one-partner-per-pool AC-4.
 */

export interface DuoPairInput {
  inviterId: string;
  inviteeId: string;
}

export interface DuoPairResolution {
  /** Clean 1:1 partner map (both directions) over surviving pairs. */
  duoPartnerOf: Map<string, string>;
  /** Sorted "a|b" keys of surviving pairs (duo-internal metric exclusion). */
  duoInternalPairKeys: Set<string>;
  /** Users touched by ≥1 dropped pair, sorted — all strand (整组顺延). */
  conflictingUserIds: string[];
  /** Number of input pairs dropped by the conflict rule (post-dedup). */
  droppedPairCount: number;
  /** Surviving pairs in input order (deduped, conflict-free). */
  pairs: DuoPairInput[];
}

export function duoPairKey(inviterId: string, inviteeId: string): string {
  return [inviterId, inviteeId].sort().join("|");
}

export function resolveDuoPairSet(duoPairs: DuoPairInput[]): DuoPairResolution {
  // 1. Drop degenerate self-pairs defensively (matchRun already skips them)
  //    and dedupe identical pairs regardless of direction — a re-presented
  //    identical binding is benign and must NOT count as a conflict.
  const uniquePairs: DuoPairInput[] = [];
  const seenKeys = new Set<string>();
  for (const pair of duoPairs) {
    if (pair.inviterId === pair.inviteeId) continue;
    const key = duoPairKey(pair.inviterId, pair.inviteeId);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    uniquePairs.push(pair);
  }

  // 2. Appearance counting — a user in 2+ unique pairs is a conflict pivot.
  const appearances = new Map<string, number>();
  for (const pair of uniquePairs) {
    appearances.set(pair.inviterId, (appearances.get(pair.inviterId) ?? 0) + 1);
    appearances.set(pair.inviteeId, (appearances.get(pair.inviteeId) ?? 0) + 1);
  }
  const isConflictPivot = (id: string) => (appearances.get(id) ?? 0) > 1;

  // 3. Drop every pair touching a pivot; BOTH members are conflict-involved
  //    (the non-pivot member's only binding is the dropped one — it strands
  //    together with the pivot per atomic-unit semantics).
  const duoPartnerOf = new Map<string, string>();
  const duoInternalPairKeys = new Set<string>();
  const conflicting = new Set<string>();
  const survivingPairs: DuoPairInput[] = [];
  let droppedPairCount = 0;

  for (const pair of uniquePairs) {
    if (isConflictPivot(pair.inviterId) || isConflictPivot(pair.inviteeId)) {
      conflicting.add(pair.inviterId);
      conflicting.add(pair.inviteeId);
      droppedPairCount++;
      continue;
    }
    survivingPairs.push(pair);
    duoPartnerOf.set(pair.inviterId, pair.inviteeId);
    duoPartnerOf.set(pair.inviteeId, pair.inviterId);
    duoInternalPairKeys.add(duoPairKey(pair.inviterId, pair.inviteeId));
  }

  return {
    duoPartnerOf,
    duoInternalPairKeys,
    conflictingUserIds: [...conflicting].sort(),
    droppedPairCount,
    pairs: survivingPairs,
  };
}
