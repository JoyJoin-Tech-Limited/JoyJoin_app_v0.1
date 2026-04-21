import type { Express, Request } from "express";
import { isEventPackPlanType, normalizeSubscriptionPlanType } from "@shared/api";
import { eventPoolRegistrations } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { paymentEndpointLimiter, webhookEndpointLimiter } from "../../rateLimiter";
import { logger } from "../../lib/logger";
import { describePoolRegistrationAvailability } from "../../lib/poolRegistrationRules";
import { paymentService } from "../../paymentService";
import { paymentsRepo } from "../../repositories/paymentsRepo";
import { usersRepo } from "../../repositories/usersRepo";
import { subscriptionService } from "../../subscriptionService";
import { storage } from "../../storage";
import { isPhoneAuthenticated } from "../../phoneAuth";
import { logAdminAudit } from "../../lib/adminAuditLogger";
import { db } from "../../db";

function getActingAdminId(req: any): string {
  return req.adminAccount?.id ?? req.session?.userId ?? "unknown";
}

const getRequestClientIp = (req: Request): string => {
  const forwardedFor = req.headers["x-forwarded-for"];
  return (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(",")[0]?.trim()
    || req.ip
    || req.socket.remoteAddress
    || "127.0.0.1";
};

function checkPaymentsEnabled(req: any, res: any, next: any) {
  const enabled = (process.env.PAYMENTS_ENABLED ?? "false").toLowerCase() === "true";
  if (!enabled) {
    return res.status(503).json({
      error: "Payment system is currently disabled for maintenance",
      code: "PAYMENTS_DISABLED",
    });
  }
  next();
}

type SupportedPaymentType = "subscription" | "event" | "event_bundle" | "event_pack";

const EVENT_PACK_PRICE_FALLBACKS = {
  pack_3: 21100,
  pack_6: 37000,
} as const;

const SUBSCRIPTION_PRICE_FALLBACKS = {
  monthly: 9800,
  quarterly: 29400,
} as const;

type NormalizedEventRegistrationPayload = {
  poolId: string;
  city: string | null;
  district: string | null;
  eventType: string | null;
  budgetRange: string[];
  preferredLanguages: string[];
  tasteIntensity: string[];
  cuisinePreferences: string[];
  eventIntent: string[];
  dietaryRestrictions: string[];
};

const POOL_AVAILABILITY_MESSAGES: Record<string, string> = {
  POOL_CANCELLED: "该活动盲盒已取消",
  POOL_CLOSED: "该活动盲盒已停止报名",
  REGISTRATION_DEADLINE_PASSED: "该活动盲盒已截止报名",
  POOL_FULL: "该活动盲盒已满员",
};

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function getNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function calculateCouponDiscountAmount(coupon: any, originalAmount: number): number {
  const discountType = coupon.discountType ?? coupon.discount_type;
  const discountValue = parseNumber(coupon.discountValue ?? coupon.discount_value) ?? 0;

  if (discountType === "fixed_amount") {
    return Math.min(originalAmount, discountValue);
  }

  if (discountType === "percentage") {
    return Math.floor(originalAmount * (discountValue / 100));
  }

  return 0;
}

function normalizeEventRegistrationPayload(payload: unknown): NormalizedEventRegistrationPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const source = payload as Record<string, unknown>;
  const poolId = getNonEmptyString(source.poolId);
  if (!poolId) {
    return null;
  }

  const budgetRange = toStringArray(source.budgetRange);
  const budgetTier = toStringArray(source.budgetTier);
  const budget = toStringArray(source.budget);
  const normalizedBudgetRange = budgetRange.length > 0 ? budgetRange : budgetTier.length > 0 ? budgetTier : budget;

  if (normalizedBudgetRange.length === 0) {
    return null;
  }

  const preferredLanguages = toStringArray(source.preferredLanguages);
  const selectedLanguages = toStringArray(source.selectedLanguages);
  const tasteIntensity = toStringArray(source.tasteIntensity);
  const selectedTasteIntensity = toStringArray(source.selectedTasteIntensity);
  const cuisinePreferences = toStringArray(source.cuisinePreferences);
  const selectedCuisines = toStringArray(source.selectedCuisines);

  return {
    poolId,
    city: getNonEmptyString(source.city),
    district: getNonEmptyString(source.district) ?? getNonEmptyString(source.area),
    eventType: getNonEmptyString(source.eventType),
    budgetRange: normalizedBudgetRange,
    preferredLanguages: preferredLanguages.length > 0 ? preferredLanguages : selectedLanguages,
    tasteIntensity: tasteIntensity.length > 0 ? tasteIntensity : selectedTasteIntensity,
    cuisinePreferences: cuisinePreferences.length > 0 ? cuisinePreferences : selectedCuisines,
    eventIntent: toStringArray(source.eventIntent),
    dietaryRestrictions: toStringArray(source.dietaryRestrictions),
  };
}

