import { describe, expect, it } from "vitest";

import {
  BROWSER_POOL_REGISTRATION_RESUME_MAX_AGE_MS,
  buildBrowserPoolRegistrationResumeContext,
  getBrowserPoolRegistrationResumeBudget,
  getBrowserPoolRegistrationResumeNote,
  markBrowserPoolRegistrationResumeContextPaid,
  resolveBrowserPoolRegistrationResumeContext,
} from "../poolRegistrationResume";

const NOW = 1_713_456_789_000;

describe("pool registration resume", () => {
  it("normalizes the draft and preserves the pool context needed to reopen the sheet", () => {
    const context = buildBrowserPoolRegistrationResumeContext(
      {
        userId: "user-1",
        poolId: " pool-1 ",
        poolTitle: " 南山周五饭局 ",
        poolArea: " 南山区 ",
        poolDate: "2026-04-20 19:30",
        poolEventType: "饭局",
        draft: {
          budgetRange: ["120-180"],
          eventIntent: ["认识新朋友", "轻松聊天"],
          alcoholComfort: "少量也可以",
        },
        resumeStep: 2,
      },
      NOW,
    );

    expect(context).toMatchObject({
      kind: "pool-registration",
      userId: "user-1",
      poolId: "pool-1",
      poolTitle: "南山周五饭局",
      poolArea: "南山区",
      poolDate: "2026-04-20 19:30",
      poolEventType: "饭局",
      resumeStep: 2,
      paymentStatus: "payment-required",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(context.draft).toEqual({
      budgetRange: ["120-180"],
      eventIntent: ["认识新朋友", "轻松聊天"],
      alcoholComfort: ["少量也可以"],
    });
    expect(getBrowserPoolRegistrationResumeBudget(context)).toBe("120-180");
    expect(getBrowserPoolRegistrationResumeNote(context)).toContain("继续刚才的报名");
  });

  it("marks paid contexts so the resumed sheet knows entitlement is already confirmed", () => {
    const context = buildBrowserPoolRegistrationResumeContext(
      {
        userId: "user-1",
        poolId: "pool-2",
        draft: {
          barBudgetRange: ["200-300"],
          eventIntent: ["喝一杯"],
        },
        handoffCode: "NO_AVAILABLE_EVENT_PACK_CREDITS",
      },
      NOW,
    );

    const paidContext = markBrowserPoolRegistrationResumeContextPaid(context, NOW + 5_000);

    expect(paidContext).toMatchObject({
      paymentStatus: "paid",
      updatedAt: NOW + 5_000,
    });
    expect(getBrowserPoolRegistrationResumeNote(paidContext)).toContain("权益已经确认");
  });

  it("clears expired or wrong-user resume contexts before they can hijack a later flow", () => {
    const context = buildBrowserPoolRegistrationResumeContext(
      {
        userId: "user-1",
        poolId: "pool-3",
        draft: {
          budgetRange: ["80-120"],
          eventIntent: ["认识新朋友"],
        },
      },
      NOW,
    );

    expect(
      resolveBrowserPoolRegistrationResumeContext({
        context,
        currentUserId: "user-1",
        now: NOW + 1_000,
      }),
    ).toEqual({
      status: "ready",
      context,
    });

    expect(
      resolveBrowserPoolRegistrationResumeContext({
        context,
        currentUserId: "user-2",
        now: NOW + 1_000,
      }),
    ).toEqual({
      status: "clear",
      reason: "wrong-user",
    });

    expect(
      resolveBrowserPoolRegistrationResumeContext({
        context,
        currentUserId: "user-1",
        now: NOW + BROWSER_POOL_REGISTRATION_RESUME_MAX_AGE_MS + 1,
      }),
    ).toEqual({
      status: "clear",
      reason: "expired",
    });
  });
});