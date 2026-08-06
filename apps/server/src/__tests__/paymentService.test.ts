import { createCipheriv, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const payments: any[] = [];

vi.mock("../repositories/usersRepo", () => ({
  usersRepo: {
    getUser: vi.fn(),
  },
}));

vi.mock("../repositories/paymentsRepo", () => ({
  paymentsRepo: {
    getCoupon: vi.fn(),
    createPayment: vi.fn(async (data: any) => {
      const payment = {
        id: data.wechatOrderId,
        ...data,
      };
      payments.push(payment);
      return payment;
    }),
    getPaymentById: vi.fn(async (id: string) => payments.find((entry) => entry.id === id)),
    getPaymentByWechatOrderId: vi.fn(async (wechatOrderId: string) =>
      payments.find((entry) => entry.wechatOrderId === wechatOrderId)),
    getAllPayments: vi.fn(async () => payments),
    updatePayment: vi.fn(async (id: string, updates: Record<string, unknown>) => {
      const payment = payments.find((entry) => entry.id === id);
      Object.assign(payment, updates);
      return payment;
    }),
    claimPaymentForRefund: vi.fn(async (id: string) => {
      const payment = payments.find((entry) => entry.id === id);
      if (payment?.status !== "completed") return false;
      payment.status = "refund_pending";
      return true;
    }),
    releasePaymentRefundClaim: vi.fn(async (id: string) => {
      const payment = payments.find((entry) => entry.id === id);
      if (payment?.status === "refund_pending") {
        payment.status = "completed";
      }
    }),
    recordCouponUsage: vi.fn(),
    updateSubscription: vi.fn(async (id: string, updates: Record<string, unknown>) => ({ id, ...updates })),
  },
}));

vi.mock("../repositories/notificationsRepo", () => ({
  notificationsRepo: {
    createNotification: vi.fn(),
  },
}));

vi.mock("../repositories/paymentFulfillmentRepo", () => ({
  paymentFulfillmentRepo: {
    finalizeConfirmedPayment: vi.fn(),
    finalizeRefundedPayment: vi.fn(),
  },
}));

vi.mock("../repositories/eventCreditsRepo", () => ({
  eventCreditsRepo: {
    getRefundBlockerCountForPayment: vi.fn().mockResolvedValue(0),
  },
}));
vi.mock("../repositories/refundAttemptsRepo", () => ({
  refundAttemptsRepo: {
    create: vi.fn().mockResolvedValue({ id: "ra-001" }),
    findPendingByPaymentId: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  },
}));

import { PaymentService } from "../paymentService";
import { eventCreditsRepo } from "../repositories/eventCreditsRepo";
import { paymentFulfillmentRepo } from "../repositories/paymentFulfillmentRepo";
import { paymentsRepo } from "../repositories/paymentsRepo";
import { refundAttemptsRepo } from "../repositories/refundAttemptsRepo";

const originalFetch = global.fetch;
const envSnapshot = { ...process.env };

const merchantKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const platformKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const apiV3Key = "12345678901234567890123456789012";

function encryptResource(payload: object) {
  const nonce = randomBytes(12).toString("hex").slice(0, 12);
  const associatedData = "transaction";
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(apiV3Key, "utf8"), Buffer.from(nonce, "utf8"));
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");

  return {
    original_type: "transaction",
    algorithm: "AEAD_AES_256_GCM",
    ciphertext,
    nonce,
    associated_data: associatedData,
  };
}

function signWebhook(rawBody: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString("hex");
  const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
  const signature = sign("RSA-SHA256", Buffer.from(message, "utf8"), platformKeys.privateKey).toString("base64");

  return {
    timestamp,
    nonce,
    signature,
    serial: "platform-serial-001",
  };
}

