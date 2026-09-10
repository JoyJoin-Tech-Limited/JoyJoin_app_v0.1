/**
 * Plan Item 4 (2026-09-09, contract item4-meta-consistency): end-of-test
 * meta-consistency check behind AssessmentConfig.enableMetaConsistency
 * (default OFF).
 *
 * Locks the contract invariants:
 *  1. Flag-off identity: Q168 is never served, closing bookkeeping is
 *     unchanged, and no metaConsistencyEvaluation is produced.
 *  2. Serving geometry (AC-4.1): flag-on, Q168 is served exactly once as the
 *     LAST closing question (after pair seconds and both universal closing
 *     questions); it never consumes an adaptive slot and the adaptive
 *     sequence prefix is byte-identical to flag-off (natural length
 *     untouched, hardMax untouched).
 *  3. No contamination: the meta answer never feeds trait estimation
 *     (traitScores / sampleCounts / trait scores byte-identical across the
 *     meta answer) — the self-report must not move the estimate it is
 *     compared against.
 *  4. Multiplier mechanics (AC-4.2): discrepancy ≥ 30 multiplies
 *     currentMatches confidence by exactly META_CONSISTENCY_MULTIPLIER (0.8);
 *     discrepancy < 30 changes nothing; trait scores are never touched; the
 *     multiplier composes multiplicatively with Item 2's validity
 *     composition (conf = raw × validity × metaMultiplier).
 *  5. Honest self-report precision: trait-faithful sessions answering the
 *     meta item by nearest bucket to their TRUE profile are not flagged for
 *     the canonical test profiles.
 *  6. Flag matrix (AC-4.5): off/off, on/off, off/on, on/on all behave
 *     sensibly and independently.
 */
import { describe, expect, it } from 'vitest';
import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  shouldTerminate,
  skipQuestion,
  calculateValidityScore,
  getClosingQuestionsRemaining,
  isUniversalClosingQuestionId,
  type EngineState,
} from '../adaptiveEngine';
import {
  META_CONSISTENCY_DISCREPANCY_THRESHOLD,
  META_CONSISTENCY_MULTIPLIER,
  META_CONSISTENCY_QUESTION_ID,
  META_CONSISTENCY_TARGET_TRAIT,
  META_SELF_REPORT_BY_OPTION,
  evaluateMetaConsistency,
  getMetaConsistencySelfReport,
  isMetaConsistencyQuestionId,
} from '../metaConsistency';
import { CONSISTENCY_ONLY_QUESTION_IDS } from '../consistencyPairs';
import { getQuestionById } from '../questionsV4';
import {
  DEFAULT_ASSESSMENT_CONFIG,
  type AdaptiveQuestion,
  type AssessmentConfig,
  type TraitKey,
} from '../types';

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];
const META_ID = META_CONSISTENCY_QUESTION_ID; // 'Q168'

function configFor(metaOn: boolean, consistencyOn: boolean): AssessmentConfig {
  return {
    ...structuredClone(DEFAULT_ASSESSMENT_CONFIG),
    enableMetaConsistency: metaOn,
    enableConsistencyFolding: consistencyOn,
  };
}

