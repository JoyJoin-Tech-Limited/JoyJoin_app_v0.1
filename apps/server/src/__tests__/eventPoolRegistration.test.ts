import { describe, expect, it } from "vitest";

import { buildEventPoolRegistrationInsert } from "../lib/eventPoolRegistration";

describe("event pool registration insert helper", () => {
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
      },
    });
  });
});