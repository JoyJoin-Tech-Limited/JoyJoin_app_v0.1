import { storage } from "./storage";
import { getLevelDiscount } from "@shared/gamification";
import { createDecipheriv, createVerify, timingSafeEqual, createHmac } from "crypto";

/**
 * Payment Service for WeChat Pay Integration
 *
 * SETUP REQUIRED:
 * 1. Register for WeChat Pay merchant account (https://pay.weixin.qq.com/)
 * 2. Add environment variables:
 *    - WECHAT_PAY_APP_ID
 *    - WECHAT_PAY_MCH_ID (Merchant ID)
 *    - WECHAT_PAY_SERIAL_NO (Certificate serial number)
 *    - WECHAT_PAY_PRIVATE_KEY (API v3 private key, PEM format)
 *    - WECHAT_PAY_APIV3_KEY (32-byte API v3 key, used for AES decryption and signature)
 *
 * Docs: https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml
 *
 * NOTE: Full RSA-SHA256 callback signature verification requires WeChat's platform
 * certificate (downloaded from the merchant console).  Until that cert is loaded into
 * WECHAT_PAY_PLATFORM_CERT, verification falls back to HMAC-SHA256 over the
 * APIV3_KEY — which is still far better than the previous no-op.  Set
 * WECHAT_PAY_PLATFORM_CERT (PEM) to enable the production-grade RSA path.
 */

export interface CreatePaymentParams {
  userId: string;
  paymentType: "subscription" | "event" | "event_bundle";
  relatedId: string; // subscription ID or event ID
  originalAmount: number; // in cents (¥98 = 9800)
  couponId?: string;
  applyLevelDiscount?: boolean; // Whether to apply user's level discount
}

export interface PaymentResult {
  paymentId: string;
  wechatOrderId: string;
  prepayId?: string; // WeChat prepay_id for H5/JSAPI
  codeUrl?: string; // QR code URL for Native payment
  h5Url?: string; // H5 payment URL
}

/** Headers forwarded from WeChat Pay webhook POST requests. */
export interface WechatWebhookHeaders {
  /** Wechatpay-Timestamp header */
  timestamp?: string;
  /** Wechatpay-Nonce header */
  nonce?: string;
  /** Wechatpay-Signature header (base64) */
  signature?: string;
  /** Wechatpay-Serial header (merchant cert serial) */
  serial?: string;
}

