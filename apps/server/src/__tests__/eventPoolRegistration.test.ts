import { describe, expect, it } from "vitest";

import {
  assertBudgetTierSupplied,
  buildEventPoolRegistrationInsert,
  BudgetTierValidationError,
  isSessionPendingReferralCode,
  resolveOptionalRegistrationAttribution,
} from "../lib/eventPoolRegistration";
import {
  getTiersForEventType,
  LEGACY_BUDGET_LABEL_TO_TIER_ID,
  UNMAPPABLE_BLIND_BOX_BUDGET_LABEL,
} from "@shared/budgetTiers";

describe("event pool registration insert helper", () => {
  it("keeps valid invitation and referral attribution", () => {
    expect(resolveOptionalRegistrationAttribution({
      userId: "invitee",
      now: new Date("2026-07-30T00:00:00.000Z"),
      invitation: {
        id: "invitation-1",
        inviterId: "inviter",
        expiresAt: new Date("2026-07-31T00:00:00.000Z"),
      },
    })).toEqual({
      kind: "invitation",
      invitationId: "invitation-1",
      inviterId: "inviter",
    });

    expect(resolveOptionalRegistrationAttribution({
      userId: "invitee",
      referral: {
        id: "referral-1",
        userId: "referrer",
      },
    })).toEqual({
      kind: "referral",
      referralCodeId: "referral-1",
      inviterId: "referrer",
    });
  });

  it.each([
    {
      name: "expired invitation",
      input: {
        userId: "invitee",
        now: new Date("2026-07-30T00:00:00.000Z"),
        invitation: {
          id: "invitation-1",
          inviterId: "inviter",
          expiresAt: new Date("2026-07-29T00:00:00.000Z"),
        },
      },
      reason: "expired_invitation",
    },
    {
      name: "self invitation",
      input: {
        userId: "same-user",
        invitation: {
          id: "invitation-1",
          inviterId: "same-user",
          expiresAt: null,
        },
      },
      reason: "self_invitation",
    },
    {
      name: "self referral",
      input: {
        userId: "same-user",
        referral: {
          id: "referral-1",
          userId: "same-user",
        },
      },
      reason: "self_referral",
    },
    {
      name: "unknown or stale code",
      input: {
        userId: "invitee",
      },
      reason: "invalid_code",
    },
  ])("discards $name without blocking registration", ({ input, reason }) => {
    expect(resolveOptionalRegistrationAttribution(input)).toEqual({
      kind: "discard",
      reason,
    });
  });

  it("identifies a stale session referral so attribution cannot block registration", () => {
    expect(isSessionPendingReferralCode(" stale-code ", "stale-code")).toBe(true);
    expect(isSessionPendingReferralCode("explicit-code", "different-session-code")).toBe(false);
    expect(isSessionPendingReferralCode("explicit-code", undefined)).toBe(false);
  });

  it("keeps drinks-specific preferences when building insert values", () => {
    // Guards against regression: the registration route used to drop these fields before insert.
    const result = buildEventPoolRegistrationInsert({
      poolId: "pool-123",
      userId: "user-456",
      payload: {
        invitationCode: "  INVITE-789  ",
        preferredLanguages: [" 普通话 ", ""],
        eventIntent: ["交朋友"],
        barBudgetRange: ["80-150"],
        barThemes: [" 清吧 ", "精酿"],
        alcoholComfort: " 微醺就好 ",
      },
    });

    expect(result).toEqual({
      invitationCode: "INVITE-789",
      values: {
        poolId: "pool-123",
        userId: "user-456",
        budgetRange: [],
        preferredLanguages: ["普通话"],
        eventIntent: ["交朋友"],
        cuisinePreferences: [],
        dietaryRestrictions: [],
        tasteIntensity: [],
        barThemes: ["清吧", "精酿"],
        alcoholComfort: ["微醺就好"],
        // L1 write normalization: legacy drinks label is persisted as its
        // canonical 酒局 tier id (sprint-contract.budget-cutover-server-20260916 AC-01).
        barBudgetRange: ["drinks_80_150"],
        preferenceStrictness: 50,
        acceptPairs: true,
        genderCompositionPreference: null,
        preferredDistricts: null,
        kolComfortLevel: null,
      },
    });
  });

  // NOTE (T6-strict): the builder itself stays backward-compatible with an
  // empty payload; required-ness (`min(1)`, decision B5) is enforced one layer
  // up at the route/funnel via `assertBudgetTierSupplied`, because legitimate
  // direct-Drizzle writers omit budget (test-admin, single-test, payment
  // fulfilment). See sprint-contract.budget-t6-strict-20260916 §3.
  it("keeps empty-body registrations backward-compatible", () => {
    const result = buildEventPoolRegistrationInsert({
      poolId: "pool-123",
      userId: "user-456",
    });

    expect(result).toEqual({
      invitationCode: undefined,
      values: {
        poolId: "pool-123",
        userId: "user-456",
        budgetRange: [],
        preferredLanguages: [],
        eventIntent: [],
        cuisinePreferences: [],
        dietaryRestrictions: [],
        tasteIntensity: [],
        barThemes: [],
        alcoholComfort: [],
        barBudgetRange: [],
        preferenceStrictness: 50,
        acceptPairs: true,
        genderCompositionPreference: null,
        preferredDistricts: null,
        kolComfortLevel: null,
      },
    });
  });
});

describe("T6-strict required-budget gate", () => {
  function requiredCode(payload: Parameters<typeof assertBudgetTierSupplied>[0]) {
    try {
      assertBudgetTierSupplied(payload);
    } catch (error) {
      if (error instanceof BudgetTierValidationError) {
        return error.code;
      }
      throw error;
    }
    throw new Error("expected assertBudgetTierSupplied to throw");
  }

  it("rejects a missing budget with BUDGET_TIER_REQUIRED", () => {
    expect(requiredCode(undefined)).toBe("BUDGET_TIER_REQUIRED");
    expect(requiredCode({})).toBe("BUDGET_TIER_REQUIRED");
    expect(requiredCode({ budgetRange: [], barBudgetRange: [] })).toBe(
      "BUDGET_TIER_REQUIRED",
    );
  });

  it("treats an all-whitespace budget as empty", () => {
    expect(requiredCode({ budgetRange: ["   "] })).toBe("BUDGET_TIER_REQUIRED");
  });

  it("accepts a 饭局 budget only", () => {
    const diningId = getTiersForEventType("饭局")[0].id;
    expect(() => assertBudgetTierSupplied({ budgetRange: [diningId] })).not.toThrow();
  });

  it("accepts a 酒局 budget only (bar-only registration is legitimate)", () => {
    const drinksId = getTiersForEventType("酒局")[0].id;
    expect(() =>
      assertBudgetTierSupplied({ barBudgetRange: [drinksId] }),
    ).not.toThrow();
  });

  it("accepts a legacy label (non-empty before normalization)", () => {
    const legacyLabel = Object.keys(LEGACY_BUDGET_LABEL_TO_TIER_ID["饭局"])[0];
    expect(() =>
      assertBudgetTierSupplied({ budgetRange: [legacyLabel] }),
    ).not.toThrow();
  });

  it("accepts the B3-pending label (required-ness only checks presence)", () => {
    expect(() =>
      assertBudgetTierSupplied({
        budgetRange: [UNMAPPABLE_BLIND_BOX_BUDGET_LABEL],
      }),
    ).not.toThrow();
  });
});
