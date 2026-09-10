/**
 * V4 Adaptive Assessment Engine
 * 自适应测评引擎 - 弹性16+4题目选择算法
 */

import {
  TraitKey,
  TraitConfidence,
  ArchetypeMatch,
  AnsweredQuestion,
  DEFAULT_ASSESSMENT_CONFIG,
  CONFUSABLE_ARCHETYPE_PAIRS,
  AssessmentConfig,
  AdaptiveQuestion,
  CohortType,
} from './types';
import { questionsV4, getAnchorQuestions, ANCHOR_QUESTION_IDS } from './questionsV4';
import { archetypePrototypes, findBestMatchingArchetypes, normalizeTraitScore } from './prototypes';
import { prototypeMatcher, findBestMatchingArchetypesV2, ExplainableMatchResult, UserSecondaryData } from './matcherV2';
import { applyZScoreCapping, calculateSdiIndex, applySdiCorrection } from './traitCorrection';
import {
  computePairValidityPenalty,
  computeNeutralResponsePenalty,
  computeTraitConfidenceAdjustments,
  countPendingConsistencyPairs,
  isConsistencyFirstMemberId,
  isConsistencyOnlyQuestionId,
  isConsistencyPairQuestionId,
  selectConsistencyFirstMember,
  selectConsistencySecondMember,
} from './consistencyPairs';
import {
  META_CONSISTENCY_QUESTION_ID,
  META_CONSISTENCY_TARGET_TRAIT,
  MetaConsistencyEvaluation,
  evaluateMetaConsistency,
  isMetaConsistencyQuestionId,
} from './metaConsistency';
import { shrinkTraitsTowardNeutral } from './traitShrinkage';

// Feature flag - can be overridden via config.useV2Matcher
// Default true - V2 matcher is now the standard algorithm for consistency
export const ENABLE_MATCHER_V2_DEFAULT = true;

// Validity score thresholds
const ACQUIESCENCE_BIAS_THRESHOLD = 0.7;   // >70% same option → likely bias
const ACQUIESCENCE_PENALTY = 0.25;
const MIN_TRAIT_DIFFERENTIATION_STDEV = 8; // stdev < 8 → insufficient trait spread
const LOW_DIFFERENTIATION_PENALTY = 0.20;

// Development mode flag for conditional logging
const IS_DEV = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

export const MAX_SKIP_COUNT = 3;

const MEASUREMENT_DRIFT_CORRECTION_MIN_QUESTIONS = 12;

function promoteArchetypeMatch(matches: ArchetypeMatch[], archetype: string): ArchetypeMatch[] {
  const idx = matches.findIndex(m => m.archetype === archetype);
  if (idx <= 0) return matches;
  const top = matches[0];
  const target = matches[idx];
  return [{ ...target, score: Math.max(target.score, top.score), confidence: Math.max(target.confidence, top.confidence) }, ...matches.filter((_, i) => i !== idx)];
}

export function applyMeasurementDriftCorrections(normalizedTraits: Record<TraitKey, number>, matches: ArchetypeMatch[], answeredQuestionCount: number): ArchetypeMatch[] {
  if (answeredQuestionCount < MEASUREMENT_DRIFT_CORRECTION_MIN_QUESTIONS || matches.length < 2) return matches;
  const top = matches[0]?.archetype;
  const { A, C, E, O, X, P } = normalizedTraits;
  if (top === 'corgi' && C >= 60 && O <= 60) return promoteArchetypeMatch(matches, 'rooster');
  if (top === 'dolphin_calm' && A >= 85 && E >= 75 && O >= 70) return promoteArchetypeMatch(matches, 'koala');
  if (top === 'fox' && O >= 80 && X >= 80 && A >= 50 && C < 55) return promoteArchetypeMatch(matches, 'octopus');
  return matches;
}

// ── Pure calibration infrastructure ─────────────────────────────────
export const CALIBRATION_QUESTION_IDS: readonly string[] = ['Q51_PureX','Q52_PureO','Q53_PureC','Q54_PureP'] as const;
const COHORT_CALIBRATION_MAP: Record<CohortType, readonly string[]> = {
  creative_explorer:['Q52_PureO','Q51_PureX'], social_catalyst:['Q51_PureX','Q54_PureP'],
  quiet_anchor:['Q53_PureC','Q52_PureO'], steady_harmonizer:['Q53_PureC','Q54_PureP'],
  reflective_stabilizer:['Q53_PureC','Q52_PureO'], universal:['Q51_PureX','Q52_PureO'],
};
function selectCalQuestion(cohort: CohortType|undefined, asked:Set<string>, n:number, max:number): string|null {
  if (n>=max) return null;
  for (const id of COHORT_CALIBRATION_MAP[cohort??'universal']) if (!asked.has(id)) return id;
  return null;
}

/**
 * Universal closing questions appended to every V4 session after the adaptive
 * phase completes.  They are served in order and are never selected by the
 * adaptive utility scorer – their appearance is guaranteed rather than
 * conditional.
 *
 * Q_PLAYFUL_SLIDER  – continuous X/P intensity dial (slider UX)
 * Q_PLAYFUL_EMOJI   – conflict-instinct tap (emoji_tap UX, feeds conflictPosture)
 */
export const UNIVERSAL_CLOSING_QUESTION_IDS: readonly string[] = [
  'Q_PLAYFUL_SLIDER',
  'Q_PLAYFUL_EMOJI',
] as const;

/**
 * Returns true when the given question ID is a universal closing question.
 * Used to enforce special handling: closing questions are never selected
 * during the adaptive phase, are never randomized, and are only considered
 * complete once answered (not merely skipped).
 */
export function isUniversalClosingQuestionId(id: string): boolean {
  return UNIVERSAL_CLOSING_QUESTION_IDS.includes(id);
}

// ── Variant relationship maps ───────────────────────────────────────────────
// A question and its variant(s) share the same scenario intent. If one has
// been answered or skipped, the other(s) must not be served later.
const VARIANT_BASE_MAP: Record<string, string> = {};
const BASE_VARIANTS_MAP: Record<string, string[]> = {};
for (const q of questionsV4) {
  if (q.variantOf) {
    VARIANT_BASE_MAP[q.id] = q.variantOf;
    if (!BASE_VARIANTS_MAP[q.variantOf]) {
      BASE_VARIANTS_MAP[q.variantOf] = [];
    }
    BASE_VARIANTS_MAP[q.variantOf].push(q.id);
  }
}

function isQuestionIdExcluded(
  questionId: string,
  answeredQuestionIds: Set<string>,
  skippedQuestionIds: Set<string>
): boolean {
  if (answeredQuestionIds.has(questionId) || skippedQuestionIds.has(questionId)) {
    return true;
  }
  const baseId = VARIANT_BASE_MAP[questionId];
  if (baseId && (answeredQuestionIds.has(baseId) || skippedQuestionIds.has(baseId))) {
    return true;
  }
  const variants = BASE_VARIANTS_MAP[questionId];
  if (variants) {
    for (const variantId of variants) {
      if (answeredQuestionIds.has(variantId) || skippedQuestionIds.has(variantId)) {
        return true;
      }
    }
  }
  return false;
}

function isQuestionExcluded(
  question: AdaptiveQuestion,
  answeredQuestionIds: Set<string>,
  skippedQuestionIds: Set<string>
): boolean {
  return isQuestionIdExcluded(question.id, answeredQuestionIds, skippedQuestionIds);
}

/**
 * Instrumentation for tracking targetPair question selection
 * Used for debugging and calibration analysis
 */
