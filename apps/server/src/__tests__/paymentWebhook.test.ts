/**
 * Tests for PaymentService — webhook idempotency and signature verification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSign, generateKeyPairSync } from "crypto";

// ── Repository mocks ──────────────────────────────────────────────────────────
const mockPayment = {
  id: "pay-001",
  userId: "user-1",
  wechatOrderId: "JJ123456",
  status: "pending",
  paymentType: "subscription",
  relatedId: "sub-001",
  originalAmount: 9800,
  discountAmount: 0,
  finalAmount: 9800,
  couponId: null,
};

const mockPaymentsRepo = {
  getAllPayments: vi.fn(),
  getPaymentByWechatOrderId: vi.fn(),
  updatePayment: vi.fn(),
  createNotification: vi.fn(),
  updateSubscription: vi.fn(),
  recordCouponUsage: vi.fn(),
};

const mockNotificationsRepo = {
  createNotification: vi.fn(),
};

vi.mock("../repositories/paymentsRepo", () => ({ paymentsRepo: mockPaymentsRepo }));
vi.mock("../repositories/notificationsRepo", () => ({ notificationsRepo: mockNotificationsRepo }));
vi.mock("../repositories/usersRepo", () => ({ usersRepo: { getUser: vi.fn() } }));
vi.mock("@shared/gamification", () => ({ getLevelDiscount: vi.fn().mockReturnValue(0) }));

// Use dynamic import after mocks are set up
const { PaymentService } = await import("../paymentService");

// ─────────────────────────────────────────────────────────────────────────────

describe("PaymentService — handleWebhook", () => {
  let service: InstanceType<typeof PaymentService>;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentService();
    // Default: payment found in pending state
    mockPaymentsRepo.getAllPayments.mockResolvedValue([{ ...mockPayment }]);
    mockPaymentsRepo.getPaymentByWechatOrderId.mockResolvedValue({ ...mockPayment });
    mockPaymentsRepo.updatePayment.mockResolvedValue(undefined);
    mockNotificationsRepo.createNotification.mockResolvedValue(undefined);
    mockPaymentsRepo.updateSubscription.mockResolvedValue(undefined);
    // Dev mode by default (skips signature verification)
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.WECHAT_PAY_PLATFORM_CERT;
    delete process.env.WECHAT_PAY_APIV3_KEY;
  });

  // ── Dev mode (no signature verification) ──────────────────────────────────

  it("processes a valid TRANSACTION.SUCCESS webhook in dev mode", async () => {
    const payload = {
      event_type: "TRANSACTION.SUCCESS",
      resource: {
        out_trade_no: "JJ123456",
        transaction_id: "wx_txn_001",
      },
    };

    await service.handleWebhook(payload, JSON.stringify(payload), {});
    expect(mockPaymentsRepo.updatePayment).toHaveBeenCalledWith(
      "pay-001",
      expect.objectContaining({ status: "completed", wechatTransactionId: "wx_txn_001" })
    );
  });

  it("processes a valid REFUND.SUCCESS webhook in dev mode", async () => {
    mockPaymentsRepo.getAllPayments.mockResolvedValue([
      { ...mockPayment, status: "completed" },
    ]);
    mockPaymentsRepo.getPaymentByWechatOrderId.mockResolvedValue({
      ...mockPayment,
      status: "completed",
    });

    const payload = {
      event_type: "REFUND.SUCCESS",
      resource: {
        out_trade_no: "JJ123456",
      },
    };

    await service.handleWebhook(payload, JSON.stringify(payload), {});
    expect(mockPaymentsRepo.updatePayment).toHaveBeenCalledWith(
      "pay-001",
      expect.objectContaining({ status: "refunded" })
    );
  });

  // ── Idempotency ────────────────────────────────────────────────────────────

  it("skips duplicate TRANSACTION.SUCCESS — does not re-apply state when already completed", async () => {
    mockPaymentsRepo.getAllPayments.mockResolvedValue([
      { ...mockPayment, status: "completed" },
    ]);
    mockPaymentsRepo.getPaymentByWechatOrderId.mockResolvedValue({
      ...mockPayment,
      status: "completed",
    });

    const payload = {
      event_type: "TRANSACTION.SUCCESS",
      resource: {
        out_trade_no: "JJ123456",
        transaction_id: "wx_txn_001",
      },
    };

    await service.handleWebhook(payload, JSON.stringify(payload), {});
    // updatePayment must NOT be called again
    expect(mockPaymentsRepo.updatePayment).not.toHaveBeenCalled();
  });

  it("skips duplicate REFUND.SUCCESS — does not re-apply state when already refunded", async () => {
    mockPaymentsRepo.getAllPayments.mockResolvedValue([
      { ...mockPayment, status: "refunded" },
    ]);
    mockPaymentsRepo.getPaymentByWechatOrderId.mockResolvedValue({
      ...mockPayment,
      status: "refunded",
    });

    const payload = {
      event_type: "REFUND.SUCCESS",
      resource: {
        out_trade_no: "JJ123456",
      },
    };

    await service.handleWebhook(payload, JSON.stringify(payload), {});
    expect(mockPaymentsRepo.updatePayment).not.toHaveBeenCalled();
  });

  it("logs unknown event_type without throwing", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const payload = { event_type: "UNKNOWN.EVENT", resource: {} };

    await expect(
      service.handleWebhook(payload, JSON.stringify(payload), {})
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("unhandled webhook event_type")
    );
    consoleSpy.mockRestore();
  });

  // ── Signature verification (non-dev mode) ─────────────────────────────────

  describe("in non-development mode (NODE_ENV=staging)", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "staging";
      delete process.env.WECHAT_PAY_PLATFORM_CERT;
    });

    it("rejects webhook when signature headers are missing", async () => {
      const payload = {
        event_type: "TRANSACTION.SUCCESS",
        resource: { out_trade_no: "JJ123456", transaction_id: "tx1" },
      };

      await expect(
        service.handleWebhook(payload, JSON.stringify(payload), {})
      ).rejects.toMatchObject({ status: 401 });
    });

    it("rejects webhook when signature is invalid", async () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const nonce = "abc123";

      const payload = {
        event_type: "TRANSACTION.SUCCESS",
        resource: { out_trade_no: "JJ123456", transaction_id: "tx1" },
      };

      await expect(
        service.handleWebhook(payload, JSON.stringify(payload), {
          timestamp,
          nonce,
          signature: "badsignature==",
        })
      ).rejects.toMatchObject({ status: 401 });
    });

    it("rejects webhook when platform certificate is missing", async () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const nonce = "nonce123";
      const rawBody = JSON.stringify({
        event_type: "TRANSACTION.SUCCESS",
        resource: { out_trade_no: "JJ123456", transaction_id: "tx999" },
      });

      await expect(
        service.handleWebhook(JSON.parse(rawBody), rawBody, {
          timestamp,
          nonce,
          signature: "anything==",
        })
      ).rejects.toMatchObject({ status: 401 });
    });

    it("accepts webhook when RSA signature matches the platform cert", async () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const nonce = "nonce123";
      const rawBody = JSON.stringify({
        event_type: "TRANSACTION.SUCCESS",
        resource: { out_trade_no: "JJ123456", transaction_id: "tx999" },
      });

      const { privateKey, publicKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });
      process.env.WECHAT_PAY_PLATFORM_CERT = publicKey.export({
        type: "spki",
        format: "pem",
      }).toString();

      const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
      const signer = createSign("RSA-SHA256");
      signer.update(message);
      const signature = signer.sign(privateKey, "base64");

      const payload = JSON.parse(rawBody);
      await service.handleWebhook(payload, rawBody, { timestamp, nonce, signature });

      expect(mockPaymentsRepo.updatePayment).toHaveBeenCalledWith(
        "pay-001",
        expect.objectContaining({ status: "completed" })
      );
      delete process.env.WECHAT_PAY_PLATFORM_CERT;
    });

    it("rejects webhook with stale timestamp (> 5 min ago)", async () => {
      const staleTimestamp = String(Math.floor(Date.now() / 1000) - 400); // 6.7 min ago
      const nonce = "nonce456";
      const rawBody = "{}";

      await expect(
        service.handleWebhook({}, rawBody, {
          timestamp: staleTimestamp,
          nonce,
          signature: "anything==",
        })
      ).rejects.toMatchObject({ status: 401 });
    });
  });

  it("rejects request-object webhooks without a payload", async () => {
    await expect(
      service.handleWebhook({
        headers: {},
        rawBody: "{}",
      })
    ).rejects.toMatchObject({ status: 400 });
  });
});

// ── AES-256-GCM decryption ────────────────────────────────────────────────────

describe("PaymentService — decryptResource", () => {
  it("throws when WECHAT_PAY_APIV3_KEY is not set", () => {
    const svc = new PaymentService();
    delete process.env.WECHAT_PAY_APIV3_KEY;
    expect(() =>
      (svc as any).decryptResource({
        algorithm: "AEAD_AES_256_GCM",
        ciphertext: Buffer.alloc(32).toString("base64"),
        nonce: "nonce123456",
        associated_data: "transaction",
      })
    ).toThrow("WECHAT_PAY_APIV3_KEY is not configured");
  });

  it("throws for unsupported algorithms before attempting decryption", () => {
    const svc = new PaymentService();
    process.env.WECHAT_PAY_APIV3_KEY = "a".repeat(32);
    expect(() =>
      (svc as any).decryptResource({
        algorithm: "NOT_SUPPORTED",
        ciphertext: Buffer.alloc(32).toString("base64"),
        nonce: "nonce123456",
        associated_data: "transaction",
      })
    ).toThrow("Unsupported WeChat Pay resource algorithm");
    delete process.env.WECHAT_PAY_APIV3_KEY;
  });
});
