/**
 * Admin invite/referral domain router (read-only).
 *
 *   GET /api/admin/referrals/stats  — aggregate invite + referral funnel stats
 *   GET /api/admin/duo-invites      — paginated 双人成行 duo invite list
 *
 * Both endpoints are read-only aggregates → `requireAdmin` (any admin role).
 */

import type { Express } from "express";
import { z } from "zod";
import { requireAdmin } from "../../adminAuth";
import { logger } from "../../lib/logger";
import { getReferralStats, listDuoInvites } from "../../repositories/adminReferralsRepo";

const duoInviteListQuerySchema = z.object({
  poolId: z.string().min(1).optional(),
  status: z.enum(["pending", "bound", "expired"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function registerAdminReferralRoutes(app: Express): void {
  app.get("/api/admin/referrals/stats", requireAdmin, async (_req, res) => {
    try {
      const stats = await getReferralStats();
      return res.json(stats);
    } catch (error) {
      logger.error("[AdminReferrals] stats failed", { error: String(error) });
      return res.status(500).json({ message: "Failed to load referral stats" });
    }
  });

  app.get("/api/admin/duo-invites", requireAdmin, async (req, res) => {
    try {
      const parsed = duoInviteListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid query parameters",
          errors: parsed.error.issues,
        });
      }

      const { items, total } = await listDuoInvites(parsed.data);

      return res.json({
        items,
        total,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        totalPages: Math.ceil(total / parsed.data.pageSize),
      });
    } catch (error) {
      logger.error("[AdminReferrals] duo-invites list failed", { error: String(error) });
      return res.status(500).json({ message: "Failed to load duo invites" });
    }
  });
}