export class PaymentService {
  /**
   * Create a new payment order
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const { userId, paymentType, relatedId, originalAmount, couponId, applyLevelDiscount = true } = params;
    
    // Calculate discount from multiple sources
    let couponDiscountAmount = 0;
    let levelDiscountAmount = 0;
    let finalAmount = originalAmount;
    
    // 1. Apply level discount first (for event payments)
    if (applyLevelDiscount && paymentType === "event") {
      const user = await storage.getUser(userId);
      if (user) {
        const userLevel = user.currentLevel || 1;
        const levelDiscountPercent = getLevelDiscount(userLevel);
        if (levelDiscountPercent > 0) {
          levelDiscountAmount = Math.floor(originalAmount * (levelDiscountPercent / 100));
          console.log(`[Payment] Applied level ${userLevel} discount: ${levelDiscountPercent}% = ¥${levelDiscountAmount / 100}`);
        }
      }
    }
    
    // Calculate amount after level discount
    let amountAfterLevelDiscount = originalAmount - levelDiscountAmount;
    
    // 2. Apply coupon discount on top of level discount
    if (couponId) {
      const coupon = await storage.getCoupon(couponId);
      if (coupon && coupon.isActive) {
        // Validate coupon
        const now = new Date();
        const validFrom = new Date(coupon.validFrom);
        const validUntil = coupon.validUntil ? new Date(coupon.validUntil) : null;
        
        if (now >= validFrom && (!validUntil || now <= validUntil)) {
          // Check usage limits
          if (coupon.maxUses === null || coupon.currentUses < coupon.maxUses) {
            // Calculate discount on the remaining amount
            if (coupon.discountType === "fixed_amount") {
              couponDiscountAmount = coupon.discountValue;
            } else if (coupon.discountType === "percentage") {
              couponDiscountAmount = Math.floor(amountAfterLevelDiscount * (coupon.discountValue / 100));
            }
          }
        }
      }
    }
    
    // Calculate total discount and final amount
    const totalDiscountAmount = levelDiscountAmount + couponDiscountAmount;
    finalAmount = Math.max(0, originalAmount - totalDiscountAmount);
    
    // Generate unique order ID
    const wechatOrderId = `JJ${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
    
    // Create payment record (discountAmount stores the total discount)
    const payment = await storage.createPayment({
      userId,
      paymentType,
      relatedId,
      originalAmount,
      discountAmount: totalDiscountAmount,
      finalAmount,
      couponId,
      wechatOrderId,
      status: "pending",
    });
    
    // TODO: Call WeChat Pay API to create prepay order
    // This is where you would integrate the actual WeChat Pay SDK
    // Example (pseudo-code):
    // const wechatPay = new WeChatPay({ appId, mchId, ... });
    // const prepayResult = await wechatPay.transactions.h5({
    //   description: paymentType === 'event_bundle' ? 'JoyJoin月度活动礼包' :
    //                paymentType === 'subscription' ? 'JoyJoin活动礼包' : 'JoyJoin活动报名',
    //   out_trade_no: wechatOrderId,
    //   amount: { total: finalAmount, currency: 'CNY' },
    //   scene_info: { payer_client_ip: '...' },
    // });
    
    console.log(`[Payment] Created payment ${payment.id} for user ${userId}, amount: ¥${finalAmount / 100}`);
    
    // MOCK RESPONSE - Replace with actual WeChat Pay response
    return {
      paymentId: payment.id,
      wechatOrderId,
      h5Url: `https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id=MOCK_${wechatOrderId}`,
    };
  }
  
  /**
   * Handle WeChat Pay webhook callback
   *
   * WeChat Pay will send a POST request to your webhook URL when payment status changes.
   * Endpoint: POST /api/webhooks/wechat-pay
   *
   * @param payload   Parsed JSON body from the webhook request
   * @param rawBody   Raw request body string (required for signature verification)
   * @param headers   WeChat Pay signature headers
   */
  async handleWebhook(
    payload: any,
    rawBody: string,
    headers: WechatWebhookHeaders
  ): Promise<void> {
    // ── 1. Signature verification ──────────────────────────────────────────
    const isDevMode = process.env.NODE_ENV === "development";
    if (!isDevMode) {
      const signatureValid = this.verifySignature(rawBody, headers);
      if (!signatureValid) {
        console.warn("[Payment] Webhook rejected: invalid signature");
        throw Object.assign(new Error("Invalid webhook signature"), { status: 401 });
      }
    }

    const { resource, event_type } = payload;

    if (event_type === "TRANSACTION.SUCCESS") {
      // Payment successful
      const { out_trade_no, transaction_id } = resource.ciphertext
        ? this.decryptResource(resource) // Decrypt if encrypted
        : resource;

      await this.handlePaymentSuccess(out_trade_no, transaction_id);
    } else if (event_type === "REFUND.SUCCESS") {
      // Refund successful
      const { out_trade_no } = resource.ciphertext
        ? this.decryptResource(resource)
        : resource;

      await this.handleRefundSuccess(out_trade_no);
    } else {
      // Unknown event type — log but don't error (WeChat may add new types)
      console.log(`[Payment] Received unhandled webhook event_type: ${event_type}`);
    }
  }
  
