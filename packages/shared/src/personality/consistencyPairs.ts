/**
 * Plan Item 2 (2026-09-09) — Consistency pairs + neutral-responding detector.
 *
 * Net-new registry (the `ValidityCheckPair` type in types.ts is dead and is
 * deliberately NOT extended). All mechanics are gated behind
 * `AssessmentConfig.enableConsistencyFolding` (default OFF); with the flag
 * off the engine is byte-identical to the pre-flag behavior.
 *
 * ── Pair registry ────────────────────────────────────────────────────
 * Three near-paraphrase pairs, all reused EXISTING bank items (Item-11
 * additions Q136–Q153) — no new items authored. Each pair's two members
 * share an identical graded loading structure (+3/+1/−1/−3 on the shared
 * construct), which makes the agreement signal clean by construction:
 *   - a trait-faithful (deterministic-argmax) respondent answers both
 *     members at the SAME ordinal level → exact agreement;
 *   - a uniform-random respondent mismatches level with probability 0.75
 *     per pair (16 equiprobable level combinations, 4 exact matches).
 *
 *   CP1 Q150 ↔ Q147       急性小挫折下的情绪反应 (E: 应激反应强度)
 *   CP2 Q53_PureC ↔ Q166  承诺后的推进节奏 (C: 提前规划 vs 临时赶工)
 *   CP3 Q52_PureO ↔ Q167  陌生内容的好奇心 (O: 主动探究 vs 礼貌附和)
 *
 * Q150 is an ANCHOR item (served at position 9 in every session anyway) —
 * pairing it costs zero slots. CP2/CP3 firsts are the pure-C / pure-O
 * calibration items, injected at positions 10–11, occupying the two
 * calibration slots 1:1 (the calibration phase then no-ops flag-on; see the
 * processAnswer calibration-budget note). Because the injected firsts carry
 * exactly the C/O signal the displaced calibration questions would have
 * carried (and carry it for EVERY session, not just the cohorts whose
 * calibration map includes them), the displacement is signal-neutral for
 * the two weakest-covered traits. Q166/Q167 are authored graded twins (the
 * bank has no existing near-paraphrase C/O pairs); they are visible ONLY to
 * the consistency scheduler — never to the flag-off utility pool — so
 * flag-off behavior is byte-identical to before they existed.
 *
 * ── Signal-routing matrix (amended contract AC-2.2, explicit sinks) ──
 *   pair disagreement → (a) validityScore penalty (graded by level gap,
 *                       bounded ≤ CONSISTENCY_SIGN_DISAGREE_PENALTY per pair)
 *                       AND (b) traitConfidence adjustment (bounded
 *                       ±CONSISTENCY_CONFIDENCE_ADJUSTMENT per trait)
 *   neutral detector  → validityScore penalty only
 *   TRAIT SCORES ARE NEVER ADJUSTED. Match scores are never adjusted either;
 *   only match CONFIDENCE is composed with validityScore (AC-2.2b, in
 *   adaptiveEngine.processAnswer).
 */

import { AdaptiveQuestion, AnsweredQuestion, TraitKey } from './types';
import { getQuestionById, ANCHOR_QUESTION_IDS } from './questionsV4';

// ── Named constants (with rationale) ─────────────────────────────────

/**
 * Minimum spacing between the two members of a pair, in answered-question
 * positions (|posA − posB| ≥ 4 ⇒ at least 3 intervening questions), so the
 * second member is not answered from short-term memory of the first.
 */
export const CONSISTENCY_PAIR_MIN_SPACING = 4;

/**
 * A pair's FIRST member must be served by question (hardMax − 5) = 11 or the
 * pair is deferred entirely. Guarantees the second member fits inside
 * hardMax with the required spacing even in worst-case termination.
 */
export const CONSISTENCY_FIRST_MEMBER_CUTOFF_OFFSET = 5;

/**
 * Validity penalty per pair when the two answers land on OPPOSITE poles of
 * the shared construct (level gap ≥ 2, e.g. +3 vs −1). Contract AC-2.2:
 * "bounded ~−0.2 per disagreeing pair".
 */
