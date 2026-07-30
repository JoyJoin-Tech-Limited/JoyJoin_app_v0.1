import { describe, expect, it } from "vitest";

import {
  buildEventPoolRegistrationInsert,
  isSessionPendingReferralCode,
  resolveOptionalRegistrationAttribution,
} from "../lib/eventPoolRegistration";

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
        barBudgetRange: ["80-150"],
        preferenceStrictness: 50,
        acceptPairs: true,
        genderCompositionPreference: null,
        preferredDistricts: null,
        kolComfortLevel: null,
      },
    });
  });

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