async function getEventSinglePaymentAmount(): Promise<number> {
  const pricing = await storage.getActivePricingSettings().catch(() => []);
  const eventSinglePlan = pricing.find((item: any) => item.planType === "event_single");
  return eventSinglePlan?.priceInCents ?? 8800;
}

async function getActivePricingPlan(planType: string): Promise<any | null> {
  const pricing = await storage.getActivePricingSettings().catch(() => []);
  return pricing.find((item: any) => item.planType === planType) ?? null;
}

async function resolveSubscriptionCheckout(
  planType: string,
): Promise<{ ok: true; originalAmount: number } | { ok: false; message: string }> {
  const normalizedPlanType = normalizeSubscriptionPlanType(planType);
  if (!normalizedPlanType) {
    return { ok: false, message: "Invalid plan type" };
  }

  const pricingPlan = await getActivePricingPlan(normalizedPlanType);
  return {
    ok: true,
    originalAmount: pricingPlan?.priceInCents ?? SUBSCRIPTION_PRICE_FALLBACKS[normalizedPlanType],
  };
}

async function resolveEventPackCheckout(
  planTypeInput: unknown,
): Promise<
  | { ok: true; originalAmount: number; relatedId: "pack_3" | "pack_6" }
  | { ok: false; message: string }
> {
  const planType = getNonEmptyString(planTypeInput);
  if (!planType || !isEventPackPlanType(planType)) {
    return { ok: false, message: "Unsupported event pack type" };
  }

  const pricingPlan = await getActivePricingPlan(planType);
  return {
    ok: true,
    relatedId: planType,
    originalAmount: pricingPlan?.priceInCents ?? EVENT_PACK_PRICE_FALLBACKS[planType],
  };
}

async function resolveCouponValidation(
  userId: string,
  couponCode: string,
  originalAmount: number,
): Promise<
  | {
      valid: true;
      couponId: string;
      coupon: {
        id: string;
        code: string;
        discountType: string | null;
        discountValue: number | null;
      };
      discountAmount: number;
      finalAmount: number;
    }
  | {
      valid: false;
      message: string;
    }