export interface TargetPairInstrumentation {
  persistentPairDetected: number;
  persistentPairTriggersByPair: Record<string, number>;
  targetPairQuestionsSelected: number;
  targetPairMatchTypes: {
    exact: number;    // Question targets both archetypes in confusion pair
    partial: number;  // Question targets one archetype
    trait: number;    // Question targets differentiating traits
  };
  scoreGapWhenTriggered: number[];
}

let _instrumentation: TargetPairInstrumentation | null = null;

export function enableInstrumentation(): void {
  _instrumentation = {
    persistentPairDetected: 0,
    persistentPairTriggersByPair: {},
    targetPairQuestionsSelected: 0,
    targetPairMatchTypes: { exact: 0, partial: 0, trait: 0 },
    scoreGapWhenTriggered: [],
  };
}

export function disableInstrumentation(): void {
  _instrumentation = null;
}

export function getInstrumentation(): TargetPairInstrumentation | null {
  return _instrumentation;
}

export function resetInstrumentation(): void {
  if (_instrumentation) {
    _instrumentation = {
      persistentPairDetected: 0,
      persistentPairTriggersByPair: {},
      targetPairQuestionsSelected: 0,
      targetPairMatchTypes: { exact: 0, partial: 0, trait: 0 },
      scoreGapWhenTriggered: [],
    };
  }
}

/**
 * Maps English archetype IDs to Chinese names used in question.targetPairs.
 * Critical for persistent confusion pair question matching.
 */
const ARCHETYPE_ID_TO_TARGET_PAIR_NAME: Record<string, string> = {
  'corgi': '开心柯基', 'rooster': '太阳鸡', 'hamster_praise': '夸夸豚',
  'fox': '机智狐', 'dolphin_calm': '淡定海豚', 'spider': '织网蛛',
  'koala': '暖心熊', 'octopus': '灵感章鱼', 'owl': '沉思猫头鹰',
  'elephant': '定心大象', 'turtle': '稳如龟', 'cat': '隐身猫',
};

/**
 * Persistent confusion pairs that resist tuning
 * These require targeted disambiguation questions when detected
 * Format: [archetype1, archetype2] - order doesn't matter
 */
export const PERSISTENT_CONFUSION_PAIRS: [string, string][] = [
  ['rooster', 'dolphin_calm'],       // P gap: 92 vs 68
  ['owl', 'turtle'],     // O gap: 88 vs 65
  ['dolphin_calm', 'koala'],       // A gap: 70 vs 88
  ['rooster', 'corgi'],       // X gap: 85 vs 95
  ['spider', 'dolphin_calm'],       // C gap: 85 vs 70
  ['octopus', 'fox'],       // C gap: 28 vs 50
  ['turtle', 'cat'],       // X gap: 30 vs 22
  ['owl', 'octopus'],       // C gap: 80 vs 28
];

/**
 * Check if top-2 archetypes form a known persistent confusion pair
 */
export function detectPersistentConfusionPair(
  matches: ArchetypeMatch[]
): { isPersistentPair: boolean; pair: [string, string] | null; scoreGap: number } {
  if (matches.length < 2) {
    return { isPersistentPair: false, pair: null, scoreGap: 1 };
  }
  
  const top1 = matches[0].archetype;
  const top2 = matches[1].archetype;
  const scoreGap = matches[0].confidence - matches[1].confidence;
  
  for (const [a, b] of PERSISTENT_CONFUSION_PAIRS) {
    if ((top1 === a && top2 === b) || (top1 === b && top2 === a)) {
      return { isPersistentPair: true, pair: [a, b], scoreGap };
    }
  }
  
  return { isPersistentPair: false, pair: null, scoreGap };
}

export interface EngineState {
  answeredQuestionIds: Set<string>;
  skippedQuestionIds: Set<string>;
  skipCount: number;
  traitScores: Record<TraitKey, number>;
  traitSampleCounts: Record<TraitKey, number>;
  traitConfidences: Record<TraitKey, TraitConfidence>;
  currentMatches: ArchetypeMatch[];
  /**
   * Plan Item 2 (flag-on only): the raw matcher output captured BEFORE the
   * match-confidence composition step scales confidences by validityScore.
   * shouldTerminate reads this (not the composed currentMatches) so the
   * composition step — a reporting/measurement surface (AC-2.2b) — never
   * alters termination geometry or session length. Undefined flag-off.
   */
  lastRawMatches?: ArchetypeMatch[];
  /**
   * Plan Item 4 (flag-on only): the evaluation produced when the
   * meta-consistency item (Q168) is answered — self-report vs engine estimate
   * on the target trait, the discrepancy, and the session-confidence
   * multiplier applied. Telemetry/observability sink; undefined flag-off or
   * before the meta item is answered.
   */
  metaConsistencyEvaluation?: MetaConsistencyEvaluation;
  questionHistory: AnsweredQuestion[];
  config: AssessmentConfig;
  detectedCohort?: CohortType;
  traitScoreHistory: Record<TraitKey, number[]>;
  calibrationQuestionsAsked: number;
}

export function initializeEngineState(config?: Partial<AssessmentConfig>): EngineState {
  const fullConfig = { ...DEFAULT_ASSESSMENT_CONFIG, ...config };
  
  const traitScores: Record<TraitKey, number> = { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 };
  const traitSampleCounts: Record<TraitKey, number> = { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 };
  const traitConfidences: Record<TraitKey, TraitConfidence> = {} as Record<TraitKey, TraitConfidence>;
  
  for (const trait of ALL_TRAITS) {
    traitConfidences[trait] = {
      trait,
      score: 0,
      confidence: 0,
      sampleCount: 0,
    };
  }
  
  return {
    answeredQuestionIds: new Set(),
    skippedQuestionIds: new Set(),
    skipCount: 0,
    traitScores,
    traitSampleCounts,
    traitConfidences,
    currentMatches: [],
    questionHistory: [],
    config: fullConfig,
    traitScoreHistory: { A: [], C: [], E: [], O: [], X: [], P: [] },
    calibrationQuestionsAsked: 0,
  };
}

