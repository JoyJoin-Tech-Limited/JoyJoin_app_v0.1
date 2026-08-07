/**
 * 双人成行 (duo registration) domain routes.
 *
 * Design spec: docs/design/duo-registration-spec-20260807.md
 *
 * - POST /api/pools/:id/duo-invites — idempotent duo code creation (auth)
 * - GET  /api/pools/:id/duo-status  — none | waiting | bound state machine (auth)
 * - GET  /api/duo-invites/:code     — public share-landing lookup (rate-limited)
 *
 * Storage: duo invites reuse the `invitations` / `invitation_uses` track
 * re-scoped to a pool (`invitations.poolId` + `invitationType='duo'`).
 * Per spec §A.5/§D the inviter may generate a code BEFORE registering, so code
 * creation only requires auth + a valid poolId; binding materializes at
 * registration time (see routes/domains/userEventPools.ts) when the invitee
 * consumes the code and both sides hold registrations in the pool.
 */

import type { Express } from "express";
import { randomBytes } from "crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  eventPools,
  eventPoolRegistrations,
  invitations,
  invitationUses,
  users,
} from "@shared/schema";
import { requireAuth } from "../../middleware/auth";
import { getAuthenticatedUserId } from "../../lib/requestAuth";
import { logger } from "../../lib/logger";
import { duoInviteLookupLimiter } from "../../rateLimiter";
import {
  DUO_INVITATION_TYPE,
  buildDuoSharePath,
  resolveDuoInviteExpiry,
  resolveDuoStatus,
} from "../../lib/duoInvites";

