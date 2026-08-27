/**
 * Guidance queue domain routes (C4 onboarding guidance, 2026-08-27).
 *
 * - POST /api/guidance/seen — record a guidance tip as seen for the session
 *   user. Idempotent first-write-wins: the earliest timestamp survives, and a
 *   repost is a 200 no-op echoing the original timestamp (safe retry after a
 *   client timeout). No dedicated GET endpoint — seen-state rides the
 *   GET /api/auth/user hydration as `seenGuidance`.
 *
 * Security: auth-gated (401 unauthenticated); tipId is Zod-validated against
 * the shared GUIDANCE_TIP_IDS enum (unknown → 400, fail-closed, so arbitrary
 * keys can never be written into the jsonb column); the session user id is
 * the ONLY write target — no userId is accepted from the body.
 */

import type { Express } from "express";
import {
  markGuidanceSeenBodySchema,
  type MarkGuidanceSeenResponse,
} from "@shared/api";
import { requireAuth } from "../../middleware/auth";
import { getAuthenticatedUserId } from "../../lib/requestAuth";
import { logger } from "../../lib/logger";
import {
  markGuidanceTipSeen,
  GuidanceUserNotFoundError,
} from "../../repositories/guidanceRepo";

export function registerGuidanceRoutes(app: Express): void {
  app.post("/api/guidance/seen", requireAuth, async (req, res) => {
    try {
      const userId = getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsed = markGuidanceSeenBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid tipId" });
      }
      const { tipId } = parsed.data;

      const { seenAt, alreadySeen } = await markGuidanceTipSeen(userId, tipId);

      if (!alreadySeen) {
        logger.info("[Guidance] tip marked seen", {
          request_id: req.requestId,
          userId,
          tipId,
          seenAt,
        });
      }

      const response: MarkGuidanceSeenResponse = {
        success: true,
        tipId,
        seenAt,
        alreadySeen,
      };
      return res.status(200).json(response);
    } catch (error) {
      if (error instanceof GuidanceUserNotFoundError) {
        return res.status(404).json({ message: "User not found" });
      }
      logger.error("[Guidance] mark-seen failed", {
        request_id: req.requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ message: "Failed to mark guidance tip as seen" });
    }
  });
}
