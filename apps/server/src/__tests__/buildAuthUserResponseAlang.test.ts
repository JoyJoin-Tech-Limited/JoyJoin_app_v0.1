import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const originalAppMode = process.env.APP_MODE;
const originalEnableSingleTestMode = process.env.ENABLE_SINGLE_TEST_MODE;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

const mockUser = {
  id: "alang-auth-user",
  displayName: "Alang Tester",
  gender: "male",
  currentCity: "Shanghai",
  educationLevel: "bachelor",
  industryNicheLabel: "software",
  industryCategoryLabel: null,
  hometownRegionCity: "Hangzhou",
  hasCompletedPersonalityTest: true,
  hasCompletedRegistration: true,
  hasCompletedInterestsCarousel: true,
  hasSeenProfileReview: true,
  onboardingCheckpoint: "profile-review",
  primaryArchetype: null,
  secondaryArchetype: null,
  onboardingRestartCount: 0,
};

describe("buildAuthUserResponse Alang feature exposure", () => {
  beforeEach(() => {
    process.env.APP_MODE = "staging";
    process.env.ENABLE_SINGLE_TEST_MODE = "false";
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(mockUser);
    mockGetAssessmentSessionByUser.mockResolvedValue(null);
  });

  afterEach(() => {
    restoreEnv("APP_MODE", originalAppMode);
    restoreEnv("ENABLE_SINGLE_TEST_MODE", originalEnableSingleTestMode);
  });

  it.each([true, false])(
    "returns appMode=production and alangEnabled=%s in staging",
    async (alangEnabled) => {
      mockGetFeatureFlag.mockImplementation(
        async (key: string, defaultValue: boolean) =>
          key === "alangEnabled" ? alangEnabled : defaultValue
      );

      const response = await buildAuthUserResponse(mockUser.id);

      expect(response).not.toBeNull();
      expect(response?.appMode).toBe("production");
      expect(response?.singleTestMode).toBe(false);
      expect(response?.features?.alangEnabled).toBe(alangEnabled);
      expect(mockGetFeatureFlag).toHaveBeenCalledWith("alangEnabled", false);
      expect(mockGetRoleResult).not.toHaveBeenCalled();
    }
  );

  it("exposes explicit single-test mode in staging when enabled", async () => {
    process.env.ENABLE_SINGLE_TEST_MODE = "true";
    mockGetFeatureFlag.mockImplementation(
      async (_key: string, defaultValue: boolean) => defaultValue
    );

    const response = await buildAuthUserResponse(mockUser.id);

    expect(response?.appMode).toBe("test");
    expect(response?.singleTestMode).toBe(true);
  });

  it("fails client debug mode closed in production even when the single-test flag is stale", async () => {
    process.env.APP_MODE = "production";
    process.env.ENABLE_SINGLE_TEST_MODE = "true";
    mockGetFeatureFlag.mockImplementation(
      async (_key: string, defaultValue: boolean) => defaultValue
    );

    const response = await buildAuthUserResponse(mockUser.id);

    expect(response?.appMode).toBe("production");
    expect(response?.singleTestMode).toBe(false);
  });

  it("fails client debug mode closed when APP_MODE is unset", async () => {
    delete process.env.APP_MODE;
    process.env.ENABLE_SINGLE_TEST_MODE = "true";
    mockGetFeatureFlag.mockImplementation(
      async (_key: string, defaultValue: boolean) => defaultValue
    );

    const response = await buildAuthUserResponse(mockUser.id);

    expect(response?.appMode).toBe("production");
    expect(response?.singleTestMode).toBe(false);
  });
});
