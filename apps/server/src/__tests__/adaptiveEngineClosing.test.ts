/**
 * Tests for universal closing questions (Q_PLAYFUL_SLIDER + Q_PLAYFUL_EMOJI)
 *
 * After the adaptive phase terminates, every V4 session must ask both closing
 * questions exactly once.  These tests verify:
 *   1. Closing questions are served after adaptive termination
 *   2. Closing questions are NOT selected during the adaptive phase
 *   3. `isAssessmentComplete` is false until both questions are answered
 *   4. Pre-answered closing questions are skipped (duplicate prevention)
 *   5. The correct question order is always preserved (SLIDER → EMOJI)
 *   6. `getClosingQuestionsRemaining` tracks pending count correctly
 */

import { describe, expect, it } from 'vitest';
import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  shouldTerminate,
  isAssessmentComplete,
  getClosingQuestionsRemaining,
  UNIVERSAL_CLOSING_QUESTION_IDS,
} from '@shared/personality';
import { questionsV4, getAnchorQuestions } from '@shared/personality';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simulate a full adaptive run by answering anchor + enough extra questions to
 * make `shouldTerminate` return true, WITHOUT answering the closing questions.
 */
function buildTerminatedAdaptiveState() {
  let state = initializeEngineState();

  // Answer all 8 anchor questions with a high-X, high-P option to drive
  // confidence up quickly and reach the termination threshold.
  const anchors = getAnchorQuestions();
  for (const anchor of anchors) {
    // Pick the option with the highest X+P sum (social / extrovert signal)
    const best = anchor.options.reduce((a, b) => {
      const scoreA = (a.traitScores.X ?? 0) + (a.traitScores.P ?? 0);
      const scoreB = (b.traitScores.X ?? 0) + (b.traitScores.P ?? 0);
      return scoreA >= scoreB ? a : b;
    });
    state = processAnswer(state, anchor, best.value);
  }

  // Keep answering adaptive questions until shouldTerminate fires.
  let safety = 0;
  while (!shouldTerminate(state) && safety < 20) {
    safety++;
    const next = selectNextQuestion(state);
    if (!next) break;
    // Closing questions should NOT appear here
    expect(UNIVERSAL_CLOSING_QUESTION_IDS).not.toContain(next.id);
    state = processAnswer(state, next, next.options[0].value);
  }

  return state;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UNIVERSAL_CLOSING_QUESTION_IDS', () => {
  it('contains exactly Q_PLAYFUL_SLIDER and Q_PLAYFUL_EMOJI in that order', () => {
    expect(UNIVERSAL_CLOSING_QUESTION_IDS).toEqual(['Q_PLAYFUL_SLIDER', 'Q_PLAYFUL_EMOJI']);
  });

  it('both IDs exist in questionsV4', () => {
    for (const id of UNIVERSAL_CLOSING_QUESTION_IDS) {
      expect(questionsV4.find(q => q.id === id)).toBeDefined();
    }
  });
});

describe('selectNextQuestion – closing phase', () => {
  it('returns Q_PLAYFUL_SLIDER immediately after adaptive termination', () => {
    const state = buildTerminatedAdaptiveState();
    expect(shouldTerminate(state)).toBe(true);

    const next = selectNextQuestion(state);
    expect(next).not.toBeNull();
    expect(next!.id).toBe('Q_PLAYFUL_SLIDER');
  });

  it('returns Q_PLAYFUL_EMOJI after Q_PLAYFUL_SLIDER is answered', () => {
    let state = buildTerminatedAdaptiveState();

    const slider = questionsV4.find(q => q.id === 'Q_PLAYFUL_SLIDER')!;
    state = processAnswer(state, slider, 'slider_75');

    const next = selectNextQuestion(state);
    expect(next).not.toBeNull();
    expect(next!.id).toBe('Q_PLAYFUL_EMOJI');
  });

  it('returns null after both closing questions are answered', () => {
    let state = buildTerminatedAdaptiveState();

    const slider = questionsV4.find(q => q.id === 'Q_PLAYFUL_SLIDER')!;
    state = processAnswer(state, slider, 'slider_50');

    const emoji = questionsV4.find(q => q.id === 'Q_PLAYFUL_EMOJI')!;
    state = processAnswer(state, emoji, 'dove');

    const next = selectNextQuestion(state);
    expect(next).toBeNull();
  });
});

