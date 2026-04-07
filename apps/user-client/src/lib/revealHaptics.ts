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

/**
 * Safely trigger vibration when the current runtime exposes the Vibration API.
 * Uses `globalThis.navigator` so Node-based tests and non-browser runtimes stay no-op.
 */
function vibrateIfSupported(pattern: number | number[]): void {
  globalThis.navigator?.vibrate?.(pattern);
}

/** Light tick — used for countdown beats and individual member arrivals. */
export function hapticTick(): void {
  vibrateIfSupported(10);
}

/** Soft pulse — used for stage transitions (prelude → member entrance). */
export function hapticPulse(): void {
  vibrateIfSupported(25);
}

/** Double pulse — used for the group formation hero moment. */
export function hapticDoublePulse(): void {
  vibrateIfSupported([30, 60, 30]);
}

/** Celebration pattern — used once at the chemistry payoff / celebration handoff. */
export function hapticCelebrate(): void {
  vibrateIfSupported([40, 80, 40, 80, 70]);
}
