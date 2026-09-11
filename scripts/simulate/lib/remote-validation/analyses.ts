/**
 * Remote-validation harness — the four pre-launch analyses.
 *
 *   1. Convergent validity   — ACOEXP vs IPIP Big Five, target r > 0.6 (LOCKED)
 *   2. Test-retest stability — 4-week re-administration (threshold proposed)
 *   3. Vibe-simulation       — trait-composition → 同频 regression (proposed)
 *   4. Narrative accuracy A/B— answer-citing vs generic (proposed)
 *
 * Only threshold #1 is locked by `docs/strategy/scientific-foundation.md`. The
 * rest are explicitly marked `locked: false` and require plan-owner
 * ratification before they may block a rollout.
 */

import type {
  AcoexpTrait,
  AnalysisResult,
  BigFiveDomain,
  IpIpKeying,
  PanelDataset,
  PanelRespondent,
  VibeSession,
} from './types';
import { ACOEXP_TRAITS } from './types';
import { CONVERGENT_MAPPING, DIVERGENT_TRAITS, GATED_TRAITS } from './mapping';
import { scoreIpip } from './ipip';
import {
  mean,
  ols,
  pearson,
  pearsonCI,
  round,
  sd,
  studentTPValue,
  zscore,
} from './stats';

export const VALIDATION_THRESHOLDS = {
  convergent: { rMin: 0.6, locked: true, source: 'scientific-foundation.md §Pre-launch validation program 1' },
  retest: { meanRMin: 0.7, locked: false, source: 'proposed — 4-week Big Five domain stability bar' },
  vibe: { minR2: 0.05, alpha: 0.05, locked: false, source: 'proposed — composition predicts 同频' },
  narrative: { alpha: 0.05, locked: false, source: 'proposed — hypothesized arm scores higher' },
} as const;

/**
 * Convergent gate decision rule (P1). Two candidate criteria over the five
 * gated traits:
 *   'all'        — every trait r ≥ 0.6 (strict conjunction; faithful to a
 *                  per-factor reading of the protocol).
 *   'mean-floor' — mean r ≥ 0.6 AND every trait r ≥ 0.5 (protects the average
 *                  claim while tolerating one mildly-attenuated factor).
 * Which one is the study's decision rule is settled by the power analysis
 * (`run-remote-validation-power.ts`) and recorded in the harness doc.
 */
export type ConvergentGateMode = 'all' | 'mean-floor';

export const CONVERGENT_GATE: Record<ConvergentGateMode, { meanMin: number; floorMin: number }> = {
  all: { meanMin: 0.6, floorMin: 0.6 },
  'mean-floor': { meanMin: 0.6, floorMin: 0.5 },
};

export const DEFAULT_CONVERGENT_GATE_MODE: ConvergentGateMode = 'mean-floor';

export function evaluateConvergentGate(
  traitRs: number[],
  mode: ConvergentGateMode,
): { pass: boolean; minR: number; meanR: number } {
  const minR = traitRs.length ? Math.min(...traitRs) : 0;
  const meanR = traitRs.length ? mean(traitRs) : 0;
  const cfg = CONVERGENT_GATE[mode];
  return { pass: meanR >= cfg.meanMin && minR >= cfg.floorMin, minR, meanR };
}

export const MIN_CONVERGENT_N = 30;
export const MIN_RETEST_N = 20;
export const MIN_VIBE_SESSIONS = 30;
export const MIN_AB_PER_ARM = 20;

const VIBE_PREDICTORS = ['meanA', 'meanC', 'minE', 'spark', 'xVariance'] as const;
type VibePredictor = (typeof VIBE_PREDICTORS)[number];

// ── 1. Convergent validity ───────────────────────────────────────────

