/**
 * Shared utilities for personality test simulation
 * Reusable across all simulation runners
 */

import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  shouldTerminate,
  getFinalResult,
  EngineState,
} from '../../../packages/shared/src/personality/adaptiveEngine';
import { questionsV4 } from '../../../packages/shared/src/personality/questionsV4';
import { findBestMatchingArchetypesV2 } from '../../../packages/shared/src/personality/matcherV2';
import { archetypeRegistry } from '../../../packages/shared/src/personality/archetypeRegistry';
import { TraitKey, DEFAULT_ASSESSMENT_CONFIG, AssessmentConfig } from '../../../packages/shared/src/personality/types';
import { shrinkTraitsTowardNeutral } from '../../../packages/shared/src/personality/traitShrinkage';
import {
  META_CONSISTENCY_TARGET_TRAIT,
  META_SELF_REPORT_BY_OPTION,
  isMetaConsistencyQuestionId,
} from '../../../packages/shared/src/personality/metaConsistency';

// ── Seeded RNG primitives (shared by simulation runners) ─────────────
//
// These mirror the local copies inside run-recovery-harness.ts exactly
// (mulberry32 + stream-tag hashing). They live here so new runners (e.g.
// run-adversarial-suite.ts) can derive independent deterministic streams
// per (respondent, arm) without forking the pattern. The recovery harness
// keeps its own local copies — its byte-identical output contract is
// unaffected by this additive export.

/** mulberry32 — small, fast, deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive an independent stream seed for a (respondent, stream) pair. */
export function streamSeed(baseSeed: number, respondentIndex: number, streamTag: string): number {
  let h = baseSeed >>> 0;
  h = Math.imul(h ^ (respondentIndex + 1), 0x9e3779b1) >>> 0;
  for (const ch of streamTag) {
    h = Math.imul(h ^ ch.charCodeAt(0), 0x85ebca6b) >>> 0;
  }
  return h >>> 0;
}

export type NoiseMode = 'clean' | 'moderate' | 'high' | 'desirability';

// ── Item 6 synthetic-population contract (shared by all simulate runners) ──
//
// Promoted from `run-recovery-harness.ts` (Item 6) so the boundary sweep's
// secondary Normal(c, σ) arm (Item 8 verifier amendment A1) reuses the exact
// same per-trait σ as the recovery/group population generators. The recovery
// harness keeps its own local copies (byte-identical output contract); these
// are the canonical values for NEW instruments.
export const CENTROID_MIXTURE_WEIGHT = 0.6;
/** Per-trait SD for centroid-mixture respondents (Item 6). */
export const CENTROID_TRAIT_SD = 10;
/** Per-trait mean/SD for general-population respondents (Item 6). */
export const GENERAL_TRAIT_MEAN = 50;
export const GENERAL_TRAIT_SD = 15;
/** Truncation bounds for sampled traits (Item 6). */
export const TRAIT_MIN = 5;
export const TRAIT_MAX = 95;

export interface Persona {
  id: string;
  label: string;
  traitProfile: Record<TraitKey, number>;
  expectedArchetype: string;
  category: 'centroid' | 'boundary';
  metadata?: Record<string, unknown>;
}

export interface SimulationRunResult {
  personaId: string;
  personaLabel: string;
  expectedArchetype: string;
  assignedArchetype: string | null;
  secondaryArchetype: string | null;
  confidence: number;
  confidenceGap: number;
  isExactMatch: boolean;
  isSimilarMatch: boolean;
  questionsAsked: number;
  l3DisambiguationTriggered: boolean;
  closingQuestionsAsked: number;
  traitScores: Record<TraitKey, number>;
  /**
   * Plan Item 3 (AC-3.3 evidence): present ONLY when the run's config override
   * enables `enableTraitShrinkage` — the reported (shrunken) trait vector and
   * the max |reported − raw| delta across traits. Absent flag-off so existing
   * artifacts stay byte-identical.
   */
  reportedTraitScores?: Record<TraitKey, number>;
  maxShrinkageDelta?: number;
  questionSequence: string[];
  top3Matches: Array<{ archetype: string; score: number }>;
}