export function processAnswer(
  state: EngineState,
  question: AdaptiveQuestion,
  selectedOption: string
): EngineState {
  const option = question.options.find(o => o.value === selectedOption);
  if (!option) {
    throw new Error(`Invalid option ${selectedOption} for question ${question.id}`);
  }
  
  const newState = { ...state };
  newState.answeredQuestionIds = new Set(state.answeredQuestionIds);
  newState.answeredQuestionIds.add(question.id);
  
  newState.traitScores = { ...state.traitScores };
  newState.traitSampleCounts = { ...state.traitSampleCounts };
  newState.traitConfidences = { ...state.traitConfidences };
  newState.traitScoreHistory = ALL_TRAITS.reduce((acc, trait) => {
    acc[trait] = state.traitScoreHistory ? [...state.traitScoreHistory[trait]] : [];
    return acc;
  }, {} as Record<TraitKey, number[]>);
  
  for (const [trait, score] of Object.entries(option.traitScores) as [TraitKey, number][]) {
    if (score !== undefined && score !== 0) {
      newState.traitScores[trait] = (newState.traitScores[trait] || 0) + score;
      newState.traitSampleCounts[trait] = (newState.traitSampleCounts[trait] || 0) + 1;
      newState.traitScoreHistory![trait].push(score);
    }
  }
  
  for (const trait of ALL_TRAITS) {
    const rawScore = newState.traitScores[trait];
    const sampleCount = newState.traitSampleCounts[trait];
    // Fix: Normalize the AVERAGE score, not the total score
    const avgScore = rawScore / Math.max(1, sampleCount);
    const normalizedScore = normalizeTraitScore(avgScore);

    const confidence = calculateTraitConfidence(sampleCount, rawScore, newState.traitScoreHistory![trait]);

    newState.traitConfidences[trait] = {
      trait,
      score: normalizedScore,
      confidence,
      sampleCount,
    };
  }

  // ── Plan Item 2 (AC-2.2, flag-gated): consistency-pair confidence fold ──
  // Pair agreement adjusts CONFIDENCE ONLY, bounded ±0.15 per trait.
  // Trait scores above are never touched by this mechanic.
  const consistencyOn = newState.config.enableConsistencyFolding === true;
  const nextHistory: AnsweredQuestion[] = [
    ...state.questionHistory,
    {
      questionId: question.id,
      selectedOption,
      traitScores: option.traitScores,
      answeredAt: new Date().toISOString(),
    },
  ];
  if (consistencyOn) {
    // The positive (agreement) boost is void when a legacy response-set
    // check fires on the current state: mechanically-consistent answering
    // (straight-lining, undifferentiated neutrality) must not earn a
    // confidence reward for agreeing with itself. Mismatch penalties apply
    // regardless. Predicates mirror calculateValidityScore checks 1–2.
    // Plan Item 4: the zero-evidence meta answer is excluded from the share
    // denominator here exactly as in calculateValidityScore.
    const evidenceHistory = newState.config.enableMetaConsistency === true
      ? nextHistory.filter((a) => !isMetaConsistencyQuestionId(a.questionId))
      : nextHistory;
    const optionCounts: Record<string, number> = {};
    for (const a of evidenceHistory) {
      optionCounts[a.selectedOption] = (optionCounts[a.selectedOption] || 0) + 1;
    }
    const maxShare = evidenceHistory.length > 0
      ? Math.max(...Object.values(optionCounts)) / evidenceHistory.length
      : 0;
    const traitValues = ALL_TRAITS.map((t) => newState.traitConfidences[t].score);
    const traitMean = traitValues.reduce((a, b) => a + b, 0) / traitValues.length;
    const traitStdev = Math.sqrt(
      traitValues.reduce((s, v) => s + Math.pow(v - traitMean, 2), 0) / traitValues.length
    );
    const responseSetDetected =
      maxShare > ACQUIESCENCE_BIAS_THRESHOLD || traitStdev < MIN_TRAIT_DIFFERENTIATION_STDEV;
    const adjustments = computeTraitConfidenceAdjustments(nextHistory, responseSetDetected);
    for (const trait of ALL_TRAITS) {
      const adj = adjustments[trait];
      if (adj) {
        const tc = newState.traitConfidences[trait];
        newState.traitConfidences[trait] = {
          ...tc,
          confidence: Math.max(0, Math.min(1, tc.confidence + adj)),
        };
      }
    }
  }

  // Note: Z-score capping is applied at match time in matcherV2, not here
  // Keeping raw scores in state for question selection and analytics
  const normalizedTraits: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    normalizedTraits[trait] = newState.traitConfidences[trait].score;
  }

  // ── Plan Item 3 (AC-3.1, flag-gated): confidence-weighted trait shrinkage ──
  // The matcher consumes traits shrunk toward 50 by the calibrated per-trait
  // expected-error curve (traitShrinkage.ts). Shrinkage sits AFTER Item 2's
  // confidence fold (so w reads the folded confidence) and BEFORE the match;
  // Item 2's validity composition and Item 4's meta multiplier then scale
  // match CONFIDENCE post-match. Locked composition order:
  //   shrink traits → match → confidence composition (×validity ×meta)
  // Raw engine state is never mutated: traitScores / traitConfidences keep
  // the un-shrunk estimates, so question selection (traitConfidences) and
  // termination (lastRawMatches semantics below) read pre-shrink state.
  // Flag-off: matchTraits === normalizedTraits, byte-identical.
  const shrinkOn = newState.config.enableTraitShrinkage === true;
  let matchTraits = normalizedTraits;
  if (shrinkOn) {
    const rawConfidences: Record<TraitKey, number> = {} as Record<TraitKey, number>;
    for (const trait of ALL_TRAITS) {
      rawConfidences[trait] = newState.traitConfidences[trait].confidence;
    }
    matchTraits = shrinkTraitsTowardNeutral(normalizedTraits, rawConfidences);
  }

  const useV2 = newState.config.useV2Matcher ?? ENABLE_MATCHER_V2_DEFAULT;
  if (useV2) {
    const allMatches = findBestMatchingArchetypesV2(matchTraits, undefined, 12);
    newState.currentMatches = applyMeasurementDriftCorrections(matchTraits, allMatches, newState.answeredQuestionIds.size).slice(0, 3);
  } else {
    newState.currentMatches = findBestMatchingArchetypes(matchTraits, 3);
  }

  // ── Plan Item 2 (AC-2.2b, flag-gated): match-confidence composition ──
  // currentMatches consumes trait scores ONLY; without this step the
  // confidence-only consistency signals could never move high-confidence
  // extreme assignment rates. Post-matcher, pre-commit: scale match
  // confidence by the validity score (which now includes pair-disagreement
  // and neutral-responding penalties). Uniform scaling preserves match
  // ordering; trait scores and match scores are untouched.
  if (consistencyOn) {
    const validity = calculateValidityScore({ ...newState, questionHistory: nextHistory });
    // Preserve the raw matcher output for shouldTerminate: termination must
    // see pre-composition confidences or the validity scaling would delay
    // termination for penalized sessions and inflate session length.
    newState.lastRawMatches = newState.currentMatches;
    newState.currentMatches = newState.currentMatches.map((m) => ({
      ...m,
      confidence: Math.max(0, Math.min(1, m.confidence * validity)),
    }));
  }

  // ── Plan Item 4 (AC-4.2, flag-gated): meta-consistency confidence fold ──
  // When the closing-phase meta item (Q168) is answered, compare its direct
  // self-report on the target trait against the engine's estimate (computed
  // above from the pre-answer history — the meta item's options are all
  // zero-loading, so the answer structurally cannot contaminate the estimate
  // it is compared against). Discrepancy ≥ 30 applies a bounded ×0.8
  // session-confidence multiplier to match CONFIDENCE only, composed
  // multiplicatively on top of Item 2's validity composition:
  //   conf = raw × validityScore (Item 2, flag-gated) × metaMultiplier (Item 4)
  // Trait scores are never touched. The meta item is served once per session
  // (post-termination, after the universal closing questions), so the
  // multiplier applies at most once and can remove at most 20% of confidence.
  // Termination is unaffected: the meta item is only served after
  // shouldTerminate has already fired, and lastRawMatches is preserved.
  const metaOn = newState.config.enableMetaConsistency === true;
  if (metaOn && isMetaConsistencyQuestionId(question.id)) {
    const estimate = newState.traitConfidences[META_CONSISTENCY_TARGET_TRAIT].score;
    const evaluation = evaluateMetaConsistency(question, selectedOption, estimate);
    if (evaluation) {
      newState.metaConsistencyEvaluation = evaluation;
      if (evaluation.flagged) {
        newState.currentMatches = newState.currentMatches.map((m) => ({
          ...m,
          confidence: Math.max(0, Math.min(1, m.confidence * evaluation.multiplier)),
        }));
      }
    }
  }

  newState.questionHistory = nextHistory;
  if ((CALIBRATION_QUESTION_IDS as readonly string[]).includes(question.id)) {
    newState.calibrationQuestionsAsked = (state.calibrationQuestionsAsked || 0) + 1;
  } else if (
    consistencyOn &&
    isConsistencyFirstMemberId(question.id) &&
    !ANCHOR_QUESTION_IDS.includes(question.id) &&
    newState.calibrationQuestionsAsked < (newState.config.maxCalibrationQuestions ?? 2)
  ) {
    // Plan Item 2: non-anchor consistency-pair first members occupy the
    // calibration question budget 1:1 (they are the post-anchor calibration
    // instrumentation when the flag is on; the calibration phase then
    // no-ops). Anchor firsts (Q150) occupy an anchor slot and do NOT count.
    // This keeps the shouldTerminate effective-question accounting
    // (eff = answered − calibrationQuestionsAsked) identical to flag-off.
    newState.calibrationQuestionsAsked = (state.calibrationQuestionsAsked || 0) + 1;
  }
  return newState;
}