  /**
   * Handle successful payment - activate subscription or event registration
   * Idempotent: safe to call multiple times for the same order.
   */
  private async handlePaymentSuccess(wechatOrderId: string, transactionId: string): Promise<void> {
    console.log(`[Payment] Processing successful payment: ${wechatOrderId}`);
    
    // Find payment by WeChat order ID
    const payments = await storage.getAllPayments();
    const payment = payments.find(p => p.wechatOrderId === wechatOrderId);
    
    if (!payment) {
      console.error(`[Payment] Payment not found for order ${wechatOrderId}`);
      return;
    }

    // ── Idempotency guard ──────────────────────────────────────────────────
    // If the payment has already been completed (e.g. duplicate webhook delivery),
    // skip all downstream mutations to avoid double-applying state transitions.
    if (payment.status === "completed") {
      console.log(
        `[Payment] Duplicate webhook for already-completed order ${wechatOrderId} — skipping`
      );
      return;
    }
    
    // Update payment status
    await storage.updatePayment(payment.id, {
      status: "completed",
      wechatTransactionId: transactionId,
      paidAt: new Date(),
    });
    
    // Record coupon usage if applicable
    if (payment.couponId) {
      await storage.recordCouponUsage({
        couponId: payment.couponId,
        userId: payment.userId,
        paymentId: payment.id,
        discountApplied: payment.discountAmount,
      });
    }
    
    // Activate subscription or confirm event registration
    if (payment.paymentType === "subscription" || payment.paymentType === "event_bundle") {
      await this.activateSubscription(payment.relatedId, payment.id);
    } else if (payment.paymentType === "event") {
      await this.confirmEventRegistration(payment.relatedId, payment.userId);
    }
    
    // TODO: Send notification to user
    const isBundle = payment.paymentType === "event_bundle";
    const isSubscription = payment.paymentType === "subscription";
    await storage.createNotification({
      userId: payment.userId,
      category: "activities",
      type: (isSubscription || isBundle) ? "subscription_activated" : "event_confirmed",
      title: isBundle ? "悦聚月度礼包已激活" : isSubscription ? "会员订阅成功" : "活动报名成功",
      message: isBundle
        ? "你的本月活动礼包已生效，尽情参加本月所有悦聚活动吧！"
        : isSubscription
        ? "您的JoyJoin会员已激活，开始探索精彩活动吧！"
        : "您的活动报名已确认，期待与您见面！",
      relatedResourceId: payment.relatedId,
    });
  }
  
  /**
   * Activate subscription after successful payment
   */
  private async activateSubscription(subscriptionId: string, paymentId: string): Promise<void> {
    await storage.updateSubscription(subscriptionId, {
      status: "active",
      paymentId,
    });
    
    console.log(`[Payment] Activated subscription ${subscriptionId}`);
  }
  
  /**
   * Confirm event registration after successful payment
   */
  private async confirmEventRegistration(eventId: string, userId: string): Promise<void> {
    // TODO: Mark event attendance as paid/confirmed
    console.log(`[Payment] Confirmed event registration for event ${eventId}, user ${userId}`);
  }
  
  /**
   * Handle successful refund.
   * Idempotent: safe to call multiple times for the same order.
   */
  private async handleRefundSuccess(wechatOrderId: string): Promise<void> {
    console.log(`[Payment] Processing refund for order: ${wechatOrderId}`);
    
    const payments = await storage.getAllPayments();
    const payment = payments.find(p => p.wechatOrderId === wechatOrderId);
    
    if (!payment) {
      console.error(`[Payment] Payment not found for refund ${wechatOrderId}`);
      return;
    }

    // Idempotency guard
    if (payment.status === "refunded") {
      console.log(
        `[Payment] Duplicate refund webhook for already-refunded order ${wechatOrderId} — skipping`
      );
      return;
    }
    
    await storage.updatePayment(payment.id, {
      status: "refunded",
    });
    
    // Deactivate subscription if it was a subscription or bundle payment
    if ((payment.paymentType === "subscription" || payment.paymentType === "event_bundle") && payment.relatedId) {
      await storage.updateSubscription(payment.relatedId, {
        status: "cancelled",
      });
    }
  }
  
