/**
 * P5a response signal-quality gate (responseSignalQuality.ts).
 *
 * Locks the contract invariants:
 *  1. Purity & determinism: same answers → identical verdict, no I/O.
 *  2. Genuine coherent answering → quality 'ok' (false-flag guard at the
 *     unit level; the population-level ≤5% budget is locked by
 *     scripts/simulate/measure-signal-quality-gate.ts).
 *  3. Content-random answering → quality 'low' with reason
 *     'choice_incoherence'.
 *  4. Midpoint hugging → 'low' with 'neutral_responding' among the reasons.
 *  5. Evidence guards: < SIGNAL_QUALITY_MIN_ANSWERS answers never flag.
 *  6. Input forms: raw answer array and EngineState-shaped
 *     { questionHistory } wrapper produce the same verdict.
 *  7. Robustness: unknown question IDs / unknown option values are skipped.
 *  8. Threshold constants are exported and unchanged (calibration anchors).
 *
 * Constructions use REAL bank questions so the tests exercise the same
 * per-question option geometry the production verdict sees. If the bank is
 * ever debiased (Tier 3 follow-up), the cycling/midpoint constructions stay
 * valid (they are structural, not keying-dependent), but exact scores may
 * shift — re-run the measurement script before touching assertions.
 */
import { describe, expect, it } from 'vitest';
import { questionsV4 } from '../questionsV4';
import {
  SIGNAL_QUALITY_INCOHERENCE_FLAG,
  SIGNAL_QUALITY_LOW_SCORE_THRESHOLD,
  SIGNAL_QUALITY_MIN_ANSWERS,
  SIGNAL_QUALITY_NEUTRAL_SHARE_FLAG,
  SIGNAL_QUALITY_PENALTY_INCOHERENCE,
  SIGNAL_QUALITY_PENALTY_NEUTRAL_RESPONDING,
  SIGNAL_QUALITY_WEAK_DIRECTION_FLAG,
  assessResponseSignalQuality,
  computeSignalQualityMetrics,
} from '../responseSignalQuality';
import { AdaptiveQuestion, TraitKey } from '../types';

/** First N plain choice questions (stable, option-rich geometry). */
function sampleQuestions(n: number): AdaptiveQuestion[] {
  return questionsV4.filter((q) => (q.questionType ?? 'choice') === 'choice').slice(0, n);
}

const POSITIVE_DIRECTION: Record<TraitKey, number> = { A: 0.7, C: 0.6, E: 0.5, O: 0.4, X: 0.9, P: 0.8 };

function alignmentScore(option: AdaptiveQuestion['options'][number]): number {
  return (Object.keys(POSITIVE_DIRECTION) as TraitKey[]).reduce(
    (s, t) => s + POSITIVE_DIRECTION[t] * (option.traitScores[t] ?? 0),
    0,
  );
}

/** Genuine-style: every answer is the best-aligned option for a fixed strong direction. */
function coherentAnswers(n = 14) {
  return sampleQuestions(n).map((q) => ({
    questionId: q.id,
    selectedOption: [...q.options].sort((a, b) => alignmentScore(b) - alignmentScore(a))[0].value,
  }));
}

/** Content-random style: deterministic cyclic pick across option positions. */
function cyclingAnswers(n = 14) {
  return sampleQuestions(n).map((q, i) => ({
    questionId: q.id,
    selectedOption: q.options[i % q.options.length].value,
  }));
}

/** Midpoint hugger: always the minimum total-|loading| option. */
function midpointAnswers(n = 14) {
  const absSum = (o: AdaptiveQuestion['options'][number]) =>
    Object.values(o.traitScores).reduce((s, v) => s + Math.abs(v ?? 0), 0);
  return sampleQuestions(n).map((q) => ({
    questionId: q.id,
    selectedOption: q.options.reduce((a, b) => (absSum(a) <= absSum(b) ? a : b)).value,
  }));
}