> {
  const normalizedCode = couponCode.trim().toUpperCase();
  if (!normalizedCode) {
    return { valid: false, message: "请输入优惠码" };
  }

  const assignedCoupon = await paymentsRepo.getAvailableUserCouponByCode(userId, normalizedCode);
  const globalCoupon = assignedCoupon ? null : await paymentsRepo.getCouponByCode(normalizedCode);

  if (!assignedCoupon && !globalCoupon) {
    return { valid: false, message: "此优惠码不可用或已过期" };
  }

  const couponRecord = assignedCoupon ?? globalCoupon;
  const couponId = String(
    couponRecord?.couponId ?? couponRecord?.coupon_id ?? couponRecord?.id ?? "",
  );

  if (!couponId) {
    return { valid: false, message: "此优惠码不可用或已过期" };
  }

  if (!assignedCoupon && globalCoupon) {
    const assignmentCount = await paymentsRepo.countUserCouponAssignments(couponId);
    if (assignmentCount > 0) {
      return { valid: false, message: "此优惠码不可用或已过期" };
    }
  }

  const isActive = Boolean(couponRecord.isActive ?? couponRecord.is_active);
  const validFromValue = couponRecord.validFrom ?? couponRecord.valid_from;
  const validUntilValue = couponRecord.validUntil ?? couponRecord.valid_until;
  const usageLimit = parseNumber(couponRecord.maxUses ?? couponRecord.usageLimit ?? couponRecord.usage_limit);
  const currentUses = parseNumber(couponRecord.currentUses ?? couponRecord.usedCount ?? couponRecord.used_count) ?? 0;
  const minPurchase = parseNumber(couponRecord.minPurchase ?? couponRecord.min_purchase) ?? 0;
  const validFrom = validFromValue ? new Date(validFromValue) : null;
  const validUntil = validUntilValue ? new Date(validUntilValue) : null;
  const now = new Date();

  if (!isActive) {
    return { valid: false, message: "此优惠码不可用或已过期" };
  }

  if (validFrom && !Number.isNaN(validFrom.getTime()) && now < validFrom) {
    return { valid: false, message: "此优惠码尚未生效" };
  }

  if (validUntil && !Number.isNaN(validUntil.getTime()) && now > validUntil) {
    return { valid: false, message: "此优惠码不可用或已过期" };
  }

  if (usageLimit !== null && currentUses >= usageLimit) {
    return { valid: false, message: "此优惠码已达使用上限" };
  }

  if (minPurchase > 0 && originalAmount < minPurchase) {
    return { valid: false, message: `订单金额未达到优惠门槛（满¥${(minPurchase / 100).toFixed(0)}可用）` };
  }

  const discountAmount = calculateCouponDiscountAmount(couponRecord, originalAmount);
  if (discountAmount <= 0) {
    return { valid: false, message: "此优惠码不可用或已过期" };
  }

  return {
    valid: true,
    couponId,
    coupon: {
      id: couponId,
      code: normalizedCode,
      discountType: (couponRecord.discountType ?? couponRecord.discount_type ?? null) as string | null,
      discountValue: parseNumber(couponRecord.discountValue ?? couponRecord.discount_value),
    },
    discountAmount,
    finalAmount: Math.max(0, originalAmount - discountAmount),
  };
}

async function resolveEventCheckout(
  userId: string,
  payload: unknown,
): Promise<
  | {
      ok: true;
      originalAmount: number;
      relatedId: string;
      eventRegistrationPayload: NormalizedEventRegistrationPayload;
    }
  | {
      ok: false;
      status: number;
      message: string;
      code?: string;
    }
> {
  const eventRegistrationPayload = normalizeEventRegistrationPayload(payload);
  if (!eventRegistrationPayload) {
    return {
      ok: false,
      status: 400,
      message: "参数不完整：需要 poolId 与 budgetTier",
    };
  }

  const pool = await db.query.eventPools.findFirst({
    where: (pools: any, { eq: eqFn }: any) => eqFn(pools.id, eventRegistrationPayload.poolId),
    columns: {
      id: true,
      status: true,
      registrationDeadline: true,
      minGroupSize: true,
      maxGroupSize: true,
      targetGroups: true,
    },
  });

  if (!pool) {
    return {
      ok: false,
      status: 404,
      message: "指定的活动池不存在或已关闭报名",
    };
  }

  const existingRegistration = await db.query.eventPoolRegistrations.findFirst({
    where: (registrations: any, { and: andFn, eq: eqFn }: any) =>
      andFn(eqFn(registrations.poolId, eventRegistrationPayload.poolId), eqFn(registrations.userId, userId)),
    columns: { id: true },
  });

  if (existingRegistration) {
    return {
      ok: false,
      status: 400,
      message: "你已经报名过这个活动盲盒啦，无法重复报名",
    };
  }

  const [registrationCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventPoolRegistrations)
    .where(eq(eventPoolRegistrations.poolId, eventRegistrationPayload.poolId));

  const availability = describePoolRegistrationAvailability(
    {
      status: pool.status,
      registrationDeadline: pool.registrationDeadline,
      minGroupSize: pool.minGroupSize,
      maxGroupSize: pool.maxGroupSize,
      targetGroups: pool.targetGroups,
    },
    registrationCountRow?.count ?? 0,
  );

  if (!availability.allowed) {
    return {
      ok: false,
      status: availability.status,
      code: availability.code,
      message: POOL_AVAILABILITY_MESSAGES[availability.code] ?? availability.message,
    };
  }

  return {
    ok: true,
    originalAmount: await getEventSinglePaymentAmount(),
    relatedId: eventRegistrationPayload.poolId,
    eventRegistrationPayload,
  };
}

