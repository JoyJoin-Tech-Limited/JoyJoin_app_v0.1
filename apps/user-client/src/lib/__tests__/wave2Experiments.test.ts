import { describe, it, expect } from "vitest";
import {
  isExperimentEnabled,
  atmosphereFramingEnabled,
  socialGoalReframingEnabled,
  ignitionConfirmationEnabled,
  archetypeWaitingEnabled,
  ENABLE_ATMOSPHERE_FRAMING,
  ENABLE_SOCIAL_GOAL_REFRAMING,
  ENABLE_IGNITION_CONFIRMATION,
  ENABLE_ARCHETYPE_WAITING,
} from "../wave2Experiments";

// ── Tests ─────────────────────────────────────────────────────────────────────
// The vitest environment is 'node' so `window` is not defined.
// `getExpParam()` inside wave2Experiments.ts guards against this with
// `typeof window === "undefined"` and returns null, meaning URL overrides
// are silently skipped and the compile-time flag is the final arbiter.

describe("wave2Experiments — isExperimentEnabled (node env: no URL overrides)", () => {
  it("returns true when compile-time flag is true", () => {
    expect(isExperimentEnabled("atmosphere_framing", true)).toBe(true);
    expect(isExperimentEnabled("social_goal_reframing", true)).toBe(true);
    expect(isExperimentEnabled("ignition_confirmation", true)).toBe(true);
    expect(isExperimentEnabled("archetype_waiting", true)).toBe(true);
  });

  it("returns false when compile-time flag is false", () => {
    expect(isExperimentEnabled("atmosphere_framing", false)).toBe(false);
    expect(isExperimentEnabled("social_goal_reframing", false)).toBe(false);
    expect(isExperimentEnabled("ignition_confirmation", false)).toBe(false);
    expect(isExperimentEnabled("archetype_waiting", false)).toBe(false);
  });
});

describe("wave2Experiments — convenience accessors reflect compile-time flags", () => {
  it("atmosphereFramingEnabled matches ENABLE_ATMOSPHERE_FRAMING", () => {
    expect(atmosphereFramingEnabled()).toBe(ENABLE_ATMOSPHERE_FRAMING);
  });

  it("socialGoalReframingEnabled matches ENABLE_SOCIAL_GOAL_REFRAMING", () => {
    expect(socialGoalReframingEnabled()).toBe(ENABLE_SOCIAL_GOAL_REFRAMING);
  });

  it("ignitionConfirmationEnabled matches ENABLE_IGNITION_CONFIRMATION", () => {
    expect(ignitionConfirmationEnabled()).toBe(ENABLE_IGNITION_CONFIRMATION);
  });

  it("archetypeWaitingEnabled matches ENABLE_ARCHETYPE_WAITING", () => {
    expect(archetypeWaitingEnabled()).toBe(ENABLE_ARCHETYPE_WAITING);
  });

  it("all compile-time flags are boolean", () => {
    expect(typeof ENABLE_ATMOSPHERE_FRAMING).toBe("boolean");
    expect(typeof ENABLE_SOCIAL_GOAL_REFRAMING).toBe("boolean");
    expect(typeof ENABLE_IGNITION_CONFIRMATION).toBe("boolean");
    expect(typeof ENABLE_ARCHETYPE_WAITING).toBe("boolean");
  });
});