export function analyzeConvergent(
  panel: PanelDataset,
  keying: IpIpKeying,
  options?: { gateMode?: ConvergentGateMode },
): AnalysisResult {
  const withIpip = panel.respondents.filter((r) => r.ipip);
  const perTrait: Array<{
    trait: AcoexpTrait;
    bigFive: BigFiveDomain;
    sign: number;
    r: number;
    ci: [number, number];
    n: number;
    gated: boolean;
  }> = [];

  for (const trait of ACOEXP_TRAITS) {
    const mapping = CONVERGENT_MAPPING.find((m) => m.acoexp === trait);
    const xs: number[] = [];
    const ys: number[] = [];
    for (const r of withIpip) {
      const v4 = r.v4.traitScores[trait];
      const scored = r.ipip ? scoreIpip(r.ipip.responses, keying) : null;
      if (v4 === undefined || !scored) continue;
      const bigFiveTrait = mapping ? mapping.bigFive : 'extraversion';
      const domainVal = scored.domains[bigFiveTrait];
      if (Number.isNaN(domainVal)) continue;
      xs.push(v4);
      ys.push((mapping?.sign ?? 1) * domainVal);
    }
    const r = pearson(xs, ys);
    perTrait.push({
      trait,
      bigFive: mapping?.bigFive ?? 'extraversion',
      sign: mapping?.sign ?? 1,
      r: round(r),
      ci: [round(pearsonCI(r, xs.length)[0]), round(pearsonCI(r, xs.length)[1])],
      n: xs.length,
      gated: GATED_TRAITS.includes(trait),
    });
  }

  const gated = perTrait.filter((t) => t.gated);
  const mode = options?.gateMode ?? DEFAULT_CONVERGENT_GATE_MODE;
  const { pass: gatePass, minR, meanR } = evaluateConvergentGate(
    gated.map((t) => t.r),
    mode,
  );
  const sufficient = gated.every((t) => t.n >= MIN_CONVERGENT_N);
  const pass = sufficient && gatePass;
  const cfg = CONVERGENT_GATE[mode];

  return {
    id: 'convergent',
    label: `Convergent validity — ${mode} gate (mean r ≥ ${cfg.meanMin}, min r ≥ ${cfg.floorMin})`,
    status: !sufficient ? 'INSUFFICIENT' : pass ? 'PASS' : 'FAIL',
    measured: `mean r ${meanR.toFixed(3)}, min r ${minR.toFixed(3)} (n=${Math.min(...gated.map((t) => t.n))})`,
    threshold: `mean r ≥ ${cfg.meanMin} and min r ≥ ${cfg.floorMin}, n ≥ ${MIN_CONVERGENT_N}`,
    detail: {
      gateMode: mode,
      meanR: round(meanR),
      minR: round(minR),
      perTrait,
      divergent: DIVERGENT_TRAITS.map((d) => ({
        trait: d.acoexp,
        note: d.note,
        r: perTrait.find((t) => t.trait === d.acoexp)?.r ?? null,
      })),
    },
  };
}

// ── 2. Test-retest stability ─────────────────────────────────────────

export function analyzeRetest(panel: PanelDataset): AnalysisResult {
  const withRetest = panel.respondents.filter((r) => r.retest);
  const perTrait = ACOEXP_TRAITS.map((trait) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const r of withRetest) {
      const a = r.v4.traitScores[trait];
      const b = r.retest?.traitScores[trait];
      if (a === undefined || b === undefined) continue;
      xs.push(a);
      ys.push(b);
    }
    const r = pearson(xs, ys);
    return { trait, r: round(r), ci: [round(pearsonCI(r, xs.length)[0]), round(pearsonCI(r, xs.length)[1])], n: xs.length };
  });

  const meanR = mean(perTrait.map((t) => t.r));
  const sufficient = withRetest.length >= MIN_RETEST_N;
  const pass = sufficient && meanR >= VALIDATION_THRESHOLDS.retest.meanRMin;

  return {
    id: 'retest',
    label: `Test-retest stability — mean trait r ≥ ${VALIDATION_THRESHOLDS.retest.meanRMin}`,
    status: !sufficient ? 'INSUFFICIENT' : pass ? 'PASS' : 'FAIL',
    measured: `mean r ${meanR.toFixed(3)} (n=${withRetest.length})`,
    threshold: `mean r ≥ ${VALIDATION_THRESHOLDS.retest.meanRMin}, n ≥ ${MIN_RETEST_N}`,
    detail: { perTrait, meanR: round(meanR) },
  };
}

// ── 3. Vibe-simulation composition regression ────────────────────────

function buildVibePredictors(session: VibeSession, byId: Map<string, PanelRespondent>) {
  const members = session.memberIds.map((id) => byId.get(id)).filter(Boolean) as PanelRespondent[];
  if (members.length < 2) return null;
  const A = members.map((m) => m.v4.traitScores.A);
  const C = members.map((m) => m.v4.traitScores.C);
  const E = members.map((m) => m.v4.traitScores.E);
  const X = members.map((m) => m.v4.traitScores.X);
  const P = members.map((m) => m.v4.traitScores.P);
  const spark = Math.max(...members.map((m) => Math.max(m.v4.traitScores.X, m.v4.traitScores.P)));
  return {
    meanA: mean(A),
    meanC: mean(C),
    minE: Math.min(...E),
    spark,
    xVariance: sd(X) ** 2,
  } as Record<VibePredictor, number>;
}