export interface MatcherIsolationResult {
  personaId: string;
  personaLabel: string;
  expectedArchetype: string;
  assignedArchetype: string;
  confidence: number;
  confidenceGap: number;
  isExactMatch: boolean;
  top3Matches: Array<{ archetype: string; score: number }>;
}

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

// ── Noise configuration ──────────────────────────────────────────────

const NOISE_CONFIG: Record<NoiseMode, { suboptimalRate: number; contrarianRate: number; jitterScale: number }> = {
  clean: { suboptimalRate: 0, contrarianRate: 0, jitterScale: 0 },
  moderate: { suboptimalRate: 0.15, contrarianRate: 0, jitterScale: 1 },
  high: { suboptimalRate: 0.25, contrarianRate: 0.05, jitterScale: 2 },
  // Deterministic argmax like `clean`, but with the desirability bias term
  // below mixed into the option score. No random jitter: the distortion is
  // systematic (self-presentation), not random.
  desirability: { suboptimalRate: 0, contrarianRate: 0, jitterScale: 0 },
};

// ── Desirability bias model (sprint: m4-desirability-bias-arm) ───────
//
// The clean/moderate/high arms contain zero self-presentation bias — every
// answer is a (possibly noisy) argmax over TRUE-trait alignment. That makes
// the M4 ipsative uplift unmeasurable: equal-SDI forced-choice pairing
// exists to remove exactly this bias. The `desirability` arm models it:
//
//   score(option) = trueTraitAlignment(option) + BETA * desirabilityProxy(option)
//
// desirabilityProxy(option):
//   - Ipsative options (declared socialDesirabilityIndex): (SDI − 72) / 10.
//     The authored SDI is the best available desirability estimate; because
//     within-pair |ΔSDI| ≤ 4 (audit-enforced), the within-pair tilt stays
//     ≤ 0.4 — the equal-SDI pairing really is near-bias-free in this model,
//     which is precisely the mechanic M4 is supposed to measure.
//   - All other bank options: Σ_t max(0, traitScores[t]) / 4. Classic
//     Edwards-style social-desirability factor: every ACOEXP positive pole
//     reads as a desirable self-description to a peer audience, so an
//     option's desirability grows with the strength of its positive-pole
//     endorsements. The /4 scale normalizes by the bank-wide median
//     positive-loading sum (measured 2026-09-09: p50 = 4 across 488
//     options). Negative loadings contribute 0: reverse-scored statements
//     ("I avoid…", "I keep things vague…") read as undesirable.
//
// Only WITHIN-QUESTION proxy differences affect the argmax (absolute level
// is choice-invariant), so centering constants are interpretability aids.
//
// β is a named constant, tuned 2026-09-09 against the AC-B2 sanity property
// (flag-off recovery under this arm must be measurably worse than `clean`);
// see docs/reports/2026-09-09-m4-desirability-bias-arm.md.

/** β — weight of the desirability term relative to true-trait alignment. */
export const DESIRABILITY_BIAS_BETA = 2;

/**
 * Active β for the desirability arm. Default is the locked named constant
 * above; `SIM_DESIRABILITY_BETA=<n>` overrides it for documented tuning
 * sweeps only (simulation scripts never read ambient env otherwise).
 */
export function getDesirabilityBiasBeta(): number {
  const raw = typeof process !== 'undefined' ? process.env.SIM_DESIRABILITY_BETA : undefined;
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DESIRABILITY_BIAS_BETA;
}

/** SDI band midpoint of the authored ipsative items (66–78 band). */
const IPSATIVE_SDI_CENTER = 72;
/** Bank-wide median positive-loading sum across all bank options. */
const POSITIVE_LOADING_SCALE = 4;

