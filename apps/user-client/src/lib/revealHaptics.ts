/**
 * revealHaptics.ts
 *
 * Staged haptic feedback helper for the match reveal flow.
 *
 * All functions are no-ops on browsers/devices that do not support the
 * Vibration API — callers never need to guard against unsupported platforms.
 *
 * Design constraints:
 * - One vibration call per distinct reveal stage; never spam.
 * - Patterns are light and restrained to feel premium, not noisy.
 * - Duration budget per stage: ≤150 ms total vibration time.
 */

/** Light tick — used for countdown beats and individual member arrivals. */
export function hapticTick(): void {
  navigator.vibrate?.(10);
}

/** Soft pulse — used for stage transitions (prelude → member entrance). */
export function hapticPulse(): void {
  navigator.vibrate?.(25);
}

/** Double pulse — used for the group formation hero moment. */
export function hapticDoublePulse(): void {
  navigator.vibrate?.([30, 60, 30]);
}

/** Celebration pattern — used once at the chemistry payoff / celebration handoff. */
export function hapticCelebrate(): void {
  navigator.vibrate?.([40, 80, 40, 80, 80]);
}
