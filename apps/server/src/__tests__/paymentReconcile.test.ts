/** HS-01 gap: reconcilePayment coverage — route ownership, idempotency, completion, failure paths. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

process.env.DATABASE_URL ??= "postgres://postgres:postgres@127.0.0.1:5432/joyjoin_test";

// reconcilePayment resolves getWechatPayConfig() before the (spied) WeChat
// request, and vitest.config.ts only loads the developer's ../../.env when it
// exists — CI has no .env, so the suite must supply its own values.
const WECHAT_ENV_STUBS: Record<string, string> = {
  WECHAT_PAY_APP_ID: "wx-test-appid",
  WECHAT_PAY_MCH_ID: "1900000000",
  WECHAT_PAY_SERIAL_NO: "TEST_SERIAL_NO",
  WECHAT_PAY_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nTEST\\n-----END PRIVATE KEY-----",
  WECHAT_PAY_APIV3_KEY: "test-api-v3-key-32-bytes-long!!",
  WECHAT_PAY_NOTIFY_URL: "https://example.test/api/webhooks/wechat-pay",
};

beforeAll(() => {
  for (const [key, value] of Object.entries(WECHAT_ENV_STUBS)) {
    vi.stubEnv(key, value);
  }
});

afterAll(() => {
  vi.unstubAllEnvs();
});

vi.mock("../db", () => ({ db: {} }));

vi.mock("../lib/logger", () => ({
  logger: {
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../lib/shellCache", () => ({
  shellCache: { invalidateUser: vi.fn() },
}));

vi.mock("../lib/featureFlags", () => ({ getFeatureFlag: vi.fn(async () => true) }));
vi.mock("../lib/paymentTestPrice", () => ({ getTestPriceCents: vi.fn(() => null) }));
vi.mock("../lib/poolRegistrationRules", () => ({
  describePoolRegistrationAvailability: vi.fn(),
}));
vi.mock("../lib/contentSafety", () => ({
  validateContentSafeAsync: vi.fn(),
  contentViolationResponse: vi.fn(),
}));
vi.mock("../lib/adminAuditLogger", () => ({ logAdminAudit: vi.fn() }));
vi.mock("../abuseDetection", () => ({ recordViolation: vi.fn() }));

vi.mock("../lib/wecomNotifications/payments", () => ({
  notifyRegistrationPayment: vi.fn(),
  notifyFirstPayment: vi.fn(),
  notifyRefundProcessed: vi.fn(),
  notifyFailedPayment: vi.fn(),
}));

vi.mock("../middleware/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../rateLimiter", () => ({
  paymentEndpointLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  webhookEndpointLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../adminAuth", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOperatorOrAbove: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../repositories/paymentsRepo", () => ({
  paymentsRepo: {
    getPaymentByWechatOrderId: vi.fn(),
    getPaymentById: vi.fn(),
  },
}));

vi.mock("../repositories/paymentFulfillmentRepo", () => ({
  paymentFulfillmentRepo: { finalizeConfirmedPayment: vi.fn() },
}));

vi.mock("../repositories/refundAttemptsRepo", () => ({ refundAttemptsRepo: {} }));
vi.mock("../repositories/usersRepo", () => ({ usersRepo: {} }));
vi.mock("../repositories/pricingRepo", () => ({ pricingRepo: {} }));
vi.mock("../repositories/eventCreditsRepo", () => ({ eventCreditsRepo: {} }));
vi.mock("../repositories/notificationsRepo", () => ({
  notificationsRepo: { createNotification: vi.fn() },
}));
vi.mock("../subscriptionService", () => ({ subscriptionService: {} }));
vi.mock("../storage", () => ({ storage: {} }));

import { PaymentService, paymentService } from "../paymentService";
import { paymentsRepo } from "../repositories/paymentsRepo";
import { paymentFulfillmentRepo } from "../repositories/paymentFulfillmentRepo";
import { shellCache } from "../lib/shellCache";
import { registerPaymentRoutes } from "../routes/domains/payments";

const WECHAT_ORDER_ID = "JJ_RECON_001";

function paymentWithStatus(status: string, overrides: Record<string, unknown> = {}) {
  return { id: "payment-1", userId: "user-1", wechatOrderId: WECHAT_ORDER_ID, status, ...overrides };
}

interface WechatRequestCarrier {
  wechatRequest(params: { method: string; path: string; body?: Record<string, unknown> }): Promise<unknown>;
}

function createServiceWithWechatQuery() {
  const service = new PaymentService();
  const wechatRequestSpy = vi.spyOn(service as unknown as WechatRequestCarrier, "wechatRequest");
  return { service, wechatRequestSpy };
}

describe("PaymentService.reconcilePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws Payment not found for an unknown order and never queries WeChat", async () => {
    vi.mocked(paymentsRepo.getPaymentByWechatOrderId).mockResolvedValue(undefined);
    const { service, wechatRequestSpy } = createServiceWithWechatQuery();

    await expect(service.reconcilePayment(WECHAT_ORDER_ID)).rejects.toThrow("Payment not found");

    expect(wechatRequestSpy).not.toHaveBeenCalled();
    expect(paymentFulfillmentRepo.finalizeConfirmedPayment).not.toHaveBeenCalled();
  });

  it("returns completed without re-querying or re-fulfilling an already completed order on every call", async () => {
    vi.mocked(paymentsRepo.getPaymentByWechatOrderId).mockResolvedValue(paymentWithStatus("completed"));
    const { service, wechatRequestSpy } = createServiceWithWechatQuery();

    await expect(service.reconcilePayment(WECHAT_ORDER_ID)).resolves.toEqual({ status: "completed", fulfilled: false });
    await expect(service.reconcilePayment(WECHAT_ORDER_ID)).resolves.toEqual({ status: "completed", fulfilled: false });

    expect(wechatRequestSpy).not.toHaveBeenCalled();
    expect(paymentFulfillmentRepo.finalizeConfirmedPayment).not.toHaveBeenCalled();
  });

  it("short-circuits refunded, failed and refund_pending payments without fulfilment", async () => {
    const { service, wechatRequestSpy } = createServiceWithWechatQuery();

    vi.mocked(paymentsRepo.getPaymentByWechatOrderId).mockResolvedValue(paymentWithStatus("refunded"));
    await expect(service.reconcilePayment(WECHAT_ORDER_ID)).resolves.toEqual({ status: "refunded", fulfilled: false });

    vi.mocked(paymentsRepo.getPaymentByWechatOrderId).mockResolvedValue(paymentWithStatus("failed"));
    await expect(service.reconcilePayment(WECHAT_ORDER_ID)).resolves.toEqual({ status: "failed", fulfilled: false });

    vi.mocked(paymentsRepo.getPaymentByWechatOrderId).mockResolvedValue(paymentWithStatus("refund_pending"));
    await expect(service.reconcilePayment(WECHAT_ORDER_ID)).resolves.toEqual({ status: "refund_pending", fulfilled: false });

    expect(wechatRequestSpy).not.toHaveBeenCalled();
    expect(paymentFulfillmentRepo.finalizeConfirmedPayment).not.toHaveBeenCalled();
  });

  it("fulfils a pending order exactly once when WeChat reports SUCCESS", async () => {
    vi.mocked(paymentsRepo.getPaymentByWechatOrderId).mockResolvedValue(paymentWithStatus("pending"));
    vi.mocked(paymentFulfillmentRepo.finalizeConfirmedPayment).mockResolvedValue({ payment: null, alreadyCompleted: false });
    const { service, wechatRequestSpy } = createServiceWithWechatQuery();
    wechatRequestSpy.mockResolvedValue({ trade_state: "SUCCESS", transaction_id: "wx-txn-001" });

    await expect(service.reconcilePayment(WECHAT_ORDER_ID)).resolves.toEqual({ status: "completed", fulfilled: true });

    expect(paymentFulfillmentRepo.finalizeConfirmedPayment).toHaveBeenCalledTimes(1);
    expect(paymentFulfillmentRepo.finalizeConfirmedPayment).toHaveBeenCalledWith({
      wechatOrderId: WECHAT_ORDER_ID,
      transactionId: "wx-txn-001",
    });
    expect(wechatRequestSpy).toHaveBeenCalledWith(expect.objectContaining({ method: "GET" }));
  });

  it("reports fulfilled:false when the order was already fulfilled concurrently", async () => {
    vi.mocked(paymentsRepo.getPaymentByWechatOrderId).mockResolvedValue(paymentWithStatus("pending"));
    vi.mocked(paymentFulfillmentRepo.finalizeConfirmedPayment).mockResolvedValue({ payment: null, alreadyCompleted: true });
    const { service, wechatRequestSpy } = createServiceWithWechatQuery();
    wechatRequestSpy.mockResolvedValue({ trade_state: "SUCCESS", transaction_id: "wx-txn-002" });

    await expect(service.reconcilePayment(WECHAT_ORDER_ID)).resolves.toEqual({ status: "completed", fulfilled: false });

    expect(paymentFulfillmentRepo.finalizeConfirmedPayment).toHaveBeenCalledTimes(1);
  });

  it("maps a non-SUCCESS WeChat trade state without fulfilling", async () => {
    vi.mocked(paymentsRepo.getPaymentByWechatOrderId).mockResolvedValue(paymentWithStatus("pending"));
    const { service, wechatRequestSpy } = createServiceWithWechatQuery();

    wechatRequestSpy.mockResolvedValueOnce({ trade_state: "NOTPAY" });
    await expect(service.reconcilePayment(WECHAT_ORDER_ID)).resolves.toEqual({ status: "pending", fulfilled: false });

    wechatRequestSpy.mockResolvedValueOnce({ trade_state: "PAYERROR" });
    await expect(service.reconcilePayment(WECHAT_ORDER_ID)).resolves.toEqual({ status: "failed", fulfilled: false });

    expect(paymentFulfillmentRepo.finalizeConfirmedPayment).not.toHaveBeenCalled();
  });

  it("does not fulfil a SUCCESS response that lacks a transaction id", async () => {
    vi.mocked(paymentsRepo.getPaymentByWechatOrderId).mockResolvedValue(paymentWithStatus("pending"));
    const { service, wechatRequestSpy } = createServiceWithWechatQuery();
    wechatRequestSpy.mockResolvedValue({ trade_state: "SUCCESS" });

    await expect(service.reconcilePayment(WECHAT_ORDER_ID)).resolves.toEqual({ status: "completed", fulfilled: false });

    expect(paymentFulfillmentRepo.finalizeConfirmedPayment).not.toHaveBeenCalled();
  });

  it("rethrows the WeChat query failure without fulfilling", async () => {
    vi.mocked(paymentsRepo.getPaymentByWechatOrderId).mockResolvedValue(paymentWithStatus("pending"));
    const { service, wechatRequestSpy } = createServiceWithWechatQuery();
    wechatRequestSpy.mockRejectedValue(new Error("wechat query exploded"));

    await expect(service.reconcilePayment(WECHAT_ORDER_ID)).rejects.toThrow("wechat query exploded");

    expect(paymentFulfillmentRepo.finalizeConfirmedPayment).not.toHaveBeenCalled();
  });
});

type RouteHandler = (req: any, res: any) => unknown;

interface RegisteredRoute {
  method: string;
  path: string;
  handlers: RouteHandler[];
}

const registeredRoutes: RegisteredRoute[] = [];

const fakeApp = {
  get(path: string, ...handlers: RouteHandler[]) {
    registeredRoutes.push({ method: "get", path, handlers: handlers.flat() as RouteHandler[] });
  },
  post(path: string, ...handlers: RouteHandler[]) {
    registeredRoutes.push({ method: "post", path, handlers: handlers.flat() as RouteHandler[] });
  },
};

registerPaymentRoutes(fakeApp as unknown as Express);

function getReconcileHandler(): RouteHandler {
  const route = registeredRoutes.find(
    (entry) => entry.method === "post" && entry.path === "/api/payments/:wechatOrderId/reconcile"
  );
  if (!route) {
    throw new Error("reconcile route is not registered on the payments router");
  }
  return route.handlers[route.handlers.length - 1];
}

interface FakeRes {
  statusCode: number;
  body: unknown;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
}

function createRes(): FakeRes {
  const res = {
    statusCode: 200,
    body: undefined,
    status: vi.fn(),
    json: vi.fn(),
  } as FakeRes;

  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((payload: unknown) => {
    res.body = payload;
    return res;
  });

  return res;
}

function createReq(userId: string | undefined) {
  return {
    session: { userId },
    params: { wechatOrderId: WECHAT_ORDER_ID },
    requestId: "req-reconcile-1",
  };
}

describe("POST /api/payments/:wechatOrderId/reconcile", () => {
  let reconcileSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    reconcileSpy = vi.spyOn(paymentService, "reconcilePayment");
  });

  afterEach(() => {
    reconcileSpy.mockRestore();
  });

  it("401s without a session user and never reconciles", async () => {
    const res = createRes();
    await getReconcileHandler()(createReq(undefined), res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
    expect(reconcileSpy).not.toHaveBeenCalled();
  });

  it("404s for an unknown order and never reconciles", async () => {
    vi.mocked(paymentsRepo.getPaymentByWechatOrderId).mockResolvedValue(undefined);
    const res = createRes();
    await getReconcileHandler()(createReq("user-1"), res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: "Payment not found" });
    expect(reconcileSpy).not.toHaveBeenCalled();
  });

  it("404s when the session user does not own the order and never reconciles", async () => {
    vi.mocked(paymentsRepo.getPaymentByWechatOrderId).mockResolvedValue(
      paymentWithStatus("pending", { userId: "owner-1" })
    );
    const res = createRes();
    await getReconcileHandler()(createReq("intruder-2"), res);

    expect(paymentsRepo.getPaymentByWechatOrderId).toHaveBeenCalledWith(WECHAT_ORDER_ID);
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: "Payment not found" });
    expect(reconcileSpy).not.toHaveBeenCalled();
  });

  it("returns the fulfilled result and invalidates the shell cache", async () => {
    vi.mocked(paymentsRepo.getPaymentByWechatOrderId).mockResolvedValue(paymentWithStatus("pending"));
    reconcileSpy.mockResolvedValue({ status: "completed", fulfilled: true });
    const res = createRes();
    await getReconcileHandler()(createReq("user-1"), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "completed", fulfilled: true });
    expect(shellCache.invalidateUser).toHaveBeenCalledWith("user-1");
  });

  it("returns fulfilled:false on a repeat reconcile without invalidating the shell cache again", async () => {
    vi.mocked(paymentsRepo.getPaymentByWechatOrderId).mockResolvedValue(paymentWithStatus("completed"));
    reconcileSpy.mockResolvedValue({ status: "completed", fulfilled: false });
    const res = createRes();
    await getReconcileHandler()(createReq("user-1"), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "completed", fulfilled: false });
    expect(shellCache.invalidateUser).not.toHaveBeenCalled();
  });

  it("500s with a stable error when the WeChat query fails", async () => {
    vi.mocked(paymentsRepo.getPaymentByWechatOrderId).mockResolvedValue(paymentWithStatus("pending"));
    reconcileSpy.mockRejectedValue(new Error("wechat query exploded"));
    const res = createRes();
    await getReconcileHandler()(createReq("user-1"), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: "Failed to reconcile payment" });
    expect(shellCache.invalidateUser).not.toHaveBeenCalled();
  });
});