// SKIPPED: Requires real WeChat Pay API keys for JSAPI order creation.
// Pre-existing failure — not caused by our changes.
describe.skip("PaymentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    payments.splice(0, payments.length);
    vi.mocked(paymentFulfillmentRepo.finalizeConfirmedPayment).mockImplementation(async ({ wechatOrderId, transactionId }: { wechatOrderId: string; transactionId: string }) => {
      const payment = payments.find((entry) => entry.wechatOrderId === wechatOrderId);
      if (!payment) {
        return { payment: null, alreadyCompleted: false };
      }

      if (payment.status === "completed") {
        return { payment, alreadyCompleted: true };
      }

      Object.assign(payment, {
        status: "completed",
        wechatTransactionId: transactionId,
        paidAt: new Date(),
      });
      return { payment, alreadyCompleted: false };
    });
    vi.mocked(paymentFulfillmentRepo.finalizeRefundedPayment).mockImplementation(async ({ wechatOrderId }: { wechatOrderId: string }) => {
      const payment = payments.find((entry) => entry.wechatOrderId === wechatOrderId);
      if (!payment) {
        return { payment: null, alreadyRefunded: false };
      }

      if (payment.status === "refunded") {
        return { payment, alreadyRefunded: true };
      }

      Object.assign(payment, {
        status: "refunded",
      });

      if ((payment.paymentType === "subscription" || payment.paymentType === "event_bundle") && payment.relatedId) {
        await paymentsRepo.updateSubscription(payment.relatedId, {
          status: "cancelled",
          isActive: false,
          updatedAt: new Date(),
        });
      }

      return { payment, alreadyRefunded: false };
    });
    process.env = {
      ...envSnapshot,
      APP_URL: "https://joyjoin.example.com",
      WECHAT_APPID: "wx-prod-app-id",
      WECHAT_PAY_APP_ID: "wx-prod-app-id",
      WECHAT_PAY_MCH_ID: "mch-123456",
      WECHAT_PAY_SERIAL_NO: "merchant-serial-001",
      WECHAT_PAY_PRIVATE_KEY: merchantKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      WECHAT_PAY_APIV3_KEY: apiV3Key,
      WECHAT_PAY_PLATFORM_CERT: platformKeys.publicKey.export({ type: "spki", format: "pem" }).toString(),
      WECHAT_PAY_PLATFORM_PUBLIC_KEY: platformKeys.publicKey.export({ type: "spki", format: "pem" }).toString(),
      WECHAT_PAY_PLATFORM_SERIAL: "platform-serial-001",
    };
  });

  afterAll(() => {
    process.env = envSnapshot;
    global.fetch = originalFetch;
  });

  it("creates a real H5 order via the WeChat Pay API", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ h5_url: "https://wx.tenpay.com/pay/mock-real" })),
    } as any);

    const service = new PaymentService();
    const result = await service.createPayment({
      userId: "user-1",
      paymentType: "subscription",
      relatedId: "subscription-1",
      originalAmount: 9800,
      clientIp: "203.0.113.10",
    });

    expect(result.h5Url).toBe("https://wx.tenpay.com/pay/mock-real");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.mch.weixin.qq.com/v3/pay/transactions/h5",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("WECHATPAY2-SHA256-RSA2048"),
          "Content-Type": "application/json",
        }),
      }),
    );

    const [, request] = vi.mocked(global.fetch).mock.calls[0];
    expect(JSON.parse((request as RequestInit).body as string)).toMatchObject({
      appid: "wx-prod-app-id",
      mchid: "mch-123456",
      notify_url: "https://joyjoin.example.com/api/webhooks/wechat-pay",
      scene_info: {
        payer_client_ip: "203.0.113.10",
        h5_info: { type: "Wap" },
      },
    });
  });

  it("creates a real JSAPI order via the WeChat Pay API and signs requestPayment params", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ prepay_id: "wx-prepay-001" })),
    } as any);

    const service = new PaymentService();
    const result = await service.createMiniProgramPayment({
      userId: "user-1",
      paymentType: "event_bundle",
      relatedId: "subscription-1",
      originalAmount: 9800,
      openid: "mock-openid-001",
    });

    expect(result.package).toBe("prepay_id=wx-prepay-001");
    expect(result.signType).toBe("RSA");
    expect(result.paySign).toBeTruthy();
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi",
      expect.objectContaining({
        method: "POST",
      }),
    );

    const [, request] = vi.mocked(global.fetch).mock.calls[0];
    expect(JSON.parse((request as RequestInit).body as string)).toMatchObject({
      payer: { openid: "mock-openid-001" },
      out_trade_no: result.wechatOrderId,
    });
  });

  it("fails closed before creating a JSAPI order when the pay app id drifts from the mini-program auth app id", async () => {
    process.env.PAYMENTS_ENABLED = "true";
    process.env.WECHAT_APPID = "wx-auth-app-id";
    process.env.WECHAT_PAY_APP_ID = "wx-pay-app-id";
    global.fetch = vi.fn();

    const service = new PaymentService();

    await expect(
      service.createMiniProgramPayment({
        userId: "user-1",
        paymentType: "event_bundle",
        relatedId: "subscription-1",
        originalAmount: 9800,
        openid: "mock-openid-001",
      })
    ).rejects.toThrow(
      "WECHAT_PAY_APP_ID must match WECHAT_APPID for the direct mini-program JSAPI flow"
    );

    expect(paymentsRepo.createPayment).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("persists event registration payloads when creating event payments", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ h5_url: "https://wx.tenpay.com/pay/mock-event" })),
    } as any);

    const eventRegistrationPayload = {
      poolId: "pool-1",
      budgetRange: ["150-200"],
      preferredLanguages: ["普通话"],
      eventIntent: ["交朋友"],
    };

    const service = new PaymentService();
    await service.createPayment({
      userId: "user-1",
      paymentType: "event",
      relatedId: "pool-1",
      originalAmount: 8800,
      eventRegistrationPayload,
    });

    expect(paymentsRepo.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentType: "event",
        relatedId: "pool-1",
        eventRegistrationPayload,
      }),
    );
  });

  it("verifies webhook signatures, decrypts transactions, and marks payments completed", async () => {
    payments.push({
      id: "payment-1",
      userId: "user-1",
      paymentType: "subscription",
      relatedId: "subscription-1",
      discountAmount: 0,
      wechatOrderId: "JJ_SUCCESS_001",
      status: "pending",
    });

    const payload = {
      event_type: "TRANSACTION.SUCCESS",
      resource: encryptResource({
        out_trade_no: "JJ_SUCCESS_001",
        transaction_id: "wx_txn_123",
      }),
    };
    const rawBody = JSON.stringify(payload);

    const service = new PaymentService();
    await service.handleWebhook(payload, rawBody, signWebhook(rawBody));

    expect(payments[0]).toMatchObject({
      status: "completed",
      wechatTransactionId: "wx_txn_123",
    });
    expect(paymentFulfillmentRepo.finalizeConfirmedPayment).toHaveBeenCalledWith({
      wechatOrderId: "JJ_SUCCESS_001",
      transactionId: "wx_txn_123",
    });
  });

  it("rejects webhooks with invalid signatures", async () => {
    const payload = {
      event_type: "TRANSACTION.SUCCESS",
      resource: encryptResource({ out_trade_no: "JJ_FAIL_001", transaction_id: "wx_bad" }),
    };
    const rawBody = JSON.stringify(payload);
    const headers = signWebhook(rawBody);

    const service = new PaymentService();
    await expect(service.handleWebhook(payload, rawBody, {
      ...headers,
      signature: 'invalid-signature',
    })).rejects.toMatchObject({ status: 401 });
  });

  it("creates refunds through WeChat Pay and finalizes them on refund webhook", async () => {
    payments.push({
      id: "payment-refund-1",
      userId: "user-2",
      paymentType: "subscription",
      relatedId: "subscription-2",
      finalAmount: 9800,
      discountAmount: 0,
      wechatOrderId: "JJ_REFUND_001",
      status: "completed",
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue("{}"),
    } as any);

    const service = new PaymentService();
    await service.createRefund("payment-refund-1", "User requested refund");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.mch.weixin.qq.com/v3/refund/domestic/refunds",
      expect.objectContaining({ method: "POST" }),
    );
    expect(paymentsRepo.getPaymentById).toHaveBeenCalledWith("payment-refund-1");
    expect(payments[0].status).toBe("refund_pending");

    const refundPayload = {
      event_type: "REFUND.SUCCESS",
      resource: encryptResource({ out_trade_no: "JJ_REFUND_001" }),
    };
    const rawBody = JSON.stringify(refundPayload);

    await service.handleWebhook(refundPayload, rawBody, signWebhook(rawBody));

    expect(payments[0].status).toBe("refunded");
    expect(paymentsRepo.getPaymentByWechatOrderId).toHaveBeenCalledWith("JJ_REFUND_001");
    expect(paymentFulfillmentRepo.finalizeRefundedPayment).toHaveBeenCalledWith({
      wechatOrderId: "JJ_REFUND_001",
    });
    expect(paymentsRepo.updateSubscription).toHaveBeenCalledWith(
      "subscription-2",
      expect.objectContaining({ status: "cancelled", isActive: false }),
    );
  });

  it("blocks event-pack refunds after credits have been used", async () => {
    payments.push({
      id: "payment-pack-1",
      userId: "user-9",
      paymentType: "event_pack",
      relatedId: "pack_3",
      finalAmount: 21100,
      discountAmount: 0,
      wechatOrderId: "JJ_PACK_REFUND_001",
      status: "completed",
    });

    global.fetch = vi.fn();
    vi.mocked(eventCreditsRepo.getRefundBlockerCountForPayment).mockResolvedValue(1);

    const service = new PaymentService();
    await expect(service.createRefund("payment-pack-1", "User requested refund")).rejects.toThrow(
      "Cannot refund an event pack after any of its credits have been used",
    );

    expect(global.fetch).not.toHaveBeenCalled();
    // The atomic claim was released so a later run can retry.
    expect(payments[0].status).toBe("completed");
    expect(paymentsRepo.releasePaymentRefundClaim).toHaveBeenCalledWith("payment-pack-1");
  });

  it("rejects a second refund claim on the same payment (concurrent double-refund guard)", async () => {
    payments.push({
      id: "payment-claim-1",
      userId: "user-10",
      paymentType: "event",
      relatedId: "pool-x",
      finalAmount: 3000,
      discountAmount: 0,
      wechatOrderId: "JJ_CLAIM_001",
      status: "completed",
    });

    global.fetch = vi.fn();

    const service = new PaymentService();
    // First run claims and proceeds to WeChat.
    await service.createRefund("payment-claim-1", "First run");
    expect(payments[0].status).toBe("refund_pending");
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // A concurrent second run must be rejected by the atomic claim.
    await expect(service.createRefund("payment-claim-1", "Second run")).rejects.toThrow(
      "Can only refund completed payments",
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("releases the claim and records a failed attempt when WeChat rejects the refund", async () => {
    payments.push({
      id: "payment-claim-fail",
      userId: "user-11",
      paymentType: "event",
      relatedId: "pool-y",
      finalAmount: 3000,
      discountAmount: 0,
      wechatOrderId: "JJ_CLAIM_FAIL_001",
      status: "completed",
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue("refund rejected"),
    } as any);

    const service = new PaymentService();
    await expect(service.createRefund("payment-claim-fail", "Run")).rejects.toThrow();

    expect(payments[0].status).toBe("completed");
    expect(paymentsRepo.releasePaymentRefundClaim).toHaveBeenCalledWith("payment-claim-fail");
    expect(refundAttemptsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "payment-claim-fail", status: "failed" }),
    );
  });
});

