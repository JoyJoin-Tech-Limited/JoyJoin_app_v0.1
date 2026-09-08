/**
 * Admin promotion-banner CRUD.
 *
 *   GET    /api/admin/banners      — list all banners incl. inactive (any admin)
 *   POST   /api/admin/banners      — create (operator or above)
 *   PATCH  /api/admin/banners/:id  — update (operator or above)
 *   DELETE /api/admin/banners/:id  — delete (operator or above)
 *
 * Mirrors the public shape of GET /api/banners (adminBilling.ts →
 * pricingRepo.getActiveBanners) over the promotion_banners table.
 * All mutations are audit-logged.
 */

import type { Express } from "express";
import { z } from "zod";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { logger } from "../../lib/logger";
import { logAdminAudit } from "../../lib/adminAuditLogger";
import { getActingAdminId } from "../../lib/getActingAdminId";
import { pricingRepo } from "../../repositories/pricingRepo";

const bannerBodySchema = z.object({
  imageUrl: z.string().min(1, "imageUrl is required").max(1024),
  title: z.string().max(200).nullish(),
  subtitle: z.string().max(300).nullish(),
  linkUrl: z.string().max(1024).nullish(),
  linkType: z.enum(["internal", "external", "none"]).optional(),
  placement: z.enum(["discover", "landing", "both"]).optional(),
  city: z.string().max(50).nullish(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  effectiveFrom: z.string().datetime().nullish(),
  effectiveUntil: z.string().datetime().nullish(),
});

const bannerUpdateSchema = bannerBodySchema
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: "至少需要一项修改" });

function toBannerValues(body: z.infer<typeof bannerUpdateSchema>) {
  const values: Record<string, unknown> = { ...body };
  if (body.effectiveFrom !== undefined) {
    values.effectiveFrom = body.effectiveFrom === null ? null : new Date(body.effectiveFrom);
  }
  if (body.effectiveUntil !== undefined) {
    values.effectiveUntil = body.effectiveUntil === null ? null : new Date(body.effectiveUntil);
  }
  return values;
}

export function registerAdminBannerRoutes(app: Express): void {
  app.get("/api/admin/banners", requireAdmin, async (_req, res) => {
    try {
      const banners = await pricingRepo.listAllBanners();
      return res.json(banners);
    } catch (error) {
      logger.error("[AdminBanners] list failed", { error: String(error) });
      return res.status(500).json({ message: "Failed to fetch banners" });
    }
  });

  app.post("/api/admin/banners", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const parsed = bannerBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid banner payload",
          errors: parsed.error.issues,
        });
      }

      // createdBy FK → users.id. RBAC admin sessions carry adminAccountId
      // (not a users.id), so only persist a creator when the acting session
      // is a legacy user-backed admin; the RBAC identity is always captured
      // in the audit record below.
      const banner = await pricingRepo.createBanner({
        ...toBannerValues(parsed.data),
        imageUrl: parsed.data.imageUrl,
        createdBy: (req.session as any)?.userId ?? null,
      } as Parameters<typeof pricingRepo.createBanner>[0]);

      logAdminAudit({
        action: "BANNER_CREATED",
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: "promotion_banner",
        targetEntityId: banner.id,
        after: {
          title: banner.title,
          placement: banner.placement,
          isActive: banner.isActive,
          sortOrder: banner.sortOrder,
        },
      });

      return res.status(201).json(banner);
    } catch (error) {
      logger.error("[AdminBanners] create failed", { error: String(error) });
      return res.status(500).json({ message: "Failed to create banner" });
    }
  });

  app.patch("/api/admin/banners/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const parsed = bannerUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid banner payload",
          errors: parsed.error.issues,
        });
      }

      const banner = await pricingRepo.updateBanner(
        req.params.id,
        toBannerValues(parsed.data) as Parameters<typeof pricingRepo.updateBanner>[1],
      );
      if (!banner) {
        return res.status(404).json({ message: "Banner not found" });
      }

      logAdminAudit({
        action: "BANNER_UPDATED",
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: "promotion_banner",
        targetEntityId: banner.id,
        after: {
          title: banner.title,
          placement: banner.placement,
          isActive: banner.isActive,
          sortOrder: banner.sortOrder,
        },
      });

      return res.json(banner);
    } catch (error) {
      logger.error("[AdminBanners] update failed", { error: String(error) });
      return res.status(500).json({ message: "Failed to update banner" });
    }
  });

  app.delete("/api/admin/banners/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const banner = await pricingRepo.deleteBanner(req.params.id);
      if (!banner) {
        return res.status(404).json({ message: "Banner not found" });
      }

      logAdminAudit({
        action: "BANNER_DELETED",
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: "promotion_banner",
        targetEntityId: banner.id,
        before: {
          title: banner.title,
          placement: banner.placement,
          isActive: banner.isActive,
        },
      });

      return res.json({ message: "Banner deleted", id: banner.id });
    } catch (error) {
      logger.error("[AdminBanners] delete failed", { error: String(error) });
      return res.status(500).json({ message: "Failed to delete banner" });
    }
  });
}
