import type { Express, Request } from "express";
import { requireAdmin } from "../../adminAuth";
import { paymentEndpointLimiter, webhookEndpointLimiter } from "../../rateLimiter";
import { paymentService } from "../../paymentService";
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
  // Create subscription renewal (returns payment details)
  app.post("/api/subscription/renew", paymentEndpointLimiter, isPhoneAuthenticated, checkPaymentsEnabled, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { planType, couponCode } = req.body;

      if (!planType || !["monthly", "quarterly"].includes(planType)) {
        return res.status(400).json({ message: "Invalid plan type" });
      }

      const renewalData = await subscriptionService.renewSubscription(userId, planType);

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

      res.json({
        subscription: renewalData,
        payment: paymentResult,
      });
    } catch (error) {
      console.error("Error renewing subscription:", error);
      res.status(500).json({ message: "Failed to renew subscription" });
    }
  });

  // Cancel subscription
  app.post("/api/subscription/cancel", isPhoneAuthenticated, async (req, res) => {
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
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // ============ PAYMENT & WEBHOOKS ============

  app.post("/api/payments/create", paymentEndpointLimiter, isPhoneAuthenticated, checkPaymentsEnabled, async (req, res) => {
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
      console.error("Error creating payment:", error);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  app.post(
    "/api/webhooks/wechat-pay",
    webhookEndpointLimiter,
    async (req: any, res) => {
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
        console.error("Error processing WeChat Pay webhook:", error);
        const status = error?.status === 401 ? 401 : 500;
        res.status(status).json({ code: "FAIL", message: "Webhook processing failed" });
      }
    }
  );

  app.get("/api/payments/:wechatOrderId/status", isPhoneAuthenticated, async (req, res) => {
    try {
      const { wechatOrderId } = req.params;
      const status = await paymentService.queryPaymentStatus(wechatOrderId);
      res.json({ status });
    } catch (error) {
      console.error("Error querying payment status:", error);
      res.status(500).json({ message: "Failed to query payment status" });
    }
  });

  app.get("/api/admin/payments", requireAdmin, async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.post("/api/admin/payments/:paymentId/refund", requireAdmin, async (req, res) => {
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
      console.error("Error creating refund:", error);
      res.status(500).json({ message: "Failed to create refund" });
    }
  });
}