/** Deterministic clean-arm answer model: argmax of trait-proportional option score. */
function answerByTraits(question: AdaptiveQuestion, traits: Record<TraitKey, number>): string {
  // Meta item: honest self-report = nearest bucket to the true profile
  // (mirrors scripts/simulate/lib/persona-utils.ts selectMetaConsistencyAnswer).
  if (isMetaConsistencyQuestionId(question.id)) {
    const perceived = traits[META_CONSISTENCY_TARGET_TRAIT];
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

interface SessionResult {
  state: EngineState;
  sequence: string[];
}

function runSession(
  traits: Record<TraitKey, number>,
  metaOn: boolean,
  consistencyOn: boolean,
  maxQuestions = 25
): SessionResult {
  let state = initializeEngineState(configFor(metaOn, consistencyOn));
  const sequence: string[] = [];
  while (sequence.length < maxQuestions) {
    const question = selectNextQuestion(state);
    if (!question) break;
    sequence.push(question.id);
    state = processAnswer(state, question, answerByTraits(question, traits));
  }
  return { state, sequence };
}

const CORGI_TRAITS: Record<TraitKey, number> = { A: 88, C: 55, E: 60, O: 65, X: 95, P: 90 };
const TURTLE_TRAITS: Record<TraitKey, number> = { A: 55, C: 88, E: 78, O: 65, X: 30, P: 60 };

/**
 * Drive the engine with a fixed script that maximizes the target-trait (A)
 * estimate, then answer the meta item with the given bucket. Returns the
 * state after the meta answer. Used to control the estimate/self-report gap
 * deterministically (selector bypassed; processAnswer exercised directly).
 */
function scriptedMetaSession(
  metaOption: string,
  metaOn: boolean,
  consistencyOn: boolean
): { before: EngineState; after: EngineState } {
  const scriptIds = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q150', 'Q137'];
  let state = initializeEngineState(configFor(metaOn, consistencyOn));
  for (const qid of scriptIds) {
    const q = getQuestionById(qid)!;
    // Argmax on the target trait drives its estimate high.
    let best = q.options[0];
    for (const option of q.options) {
      if ((option.traitScores[META_CONSISTENCY_TARGET_TRAIT] ?? 0) >
          (best.traitScores[META_CONSISTENCY_TARGET_TRAIT] ?? 0)) {
        best = option;
      }
    }
    state = processAnswer(state, q, best.value);
  }
  const before = state;
  const metaQuestion = getQuestionById(META_ID)!;
  const after = processAnswer(state, metaQuestion, metaOption);
  return { before, after };
}

describe('Plan Item 4 — meta-consistency check', () => {
  it('unit: self-report mapping, threshold boundary, and multiplier bound', () => {
    expect(META_ID).toBe('Q168');
    expect(META_CONSISTENCY_TARGET_TRAIT).toBe('A');
    expect(getMetaConsistencySelfReport('slider_0')).toBe(10);
    expect(getMetaConsistencySelfReport('slider_100')).toBe(90);
    expect(getMetaConsistencySelfReport('bogus')).toBeNull();
    const metaQuestion = getQuestionById(META_ID)!;
    // Discrepancy exactly at the threshold flags; one point below does not.
    const atBoundary = evaluateMetaConsistency(metaQuestion, 'slider_100', 90 - META_CONSISTENCY_DISCREPANCY_THRESHOLD);
    expect(atBoundary!.flagged).toBe(true);
    expect(atBoundary!.multiplier).toBe(META_CONSISTENCY_MULTIPLIER);
    const belowBoundary = evaluateMetaConsistency(metaQuestion, 'slider_100', 90 - META_CONSISTENCY_DISCREPANCY_THRESHOLD + 1);
    expect(belowBoundary!.flagged).toBe(false);
    expect(belowBoundary!.multiplier).toBe(1);
    // The multiplier is bounded: a single fixed factor ≤ ×0.8, never zero.
    expect(META_CONSISTENCY_MULTIPLIER).toBeGreaterThan(0);
    expect(META_CONSISTENCY_MULTIPLIER).toBeLessThanOrEqual(0.8);
    // Unknown questions / unknown options evaluate to null (no mechanic).
    expect(evaluateMetaConsistency(getQuestionById('Q1')!, 'A', 50)).toBeNull();
  });

  it('flag-off identity: Q168 never served, closing bookkeeping unchanged, no evaluation', () => {
    const { state, sequence } = runSession(CORGI_TRAITS, false, false);
    expect(sequence).not.toContain(META_ID);
    expect(sequence.slice(-2)).toEqual(['Q_PLAYFUL_SLIDER', 'Q_PLAYFUL_EMOJI']);
    expect(getClosingQuestionsRemaining(state)).toBe(0);
    expect(state.metaConsistencyEvaluation).toBeUndefined();
    // Session shape untouched: ≤ 16 adaptive + 2 universal closing.
    const adaptive = sequence.filter((id) => !isUniversalClosingQuestionId(id));
    expect(adaptive.length).toBeLessThanOrEqual(DEFAULT_ASSESSMENT_CONFIG.hardMaxQuestions);
  });

  it('serving geometry (AC-4.1): flag-on serves Q168 exactly once, LAST, post-termination', () => {
    const off = runSession(CORGI_TRAITS, false, false);
    const on = runSession(CORGI_TRAITS, true, false);
    expect(on.sequence.filter((id) => id === META_ID)).toHaveLength(1);
    // Last question of the session, after both universals.
    expect(on.sequence[on.sequence.length - 1]).toBe(META_ID);
    expect(on.sequence.slice(-3, -1)).toEqual(['Q_PLAYFUL_SLIDER', 'Q_PLAYFUL_EMOJI']);
    // Never in the adaptive phase: removing Q168 reproduces the flag-off
    // sequence EXACTLY (adaptive prefix byte-identical; hardMax untouched).
    expect(on.sequence.filter((id) => id !== META_ID)).toEqual(off.sequence);
    const adaptive = on.sequence.filter(
      (id) => !isUniversalClosingQuestionId(id) && id !== META_ID
    );
    expect(adaptive.length).toBeLessThanOrEqual(DEFAULT_ASSESSMENT_CONFIG.hardMaxQuestions);
    // Engine telemetry sink populated.
    expect(on.state.metaConsistencyEvaluation).toBeDefined();
    expect(on.state.metaConsistencyEvaluation!.questionId).toBe(META_ID);
    // Closing bookkeeping counts the meta item until answered.
    expect(getClosingQuestionsRemaining(on.state)).toBe(0);
    // The zero-evidence meta answer is excluded from validity Check 1's
    // denominator (and moves no other validity term): validityScore is
    // byte-identical to the flag-off session. This is what keeps the locked
    // AC-7.3a/b acquiescence baselines stable under the flag.
    expect(calculateValidityScore(on.state)).toBeCloseTo(calculateValidityScore(off.state), 12);
  });

  it('no contamination: the meta answer never feeds trait estimation', () => {
    const { before, after } = scriptedMetaSession('slider_0', true, false);
    for (const trait of ALL_TRAITS) {
      expect(after.traitScores[trait]).toBeCloseTo(before.traitScores[trait], 12);
      expect(after.traitSampleCounts[trait]).toBe(before.traitSampleCounts[trait]);
      expect(after.traitConfidences[trait].score).toBeCloseTo(before.traitConfidences[trait].score, 12);
      expect(after.traitScoreHistory[trait]).toEqual(before.traitScoreHistory[trait]);
    }
  });

  it('multiplier mechanics (AC-4.2): flagged session scaled by exactly ×0.8, unflagged untouched', () => {
    // Estimate is driven high on A by the script; slider_0 self-reports 10
    // (discrepancy ≫ 30 → flagged), slider_100 self-reports 90 (≈ estimate →
    // unflagged). History is identical up to the meta answer, so the raw
    // matcher output is identical across the two runs.
    const flagged = scriptedMetaSession('slider_0', true, false);
    const unflagged = scriptedMetaSession('slider_100', true, false);
    const flaggedEval = flagged.after.metaConsistencyEvaluation!;
    const unflaggedEval = unflagged.after.metaConsistencyEvaluation!;
    expect(flaggedEval.discrepancy).toBeGreaterThanOrEqual(META_CONSISTENCY_DISCREPANCY_THRESHOLD);
    expect(flaggedEval.flagged).toBe(true);
    expect(unflaggedEval.flagged).toBe(false);
    // Confidence: flagged = unflagged × 0.8 per match, clamped to [0, 1].
    expect(flagged.after.currentMatches.length).toBe(unflagged.after.currentMatches.length);
    for (let i = 0; i < flagged.after.currentMatches.length; i++) {
      const expected = Math.max(
        0,
        Math.min(1, unflagged.after.currentMatches[i].confidence * META_CONSISTENCY_MULTIPLIER)
      );
      expect(flagged.after.currentMatches[i].confidence).toBeCloseTo(expected, 12);
      // Match ORDER and scores are untouched — only confidence moved.
      expect(flagged.after.currentMatches[i].archetype).toBe(unflagged.after.currentMatches[i].archetype);
      expect(flagged.after.currentMatches[i].score).toBeCloseTo(unflagged.after.currentMatches[i].score, 12);
    }
    // Trait scores never touched by the mechanic.
    for (const trait of ALL_TRAITS) {
      expect(flagged.after.traitConfidences[trait].score).toBeCloseTo(
        unflagged.after.traitConfidences[trait].score,
        12
      );
    }
  });

  it('composition with Item 2 (on/on): conf = raw × validity × metaMultiplier', () => {
    const { before, after } = scriptedMetaSession('slider_0', true, true);
    const evaluation = after.metaConsistencyEvaluation!;
    expect(evaluation.flagged).toBe(true);
    // lastRawMatches holds the pre-composition matcher output (Item 2); the
    // final confidence must equal raw × validity × metaMultiplier exactly.
    const raw = after.lastRawMatches!;
    expect(raw.length).toBe(after.currentMatches.length);
    const validity = calculateValidityScore(after);
    for (let i = 0; i < raw.length; i++) {
      const expected = Math.max(
        0,
        Math.min(1, raw[i].confidence * validity * META_CONSISTENCY_MULTIPLIER)
      );
      expect(after.currentMatches[i].confidence).toBeCloseTo(expected, 12);
    }
    // The pre-answer state's validity equals the post-answer validity here
    // (zero-loading meta answer moves no validity term) — documented behavior.
    expect(calculateValidityScore(before)).toBeCloseTo(validity, 12);
  });

  it('honest self-report precision: trait-faithful sessions are not flagged', () => {
    for (const traits of [CORGI_TRAITS, TURTLE_TRAITS]) {
      const { state } = runSession(traits, true, false);
      const evaluation = state.metaConsistencyEvaluation!;
      expect(evaluation).toBeDefined();
      expect(evaluation.flagged).toBe(false);
      expect(evaluation.multiplier).toBe(1);
    }
  });

  it('adaptive pool + skip path never surface Q168 (both flag states)', () => {
    for (const metaOn of [false, true]) {
      let state = initializeEngineState(configFor(metaOn, false));
      // Walk into the adaptive phase (9 anchors + a couple of utility picks).
      const filler = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q150', 'Q10', 'Q11'];
      for (const qid of filler) {
        const q = getQuestionById(qid)!;
        state = processAnswer(state, q, q.options[0].value);
      }
      const current = selectNextQuestion(state);
      if (current) {
        expect(isMetaConsistencyQuestionId(current.id)).toBe(false);
        const skipped = skipQuestion(state, current.id);
        if (skipped?.newQuestion) {
          expect(isMetaConsistencyQuestionId(skipped.newQuestion.id)).toBe(false);
        }
      }
    }
  });

  it('flag matrix (AC-4.5): off/off, on/off, off/on, on/on all behave sensibly', () => {
    const offOff = runSession(CORGI_TRAITS, false, false);
    const onOff = runSession(CORGI_TRAITS, true, false);
    const offOn = runSession(CORGI_TRAITS, false, true);
    const onOn = runSession(CORGI_TRAITS, true, true);

    // off/off: no meta, no pair scheduling.
    expect(offOff.sequence).not.toContain(META_ID);
    for (const id of CONSISTENCY_ONLY_QUESTION_IDS) expect(offOff.sequence).not.toContain(id);
    expect(offOff.state.metaConsistencyEvaluation).toBeUndefined();

    // on/off: meta served last; NO pair mechanics (Item 2 stays off).
    expect(onOff.sequence[onOff.sequence.length - 1]).toBe(META_ID);
    for (const id of CONSISTENCY_ONLY_QUESTION_IDS) expect(onOff.sequence).not.toContain(id);
    expect(onOff.state.metaConsistencyEvaluation).toBeDefined();
    expect(onOff.state.lastRawMatches).toBeUndefined(); // composition is Item-2-only
    // With the meta flag on but consistency off, confidence moves ONLY via
    // the meta multiplier: on/off final conf = off/off conf × metaMultiplier.
    const metaMult = onOff.state.metaConsistencyEvaluation!.multiplier;
    expect(onOff.state.currentMatches[0].confidence).toBeCloseTo(
      Math.max(0, Math.min(1, offOff.state.currentMatches[0].confidence * metaMult)),
      12
    );

    // off/on: pair mechanics active; meta absent.
    expect(offOn.sequence).not.toContain(META_ID);
    expect(offOn.state.metaConsistencyEvaluation).toBeUndefined();
    expect(offOn.state.lastRawMatches).toBeDefined(); // Item 2 composition active

    // on/on: both mechanics active and composed; meta still served last.
    expect(onOn.sequence[onOn.sequence.length - 1]).toBe(META_ID);
    expect(onOn.state.metaConsistencyEvaluation).toBeDefined();
    expect(onOn.state.lastRawMatches).toBeDefined();
    // Exact composition identity on the top match:
    // conf = raw × validity × metaMultiplier.
    const rawTop = onOn.state.lastRawMatches![0].confidence;
    const validity = calculateValidityScore(onOn.state);
    const mult = onOn.state.metaConsistencyEvaluation!.multiplier;
    expect(onOn.state.currentMatches[0].confidence).toBeCloseTo(
      Math.max(0, Math.min(1, rawTop * validity * mult)),
      12
    );

    // All four sessions terminate naturally within the safety envelope.
    for (const run of [offOff, onOff, offOn, onOn]) {
      expect(shouldTerminate(run.state)).toBe(true);
      expect(run.sequence.length).toBeLessThanOrEqual(25);
      expect(getClosingQuestionsRemaining(run.state)).toBe(0);
    }
  });

  it('termination geometry: meta-on never changes when a session ends', () => {
    // The adaptive prefix (everything before the closing phase) must be
    // identical across the meta flag states given identical answers.
    const off = runSession(TURTLE_TRAITS, false, false);
    const on = runSession(TURTLE_TRAITS, true, false);
    const closingStartOff = off.sequence.findIndex((id) => isUniversalClosingQuestionId(id));
    const closingStartOn = on.sequence.findIndex((id) => isUniversalClosingQuestionId(id));
    expect(closingStartOn).toBe(closingStartOff);
    expect(on.sequence.slice(0, closingStartOn)).toEqual(off.sequence.slice(0, closingStartOff));
  });
});
