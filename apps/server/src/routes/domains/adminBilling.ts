import type { Express } from "express";
import { z } from "zod";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { logger } from "../../lib/logger";
import { getActingAdminId } from "../../lib/getActingAdminId";
import { logAdminAudit } from "../../lib/adminAuditLogger";
import { storage } from "../../storage";

const subscriptionSchema = z.object({
  userId: z.string().min(1),
  planType: z.string().min(1),
  status: z.string().min(1),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const couponSchema = z.object({
  code: z.string().min(1),
  discountType: z.string().min(1),
  discountValue: z.number().min(0),
  usageLimit: z.number().int().min(1).optional(),
  expiryDate: z.string().datetime().optional(),
});

const pricingSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
  currency: z.string().default("HKD"),
  description: z.string().optional(),
});

export function registerAdminBillingRoutes(app: Express): void {
  // Subscription Management - Get all subscriptions with pagination
  app.get("/api/admin/subscriptions", requireAdmin, async (req, res) => {
    try {
      const { filter } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      
      let subscriptions;
      
      if (filter === "active") {
        subscriptions = await storage.getActiveSubscriptions();
      } else {
        subscriptions = await storage.getAllSubscriptions();
      }

      const total = subscriptions.length;
      const paginatedData = subscriptions.slice(offset, offset + limit);

      res.json({
        subscriptions: paginatedData,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error("Error fetching subscriptions", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  // Subscription Management - Create subscription
  app.post("/api/admin/subscriptions", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { userId, planType, durationMonths } = req.body;
      
      if (!userId || !planType || !durationMonths) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + durationMonths);

      const subscription = await storage.createSubscription({
        userId,
        planType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isActive: true,
        autoRenew: false,
      });

      res.json(subscription);
    } catch (error) {
      logger.error("Error creating subscription", { error: String(error) });
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  // Subscription Management - Update subscription
  app.patch("/api/admin/subscriptions/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { isActive, autoRenew, endDate } = req.body;
      
      const subscription = await storage.updateSubscription(req.params.id, {
        isActive,
        autoRenew,
        endDate,
      });

      res.json(subscription);
    } catch (error) {
      logger.error("Error updating subscription", { error: String(error) });
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  // Coupon Management - Get all coupons
  app.get("/api/admin/coupons", requireAdmin, async (req, res) => {
    try {
      const coupons = await storage.getAllCoupons();
      res.json(coupons);
    } catch (error) {
      logger.error("Error fetching coupons", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  // Coupon Management - Get coupon details
  app.get("/api/admin/coupons/:id", requireAdmin, async (req, res) => {
    try {
      const coupon = await storage.getCoupon(req.params.id);
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      res.json(coupon);
    } catch (error) {
      logger.error("Error fetching coupon", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch coupon" });
    }
  });

  // Coupon Management - Get coupon usage stats
  app.get("/api/admin/coupons/:id/usage", requireAdmin, async (req, res) => {
    try {
      const usage = await storage.getCouponUsageStats(req.params.id);
      res.json(usage);
    } catch (error) {
      logger.error("Error fetching coupon usage", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch coupon usage" });
    }
  });

  // Coupon Management - Create coupon
  app.post("/api/admin/coupons", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { code, discountType, discountValue, validFrom, validUntil, maxUses } = req.body;
      
      if (!code || !discountType || !discountValue) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const coupon = await storage.createCoupon({
        code: code.toUpperCase(),
        discountType,
        discountValue,
        validFrom: validFrom || new Date().toISOString(),
        validUntil: validUntil || null,
        maxUses: maxUses || null,
        isActive: true,
      });

      res.json(coupon);
    } catch (error) {
      logger.error("Error creating coupon", { error: String(error) });
      res.status(500).json({ message: "Failed to create coupon" });
    }
  });

  // Coupon Management - Update coupon
  app.patch("/api/admin/coupons/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const coupon = await storage.updateCoupon(req.params.id, req.body);
      res.json(coupon);
    } catch (error) {
      logger.error("Error updating coupon", { error: String(error) });
      res.status(500).json({ message: "Failed to update coupon" });
    }
  });

  // ============ PUBLIC STATS ============

  // Public API - Get platform stats for landing page
  app.get("/api/public/stats", async (req, res) => {
    try {
      const stats = await storage.getPublicStats();
      res.json(stats);
    } catch (error) {
      logger.error("Error fetching public stats", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ============ PROMOTION BANNERS ============

  // Public API - Get active banners
  app.get("/api/banners", async (req, res) => {
    try {
      const { city, placement } = req.query;
      const banners = await storage.getActiveBanners(
        city as string | undefined,
        placement as string | undefined
      );
      res.json(banners);
    } catch (error) {
      logger.error("Error fetching banners", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch banners" });
    }
  });

  // ============ PRICING MANAGEMENT ============

  // Public API - Get active pricing settings (for payment page)
  app.get("/api/pricing", async (req, res) => {
    try {
      const settings = await storage.getActivePricingSettings();
      const formatted = settings.map(s => ({
        id: s.id,
        planType: s.planType,
        displayName: s.displayName,
        displayNameEn: s.displayNameEn,
        name: s.displayName,
        nameEn: s.displayNameEn,
        description: s.description,
        price: s.priceInCents / 100,
        originalPrice: s.originalPriceInCents ? s.originalPriceInCents / 100 : null,
        durationDays: s.durationDays,
        isActive: s.isActive,
        isFeatured: s.isFeatured,
      }));
      res.json(formatted);
    } catch (error) {
      logger.error("Error fetching pricing", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch pricing" });
    }
  });

  // Admin - Get all pricing settings
  app.get("/api/admin/pricing", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllPricingSettings();
      res.json(settings);
    } catch (error) {
      logger.error("Error fetching pricing settings", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch pricing settings" });
    }
  });

  // Admin - Get single pricing setting
  app.get("/api/admin/pricing/:id", requireAdmin, async (req, res) => {
    try {
      const setting = await storage.getPricingSetting(req.params.id);
      if (!setting) {
        return res.status(404).json({ message: "Pricing setting not found" });
      }
      res.json(setting);
    } catch (error) {
      logger.error("Error fetching pricing setting", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch pricing setting" });
    }
  });

  // Admin - Update pricing setting
  app.patch("/api/admin/pricing/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { displayName, displayNameEn, description, priceInCents, originalPriceInCents, durationDays, sortOrder, isActive, isFeatured } = req.body;
      
      const setting = await storage.updatePricingSetting(req.params.id, {
        displayName,
        displayNameEn,
        description,
        priceInCents,
        originalPriceInCents,
        durationDays,
        sortOrder,
        isActive,
        isFeatured,
      });
      
      res.json(setting);
    } catch (error) {
      logger.error("Error updating pricing setting", { error: String(error) });
      res.status(500).json({ message: "Failed to update pricing setting" });
    }
  });


}