export function desirabilityProxy(option: {
  traitScores: Partial<Record<TraitKey, number>>;
  socialDesirabilityIndex?: number;
}): number {
  if (typeof option.socialDesirabilityIndex === 'number') {
    return (option.socialDesirabilityIndex - IPSATIVE_SDI_CENTER) / 10;
  }
  let positiveSum = 0;
  for (const trait of ALL_TRAITS) {
    const v = option.traitScores[trait] || 0;
    if (v > 0) positiveSum += v;
  }
  return positiveSum / POSITIVE_LOADING_SCALE;
}

// ── Answer Deriver ───────────────────────────────────────────────────

function scoreOptionForTraits(
  option: { value: string; traitScores: Partial<Record<TraitKey, number>> },
  targetTraits: Record<TraitKey, number>
): number {
  let score = 0;
  for (const trait of ALL_TRAITS) {
    const optionValue = option.traitScores[trait] || 0;
    const targetValue = targetTraits[trait];
    const traitAlignment = (targetValue - 50) / 50;
    score += optionValue * traitAlignment;
  }
  return score;
}

export function selectAnswerByTraits(
  question: typeof questionsV4[0],
  targetTraits: Record<TraitKey, number>,
  noiseMode: NoiseMode = 'clean',
  seedRandom: () => number = Math.random
): string {
  // Plan Item 4: the meta-consistency item (Q168) carries zero trait
  // loadings, so trait-alignment argmax cannot answer it — all options score
  // identically. An honest respondent answers a direct self-view question by
  // self-reporting their (perceived) standing on the target trait: nearest
  // bucket to the profile value. Flag-off this branch is unreachable (the
  // item is never served), preserving byte-identity.
  if (isMetaConsistencyQuestionId(question.id)) {
    return selectMetaConsistencyAnswer(question, targetTraits);
  }
  const config = NOISE_CONFIG[noiseMode];
  const biasBeta = noiseMode === 'desirability' ? getDesirabilityBiasBeta() : 0;

  // Score all options (desirability arm adds the self-presentation bias term)
  const scored = question.options.map((opt) => ({
    value: opt.value,
    score: scoreOptionForTraits(opt, targetTraits) + biasBeta * desirabilityProxy(opt),
  }));

  // Add jitter based on noise mode
  if (config.jitterScale > 0) {
    for (const s of scored) {
      s.score += (seedRandom() - 0.5) * 3 * config.jitterScale;
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const roll = seedRandom();

  // Contrarian: pick from the bottom
  if (config.contrarianRate > 0 && roll < config.contrarianRate) {
    const bottomIndex = Math.floor(seedRandom() * Math.min(2, scored.length - 1)) + scored.length - 2;
    return scored[Math.max(0, bottomIndex)].value;
  }

  // Suboptimal: pick 2nd or 3rd best
  if (config.suboptimalRate > 0 && roll < config.contrarianRate + config.suboptimalRate) {
    const suboptimalIndex = Math.floor(seedRandom() * Math.min(2, scored.length - 1)) + 1;
    return scored[Math.min(suboptimalIndex, scored.length - 1)].value;
  }

  // Optimal: pick best
  return scored[0].value;
}

// ── Adversarial answer models (sprint: item7-adversarial-personas) ───
//
// Pathological response-set generators for the Item 7 adversarial suite.
// These are NOT noise modes: a noise mode perturbs an otherwise
// trait-faithful argmax, whereas an adversarial type replaces the answer
// policy entirely (the trait profile is ignored or systematically
// distorted). All strategies operate on the question's uniform options[]
// surface, which collapses the per-question-type handling:
//   - choice / emoji_tap / ipsative → ordinal or content-based option pick
//   - slider → its 5 discrete buckets (slider_0 … slider_100) are options,
//     so "slider min" = options[0] and "slider 50" = the zero-loading bucket
//
// Strategy definitions (contract AC-7.1):
//   straight-liner      — always the FIRST ordinal option, regardless of
//                         content (option A / slider_0 / first emoji).
//   acquiescence-biased — always the most positive/agree-framed option:
//                         argmax desirabilityProxy (positive-pole loading
//                         sum; declared SDI for ipsative). Pure yea-saying:
//                         no true-trait term at all.
//   midpoint-hugger     — always the most neutral option: argmin Σ|loading|.
//                         On the slider this lands exactly on slider_50
//                         (the zero-loading bucket); on 2-option items the
//                         lesser-loading pole wins (tie → lower index).
//   self-image-inflated — answers through a systematically inflated trait
//                         profile (true + INFLATION_MAGNITUDE on A/P/C/E,
//                         clamped to 95; O/X untouched) via the standard
//                         clean argmax. Models social-desirability
//                         SELF-INFLATION of the latent self-image — distinct
//                         from the `desirability` noise arm, which tilts the
//                         per-question OPTION CHOICE instead. UNIFORM
//                         variant: the meta item (direct self-view) is
//                         answered through the SAME +15 inflated profile —
//                         the consistent-liar model.
//   self-image-inflated-differential — Plan Item 4 cycle 2 (verifier
//                         amendment 1): scenario/adaptive answers inflated
//                         +15 on A/P/C/E exactly as the uniform arm, but
//                         the META item is answered from a MORE inflated
//                         direct self-view (+SELF_INFLATION_META_VIEW_MAGNITUDE
//                         on the meta target trait, clamped 95). See the
//                         psychometric rationale on the constant below.
//                         Flag-off this arm is answer-identical to
//                         `self-image-inflated` (the meta item is never
//                         served), so default-run numbers match the uniform
//                         arm exactly.
//   random-clicker      — uniform random option index every question.

export type AdversarialType =
  | 'straight-liner'
  | 'acquiescence-biased'
  | 'midpoint-hugger'
  | 'self-image-inflated'
  | 'self-image-inflated-differential'
  | 'random-clicker';

export const ADVERSARIAL_TYPES: AdversarialType[] = [
  'straight-liner',
  'acquiescence-biased',
  'midpoint-hugger',
  'self-image-inflated',
  'self-image-inflated-differential',
  'random-clicker',
];

/** Self-inflation magnitude applied to A/P/C/E for the self-image-inflated persona. */
export const SELF_INFLATION_MAGNITUDE = 15;

/**
 * Differential self-view inflation for the meta item (Plan Item 4 cycle 2,
 * verifier amendment 1). Psychometric rationale: real-world self-image
 * inflation is DIFFERENTIAL, not uniform. Behaviorally anchored responses
 * (scenario/forced-choice items — concrete, less attributable) stay close
 * to truth under mild self-presentation pressure, while self-enhancement
 * concentrates in DIRECT global self-ratings ("how warm/agreeable are
 * you?"): the classic self-enhancement / better-than-average finding is
 * that explicit self-views inflate MORE than indirect or behavioral
 * estimates of the same trait. Modeling the meta answer at +30 on the
 * target trait (2× the scenario-level inflation, clamped to the trait
 * ceiling 95) is the realistic version of the Item 7 persona: the person
 * behaves/answers scenarios near their (+15) presented self, but describes
 * themselves rosier still. The uniform arm remains in the suite as the
 * consistent-liar reference; both are informative.
 */
export const SELF_INFLATION_META_VIEW_MAGNITUDE = 30;

/**
 * Plan Item 4: answer the meta-consistency item (Q168) as an honest
 * self-report of the given (perceived) profile — the option whose declared
 * self-report level (META_SELF_REPORT_BY_OPTION) is nearest to the
 * profile's target-trait value. For the clean arm the profile is the TRUE
 * one; for self-image-inflated it is the UNIFORM +15 inflated one; for
 * self-image-inflated-differential it is the MORE inflated direct self-view
 * (inflateMetaSelfView, +30 on the target trait) — the behavior under test.
 */
export function selectMetaConsistencyAnswer(
  question: typeof questionsV4[0],
  profile: Record<TraitKey, number>
): string {
  const perceived = profile[META_CONSISTENCY_TARGET_TRAIT];
  let bestValue = question.options[0].value;
  let bestGap = Infinity;
  for (const option of question.options) {
    const selfReport = META_SELF_REPORT_BY_OPTION[option.value];
    if (selfReport === undefined) continue;
    const gap = Math.abs(selfReport - perceived);
    if (gap < bestGap) {
      bestGap = gap;
      bestValue = option.value;
    }
  }
  return bestValue;
}

/** Traits the self-image-inflated persona inflates (agentic + communal positive poles). */
const INFLATED_TRAITS: TraitKey[] = ['A', 'P', 'C', 'E'];

/**
 * Systematically inflated copy of a true trait profile: +15 on A/P/C/E
 * clamped to [15, 95] (same bounds as addTraitNoise); O/X pass through.
 */
export function inflateTraitProfile(
  trueTraits: Record<TraitKey, number>,
  magnitude: number = SELF_INFLATION_MAGNITUDE
): Record<TraitKey, number> {
  const result = { ...trueTraits } as Record<TraitKey, number>;
  for (const trait of INFLATED_TRAITS) {
    result[trait] = Math.max(15, Math.min(95, trueTraits[trait] + magnitude));
  }
  return result;
}

/**
 * Differential-inflation self-view for the META item (Plan Item 4 cycle 2):
 * the direct self-view on the meta target trait is inflated by
 * SELF_INFLATION_META_VIEW_MAGNITUDE relative to the TRUE trait (clamped
 * [15, 95]); every other trait passes through. This is deliberately MORE
 * inflated than the scenario-level profile the arm answers with (+15) —
 * see the rationale on SELF_INFLATION_META_VIEW_MAGNITUDE.
 */
export function inflateMetaSelfView(
  trueTraits: Record<TraitKey, number>,
  magnitude: number = SELF_INFLATION_META_VIEW_MAGNITUDE
): Record<TraitKey, number> {
  const result = { ...trueTraits } as Record<TraitKey, number>;
  const target = META_CONSISTENCY_TARGET_TRAIT;
  result[target] = Math.max(15, Math.min(95, trueTraits[target] + magnitude));
  return result;
}

/** Total absolute loading of an option — the neutrality metric for midpoint-hugger. */
function absoluteLoadingSum(option: { traitScores: Partial<Record<TraitKey, number>> }): number {
  let sum = 0;
  for (const trait of ALL_TRAITS) {
    sum += Math.abs(option.traitScores[trait] || 0);
  }
  return sum;
}

/**
 * Pick an answer for one question under an adversarial response set.
 * Deterministic given (question, type, trueTraits, rng); only
 * `random-clicker` consumes the rng.
 */
export function selectAnswerAdversarial(
  question: typeof questionsV4[0],
  type: AdversarialType,
  trueTraits: Record<TraitKey, number>,
  seedRandom: () => number
): string {
  const options = question.options;

  // Plan Item 4: the meta-consistency item (Q168) has zero trait loadings, so
  // the loading/desirability-based policies below are degenerate on it (all
  // options tie). Each arm gets its semantically faithful self-view policy:
  //   straight-liner      — options[0] (its universal policy; no special case
  //                         needed, but listed for completeness of the matrix)
  //   acquiescence-biased — the MOST DESIRABLE self-view (last option): a
  //                         pure yea-sayer claims the agreeable extreme on a
  //                         direct self-view question.
  //   midpoint-hugger     — the exact middle bucket (slider_50): neutrality
  //                         is defined by self-report position here, not by
  //                         loading sum (which is 0 for every option).
  //   self-image-inflated — nearest bucket to the INFLATED profile (their
  //                         self-view is the inflated self-image — the
  //                         consistent-liar model: self-view inflated by
  //                         the SAME +15 as scenario answers).
  //   self-image-inflated-differential — nearest bucket to the DIFFERENTIAL
  //                         self-view (inflateMetaSelfView: +30 on the meta
  //                         target trait vs true) — self-enhancement
  //                         concentrated in the direct self-rating while
  //                         scenario answers stay at +15 (amendment 1).
  //   random-clicker      — uniform random option (its universal policy).
  // Flag-off this branch is unreachable (Q168 is never served).
  if (isMetaConsistencyQuestionId(question.id)) {
    switch (type) {
      case 'acquiescence-biased':
        return options[options.length - 1].value;
      case 'midpoint-hugger':
        return options[Math.floor(options.length / 2)].value;
      case 'self-image-inflated':
        return selectMetaConsistencyAnswer(question, inflateTraitProfile(trueTraits));
      case 'self-image-inflated-differential':
        return selectMetaConsistencyAnswer(question, inflateMetaSelfView(trueTraits));
      case 'random-clicker':
        return options[Math.floor(seedRandom() * options.length)].value;
      case 'straight-liner':
      default:
        return options[0].value;
    }
  }

  switch (type) {
    case 'straight-liner':
      return options[0].value;

    case 'acquiescence-biased': {
      let best = options[0];
      let bestScore = desirabilityProxy(options[0]);
      for (let i = 1; i < options.length; i++) {
        const s = desirabilityProxy(options[i]);
        if (s > bestScore) {
          best = options[i];
          bestScore = s;
        }
      }
      return best.value;
    }

    case 'midpoint-hugger': {
      let best = options[0];
      let bestNeutrality = absoluteLoadingSum(options[0]);
      for (let i = 1; i < options.length; i++) {
        const n = absoluteLoadingSum(options[i]);
        if (n < bestNeutrality) {
          best = options[i];
          bestNeutrality = n;
        }
      }
      return best.value;
    }

    case 'self-image-inflated':
    case 'self-image-inflated-differential':
      // Scenario/adaptive answers are IDENTICAL across the two inflation
      // arms (+15 on A/P/C/E) — only the meta-item self-view differs.
      return selectAnswerByTraits(question, inflateTraitProfile(trueTraits), 'clean', seedRandom);

    case 'random-clicker':
      return options[Math.floor(seedRandom() * options.length)].value;
  }
}

// ── Trait Noise Generator ────────────────────────────────────────────

export function addTraitNoise(
  baseTraits: Record<TraitKey, number>,
  magnitude: number = 10,
  seedRandom: () => number = Math.random
): Record<TraitKey, number> {
  const result = { ...baseTraits } as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    const noise = (seedRandom() - 0.5) * magnitude * 2;
    result[trait] = Math.max(15, Math.min(95, result[trait] + noise));
  }
  return result;
}

// ── End-to-End Simulation ────────────────────────────────────────────

export function runAssessmentSimulation(
  persona: Persona,
  noiseMode: NoiseMode = 'clean',
  retestSeed?: number,
  configOverride?: Partial<AssessmentConfig>
): SimulationRunResult {
  const config = { ...DEFAULT_ASSESSMENT_CONFIG, useV2Matcher: true, ...configOverride };
  let state = initializeEngineState(config);
  const questionSequence: string[] = [];
  let l3DisambiguationTriggered = false;

  // Deterministic random for retest consistency
  let seed = retestSeed ?? 0;
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  while (true) {
    const question = selectNextQuestion(state);
    if (!question) break;

    questionSequence.push(question.id);
    if (question.level === 3) l3DisambiguationTriggered = true;

    const answer = selectAnswerByTraits(question, persona.traitProfile, noiseMode, seededRandom);
    state = processAnswer(state, question, answer);

    if (questionSequence.length >= 25) break; // Safety limit
  }

  const topMatch = state.currentMatches[0];
  const secondMatch = state.currentMatches[1];

  const normalizedTraits: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    normalizedTraits[trait] = state.traitConfidences[trait]?.score ?? 50;
  }

  const expectedProto = archetypeRegistry[persona.expectedArchetype as keyof typeof archetypeRegistry];
  const isSimilar = expectedProto?.profile.confusableWith?.includes(topMatch?.archetype ?? '') ?? false;

  // Plan Item 3: with shrinkage on, currentMatches already derive from the
  // shrunken vector (processAnswer match boundary); recompute the reported
  // traits from the raw state for the AC-3.3 delta evidence. Flag-off these
  // fields stay absent (byte-identical artifacts).
  const shrinkOn = config.enableTraitShrinkage === true;
  const reportedTraitScores = shrinkOn
    ? shrinkTraitsTowardNeutral(
        normalizedTraits,
        Object.fromEntries(ALL_TRAITS.map((t) => [t, state.traitConfidences[t]?.confidence ?? 0])) as Record<TraitKey, number>
      )
    : undefined;
  const maxShrinkageDelta = reportedTraitScores
    ? Math.max(...ALL_TRAITS.map((t) => Math.abs(reportedTraitScores[t] - normalizedTraits[t])))
    : undefined;

  return {
    personaId: persona.id,
    personaLabel: persona.label,
    expectedArchetype: persona.expectedArchetype,
    assignedArchetype: topMatch?.archetype ?? null,
    secondaryArchetype: secondMatch?.archetype ?? null,
    confidence: topMatch?.confidence ?? 0,
    confidenceGap: (topMatch?.confidence ?? 0) - (secondMatch?.confidence ?? 0),
    isExactMatch: topMatch?.archetype === persona.expectedArchetype,
    isSimilarMatch: topMatch?.archetype === persona.expectedArchetype || isSimilar,
    questionsAsked: questionSequence.length,
    l3DisambiguationTriggered,
    closingQuestionsAsked: questionSequence.filter((id) => id.startsWith('Q_PLAYFUL')).length,
    traitScores: normalizedTraits,
    ...(reportedTraitScores ? { reportedTraitScores, maxShrinkageDelta } : {}),
    questionSequence,
    top3Matches: state.currentMatches.slice(0, 3).map((m) => ({ archetype: m.archetype, score: m.score })),
  };
}