  /**
   * Decrypt WeChat Pay AES-256-GCM encrypted resource.
   * Uses WECHAT_PAY_APIV3_KEY as the decryption key.
   * See: https://pay.weixin.qq.com/wiki/doc/apiv3/wechatpay/wechatpay4_2.shtml
   */
  private decryptResource(resource: {
    algorithm?: string;
    ciphertext: string;
    nonce: string;
    associated_data: string;
  }): any {
    const apiv3Key = process.env.WECHAT_PAY_APIV3_KEY;
    if (!apiv3Key) {
      throw new Error(
        "WECHAT_PAY_APIV3_KEY is not configured — cannot decrypt WeChat Pay webhook resource"
      );
    }
    if (Buffer.byteLength(apiv3Key, "utf8") !== 32) {
      throw new Error("WECHAT_PAY_APIV3_KEY must be exactly 32 bytes");
    }

    const key = Buffer.from(apiv3Key, "utf8");
    const iv = Buffer.from(resource.nonce, "utf8");
    const authTag = Buffer.from(resource.ciphertext, "base64").slice(-16);
    const ciphertext = Buffer.from(resource.ciphertext, "base64").slice(0, -16);

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(resource.associated_data ?? "", "utf8"));

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  }

  /**
   * Verify WeChat Pay webhook signature.
   *
   * WeChat Pay v3 signature scheme:
   *   message = timestamp + "\n" + nonce + "\n" + body + "\n"
   *
   * Production path: RSA-SHA256 with the WeChat Pay platform certificate
   *   (set WECHAT_PAY_PLATFORM_CERT to the PEM certificate contents).
   *
   * Fallback path (no cert configured): HMAC-SHA256 over the APIV3_KEY.
   *   This is weaker than RSA verification but still protects against replay
   *   and tampering in the absence of the platform certificate.
   *
   * See: https://pay.weixin.qq.com/wiki/doc/apiv3/wechatpay/wechatpay4_1.shtml
   */
  private verifySignature(rawBody: string, headers: WechatWebhookHeaders): boolean {
    const { timestamp, nonce, signature } = headers;

    if (!timestamp || !nonce || !signature) {
      console.warn("[Payment] Webhook missing required signature headers");
      return false;
    }

    // Reject stale timestamps (> 5 minutes) to prevent replay attacks
    const nowSeconds = Math.floor(Date.now() / 1000);
    const requestSeconds = parseInt(timestamp, 10);
    if (isNaN(requestSeconds) || Math.abs(nowSeconds - requestSeconds) > 300) {
      console.warn("[Payment] Webhook rejected: stale or invalid timestamp");
      return false;
    }

    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;

    // ── RSA-SHA256 path (recommended for production) ──────────────────────
    const platformCert = process.env.WECHAT_PAY_PLATFORM_CERT;
    if (platformCert) {
      try {
        const verifier = createVerify("RSA-SHA256");
        verifier.update(message);
        return verifier.verify(platformCert, signature, "base64");
      } catch (err) {
        console.error("[Payment] RSA signature verification failed:", err);
        return false;
      }
    }

    // ── HMAC-SHA256 fallback (requires WECHAT_PAY_APIV3_KEY) ─────────────
    const apiv3Key = process.env.WECHAT_PAY_APIV3_KEY;
    if (!apiv3Key) {
      console.warn(
        "[Payment] Neither WECHAT_PAY_PLATFORM_CERT nor WECHAT_PAY_APIV3_KEY configured — " +
          "cannot verify webhook signature"
      );
      return false;
    }

    const expectedHmac = createHmac("sha256", apiv3Key).update(message).digest("base64");

    try {
      const expectedBuf = Buffer.from(expectedHmac, "base64");
      const actualBuf = Buffer.from(signature, "base64");
      if (expectedBuf.length !== actualBuf.length) return false;
      return timingSafeEqual(expectedBuf, actualBuf);
    } catch {
      return false;
    }
  }
  
  /**
   * Query payment status from WeChat Pay
   */
  async queryPaymentStatus(wechatOrderId: string): Promise<string> {
    // TODO: Call WeChat Pay API to query payment status
    // const status = await wechatPay.transactions.queryByOutTradeNo({ out_trade_no: wechatOrderId });
    console.log(`[Payment] Querying status for order ${wechatOrderId}`);
    return "pending"; // MOCK
  }
  
  /**
   * Create refund for a payment
   */
  async createRefund(paymentId: string, reason: string): Promise<void> {
    const payments = await storage.getAllPayments();
    const payment = payments.find(p => p.id === paymentId);
    
    if (!payment) {
      throw new Error("Payment not found");
    }
    
    if (payment.status !== "completed") {
      throw new Error("Can only refund completed payments");
    }
    
    // TODO: Call WeChat Pay refund API
    // const refund = await wechatPay.refunds.create({
    //   out_trade_no: payment.wechatOrderId,
    //   out_refund_no: `RF${Date.now()}`,
    //   amount: { refund: payment.finalAmount, total: payment.finalAmount, currency: 'CNY' },
    //   reason,
    // });
    
    console.log(`[Payment] Initiated refund for payment ${paymentId}, reason: ${reason}`);
  }
}

export const paymentService = new PaymentService();
