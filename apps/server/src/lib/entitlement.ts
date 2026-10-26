/**
 * resolveEntitlementMode — single source of truth for the pool-registration
 * entitlement gate semantics (Sprint Contract m4-optimistic-registration AC-1).
 *
 * Mirrors the registration gate VERBATIM (formerly inline in
 * routes/domains/userEventPools.ts):
 *
 *   - APP_MODE=test → literal 'test', availableEventCredits forced to 0,
 *     BOTH reads skipped (local test DBs may omit `subscriptions` and
 *     `event_credit_grants`).
 *
 * Staging single-test mode must still exercise the real payment path.
 *
 *   - else subscription exists → 'subscription', availableEventCredits FORCED
 *     to 0 WITHOUT reading eventCreditsRepo (short-circuit — the credit read
 *     is never performed in the subscribed branch).
 *   - else availableEventCredits > 0 → 'event_pack'.
 *   - else → null.
 *
 * Used by BOTH the registration gate (routes/domains/userEventPools.ts) and
 * the auth-user response signal (lib/buildAuthUserResponse.ts) so the
 * semantics cannot drift.
 */

import type { EntitlementMode } from "@shared/api";
import { storage } from "../storage";
import { eventCreditsRepo } from "../repositories/eventCreditsRepo";

export interface ResolvedEntitlement {
  mode: EntitlementMode;
  /** Credit count surfaced by the gate's 403 body (forced 0 in test/subscription branches). */
  availableEventCredits: number;
  /**
   * Subscription detail for the profile entitlement strip (P0-1, 2026-10-22).
   * Populated ONLY in the subscription branch; null otherwise. planType
   * mirrors subscriptions.plan_type; daysRemaining uses the same formula as
   * subscriptionService.getUserSubscriptionStatus (ceil to endDate, floor 0).
   * No extra DB reads — derived from the row the branch already fetched.
   */
  subscription: { planType: "monthly" | "quarterly"; daysRemaining: number } | null;
}

export async function resolveEntitlementMode(userId: string): Promise<ResolvedEntitlement> {
  if ((process.env.APP_MODE ?? "production") === "test") {
    return { mode: "test", availableEventCredits: 0, subscription: null };
  }

  const subscription = await storage.getUserSubscription(userId);
  if (subscription) {
    const msRemaining = new Date(subscription.endDate).getTime() - Date.now();
    return {
      mode: "subscription",
      availableEventCredits: 0,
      subscription: {
        planType: subscription.planType === "quarterly" ? "quarterly" : "monthly",
        // Guard: a missing/invalid endDate must never leak NaN into the pill.
        daysRemaining: Number.isFinite(msRemaining)
          ? Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)))
          : 0,
      },
    };
  }

  const availableEventCredits = await eventCreditsRepo.getAvailableCreditCount(userId);
  return {
    mode: availableEventCredits > 0 ? "event_pack" : null,
    availableEventCredits,
    subscription: null,
  };
}
