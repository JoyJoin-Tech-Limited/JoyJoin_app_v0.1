import { describe, expect, it } from "vitest";
import { nextStepToRoute, resolveOnboardingRoute } from "../useOnboardingRoute";
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

describe("resolveOnboardingRoute", () => {
  it("routes with nextStep when the refreshed auth payload includes it", () => {
    expect(resolveOnboardingRoute(buildUser({ nextStep: "profile-review" }))).toBe("/onboarding/review");
  });

  it("falls back to personality test when the user is authenticated but the test is incomplete", () => {
    expect(resolveOnboardingRoute(buildUser())).toBe("/personality-test");
  });

  it("keeps guide and discover both mapped to discover", () => {
    expect(nextStepToRoute("guide")).toBe("/discover");
    expect(nextStepToRoute("discover")).toBe("/discover");
  });
});
