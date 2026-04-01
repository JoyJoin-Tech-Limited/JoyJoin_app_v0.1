import { createDecipheriv, createSign, createVerify, randomBytes } from "node:crypto";
import { storage } from "./storage";
import { getLevelDiscount } from "@shared/gamification";

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
 *    - WECHAT_PAY_APIV3_KEY (32-byte API v3 key, used for AES decryption)
 *
 * Docs: https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml
 *
 * NOTE: Full RSA-SHA256 callback signature verification requires WeChat's platform
 * certificate (downloaded from the merchant console). Configure
 * WECHAT_PAY_PLATFORM_CERT (PEM) in non-development environments whenever
 * PAYMENTS_ENABLED=true.
 */

const WECHAT_PAY_API_BASE = "https://api.mch.weixin.qq.com";
const WEBHOOK_TOLERANCE_SECONDS = 300;

type WechatApiMethod = "GET" | "POST";

type WechatWebhookHeaders = Record<string, string | string[] | undefined>;

interface WechatWebhookRequest {
  headers: WechatWebhookHeaders;
  rawBody?: Buffer | string;
  payload?: any;
}

interface WechatPayConfig {
  appId: string;
  mchId: string;
  serialNo: string;
  privateKey: string;
  apiV3Key: string;
  notifyUrl: string;
}

interface WechatWebhookConfig {
  platformPublicKey: string;
  platformSerial?: string;
}

export interface CreatePaymentParams {
  userId: string;
  paymentType: "subscription" | "event" | "event_bundle";
  relatedId: string; // subscription ID or event ID
  originalAmount: number; // in cents (¥98 = 9800)
  couponId?: string;
  applyLevelDiscount?: boolean; // Whether to apply user's level discount
  clientIp?: string;
}

export interface PaymentResult {
  paymentId: string;
  wechatOrderId: string;
  prepayId?: string; // WeChat prepay_id for H5/JSAPI
  codeUrl?: string; // QR code URL for Native payment
  h5Url?: string; // H5 payment URL
}

export class PaymentService {
  /**
   * Create a new payment order
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const { userId, paymentType, relatedId, originalAmount, couponId, applyLevelDiscount = true, clientIp } = params;

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
    const amountAfterLevelDiscount = originalAmount - levelDiscountAmount;

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
    const wechatOrderId = `JJ${Date.now()}${Math.random().toString(36).slice(2, 11)}`;

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

    if (finalAmount === 0) {
      await this.handlePaymentSuccess(wechatOrderId, `FREE_${payment.id}`);
      return {
        paymentId: payment.id,
        wechatOrderId,
      };
    }

    const response = await this.wechatRequest<{ h5_url?: string; prepay_id?: string; code_url?: string }>({
      method: "POST",
      path: "/v3/pay/transactions/h5",
      body: {
        appid: this.getWechatPayConfig().appId,
        mchid: this.getWechatPayConfig().mchId,
        description: this.getPaymentDescription(paymentType),
        out_trade_no: wechatOrderId,
        notify_url: this.getWechatPayConfig().notifyUrl,
        amount: {
          total: finalAmount,
          currency: "CNY",
        },
        scene_info: {
          payer_client_ip: clientIp || "127.0.0.1",
          h5_info: {
            type: "Wap",
          },
        },
      },
    });

    console.log(`[Payment] Created payment ${payment.id} for user ${userId}, amount: ¥${finalAmount / 100}`);

    return {
      paymentId: payment.id,
      wechatOrderId,
      prepayId: response.prepay_id,
      codeUrl: response.code_url,
      h5Url: response.h5_url,
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
    const payment = await storage.getPaymentByWechatOrderId(wechatOrderId);

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
    console.log(`[Payment] Confirmed event registration for event ${eventId}, user ${userId}`);
  }

  /**
   * Handle successful refund.
   * Idempotent: safe to call multiple times for the same order.
   */
  private async handleRefundSuccess(wechatOrderId: string): Promise<void> {
    console.log(`[Payment] Processing refund for order: ${wechatOrderId}`);

    const payment = await storage.getPaymentByWechatOrderId(wechatOrderId);

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
    if (resource.algorithm !== "AEAD_AES_256_GCM") {
      throw new Error(
        `Unsupported WeChat Pay resource algorithm: ${resource.algorithm ?? "missing"}`
      );
    }

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
   *   Outside development, missing certs cause verification to fail closed.
   *
   * See: https://pay.weixin.qq.com/wiki/doc/apiv3/wechatpay/wechatpay4_1.shtml
   */
  private verifySignature(rawBody: string, headers: WechatWebhookHeaders): boolean {
    const timestamp = Array.isArray(headers.timestamp) ? headers.timestamp[0] : headers.timestamp;
    const nonce = Array.isArray(headers.nonce) ? headers.nonce[0] : headers.nonce;
    const signature = Array.isArray(headers.signature) ? headers.signature[0] : headers.signature;

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

    // ── RSA-SHA256 path (required outside development) ────────────────────
    const platformCert = process.env.WECHAT_PAY_PLATFORM_CERT;
    try {
      if (!platformCert) {
        console.warn(
          "[Payment] WECHAT_PAY_PLATFORM_CERT is not configured — cannot verify webhook signature"
        );
        return false;
      }

      const verifier = createVerify("RSA-SHA256");
      verifier.update(message);
      return verifier.verify(platformCert, signature, "base64");
    } catch (err) {
      console.error("[Payment] RSA signature verification failed:", err);
      return false;
    }
  }

  /**
   * Query payment status from WeChat Pay
   */
  async queryPaymentStatus(wechatOrderId: string): Promise<string> {
    console.log(`[Payment] Querying status for order ${wechatOrderId}`);

    const response = await this.wechatRequest<{ trade_state: string; transaction_id?: string }>({
      method: "GET",
      path: `/v3/pay/transactions/out-trade-no/${encodeURIComponent(wechatOrderId)}?mchid=${encodeURIComponent(this.getWechatPayConfig().mchId)}`,
    });

    if (response.trade_state === "SUCCESS" && response.transaction_id) {
      await this.handlePaymentSuccess(wechatOrderId, response.transaction_id);
      return "completed";
    }

    return this.mapTradeState(response.trade_state);
  }

  /**
   * Create refund for a payment
   */
  async createRefund(paymentId: string, reason: string): Promise<void> {
    const payment = await storage.getPaymentById(paymentId);

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.status !== "completed") {
      throw new Error("Can only refund completed payments");
    }

    await this.wechatRequest({
      method: "POST",
      path: "/v3/refund/domestic/refunds",
      body: {
        out_trade_no: payment.wechatOrderId,
        out_refund_no: `RF${Date.now()}${payment.id}`,
        reason,
        notify_url: this.getWechatPayConfig().notifyUrl,
        amount: {
          refund: payment.finalAmount,
          total: payment.finalAmount,
          currency: "CNY",
        },
      },
    });

    await storage.updatePayment(payment.id, {
      status: "refund_pending",
    });

    console.log(`[Payment] Initiated refund for payment ${paymentId}, reason: ${reason}`);
  }

