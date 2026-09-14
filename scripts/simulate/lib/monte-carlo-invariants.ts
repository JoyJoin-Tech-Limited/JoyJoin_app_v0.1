/**
 * Monte Carlo group-formation harness — structural invariants (HARD assertions).
 * Extracted verbatim from run-group-monte-carlo.ts (behaviour-preserving).
 */
import { MAX_GROUP_SIZE, MIN_GROUP_SIZE } from './monte-carlo-constants';
import type { SyntheticPool, RunResult } from './monte-carlo-pool';

// ── Structural invariants (HARD assertions) ──────────────────────────

interface InvariantFailure {
  kind: string;
  poolIndex: number;
  poolSeed: number;
  arm: string;
  detail: string;
}

function checkRunInvariants(
  pool: SyntheticPool,
  arm: string,
  result: RunResult,
  // W2 (gm-debrief): the table-viability floor activates the odd-roster
  // absorption pass, whose documented contract (AC-W2.3) is soft overflow to
  // maxGroupSize+1 for 1–3 stranded users. Only the W2-driven arm sets this;
  // every other arm keeps the strict [min, max] bound.
  allowSoftOverflow = false,
): InvariantFailure[] {
  const failures: InvariantFailure[] = [];
  const seen = new Set<string>();
  const duoPartnerOf = new Map<string, string>();
  for (const duo of pool.duoPairs) {
    duoPartnerOf.set(duo.inviterId, duo.inviteeId);
    duoPartnerOf.set(duo.inviteeId, duo.inviterId);
  }

  const maxGroupSizeBound = MAX_GROUP_SIZE + (allowSoftOverflow ? 1 : 0);
  for (const group of result.groups) {
    // INV-1: size bounds
    if (group.members.length < MIN_GROUP_SIZE || group.members.length > maxGroupSizeBound) {
      failures.push({
        kind: 'INV-1',
        poolIndex: pool.index,
        poolSeed: pool.poolSeed,
        arm,
        detail: `group size ${group.members.length} outside [${MIN_GROUP_SIZE}, ${maxGroupSizeBound}]`,
      });
    }
    // INV-2: uniqueness
    for (const member of group.members) {
      if (seen.has(member.userId)) {
        failures.push({
          kind: 'INV-2',
          poolIndex: pool.index,
          poolSeed: pool.poolSeed,
          arm,
          detail: `member ${member.userId} appears in two groups`,
        });
      }
      seen.add(member.userId);
    }
    // INV-3a: ≤1 duo unit per group
    let duoUnits = 0;
    const counted = new Set<string>();
    const memberIds = new Set(group.members.map((m) => m.userId));
    for (const id of memberIds) {
      const partner = duoPartnerOf.get(id);
      if (partner && memberIds.has(partner) && !counted.has(id) && !counted.has(partner)) {
        duoUnits++;
        counted.add(id);
        counted.add(partner);
      }
    }
    if (duoUnits > 1) {
      failures.push({
        kind: 'INV-3',
        poolIndex: pool.index,
        poolSeed: pool.poolSeed,
        arm,
        detail: `group contains ${duoUnits} duo units (max 1)`,
      });
    }
    // INV-4: no NaN metrics
    for (const [name, value] of Object.entries({
      avgPairScore: group.avgPairScore,
      avgChemistryScore: group.avgChemistryScore,
      diversityScore: group.diversityScore,
      communicationBalance: group.communicationBalance,
      overallScore: group.overallScore,
    })) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        failures.push({
          kind: 'INV-4',
          poolIndex: pool.index,
          poolSeed: pool.poolSeed,
          arm,
          detail: `group metric ${name} is ${value}`,
        });
      }
    }
  }

  // INV-3b: duo partners co-located or both unmatched (atomicity)
  const unmatchedIds = new Set(result.unmatched.map((m) => m.respondent.id));
  for (const duo of pool.duoPairs) {
    const aIn = seen.has(duo.inviterId);
    const bIn = seen.has(duo.inviteeId);
    if (aIn !== bIn) {
      failures.push({
        kind: 'INV-3',
        poolIndex: pool.index,
        poolSeed: pool.poolSeed,
        arm,
        detail: `duo ${duo.inviterId}/${duo.inviteeId} split (one matched, one not)`,
      });
    }
    if (!aIn && !(unmatchedIds.has(duo.inviterId) && unmatchedIds.has(duo.inviteeId))) {
      failures.push({
        kind: 'INV-3',
        poolIndex: pool.index,
        poolSeed: pool.poolSeed,
        arm,
        detail: `duo ${duo.inviterId}/${duo.inviteeId} neither matched nor both unmatched`,
      });
    }
  }

  return failures;
}

export type {
  InvariantFailure,
};

export {
  checkRunInvariants,
};