describe('selectNextQuestion – adaptive phase exclusion', () => {
  it('never returns a closing question during the anchor phase', () => {
    let state = initializeEngineState();
    const anchors = getAnchorQuestions();

    // Answer only half of the anchors — still in anchor phase
    for (let i = 0; i < 4; i++) {
      const next = selectNextQuestion(state);
      expect(next).not.toBeNull();
      expect(UNIVERSAL_CLOSING_QUESTION_IDS).not.toContain(next!.id);
      state = processAnswer(state, next!, next!.options[0].value);
    }
  });

  it('never selects a closing question during adaptive selection (pre-termination)', () => {
    let state = initializeEngineState();
    const anchors = getAnchorQuestions();

    // Answer all anchors
    for (const anchor of anchors) {
      state = processAnswer(state, anchor, anchor.options[0].value);
    }

    // Ask a few more adaptive questions; none should be closing questions
    for (let i = 0; i < 5; i++) {
      if (shouldTerminate(state)) break;
      const next = selectNextQuestion(state);
      if (!next) break;
      expect(UNIVERSAL_CLOSING_QUESTION_IDS).not.toContain(next.id);
      state = processAnswer(state, next, next.options[0].value);
    }
  });
});

describe('isAssessmentComplete', () => {
  it('is false while adaptive phase is still running', () => {
    const state = initializeEngineState();
    expect(isAssessmentComplete(state)).toBe(false);
  });

  it('is false immediately after adaptive termination (closing not yet answered)', () => {
    const state = buildTerminatedAdaptiveState();
    expect(shouldTerminate(state)).toBe(true);
    expect(isAssessmentComplete(state)).toBe(false);
  });

  it('is false after only Q_PLAYFUL_SLIDER is answered', () => {
    let state = buildTerminatedAdaptiveState();
    const slider = questionsV4.find(q => q.id === 'Q_PLAYFUL_SLIDER')!;
    state = processAnswer(state, slider, 'slider_100');
    expect(isAssessmentComplete(state)).toBe(false);
  });

  it('is true after both closing questions are answered', () => {
    let state = buildTerminatedAdaptiveState();
    const slider = questionsV4.find(q => q.id === 'Q_PLAYFUL_SLIDER')!;
    state = processAnswer(state, slider, 'slider_0');
    const emoji = questionsV4.find(q => q.id === 'Q_PLAYFUL_EMOJI')!;
    state = processAnswer(state, emoji, 'direct');
    expect(isAssessmentComplete(state)).toBe(true);
  });
});

describe('getClosingQuestionsRemaining', () => {
  it('returns 2 after adaptive phase terminates but before any closing question', () => {
    const state = buildTerminatedAdaptiveState();
    expect(getClosingQuestionsRemaining(state)).toBe(2);
  });

  it('returns 1 after Q_PLAYFUL_SLIDER is answered', () => {
    let state = buildTerminatedAdaptiveState();
    const slider = questionsV4.find(q => q.id === 'Q_PLAYFUL_SLIDER')!;
    state = processAnswer(state, slider, 'slider_25');
    expect(getClosingQuestionsRemaining(state)).toBe(1);
  });

  it('returns 0 after both closing questions are answered', () => {
    let state = buildTerminatedAdaptiveState();
    const slider = questionsV4.find(q => q.id === 'Q_PLAYFUL_SLIDER')!;
    state = processAnswer(state, slider, 'slider_75');
    const emoji = questionsV4.find(q => q.id === 'Q_PLAYFUL_EMOJI')!;
    state = processAnswer(state, emoji, 'popcorn');
    expect(getClosingQuestionsRemaining(state)).toBe(0);
  });
});

describe('resume / duplicate-prevention', () => {
  it('skips Q_PLAYFUL_SLIDER and serves Q_PLAYFUL_EMOJI when slider was already answered', () => {
    let state = buildTerminatedAdaptiveState();

    // Simulate that slider was answered in a prior session (already in history)
    const slider = questionsV4.find(q => q.id === 'Q_PLAYFUL_SLIDER')!;
    state = processAnswer(state, slider, 'slider_50');

    const next = selectNextQuestion(state);
    expect(next).not.toBeNull();
    expect(next!.id).toBe('Q_PLAYFUL_EMOJI');
  });

  it('returns null if both closing questions were already answered in prior session', () => {
    let state = buildTerminatedAdaptiveState();
    const slider = questionsV4.find(q => q.id === 'Q_PLAYFUL_SLIDER')!;
    state = processAnswer(state, slider, 'slider_50');
    const emoji = questionsV4.find(q => q.id === 'Q_PLAYFUL_EMOJI')!;
    state = processAnswer(state, emoji, 'dm');

    const next = selectNextQuestion(state);
    expect(next).toBeNull();
    expect(isAssessmentComplete(state)).toBe(true);
  });
});
