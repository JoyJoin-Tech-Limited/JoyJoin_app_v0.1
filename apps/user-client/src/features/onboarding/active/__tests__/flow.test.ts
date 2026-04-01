import { describe, expect, it } from "vitest";
import type { AuthUser } from "@/hooks/useAuth";
import {
  buildOnboardingFlowState,
  getStepRoute,
  nextStepToOnboardingStep,
  nextStepToRoute,
} from "../flow";

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    nextStep: "discover",
    hasCompletedPersonalityTest: true,
    profileEssentialComplete: true,
    hasCompletedInterestsCarousel: true,
    hasSeenProfileReview: true,
    ...overrides,
  } as AuthUser;
}

describe("active onboarding flow", () => {
  it("maps legacy onboarding nextStep to the active personality test step", () => {
    expect(nextStepToOnboardingStep("onboarding")).toBe("personality-test");
    expect(nextStepToRoute("guide")).toBe("/discover");
    expect(nextStepToRoute(undefined)).toBe("/login");
    expect(getStepRoute("profile-review")).toBe("/onboarding/review");
  });

  it("uses server nextStep as the source of truth even when legacy booleans disagree", () => {
    const state = buildOnboardingFlowState(
      makeUser({
        nextStep: "essential-data",
        hasCompletedPersonalityTest: false,
        profileEssentialComplete: false,
        hasCompletedInterestsCarousel: false,
        hasSeenProfileReview: false,
      }),
    );

    expect(state.source).toBe("server-next-step");
    expect(state.currentStep).toBe("essential-data");
    expect(state.currentRoute).toBe("/onboarding/setup");
  });

  it("does not reconstruct active onboarding flow from deprecated booleans when nextStep is missing", () => {
    const state = buildOnboardingFlowState(
      makeUser({
        nextStep: undefined,
        hasCompletedPersonalityTest: false,
        profileEssentialComplete: false,
        hasCompletedInterestsCarousel: false,
        hasSeenProfileReview: false,
      }),
    );

    expect(state.source).toBe("missing-next-step");
    expect(state.currentStep).toBe("complete");
    expect(state.currentRoute).toBe("/login");
  });
});
