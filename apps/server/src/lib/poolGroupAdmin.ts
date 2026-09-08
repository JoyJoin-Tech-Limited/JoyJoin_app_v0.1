/**
 * Manual seat assignment — add one registered user to an existing matched
 * pool group (admin operations).
 *
 * This is NOT matching logic: no scoring, no group formation. It mirrors the
 * persistence patterns of poolMatchingService.saveMatchResults:
 *   - membership lives on event_pool_registrations.assignedGroupId + matchStatus
 *   - group headcount lives on event_pool_groups.memberCount
 *   - the group's linked events row carries currentAttendees and one
 *     event_attendance row per member (attendance source of truth)
 *
 * Concurrency contract:
 *   - headcount bump is a guarded UPDATE … WHERE memberCount < maxSize
 *     … RETURNING (two concurrent adds cannot both overfill)
 *   - the registration claim is UPDATE … WHERE assignedGroupId IS NULL
 *     … RETURNING (a concurrent add/cancel loses the race and rolls back)
 *   - both run inside ONE transaction
 */

import { and, eq, isNull, lt, sql } from "drizzle-orm";
import {
  eventAttendance,
  eventPoolGroups,
  eventPoolRegistrations,
  eventPools,
  events,
  invitations,
  invitationUses,
  payments,
} from "@shared/schema";
import { db } from "../db";
import { logger } from "./logger";
import { DUO_INVITATION_TYPE } from "./duoInvites";

const LOG_PREFIX = "[PoolGroupAdmin]";
const DEFAULT_MAX_GROUP_SIZE = 6;
/** Guarded headcount bump found no row → group is full (existence and pool
 *  ownership are verified before the transaction). */
const GROUP_FULL = "GROUP_FULL";
/** Registration was claimed by a concurrent op between pre-check and tx. */
const REGISTRATION_CLAIM_RACE = "REGISTRATION_CLAIM_RACE";

export interface AddMemberSuccess {
  ok: true;
  /** false when the user was already in THIS group (idempotent no-op). */
  memberAdded: boolean;
  poolId: string;
  groupId: string;
  registrationId: string;
  userId: string;
  memberCount: number;
  /** Operator-facing, non-blocking warnings (empty when clean). */
  warnings: string[];
}

export interface AddMemberFailure {
  ok: false;
  status: number;
  message: string;
}

export type AddMemberResult = AddMemberSuccess | AddMemberFailure;

/**
 * Non-blocking operator-facing warning checks run AFTER a successful add.
 * They never change the guards and never fail the operation — each check is
 * wrapped so a lookup error degrades to "no warning" plus a log line.
 *
 * (a) Duo-bind: the user has a BOUND 双人成行 pair in this pool (both sides
 *     hold registrations linked by an invitation_uses row — the same bind
 *     shape duo.ts / duoInvites.ts uses) and the partner is seated in a
 *     different group (or not seated yet).
 * (b) Payment presence: pool payments link via payments.paymentType='event'
 *     + payments.relatedId=poolId (see paymentFulfillmentRepo); a completed
 *     row is expected for a matched seat.
 */
