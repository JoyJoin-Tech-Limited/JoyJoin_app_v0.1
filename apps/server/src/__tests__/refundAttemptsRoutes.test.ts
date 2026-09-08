/**
 * Route tests for GET /api/admin/refund-attempts — optional `status` filter
 * and `limit` (default 200, max 500) query params so the dashboard never
 * fetches the whole table.
 */

import express from "express";
import { withServerForApp as withServer } from "../test-utils/withServer";
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  mockGetAll: null as any,
}));

vi.mock("../db", () => ({ db: {} }));
vi.mock("../paymentService", () => ({ paymentService: {} }));
vi.mock("../subscriptionService", () => ({ subscriptionService: {} }));
vi.mock("../storage", () => ({ storage: {} }));
vi.mock("../repositories/paymentsRepo", () => ({ paymentsRepo: {} }));
vi.mock("../repositories/paymentFulfillmentRepo", () => ({ paymentFulfillmentRepo: {} }));
vi.mock("../repositories/usersRepo", () => ({ usersRepo: {} }));
vi.mock("../repositories/pricingRepo", () => ({ pricingRepo: {} }));
vi.mock("../repositories/refundAttemptsRepo", () => ({
  refundAttemptsRepo: {
    getAllWithPaymentDetails: (...args: unknown[]) => h.mockGetAll(...args),
  },
}));
vi.mock("../lib/shellCache", () => ({ shellCache: {} }));
vi.mock("../lib/featureFlags", () => ({ getFeatureFlag: vi.fn(async () => true) }));
vi.mock("../lib/paymentTestPrice", () => ({ getTestPriceCents: vi.fn(() => null) }));
vi.mock("../lib/poolRegistrationRules", () => ({
  describePoolRegistrationAvailability: vi.fn(),
}));
vi.mock("../lib/contentSafety", () => ({
  validateContentSafeAsync: vi.fn(),
  contentViolationResponse: vi.fn(),
}));
vi.mock("../abuseDetection", () => ({ recordViolation: vi.fn() }));
vi.mock("../rateLimiter", () => ({
  paymentEndpointLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  webhookEndpointLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../middleware/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../lib/adminAuditLogger", () => ({ logAdminAudit: vi.fn() }));

vi.mock("../adminAuth", async () => {
  const actual = await vi.importActual<typeof import("../adminAuth")>("../adminAuth");
  return {
    ...actual,
    requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireOperatorOrAbove: (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

const { registerPaymentRoutes } = await import("../routes/domains/payments");

function buildTestApp() {
  const app = express();
  app.use(express.json());
  registerPaymentRoutes(app);
  return app;
}

describe("GET /api/admin/refund-attempts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.mockGetAll = vi.fn().mockResolvedValue([]);
  });

  it("defaults to limit=200 with no status filter", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/refund-attempts`);
      expect(res.status).toBe(200);
      expect(h.mockGetAll).toHaveBeenCalledWith({ status: undefined, limit: 200 });
    });
  });

  it("passes a valid status filter and explicit limit through to the repo", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/refund-attempts?status=pending&limit=50`);
      expect(res.status).toBe(200);
      expect(h.mockGetAll).toHaveBeenCalledWith({ status: "pending", limit: 50 });
    });
  });

  it("400s on an unknown status value", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/refund-attempts?status=bogus`);
      expect(res.status).toBe(400);
      expect(h.mockGetAll).not.toHaveBeenCalled();
    });
  });

  it("400s when limit exceeds the 500 cap or is not a positive integer", async () => {
    await withServer(buildTestApp(), async (base) => {
      const tooBig = await fetch(`${base}/api/admin/refund-attempts?limit=501`);
      expect(tooBig.status).toBe(400);
      const notNumeric = await fetch(`${base}/api/admin/refund-attempts?limit=abc`);
      expect(notNumeric.status).toBe(400);
      const zero = await fetch(`${base}/api/admin/refund-attempts?limit=0`);
      expect(zero.status).toBe(400);
      expect(h.mockGetAll).not.toHaveBeenCalled();
    });
  });

  it("accepts the max limit of 500", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/refund-attempts?limit=500`);
      expect(res.status).toBe(200);
      expect(h.mockGetAll).toHaveBeenCalledWith({ status: undefined, limit: 500 });
    });
  });
});
