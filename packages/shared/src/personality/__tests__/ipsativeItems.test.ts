/**
 * Plan Item 1 (2026-09-09): ipsative (equal-SDI forced-choice) items.
 *
 * Locks the contract invariants:
 *  - bank structure (≥12 items, exactly 2 options, SDI pairing ≤10, zero-sum
 *    geometry, −3..+3 range, ≥2 items per rivalry) — mirrors
 *    scripts/simulate/audit-ipsative-sdi.ts so the invariants hold in CI even
 *    if the audit script is not run;
 *  - scoring rule: processAnswer applies the declared option traitScores
 *    verbatim (pole credit +3 / small rival debit −1; rival option mirrored);
 *  - selector gating: with enableIpsativeItems off/absent the engine never
 *    serves an ipsative item (flag-off byte-identity); with the flag on,
 *    ipsative items compete in the utility pool and are actually served.
 */
import { describe, expect, it } from 'vitest';
import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  isUniversalClosingQuestionId,
  type EngineState,
} from '../adaptiveEngine';
import { questionsV4 } from '../questionsV4';
import { questionsV4Ipsative } from '../questionsV4Ipsative';
import { archetypePrototypes } from '../prototypes';
import type { AdaptiveQuestion, AssessmentConfig, TraitKey } from '../types';

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

const IPSATIVE_IDS = new Set(questionsV4Ipsative.map((q) => q.id));

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

/** Forced-16 session (mirrors the recovery harness's forced-stop config). */
function runForcedSession(
  traits: Record<TraitKey, number>,
  configOverrides: Partial<AssessmentConfig>
): EngineState {
  let state = initializeEngineState({
    minQuestions: 16,
    softMaxQuestions: 16,
    hardMaxQuestions: 16,
    defaultConfidenceThreshold: 2,
    confusablePairThreshold: 2,
    enableTieredThreshold: false,
    useV2Matcher: true,
    ...configOverrides,
  });
  while (state.answeredQuestionIds.size < 16) {
    const question = selectNextQuestion(state);
    if (!question || isUniversalClosingQuestionId(question.id)) break;
    state = processAnswer(state, question, answerByTraits(question, traits));
  }
  return state;
}

