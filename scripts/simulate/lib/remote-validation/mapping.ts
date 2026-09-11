/**
 * ACOEXP↔Big Five convergent-validity mapping.
 *
 * Source of truth for the mapping: `docs/strategy/scientific-foundation.md`
 * §Positioning claim + §Measurement backbone. ACOEXP is a six-trait
 * social-behavior remix of the Five-Factor lineage:
 *
 *   A Affinity            ↔ Agreeableness        (+)
 *   C Conscientiousness   ↔ Conscientiousness    (+)
 *   E Emotional Stability ↔ Emotional Stability  (+)  (IPIP Factor IV)
 *   O Openness            ↔ Openness             (+)  (IPIP Factor V: Intellect/Imagination)
 *   X Extraversion        ↔ Extraversion         (+)  (IPIP Factor I)
 *   P Positivity          → (no Big Five domain) — divergent, exploratory only
 *
 * P has no Big Five conjugate. It is reported as a discriminant/exploratory
 * correlation and is EXCLUDED from the locked convergent gate (r > 0.6), so
 * the gate is not inflated by a self-constructed target.
 */

import type { AcoexpTrait, BigFiveDomain } from './types';
import { ACOEXP_TRAITS, BIG_FIVE_DOMAINS } from './types';

export interface ConvergentPair {
  acoexp: AcoexpTrait;
  bigFive: BigFiveDomain;
  /** Sign applied to the Big Five score so a positive r is always expected. */
  sign: 1 | -1;
  rationale: string;
}

export const CONVERGENT_MAPPING: ConvergentPair[] = [
  { acoexp: 'A', bigFive: 'agreeableness', sign: 1, rationale: 'Affinity is the social-warmth dimension.' },
  { acoexp: 'C', bigFive: 'conscientiousness', sign: 1, rationale: 'Conscientiousness is retained verbatim.' },
  { acoexp: 'E', bigFive: 'emotional_stability', sign: 1, rationale: 'Emotional Stability is retained verbatim (IPIP Factor IV, higher = more stable).' },
  { acoexp: 'O', bigFive: 'openness', sign: 1, rationale: 'Openness is retained verbatim.' },
  { acoexp: 'X', bigFive: 'extraversion', sign: 1, rationale: 'Extraversion is retained verbatim.' },
];

/** Traits with no Big Five conjugate — reported, never gated. */
export const DIVERGENT_TRAITS: Array<{ acoexp: AcoexpTrait; note: string }> = [
  { acoexp: 'P', note: 'Positivity is a JoyJoin-specific positive-affect remix; closest Big Five facet is Extraversion warmth, so its correlation is exploratory.' },
];

/** Traits that participate in the locked convergent gate. */
export const GATED_TRAITS: AcoexpTrait[] = CONVERGENT_MAPPING.map((p) => p.acoexp);

export function isGatedTrait(t: AcoexpTrait): boolean {
  return GATED_TRAITS.includes(t);
}

export function allAcoexpTraits(): AcoexpTrait[] {
  return [...ACOEXP_TRAITS];
}

export function allBigFiveDomains(): BigFiveDomain[] {
  return [...BIG_FIVE_DOMAINS];
}
