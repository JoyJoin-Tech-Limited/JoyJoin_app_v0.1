/**
 * Plan Item 2 (2026-09-09, amended contract): consistency-pair validity
 * mechanics + neutral-responding detector + match-confidence composition,
 * all behind AssessmentConfig.enableConsistencyFolding (default OFF).
 *
 * Locks the contract invariants:
 *  1. Flag-off identity: no pair scheduling, no pair/neutral validity terms,
 *     no confidence fold, no match-confidence composition.
 *  2. Pair scheduling: firsts at positions 7–9 (≤ hardMax−5 cutoff),
 *     seconds ≥4 answered-questions apart, all pairs complete by session end
 *     (closing-phase fallback), all 9 anchors still served.
 *  3. Confidence-only adjustment: trait scores are byte-identical to a
 *     flag-off run given the SAME answers; confidence deltas are bounded ±0.15.
 *  4. Composition-step gating: flag-on currentMatches confidence equals raw
 *     matcher confidence × validityScore; flag-off equals raw.
 *  5. Detector precision: trait-faithful (clean-style) sessions never trip
 *     the neutral detector and never take pair penalties; midpoint-style
 *     sessions always trip it.
 *  6. Cutoff/deferral + skip path: pairs never start past the cutoff, and
 *     the skip path never surfaces a pair member.
 */
import { describe, expect, it } from 'vitest';
import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  skipQuestion,
  calculateValidityScore,
  getClosingQuestionsRemaining,
  isUniversalClosingQuestionId,
  type EngineState,
} from '../adaptiveEngine';
import {
  CONSISTENCY_PAIRS,
  CONSISTENCY_CONFIDENCE_ADJUSTMENT,
  CONSISTENCY_ONLY_QUESTION_IDS,
  CONSISTENCY_PAIR_MIN_SPACING,
  CONSISTENCY_FIRST_MEMBER_CUTOFF_OFFSET,
  NEUTRAL_RESPONSE_PENALTY,
  getConsistencyPairStatus,
  computeNeutralResponseStats,
  computeTraitConfidenceAdjustments,
  isConsistencyPairQuestionId,
  selectConsistencyFirstMember,
} from '../consistencyPairs';
import { questionsV4, getQuestionById, ANCHOR_QUESTION_IDS } from '../questionsV4';
import { findBestMatchingArchetypesV2 } from '../matcherV2';
import {
  DEFAULT_ASSESSMENT_CONFIG,
  type AdaptiveQuestion,
  type AssessmentConfig,
  type TraitKey,
} from '../types';

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

const CONFIG_ON: AssessmentConfig = {
  ...structuredClone(DEFAULT_ASSESSMENT_CONFIG),
  enableConsistencyFolding: true,
};

/** Deterministic clean-arm answer model: argmax of trait-proportional option score. */
function answerByTraits(question: AdaptiveQuestion, traits: Record<TraitKey, number>): string {
  let bestValue = question.options[0].value;
  let bestScore = -Infinity;
  for (const option of question.options) {
    let score = 0;
    for (const trait of ALL_TRAITS) {
      score += (option.traitScores[trait] ?? 0) * ((traits[trait] - 50) / 50);
    }
    if (score > bestScore) {
      bestScore = score;
      bestValue = option.value;
    }
  }
  return bestValue;
}

/** Midpoint-hugger answer model: argmin total absolute loading. */
function answerMinLoading(question: AdaptiveQuestion): string {
  let bestValue = question.options[0].value;
  let bestSum = Infinity;
  for (const option of question.options) {
    const sum = Object.values(option.traitScores).reduce((a, v) => a + Math.abs(v ?? 0), 0);
    if (sum < bestSum) {
      bestSum = sum;
      bestValue = option.value;
    }
  }
  return bestValue;
}

interface SessionResult {
  state: EngineState;
  sequence: string[];
}

function runSession(
  traits: Record<TraitKey, number>,
  consistencyOn: boolean,
  answerFn: (q: AdaptiveQuestion) => string = (q) => answerByTraits(q, traits),
  maxQuestions = 25
): SessionResult {
  let state = initializeEngineState({
    ...structuredClone(DEFAULT_ASSESSMENT_CONFIG),
    enableConsistencyFolding: consistencyOn,
  });
  const sequence: string[] = [];
  while (sequence.length < maxQuestions) {
    const question = selectNextQuestion(state);
    if (!question) break;
    sequence.push(question.id);
    state = processAnswer(state, question, answerFn(question));
  }
  return { state, sequence };
}

