import { describe, expect, it } from "vitest";
import type { PoolRegistrationSummary } from "@shared/api";

import {
  buildEntitlementResumeBrowserPendingOrderContext,
  buildEventBrowserPendingOrderContext,
  getBlindBoxEntitlementResumePaymentRoute,
  getBlindBoxConfirmationDestination,
  getBlindBoxPaymentPageModeFromUrl,
  resolveEventPaymentRegistrationId,
} from "../blindBoxPaymentRouting";
import { buildBrowserPoolRegistrationResumeContext } from "../poolRegistrationResume";

// Guards against regression: confirmed blind-box event payments should deep-link
// into the current pool registration when the just-created record is visible.
describe("blind box payment routing", () => {
  it("captures the pool identifier needed for post-payment resolution", () => {
    expect(
      buildEventBrowserPendingOrderContext({
        poolId: "pool-1",
        eventType: "饭局",
      }),
    ).toEqual({
      type: "event",
      eventRegistration: {
        poolId: "pool-1",
      },
    });
  });

  it("prefers the pending registration for the just-paid pool", () => {
    const context = buildEventBrowserPendingOrderContext({ poolId: "pool-2" });
    const registrations: PoolRegistrationSummary[] = [
      {
        id: "registration-1",
        poolId: "pool-1",
        matchStatus: "pending",
      },
      {
        id: "registration-2",
        poolId: "pool-2",
        matchStatus: "pending",
      },
    ];

    const registrationId = resolveEventPaymentRegistrationId(registrations, context);

    expect(registrationId).toBe("registration-2");
    expect(getBlindBoxConfirmationDestination(context, registrationId)).toEqual({
      kind: "matching",
      label: "匹配进度",
      path: "/pool-matching/registration-2",
    });
  });

  it("still routes directly when the pool registration matches immediately", () => {
    const context = buildEventBrowserPendingOrderContext({ poolId: "pool-3" });
    const registrations: PoolRegistrationSummary[] = [
      {
        id: "registration-3",
        poolId: "pool-3",
        matchStatus: "matched",
      },
    ];

    expect(resolveEventPaymentRegistrationId(registrations, context)).toBe("registration-3");
  });

  it("keeps the bounded events fallback when resolution fails", () => {
    const context = buildEventBrowserPendingOrderContext({ poolId: "pool-4" });
    const registrations: PoolRegistrationSummary[] = [
      {
        id: "registration-1",
        poolId: "pool-1",
        matchStatus: "pending",
      },
    ];

    expect(resolveEventPaymentRegistrationId(registrations, context)).toBeNull();
    expect(getBlindBoxConfirmationDestination(context, null)).toEqual({
      kind: "events",
      label: "活动页",
      path: "/events",
    });
  });

  it("keeps entitlement resume as an explicit payment-page mode", () => {
    expect(getBlindBoxEntitlementResumePaymentRoute()).toBe(
      "/blindbox/payment?mode=entitlement-resume",
    );
    expect(
      getBlindBoxPaymentPageModeFromUrl("/blindbox/payment?mode=entitlement-resume"),
    ).toBe("entitlement-resume");
    expect(getBlindBoxPaymentPageModeFromUrl("/blindbox/payment")).toBe("default");
  });

  it("routes entitlement-resume confirmations back through discover join", () => {
    const returnContext = buildBrowserPoolRegistrationResumeContext({
      userId: "user-1",
      poolId: "pool-9",
      poolTitle: "南山周五饭局",
      draft: {
        budgetRange: ["150-200"],
        eventIntent: ["认识新朋友"],
      },
      resumeStep: 3,
    });

    expect(
      getBlindBoxConfirmationDestination(
        buildEntitlementResumeBrowserPendingOrderContext(returnContext),
      ),
    ).toEqual({
      kind: "registration",
      label: "报名页",
      path: "/discover?joinPool=pool-9",
    });
  });
});