function calculateTraitConfidence(sampleCount: number, totalScore: number, scoreHistory?: number[]): number {
  if (sampleCount === 0) return 0;
  
  const baseSampleWeight = Math.min(1, sampleCount / 4);
  
  if (scoreHistory && scoreHistory.length >= 2) {
    const mean = scoreHistory.reduce((sum, s) => sum + s, 0) / scoreHistory.length;
    // Sample variance (Bessel's correction, n-1); high variance → exp approaches 0 → lower bonus
    const variance = scoreHistory.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / (scoreHistory.length - 1);
    const consistencyBonus = Math.min(0.3, Math.exp(-variance / 2) * 0.3);
    return Math.min(1, baseSampleWeight * 0.8 + consistencyBonus);
  }
  
  const scoreVariance = Math.abs(totalScore) / Math.max(1, sampleCount);
  const consistencyBonus = Math.min(0.2, scoreVariance * 0.05);
  
  return Math.min(1, baseSampleWeight * 0.8 + consistencyBonus);
}

/**
 * Detect user cohort based on trait signals after anchor questions
 * Uses differential-based priority to prevent early misclassification
 * 
 * Key insight: Use (O-X) vs (X-O) differential to determine creative vs social priority
 * - When O > X: likely creative_explorer
 * - When X > O and P high: likely social_catalyst
 */
export function detectCohort(normalizedTraits: Record<TraitKey, number>): CohortType {
  const { A, C, E, O, X, P } = normalizedTraits;
  
  // Calculate key differentials
  const creativeSignal = O - X;  // Positive = creative tendency
  const socialSignal = X + P - O; // Positive = social tendency
  
  // Quiet Anchor: Low extraversion with structured approach (check early)
  // Targets: cat (X:20), turtle (X:30), elephant (X:40)
  if (X <= 45 && C >= 55) {
    return 'quiet_anchor';
  }
  
  // Use differential to determine creative vs social priority
  // octopus (O:95, X:60) → creativeSignal = +35
  // corgi (O:65, X:95, P:90) → creativeSignal = -30, socialSignal = +120
  // hamster_praise (O:50, X:75, P:95) → creativeSignal = -25, socialSignal = +120
  
  if (creativeSignal >= 10) {
    // Strong creative signal - O dominates X
    return 'creative_explorer';
  }
  
  if (creativeSignal <= -10 && (P >= 60 || X >= 70)) {
    // Strong social signal - X dominates O with high P or X
    return 'social_catalyst';
  }
  
  // For borderline cases, use absolute thresholds
  if (O >= 65 && O > X) {
    return 'creative_explorer';
  }
  
  if ((X >= 70 && P >= 55) || (P >= 70 && X >= 55)) {
    return 'social_catalyst';
  }
  
  // Steady Harmonizer: High affinity, emotionally balanced
  // Targets: koala (A:90), dolphin_calm (A:65, E:75), spider (A:75)
  if (A >= 60 && E >= 55) {
    return 'steady_harmonizer';
  }
  
  // Fallback classification based on dominant trait
  if (O >= 55) {
    return 'creative_explorer';
  }
  
  if (X >= 60 || P >= 60) {
    return 'social_catalyst';
  }
  
  // Default to harmonizer (most balanced)
  return 'steady_harmonizer';
}

