/**
 * 双人成行 S1 (one-partner-per-pool) — write-side guard queries.
 *
 * Data source for the duo guard flags consumed by
 * `lib/eventPoolRegistration.resolveOptionalRegistrationAttribution` — the
 * single rule point shared by the free registration route
 * (`routes/domains/userEventPools.ts`) and the payment-fulfillment path
 * (`repositories/paymentFulfillmentRepo.ts`).
 *
 * "Valid binding" = both sides hold a registration in the invitation's pool.
 * The inviter-side join is LOAD-BEARING (S1 AC-8): cancellation deletes
 * invitation_uses rows by the CANCELLED user's own poolRegistrationId only
 * (`lib/poolRegistrationCancel.ts`), so an inviter cancel leaves the
 * invitee's use row behind. A guard that only checked "a use row exists"
 * would lock that invitee out of accepting a new code forever.
 *
 * Sprint contract: duo-s1-one-partner-per-pool (AC-1/2/7/8). Refusals never
 * block registration/payment; the concurrency race is accepted (no DB unique
 * index yet — Negotiation Log) with the poolFormation overlap backstop as the
 * safety net.
 */

import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import {
  eventPoolRegistrations,
  invitations,
  invitationUses,
} from "@shared/schema";
import { DUO_INVITATION_TYPE } from "../lib/duoInvites";
import type { DuoBindingAvailabilityInput } from "../lib/eventPoolRegistration";

type QueryExecutor = NodePgDatabase<typeof schema>;

/**
 * Resolve the two duo-guard facts for a (user, duo invitation, pool) triple.
 *
 * Only call this for invitations with invitationType === "duo" scoped to the
 * pool being registered — pool-mismatched codes discard as `pool_mismatch`
 * before the guard is consulted, so the query is skipped there.
 *
 * Read-only; three single-row EXISTS-style probes batched in one Promise.all
 * (no N+1 — one round of probes per registration-with-code).
 */
export async function resolveDuoBindingAvailability(
  dbOrTx: QueryExecutor,
  params: {
    poolId: string;
    userId: string;
    invitationId: string;
  },
): Promise<DuoBindingAvailabilityInput> {
  const { poolId, userId, invitationId } = params;

  const inviterRegs = alias(
    eventPoolRegistrations,
    "duo_guard_inviter_registrations",
  );

  const [invitationUseRows, inviteeSideRows, inviterSideRows] = await Promise.all([
    // partner_taken — the presented code is already claimed: a use row exists
    // whose invitee registration lives in this pool. The inviter's own
    // registration state is IRRELEVANT here: the code is claimed by its first
    // consumer even before the inviter registers, and a second consumer must
    // be refused either way (otherwise one invitation accrues two bindings
    // that turn into a pool-formation conflict the moment the inviter joins).
    dbOrTx
      .select({ id: invitationUses.id })
      .from(invitationUses)
      .innerJoin(
        eventPoolRegistrations,
        and(
          eq(eventPoolRegistrations.id, invitationUses.poolRegistrationId),
          eq(eventPoolRegistrations.poolId, poolId),
        ),
      )
      .where(eq(invitationUses.invitationId, invitationId))
      .limit(1),

    // already_bound (invitee role) — this user already consumed a duo code in
    // this pool AND that code's inviter still holds a registration here. The
    // inviter join is what frees the invitee after an inviter cancel (AC-8):
    // the residual use row no longer counts as a binding once the inviter's
    // registration is gone.
    dbOrTx
      .select({ id: invitationUses.id })
      .from(invitationUses)
      .innerJoin(
        invitations,
        and(
          eq(invitations.id, invitationUses.invitationId),
          eq(invitations.invitationType, DUO_INVITATION_TYPE),
          eq(invitations.poolId, poolId),
        ),
      )
      .innerJoin(
        eventPoolRegistrations,
        and(
          eq(eventPoolRegistrations.id, invitationUses.poolRegistrationId),
          eq(eventPoolRegistrations.poolId, poolId),
        ),
      )
      .innerJoin(
        inviterRegs,
        and(
          eq(inviterRegs.poolId, poolId),
          eq(inviterRegs.userId, invitations.inviterId),
        ),
      )
      .where(eq(invitationUses.inviteeId, userId))
      .limit(1),

    // already_bound (inviter role) — the user's OWN duo code for this pool
    // already has a live invitee consumer. The inviter side counts as bound
    // because the user is mid-registration (their row exists by commit time).
    dbOrTx
      .select({ id: invitations.id })
      .from(invitations)
      .innerJoin(invitationUses, eq(invitationUses.invitationId, invitations.id))
      .innerJoin(
        eventPoolRegistrations,
        and(
          eq(eventPoolRegistrations.id, invitationUses.poolRegistrationId),
          eq(eventPoolRegistrations.poolId, poolId),
        ),
      )
      .where(
        and(
          eq(invitations.inviterId, userId),
          eq(invitations.invitationType, DUO_INVITATION_TYPE),
          eq(invitations.poolId, poolId),
        ),
      )
      .limit(1),
  ]);

  return {
    invitationAlreadyBound: invitationUseRows.length > 0,
    userAlreadyBoundInPool: inviteeSideRows.length > 0 || inviterSideRows.length > 0,
  };
}