  private async wechatRequest<T = any>(params: { method: WechatApiMethod; path: string; body?: Record<string, unknown> }): Promise<T> {
    const bodyString = params.body ? JSON.stringify(params.body) : "";
    const authorization = this.buildAuthorizationHeader(params.method, params.path, bodyString);

    const response = await fetch(`${WECHAT_PAY_API_BASE}${params.path}`, {
      method: params.method,
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        ...(params.body ? { "Content-Type": "application/json" } : {}),
      },
      body: params.body ? bodyString : undefined,
    });

    const responseText = await response.text();
    const responseJson = responseText ? this.safeJsonParse(responseText) : undefined;

    if (!response.ok) {
      throw new Error(`WeChat Pay API request failed (${response.status}): ${responseText}`);
    }

    return (responseJson ?? {}) as T;
  }

  private buildAuthorizationHeader(method: WechatApiMethod, path: string, body: string): string {
    const { mchId, serialNo, privateKey } = this.getWechatPayConfig();
    const nonce = randomBytes(16).toString("hex");
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
    const signer = createSign("RSA-SHA256");
    signer.update(message);
    signer.end();
    const signature = signer.sign(privateKey, "base64");

    return `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`;
  }

  private getWechatPayConfig(): WechatPayConfig {
    const notifyUrl = process.env.WECHAT_PAY_NOTIFY_URL || (process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, "")}/api/webhooks/wechat-pay` : undefined);

    return {
      appId: this.requireEnv("WECHAT_PAY_APP_ID", process.env.WECHAT_PAY_APP_ID || process.env.WECHAT_APPID),
      mchId: this.requireEnv("WECHAT_PAY_MCH_ID", process.env.WECHAT_PAY_MCH_ID),
      serialNo: this.requireEnv("WECHAT_PAY_SERIAL_NO", process.env.WECHAT_PAY_SERIAL_NO),
      privateKey: this.normalizePem(this.requireEnv("WECHAT_PAY_PRIVATE_KEY", process.env.WECHAT_PAY_PRIVATE_KEY)),
      apiV3Key: this.requireEnv("WECHAT_PAY_APIV3_KEY", process.env.WECHAT_PAY_APIV3_KEY),
      notifyUrl: this.requireEnv("WECHAT_PAY_NOTIFY_URL or APP_URL", notifyUrl),
    };
  }

  private getWebhookConfig(): WechatWebhookConfig {
    return {
      platformPublicKey: this.normalizePem(this.requireEnv("WECHAT_PAY_PLATFORM_PUBLIC_KEY", process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY)),
      platformSerial: process.env.WECHAT_PAY_PLATFORM_SERIAL,
    };
  }

  private getPaymentDescription(paymentType: CreatePaymentParams["paymentType"]): string {
    if (paymentType === "event_bundle") return "JoyJoin月度活动礼包";
    if (paymentType === "subscription") return "JoyJoin活动礼包";
    return "JoyJoin活动报名";
  }

  private mapTradeState(tradeState: string): string {
    switch (tradeState) {
      case "SUCCESS":
        return "completed";
      case "REFUND":
        return "refunded";
      case "NOTPAY":
      case "USERPAYING":
        return "pending";
      case "CLOSED":
      case "REVOKED":
        return "closed";
      case "PAYERROR":
        return "failed";
      default:
        return tradeState.toLowerCase();
    }
  }

  private getHeader(headers: WechatWebhookHeaders, name: string): string | undefined {
    const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  private normalizePem(value: string): string {
    return value.replace(/\\n/g, "\n").trim();
  }

  private requireEnv(name: string, value: string | undefined): string {
    if (!value) {
      throw new Error(`Missing required WeChat Pay configuration: ${name}`);
    }
    return value;
  }

  private safeJsonParse(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  private createHttpError(status: number, message: string): Error & { status: number } {
    const error = new Error(message) as Error & { status: number };
    error.status = status;
    return error;
  }
}

export const paymentService = new PaymentService();