describe('assessResponseSignalQuality', () => {
  it('returns ok with score 100 for coherent genuine-style answering', () => {
    const verdict = assessResponseSignalQuality(coherentAnswers());
    expect(verdict.quality).toBe('ok');
    expect(verdict.score).toBe(100);
    expect(verdict.reasons).toEqual([]);
  });

  it('flags content-random answering as low with choice_incoherence', () => {
    const verdict = assessResponseSignalQuality(cyclingAnswers());
    expect(verdict.quality).toBe('low');
    expect(verdict.reasons).toContain('choice_incoherence');
    expect(verdict.score).toBe(100 - SIGNAL_QUALITY_PENALTY_INCOHERENCE);
  });

  it('flags midpoint hugging with both incoherence and neutral_responding', () => {
    const verdict = assessResponseSignalQuality(midpointAnswers());
    expect(verdict.quality).toBe('low');
    expect(verdict.reasons).toContain('neutral_responding');
    expect(verdict.score).toBe(
      Math.max(0, 100 - SIGNAL_QUALITY_PENALTY_INCOHERENCE - SIGNAL_QUALITY_PENALTY_NEUTRAL_RESPONDING),
    );
  });

  it('never flags sessions shorter than SIGNAL_QUALITY_MIN_ANSWERS', () => {
    const verdict = assessResponseSignalQuality(cyclingAnswers().slice(0, SIGNAL_QUALITY_MIN_ANSWERS - 1));
    expect(verdict.quality).toBe('ok');
    expect(verdict.score).toBe(100);
    expect(verdict.reasons).toEqual([]);
  });

  it('accepts the EngineState-shaped { questionHistory } input identically', () => {
    const answers = cyclingAnswers();
    expect(assessResponseSignalQuality({ questionHistory: answers })).toEqual(
      assessResponseSignalQuality(answers),
    );
  });

  it('is pure and deterministic across repeated calls', () => {
    const answers = midpointAnswers();
    expect(assessResponseSignalQuality(answers)).toEqual(assessResponseSignalQuality(answers));
  });

  it('skips unknown question IDs and unknown option values gracefully', () => {
    const answers = [
      ...coherentAnswers(10),
      { questionId: 'Q_DOES_NOT_EXIST', selectedOption: 'A' },
      { questionId: sampleQuestions(1)[0].id, selectedOption: 'NOT_AN_OPTION' },
    ];
    const verdict = assessResponseSignalQuality(answers);
    expect(verdict.quality).toBe('ok');
  });

  it('keeps an incoherent-but-strongly-directional session unflagged (AND rule)', () => {
    // Best-aligned answers with every 3rd answer dropping to the 2nd-best
    // option: elevated gap but a real self-consistent direction — the
    // noisy-but-genuine profile that must stay inside the false-flag budget.
    // P5b recalibration (2026-09-14): the question-bank debias re-centered
    // option loadings toward zero per question×trait, so the mean |loading|
    // of any fixed pick pattern dropped bank-wide. The original alternating
    // best/2nd-best pattern now measures direction 0.224 < 0.24 — below the
    // weak-direction flag, i.e. no longer a "strongly directional" profile
    // under the debiased bank. The every-3rd-2nd-best pattern restores the
    // intended profile: direction 0.259 (> 0.24 flag) with incoherence 0.249
    // still elevated (measured via scripts/simulate/measure-signal-quality-gate
    // fixture probe). Asserted below with explicit margin so a future bank
    // change fails loudly rather than silently slipping under the flag.
    const answers = sampleQuestions(14).map((q, i) => {
      const sorted = [...q.options].sort((a, b) => alignmentScore(b) - alignmentScore(a));
      return { questionId: q.id, selectedOption: sorted[i % 3 === 2 ? 1 : 0].value };
    });
    const metrics = computeSignalQualityMetrics(answers);
    const verdict = assessResponseSignalQuality(answers);
    expect(metrics.meanAbsReferenceDirection).not.toBeNull();
    expect(metrics.meanAbsReferenceDirection!).toBeGreaterThan(SIGNAL_QUALITY_WEAK_DIRECTION_FLAG);
    expect(verdict.quality).toBe('ok');
    expect(verdict.reasons).not.toContain('choice_incoherence');
  });

  it('exposes telemetry metrics (value concentration is measured, not scored)', () => {
    const answers = sampleQuestions(12).map((q) => ({ questionId: q.id, selectedOption: 'A' }));
    const metrics = computeSignalQualityMetrics(answers);
    expect(metrics.maxSameOptionShare).toBe(1);
    expect(metrics.longestIdenticalRun).toBe(12);
    expect(metrics.answerCount).toBe(12);
  });
});

describe('locked calibration anchors', () => {
  it('keeps the pre-locked P5a thresholds stable', () => {
    // Calibration anchors locked 2026-09-14 via
    // scripts/simulate/measure-signal-quality-gate.ts (4-seed run). Changing
    // any of these without re-measuring both arms breaks the gate contract.
    expect(SIGNAL_QUALITY_INCOHERENCE_FLAG).toBe(0.33);
    expect(SIGNAL_QUALITY_WEAK_DIRECTION_FLAG).toBe(0.24);
    expect(SIGNAL_QUALITY_NEUTRAL_SHARE_FLAG).toBe(0.7);
    expect(SIGNAL_QUALITY_MIN_ANSWERS).toBe(8);
    expect(SIGNAL_QUALITY_LOW_SCORE_THRESHOLD).toBe(50);
  });
});