export function registerDuoRoutes(app: Express): void {
  // POST /api/pools/:id/duo-invites — create (or reuse) the caller's duo code
  // for this pool. Idempotent: same user + same pool returns the same code.
  app.post("/api/pools/:id/duo-invites", requireAuth, async (req, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const poolId = req.params.id;

      const [pool] = await db
        .select({
          id: eventPools.id,
          dateTime: eventPools.dateTime,
          preferenceLockAt: eventPools.preferenceLockAt,
        })
        .from(eventPools)
        .where(eq(eventPools.id, poolId))
        .limit(1);

      if (!pool) {
        return res.status(404).json({ message: "Event pool not found" });
      }

      const findExistingCode = async () => {
        const [existing] = await db
          .select({ code: invitations.code })
          .from(invitations)
          .where(and(
            eq(invitations.inviterId, userId),
            eq(invitations.poolId, poolId),
            eq(invitations.invitationType, DUO_INVITATION_TYPE),
          ))
          // Oldest first so a rare double-create race still converges on one code.
          .orderBy(asc(invitations.createdAt))
          .limit(1);
        return existing?.code;
      };

      const existingCode = await findExistingCode();
      if (existingCode) {
        return res.json({ code: existingCode, sharePath: buildDuoSharePath(poolId, existingCode) });
      }

      let code: string | undefined;
      for (let attempt = 0; attempt < 3 && !code; attempt++) {
        const candidate = randomBytes(4).toString("hex");
        const [collision] = await db
          .select({ id: invitations.id })
          .from(invitations)
          .where(eq(invitations.code, candidate))
          .limit(1);
        if (collision) continue;

        try {
          await db.insert(invitations).values({
            code: candidate,
            inviterId: userId,
            eventId: null,
            poolId,
            invitationType: DUO_INVITATION_TYPE,
            expiresAt: resolveDuoInviteExpiry(pool),
          });
          code = candidate;
        } catch (error) {
          // Lost a race (concurrent request created this user's invite, or a
          // code collision slipped past the pre-check) — loop re-checks below.
          logger.warn("Duo invite insert failed; re-checking for a raced row", {
            poolId,
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (!code) {
        code = await findExistingCode();
      }
      if (!code) {
        return res.status(500).json({ message: "Failed to create duo invite" });
      }

      return res.json({ code, sharePath: buildDuoSharePath(poolId, code) });
    } catch (error: any) {
      logger.error("Error creating duo invite", { error: String(error) });
      return res.status(500).json({ message: "Failed to create duo invite" });
    }
  });

  // GET /api/pools/:id/duo-status — duo state machine for the current user in
  // this pool: none | waiting | bound (bound = both registered + code consumed).
  app.get("/api/pools/:id/duo-status", requireAuth, async (req, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const poolId = req.params.id;

      // Current user's registration in this pool (either role needs this).
      const [ownRegistration] = await db
        .select({ id: eventPoolRegistrations.id })
        .from(eventPoolRegistrations)
        .where(and(
          eq(eventPoolRegistrations.poolId, poolId),
          eq(eventPoolRegistrations.userId, userId),
        ))
        .limit(1);

      // ── Inviter side: the current user's own duo invitation for this pool.
      const [ownInvite] = await db
        .select({ id: invitations.id, createdAt: invitations.createdAt })
        .from(invitations)
        .where(and(
          eq(invitations.inviterId, userId),
          eq(invitations.poolId, poolId),
          eq(invitations.invitationType, DUO_INVITATION_TYPE),
        ))
        .orderBy(asc(invitations.createdAt))
        .limit(1);

      let inviteeRegistered = false;
      let inviteeDisplayName: string | null = null;
      if (ownInvite) {
        const uses = await db
          .select({ poolRegistrationId: invitationUses.poolRegistrationId })
          .from(invitationUses)
          .where(eq(invitationUses.invitationId, ownInvite.id));
        const registrationIds = uses
          .map((use) => use.poolRegistrationId)
          .filter((id): id is string => Boolean(id));

        if (registrationIds.length > 0) {
          const [inviteeRegistration] = await db
            .select({ userId: eventPoolRegistrations.userId })
            .from(eventPoolRegistrations)
            .where(and(
              inArray(eventPoolRegistrations.id, registrationIds),
              eq(eventPoolRegistrations.poolId, poolId),
            ))
            .limit(1);

          if (inviteeRegistration) {
            inviteeRegistered = true;
            const [inviteeUser] = await db
              .select({ displayName: users.displayName, firstName: users.firstName })
              .from(users)
              .where(eq(users.id, inviteeRegistration.userId))
              .limit(1);
            inviteeDisplayName = inviteeUser?.displayName || inviteeUser?.firstName || null;
          }
        }
      }

      // ── Invitee side: a duo invitation scoped to this pool that the current
      // user consumed with their registration in this pool.
      let consumedInvitationCreatedAt: Date | null = null;
      let inviterRegistered = false;
      let inviterDisplayName: string | null = null;

      const consumedRows = await db
        .select({
          inviterId: invitations.inviterId,
          invitedAt: invitations.createdAt,
          usePoolRegistrationId: invitationUses.poolRegistrationId,
        })
        .from(invitationUses)
        .innerJoin(invitations, eq(invitationUses.invitationId, invitations.id))
        .where(and(
          eq(invitationUses.inviteeId, userId),
          eq(invitations.invitationType, DUO_INVITATION_TYPE),
          eq(invitations.poolId, poolId),
        ))
        .orderBy(asc(invitations.createdAt));

      const consumed = consumedRows.find(
        (row) => ownRegistration && row.usePoolRegistrationId === ownRegistration.id,
      );

      if (consumed) {
        consumedInvitationCreatedAt = consumed.invitedAt ?? null;
        const [inviterRegistration] = await db
          .select({ id: eventPoolRegistrations.id })
          .from(eventPoolRegistrations)
          .where(and(
            eq(eventPoolRegistrations.poolId, poolId),
            eq(eventPoolRegistrations.userId, consumed.inviterId),
          ))
          .limit(1);
        inviterRegistered = Boolean(inviterRegistration);

        const [inviterUser] = await db
          .select({ displayName: users.displayName, firstName: users.firstName })
          .from(users)
          .where(eq(users.id, consumed.inviterId))
          .limit(1);
        inviterDisplayName = inviterUser?.displayName || inviterUser?.firstName || null;
      }

      const status = resolveDuoStatus({
        invitationCreatedAt: ownInvite?.createdAt ?? null,
        inviteeRegistered,
        inviteeDisplayName,
        userRegistered: Boolean(ownRegistration),
        consumedInvitationCreatedAt,
        inviterRegistered,
        inviterDisplayName,
      });

      return res.json(status);
    } catch (error: any) {
      logger.error("Error fetching duo status", { error: String(error) });
      return res.status(500).json({ message: "Failed to fetch duo status" });
    }
  });

  // GET /api/duo-invites/:code — public lookup for the share landing banner.
  // Mirrors the 404/410 semantics of GET /api/invitations/:code (referrals.ts).
  app.get("/api/duo-invites/:code", duoInviteLookupLimiter, async (req, res) => {
    try {
      const { code } = req.params;

      const [invitation] = await db
        .select({
          id: invitations.id,
          inviterId: invitations.inviterId,
          poolId: invitations.poolId,
          invitationType: invitations.invitationType,
          expiresAt: invitations.expiresAt,
        })
        .from(invitations)
        .where(eq(invitations.code, code))
        .limit(1);

      if (!invitation || invitation.invitationType !== DUO_INVITATION_TYPE || !invitation.poolId) {
        return res.status(404).json({ message: "Invitation not found or expired", status: "invalid" });
      }

      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        return res.status(410).json({ message: "Invitation has expired", status: "expired" });
      }

      const [inviter] = await db
        .select({ displayName: users.displayName, firstName: users.firstName })
        .from(users)
        .where(eq(users.id, invitation.inviterId))
        .limit(1);

      // Click tracking — same behavior as the referral/invitation lookups.
      await db
        .update(invitations)
        .set({ totalClicks: sql`${invitations.totalClicks} + 1` })
        .where(eq(invitations.id, invitation.id));

      return res.json({
        inviter: {
          displayName: inviter?.displayName || inviter?.firstName || "好友",
        },
        poolId: invitation.poolId,
        status: "active",
      });
    } catch (error: any) {
      logger.error("Error fetching duo invite", { error: String(error) });
      return res.status(500).json({ message: "Failed to fetch duo invite" });
    }
  });
}
