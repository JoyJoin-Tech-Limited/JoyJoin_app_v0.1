/**
 * Monte Carlo group-formation harness — adaptive-engine sessions (arm-specific
 * matcher inputs). Extracted verbatim from run-group-monte-carlo.ts.
 */
import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  isUniversalClosingQuestionId,
  shouldTerminate,
  type EngineState,
} from '../../../packages/shared/src/personality/adaptiveEngine';
import {
  DEFAULT_ASSESSMENT_CONFIG,
  type AssessmentConfig,
  type TraitKey,
} from '../../../packages/shared/src/personality/types';
import { shrinkTraitsTowardNeutral } from '../../../packages/shared/src/personality/traitShrinkage';
import {
  mulberry32,
  streamSeed,
  selectAnswerByTraits,
  selectAnswerAdversarial,
  type AdversarialType,
} from './persona-utils';
import { ALL_TRAITS } from './monte-carlo-constants';
import type { SyntheticRespondent } from './monte-carlo-population';

// ── Engine sessions (arm-specific matcher inputs) ────────────────────

type SessionArm = 'off' | 'on' | 'adv-off' | 'adv-on';

interface SessionProduct {
  /** Archetype the matcher would read from the stored profile. */
  archetype: string;
  secondaryArchetype: string | null;
  /** Raw engine trait estimates (pre-shrinkage). */
  rawTraits: Record<TraitKey, number>;
  /** RAW per-trait engine confidences (pre-shrinkage) — M11 ceiling input. */
  traitConfidences: Record<TraitKey, number>;
  /** REPORTED vector downstream consumers see (shrunken when flag on). */
  reportedTraits: Record<TraitKey, number>;
  meanConfidence: number;
}

function sessionConfig(arm: SessionArm): AssessmentConfig {
  const shrinkageOn = arm === 'on' || arm === 'adv-on';
  const consistencyOn = arm === 'on'; // flags-on arm = consistency + shrinkage (contract AC-9.4)
  return {
    ...DEFAULT_ASSESSMENT_CONFIG,
    useV2Matcher: true,
    enableConsistencyFolding: consistencyOn,
    enableTraitShrinkage: shrinkageOn,
  };
}

/**
 * Adversarial policy for M11 injection: ALWAYS random-clicker. Rationale
 * (documented in traitShrinkage.ts): it is the only Item 7 adversarial arm
 * whose session confidence lands in the shrinkage bite-zone (conf < 0.65,
 * calibrated err rising to 17.57). midpoint-hugger (0.925) and
 * acquiescence-biased (0.949) are consistent-but-biased: the locked AC-7.4
 * ceiling keeps their w ≈ 1, so injecting them would measure nothing.
 */
function adversarialTypeFor(_respondentIndex: number): AdversarialType {
  return 'random-clicker';
}

/**
 * One natural-termination engine session. Mirrors run-recovery-harness.ts
 * runNaturalSession: breaks at the first universal closing question; with
 * consistency folding on, pair second members pending at adaptive termination
 * are served in the closing phase (they feed the engine exactly as production).
 */
function runSession(
  respondent: SyntheticRespondent,
  arm: SessionArm,
  rng: () => number
): SessionProduct {
  let state: EngineState = initializeEngineState(sessionConfig(arm));
  const adversarial = arm === 'adv-off' || arm === 'adv-on';
  const advType = adversarial ? adversarialTypeFor(respondent.index) : null;

  let adaptiveCount = 0;
  while (adaptiveCount < 25) {
    const question = selectNextQuestion(state);
    if (!question || isUniversalClosingQuestionId(question.id)) break;
    const postTermination = shouldTerminate(state);
    const answer = adversarial
      ? selectAnswerAdversarial(question, advType!, respondent.trueTraits, rng)
      : selectAnswerByTraits(question, respondent.trueTraits, 'clean', rng);
    state = processAnswer(state, question, answer);
    if (!postTermination) adaptiveCount++;
  }

  const rawTraits = {} as Record<TraitKey, number>;
  const confidences = {} as Record<TraitKey, number>;
  let confSum = 0;
  for (const trait of ALL_TRAITS) {
    const tc = state.traitConfidences[trait];
    rawTraits[trait] = tc?.score ?? 50;
    confidences[trait] = tc?.confidence ?? 0;
    confSum += confidences[trait];
  }

  const shrinkageOn = arm === 'on' || arm === 'adv-on';
  return {
    archetype: state.currentMatches[0]?.archetype ?? respondent.trueArchetype ?? 'koala',
    secondaryArchetype: state.currentMatches[1]?.archetype ?? null,
    rawTraits,
    traitConfidences: confidences,
    reportedTraits: shrinkageOn ? shrinkTraitsTowardNeutral(rawTraits, confidences) : rawTraits,
    meanConfidence: confSum / ALL_TRAITS.length,
  };
}

/** Memoized per-(respondent, arm) sessions — deterministic via per-stream seeds. */
class SessionStore {
  private cache = new Map<string, SessionProduct>();
  constructor(private seed: number) {}

  get(respondent: SyntheticRespondent, arm: SessionArm): SessionProduct {
    const key = `${respondent.index}:${arm}`;
    let session = this.cache.get(key);
    if (!session) {
      // Paired design for the M11 adversarial arms ONLY: adv-off/adv-on share
      // one RNG stream, so their answer sequences (and question selections) are
      // identical and the ONLY difference is the match-boundary transform —
      // otherwise independent streams confound the reported-vector change with
      // answer randomness. The flags-off/on A/B keeps its per-arm streams so the
      // Item 9 baseline is byte-preserved.
      const pairTag = arm === 'adv-off' || arm === 'adv-on' ? 'session:adv' : `session:${arm}`;
      session = runSession(respondent, arm, mulberry32(streamSeed(this.seed, respondent.index, pairTag)));
      this.cache.set(key, session);
    }
    return session;
  }

  get size(): number {
    return this.cache.size;
  }
}

export type {
  SessionArm,
  SessionProduct,
};

export {
  SessionStore,
};