async function collectAddMemberWarnings(params: {
  registrationId: string;
  userId: string;
  poolId: string;
  groupId: string;
}): Promise<string[]> {
  const { registrationId, userId, poolId, groupId } = params;
  const warnings: string[] = [];

  // (a) Duo-bind detection (either direction: inviter or invitee).
  try {
    let partnerRegistration: { assignedGroupId: string | null } | undefined;

    // Inviter side: the user's own duo invite for this pool was consumed.
    const [ownInvite] = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(and(
        eq(invitations.inviterId, userId),
        eq(invitations.poolId, poolId),
        eq(invitations.invitationType, DUO_INVITATION_TYPE),
      ))
      .limit(1);

    if (ownInvite) {
      const [use] = await db
        .select({ poolRegistrationId: invitationUses.poolRegistrationId })
        .from(invitationUses)
        .where(eq(invitationUses.invitationId, ownInvite.id))
        .limit(1);
      if (use?.poolRegistrationId) {
        const [reg] = await db
          .select({ assignedGroupId: eventPoolRegistrations.assignedGroupId })
          .from(eventPoolRegistrations)
          .where(and(
            eq(eventPoolRegistrations.id, use.poolRegistrationId),
            eq(eventPoolRegistrations.poolId, poolId),
          ))
          .limit(1);
        partnerRegistration = reg;
      }
    } else {
      // Invitee side: this registration consumed someone's duo invite.
      const [use] = await db
        .select({ invitationId: invitationUses.invitationId })
        .from(invitationUses)
        .where(and(
          eq(invitationUses.inviteeId, userId),
          eq(invitationUses.poolRegistrationId, registrationId),
        ))
        .limit(1);
      if (use) {
        const [invite] = await db
          .select({ inviterId: invitations.inviterId })
          .from(invitations)
          .where(and(
            eq(invitations.id, use.invitationId),
            eq(invitations.invitationType, DUO_INVITATION_TYPE),
            eq(invitations.poolId, poolId),
          ))
          .limit(1);
        if (invite) {
          const [reg] = await db
            .select({ assignedGroupId: eventPoolRegistrations.assignedGroupId })
            .from(eventPoolRegistrations)
            .where(and(
              eq(eventPoolRegistrations.poolId, poolId),
              eq(eventPoolRegistrations.userId, invite.inviterId),
            ))
            .limit(1);
          partnerRegistration = reg;
        }
      }
    }

    // Bound = partner also holds a registration in this pool. Warn when the
    // partner is not seated in the same group.
    if (partnerRegistration && partnerRegistration.assignedGroupId !== groupId) {
      warnings.push("该用户已绑定双人成行，搭档未同组");
    }
  } catch (error) {
    logger.warn(`${LOG_PREFIX} duo-bind warning check failed (non-blocking)`, {
      userId,
      poolId,
      error: String(error),
    });
  }

  // (b) Completed payment presence for this user + pool.
  try {
    const [completedPayment] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(and(
        eq(payments.userId, userId),
        eq(payments.paymentType, "event"),
        eq(payments.relatedId, poolId),
        eq(payments.status, "completed"),
      ))
      .limit(1);
    if (!completedPayment) {
      warnings.push("未找到该用户在本池的已完成支付记录");
    }
  } catch (error) {
    logger.warn(`${LOG_PREFIX} payment warning check failed (non-blocking)`, {
      userId,
      poolId,
      error: String(error),
    });
  }

  return warnings;
}