// ── Matcher Isolation ────────────────────────────────────────────────

export function runMatcherIsolation(persona: Persona): MatcherIsolationResult {
  const matches = findBestMatchingArchetypesV2(persona.traitProfile);
  const top = matches[0];
  const second = matches[1];

  const expectedProto = archetypeRegistry[persona.expectedArchetype as keyof typeof archetypeRegistry];
  const isSimilar = expectedProto?.profile.confusableWith?.includes(top?.archetype ?? '') ?? false;

  return {
    personaId: persona.id,
    personaLabel: persona.label,
    expectedArchetype: persona.expectedArchetype,
    assignedArchetype: top?.archetype ?? '',
    confidence: top?.confidence ?? 0,
    confidenceGap: (top?.confidence ?? 0) - (second?.confidence ?? 0),
    isExactMatch: top?.archetype === persona.expectedArchetype,
    top3Matches: matches.slice(0, 3).map((m) => ({ archetype: m.archetype, score: m.score })),
  };
}

// ── Report Formatting ────────────────────────────────────────────────

export function formatConsoleReport(
  results: SimulationRunResult[],
  title: string
): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('═'.repeat(80));
  lines.push(`  ${title}`);
  lines.push('═'.repeat(80));
  lines.push('');

  const exactMatches = results.filter((r) => r.isExactMatch).length;
  const similarMatches = results.filter((r) => r.isSimilarMatch).length;
  const avgQuestions = results.reduce((s, r) => s + r.questionsAsked, 0) / results.length;
  const avgConfidence = results.reduce((s, r) => s + r.confidence, 0) / results.length;
  const avgGap = results.reduce((s, r) => s + r.confidenceGap, 0) / results.length;
  const l3Rate = results.filter((r) => r.l3DisambiguationTriggered).length / results.length;

  lines.push(`📊 Summary:`);
  lines.push(`   Total personas: ${results.length}`);
  lines.push(`   Exact matches:  ${exactMatches} (${((exactMatches / results.length) * 100).toFixed(1)}%)`);
  lines.push(`   Similar+Exact:  ${similarMatches} (${((similarMatches / results.length) * 100).toFixed(1)}%)`);
  lines.push(`   Avg questions:  ${avgQuestions.toFixed(1)}`);
  lines.push(`   Avg confidence: ${avgConfidence.toFixed(3)}`);
  lines.push(`   Avg gap:        ${avgGap.toFixed(3)}`);
  lines.push(`   L3 triggered:   ${(l3Rate * 100).toFixed(1)}%`);
  lines.push('');

  // Per-persona table
  lines.push('─'.repeat(80));
  lines.push(
    `${'Persona'.padEnd(24)} ${'Expected'.padEnd(12)} ${'Assigned'.padEnd(12)} ${'Q#'.padEnd(4)} ${'Conf'.padEnd(6)} ${'Gap'.padEnd(6)} ${'Status'.padEnd(8)}`
  );
  lines.push('─'.repeat(80));

  for (const r of results) {
    const status = r.isExactMatch ? '✅ exact' : r.isSimilarMatch ? '🟡 similar' : '❌ miss';
    lines.push(
      `${r.personaLabel.slice(0, 23).padEnd(24)} ${r.expectedArchetype.padEnd(12)} ${(r.assignedArchetype ?? '—').padEnd(12)} ${String(r.questionsAsked).padEnd(4)} ${r.confidence.toFixed(2).padEnd(6)} ${r.confidenceGap.toFixed(2).padEnd(6)} ${status}`
    );
  }

  lines.push('─'.repeat(80));
  lines.push('');

  return lines.join('\n');
}

