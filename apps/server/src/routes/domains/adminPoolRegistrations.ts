/**
 * Admin pool-registration operations.
 *
 *   POST /api/admin/pool-registrations/:id/cancel — admin-initiated cancel
 *
 * Thin admin wrapper over the SHARED cancel orchestrator
 * (lib/poolRegistrationCancel.ts) used by DELETE /api/pool-registrations/:id
 * and the blind-box cancel route, so refund / credit-reversal / group-collapse
 * semantics and the preRevealRefundEnabled / noRefundAfterReveal feature-flag
 * branches match user self-cancel exactly.
 *
 * Actor mapping: the orchestrator is owner-scoped (id + userId). The admin
 * route resolves the registration's owner first and passes that userId
 * through — no orchestrator change, no user-facing behavior change. The
 * admin identity + reason are recorded via a separate admin audit entry.
 */

import type { Express } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { eventPoolRegistrations } from "@shared/schema";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { logger } from "../../lib/logger";
import { logAdminAudit } from "../../lib/adminAuditLogger";
import { getActingAdminId } from "../../lib/getActingAdminId";
import { cancelPoolRegistrationWithPolicy } from "../../lib/poolRegistrationCancel";

const LOG_PREFIX = "[AdminPoolRegistrationCancel]";

const adminCancelBodySchema = z.object({
  reason: z.string().trim().min(5, "reason must be at least 5 characters").max(500),
});

export function registerAdminPoolRegistrationRoutes(app: Express): void {
  app.post("/api/admin/pool-registrations/:id/cancel", requireAdmin, requireOperatorOrAbove, async (req, res) => {
      try {
        const parsed = adminCancelBodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: "Invalid cancel payload",
            errors: parsed.error.issues,
          });
        }
        const { reason } = parsed.data;
        const registrationId = req.params.id;

        // Resolve the registration owner — the shared orchestrator is
        // owner-scoped, so we pass the owner's userId through unchanged.
        const [registration] = await db
          .select({
            id: eventPoolRegistrations.id,
            userId: eventPoolRegistrations.userId,
            poolId: eventPoolRegistrations.poolId,
          })
          .from(eventPoolRegistrations)
          .where(eq(eventPoolRegistrations.id, registrationId))
          .limit(1);

        if (!registration) {
          return res.status(404).json({ message: "Pool registration not found" });
        }

        const result = await cancelPoolRegistrationWithPolicy({
          registrationId: registration.id,
          userId: registration.userId,
          logPrefix: LOG_PREFIX,
        });

        if (!result.ok) {
          return res.status(result.status).json({ message: result.message, code: result.code });
        }

        logAdminAudit({
          action: "POOL_REGISTRATION_CANCELLED_BY_ADMIN",
          adminId: getActingAdminId(req),
          adminRole: (req as any).adminRole,
          targetEntityType: "event_pool_registration",
          targetEntityId: registration.id,
          context: {
            reason,
            userId: registration.userId,
            poolId: result.poolId,
            branch: result.branch,
            refundedMoney: result.refundedMoney,
            reversedCredit: result.reversedCredit,
            alreadyRefunded: result.alreadyRefunded,
            remainingCount: result.remainingCount,
            collapsed: result.collapsed,
          },
        });

        logger.info(`${LOG_PREFIX} admin cancel complete`, {
          registrationId: registration.id,
          adminId: getActingAdminId(req),
          branch: result.branch,
        });

        return res.json(result);
      } catch (error) {
        logger.error(`${LOG_PREFIX} admin cancel failed`, { error: String(error) });
        return res.status(500).json({ message: "Failed to cancel pool registration" });
      }
  });
}