describe('questionsV4Ipsative bank structure', () => {
  it('contains at least 12 ipsative items with unique ids continuing the bank sequence', () => {
    expect(questionsV4Ipsative.length).toBeGreaterThanOrEqual(12);
    const ids = questionsV4Ipsative.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      const num = parseInt(id.replace('Q', ''), 10);
      expect(num).toBeGreaterThanOrEqual(154);
    }
  });

  it('is aggregated into the questionsV4 bank', () => {
    for (const q of questionsV4Ipsative) {
      expect(questionsV4.find((bank) => bank.id === q.id)).toBeDefined();
    }
  });

  it('every item is a 2-option forced choice with questionType ipsative', () => {
    for (const q of questionsV4Ipsative) {
      expect(q.questionType).toBe('ipsative');
      expect(q.isForcedChoice).toBe(true);
      expect(q.options).toHaveLength(2);
      expect(q.primaryTraits).toHaveLength(2);
    }
  });

  it('every option declares SDI 0–100 and each pair satisfies |ΔSDI| ≤ 10', () => {
    for (const q of questionsV4Ipsative) {
      const sdis = q.options.map((o) => o.socialDesirabilityIndex);
      for (const sdi of sdis) {
        expect(sdi).toBeDefined();
        expect(sdi!).toBeGreaterThanOrEqual(0);
        expect(sdi!).toBeLessThanOrEqual(100);
      }
      expect(Math.abs(sdis[0]! - sdis[1]!)).toBeLessThanOrEqual(10);
    }
  });

  it('every option scores both rivalry traits and stays within −3..+3', () => {
    for (const q of questionsV4Ipsative) {
      for (const o of q.options) {
        for (const trait of q.primaryTraits) {
          expect(o.traitScores[trait] ?? 0).not.toBe(0);
        }
        for (const trait of ALL_TRAITS) {
          const s = o.traitScores[trait] ?? 0;
          expect(s).toBeGreaterThanOrEqual(-3);
          expect(s).toBeLessThanOrEqual(3);
        }
      }
    }
  });

  it('zero-sum geometry: option scores sum to 0 on every trait', () => {
    for (const q of questionsV4Ipsative) {
      for (const trait of ALL_TRAITS) {
        const sum = q.options.reduce((acc, o) => acc + (o.traitScores[trait] ?? 0), 0);
        expect(sum).toBe(0);
      }
    }
  });

  it('covers at least 2 items per declared rivalry', () => {
    const counts = new Map<string, number>();
    for (const q of questionsV4Ipsative) {
      const key = [...q.primaryTraits].sort().join('|');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [, count] of counts) {
      expect(count).toBeGreaterThanOrEqual(2);
    }
    // High-value rivalries called out by the contract
    expect(counts.get('A|X') ?? 0).toBeGreaterThanOrEqual(2);
    expect(counts.get('C|P') ?? 0).toBeGreaterThanOrEqual(2);
    expect(counts.get('C|O') ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('WeChat review posture: no banned tokens in any visible copy', () => {
    const banned = ['匹配', '社交', '灵魂', '撮合', 'AI'];
    for (const q of questionsV4Ipsative) {
      const blobs = [q.scenarioText, q.questionText, ...q.options.map((o) => o.text)];
      for (const blob of blobs) {
        for (const token of banned) {
          expect(blob.includes(token)).toBe(false);
        }
      }
    }
  });
});

describe('ipsative scoring rule (zero-sum rival debit, baked into data)', () => {
  it('applying the pole option credits the pole trait and debits the rival', () => {
    const q154 = questionsV4Ipsative.find((q) => q.id === 'Q154')!;
    let state = initializeEngineState();
    state = processAnswer(state, q154, 'A'); // pole option: X credit
    expect(state.traitScores.X).toBe(3);
    expect(state.traitScores.A).toBe(-1);
    expect(state.traitSampleCounts.X).toBe(1);
    expect(state.traitSampleCounts.A).toBe(1);
  });

  it('applying the rival option mirrors the zero-sum geometry', () => {
    const q154 = questionsV4Ipsative.find((q) => q.id === 'Q154')!;
    let state = initializeEngineState();
    state = processAnswer(state, q154, 'B'); // rival option: A pole
    expect(state.traitScores.A).toBe(1);
    expect(state.traitScores.X).toBe(-3);
  });
});

describe('ipsative selector gating (enableIpsativeItems)', () => {
  const corgi = archetypePrototypes.corgi.traitProfile;

  it('flag absent: a forced-16 session never serves an ipsative item', () => {
    const state = runForcedSession(corgi, {});
    expect(state.answeredQuestionIds.size).toBe(16);
    for (const id of state.answeredQuestionIds) {
      expect(IPSATIVE_IDS.has(id)).toBe(false);
    }
  });

  it('flag explicitly false: identical exclusion', () => {
    const state = runForcedSession(corgi, { enableIpsativeItems: false });
    for (const id of state.answeredQuestionIds) {
      expect(IPSATIVE_IDS.has(id)).toBe(false);
    }
  });

  it('flag on: ipsative items compete in the utility pool and get served', () => {
    let totalServed = 0;
    for (const proto of Object.values(archetypePrototypes)) {
      const state = runForcedSession(proto.traitProfile, { enableIpsativeItems: true });
      expect(state.answeredQuestionIds.size).toBe(16);
      totalServed += [...state.answeredQuestionIds].filter((id) => IPSATIVE_IDS.has(id)).length;
    }
    expect(totalServed).toBeGreaterThan(0);
  });

  it('flag on/off sessions stay inside the 8–16 adaptive budget', () => {
    for (const flag of [false, true]) {
      const state = runForcedSession(corgi, { enableIpsativeItems: flag });
      expect(state.answeredQuestionIds.size).toBeLessThanOrEqual(16);
    }
  });
});