export function selectNextQuestion(state: EngineState): AdaptiveQuestion | null {
  const { answeredQuestionIds, skippedQuestionIds, config, traitConfidences } = state;
  const questionCount = answeredQuestionIds.size;
  const consistencyOn = config.enableConsistencyFolding === true;
  const anchorsAnswered = ANCHOR_QUESTION_IDS.filter((id) => answeredQuestionIds.has(id)).length;

  // ── Plan Item 2 (flag-gated): consistency-pair first-member injection ──
  // Non-anchor pair firsts are injected at positions 10–11 (immediately
  // after the 9-anchor baseline), occupying the two calibration slots 1:1.
  // CP1's first (Q150) is itself an anchor and needs no scheduling. Firsts
  // are always served by question hardMax−5 (the AC-2.1 cutoff); seconds
  // follow in the closing phase (spacing ≥4 by construction). Outside this
  // window — including any session whose prefix is not a clean anchor run —
  // unstarted pairs are deferred (never started).
  if (consistencyOn) {
    const firstPick = selectConsistencyFirstMember(
      state.questionHistory,
      answeredQuestionIds,
      skippedQuestionIds,
      anchorsAnswered,
      config.hardMaxQuestions
    );
    if (firstPick) return firstPick;
  }

  // Complete anchor questions first to ensure calibrated baseline
  if (questionCount < config.anchorQuestionCount) {
    const anchors = getAnchorQuestions();
    const unansweredAnchors = anchors.filter(q =>
      !isQuestionExcluded(q, answeredQuestionIds, skippedQuestionIds)
    );
    if (unansweredAnchors.length > 0) {
      return unansweredAnchors[0];
    }
  }

  // ── Calibration phase (after anchors) ──────────────────────────
  if (state.config.enableCalibrationQuestions && questionCount >= config.anchorQuestionCount) {
    let s = state;
    if (!s.detectedCohort) {
      const nt: Record<TraitKey,number> = {} as any;
      for (const t of ALL_TRAITS) nt[t] = traitConfidences[t]?.score ?? 50;
      s = { ...s, detectedCohort: detectCohort(nt) };
    }
    const max = s.config.maxCalibrationQuestions ?? 2;
    const calId = selectCalQuestion(s.detectedCohort, s.answeredQuestionIds, s.calibrationQuestionsAsked, max);
    if (calId) {
      const cq = questionsV4.find(q => q.id === calId);
      // Plan Item 2: flag-on, consistency-pair members are scheduler-owned —
      // the calibration phase must not serve a pair first past the
      // hardMax−5 first-member cutoff (AC-2.1 deferral semantics).
      if (cq && !isQuestionExcluded(cq, s.answeredQuestionIds, s.skippedQuestionIds) &&
          !(consistencyOn && isConsistencyPairQuestionId(cq.id))) return cq;
    }
    if (s.calibrationQuestionsAsked < max) s = { ...s, calibrationQuestionsAsked: max };
  }

  // === Tier 1: Early Confusion Detection (After anchor questions) ===
  // NOTE: Triggers immediately after anchor questions complete (Q8+) rather than during
  // anchors to avoid interrupting the calibrated baseline measurement
  if (questionCount >= config.anchorQuestionCount && questionCount < config.anchorQuestionCount + 3) {
    const earlyMatches = state.currentMatches;
    if (earlyMatches.length >= 2) {
      const confusionDetection = detectPersistentConfusionPair(earlyMatches);
      
      // DISABLED: Early persistent-pair injection causes trait drift.
      // Rely on discriminationIndex + anchor count + natural utility instead.
      // if (confusionDetection.isPersistentPair && confusionDetection.scoreGap < 0.12) { ... }
    }
  }
  
  // Detect cohort after anchor questions if not already detected
  let updatedState = state;
  if (!state.detectedCohort && questionCount >= config.anchorQuestionCount) {
    const normalizedTraits: Record<TraitKey, number> = {} as Record<TraitKey, number>;
    for (const trait of ALL_TRAITS) {
      normalizedTraits[trait] = traitConfidences[trait]?.score ?? 50;
    }
    updatedState = { ...state, detectedCohort: detectCohort(normalizedTraits) };
  }
  
  if (shouldTerminate(updatedState)) {
    // Plan Item 2 (flag-gated): closing-phase pair-completion fallback.
    // A started pair whose second member never became due adaptively (the
    // session terminated at the natural minimum) is completed HERE, before
    // the universal closing questions. This is what makes pair completion
    // guaranteed under natural termination without extending the adaptive
    // phase (seconds in this branch are closing-phase slots, not adaptive
    // slots — adaptive session length is untouched).
    if (consistencyOn) {
      const pendingSecond = selectConsistencySecondMember(
        updatedState.questionHistory,
        updatedState.answeredQuestionIds,
        updatedState.skippedQuestionIds
      );
      if (pendingSecond) return pendingSecond;
    }
    // Adaptive phase is complete – now guarantee the universal closing questions.
    // Return the first one that hasn't been answered yet.  Skipped state is
    // intentionally ignored here: closing questions are only complete once
    // answered, so a skipped closing question must be re-surfaced.
    const pendingClosingId = UNIVERSAL_CLOSING_QUESTION_IDS.find(
      id => !updatedState.answeredQuestionIds.has(id)
    );
    if (pendingClosingId) {
      const closingQuestion = questionsV4.find(q => q.id === pendingClosingId) || null;
      // Return closing questions with their native option order (slider/emoji_tap don't benefit
      // from randomization and the UX components expect a stable layout).
      return closingQuestion;
    }
    // Plan Item 4 (flag-gated): the meta-consistency item (Q168) is served
    // LAST in the closing phase — after pair seconds and both universal
    // closing questions — so the trait estimate it compares against is
    // maximally final. It never consumes an adaptive slot (this branch only
    // runs after shouldTerminate) and never extends the adaptive phase.
    // Skipped state is intentionally ignored, mirroring the universal closing
    // questions: the meta item is only complete once answered.
    if (
      updatedState.config.enableMetaConsistency === true &&
      !updatedState.answeredQuestionIds.has(META_CONSISTENCY_QUESTION_ID)
    ) {
      return questionsV4.find(q => q.id === META_CONSISTENCY_QUESTION_ID) || null;
    }
    return null;
  }

  // Plan Item 2 (flag-gated): pair second members are served ONLY in the
  // closing phase (see the shouldTerminate branch above) — never in the
  // adaptive utility pool — so they never displace a utility pick or extend
  // a session. Spacing (≥4 answered-questions apart) is satisfied by
  // construction: firsts land at positions 9–11, closing starts at ≥13.

  // Exclude universal closing questions from the adaptive pool – they are
  // reserved for the guaranteed closing phase and must not be selected early.
  // Ipsative items (Plan Item 1) ship dark: unless config.enableIpsativeItems
  // is explicitly true they are filtered out here, which keeps flag-off
  // selection byte-identical to the pre-flag engine. When the flag is on they
  // compete in the same utility pool with no special boost. Anchor and
  // calibration phases above are unaffected — ipsative items are never
  // anchors, calibration picks, or closing questions.
  const ipsativeEnabled = updatedState.config.enableIpsativeItems === true;
  // Plan Item 2: Q166/Q167 were authored for the consistency mechanic and
  // are invisible to the flag-off selector in BOTH flag states (they did not
  // exist before — exclusion preserves byte-identity). With consistency
  // folding on, ALL pair members are owned by the consistency scheduler
  // (first-member injection + closing-phase seconds) and never compete in
  // the utility pool. Flag-off, pre-existing pair items (Q147 etc.) remain
  // ordinary bank items (byte-identical).
  // Plan Item 4: Q168 was authored for the meta-consistency mechanic and is
  // owned exclusively by the closing-phase branch above (flag-gated); it is
  // invisible to the utility pool in BOTH flag states, preserving
  // byte-identity flag-off and guaranteeing it never consumes an adaptive
  // slot flag-on (AC-4.1).
  const availableQuestions = questionsV4.filter(q =>
    !isQuestionExcluded(q, answeredQuestionIds, skippedQuestionIds) &&
    !(UNIVERSAL_CLOSING_QUESTION_IDS).includes(q.id) &&
    (ipsativeEnabled || q.questionType !== 'ipsative') &&
    !isConsistencyOnlyQuestionId(q.id) &&
    !isMetaConsistencyQuestionId(q.id) &&
    (!consistencyOn || !isConsistencyPairQuestionId(q.id))
  );
  if (availableQuestions.length === 0) {
    return null;
  }
  
  const scoredQuestions = availableQuestions.map(q => ({
    question: q,
    score: calculateQuestionUtility(q, updatedState),
  }));
  
  scoredQuestions.sort((a, b) => b.score - a.score);
  
  // Implement option randomization
  const selectedQuestion = scoredQuestions[0]?.question || null;
  if (selectedQuestion) {
    const randomizedOptions = [...selectedQuestion.options].sort(() => 0);
    return { ...selectedQuestion, options: randomizedOptions };
  }
  
  return null;
}

export function skipQuestion(
  state: EngineState,
  currentQuestionId: string
): { newState: EngineState; newQuestion: AdaptiveQuestion | null } | null {
  if (state.skipCount >= MAX_SKIP_COUNT) {
    return null;
  }
  
  const newState = { ...state };
  newState.skippedQuestionIds = new Set(state.skippedQuestionIds);
  newState.skippedQuestionIds.add(currentQuestionId);
  newState.skipCount = state.skipCount + 1;
  
  const currentQuestion = questionsV4.find(q => q.id === currentQuestionId);
  const currentLevel = currentQuestion?.level || 2;
  
  const newQuestion = selectAlternativeQuestion(newState, currentLevel);
  
  // Implement option randomization for skipped question, but preserve native
  // option order for universal closing questions (slider/emoji_tap UX requires
  // stable layout and closing questions are never selected via this path in
  // the adaptive phase anyway).
  if (newQuestion) {
    if (isUniversalClosingQuestionId(newQuestion.id)) {
      return { newState, newQuestion };
    }
    const randomizedOptions = [...newQuestion.options].sort(() => 0);
    return { newState, newQuestion: { ...newQuestion, options: randomizedOptions } };
  }
  
  return { newState, newQuestion };
}

