import { describe, expect, it } from "vitest";

import { buildRestoredPreferencesFromResumeContext } from "../useEventPoolRegistration";

describe("useEventPoolRegistration resume restore", () => {
  // Guards against regression: entitlement resume should preserve browser-only
  // draft state like districts instead of replacing everything with the
  // normalized server payload.
  it("merges the stored local draft into the resume restore", () => {
    expect(
      buildRestoredPreferencesFromResumeContext(
        "饭局",
        {
          budgetRange: ["120-180"],
          eventIntent: ["认识新朋友"],
          preferredLanguages: ["普通话"],
          cuisinePreferences: ["粤菜"],
        },
        {
          districts: ["南山区", "福田区"],
          musicPreference: ["轻松聊天"],
        },
      ),
    ).toMatchObject({
      eventType: "饭局",
      budget: "120-180",
      socialGoals: ["认识新朋友"],
      languages: ["普通话"],
      cuisines: ["粤菜"],
      districts: ["南山区", "福田区"],
      musicPreference: ["轻松聊天"],
    });
  });
});