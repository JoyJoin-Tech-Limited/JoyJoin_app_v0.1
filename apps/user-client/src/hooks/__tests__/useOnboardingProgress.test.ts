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
    wechatOpenId: null,
    wechatSessionKey: null,
    wechatNickname: null,
    wechatAvatarUrl: null,
    phoneNumber: null,
    password: null,
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
  it("marks registration complete once an authenticated user exists", () => {
    const progress = calculateOnboardingProgress(buildUser());

    expect(progress.steps.registration).toBe(true);
    expect(progress.steps.personalityTest).toBe(false);
    expect(progress.currentStep).toBe("personality-test");
    expect(progress.progress).toBe(20);
  });

  it("keeps unauthenticated users on the registration step", () => {
    const progress = calculateOnboardingProgress(undefined);

    expect(progress.steps.registration).toBe(false);
    expect(progress.currentStep).toBe("registration");
    expect(progress.progress).toBe(0);
  });

  it("still prefers server-driven nextStep when present", () => {
    const progress = calculateOnboardingProgress(buildUser({
      hasCompletedPersonalityTest: true,
      profileEssentialComplete: true,
      nextStep: "extended-data",
    }));

    expect(progress.currentStep).toBe("extended-data");
    expect(progress.progress).toBe(60);
  });
});
