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
}

export async function resolveEntitlementMode(userId: string): Promise<ResolvedEntitlement> {
  if ((process.env.APP_MODE ?? "production") === "test") {
    return { mode: "test", availableEventCredits: 0 };
  }

  const subscription = await storage.getUserSubscription(userId);
  if (subscription) {
    return { mode: "subscription", availableEventCredits: 0 };
  }

  const availableEventCredits = await eventCreditsRepo.getAvailableCreditCount(userId);
  return {
    mode: availableEventCredits > 0 ? "event_pack" : null,
    availableEventCredits,
  };
}