export const CONSISTENCY_SIGN_DISAGREE_PENALTY = 0.2;

/**
 * Validity penalty per pair for an ADJACENT-level mismatch (level gap == 1,
 * same pole, different magnitude — e.g. +3 vs +1). Partial disagreement:
 * directionally consistent but magnitude-inconsistent.
 */
export const CONSISTENCY_ADJACENT_LEVEL_PENALTY = 0.15;

/**
 * Per-trait confidence adjustment bound. Any level mismatch on a completed
 * pair applies −0.15 to each of the pair's target traits; exact agreement on
 * ALL completed pairs covering a trait applies +0.15 (consistent evidence
 * raises confidence). Net per-trait adjustment is clamped to ±0.15 total.
 * Rationale for asymmetry-free full weight on any mismatch: confidence
 * answers "can we trust this estimate" — any internal contradiction erodes
 * it; the validity score (not confidence) carries the graded severity.
 */
export const CONSISTENCY_CONFIDENCE_ADJUSTMENT = 0.15;

/**
 * Neutral-responding detector. An answer counts as "neutral" when the chosen
 * option's total absolute loading equals the question's MINIMUM over options
 * (the midpoint-hugger policy), excluding non-differentiating questions
 * (min == max, e.g. the zero-loading attention check). The detector fires
 * when the neutral share of eligible answers is ≥ 0.7 — far above what
 * genuine moderate-trait users produce (measured 2026-09-09: clean arm
 * neutral share ≈ 0.1–0.3; midpoint-hugger = 1.0). Penalty mirrors the
 * acquiescence-check magnitude (−0.25).
 */
export const NEUTRAL_RESPONSE_SHARE_THRESHOLD = 0.7;
export const NEUTRAL_RESPONSE_PENALTY = 0.25;
/** Minimum eligible (differentiating) answers before the detector may fire. */
export const NEUTRAL_MIN_ELIGIBLE_ANSWERS = 6;

// ── Registry ─────────────────────────────────────────────────────────

export interface ConsistencyPair {
  id: string;
  /** Served first (positions 9–11 under the engine's injection schedule). */
  firstQuestionId: string;
  /** Served in the closing phase (spacing ≥ 4 satisfied by construction). */
  secondQuestionId: string;
  /** Traits whose confidence is adjusted by this pair's agreement. */
  targetTraits: TraitKey[];
  /** Shared construct this pair double-measures (documentation). */
  construct: string;
  /**
   * Explicit option value → ordinal response level (0 = strongest negative
   * pole … 3 = strongest positive pole) on the shared construct. Declared
   * per pair rather than inferred at runtime so the mapping is auditable
   * and immune to future bank edits silently changing the mechanic.
   */
  levelByOptionValue: Record<string, number>;
}

export const CONSISTENCY_PAIRS: ConsistencyPair[] = [
  {
    id: 'CP1_E_ACUTE_STRESSOR',
    firstQuestionId: 'Q150',
    secondQuestionId: 'Q147',
    targetTraits: ['E'],
    construct: '急性小挫折（买错票 / 导航带错路）下的即时情绪反应强度',
    levelByOptionValue: { A: 3, B: 2, C: 1, D: 0 },
  },
  {
    id: 'CP2_C_COMMITMENT_PACING',
    firstQuestionId: 'Q53_PureC',
    secondQuestionId: 'Q166',
    targetTraits: ['C'],
    construct: '承诺后的推进节奏（策划活动 / 订地方）——提前规划 vs 临时赶工',
    levelByOptionValue: { A: 3, B: 2, C: 1, D: 0 },
  },
  {
    id: 'CP3_O_CURIOSITY_DRIVE',
    firstQuestionId: 'Q52_PureO',
    secondQuestionId: 'Q167',
    targetTraits: ['O'],
    construct: '面对陌生内容（冷门书籍 / 未接触过的领域）的主动探究欲',
    levelByOptionValue: { A: 3, B: 2, C: 1, D: 0 },
  },
];

