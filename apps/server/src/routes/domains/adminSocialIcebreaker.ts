import type { Express } from "express";
import { z } from "zod";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { logger } from "../../lib/logger";
import { getActingAdminId } from "../../lib/getActingAdminId";
import { logAdminAudit } from "../../lib/adminAuditLogger";
import {
  getSessionWithExpiry,
  getParticipant,
  listParticipants,
  transferHost,
} from "../../lib/socialIcebreakerStore";
import { pickAutoHostCandidate } from "../../lib/socialIcebreakerHostResilience";
import { transitionPhase } from "../socialIcebreakerHelpers";

const socialSessionParamsSchema = z.object({
  socialSessionId: z.string().trim().min(1),
});

// An absent / empty `newHostUserId` means "auto-select the most recently active
// non-host participant" — preserved from the previous untyped body handling.
const transferHostBodySchema = z.object({
  newHostUserId: z.string().trim().optional(),
});

/**
 * Admin recovery controls for Social Icebreaker sessions (Sprint W1).
 *
 * Operator / super_admin only. Both endpoints deliberately ignore the current
 * host identity — they exist precisely for the case where the designated host
 * has disengaged and the room is otherwise frozen. Every mutation emits an
 * `[AdminAudit]` row.
 */
export function registerAdminSocialIcebreakerRoutes(app: Express): void {
  // POST /api/admin/social-icebreaker/:socialSessionId/force-end
  // Ends the session immediately regardless of host presence; idempotent when
  // the session is already in recap.
  app.post("/api/admin/social-icebreaker/:socialSessionId/force-end", requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
      try {
        const params = socialSessionParamsSchema.safeParse(req.params);
        if (!params.success) {
          return res.status(400).json({
            message: "Invalid social session id",
            code: "INVALID_SOCIAL_SESSION_ID",
            errors: params.error.flatten(),
          });
        }
        const { socialSessionId } = params.data;
        const { state, expired } = await getSessionWithExpiry(socialSessionId);
        if (!state) {
          return expired
            ? res.status(410).json({ message: "Session expired", code: "SESSION_EXPIRED" })
            : res.status(404).json({ message: "Social session not found", code: "SESSION_NOT_FOUND" });
        }

        const beforePhase = state.currentPhase;
        const alreadyEnded = beforePhase === "recap";
        const previousHostUserId = state.hostUserId;

        if (!alreadyEnded) {
          state.interruptedAtPhase = beforePhase;
          state.endedEarlyAt = state.endedEarlyAt ?? new Date().toISOString();
          // Mirror the user early-end path: resolve a pending bonus gate so
          // mid-vote players land in recap without a ghost gate overlay.
          if (
            state.bonusGateOffered &&
            !state.bonusGateAccepted &&
            !state.bonusGateDeclined
          ) {
            state.bonusGateDeclined = true;
            state.bonusGatePlayerSentiment = undefined;
          }
          await transitionPhase({
            state,
            socialSessionId,
            trigger: "early_end_jump",
            targetPhase: "recap",
            countCurrentPhaseCompleted: false,
            skipBonusGate: true,
            deferRecapSnapshot: true,
          });
        }

        logAdminAudit({
          action: "SOCIAL_ICEBREAKER_FORCE_END",
          adminId: getActingAdminId(req),
          adminRole: req.adminRole,
          targetEntityType: "social_icebreaker_session",
          targetEntityId: socialSessionId,
          before: { currentPhase: beforePhase, hostUserId: previousHostUserId },
          after: { currentPhase: "recap" },
          context: {
            alreadyEnded,
          },
        });

        logger.info("[SocialIcebreaker][Admin] force-end", {
          request_id: req.requestId,
          socialSessionId,
          adminId: getActingAdminId(req),
          beforePhase,
          alreadyEnded,
        });

        return res.json({
          success: true,
          alreadyEnded,
          currentPhase: alreadyEnded ? beforePhase : "recap",
        });
      } catch (error) {
        logger.error("Error force-ending social icebreaker session", { error: String(error) });
        return res.status(500).json({ message: "Failed to force-end session" });
      }
    },
  );

  // POST /api/admin/social-icebreaker/:socialSessionId/transfer-host
  // Body: { newHostUserId?: string }. When omitted, the most recently active
  // non-host human participant is selected (simulated bots are never promoted —
  // a bot cannot advance a phase, so it would freeze the room). Ignores the
  // current host (admin override) and is idempotent when the target already
  // holds the role.
  app.post("/api/admin/social-icebreaker/:socialSessionId/transfer-host", requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
      try {
        const params = socialSessionParamsSchema.safeParse(req.params);
        if (!params.success) {
          return res.status(400).json({
            message: "Invalid social session id",
            code: "INVALID_SOCIAL_SESSION_ID",
            errors: params.error.flatten(),
          });
        }
        const { socialSessionId } = params.data;

        const body = transferHostBodySchema.safeParse(req.body ?? {});
        if (!body.success) {
          return res.status(400).json({
            message: "Invalid transfer-host request",
            code: "INVALID_TRANSFER_HOST_REQUEST",
            errors: body.error.flatten(),
          });
        }
        const requestedUserId = body.data.newHostUserId ?? "";

        const { state, expired } = await getSessionWithExpiry(socialSessionId);
        if (!state) {
          return expired
            ? res.status(410).json({ message: "Session expired", code: "SESSION_EXPIRED" })
            : res.status(404).json({ message: "Social session not found", code: "SESSION_NOT_FOUND" });
        }

        let targetUserId = requestedUserId;
        let targetDisplayName = "";

        if (targetUserId) {
          const target = await getParticipant(socialSessionId, targetUserId);
          if (!target) {
            return res.status(400).json({
              message: "Target user is not a session participant",
              code: "TARGET_NOT_PARTICIPANT",
            });
          }
          // A simulated bot can never advance a phase, so promoting one freezes
          // the table. The auto-select branch already skips bots; this closes the
          // same invariant on the explicit-target path.
          if (target.isTestBot) {
            return res.status(400).json({
              message: "Target participant is a simulated bot and cannot host",
              code: "TARGET_IS_TEST_BOT",
            });
          }
          targetDisplayName = target.displayName;
        } else {
          const roster = await listParticipants(socialSessionId);
          const candidate = pickAutoHostCandidate(roster, state.hostUserId);
          if (!candidate) {
            return res.status(409).json({
              message: "No eligible participant to transfer host to",
              code: "NO_ELIGIBLE_PARTICIPANT",
            });
          }
          targetUserId = candidate.userId;
          targetDisplayName = candidate.displayName;
        }

        const previousHostUserId = state.hostUserId;
        const result = await transferHost(socialSessionId, targetUserId, targetDisplayName);
        if (result.outcome === "not_found") {
          return res.status(404).json({ message: "Social session not found", code: "SESSION_NOT_FOUND" });
        }

        const alreadyHost = result.outcome === "already_host";

        // P3 (2026-11-03): answer "how long was the table frozen before anyone
        // took over?" — the one question the audit row + toast could not. Phase
        // dwell is reused rather than a new table/event: a transfer is an
        // operator-visible recovery action, so it rides the existing admin audit
        // context and the structured log line.
        const phaseStartedAtMs = Number(state.phaseStartedAt ?? 0);
        const frozenMinutes =
          phaseStartedAtMs > 0
            ? Math.max(0, Math.round((Date.now() - phaseStartedAtMs) / 60_000))
            : null;

        logAdminAudit({
          action: "SOCIAL_ICEBREAKER_HOST_TRANSFERRED",
          adminId: getActingAdminId(req),
          adminRole: req.adminRole,
          targetEntityType: "social_icebreaker_session",
          targetEntityId: socialSessionId,
          before: { hostUserId: previousHostUserId },
          after: { hostUserId: targetUserId },
          context: {
            previousHostUserId,
            newHostUserId: targetUserId,
            autoSelected: !requestedUserId,
            fromPhase: state.currentPhase,
            frozenMinutes,
            sessionStartedAt: state.sessionStartedAt
              ? new Date(state.sessionStartedAt).toISOString()
              : null,
          },
        });

        logger.info("[SocialIcebreaker][Admin] host transfer", {
          request_id: req.requestId,
          socialSessionId,
          adminId: getActingAdminId(req),
          previousHostUserId,
          newHostUserId: targetUserId,
          autoSelected: !requestedUserId,
          alreadyHost,
          fromPhase: state.currentPhase,
          frozenMinutes,
        });

        return res.json({
          success: true,
          transferred: !alreadyHost,
          alreadyHost,
          hostUserId: targetUserId,
        });
      } catch (error) {
        logger.error("Error transferring social icebreaker host", { error: String(error) });
        return res.status(500).json({ message: "Failed to transfer host" });
      }
    },
  );
}
