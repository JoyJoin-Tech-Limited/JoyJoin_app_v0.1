import { createDecipheriv, createSign, createVerify, randomBytes } from "node:crypto";
import { logger } from "./lib/logger";
import { getDirectMiniProgramAppIdConsistencyIssue } from "./lib/configValidation";
import { eventCreditsRepo } from "./repositories/eventCreditsRepo";
import { paymentFulfillmentRepo } from "./repositories/paymentFulfillmentRepo";
import { paymentsRepo } from "./repositories/paymentsRepo";
import { refundAttemptsRepo } from "./repositories/refundAttemptsRepo";
import { usersRepo } from "./repositories/usersRepo";
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
type WechatWebhookPayload = Record<string, unknown>;

interface WechatWebhookRequest {
  headers: WechatWebhookHeaders;
  rawBody: Buffer | string;
  payload: WechatWebhookPayload;
}

function getSingleHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

interface WechatPayConfig {
  appId: string;
  mchId: string;
  serialNo: string;
  privateKey: string;
  apiV3Key: string;
  notifyUrl: string;
}

export interface CreatePaymentParams {
  userId: string;
  paymentType: "subscription" | "event" | "event_bundle" | "event_pack";
  relatedId: string; // subscription ID or event ID
  originalAmount: number; // in cents (¥98 = 9800)
  couponId?: string;
  eventRegistrationPayload?: unknown;
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

export interface CreateMiniProgramPaymentParams extends CreatePaymentParams {
  openid: string;
}

export interface MiniProgramPaymentResult extends PaymentResult {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: "RSA";
  paySign: string;
}

interface PreparedPaymentOrder {
  payment: any;
  wechatOrderId: string;
  finalAmount: number;
}

export class PaymentService {
  assertMiniProgramAppIdConsistency(): void {
    const issue = getDirectMiniProgramAppIdConsistencyIssue(process.env);
    if (issue) {
      throw new Error(issue);
    }
  }

  /**
   * Create a new payment order
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const { paymentType, clientIp } = params;
    const { payment, wechatOrderId, finalAmount } = await this.preparePaymentOrder(params);

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

    return {
      paymentId: payment.id,
      wechatOrderId,
      prepayId: response.prepay_id,
      codeUrl: response.code_url,
      h5Url: response.h5_url,
    };
  }

  async createMiniProgramPayment(
    params: CreateMiniProgramPaymentParams
  ): Promise<MiniProgramPaymentResult> {
    this.assertMiniProgramAppIdConsistency();

    const { openid } = params;
    const { payment, wechatOrderId, finalAmount } = await this.preparePaymentOrder(params);

    const response = await this.wechatRequest<{ prepay_id: string }>({
      method: "POST",
      path: "/v3/pay/transactions/jsapi",
      body: {
        appid: this.getWechatPayConfig().appId,
        mchid: this.getWechatPayConfig().mchId,
        description: this.getPaymentDescription(params.paymentType),
        out_trade_no: wechatOrderId,
        notify_url: this.getWechatPayConfig().notifyUrl,
        amount: {
          total: finalAmount,
          currency: "CNY",
        },
        payer: {
          openid,
        },
      },
    });

    if (!response.prepay_id) {
      throw new Error("WeChat Pay JSAPI response missing prepay_id");
    }

    await paymentsRepo.updatePayment(payment.id, {
      wechatPrepayId: response.prepay_id,
    });

    const nonceStr = randomBytes(16).toString("hex");
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const packageValue = `prepay_id=${response.prepay_id}`;
    const paySign = this.signMiniProgramPayment({
      timeStamp,
      nonceStr,
      packageValue,
    });

    return {
      paymentId: payment.id,
      wechatOrderId,
      prepayId: response.prepay_id,
      timeStamp,
      nonceStr,
      package: packageValue,
      signType: "RSA",
      paySign,
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
  async handleWebhook(payload: any, rawBody: string, headers: WechatWebhookHeaders): Promise<void>;
  async handleWebhook(request: WechatWebhookRequest): Promise<void>;
  async handleWebhook(
    payloadOrRequest: any,
    rawBodyArg?: string,
    headersArg?: WechatWebhookHeaders
  ): Promise<void> {
    const request = this.normalizeWebhookRequest(payloadOrRequest, rawBodyArg, headersArg);
    const { payload, rawBody, headers } = request;

    if (!payload || typeof payload !== "object") {
      throw Object.assign(new Error("Webhook payload is required"), { status: 400 });
    }

    // ── 1. Signature verification ──────────────────────────────────────────
    const isDevMode = process.env.NODE_ENV === "development";
    if (!isDevMode) {
      const signatureValid = this.verifySignature(rawBody, headers);
      if (!signatureValid) {
        logger.warn("Payment webhook rejected due to invalid signature");
        throw this.createHttpError(401, "Invalid webhook signature");
      }
    }

    const eventType = (payload as any).event_type;
    const resource = (payload as any).resource;

    if (typeof eventType !== "string" || !resource || typeof resource !== "object") {
      throw this.createHttpError(400, "Invalid webhook payload");
    }

    if (eventType === "TRANSACTION.SUCCESS") {
      const paymentResource = this.getWebhookResource(resource);
      const transactionPayload = paymentResource.ciphertext
        ? this.decryptResource(this.getEncryptedWebhookResource(paymentResource))
        : paymentResource;

      await this.handlePaymentSuccess(
        this.getRequiredWebhookString(transactionPayload.out_trade_no, "out_trade_no"),
        this.getRequiredWebhookString(transactionPayload.transaction_id, "transaction_id")
      );
    } else if (eventType === "REFUND.SUCCESS") {
      const refundResource = this.getWebhookResource(resource);
      const refundPayload = refundResource.ciphertext
        ? this.decryptResource(this.getEncryptedWebhookResource(refundResource))
        : refundResource;

      await this.handleRefundSuccess(
        this.getRequiredWebhookString(refundPayload.out_trade_no, "out_trade_no")
      );
    } else {
      logger.info("Payment webhook received unhandled event type", { event_type: eventType });
    }
  }

  /**
   * Handle successful payment - activate subscription or event registration
   * Idempotent: safe to call multiple times for the same order.
   */
  private async handlePaymentSuccess(wechatOrderId: string, transactionId: string): Promise<void> {
    const result = await paymentFulfillmentRepo.finalizeConfirmedPayment({
      wechatOrderId,
      transactionId,
    });

    if (!result.payment) {
      logger.error("Payment fulfillment failed because the order was not found", {
        order_id: wechatOrderId,
      });
      return;
    }

    if (result.alreadyCompleted) {
      logger.info("Payment fulfillment skipped duplicate confirmation", {
        order_id: wechatOrderId,
        payment_id: result.payment.id,
      });
      return;
    }
  }

