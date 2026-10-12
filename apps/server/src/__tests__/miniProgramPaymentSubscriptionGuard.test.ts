/**
 * POST /api/payments/miniprogram/create — subscription double-charge guard
 * regression tests (HIGH-1, 2026-10-12).
 *
 * Contract: `.git/.orchestration/sprints/sprint-contract.payment-subscription-double-charge-guard.md`
 *   AC-1  active, non-expired subscription → 409 + { code, message },
 *         renewSubscription / createMiniProgramPayment never called
 *   AC-2  no active subscription (none or expired) → success path unchanged
 *   AC-3  MOCK_PAYMENTS=true branch applies the same 409 guard
 *   AC-4  event payments never run the guard
 *   AC-5  anchor: paymentsRepo.getUserSubscription keeps the
 *         `status='active' AND end_date > NOW()` filter, which is what makes
 *         "expired subscription → allowed" true at the route level
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "express-session";
import { createWithServer } from "../test-utils/withServer";

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgres://postgres:postgres@127.0.0.1:5432/joyjoin_test";

const mockGetUserSubscription = vi.fn();
const mockRenewSubscription = vi.fn();
const mockGetUser = vi.fn();
const mockGetActivePricingSettings = vi.fn();

vi.mock("../adminAuth", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOperatorOrAbove: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../rateLimiter", () => ({
  paymentEndpointLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  webhookEndpointLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    })),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../paymentService", () => ({
  paymentService: {
    assertMiniProgramAppIdConsistency: vi.fn(),
    createMiniProgramPayment: vi.fn(),
  },
}));

vi.mock("../repositories/paymentsRepo", () => ({
  paymentsRepo: {
    getUserSubscription: mockGetUserSubscription,
  },
}));

vi.mock("../repositories/usersRepo", () => ({
  usersRepo: {
    getUser: mockGetUser,
  },
}));

vi.mock("../subscriptionService", () => ({
  subscriptionService: {
    renewSubscription: mockRenewSubscription,
  },
}));

vi.mock("../storage", () => ({
  storage: {
    getActivePricingSettings: mockGetActivePricingSettings,
  },
}));

vi.mock("../middleware/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/adminAuditLogger", () => ({
  logAdminAudit: vi.fn(),
}));

vi.mock("../lib/featureFlags", () => ({
  getFeatureFlag: vi.fn(async (key: string, fallback: boolean) =>
    key === "paymentsEnabled" ? true : fallback
  ),
}));

vi.mock("../lib/paymentTestPrice", () => ({
  getTestPriceCents: () => null,
}));

vi.mock("../db", () => ({
  db: {},
}));

const { paymentService } = await import("../paymentService");
const { registerPaymentRoutes } = await import("../routes/domains/payments");

const mockSessionUser = {
  id: "user-123",
  wechatOpenId: "session-openid-123",
};

/** Raw-SQL row shape (snake_case), as paymentsRepo.getUserSubscription returns. */
const activeSubscriptionRow = {
  id: "sub-active-1",
  user_id: mockSessionUser.id,
  plan_type: "monthly",
  status: "active",
  is_active: true,
  end_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
};

const mockPaymentIntent = {
  wechatOrderId: "wx-order-123",
  timeStamp: "1710000000",
  nonceStr: "nonce-123",
  package: "prepay_id=mock-123",
  signType: "RSA" as const,
  paySign: "signature-123",
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
    }),
  );

  app.post("/__test__/login", (req, res) => {
    req.session.userId = mockSessionUser.id;
    req.session.save(() => {
      res.json({ sessionId: req.sessionID });
    });
  });

  registerPaymentRoutes(app);
  return app;
}
const withServer = createWithServer(createApp);