export function selectAlternativeQuestion(
  state: EngineState,
  preferredLevel: 1 | 2 | 3
): AdaptiveQuestion | null {
  const { answeredQuestionIds, skippedQuestionIds } = state;

  // Same ipsative gate as selectNextQuestion (Plan Item 1): the skip path
  // must never surface a flag-off ipsative item as an alternative.
  const ipsativeEnabled = state.config.enableIpsativeItems === true;
  // Plan Item 2: the skip path must respect pair scheduling — pair members
  // are owned by the consistency scheduler (which enforces spacing/cutoff),
  // so the alternative pool excludes them when the flag is on. Exclusion is
  // the strongest form of "respects spacing": the skip path can never
  // violate it.
  const consistencyOn = state.config.enableConsistencyFolding === true;
  const sameLevelQuestions = questionsV4.filter(q =>
    q.level === preferredLevel &&
    !isQuestionExcluded(q, answeredQuestionIds, skippedQuestionIds) &&
    !isUniversalClosingQuestionId(q.id) &&
    (ipsativeEnabled || q.questionType !== 'ipsative') &&
    !isConsistencyOnlyQuestionId(q.id) &&
    !isMetaConsistencyQuestionId(q.id) &&
    (!consistencyOn || !isConsistencyPairQuestionId(q.id))
  );
  
  if (sameLevelQuestions.length > 0) {
    const scoredQuestions = sameLevelQuestions.map(q => ({
      question: q,
      score: calculateQuestionUtility(q, state),
    }));
    scoredQuestions.sort((a, b) => b.score - a.score);
    
    const selectedQuestion = scoredQuestions[0]?.question || null;
    if (selectedQuestion) {
      const randomizedOptions = [...selectedQuestion.options].sort(() => 0);
      return { ...selectedQuestion, options: randomizedOptions };
    }
  }
  
  return selectNextQuestion(state);
}

export function canSkipQuestion(state: EngineState): boolean {
  return state.skipCount < MAX_SKIP_COUNT;
}

export function getRemainingSkips(state: EngineState): number {
  return MAX_SKIP_COUNT - state.skipCount;
}

/**
 * Calculate utility score for a question using multiplicative bonus system
 * 
 * Algorithm:
 * 1. Calculate base utility as weighted sum of:
 *    - Information gain (30%): How much the question reduces trait uncertainty
 *    - Discrimination bonus (20%): How well it differentiates top 2 archetypes
 *    - Discrimination index (15%): Question's inherent differentiation power
 *    - Level bonus (5%): Small boost for higher difficulty questions
 *    - Forced choice bonus (5%): Boost for binary choice questions
 *    Note: These weights currently sum to 0.75 for calibration/legacy reasons.
 *          In this multiplicative model that simply scales all utilities
 *          proportionally and does not affect the relative ranking of questions.
 * 
 * 2. Apply multiplicative bonuses:
 *    - Persistent pair exact match: 2.5x (question targets both confused archetypes)
 *    - Persistent pair partial match: 1.8x (question targets one archetype)
 *    - Persistent pair trait match: 1.3-1.7x (question targets differentiating traits)
 *    - Cohort match: 1.4x (question matches detected cohort)
 *    - Cohort mismatch: 0.7x (penalty for mismatched cohort)
 * 
 * 3. Multipliers stack multiplicatively (e.g., 2.5x * 1.4x = 3.5x total boost)
 * 
 * @param question - The question to score
 * @param state - Current assessment engine state
 * @returns Final utility score (base utility * multipliers)
 */
function calculateQuestionUtility(question: AdaptiveQuestion, state: EngineState): number {
  const { traitConfidences, currentMatches, detectedCohort } = state;
  
  // Calculate base utility components
  let informationGain = 0;
  for (const trait of question.primaryTraits) {
    const conf = traitConfidences[trait];
    if (conf) {
      informationGain += (1 - conf.confidence);
    }
  }
  informationGain /= question.primaryTraits.length;
  
  let discriminationBonus = 0;
  
  if (currentMatches.length >= 2) {
    const top2 = currentMatches.slice(0, 2);
    const proto1 = archetypePrototypes[top2[0].archetype];
    const proto2 = archetypePrototypes[top2[1].archetype];
    
    if (proto1 && proto2) {
      for (const trait of question.primaryTraits) {
        const diff = Math.abs(proto1.traitProfile[trait] - proto2.traitProfile[trait]);
        discriminationBonus += diff / 100;
      }
      discriminationBonus /= question.primaryTraits.length;
    }
  }
  
  const levelBonus = question.level === 3 ? 0.1 : question.level === 2 ? 0.05 : 0;
  const discriminationIndex = question.discriminationIndex || 0.3;
  const forcedChoiceBonus = question.isForcedChoice && currentMatches.length >= 2 ? 0.1 : 0;
  
  // === Tier 2: Multiplicative Bonus System ===
  let utilityMultiplier = 1.0;
  
  // DISABLED: Persistent-pair multipliers cause over-selection of
  // disambiguation questions that create trait drift.
  // Rely on discriminationIndex and natural utility ranking instead.
  // if (currentMatches.length >= 2) {
  //   const confusionDetection = detectPersistentConfusionPair(currentMatches);
  //   ...
  // }
  
  // Cohort match multiplier (STACKS with persistent pair bonus)
  if (detectedCohort && question.cohortTag) {
    if (question.cohortTag === detectedCohort) {
      // Strong cohort match: 1.4x multiplier
      utilityMultiplier *= 1.4;
    } else if (question.cohortTag === 'universal') {
      // No penalty for universal questions
      // utilityMultiplier remains unchanged
    } else {
      // Mismatched cohort: 0.7x penalty multiplier
      utilityMultiplier *= 0.7;
    }
  }
  
  // === Calculate base utility (weighted sum) ===
  const baseUtility = (
    informationGain * 0.30 +
    discriminationBonus * 0.20 +
    discriminationIndex * 0.15 +
    levelBonus * 0.05 +
    forcedChoiceBonus * 0.05
  );

  // Normalize so that the effective base maximum is 1.0 (0.30 + 0.20 + 0.15 + 0.05 + 0.05 = 0.75)
  const normalizedBaseUtility = baseUtility / 0.75;
  
  // === Apply multiplier to get final utility ===
  return normalizedBaseUtility * utilityMultiplier;
}

/**
 * Get the differentiating traits for a persistent confusion pair
 */
function getPersistentPairDifferentiatingTraits(pair: [string, string]): TraitKey[] {
  const [a, b] = pair.sort();
  
  // Map of pairs to their key differentiating traits
  const traitMap: Record<string, TraitKey[]> = {
    'rooster,dolphin_calm': ['P', 'X'],      // P: 92 vs 68, X: 85 vs 55
    'owl,turtle': ['O', 'X'],     // O: 88 vs 65, X: 40 vs 30
    'koala,dolphin_calm': ['A', 'P'],       // A: 88 vs 70, P: 75 vs 68
  };
  
  const key = [a, b].sort().join(',');
  return traitMap[key] || [];
}

