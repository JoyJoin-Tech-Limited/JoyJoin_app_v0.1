import type { Express, Request } from "express";
import { normalizeSubscriptionPlanType } from "@joyjoin/shared/api";
import { requireAdmin } from "../../adminAuth";
import { paymentEndpointLimiter, webhookEndpointLimiter } from "../../rateLimiter";
import { logger } from "../../lib/logger";
import { paymentService } from "../../paymentService";
import { paymentsRepo } from "../../repositories/paymentsRepo";
import { usersRepo } from "../../repositories/usersRepo";
import { subscriptionService } from "../../subscriptionService";
import { storage } from "../../storage";
import { isPhoneAuthenticated } from "../../phoneAuth";
import { logAdminAudit } from "../../lib/adminAuditLogger";

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

      const renewalData = await subscriptionService.renewSubscription(userId, normalizedPlanType);

      let couponId: string | undefined;
      if (couponCode) {
        const coupons = await storage.getAllCoupons();
        const coupon = coupons.find(c => c.code === couponCode && c.isActive);
        if (coupon) {
          couponId = coupon.id;
        }
      }

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

  app.post("/api/payments/create", paymentEndpointLimiter, isPhoneAuthenticated, checkPaymentsEnabled, async (req, res) => {
    const reqLogger = logger.child({ request_id: req.requestId });
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { paymentType, relatedId, originalAmount, couponCode } = req.body;

      let couponId: string | undefined;
      if (couponCode) {
        const coupons = await storage.getAllCoupons();
        const coupon = coupons.find(c => c.code === couponCode && c.isActive);
        if (coupon) {
          couponId = coupon.id;
        }
      }

      const paymentResult = await paymentService.createPayment({
        userId,
        paymentType,
        relatedId,
        originalAmount,
        couponId,
        clientIp: getRequestClientIp(req),
      });

      res.json(paymentResult);
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

        const { type, eventId, planId, openid } = req.body ?? {};
        const user = await usersRepo.getUser(userId);
        const sessionOpenId = user?.wechatOpenId?.trim();
        if (!sessionOpenId) {
          return res.status(400).json({ error: "User is not authenticated with WeChat" });
        }

        if (typeof openid !== "string" || openid.trim().length === 0) {
          return res.status(400).json({ error: "Missing openid parameter" });
        }

        const requestedOpenId = openid.trim();
        if (sessionOpenId !== requestedOpenId) {
          return res.status(400).json({ error: "OpenID mismatch" });
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
            openid: requestedOpenId,
          });

          return res.json({
            ...paymentResult,
            outTradeNo: paymentResult.wechatOrderId,
            type,
          });
        }

        const normalizedPlanType =
          planId === "vip_quarterly" || type === "vip_quarterly"
            ? "quarterly"
            : planId === "vip_monthly" || type === "vip_monthly"
              ? "monthly"
              : null;

        if (!normalizedPlanType) {
          return res.status(400).json({ error: "Unsupported mini-program payment type" });
        }

        const renewalData = await subscriptionService.renewSubscription(userId, normalizedPlanType);
        const paymentResult = await paymentService.createMiniProgramPayment({
          userId,
          paymentType: "event_bundle",
          relatedId: renewalData.subscriptionId,
          originalAmount: renewalData.amount,
          clientIp: getRequestClientIp(req),
          openid: requestedOpenId,
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

  app.post("/api/admin/payments/:paymentId/refund", requireAdmin, async (req, res) => {
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