export async function addMemberToPoolGroup(params: {
  poolId: string;
  groupId: string;
  /** Exactly one of userId / registrationId must be provided. */
  userId?: string;
  registrationId?: string;
}): Promise<AddMemberResult> {
  const { poolId, groupId, userId, registrationId } = params;

  // 1) Resolve the registration (active = row exists; cancels delete rows).
  const registrationCondition = registrationId
    ? eq(eventPoolRegistrations.id, registrationId)
    : and(
        eq(eventPoolRegistrations.poolId, poolId),
        eq(eventPoolRegistrations.userId, userId as string),
      );

  const [registration] = await db
    .select({
      id: eventPoolRegistrations.id,
      poolId: eventPoolRegistrations.poolId,
      userId: eventPoolRegistrations.userId,
      matchStatus: eventPoolRegistrations.matchStatus,
      assignedGroupId: eventPoolRegistrations.assignedGroupId,
    })
    .from(eventPoolRegistrations)
    .where(registrationCondition)
    .limit(1);

  if (!registration || registration.poolId !== poolId) {
    return {
      ok: false,
      status: 404,
      message: "User does not hold an active registration in this pool",
    };
  }

  // 2) Pool must exist; maxGroupSize is the seat cap (default 6).
  const [pool] = await db
    .select({
      id: eventPools.id,
      maxGroupSize: eventPools.maxGroupSize,
    })
    .from(eventPools)
    .where(eq(eventPools.id, poolId))
    .limit(1);

  if (!pool) {
    return { ok: false, status: 404, message: "Event pool not found" };
  }
  const maxGroupSize = pool.maxGroupSize ?? DEFAULT_MAX_GROUP_SIZE;

  // 3) Group must exist and belong to this pool.
  const [group] = await db
    .select({
      id: eventPoolGroups.id,
      poolId: eventPoolGroups.poolId,
      memberCount: eventPoolGroups.memberCount,
      eventId: eventPoolGroups.eventId,
      operatorReviewStatus: eventPoolGroups.operatorReviewStatus,
    })
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.id, groupId))
    .limit(1);

  if (!group || group.poolId !== poolId) {
    return { ok: false, status: 404, message: "Group not found in this pool" };
  }

  // 4) Idempotency + cross-group guard.
  if (registration.assignedGroupId === groupId) {
    return {
      ok: true,
      memberAdded: false,
      poolId,
      groupId,
      registrationId: registration.id,
      userId: registration.userId,
      memberCount: group.memberCount ?? 0,
      warnings: await collectAddMemberWarnings({
        registrationId: registration.id,
        userId: registration.userId,
        poolId,
        groupId,
      }),
    };
  }
  if (registration.assignedGroupId) {
    return {
      ok: false,
      status: 409,
      message: "User is already assigned to another group in this pool",
    };
  }

  // Mirror saveMatchResults: groups still pending operator review hold
  // members at matchStatus='pending'; approved groups hold 'matched'.
  const newMatchStatus = group.operatorReviewStatus === "pending" ? "pending" : "matched";

  let memberCount = group.memberCount ?? 0;

  try {
    await db.transaction(async (tx: any) => {
      // 5a) Atomic seat claim on the group (guarded increment).
      const bumped = await tx
        .update(eventPoolGroups)
        .set({
          memberCount: sql`${eventPoolGroups.memberCount} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(eventPoolGroups.id, groupId),
            eq(eventPoolGroups.poolId, poolId),
            lt(eventPoolGroups.memberCount, maxGroupSize),
          ),
        )
        .returning({ memberCount: eventPoolGroups.memberCount });

      if (bumped.length === 0) {
        throw new Error(GROUP_FULL);
      }
      memberCount = bumped[0].memberCount;

      // 5b) Claim the registration for this group (NULL-guarded).
      const claimed = await tx
        .update(eventPoolRegistrations)
        .set({
          assignedGroupId: groupId,
          matchStatus: newMatchStatus,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(eventPoolRegistrations.id, registration.id),
            isNull(eventPoolRegistrations.assignedGroupId),
          ),
        )
        .returning({ id: eventPoolRegistrations.id });

      if (claimed.length === 0) {
        throw new Error(REGISTRATION_CLAIM_RACE);
      }

      // 5c) Mirror the matching service's per-member side writes for the
      // group's linked event: attendance row + attendee counter.
      if (group.eventId) {
        await tx
          .update(events)
          .set({ currentAttendees: sql`${events.currentAttendees} + 1` })
          .where(eq(events.id, group.eventId));

        const existingAttendance = await tx
          .select({ id: eventAttendance.id, status: eventAttendance.status })
          .from(eventAttendance)
          .where(
            and(
              eq(eventAttendance.eventId, group.eventId),
              eq(eventAttendance.userId, registration.userId),
            ),
          )
          .limit(1);

        if (existingAttendance.length === 0) {
          await tx.insert(eventAttendance).values({
            eventId: group.eventId,
            userId: registration.userId,
            status: "confirmed",
          });
        } else if (existingAttendance[0].status !== "confirmed") {
          await tx
            .update(eventAttendance)
            .set({ status: "confirmed" })
            .where(eq(eventAttendance.id, existingAttendance[0].id));
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === GROUP_FULL) {
      return {
        ok: false,
        status: 409,
        message: `Group is full (max ${maxGroupSize} members)`,
      };
    }
    if (message === REGISTRATION_CLAIM_RACE) {
      return {
        ok: false,
        status: 409,
        message: "Registration changed concurrently — refresh and retry",
      };
    }
    throw error;
  }

  logger.info(`${LOG_PREFIX} member added to group`, {
    poolId,
    groupId,
    registrationId: registration.id,
    userId: registration.userId,
    memberCount,
    matchStatus: newMatchStatus,
  });

  const warnings = await collectAddMemberWarnings({
    registrationId: registration.id,
    userId: registration.userId,
    poolId,
    groupId,
  });
  if (warnings.length > 0) {
    logger.warn(`${LOG_PREFIX} member added with warnings`, {
      poolId,
      groupId,
      userId: registration.userId,
      warnings,
    });
  }

  return {
    ok: true,
    memberAdded: true,
    poolId,
    groupId,
    registrationId: registration.id,
    userId: registration.userId,
    memberCount,
    warnings,
  };
}
