/**
 * Wave 2 Controlled Experiments
 *
 * All four Wave 2 experiments are gated behind compile-time flags (defaulting to
 * `false` = off) and can be enabled per-session via URL query params for QA /
 * manual testing without touching production users.
 *
 * Experiments:
 *   EXP_ATMOSPHERE_FRAMING     — atmosphere-driven budget framing instead of raw numbers
 *   EXP_SOCIAL_GOAL_REFRAMING  — primary goal + optional secondary goals
 *   EXP_IGNITION_CONFIRMATION  — swipe-to-confirm ritual with accessible button fallback
 *   EXP_ARCHETYPE_WAITING      — archetype-personalised waiting-screen copy
 *
 * URL overrides (per-session, no persistence):
 *   ?exp=atmosphere_on / ?exp=atmosphere_off
 *   ?exp=goal_reframe_on / ?exp=goal_reframe_off
 *   ?exp=ignition_on   / ?exp=ignition_off
 *   ?exp=archetype_wait_on / ?exp=archetype_wait_off
 *
 * Same pattern as ENABLE_LIMITED_BROWSE_MODE in FinalProfileReviewPage.tsx.
 * Do NOT generalise this module or remove flags without confirming experiments
 * are concluded and results reviewed.
 */

// ─── Compile-time flags ───────────────────────────────────────────────────────

/**
 * Exp 1: Replace raw budget numbers with atmosphere-driven framing.
 * Underlying data model is unchanged — budget values are still sent to the API.
 */
export const ENABLE_ATMOSPHERE_FRAMING = true;

/**
 * Exp 2: Reframe social-goal selection as one primary goal + optional secondary goals.
 * Still populates the same `socialGoals[]` array; primary goal is placed first.
 */
export const ENABLE_SOCIAL_GOAL_REFRAMING = true;

/**
 * Exp 3: Swipe-to-confirm (ignition) ritual as final registration mechanic.
 * A plain button fallback is ALWAYS rendered for accessibility.
 */
export const ENABLE_IGNITION_CONFIRMATION = true;

/**
 * Exp 4: Archetype-personalised copy on the matching-waiting screen.
 * Falls back to generic copy when the user's archetype is unknown or the flag
 * is disabled.
 */
export const ENABLE_ARCHETYPE_WAITING = true;

// ─── Per-session URL override helpers ────────────────────────────────────────

type ExperimentKey =
  | "atmosphere_framing"
  | "social_goal_reframing"
  | "ignition_confirmation"
  | "archetype_waiting";

const OVERRIDE_MAP: Record<ExperimentKey, { on: string; off: string }> = {
  atmosphere_framing:   { on: "atmosphere_on",     off: "atmosphere_off" },
  social_goal_reframing: { on: "goal_reframe_on",  off: "goal_reframe_off" },
  ignition_confirmation: { on: "ignition_on",      off: "ignition_off" },
  archetype_waiting:    { on: "archetype_wait_on", off: "archetype_wait_off" },
};

function getExpParam(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search).get("exp");
  } catch {
    return null;
  }
}

/**
 * Returns whether an experiment is currently active, respecting:
 *  1. Per-session URL override (`?exp=<key>_on` / `?exp=<key>_off`)
 *  2. Compile-time flag as final fallback
 */
export function isExperimentEnabled(
  key: ExperimentKey,
  compiletimeFlag: boolean,
): boolean {
  const param = getExpParam();
  if (param === OVERRIDE_MAP[key].on) return true;
  if (param === OVERRIDE_MAP[key].off) return false;
  return compiletimeFlag;
}

// ─── Convenience accessors ────────────────────────────────────────────────────

export function atmosphereFramingEnabled(): boolean {
  return isExperimentEnabled("atmosphere_framing", ENABLE_ATMOSPHERE_FRAMING);
}

export function socialGoalReframingEnabled(): boolean {
  return isExperimentEnabled("social_goal_reframing", ENABLE_SOCIAL_GOAL_REFRAMING);
}

export function ignitionConfirmationEnabled(): boolean {
  return isExperimentEnabled("ignition_confirmation", ENABLE_IGNITION_CONFIRMATION);
}

export function archetypeWaitingEnabled(): boolean {
  return isExperimentEnabled("archetype_waiting", ENABLE_ARCHETYPE_WAITING);
}