const PAIR_MEMBER_IDS = new Set(
  CONSISTENCY_PAIRS.flatMap((p) => [p.firstQuestionId, p.secondQuestionId])
);
const FIRST_MEMBER_IDS = new Set(CONSISTENCY_PAIRS.map((p) => p.firstQuestionId));

/**
 * Items AUTHORED for Plan Item 2 (Q166, Q167 — graded twins of the pure
 * calibration items). They did not exist before this item, so they are
 * excluded from the utility/skip-alternative pools in BOTH flag states;
 * the consistency scheduler is their only serving path (closing-phase
 * seconds, flag on). This is what keeps flag-off behavior byte-identical.
 */
export const CONSISTENCY_ONLY_QUESTION_IDS: readonly string[] = ['Q166', 'Q167'];

export function isConsistencyOnlyQuestionId(id: string): boolean {
  return (CONSISTENCY_ONLY_QUESTION_IDS as readonly string[]).includes(id);
}

export function isConsistencyPairQuestionId(id: string): boolean {
  return PAIR_MEMBER_IDS.has(id);
}

export function isConsistencyFirstMemberId(id: string): boolean {
  return FIRST_MEMBER_IDS.has(id);
}

// ── Pair status computation (pure; O(pairs × history)) ───────────────

export type ConsistencyPairState = 'not-started' | 'pending' | 'complete';

export interface ConsistencyPairStatus {
  pairId: string;
  state: ConsistencyPairState;
  /** 1-based answered-question position of each member (0 = not answered). */
  firstPosition: number;
  secondPosition: number;
  firstLevel: number | null;
  secondLevel: number | null;
  /** |firstLevel − secondLevel|; null unless complete. */
  levelGap: number | null;
  /** Graded validity penalty contributed by this pair (0 when complete-agree or incomplete). */
  validityPenalty: number;
}

export function getConsistencyPairStatus(
  questionHistory: AnsweredQuestion[]
): ConsistencyPairStatus[] {
  const posById = new Map<string, { position: number; selectedOption: string }>();
  questionHistory.forEach((a, i) => {
    posById.set(a.questionId, { position: i + 1, selectedOption: a.selectedOption });
  });

  return CONSISTENCY_PAIRS.map((pair) => {
    const first = posById.get(pair.firstQuestionId);
    const second = posById.get(pair.secondQuestionId);
    const base: ConsistencyPairStatus = {
      pairId: pair.id,
      state: 'not-started',
      firstPosition: 0,
      secondPosition: 0,
      firstLevel: null,
      secondLevel: null,
      levelGap: null,
      validityPenalty: 0,
    };
    if (!first) return base;
    base.state = 'pending';
    base.firstPosition = first.position;
    base.firstLevel = pair.levelByOptionValue[first.selectedOption] ?? null;
    if (!second) return base;
    base.state = 'complete';
    base.secondPosition = second.position;
    base.secondLevel = pair.levelByOptionValue[second.selectedOption] ?? null;
    if (base.firstLevel !== null && base.secondLevel !== null) {
      base.levelGap = Math.abs(base.firstLevel - base.secondLevel);
      base.validityPenalty =
        base.levelGap >= 2
          ? CONSISTENCY_SIGN_DISAGREE_PENALTY
          : base.levelGap === 1
            ? CONSISTENCY_ADJACENT_LEVEL_PENALTY
            : 0;
    }
    return base;
  });
}

/** Total graded pair-disagreement penalty for calculateValidityScore. */
export function computePairValidityPenalty(questionHistory: AnsweredQuestion[]): number {
  return getConsistencyPairStatus(questionHistory).reduce((s, p) => s + p.validityPenalty, 0);
}

