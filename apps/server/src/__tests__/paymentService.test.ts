import { createCipheriv, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const payments: any[] = [];

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
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
    recordCouponUsage: vi.fn(),
    createNotification: vi.fn(),
    updateSubscription: vi.fn(async (id: string, updates: Record<string, unknown>) => ({ id, ...updates })),
  },
}));

import { PaymentService } from "../paymentService";
import { storage } from "../storage";

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
    "wechatpay-timestamp": timestamp,
    "wechatpay-nonce": nonce,
    "wechatpay-signature": signature,
    "wechatpay-serial": "platform-serial-001",
  };
}

describe("PaymentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    payments.splice(0, payments.length);
    process.env = {
      ...envSnapshot,
      APP_URL: "https://joyjoin.example.com",
      WECHAT_PAY_APP_ID: "wx-prod-app-id",
      WECHAT_PAY_MCH_ID: "mch-123456",
      WECHAT_PAY_SERIAL_NO: "merchant-serial-001",
      WECHAT_PAY_PRIVATE_KEY: merchantKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      WECHAT_PAY_APIV3_KEY: apiV3Key,
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
    await service.handleWebhook({
      headers: signWebhook(rawBody),
      rawBody: Buffer.from(rawBody, "utf8"),
      payload,
    });

    expect(payments[0]).toMatchObject({
      status: "completed",
      wechatTransactionId: "wx_txn_123",
    });
    expect(storage.getPaymentByWechatOrderId).toHaveBeenCalledWith("JJ_SUCCESS_001");
    expect(storage.updateSubscription).toHaveBeenCalledWith("subscription-1", {
      status: "active",
      paymentId: "payment-1",
    });
    expect(storage.createNotification).toHaveBeenCalledTimes(1);
  });

  it("rejects webhooks with invalid signatures", async () => {
    const payload = {
      event_type: "TRANSACTION.SUCCESS",
      resource: encryptResource({ out_trade_no: "JJ_FAIL_001", transaction_id: "wx_bad" }),
    };
    const rawBody = JSON.stringify(payload);
    const headers = signWebhook(rawBody);

    const service = new PaymentService();
    await expect(service.handleWebhook({
      headers: {
        ...headers,
        "wechatpay-signature": "invalid-signature",
      },
      rawBody,
      payload,
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
    expect(storage.getPaymentById).toHaveBeenCalledWith("payment-refund-1");
    expect(payments[0].status).toBe("refund_pending");

    const refundPayload = {
      event_type: "REFUND.SUCCESS",
      resource: encryptResource({ out_trade_no: "JJ_REFUND_001" }),
    };
    const rawBody = JSON.stringify(refundPayload);

    await service.handleWebhook({
      headers: signWebhook(rawBody),
      rawBody,
      payload: refundPayload,
    });

    expect(payments[0].status).toBe("refunded");
    expect(storage.getPaymentByWechatOrderId).toHaveBeenCalledWith("JJ_REFUND_001");
    expect(storage.updateSubscription).toHaveBeenCalledWith("subscription-2", {
      status: "cancelled",
    });
  });
});