const CORGI_TRAITS: Record<TraitKey, number> = { A: 88, C: 55, E: 60, O: 65, X: 95, P: 90 };
const TURTLE_TRAITS: Record<TraitKey, number> = { A: 55, C: 88, E: 78, O: 65, X: 30, P: 60 };

describe('Plan Item 2 — consistency folding', () => {
  it('flag-off identity: no pair scheduling, no pair/neutral validity terms, no composition', () => {
    const { state, sequence } = runSession(CORGI_TRAITS, false);
    // The authored Plan-Item-2 items (Q166/Q167) must be invisible to the
    // flag-off selector — they did not exist before, so this is what
    // preserves byte-identity. Pre-existing pair members (Q150 anchor,
    // Q53_PureC/Q52_PureO calibration, Q147) may still appear via their
    // ordinary flag-off paths.
    for (const id of CONSISTENCY_ONLY_QUESTION_IDS) {
      expect(sequence).not.toContain(id);
    }
    // Validity equals the legacy two-check score exactly.
    const history = state.questionHistory;
    const optionCounts: Record<string, number> = {};
    for (const a of history) optionCounts[a.selectedOption] = (optionCounts[a.selectedOption] ?? 0) + 1;
    const maxShare = Math.max(...Object.values(optionCounts)) / history.length;
    const traitValues = ALL_TRAITS.map((t) => state.traitConfidences[t].score);
    const mean = traitValues.reduce((a, b) => a + b, 0) / traitValues.length;
    const stdev = Math.sqrt(traitValues.reduce((s, v) => s + (v - mean) ** 2, 0) / traitValues.length);
    let legacy = 1;
    if (maxShare > 0.7) legacy -= 0.25;
    if (stdev < 8) legacy -= 0.2;
    expect(calculateValidityScore(state)).toBeCloseTo(Math.max(0, Math.min(1, legacy)), 12);
    // Closing bookkeeping unchanged: only universal closing questions count.
    expect(getClosingQuestionsRemaining(state)).toBe(0);
    // The session shape is untouched: ≤ 16 adaptive + 2 universal closing.
    const adaptive = sequence.filter((id) => !isUniversalClosingQuestionId(id));
    expect(adaptive.length).toBeLessThanOrEqual(DEFAULT_ASSESSMENT_CONFIG.hardMaxQuestions);
    expect(sequence.slice(-2)).toEqual(['Q_PLAYFUL_SLIDER', 'Q_PLAYFUL_EMOJI']);
  });

  it('pair scheduling: anchor first at 9, injected firsts at 10–11, seconds ≥4 apart, all pairs complete', () => {
    const { state, sequence } = runSession(CORGI_TRAITS, true);
    const statuses = getConsistencyPairStatus(state.questionHistory);
    // All three pairs started and completed.
    expect(statuses.map((s) => s.state)).toEqual(['complete', 'complete', 'complete']);
    // CP1's first is the anchor Q150 (position 9, served by the ordinary
    // anchor phase); CP2/CP3 firsts are injected at positions 10/11 —
    // always ≤ hardMax − 5 (AC-2.1 cutoff).
    const cutoff = DEFAULT_ASSESSMENT_CONFIG.hardMaxQuestions - CONSISTENCY_FIRST_MEMBER_CUTOFF_OFFSET;
    expect(statuses.map((s) => s.firstPosition)).toEqual([9, 10, 11]);
    for (const s of statuses) {
      expect(s.firstPosition).toBeLessThanOrEqual(cutoff);
      expect(s.secondPosition - s.firstPosition).toBeGreaterThanOrEqual(CONSISTENCY_PAIR_MIN_SPACING);
    }
    // All 9 anchors are still served.
    const answeredAnchors = ANCHOR_QUESTION_IDS.filter((id) => sequence.includes(id));
    expect(answeredAnchors).toHaveLength(9);
    // Pair members appear exactly once each.
    for (const pair of CONSISTENCY_PAIRS) {
      expect(sequence.filter((id) => id === pair.firstQuestionId)).toHaveLength(1);
      expect(sequence.filter((id) => id === pair.secondQuestionId)).toHaveLength(1);
    }
  });

  it('seconds fall back to the closing phase in minimum-length sessions (completion guarantee)', () => {
    // Construct a state where the session terminates at the natural minimum:
    // drive the selector until shouldTerminate fires, then verify pending
    // seconds are served before the universal closing questions.
    const traits = CORGI_TRAITS;
    let state = initializeEngineState(CONFIG_ON);
    const seq: string[] = [];
    // Answer until the engine enters its closing phase.
    while (seq.length < 25) {
      const q = selectNextQuestion(state);
      if (!q) break;
      seq.push(q.id);
      state = processAnswer(state, q, answerByTraits(q, traits));
    }
    const statuses = getConsistencyPairStatus(state.questionHistory);
    // Regardless of where seconds were served, every pair completes.
    expect(statuses.every((s) => s.state === 'complete')).toBe(true);
    // And the session still ends with the two universal closing questions.
    expect(seq.slice(-2)).toEqual(['Q_PLAYFUL_SLIDER', 'Q_PLAYFUL_EMOJI']);
  });

  it('confidence-only adjustment: identical answers → identical trait scores; |Δconfidence| ≤ 0.15', () => {
    // Drive processAnswer directly with a FIXED script (bypassing the
    // selector) so flag-on and flag-off see identical answers.
    const script: [string, string][] = [
      ['Q1', 'A'], ['Q2', 'A'], ['Q3', 'B'], ['Q4', 'C'], ['Q5', 'B'],
      ['Q6', 'A'], ['Q150', 'A'], ['Q53_PureC', 'C'], ['Q52_PureO', 'B'], // pair firsts (levels 3/1/2)
      ['Q8', 'D'], ['Q7', 'B'], ['Q147', 'D'], ['Q166', 'A'], ['Q167', 'D'], // pair seconds (levels 0/3/0 → gaps 3/2/2)
    ];
    let off = initializeEngineState({ ...structuredClone(DEFAULT_ASSESSMENT_CONFIG) });
    let on = initializeEngineState(CONFIG_ON);
    for (const [qid, opt] of script) {
      const q = getQuestionById(qid)!;
      off = processAnswer(off, q, opt);
      on = processAnswer(on, q, opt);
    }
    for (const trait of ALL_TRAITS) {
      // Trait scores are NEVER adjusted.
      expect(on.traitConfidences[trait].score).toBeCloseTo(off.traitConfidences[trait].score, 12);
      expect(on.traitScores[trait]).toBeCloseTo(off.traitScores[trait], 12);
      const delta = on.traitConfidences[trait].confidence - off.traitConfidences[trait].confidence;
      expect(Math.abs(delta)).toBeLessThanOrEqual(CONSISTENCY_CONFIDENCE_ADJUSTMENT + 1e-12);
    }
    // All three pairs completed with mismatches → E, C, O each −0.15.
    const adjustments = computeTraitConfidenceAdjustments(on.questionHistory);
    expect(adjustments.E).toBeCloseTo(-CONSISTENCY_CONFIDENCE_ADJUSTMENT, 12);
    expect(adjustments.C).toBeCloseTo(-CONSISTENCY_CONFIDENCE_ADJUSTMENT, 12);
    expect(adjustments.O).toBeCloseTo(-CONSISTENCY_CONFIDENCE_ADJUSTMENT, 12);
    // Validity drops flag-on via pair penalties (level gaps 3, 2, 2 → all
    // opposite-pole → 3 × 0.20).
    const vOff = calculateValidityScore(off);
    const vOn = calculateValidityScore(on);
    expect(vOn).toBeCloseTo(vOff - 0.6, 12);
  });

  it('composition-step gating: flag-on match confidence = raw × validity; flag-off = raw', () => {
    const script: [string, string][] = [
      ['Q1', 'A'], ['Q2', 'A'], ['Q3', 'B'], ['Q4', 'C'], ['Q5', 'B'],
      ['Q6', 'A'], ['Q7', 'A'], ['Q8', 'D'], ['Q150', 'B'], ['Q137', 'A'],
    ];
    let off = initializeEngineState({ ...structuredClone(DEFAULT_ASSESSMENT_CONFIG) });
    let on = initializeEngineState(CONFIG_ON);
    for (const [qid, opt] of script) {
      const q = getQuestionById(qid)!;
      off = processAnswer(off, q, opt);
      on = processAnswer(on, q, opt);
    }
    const traits = {} as Record<TraitKey, number>;
    for (const t of ALL_TRAITS) traits[t] = off.traitConfidences[t].score;
    const raw = findBestMatchingArchetypesV2(traits, undefined, 12);
    // Flag-off: currentMatches confidence equals the raw matcher confidence
    // (modulo the drift-correction promotion, which this profile does not trip).
    expect(off.currentMatches[0].archetype).toBe(raw[0].archetype);
    expect(off.currentMatches[0].confidence).toBeCloseTo(raw[0].confidence, 12);
    // Flag-on: identical trait scores here (same answers) → same raw match;
    // composed confidence = raw × validityScore. Here all answers are
    // high-pole and consistent, so the only flag-on validity terms could be
    // the legacy checks; assert the multiplicative identity exactly.
    const validity = calculateValidityScore({ ...on });
    expect(on.currentMatches[0].confidence).toBeCloseTo(
      Math.max(0, Math.min(1, off.currentMatches[0].confidence * validity)),
      12
    );
  });

  it('detector precision: trait-faithful sessions never trip neutral detector or pair penalties', () => {
    for (const traits of [CORGI_TRAITS, TURTLE_TRAITS]) {
      const { state } = runSession(traits, true);
      const neutral = computeNeutralResponseStats(state.questionHistory);
      expect(neutral.fired).toBe(false);
      // Deterministic argmax over identical graded structures ⇒ exact agreement.
      const statuses = getConsistencyPairStatus(state.questionHistory);
      expect(statuses.every((s) => s.state === 'complete' && s.levelGap === 0)).toBe(true);
      expect(statuses.every((s) => s.validityPenalty === 0)).toBe(true);
    }
  });

  it('midpoint-style sessions always trip the neutral detector (flag-on)', () => {
    const { state } = runSession(CORGI_TRAITS, true, answerMinLoading);
    const neutral = computeNeutralResponseStats(state.questionHistory);
    expect(neutral.share).toBeGreaterThan(0.7);
    expect(neutral.fired).toBe(true);
    // Validity carries the neutral penalty (plus any legacy checks).
    const offState = runSession(CORGI_TRAITS, false, answerMinLoading).state;
    expect(calculateValidityScore(state)).toBeLessThanOrEqual(
      calculateValidityScore(offState) - NEUTRAL_RESPONSE_PENALTY + 1e-12
    );
    // Composed match confidence is scaled down (AC-2.2b).
    const rawConf = offState.currentMatches[0]?.confidence ?? 0;
    expect(state.currentMatches[0]?.confidence ?? 1).toBeLessThan(rawConf);
  });

  it('cutoff/deferral: pairs never start past question hardMax−5', () => {
    // Unit-level: the first-member injector returns null past the cutoff.
    const pastCutoff = initializeEngineState(CONFIG_ON);
    const fillerIds = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10', 'Q11', 'Q12'];
    let state = pastCutoff;
    for (const qid of fillerIds) {
      const q = getQuestionById(qid)!;
      state = processAnswer(state, q, q.options[0].value);
    }
    expect(
      selectConsistencyFirstMember(
        state.questionHistory,
        state.answeredQuestionIds,
        state.skippedQuestionIds,
        8, // Q150 never answered → 8 anchors
        state.config.hardMaxQuestions
      )
    ).toBeNull();
    // Integration: the selector as a whole must not surface any pair member
    // here (no injection window, calibration phase skips pair members flag-on,
    // utility/alternative pools exclude them, no pair was started so the
    // closing fallback has nothing to complete).
    const next = selectNextQuestion(state);
    if (next) {
      expect(isConsistencyPairQuestionId(next.id)).toBe(false);
    }
  });

  it('skip path never surfaces a pair member (spacing respected by exclusion)', () => {
    let state = initializeEngineState(CONFIG_ON);
    // Walk into the adaptive phase (past the injection window).
    const filler = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q150'];
    for (const qid of filler) {
      const q = getQuestionById(qid)!;
      state = processAnswer(state, q, q.options[0].value);
    }
    const current = selectNextQuestion(state)!;
    const skipped = skipQuestion(state, current.id);
    expect(skipped).not.toBeNull();
    if (skipped?.newQuestion) {
      expect(isConsistencyPairQuestionId(skipped.newQuestion.id)).toBe(false);
    }
  });

  it('completion invariant holds across a seeded synthetic batch (≥95%)', () => {
    // 30 deterministic sessions across varied trait profiles, all flag-on:
    // every started pair must complete by session end.
    let started = 0;
    let completed = 0;
    for (let i = 0; i < 30; i++) {
      const traits = {} as Record<TraitKey, number>;
      for (const [j, t] of ALL_TRAITS.entries()) {
        traits[t] = 20 + ((i * 37 + j * 53) % 60);
      }
      const { state } = runSession(traits, true);
      for (const s of getConsistencyPairStatus(state.questionHistory)) {
        if (s.state !== 'not-started') started++;
        if (s.state === 'complete') completed++;
      }
    }
    expect(started).toBeGreaterThan(0);
    expect(completed / started).toBeGreaterThanOrEqual(0.95);
  });
});