/**
 * Per-trait confidence adjustments (bounded ±CONSISTENCY_CONFIDENCE_ADJUSTMENT).
 * For each target trait: −0.15 if ANY completed pair covering it mismatched
 * (level gap ≥ 1); +0.15 only if ALL completed pairs covering it agreed
 * exactly. Pairs still pending contribute nothing.
 *
 * `suppressPositiveBoost`: when a legacy response-set check (acquiescence
 * same-value share or low trait differentiation) has fired, internal
 * consistency is mechanically explained by the response set itself (a
 * straight-liner agrees with itself perfectly), so the positive boost is
 * void — only the negative (mismatch) direction applies. This keeps the
 * locked AC-7.3d directional invariant (straight-liner confidence stays
 * below clean) intact with the flag on.
 */
export function computeTraitConfidenceAdjustments(
  questionHistory: AnsweredQuestion[],
  suppressPositiveBoost = false
): Partial<Record<TraitKey, number>> {
  const statuses = getConsistencyPairStatus(questionHistory).filter(
    (s) => s.state === 'complete'
  );
  const adjustments: Partial<Record<TraitKey, number>> = {};
  for (const status of statuses) {
    const pair = CONSISTENCY_PAIRS.find((p) => p.id === status.pairId)!;
    const mismatched = (status.levelGap ?? 0) >= 1;
    const vote = mismatched
      ? -CONSISTENCY_CONFIDENCE_ADJUSTMENT
      : suppressPositiveBoost
        ? 0
        : CONSISTENCY_CONFIDENCE_ADJUSTMENT;
    if (vote === 0) continue;
    for (const trait of pair.targetTraits) {
      // Inconsistency dominates: once negative, a trait stays negative.
      const prev = adjustments[trait];
      adjustments[trait] = prev === undefined ? vote : Math.min(prev, vote);
    }
  }
  return adjustments;
}

// ── Neutral-responding detector ──────────────────────────────────────

function absoluteLoadingSum(option: { traitScores: Partial<Record<TraitKey, number>> }): number {
  let sum = 0;
  for (const v of Object.values(option.traitScores)) sum += Math.abs(v || 0);
  return sum;
}

export interface NeutralResponseStats {
  /** Questions with a differentiating loading profile (min < max Σ|loading|). */
  eligibleCount: number;
  /** Answers whose chosen option sits at the question's minimum Σ|loading|. */
  neutralCount: number;
  /** neutralCount / eligibleCount (0 when no eligible answers). */
  share: number;
  /** True when share ≥ NEUTRAL_RESPONSE_SHARE_THRESHOLD and enough data. */
  fired: boolean;
}

export function computeNeutralResponseStats(questionHistory: AnsweredQuestion[]): NeutralResponseStats {
  let eligibleCount = 0;
  let neutralCount = 0;
  for (const answer of questionHistory) {
    const question: AdaptiveQuestion | undefined = getQuestionById(answer.questionId);
    if (!question || question.options.length < 2) continue;
    const sums = question.options.map(absoluteLoadingSum);
    const min = Math.min(...sums);
    const max = Math.max(...sums);
    if (min === max) continue; // non-differentiating (e.g. zero-loading attention check)
    eligibleCount++;
    const chosen = question.options.find((o) => o.value === answer.selectedOption);
    if (chosen && absoluteLoadingSum(chosen) === min) neutralCount++;
  }
  const share = eligibleCount > 0 ? neutralCount / eligibleCount : 0;
  return {
    eligibleCount,
    neutralCount,
    share,
    fired: eligibleCount >= NEUTRAL_MIN_ELIGIBLE_ANSWERS && share >= NEUTRAL_RESPONSE_SHARE_THRESHOLD,
  };
}

/** Neutral-detector penalty for calculateValidityScore (0 when not fired). */
export function computeNeutralResponsePenalty(questionHistory: AnsweredQuestion[]): number {
  return computeNeutralResponseStats(questionHistory).fired ? NEUTRAL_RESPONSE_PENALTY : 0;
}

// ── Selector scheduling helpers ──────────────────────────────────────

