/**
 * checkoutSubscriptionUpsellEnabled + preRevealRefundEnabled — registration
 * and /api/auth/user `features` exposure regression tests (2026-10-11).
 *
 * Contract: `.git/.orchestration/sprints/sprint-contract.checkout-subscription-upsell-flags.md`
 *   AC-1  flag registered in FLAG_ENV_MAP with an explicit false default
 *   AC-5  buildAuthUserResponse exposes both flags in the features payload
 *         (preRevealRefundEnabled was previously server-only)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgres://postgres:postgres@127.0.0.1:5432/joyjoin_test";

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

vi.mock("../lib/featureFlags", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/featureFlags")>();
  return {
    ...original,
    getFeatureFlag: mockGetFeatureFlag,
  };
});

const { FLAG_ENV_MAP, DEFAULT_FLAG_VALUES } = await import("../lib/featureFlags");
const { buildAuthUserResponse } = await import("../lib/buildAuthUserResponse");

const mockUser = {
  id: "checkout-upsell-auth-user",
  displayName: "Upsell Tester",
  gender: "male",
  currentCity: "Shenzhen",
  educationLevel: "bachelor",
  industryNicheLabel: "engineering",
  industryCategoryLabel: null,
  hometownRegionCity: "Shenzhen",
  hasCompletedPersonalityTest: true,
  hasCompletedRegistration: true,
  hasCompletedInterestsCarousel: true,
  hasSeenProfileReview: true,
  onboardingCheckpoint: "profile-review",
  primaryArchetype: null,
  secondaryArchetype: null,
  onboardingRestartCount: 0,
};

describe("checkoutSubscriptionUpsellEnabled flag registration (AC-1)", () => {
  it("maps to CHECKOUT_SUBSCRIPTION_UPSELL_ENABLED and defaults to false", () => {
    expect(FLAG_ENV_MAP.checkoutSubscriptionUpsellEnabled).toBe(
      "CHECKOUT_SUBSCRIPTION_UPSELL_ENABLED"
    );
    expect(DEFAULT_FLAG_VALUES.checkoutSubscriptionUpsellEnabled).toBe(false);
  });

  it("keeps preRevealRefundEnabled registered with default false", () => {
    expect(FLAG_ENV_MAP.preRevealRefundEnabled).toBe("PRE_REVEAL_REFUND_ENABLED");
    expect(DEFAULT_FLAG_VALUES.preRevealRefundEnabled).toBe(false);
  });
});

describe("buildAuthUserResponse checkout/cancel flag exposure (AC-5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(mockUser);
    mockGetAssessmentSessionByUser.mockResolvedValue(null);
  });

  it.each([true, false])(
    "exposes checkoutSubscriptionUpsellEnabled=%s in the auth features payload",
    async (flagValue) => {
      mockGetFeatureFlag.mockImplementation(
        async (key: string, defaultValue: boolean) =>
          key === "checkoutSubscriptionUpsellEnabled" ? flagValue : defaultValue
      );

      const response = await buildAuthUserResponse(mockUser.id);

      expect(response).not.toBeNull();
      expect(response?.features?.checkoutSubscriptionUpsellEnabled).toBe(flagValue);
      expect(mockGetFeatureFlag).toHaveBeenCalledWith("checkoutSubscriptionUpsellEnabled", false);
    }
  );

  it.each([true, false])(
    "exposes preRevealRefundEnabled=%s in the auth features payload",
    async (flagValue) => {
      mockGetFeatureFlag.mockImplementation(
        async (key: string, defaultValue: boolean) =>
          key === "preRevealRefundEnabled" ? flagValue : defaultValue
      );

      const response = await buildAuthUserResponse(mockUser.id);

      expect(response).not.toBeNull();
      expect(response?.features?.preRevealRefundEnabled).toBe(flagValue);
      expect(mockGetFeatureFlag).toHaveBeenCalledWith("preRevealRefundEnabled", false);
    }
  );

  it("defaults both flags to false when unset", async () => {
    mockGetFeatureFlag.mockImplementation(async (_key: string, defaultValue: boolean) => defaultValue);

    const response = await buildAuthUserResponse(mockUser.id);

    expect(response?.features?.checkoutSubscriptionUpsellEnabled).toBe(false);
    expect(response?.features?.preRevealRefundEnabled).toBe(false);
  });
});