  /**
   * Activate subscription after successful payment
   */
  private async activateSubscription(subscriptionId: string, paymentId: string): Promise<void> {
    await paymentsRepo.updateSubscription(subscriptionId, {
      status: "active",
      paymentId,
    });
  }

  /**
   * Confirm event registration after successful payment
   */
  private async confirmEventRegistration(eventId: string, userId: string): Promise<void> {
    logger.info("Payment confirmed event registration", { event_id: eventId, user_id: userId });
  }

  /**
   * Handle successful refund.
   * Idempotent: safe to call multiple times for the same order.
   */
  private async handleRefundSuccess(wechatOrderId: string): Promise<void> {
    const payment = await paymentsRepo.getPaymentByWechatOrderId(wechatOrderId);

    if (!payment) {
      logger.error("Refund fulfillment failed because the order was not found", {
        order_id: wechatOrderId,
      });
      return;
    }

    // Idempotency guard
    if (payment.status === "refunded") {
      logger.info("Refund fulfillment skipped duplicate confirmation", {
        order_id: wechatOrderId,
        payment_id: payment.id,
      });
      return;
    }

    await paymentFulfillmentRepo.finalizeRefundedPayment({
      wechatOrderId,
    });

    // Update the pending refund attempt to success
    const pendingAttempt = await refundAttemptsRepo.findPendingByPaymentId(payment.id);
    if (pendingAttempt) {
      await refundAttemptsRepo.updateStatus(pendingAttempt.id, { status: "success" });
    } else {
      logger.warn("No pending refund attempt found for successful refund", {
        payment_id: payment.id,
        wechat_order_id: wechatOrderId,
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
   *   For compatibility, WECHAT_PAY_PLATFORM_PUBLIC_KEY is also accepted when
   *   certificate material is unavailable. Outside development, missing keys
   *   cause verification to fail closed.
   *
   * See: https://pay.weixin.qq.com/wiki/doc/apiv3/wechatpay/wechatpay4_1.shtml
   */

  private verifySignature(rawBody: string, headers: WechatWebhookHeaders): boolean {
    const timestamp = getSingleHeaderValue(headers.timestamp ?? headers["wechatpay-timestamp"]);
    const nonce = getSingleHeaderValue(headers.nonce ?? headers["wechatpay-nonce"]);
    const signature = getSingleHeaderValue(headers.signature ?? headers["wechatpay-signature"]);

    if (!timestamp || !nonce || !signature) {
      logger.warn("Payment webhook missing required signature headers");
      return false;
    }

    // Reject stale timestamps (> 5 minutes) to prevent replay attacks
    const nowSeconds = Math.floor(Date.now() / 1000);
    const requestSeconds = parseInt(timestamp, 10);
    if (isNaN(requestSeconds) || Math.abs(nowSeconds - requestSeconds) > WEBHOOK_TOLERANCE_SECONDS) {
      logger.warn("Payment webhook rejected due to stale or invalid timestamp");
      return false;
    }

    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;

    // ── RSA-SHA256 path (required outside development) ────────────────────
    const platformCert = process.env.WECHAT_PAY_PLATFORM_CERT ?? process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY;
    try {
      if (!platformCert) {
        logger.warn("Payment webhook signature verification unavailable because platform cert is missing");
        return false;
      }

      const verifier = createVerify("RSA-SHA256");
      verifier.update(message);
      return verifier.verify(platformCert, signature, "base64");
    } catch (err) {
      logger.error("Payment webhook RSA signature verification failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * Query payment status from WeChat Pay
   */
  async queryPaymentStatus(wechatOrderId: string): Promise<string> {
    const existingPayment = await paymentsRepo.getPaymentByWechatOrderId(wechatOrderId);
    if (existingPayment?.status === "completed") {
      return "completed";
    }
    if (existingPayment?.status === "refunded") {
      return "refunded";
    }
    if (existingPayment?.status === "failed") {
      return "failed";
    }

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
  async createRefund(paymentId: string, reason: string, initiatedBy?: string): Promise<void> {
    const payment = await paymentsRepo.getPaymentById(paymentId);

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.status !== "completed") {
      throw new Error("Can only refund completed payments");
    }

    if (payment.paymentType === "event_pack") {
      const blockerCount = await eventCreditsRepo.getRefundBlockerCountForPayment(payment.id);
      if (blockerCount > 0) {
        throw new Error("Cannot refund an event pack after any of its credits have been used");
      }
    }

    const wechatRefundId = `RF${Date.now()}${payment.id}`;

    try {
      await this.wechatRequest({
        method: "POST",
        path: "/v3/refund/domestic/refunds",
        body: {
          out_trade_no: payment.wechatOrderId,
          out_refund_no: wechatRefundId,
          reason,
          notify_url: this.getWechatPayConfig().notifyUrl,
          amount: {
            refund: payment.finalAmount,
            total: payment.finalAmount,
            currency: "CNY",
          },
        },
      });

      await paymentsRepo.updatePayment(payment.id, {
        status: "refund_pending",
      });

      await refundAttemptsRepo.create({
        paymentId: payment.id,
        status: "pending",
        reason,
        wechatRefundId,
        amount: payment.finalAmount,
        initiatedBy,
      });
    } catch (error) {
      // Record failed refund attempt for audit trail
      await refundAttemptsRepo.create({
        paymentId: payment.id,
        status: "failed",
        reason,
        wechatRefundId,
        amount: payment.finalAmount,
        initiatedBy,
      });
      throw error;
    }
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

  private async preparePaymentOrder(params: CreatePaymentParams): Promise<PreparedPaymentOrder> {
    const {
      userId,
      paymentType,
      relatedId,
      originalAmount,
      couponId,
      eventRegistrationPayload,
      applyLevelDiscount = true,
    } = params;

    const { levelDiscountAmount, couponDiscountAmount } = await this.calculateDiscounts({
      userId,
      paymentType,
      originalAmount,
      couponId,
      applyLevelDiscount,
    });

    const totalDiscountAmount = levelDiscountAmount + couponDiscountAmount;
    const finalAmount = Math.max(0, originalAmount - totalDiscountAmount);
    const wechatOrderId = `JJ${Date.now()}${Math.random().toString(36).slice(2, 11)}`;

    const payment = await paymentsRepo.createPayment({
      userId,
      paymentType,
      relatedId,
      originalAmount,
      discountAmount: totalDiscountAmount,
      finalAmount,
      couponId,
      eventRegistrationPayload,
      wechatOrderId,
      status: "pending",
    });

    return {
      payment,
      wechatOrderId,
      finalAmount,
    };
  }

  private async calculateDiscounts(params: {
    userId: string;
    paymentType: CreatePaymentParams["paymentType"];
    originalAmount: number;
    couponId?: string;
    applyLevelDiscount: boolean;
  }): Promise<{ levelDiscountAmount: number; couponDiscountAmount: number }> {
    const { userId, paymentType, originalAmount, couponId, applyLevelDiscount } = params;

    let couponDiscountAmount = 0;
    let levelDiscountAmount = 0;

    if (applyLevelDiscount && paymentType === "event") {
      const user = await usersRepo.getUser(userId);
      if (user) {
        const userLevel = user.currentLevel || 1;
        const levelDiscountPercent = getLevelDiscount(userLevel);
        if (levelDiscountPercent > 0) {
          levelDiscountAmount = Math.floor(originalAmount * (levelDiscountPercent / 100));
        }
      }
    }

    const amountAfterLevelDiscount = originalAmount - levelDiscountAmount;
    if (!couponId) {
      return { levelDiscountAmount, couponDiscountAmount };
    }

    const coupon = await paymentsRepo.getCoupon(couponId);
    const isActive = Boolean(coupon?.isActive ?? coupon?.is_active);
    if (!coupon || !isActive) {
      return { levelDiscountAmount, couponDiscountAmount };
    }

    const now = new Date();
    const validFromValue = coupon.validFrom ?? coupon.valid_from;
    const validUntilValue = coupon.validUntil ?? coupon.valid_until;
    const validFrom = new Date(validFromValue);
    const validUntil = validUntilValue ? new Date(validUntilValue) : null;
    // TODO(payment-storage-normalization): remove the legacy maxUses/currentUses
    // fallback once the storage layer consistently returns usageLimit/usedCount.
    const usageLimit = coupon.maxUses ?? coupon.usageLimit ?? coupon.usage_limit ?? null;
    const currentUses = coupon.currentUses ?? coupon.usedCount ?? coupon.used_count ?? 0;
    const minPurchase = coupon.minPurchase ?? coupon.min_purchase ?? 0;

    if (now < validFrom || (validUntil && now > validUntil)) {
      return { levelDiscountAmount, couponDiscountAmount };
    }

    if (Number(minPurchase) > 0 && originalAmount < Number(minPurchase)) {
      return { levelDiscountAmount, couponDiscountAmount };
    }

    if (usageLimit !== null && currentUses >= usageLimit) {
      return { levelDiscountAmount, couponDiscountAmount };
    }

    const discountType = coupon.discountType ?? coupon.discount_type;
    const discountValue = Number(coupon.discountValue ?? coupon.discount_value ?? 0);

    if (discountType === "fixed_amount") {
      couponDiscountAmount = discountValue;
    } else if (discountType === "percentage") {
      couponDiscountAmount = Math.floor(amountAfterLevelDiscount * (discountValue / 100));
    }

    return { levelDiscountAmount, couponDiscountAmount };
  }

  private signMiniProgramPayment(params: {
    timeStamp: string;
    nonceStr: string;
    packageValue: string;
  }): string {
    const { appId, privateKey } = this.getWechatPayConfig();
    const message = `${appId}\n${params.timeStamp}\n${params.nonceStr}\n${params.packageValue}\n`;
    const signer = createSign("RSA-SHA256");
    signer.update(message);
    signer.end();
    return signer.sign(privateKey, "base64");
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

  private getPaymentDescription(paymentType: CreatePaymentParams["paymentType"]): string {
    if (paymentType === "event_pack") return "JoyJoin活动次数包";
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
    const aliases = [name, name.toLowerCase(), name.toUpperCase()];
    if (name === "timestamp" || name === "nonce" || name === "signature" || name === "serial") {
      aliases.push(`wechatpay-${name}`);
      aliases.push(`WECHATPAY-${name.toUpperCase()}`);
    }

    for (const alias of aliases) {
      const value = headers[alias];
      if (value !== undefined) {
        return Array.isArray(value) ? value[0] : value;
      }
    }

    return undefined;
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

  private normalizeWebhookRequest(
    payloadOrRequest: WechatWebhookPayload | WechatWebhookRequest,
    rawBody?: string,
    headers: WechatWebhookHeaders = {}
  ): { payload: WechatWebhookPayload; rawBody: string; headers: WechatWebhookHeaders } {
    if (rawBody !== undefined) {
      return { payload: payloadOrRequest as WechatWebhookPayload, rawBody, headers };
    }

    const request = payloadOrRequest as WechatWebhookRequest;
    const normalizedRawBody = Buffer.isBuffer(request.rawBody)
      ? request.rawBody.toString("utf8")
      : request.rawBody;

    return {
      payload: request.payload,
      rawBody: normalizedRawBody,
      headers: request.headers ?? {},
    };
  }

  private getWebhookResource(resource: unknown): Record<string, unknown> {
    if (!resource || typeof resource !== "object") {
      throw this.createHttpError(400, "Invalid webhook payload resource");
    }

    return resource as Record<string, unknown>;
  }

  private getEncryptedWebhookResource(resource: Record<string, unknown>) {
    const ciphertext = this.getRequiredWebhookString(resource.ciphertext, "resource.ciphertext");
    const nonce = this.getRequiredWebhookString(resource.nonce, "resource.nonce");
    const associated_data =
      typeof resource.associated_data === "string" ? resource.associated_data : "";
    const algorithm = typeof resource.algorithm === "string" ? resource.algorithm : undefined;

    return { ciphertext, nonce, associated_data, algorithm };
  }

  private getRequiredWebhookString(value: unknown, fieldName: string): string {
    if (typeof value !== "string" || value.length === 0) {
      throw this.createHttpError(400, `Missing ${fieldName} in webhook payload`);
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