export function shouldTerminate(state: EngineState): boolean {
  const { answeredQuestionIds, config, traitConfidences } = state;
  // Plan Item 2: with consistency folding on, currentMatches confidences are
  // validity-composed (AC-2.2b); termination must use the RAW matcher output
  // so the composition step never changes when a session ends. Flag-off,
  // lastRawMatches is absent and this is byte-identical to reading
  // currentMatches directly.
  const currentMatches = state.lastRawMatches ?? state.currentMatches;
  const qc = answeredQuestionIds.size;
  const eff = qc - (state.calibrationQuestionsAsked || 0);
  
  if (qc >= config.hardMaxQuestions) return true;
  if (eff < config.minQuestions) return false;
  
  const allConfidences = Object.values(traitConfidences).map(t => t.confidence);
  const avgConfidence = allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length;
  const minConfidence = Math.min(...allConfidences);
  
  // === Tier 3: Persistent Pair Extension Logic ===
  // NOTE ON THRESHOLDS:
  // - Tier 1 (early detection) uses a looser threshold (~0.12) to eagerly surface
  //   potential confusion pairs and inject a targeted disambiguation question as
  //   soon as we have a signal.
  // - Tier 2 (multiplicative utility) is intentionally stricter (~0.08) because
  //   strong scoring bonuses should only apply when two archetypes are *very*
  //   tightly competing.
  // - Tier 3 (this block) sits in between: we only extend beyond softMax when we
  //   still see a *meaningful* but not ultra‑tight confusion. Using 0.10 here is
  //   deliberate: it is stricter than Tier 1 (to avoid over‑extending) but more
  //   permissive than Tier 2 (so we can still grant a couple of extra questions
  //   in borderline cases like a score gap of 0.09–0.11).
  // If these upstream thresholds are ever retuned, please review this 0.10
  // extension threshold to keep the relative ordering: Tier1 >= Tier3 >= Tier2.
  const confusionDetection = detectPersistentConfusionPair(currentMatches);
  
  if (confusionDetection.isPersistentPair && confusionDetection.scoreGap < 0.10) {
    // For persistent confusion pairs, require HIGHER confidence
    const requiredConfidence = 0.72;  // Elevated from 0.65 for persistent pairs
    
    // Allow up to 2 extra questions beyond softMax for persistent pairs,
    // but never exceed the global hardMaxQuestions cap. This keeps Tier 3
    // extension aligned with other extension mechanisms and the hard limit.
    const maxPersistentQuestions = Math.min(
      config.softMaxQuestions + 2,
      config.hardMaxQuestions
    );
    
    if (eff < maxPersistentQuestions) {
      if (avgConfidence < requiredConfidence || minConfidence < requiredConfidence * 0.85) {
        if (IS_DEV) {
          console.log(`[PersistentPair] Extending assessment for pair: ${confusionDetection.pair!.join(' ↔ ')} (avgConf: ${avgConfidence.toFixed(3)}, gap: ${confusionDetection.scoreGap.toFixed(3)})`);
        }
        return false;
      }
    }
  }
  
  // Continue with existing termination logic
  const hasConfusablePair = checkConfusablePairRisk(currentMatches, config.confusablePairThreshold);
  const requiredConfidence = hasConfusablePair 
    ? config.confusablePairThreshold 
    : config.defaultConfidenceThreshold;
  
  if (eff >= config.softMaxQuestions) {
    if (avgConfidence >= requiredConfidence && minConfidence >= requiredConfidence * 0.8) {
      if (config.enableTieredThreshold) {
        const needsExtraQuestions = checkTieredThresholdConditions(state, config);
        const extraQuestionsUsed = eff - config.softMaxQuestions;
        
        if (needsExtraQuestions && extraQuestionsUsed < config.tieredThresholdConfig.maxExtraQuestions) {
          return false;
        }
      }
      return true;
    }
    
    if (eff >= config.softMaxQuestions + 2) {
      const topMatch = currentMatches[0];
      const secondMatch = currentMatches[1];
      if (topMatch && secondMatch) {
        const confidenceGap = topMatch.confidence - secondMatch.confidence;
        
        // For persistent pairs, respect the elevated confidence requirement even at softMax + 2
        if (confusionDetection.isPersistentPair && confusionDetection.scoreGap < 0.10) {
          const persistentRequiredConf = 0.72;
          if (avgConfidence >= persistentRequiredConf && confidenceGap > 0.15) {
            return true;
          }
        } else if (confidenceGap > 0.15) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  if (avgConfidence >= requiredConfidence && 
      minConfidence >= requiredConfidence * 0.85 &&
      currentMatches[0]?.confidence >= requiredConfidence) {
    
    if (!hasConfusablePair) {
      if (config.enableTieredThreshold) {
        const needsExtraQuestions = checkTieredThresholdConditions(state, config);
        if (needsExtraQuestions) {
          return false;
        }
      }
      return true;
    }
  }
  
  return false;
}

/**
 * Returns the number of universal closing questions that have not yet been
 * answered in the given engine state.  Skipped state is intentionally ignored:
 * closing questions are only complete once answered, so a skipped closing
 * question is still counted as pending.
 */
export function getClosingQuestionsRemaining(state: EngineState): number {
  const universalPending = UNIVERSAL_CLOSING_QUESTION_IDS.filter(
    id => !state.answeredQuestionIds.has(id)
  ).length;
  // Plan Item 2 (flag-gated): started-but-incomplete consistency pairs are
  // completed in the closing phase, so they count as pending closing work
  // (keeps isAssessmentComplete honest for the server answer route).
  const consistencyPending =
    state.config.enableConsistencyFolding === true
      ? countPendingConsistencyPairs(state.questionHistory)
      : 0;
  // Plan Item 4 (flag-gated): the meta-consistency item is closing-phase
  // work too — count it until answered (keeps isAssessmentComplete honest).
  const metaPending =
    state.config.enableMetaConsistency === true &&
    !state.answeredQuestionIds.has(META_CONSISTENCY_QUESTION_ID)
      ? 1
      : 0;
  return universalPending + consistencyPending + metaPending;
}

/**
 * Returns true when the entire V4 assessment is finished:
 *  1. The adaptive phase has terminated (`shouldTerminate` is true), AND
 *  2. All universal closing questions have been answered.
 *
 * The server answer route should call this instead of `shouldTerminate` to
 * determine when to generate the final result.
 */
export function isAssessmentComplete(state: EngineState): boolean {
  return shouldTerminate(state) && getClosingQuestionsRemaining(state) === 0;
}

function checkTieredThresholdConditions(state: EngineState, config: AssessmentConfig): boolean {
  const { currentMatches, traitConfidences, traitSampleCounts } = state;
  const tieredConfig = config.tieredThresholdConfig;
  
  if (currentMatches.length >= 2) {
    const confidenceGap = currentMatches[0].confidence - currentMatches[1].confidence;
    if (confidenceGap < tieredConfig.confidenceGapThreshold) {
      return true;
    }
  }
  
  const totalSamples = Object.values(traitSampleCounts).reduce((a, b) => a + b, 0);
  if (totalSamples > 0) {
    const coveredDimensions = Object.values(traitConfidences).filter(t => t.confidence >= 0.6).length;
    const coverageRatio = coveredDimensions / ALL_TRAITS.length;
    if (coverageRatio < tieredConfig.dimensionCoverageThreshold) {
      return true;
    }
  }
  
  return false;
}

function checkConfusablePairRisk(matches: ArchetypeMatch[], threshold: number): boolean {
  if (matches.length < 2) return false;
  
  const top2 = [matches[0].archetype, matches[1].archetype];
  const confidenceGap = matches[0].confidence - matches[1].confidence;
  
  if (confidenceGap > 0.2) return false;
  
  for (const pair of CONFUSABLE_ARCHETYPE_PAIRS) {
    if (
      (pair.archetypes.includes(top2[0]) && pair.archetypes.includes(top2[1])) ||
      (pair.archetypes[0] === top2[0] && pair.archetypes[1] === top2[1]) ||
      (pair.archetypes[1] === top2[0] && pair.archetypes[0] === top2[1])
    ) {
      return matches[0].confidence < threshold;
    }
  }
  
  return false;
}

export function getPreSignupPreview(state: EngineState): {
  previewArchetype: string;
  confidence: number;
  traitProfile: Record<TraitKey, number>;
} {
  const topMatch = state.currentMatches[0];
  
  const traitProfile: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    traitProfile[trait] = state.traitConfidences[trait].score;
  }
  
  return {
    previewArchetype: topMatch?.archetype || 'corgi',
    confidence: topMatch?.confidence || 0,
    // Plan Item 3 (flag-gated): the preview is a reporting surface, so it
    // shows the same reported (shrunken) traits the matcher saw. The
    // previewArchetype above already derives from currentMatches, which
    // processAnswer computed on the shrunken vector. Flag-off: raw traits,
    // byte-identical.
    traitProfile: state.config.enableTraitShrinkage === true
      ? shrinkTraitsTowardNeutral(
          traitProfile,
          Object.fromEntries(ALL_TRAITS.map((t) => [t, state.traitConfidences[t].confidence])) as Record<TraitKey, number>
        )
      : traitProfile,
  };
}

export function calculateValidityScore(state: EngineState): number {
  let score = 1.0;

  // Plan Item 4 (flag-gated): the meta-consistency answer is a zero-evidence
  // self-view PROBE (no trait loadings), so it is excluded from the
  // response-set share denominator — including it would dilute Check 1 by
  // one answer and silently shift the locked AC-7.3a/b baselines whenever
  // the flag is on. Flag-off: history is used verbatim (byte-identical).
  const validityHistory =
    state.config.enableMetaConsistency === true
      ? state.questionHistory.filter((a) => !isMetaConsistencyQuestionId(a.questionId))
      : state.questionHistory;

  // Check 1: Acquiescence bias — if > 70% of answers share the same option value
  if (validityHistory.length > 0) {
    const optionCounts: Record<string, number> = {};
    for (const answer of validityHistory) {
      const opt = answer.selectedOption;
      optionCounts[opt] = (optionCounts[opt] || 0) + 1;
    }
    const maxCount = Math.max(...Object.values(optionCounts));
    if (maxCount / validityHistory.length > ACQUIESCENCE_BIAS_THRESHOLD) {
      score -= ACQUIESCENCE_PENALTY;
    }
  }

  // Check 2: Low trait differentiation — stdev of normalized trait scores < 8
  const traitValues = ALL_TRAITS.map(trait => state.traitConfidences[trait].score);
  if (traitValues.length > 0) {
    const mean = traitValues.reduce((sum, v) => sum + v, 0) / traitValues.length;
    const variance = traitValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / traitValues.length;
    const stdev = Math.sqrt(variance);
    if (stdev < MIN_TRAIT_DIFFERENTIATION_STDEV) {
      score -= LOW_DIFFERENTIATION_PENALTY;
    }
  }

  // Plan Item 2 (flag-gated): checks 3 & 4 — consistency-pair disagreement
  // (graded by response-level gap, bounded ≤ 0.2/pair) and the
  // neutral-responding detector (share of minimum-|loading| answers ≥ 0.7 →
  // −0.25). Both are pure functions of questionHistory; flag-off adds
  // exactly zero terms (byte-identical validity).
  if (state.config.enableConsistencyFolding === true) {
    score -= computePairValidityPenalty(state.questionHistory);
    score -= computeNeutralResponsePenalty(state.questionHistory);
  }

  return Math.max(0, Math.min(1, score));
}

export interface FinalResultV2 {
  primaryArchetype: string;
  secondaryArchetype?: string;
  traitScores: Record<TraitKey, number>;
  confidences: Record<TraitKey, number>;
  validityScore: number;
  algorithmVersion: string;
  matchDetails?: ExplainableMatchResult;
  isDecisive?: boolean;
  decisiveReason?: string;
}

export function getFinalResult(state: EngineState, userSecondaryData?: UserSecondaryData): FinalResultV2 {
  const normalizedTraits: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  const confidences: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  
  for (const trait of ALL_TRAITS) {
    normalizedTraits[trait] = state.traitConfidences[trait].score;
    confidences[trait] = state.traitConfidences[trait].confidence;
  }

  // ── Plan Item 3 (AC-3.1, flag-gated): this is the REPORTING boundary ──
  // FinalResultV2.traitScores are the REPORTED traits: with shrinkage on
  // they are the confidence-weighted shrink of the raw engine estimates
  // (same transform the matcher saw during the session; see processAnswer).
  // The raw estimates persist unmodified in state.traitConfidences, and the
  // returned `confidences` map stays the raw per-trait engine confidence.
  // Flag-off: reportedTraits === normalizedTraits, byte-identical.
  const reportedTraits = state.config.enableTraitShrinkage === true
    ? shrinkTraitsTowardNeutral(normalizedTraits, confidences)
    : normalizedTraits;

  // Calculate SDI from answer history for analytics (SDI correction disabled for now - too aggressive)
  // Note: Z-score capping is already applied in processAnswer, so scores are already corrected
  const answerTraitScores = state.questionHistory.map(a => a.traitScores as Record<string, number>);
  const sdiIndex = calculateSdiIndex(answerTraitScores);
  
  // SDI correction temporarily disabled - was causing over-correction
  // Will re-enable with tuned parameters after baseline validation
  // if (sdiIndex > 70) {
  //   const correctedTraits = applySdiCorrection(normalizedTraits, sdiIndex);
  //   for (const trait of ALL_TRAITS) {
  //     normalizedTraits[trait] = correctedTraits[trait];
  //   }
  // }
  void sdiIndex; // Suppress unused variable warning
  
  // V2 matcher is now the standard algorithm
  const useV2 = state.config.useV2Matcher ?? ENABLE_MATCHER_V2_DEFAULT;
  
  if (!useV2) {
    // Legacy V1 matcher fallback - deprecated but kept for backward compatibility
    // Only used if explicitly set to false in config
    console.warn('[adaptiveEngine] Using deprecated V1 matcher - please migrate to V2 matcher for improved accuracy');
    const matches = findBestMatchingArchetypes(reportedTraits, 2);
    
    return {
      primaryArchetype: matches[0]?.archetype || 'corgi',
      secondaryArchetype: matches[1]?.archetype,
      traitScores: reportedTraits,
      confidences,
      validityScore: calculateValidityScore(state),
      algorithmVersion: 'v1.0-legacy',
    };
  }
  
  // Standard V2 matcher path
  let matches = prototypeMatcher.findBestMatches(reportedTraits, userSecondaryData, 12);
  const corr = applyMeasurementDriftCorrections(reportedTraits, matches.map(m=>({archetype:m.archetype,score:m.score,confidence:m.confidence})), state.answeredQuestionIds.size);
  if (corr[0]?.archetype && corr[0].archetype!==matches[0]?.archetype) {
    const m = new Map(corr.map((x,i)=>[x.archetype,i]));
    matches = matches.sort((a,b)=>(m.get(a.archetype)??99)-(m.get(b.archetype)??99));
  }
  matches = matches.slice(0,3);
  const decisiveCheck = prototypeMatcher.isDecisiveMatch(matches);
  
  return {
    primaryArchetype: matches[0]?.archetype || 'corgi',
    secondaryArchetype: matches[1]?.archetype,
    traitScores: reportedTraits,
    confidences,
    validityScore: calculateValidityScore(state),
    algorithmVersion: prototypeMatcher.getAlgorithmVersion(),
    matchDetails: matches[0],
    isDecisive: decisiveCheck.decisive,
    decisiveReason: decisiveCheck.reason,
  };
}

export function importPreSignupAnswers(
  state: EngineState,
  preSignupAnswers: AnsweredQuestion[]
): EngineState {
  let currentState = state;
  
  for (const answer of preSignupAnswers) {
    const question = questionsV4.find(q => q.id === answer.questionId);
    if (question) {
      currentState = processAnswer(currentState, question, answer.selectedOption);
    }
  }
  
  return currentState;
}
