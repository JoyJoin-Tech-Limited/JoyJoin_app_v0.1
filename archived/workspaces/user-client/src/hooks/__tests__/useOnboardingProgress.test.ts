import { describe, expect, it } from "vitest";
import { calculateOnboardingProgress } from "../useOnboardingProgress";
import type { AuthUser } from "../useAuth";

function buildUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    email: null,
    firstName: null,
    lastName: null,
    profileImageUrl: null,
    wechatNickname: null,
    wechatAvatarUrl: null,
    phoneNumber: null,
    displayName: null,
    gender: null,
    currentCity: null,
    hasCompletedPersonalityTest: false,
    hasCompletedInterestsCarousel: false,
    hasSeenProfileReview: false,
    hasSeenGuide: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as AuthUser;
}

describe("calculateOnboardingProgress", () => {
  it("keeps signed-out users at the first active step", () => {
    const progress = calculateOnboardingProgress(undefined);

    expect(progress.steps.personalityTest).toBe(false);
    expect(progress.currentStep).toBe("personality-test");
    expect(progress.progress).toBe(0);
  });

  it("tracks completion flags without reconstructing routing from them", () => {
    const progress = calculateOnboardingProgress(buildUser());

    expect(progress.steps.personalityTest).toBe(false);
    expect(progress.steps.essentialData).toBe(false);
    expect(progress.currentStep).toBe("complete");
    expect(progress.progress).toBe(100);
  });

  it("still prefers server-driven nextStep when present", () => {
    const progress = calculateOnboardingProgress(buildUser({
      hasCompletedPersonalityTest: true,
      profileEssentialComplete: true,
      nextStep: "extended-data",
    }));

    expect(progress.currentStep).toBe("extended-data");
    expect(progress.progress).toBe(50);
  });
});