export function analyzeVibe(panel: PanelDataset): AnalysisResult {
  const sessions = panel.vibeSessions ?? [];
  const byId = new Map(panel.respondents.map((r) => [r.participantId, r]));

  const rows: Array<{ predictors: Record<VibePredictor, number>; outcome: number }> = [];
  let skipped = 0;
  for (const s of sessions) {
    const predictors = buildVibePredictors(s, byId);
    if (!predictors) {
      skipped++;
      continue;
    }
    const outcome = typeof s.sameFrequency === 'number' ? s.sameFrequency : s.wouldMeetAgain;
    if (typeof outcome !== 'number') {
      skipped++;
      continue;
    }
    rows.push({ predictors, outcome });
  }

  if (rows.length < MIN_VIBE_SESSIONS) {
    return {
      id: 'vibe',
      label: 'Vibe-simulation — trait composition predicts 同频',
      status: 'INSUFFICIENT',
      measured: `${rows.length} usable sessions (skipped ${skipped})`,
      threshold: `≥ ${MIN_VIBE_SESSIONS} usable sessions`,
      detail: { sessions: rows.length, skipped },
    };
  }

  const y = zscore(rows.map((r) => r.outcome));
  const predictors = VIBE_PREDICTORS.map((p) => zscore(rows.map((r) => r.predictors[p])));
  const reg = ols(y, predictors);
  const named = reg.terms.map((t, i) => ({ ...t, name: VIBE_PREDICTORS[i] }));
  const floorTerm = named.find((t) => t.name === 'minE');
  const corePositive =
    named.some((t) => ['meanA', 'minE', 'spark'].includes(t.name) && t.beta > 0 && t.p < VALIDATION_THRESHOLDS.vibe.alpha);
  const pass =
    reg.r2 >= VALIDATION_THRESHOLDS.vibe.minR2 &&
    corePositive &&
    (floorTerm?.beta ?? 0) >= 0;

  return {
    id: 'vibe',
    label: 'Vibe-simulation — trait composition predicts 同频',
    status: pass ? 'PASS' : 'FAIL',
    measured: `R² ${reg.r2.toFixed(3)}, minE β ${floorTerm?.beta.toFixed(3) ?? 'n/a'}`,
    threshold: `R² ≥ ${VALIDATION_THRESHOLDS.vibe.minR2} and ≥1 core composition predictor positive at α=${VALIDATION_THRESHOLDS.vibe.alpha}`,
    detail: {
      sessions: rows.length,
      skipped,
      r2: round(reg.r2),
      adjR2: round(reg.adjR2),
      coefs: named.map((t) => ({ name: t.name, beta: round(t.beta), se: round(t.se), t: round(t.t, 2), p: round(t.p, 4) })),
    },
  };
}

// ── 4. Narrative accuracy A/B ────────────────────────────────────────

/** Welch's unequal-variance t-test. */
export function welchT(a: number[], b: number[]): { t: number; df: number; p: number; meanA: number; meanB: number } {
  const nA = a.length;
  const nB = b.length;
  const varA = sd(a) ** 2;
  const varB = sd(b) ** 2;
  const seA = varA / nA;
  const seB = varB / nB;
  const se = Math.sqrt(seA + seB);
  const t = se === 0 ? 0 : (mean(a) - mean(b)) / se;
  const df = se === 0 ? 0 : (seA + seB) ** 2 / ((seA ** 2) / Math.max(1, nA - 1) + (seB ** 2) / Math.max(1, nB - 1));
  return { t, df, p: studentTPValue(t, df), meanA: mean(a), meanB: mean(b) };
}

export function analyzeNarrative(panel: PanelDataset): AnalysisResult {
  const rated = panel.respondents.filter(
    (r) => r.narrativeArm !== undefined && typeof r.narrativeRating === 'number',
  );
  const arms = panel.narrative?.arms ?? Array.from(new Set(rated.map((r) => r.narrativeArm as string)));
  const perArm = arms.map((arm) => {
    const vals = rated.filter((r) => r.narrativeArm === arm).map((r) => r.narrativeRating as number);
    return { arm, n: vals.length, mean: round(mean(vals)), values: vals };
  });

  const best = panel.narrative?.hypothesizedBetterArm ?? arms[0];
  const bestArm = perArm.find((a) => a.arm === best);
  const others = perArm.filter((a) => a.arm !== best);
  const otherValues = others.flatMap((a) => a.values);

  const insufficient =
    !bestArm ||
    bestArm.n < MIN_AB_PER_ARM ||
    others.some((a) => a.n < MIN_AB_PER_ARM);

  if (insufficient) {
    return {
      id: 'narrative',
      label: `Narrative A/B — ${best} scores higher`,
      status: 'INSUFFICIENT',
      measured: perArm.map((a) => `${a.arm}=${a.mean}(n=${a.n})`).join(', '),
      threshold: `≥ ${MIN_AB_PER_ARM} respondents per arm`,
      detail: { perArm: perArm.map(({ values, ...rest }) => rest) },
    };
  }

  const test = welchT(bestArm!.values, otherValues);
  const directionOk = test.meanA > test.meanB;
  const pass = directionOk && test.p < VALIDATION_THRESHOLDS.narrative.alpha;

  return {
    id: 'narrative',
    label: `Narrative A/B — ${best} scores higher`,
    status: pass ? 'PASS' : 'FAIL',
    measured: `${best} ${test.meanA.toFixed(2)} vs rest ${test.meanB.toFixed(2)} (Δ=${(test.meanA - test.meanB).toFixed(2)}, p=${test.p.toFixed(4)})`,
    threshold: `positive Δ and p < ${VALIDATION_THRESHOLDS.narrative.alpha}`,
    detail: {
      perArm: perArm.map(({ values, ...rest }) => rest),
      welch: { t: round(test.t, 3), df: round(test.df, 1), p: round(test.p, 4) },
    },
  };
}

export function analyzeAll(
  panel: PanelDataset,
  keying: IpIpKeying,
  options?: { gateMode?: ConvergentGateMode },
): AnalysisResult[] {
  return [
    analyzeConvergent(panel, keying, options),
    analyzeRetest(panel),
    analyzeVibe(panel),
    analyzeNarrative(panel),
  ];
}