function cookieHeader(response: Response) {
  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

async function postCreate(baseUrl: string, payload: Record<string, unknown>) {
  const loginResponse = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
  const authenticatedCookie = cookieHeader(loginResponse);

  const response = await fetch(`${baseUrl}/api/payments/miniprogram/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authenticatedCookie,
    },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as Record<string, unknown>;
  return { response, body };
}

describe("POST /api/payments/miniprogram/create — subscription double-charge guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    delete process.env.MOCK_PAYMENTS;

    mockGetUser.mockResolvedValue(mockSessionUser as any);
    mockGetActivePricingSettings.mockResolvedValue([] as any);
    mockRenewSubscription.mockResolvedValue({
      subscriptionId: "sub-new-1",
      amount: 29400,
      planType: "quarterly",
      displayLabel: "悦聚季卡",
    } as any);
    vi.mocked(paymentService.assertMiniProgramAppIdConsistency).mockReturnValue(undefined);
    vi.mocked(paymentService.createMiniProgramPayment).mockResolvedValue(mockPaymentIntent as any);
  });

  afterEach(() => {
    delete process.env.MOCK_PAYMENTS;
  });

  // AC-1: the HIGH-1 re-entry scenario — paid, app killed, user returns and
  // taps buy again. Must be rejected BEFORE any renewal row or WeChat order
  // is created.
  it("rejects a new vip_monthly purchase with 409 + code when an active subscription exists", async () => {
    mockGetUserSubscription.mockResolvedValue(activeSubscriptionRow as any);

    await withServer(async (baseUrl) => {
      const { response, body } = await postCreate(baseUrl, { type: "vip_monthly" });

      expect(response.status).toBe(409);
      expect(body).toMatchObject({
        code: "SUBSCRIPTION_ALREADY_ACTIVE",
        message: "你的悦聚卡还在有效期内",
      });

      expect(mockGetUserSubscription).toHaveBeenCalledWith(mockSessionUser.id);
      expect(mockRenewSubscription).not.toHaveBeenCalled();
      expect(paymentService.createMiniProgramPayment).not.toHaveBeenCalled();
      // Guard runs before quote/coupon resolution — no pricing read either.
      expect(mockGetActivePricingSettings).not.toHaveBeenCalled();
    });
  });

  // AC-2: getUserSubscription returns undefined for users with no subscription
  // AND for users whose subscription expired (repo SQL enforces
  // end_date > NOW() — locked by the source-scan test below). The purchase
  // flow must proceed exactly as before the guard existed.
  it("allows the purchase when no active subscription exists (expired or never subscribed)", async () => {
    mockGetUserSubscription.mockResolvedValue(undefined);

    await withServer(async (baseUrl) => {
      const { response, body } = await postCreate(baseUrl, { type: "vip_quarterly" });

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        outTradeNo: mockPaymentIntent.wechatOrderId,
        type: "vip_quarterly",
      });

      expect(mockRenewSubscription).toHaveBeenCalledWith(mockSessionUser.id, "quarterly");
      expect(paymentService.createMiniProgramPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockSessionUser.id,
          paymentType: "event_bundle",
          relatedId: "sub-new-1",
          originalAmount: 29400,
          openid: mockSessionUser.wechatOpenId,
        }),
      );
    });
  });

  // AC-4: event payments are not subscription purchases — the guard must not
  // run for them even when the user holds an active subscription.
  it("does not run the guard for event payments", async () => {
    mockGetUserSubscription.mockResolvedValue(activeSubscriptionRow as any);

    await withServer(async (baseUrl) => {
      const { response, body } = await postCreate(baseUrl, {
        type: "event",
        eventId: "event-123",
      });

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        outTradeNo: mockPaymentIntent.wechatOrderId,
        type: "event",
      });
      expect(mockGetUserSubscription).not.toHaveBeenCalled();
      expect(paymentService.createMiniProgramPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentType: "event",
          relatedId: "event-123",
        }),
      );
    });
  });

  // AC-3: mock mode (staging/local test pricing) must stay behavior-identical
  // so testers exercise the same 409 the real path emits.
  it("applies the same 409 guard in MOCK_PAYMENTS mode", async () => {
    process.env.MOCK_PAYMENTS = "true";
    mockGetUserSubscription.mockResolvedValue(activeSubscriptionRow as any);

    await withServer(async (baseUrl) => {
      const { response, body } = await postCreate(baseUrl, { type: "vip_monthly" });

      expect(response.status).toBe(409);
      expect(body).toMatchObject({
        code: "SUBSCRIPTION_ALREADY_ACTIVE",
        message: "你的悦聚卡还在有效期内",
      });
      expect(mockRenewSubscription).not.toHaveBeenCalled();
      expect(paymentService.createMiniProgramPayment).not.toHaveBeenCalled();
    });
  });

  // AC-5 anchor: "expired subscription → allowed" is true only because
  // paymentsRepo.getUserSubscription filters `status='active'` AND
  // `end_date > NOW()`. Lock the SQL so a future loosening (which would make
  // the guard block legitimate re-purchases after expiry) fails this test.
  it("paymentsRepo.getUserSubscription keeps the active + non-expired SQL filter", () => {
    const testFileDir = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(testFileDir, "../../../..");
    const repoSource = readFileSync(
      path.join(repoRoot, "apps/server/src/repositories/paymentsRepo.ts"),
      "utf8",
    );

    expect(repoSource).toContain(
      "WHERE user_id = ${userId} AND is_active = true AND status = 'active' AND end_date > NOW()",
    );
  });
});
