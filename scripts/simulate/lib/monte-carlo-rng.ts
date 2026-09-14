/**
 * Monte Carlo group-formation harness — seeded RNG helpers.
 *
 * Extracted verbatim from run-group-monte-carlo.ts (behaviour-preserving).
 */
import { TRAIT_MAX, TRAIT_MIN } from './monte-carlo-constants';

// ── Seeded RNG helpers (mirrors run-recovery-harness.ts exactly) ─────

/** Standard normal via Box-Muller on the seeded stream. */
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Sample Normal(mean, sd) truncated to [TRAIT_MIN, TRAIT_MAX] via rejection (fallback: clamp). */
function sampleTrait(rng: () => number, mean: number, sd: number): number {
  for (let i = 0; i < 100; i++) {
    const v = mean + gaussian(rng) * sd;
    if (v >= TRAIT_MIN && v <= TRAIT_MAX) return v;
  }
  return Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, mean));
}

export {
  gaussian,
  sampleTrait,
};
