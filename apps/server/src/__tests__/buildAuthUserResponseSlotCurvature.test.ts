import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockGetAssessmentSessionByUser = vi.fn();
const mockGetRoleResult = vi.fn();
const mockGetFeatureFlag = vi.fn();

vi.mock("../storage", () => ({
  storage: {
    getUser: mockGetUser,
    getAssessmentSessionByUser: mockGetAssessmentSessionByUser,
    getRoleResult: mockGetRoleResult,
  },
}));

vi.mock("../lib/featureFlags", () => ({
  getFeatureFlag: mockGetFeatureFlag,
}));

const { buildAuthUserResponse } = await import(
  "../lib/buildAuthUserResponse"
);

const mockUser = {
  id: "slot-curvature-auth-user",
  displayName: "Curvature Tester",
  gender: "female",
  currentCity: "Shenzhen",
  educationLevel: "bachelor",
  industryNicheLabel: "design",
  industryCategoryLabel: null,
  hometownRegionCity: "Guangzhou",
  hasCompletedPersonalityTest: true,
  hasCompletedRegistration: true,
  hasCompletedInterestsCarousel: true,
  hasSeenProfileReview: true,
  onboardingCheckpoint: "profile-review",
  primaryArchetype: "corgi",
  secondaryArchetype: null,
  onboardingRestartCount: 0,
};

describe("buildAuthUserResponse personalitySlotCurvatureEnabled exposure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(mockUser);
    mockGetAssessmentSessionByUser.mockResolvedValue(null);
  });

  it.each([true, false])(
    "exposes personalitySlotCurvatureEnabled=%s in the auth features payload",
    async (curvatureEnabled) => {
      mockGetFeatureFlag.mockImplementation(
        async (key: string, defaultValue: boolean) =>
          key === "personalitySlotCurvatureEnabled" ? curvatureEnabled : defaultValue
      );

      const response = await buildAuthUserResponse(mockUser.id);

      expect(response).not.toBeNull();
      expect(response?.features?.personalitySlotCurvatureEnabled).toBe(curvatureEnabled);
      expect(mockGetFeatureFlag).toHaveBeenCalledWith(
        "personalitySlotCurvatureEnabled",
        true
      );
    }
  );

  it("defaults personalitySlotCurvatureEnabled to true when the flag is unset", async () => {
    mockGetFeatureFlag.mockImplementation(
      async (_key: string, defaultValue: boolean) => defaultValue
    );

    const response = await buildAuthUserResponse(mockUser.id);

    expect(response?.features?.personalitySlotCurvatureEnabled).toBe(true);
  });
});