export function registerPaymentRoutes(app: Express): void {
  const respondWithPaymentStatus = async (req: Request, res: any) => {
    const reqLogger = logger.child({ request_id: req.requestId });
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { wechatOrderId } = req.params as { wechatOrderId: string };
      const payment = await paymentsRepo.getPaymentByWechatOrderId(wechatOrderId);

      if (!payment || payment.userId !== userId) {
        reqLogger.warn("Rejected payment status query for non-owned payment", {
          order_id: wechatOrderId,
          user_id: userId,
        });
        return res.status(404).json({ message: "Payment not found" });
      }

      const status = await paymentService.queryPaymentStatus(wechatOrderId);
      res.json({ status });
    } catch (error) {
      reqLogger.error("Failed to query payment status", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Failed to query payment status" });
    }
  };

  // Get current user's subscription status
  app.get("/api/subscription/status", isPhoneAuthenticated, async (req, res) => {
    const reqLogger = logger.child({ request_id: req.requestId });
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const status = await subscriptionService.getUserSubscriptionStatus(userId);
      res.json(status);
    } catch (error) {
      reqLogger.error("Failed to fetch subscription status", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Failed to fetch subscription status" });
    }
  });

  // Create subscription renewal (returns payment details)
  app.post("/api/subscription/renew", paymentEndpointLimiter, isPhoneAuthenticated, checkPaymentsEnabled, async (req, res) => {
    const reqLogger = logger.child({ request_id: req.requestId });
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { planType, couponCode } = req.body;
      const normalizedPlanType = normalizeSubscriptionPlanType(planType);

      if (!normalizedPlanType) {
        return res.status(400).json({ message: "Invalid plan type" });
      }

      const renewalQuote = await resolveSubscriptionCheckout(normalizedPlanType);
      if (!renewalQuote.ok) {
        return res.status(400).json({ message: renewalQuote.message });
      }

      let couponId: string | undefined;
      if (couponCode) {
        const couponValidation = await resolveCouponValidation(userId, String(couponCode), renewalQuote.originalAmount);
        if (!couponValidation.valid) {
          return res.status(400).json({ message: couponValidation.message });
        }

        couponId = couponValidation.couponId;
      }

      const renewalData = await subscriptionService.renewSubscription(userId, normalizedPlanType);

      const paymentResult = await paymentService.createPayment({
        userId,
        paymentType: "event_bundle",
        relatedId: renewalData.subscriptionId,
        originalAmount: renewalData.amount,
        couponId,
        clientIp: getRequestClientIp(req),
      });

      const paymentRedirectUrl = paymentResult.h5Url ?? null;
      const paymentStatus = paymentRedirectUrl ? "pending" : "completed";

      res.json({
        subscription: renewalData,
        payment: paymentResult,
        paymentRedirectUrl,
        paymentStatus,
      });
    } catch (error) {
      reqLogger.error("Failed to renew subscription", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Failed to renew subscription" });
    }
  });

  // Cancel subscription
  app.post("/api/subscription/cancel", isPhoneAuthenticated, async (req, res) => {
    const reqLogger = logger.child({ request_id: req.requestId });
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const subscription = await storage.getUserSubscription(userId);
      if (!subscription) {
        return res.status(404).json({ message: "No active subscription found" });
      }

      await subscriptionService.cancelSubscription(subscription.id, req.body.reason);
      res.json({ message: "Subscription cancelled" });
    } catch (error) {
      reqLogger.error("Failed to cancel subscription", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // ============ PAYMENT & WEBHOOKS ============

  app.post("/api/coupons/validate", paymentEndpointLimiter, isPhoneAuthenticated, checkPaymentsEnabled, async (req, res) => {
    const reqLogger = logger.child({ request_id: req.requestId });
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      let originalAmount: number | null = null;

      if (req.body?.paymentType === "event") {
        const eventCheckout = await resolveEventCheckout(userId, req.body?.eventRegistrationPayload ?? req.body);
        if (!eventCheckout.ok) {
          return res.json({
            valid: false,
            message: eventCheckout.message,
            code: eventCheckout.code,
          });
        }

        originalAmount = eventCheckout.originalAmount;
      } else if (req.body?.paymentType === "event_pack") {
        const eventPackCheckout = await resolveEventPackCheckout(
          req.body?.planId ?? req.body?.relatedId ?? req.body?.type,
        );
        if (!eventPackCheckout.ok) {
          return res.json({ valid: false, message: eventPackCheckout.message });
        }

        originalAmount = eventPackCheckout.originalAmount;
      } else if (req.body?.paymentType === "event_bundle" || req.body?.paymentType === "subscription") {
        const subscriptionCheckout = await resolveSubscriptionCheckout(
          String(req.body?.planType ?? req.body?.planId ?? req.body?.type ?? ""),
        );
        if (!subscriptionCheckout.ok) {
          return res.json({ valid: false, message: subscriptionCheckout.message });
        }

        originalAmount = subscriptionCheckout.originalAmount;
      } else {
        return res.json({ valid: false, message: "当前支付类型暂不支持优惠码" });
      }

      const couponValidation = await resolveCouponValidation(
        userId,
        String(req.body?.code ?? ""),
        originalAmount,
      );

      return res.json(couponValidation);
    } catch (error) {
      reqLogger.error("Failed to validate coupon", {
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({ valid: false, message: "无法验证优惠码，请稍后重试" });
    }
  });

  app.post("/api/payments/create", paymentEndpointLimiter, isPhoneAuthenticated, checkPaymentsEnabled, async (req, res) => {
    const reqLogger = logger.child({ request_id: req.requestId });
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { paymentType, relatedId, originalAmount, couponCode } = req.body ?? {};

      if (!["subscription", "event", "event_bundle", "event_pack"].includes(String(paymentType))) {
        return res.status(400).json({ message: "Unsupported payment type" });
      }

      const normalizedPaymentType = String(paymentType) as SupportedPaymentType;
      let resolvedRelatedId = getNonEmptyString(relatedId);
      let resolvedOriginalAmount = parseNumber(originalAmount);
      let eventRegistrationPayload: NormalizedEventRegistrationPayload | undefined;

      if (normalizedPaymentType === "event") {
        const eventCheckout = await resolveEventCheckout(userId, req.body?.eventRegistrationPayload ?? req.body);
        if (!eventCheckout.ok) {
          return res.status(eventCheckout.status).json({
            message: eventCheckout.message,
            code: eventCheckout.code,
          });
        }

        resolvedRelatedId = eventCheckout.relatedId;
        resolvedOriginalAmount = eventCheckout.originalAmount;
        eventRegistrationPayload = eventCheckout.eventRegistrationPayload;
      } else if (normalizedPaymentType === "event_pack") {
        const eventPackCheckout = await resolveEventPackCheckout(req.body?.planId ?? relatedId ?? req.body?.type);
        if (!eventPackCheckout.ok) {
          return res.status(400).json({ message: eventPackCheckout.message });
        }

        resolvedRelatedId = eventPackCheckout.relatedId;
        resolvedOriginalAmount = eventPackCheckout.originalAmount;
      }

      if (!resolvedRelatedId) {
        return res.status(400).json({ message: "Missing related payment target" });
      }

      if (resolvedOriginalAmount === null) {
        return res.status(400).json({ message: "Invalid payment amount" });
      }

      let couponId: string | undefined;
      if (couponCode) {
        const couponValidation = await resolveCouponValidation(
          userId,
          String(couponCode),
          resolvedOriginalAmount,
        );
        if (!couponValidation.valid) {
          return res.status(400).json({ message: couponValidation.message });
        }

        couponId = couponValidation.couponId;
      }

      const paymentResult = await paymentService.createPayment({
        userId,
        paymentType: normalizedPaymentType,
        relatedId: resolvedRelatedId,
        originalAmount: resolvedOriginalAmount,
        couponId,
        eventRegistrationPayload,
        clientIp: getRequestClientIp(req),
      });

      const paymentRedirectUrl = paymentResult.h5Url ?? null;
      const paymentStatus = paymentRedirectUrl ? "pending" : "completed";

      res.json({
        payment: paymentResult,
        paymentRedirectUrl,
        paymentStatus,
      });
    } catch (error) {
      reqLogger.error("Failed to create payment", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  app.post(
    "/api/payments/miniprogram/create",
    paymentEndpointLimiter,
    isPhoneAuthenticated,
    checkPaymentsEnabled,
    async (req, res) => {
      const reqLogger = logger.child({ request_id: req.requestId });

      try {
        const userId = req.session.userId;
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { type, eventId, planId, openid, couponCode } = req.body ?? {};
        const user = await usersRepo.getUser(userId);
        const sessionOpenId = user?.wechatOpenId?.trim();
        if (!sessionOpenId) {
          return res.status(400).json({ error: "User is not authenticated with WeChat" });
        }

        const requestedOpenId = getNonEmptyString(openid);
        if (requestedOpenId && sessionOpenId !== requestedOpenId) {
          return res.status(400).json({ error: "OpenID mismatch" });
        }

        const paymentOpenId = requestedOpenId ?? sessionOpenId;

        try {
          paymentService.assertMiniProgramAppIdConsistency();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invalid WeChat mini-program payment configuration";
          reqLogger.error("Rejected mini-program payment due to invalid app configuration", {
            error: message,
          });
          return res.status(503).json({
            error: message,
            code: "PAYMENT_CONFIG_ERROR",
          });
        }

        if (type === "event") {
          if (typeof eventId !== "string" || eventId.trim().length === 0) {
            return res.status(400).json({ error: "eventId is required for event payments" });
          }

          const pricing = await storage.getActivePricingSettings().catch(() => []);
          const eventSinglePlan = pricing.find((item: any) => item.planType === "event_single");
          const amountInCents = eventSinglePlan?.priceInCents ?? 8800;
          const paymentResult = await paymentService.createMiniProgramPayment({
            userId,
            paymentType: "event",
            relatedId: eventId.trim(),
            originalAmount: amountInCents,
            clientIp: getRequestClientIp(req),
            openid: paymentOpenId,
          });

          return res.json({
            ...paymentResult,
            outTradeNo: paymentResult.wechatOrderId,
            type,
          });
        }

        const selectedPlanType = getNonEmptyString(planId) ?? getNonEmptyString(type);

        if (selectedPlanType && isEventPackPlanType(selectedPlanType)) {
          const eventPackCheckout = await resolveEventPackCheckout(selectedPlanType);
          if (!eventPackCheckout.ok) {
            return res.status(400).json({ error: eventPackCheckout.message });
          }

          let couponId: string | undefined;
          if (couponCode) {
            const couponValidation = await resolveCouponValidation(
              userId,
              String(couponCode),
              eventPackCheckout.originalAmount,
            );
            if (!couponValidation.valid) {
              return res.status(400).json({ error: couponValidation.message });
            }

            couponId = couponValidation.couponId;
          }

          const paymentResult = await paymentService.createMiniProgramPayment({
            userId,
            paymentType: "event_pack",
            relatedId: eventPackCheckout.relatedId,
            originalAmount: eventPackCheckout.originalAmount,
            couponId,
            clientIp: getRequestClientIp(req),
            openid: paymentOpenId,
          });

          return res.json({
            ...paymentResult,
            outTradeNo: paymentResult.wechatOrderId,
            type: eventPackCheckout.relatedId,
          });
        }

        const normalizedPlanType = normalizeSubscriptionPlanType(selectedPlanType);
        if (!normalizedPlanType) {
          return res.status(400).json({ error: "Unsupported mini-program payment type" });
        }

        const renewalQuote = await resolveSubscriptionCheckout(normalizedPlanType);
        if (!renewalQuote.ok) {
          return res.status(400).json({ error: renewalQuote.message });
        }

        let couponId: string | undefined;
        if (couponCode) {
          const couponValidation = await resolveCouponValidation(
            userId,
            String(couponCode),
            renewalQuote.originalAmount,
          );
          if (!couponValidation.valid) {
            return res.status(400).json({ error: couponValidation.message });
          }

          couponId = couponValidation.couponId;
        }

        const renewalData = await subscriptionService.renewSubscription(userId, normalizedPlanType);
        const paymentResult = await paymentService.createMiniProgramPayment({
          userId,
          paymentType: "event_bundle",
          relatedId: renewalData.subscriptionId,
          originalAmount: renewalData.amount,
          couponId,
          clientIp: getRequestClientIp(req),
          openid: paymentOpenId,
        });

        res.json({
          ...paymentResult,
          outTradeNo: paymentResult.wechatOrderId,
          type: normalizedPlanType === "quarterly" ? "vip_quarterly" : "vip_monthly",
        });
      } catch (error) {
        reqLogger.error("Failed to create mini-program payment", {
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: "Failed to create mini-program payment" });
      }
    }
  );

  app.post(
    "/api/webhooks/wechat-pay",
    webhookEndpointLimiter,
    async (req: any, res) => {
      const reqLogger = logger.child({ request_id: req.requestId });
      let rawBody: string;
      let payload: any;
      try {
        if (typeof req.rawBody !== "string" || req.rawBody.length === 0) {
          return res.status(400).json({ code: "FAIL", message: "Missing raw body for signature verification" });
        }

        rawBody = req.rawBody;
        payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      } catch {
        return res.status(400).json({ code: "FAIL", message: "Invalid request body" });
      }

      const headers = {
        timestamp: req.headers["wechatpay-timestamp"] as string | undefined,
        nonce: req.headers["wechatpay-nonce"] as string | undefined,
        signature: req.headers["wechatpay-signature"] as string | undefined,
        serial: req.headers["wechatpay-serial"] as string | undefined,
      };

      try {
        await paymentService.handleWebhook(payload, rawBody, headers);
        res.json({ code: "SUCCESS", message: "OK" });
      } catch (error: any) {
        reqLogger.error("Failed to process WeChat Pay webhook", {
          error: error instanceof Error ? error.message : String(error),
        });
        const status = error?.status === 401 ? 401 : 500;
        res.status(status).json({ code: "FAIL", message: "Webhook processing failed" });
      }
    }
  );

  app.get("/api/payments/:wechatOrderId/status", isPhoneAuthenticated, respondWithPaymentStatus);
  app.get("/api/payments/status/:wechatOrderId", isPhoneAuthenticated, respondWithPaymentStatus);

  app.get("/api/admin/payments", requireAdmin, async (req, res) => {
    const reqLogger = logger.child({ request_id: req.requestId });
    try {
      const payments = await storage.getAllPayments();
      res.json(payments);
    } catch (error) {
      reqLogger.error("Failed to fetch payments", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.post("/api/admin/payments/:paymentId/refund", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const reqLogger = logger.child({ request_id: req.requestId });
    try {
      const { paymentId } = req.params;
      const { reason } = req.body;
      await paymentService.createRefund(paymentId, reason);

      logAdminAudit({
        action: 'PAYMENT_REFUND_INITIATED',
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: 'payment',
        targetEntityId: paymentId,
        context: { reason },
      });

      res.json({ message: "Refund initiated" });
    } catch (error) {
      reqLogger.error("Failed to create refund", {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ message: "Failed to create refund" });
    }
  });
}