export function formatMatcherIsolationReport(
  results: MatcherIsolationResult[],
  title: string
): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('═'.repeat(80));
  lines.push(`  ${title}`);
  lines.push('═'.repeat(80));
  lines.push('');

  const exactMatches = results.filter((r) => r.isExactMatch).length;
  const avgConfidence = results.reduce((s, r) => s + r.confidence, 0) / results.length;
  const avgGap = results.reduce((s, r) => s + r.confidenceGap, 0) / results.length;

  lines.push(`📊 Summary:`);
  lines.push(`   Total personas: ${results.length}`);
  lines.push(`   Exact matches:  ${exactMatches} (${((exactMatches / results.length) * 100).toFixed(1)}%)`);
  lines.push(`   Avg confidence: ${avgConfidence.toFixed(3)}`);
  lines.push(`   Avg gap:        ${avgGap.toFixed(3)}`);
  lines.push('');

  lines.push('─'.repeat(80));
  lines.push(
    `${'Persona'.padEnd(24)} ${'Expected'.padEnd(12)} ${'Assigned'.padEnd(12)} ${'Conf'.padEnd(6)} ${'Gap'.padEnd(6)} ${'Status'.padEnd(8)}`
  );
  lines.push('─'.repeat(80));

  for (const r of results) {
    const status = r.isExactMatch ? '✅ exact' : '❌ miss';
    lines.push(
      `${r.personaLabel.slice(0, 23).padEnd(24)} ${r.expectedArchetype.padEnd(12)} ${r.assignedArchetype.padEnd(12)} ${r.confidence.toFixed(2).padEnd(6)} ${r.confidenceGap.toFixed(2).padEnd(6)} ${status}`
    );
  }

  lines.push('─'.repeat(80));
  lines.push('');

  return lines.join('\n');
}
