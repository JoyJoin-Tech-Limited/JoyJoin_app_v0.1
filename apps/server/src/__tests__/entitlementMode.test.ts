import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Sprint Contract m4-optimistic-registration — AC-1 (server entitlement signal)
//
// buildAuthUserResponse must expose entitlementMode computed EXACTLY like the
// registration gate (lib/entitlement.ts, single source of truth):
//   - subscription exists        → 'subscription' (credit read NOT performed)
//   - availableEventCredits > 0  → 'event_pack'
//   - neither                    → null
//   - APP_MODE=test              → literal 'test' (both reads skipped)
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn();
const mockGetAssessmentSessionByUser = vi.fn();
const mockGetRoleResult = vi.fn();
const mockGetFeatureFlag = vi.fn();
const mockGetUserSubscription = vi.fn();
const mockGetAvailableCreditCount = vi.fn();

vi.mock("../storage", () => ({
  storage: {
    getUser: mockGetUser,
    getAssessmentSessionByUser: mockGetAssessmentSessionByUser,
    getRoleResult: mockGetRoleResult,
    getUserSubscription: mockGetUserSubscription,
  },
}));

vi.mock("../repositories/eventCreditsRepo", () => ({
  eventCreditsRepo: {
    getAvailableCreditCount: mockGetAvailableCreditCount,
  },
}));

vi.mock("../lib/featureFlags", () => ({
  getFeatureFlag: mockGetFeatureFlag,
}));

const { buildAuthUserResponse } = await import("../lib/buildAuthUserResponse");
const { resolveEntitlementMode } = await import("../lib/entitlement");

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
  id: "entitlement-auth-user",
  displayName: "Entitlement Tester",
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

describe("buildAuthUserResponse entitlementMode signal (AC-1)", () => {
  beforeEach(() => {
    process.env.APP_MODE = "staging";
    process.env.ENABLE_SINGLE_TEST_MODE = "false";
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(mockUser);
    mockGetAssessmentSessionByUser.mockResolvedValue(null);
    mockGetUserSubscription.mockResolvedValue(undefined);
    mockGetAvailableCreditCount.mockResolvedValue(0);
    mockGetFeatureFlag.mockImplementation(
      async (_key: string, defaultValue: boolean) => defaultValue
    );
  });

  afterEach(() => {
    restoreEnv("APP_MODE", originalAppMode);
    restoreEnv("ENABLE_SINGLE_TEST_MODE", originalEnableSingleTestMode);
  });

  it("returns 'subscription' when an active subscription exists and skips the credit read", async () => {
    mockGetUserSubscription.mockResolvedValue({ id: "sub-1", status: "active" });

    const response = await buildAuthUserResponse(mockUser.id);

    expect(response?.entitlementMode).toBe("subscription");
    expect(mockGetUserSubscription).toHaveBeenCalledWith(mockUser.id);
    expect(mockGetAvailableCreditCount).not.toHaveBeenCalled();
  });

  it("returns 'event_pack' when availableEventCredits > 0", async () => {
    mockGetAvailableCreditCount.mockResolvedValue(3);

    const response = await buildAuthUserResponse(mockUser.id);

    expect(response?.entitlementMode).toBe("event_pack");
    expect(mockGetUserSubscription).toHaveBeenCalledWith(mockUser.id);
    expect(mockGetAvailableCreditCount).toHaveBeenCalledWith(mockUser.id);
  });

  it("returns null when there is neither subscription nor credits", async () => {
    const response = await buildAuthUserResponse(mockUser.id);

    expect(response?.entitlementMode).toBeNull();
    expect(mockGetUserSubscription).toHaveBeenCalledWith(mockUser.id);
    expect(mockGetAvailableCreditCount).toHaveBeenCalledWith(mockUser.id);
  });

  it("returns literal 'test' in APP_MODE=test and skips both reads", async () => {
    process.env.APP_MODE = "test";

    const response = await buildAuthUserResponse(mockUser.id);

    expect(response?.entitlementMode).toBe("test");
    expect(mockGetUserSubscription).not.toHaveBeenCalled();
    expect(mockGetAvailableCreditCount).not.toHaveBeenCalled();
  });
});

describe("resolveEntitlementMode helper (registration gate 403-value semantics)", () => {
  beforeEach(() => {
    process.env.APP_MODE = "staging";
    vi.clearAllMocks();
    mockGetUserSubscription.mockResolvedValue(undefined);
    mockGetAvailableCreditCount.mockResolvedValue(0);
  });

  afterEach(() => {
    restoreEnv("APP_MODE", originalAppMode);
  });

  it("forces availableEventCredits to 0 for the subscription branch without reading credits", async () => {
    mockGetUserSubscription.mockResolvedValue({ id: "sub-1", status: "active" });

    const result = await resolveEntitlementMode("user-1");

    expect(result).toEqual({ mode: "subscription", availableEventCredits: 0 });
    expect(mockGetAvailableCreditCount).not.toHaveBeenCalled();
  });

  it("surfaces the credit count for the event_pack branch", async () => {
    mockGetAvailableCreditCount.mockResolvedValue(3);

    const result = await resolveEntitlementMode("user-1");

    expect(result).toEqual({ mode: "event_pack", availableEventCredits: 3 });
  });

  it("returns null mode with a zero credit count when neither entitlement exists", async () => {
    const result = await resolveEntitlementMode("user-1");

    expect(result).toEqual({ mode: null, availableEventCredits: 0 });
  });

  it("returns test mode with forced zero credits in APP_MODE=test, skipping both reads", async () => {
    process.env.APP_MODE = "test";

    const result = await resolveEntitlementMode("user-1");

    expect(result).toEqual({ mode: "test", availableEventCredits: 0 });
    expect(mockGetUserSubscription).not.toHaveBeenCalled();
    expect(mockGetAvailableCreditCount).not.toHaveBeenCalled();
  });
});