/**
 * The pair whose FIRST member should be injected now, if any.
 *
 * Only NON-ANCHOR firsts are injected: CP1's first (Q150) is an anchor item
 * and is served by the ordinary anchor phase at position 9 — no scheduling
 * needed. The two remaining firsts are injected at positions 10–11
 * (immediately after the 9-anchor baseline completes), occupying the two
 * calibration slots 1:1. This satisfies the amended contract's geometry:
 *   - every first is served by question hardMax−5 = 11 (AC-2.1 cutoff);
 *   - the anchor phase is completely untouched (no interleaving, gate stays
 *     `questionCount < anchorQuestionCount` in both flag states);
 *   - seconds follow in the CLOSING phase (spacing ≥4 satisfied by
 *     construction: first ≤ 11, closing starts ≥ 13), so no adaptive utility
 *     slot is ever displaced and completion is guaranteed under natural
 *     termination without extending the adaptive phase.
 * Returns null when the window has passed, both non-anchor firsts are
 * served, or the session is not a clean 9-anchor prefix (e.g. a skip
 * occurred) — in those cases the unstarted pairs are simply deferred.
 */
export function selectConsistencyFirstMember(
  questionHistory: AnsweredQuestion[],
  answeredQuestionIds: Set<string>,
  skippedQuestionIds: Set<string>,
  anchorsAnswered: number,
  hardMaxQuestions: number
): AdaptiveQuestion | null {
  const questionCount = answeredQuestionIds.size;
  // Cutoff guard (AC-2.1): never start a pair past question hardMax−5.
  if (questionCount + 1 > hardMaxQuestions - CONSISTENCY_FIRST_MEMBER_CUTOFF_OFFSET) return null;
  // Window: the full 9-anchor baseline just completed with nothing else
  // interleaved — positions 10 and 11 exactly.
  if (anchorsAnswered !== 9) return null;
  const injectableFirsts = CONSISTENCY_PAIRS.filter(
    (p) => !ANCHOR_QUESTION_IDS.includes(p.firstQuestionId)
  );
  const injectedCount = injectableFirsts.filter((p) =>
    answeredQuestionIds.has(p.firstQuestionId)
  ).length;
  if (injectedCount >= injectableFirsts.length) return null;
  if (questionCount !== 9 + injectedCount) return null;
  const pair = injectableFirsts[injectedCount];
  const question = getQuestionById(pair.firstQuestionId);
  if (!question) return null;
  if (answeredQuestionIds.has(question.id) || skippedQuestionIds.has(question.id)) return null;
  return question;
}

/**
 * The pair whose SECOND member is due now, if any: first member answered,
 * second not yet answered, and serving it at the next position respects the
 * ≥ CONSISTENCY_PAIR_MIN_SPACING gap. Pairs are checked in registry order.
 * Used by the closing-phase completion fallback (the only place seconds are
 * served): the flag-on geometry guarantees spacing there (firsts ≤ 11,
 * closing starts ≥ 13, seconds serve in registry order), and this guard
 * keeps that invariant enforced rather than assumed — a pair whose spacing
 * is not satisfiable is deferred, never served early.
 */
export function selectConsistencySecondMember(
  questionHistory: AnsweredQuestion[],
  answeredQuestionIds: Set<string>,
  skippedQuestionIds: Set<string>
): AdaptiveQuestion | null {
  const nextPosition = answeredQuestionIds.size + 1;
  const statuses = getConsistencyPairStatus(questionHistory);
  for (const status of statuses) {
    if (status.state !== 'pending') continue;
    if (nextPosition - status.firstPosition < CONSISTENCY_PAIR_MIN_SPACING) {
      continue;
    }
    const pair = CONSISTENCY_PAIRS.find((p) => p.id === status.pairId)!;
    const question = getQuestionById(pair.secondQuestionId);
    if (!question) continue;
    if (answeredQuestionIds.has(question.id) || skippedQuestionIds.has(question.id)) continue;
    return question;
  }
  return null;
}

/** Count of pairs started but not yet completed (for closing bookkeeping). */
export function countPendingConsistencyPairs(questionHistory: AnsweredQuestion[]): number {
  return getConsistencyPairStatus(questionHistory).filter((s) => s.state === 'pending').length;
}