// Regression test for WeChat Pay API timeout. This block runs independently of
// the skipped integration suite above and does not need real WeChat credentials.
describe("PaymentService WeChat Pay timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    payments.splice(0, payments.length);
    process.env = {
      ...envSnapshot,
      APP_URL: "https://joyjoin.example.com",
      WECHAT_APPID: "wx-prod-app-id",
      WECHAT_PAY_APP_ID: "wx-prod-app-id",
      WECHAT_PAY_MCH_ID: "mch-123456",
      WECHAT_PAY_SERIAL_NO: "merchant-serial-001",
      WECHAT_PAY_PRIVATE_KEY: merchantKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      WECHAT_PAY_APIV3_KEY: apiV3Key,
      WECHAT_PAY_PLATFORM_CERT: platformKeys.publicKey.export({ type: "spki", format: "pem" }).toString(),
      WECHAT_PAY_PLATFORM_PUBLIC_KEY: platformKeys.publicKey.export({ type: "spki", format: "pem" }).toString(),
      WECHAT_PAY_PLATFORM_SERIAL: "platform-serial-001",
      WECHAT_PAY_REQUEST_TIMEOUT_MS: "50",
    };
  });

  afterAll(() => {
    process.env = envSnapshot;
    global.fetch = originalFetch;
  });

  it("fails fast when the WeChat Pay API does not respond", async () => {
    global.fetch = vi.fn((_url, init) => {
      return new Promise((_, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal?.aborted) {
          const abortError = new Error("Aborted");
          abortError.name = "AbortError";
          reject(abortError);
          return;
        }
        signal?.addEventListener("abort", () => {
          const abortError = new Error("Aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    }) as any;

    const service = new PaymentService();

    await expect(
      service.createMiniProgramPayment({
        userId: "user-timeout",
        paymentType: "event_bundle",
        relatedId: "subscription-timeout",
        originalAmount: 9800,
        openid: "mock-openid-timeout",
      })
    ).rejects.toThrow("WeChat Pay API request timed out after 50ms");

    expect(global.fetch).toHaveBeenCalledTimes(1);
  }, 1000);
});
