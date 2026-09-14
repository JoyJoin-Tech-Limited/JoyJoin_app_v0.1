/**
 * Monte Carlo group-formation harness — M11 shrinkage group-level payoff
 * helpers. Extracted verbatim from run-group-monte-carlo.ts.
 */
import type { MatchGroup } from '../../../apps/server/src/poolMatchingService';
import type { TraitKey } from '../../../packages/shared/src/personality/types';
import type { SyntheticRespondent } from './monte-carlo-population';
import type { SessionStore, SessionProduct } from './monte-carlo-sessions';
import type { RunResult } from './monte-carlo-pool';
import { ALL_TRAITS } from './monte-carlo-constants';
import { mean } from './monte-carlo-measurement';

// ── M11: shrinkage group-level payoff ────────────────────────────────

/**
 * Deterministic group alignment between a reference run and an injection run
 * of the SAME pool: greedy max member-overlap (Jaccard), ties broken by group
 * order (groups are produced in deterministic order by the matcher).
 */
function alignGroups(refGroups: MatchGroup[], injGroups: MatchGroup[]): Array<[number, number]> {
  const refIds = refGroups.map((g) => new Set(g.members.map((m) => m.userId)));
  const injIds = injGroups.map((g) => new Set(g.members.map((m) => m.userId)));
  const usedInj = new Set<number>();
  const pairs: Array<[number, number]> = [];

  for (let r = 0; r < refIds.length; r++) {
    let bestJ = -1;
    let bestScore = 0;
    for (let j = 0; j < injIds.length; j++) {
      if (usedInj.has(j)) continue;
      let intersection = 0;
      for (const id of refIds[r]) if (injIds[j].has(id)) intersection++;
      const union = refIds[r].size + injIds[j].size - intersection;
      const jaccard = union === 0 ? 0 : intersection / union;
      if (jaccard > bestScore) {
        bestScore = jaccard;
        bestJ = j;
      }
    }
    if (bestJ >= 0 && bestScore > 0) {
      usedInj.add(bestJ);
      pairs.push([r, bestJ]);
    }
  }
  return pairs;
}

function groupTraitMeans(group: MatchGroup, sessionByUserId: Map<string, SessionProduct>): Record<TraitKey, number> {
  const means = {} as Record<TraitKey, number>;
  for (const t of ALL_TRAITS) {
    means[t] =
      group.members.reduce((s, m) => s + sessionByUserId.get(m.userId)!.reportedTraits[t], 0) /
      group.members.length;
  }
  return means;
}

/**
 * Churn-free report-channel perturbation magnitude: mean per-trait
 * |reported − reference| over the INJECTED members only, where the reference
 * is their clean (off-arm) session. This is the per-member contribution to
 * group-mean movement (each member's contribution to their group's mean is
 * this magnitude / group size, so the aggregate preserves the ordering); it
 * excludes group-membership churn, so it isolates the channel shrinkage
 * operates on — the "group-level stabilization" part of the M11 durable
 * contract.
 */
function injectedPerturbation(
  ref: RunResult,
  injectedRespondents: SyntheticRespondent[],
  sessions: SessionStore,
  arm: 'adv-off' | 'adv-on'
): number {
  let total = 0;
  let n = 0;
  for (const respondent of injectedRespondents) {
    const refSession = ref.sessionByUserId.get(respondent.id);
    if (!refSession) continue;
    const adv = sessions.get(respondent, arm);
    for (const t of ALL_TRAITS) {
      total += Math.abs(adv.reportedTraits[t] - refSession.reportedTraits[t]);
      n++;
    }
  }
  return n > 0 ? total / n : 0;
}

/**
 * Every injected member's per-trait deviation from the no-information value
 * (reported − 50) for one arm. The durable contract's stabilization is the
 * variance reduction of this quantity from shrink-off to shrink-on.
 */
function injectedNeutralValues(
  injectedRespondents: SyntheticRespondent[],
  sessions: SessionStore,
  arm: 'adv-off' | 'adv-on'
): number[] {
  const values: number[] = [];
  for (const respondent of injectedRespondents) {
    const adv = sessions.get(respondent, arm);
    for (const t of ALL_TRAITS) values.push(adv.reportedTraits[t] - 50);
  }
  return values;
}

function variance(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return mean(xs.map((x) => (x - m) * (x - m)));
}

/** Mean per-trait |Δ group mean| between aligned groups of two runs of the same pool. */
function compositionDelta(ref: RunResult, inj: RunResult): { delta: number; alignedPairs: number } {
  const pairs = alignGroups(ref.groups, inj.groups);
  if (pairs.length === 0) return { delta: 0, alignedPairs: 0 };
  let total = 0;
  for (const [r, j] of pairs) {
    const refMeans = groupTraitMeans(ref.groups[r], ref.sessionByUserId);
    const injMeans = groupTraitMeans(inj.groups[j], inj.sessionByUserId);
    for (const t of ALL_TRAITS) {
      total += Math.abs(injMeans[t] - refMeans[t]);
    }
  }
  return { delta: total / (pairs.length * ALL_TRAITS.length), alignedPairs: pairs.length };
}

interface M11PoolResult {
  poolIndex: number;
  poolSeed: number;
  injectedCount: number;
  deltaOff: number;
  deltaOn: number;
  alignedPairsOff: number;
  alignedPairsOn: number;
  /** Churn-free |reported − clean ref| over injected members (context). */
  fixedDeltaOff: number;
  fixedDeltaOn: number;
}

/**
 * One injection-rate row of the M11 sweep (5/10/20/40%).
 * `meanDeltaOff/On` are the end-to-end (re-matched, Jaccard-aligned) deltas —
 * the absolute movement the smoke alarm bounds. `reduction` is the realized
 * no-information variance reduction `1 − Var(reportedOn−50)/Var(reportedOff−50)`
 * over injected members (the durable contract's stabilization measure);
 * `fixedDeltaOff/On` retain the clean-reference magnitudes for context.
 */
interface M11SweepRateResult {
  rate: number;
  meanDeltaOff: number;
  meanDeltaOn: number;
  endToEndReduction: number | null;
  fixedDeltaOff: number;
  fixedDeltaOn: number;
  /** Population-prior stabilization |reported−TRUE| reduction over injected members. */
  reduction: number | null;
  pools: M11PoolResult[];
}

export type {
  M11PoolResult,
  M11SweepRateResult,
};

export {
  alignGroups,
  groupTraitMeans,
  injectedPerturbation,
  injectedNeutralValues,
  variance,
  compositionDelta,
};
