/**
 * GET /api/payments/ritual-context — additive `subscriptionPlans` surface
 * regression tests (2026-10-11).
 *
 * Contract: `.git/.orchestration/sprints/sprint-contract.checkout-subscription-upsell-flags.md`
 *   AC-7  response gains additive subscriptionPlans for monthly + quarterly,
 *         sourced from pricing_settings (same rows as the storefront `plans`)
 *   AC-8  monthly appears with the seeded 9800 cents; when the pricing row is
 *         missing the response stays intact via SUBSCRIPTION_PRICE_FALLBACKS
 *         (9800/29400) and seed display constants; existing keys untouched
 */
import express from "express";
import session from "express-session";
import { createWithServer } from "../test-utils/withServer";

import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgres://postgres:postgres@127.0.0.1:5432/joyjoin_test";

const mockGetActivePricingSettings = vi.fn();
const mockGetUserCoupons = vi.fn();
const mockGetUser = vi.fn();

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
    getUserCoupons: mockGetUserCoupons,
  },
}));

vi.mock("../repositories/usersRepo", () => ({
  usersRepo: {
    getUser: mockGetUser,
  },
}));

vi.mock("../repositories/pricingRepo", () => ({
  pricingRepo: {
    getActivePricingSettings: mockGetActivePricingSettings,
  },
}));

vi.mock("../subscriptionService", () => ({
  subscriptionService: {
    renewSubscription: vi.fn(),
  },
}));

vi.mock("../storage", () => ({
  storage: {
    getActivePricingSettings: vi.fn(),
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

// Community-stats queries: three `select().from().where()` count reads plus
// one `select().from().innerJoin().where().orderBy().limit()` read.
vi.mock("../db", () => {
  const limit = vi.fn().mockResolvedValue([]);
  const orderBy = vi.fn(() => ({ limit }));
  const joinWhere = vi.fn(() => ({ orderBy }));
  const innerJoin = vi.fn(() => ({ where: joinWhere }));
  const where = vi.fn().mockResolvedValue([{ count: 0 }]);
  const from = vi.fn(() => ({ where, innerJoin }));
  const select = vi.fn(() => ({ from }));
  return { db: { select } };
});

const { registerPaymentRoutes } = await import("../routes/domains/payments");

const seededPricingRows = [
  {
    id: "pricing-monthly",
    planType: "monthly",
    displayName: "悦聚月卡",
    displayNameEn: "YueJu Monthly",
    description: "每月 6 场局，说走就走",
    priceInCents: 9800,
    originalPriceInCents: null,
    durationDays: 30,
    sortOrder: 1,
    isActive: true,
    isFeatured: false,
  },
  {
    id: "pricing-quarterly",
    planType: "quarterly",
    displayName: "悦聚季卡",
    displayNameEn: "YueJu Quarterly",
    description: "一季 18 场局，场场有人陪",
    priceInCents: 29400,
    originalPriceInCents: null,
    durationDays: 90,
    sortOrder: 2,
    isActive: true,
    isFeatured: true,
  },
  {
    id: "pricing-event-single",
    planType: "event_single",
    displayName: "单场局票",
    displayNameEn: "Single Pass",
    description: "一场局的入场券",
    priceInCents: 8800,
    originalPriceInCents: null,
    durationDays: null,
    sortOrder: 3,
    isActive: true,
    isFeatured: false,
  },
];

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
    })
  );

  app.post("/__test__/login", (req, res) => {
    req.session.userId = "ritual-user-1";
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

async function fetchRitualContext(baseUrl: string) {
  const loginResponse = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
  const authenticatedCookie = cookieHeader(loginResponse);

  const response = await fetch(`${baseUrl}/api/payments/ritual-context`, {
    headers: { cookie: authenticatedCookie },
  });
  const body = (await response.json()) as Record<string, any>;
  return { response, body };
}

describe("GET /api/payments/ritual-context — subscriptionPlans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      id: "ritual-user-1",
      currentCity: "深圳",
      primaryArchetype: "corgi",
    });
    mockGetUserCoupons.mockResolvedValue([]);
  });

  it("includes subscription plans with the seeded 9800¢ monthly / 29400¢ quarterly rows (AC-7)", async () => {
    mockGetActivePricingSettings.mockResolvedValue(seededPricingRows);

    await withServer(async (baseUrl) => {
      const { response, body } = await fetchRitualContext(baseUrl);

      expect(response.status).toBe(200);

      const subscriptionPlans = body.subscriptionPlans as Array<Record<string, any>>;
      expect(Array.isArray(subscriptionPlans)).toBe(true);
      expect(subscriptionPlans).toHaveLength(2);

      const monthly = subscriptionPlans.find((p) => p.planType === "monthly");
      expect(monthly).toMatchObject({
        planType: "monthly",
        displayName: "悦聚月卡",
        displayNameEn: "YueJu Monthly",
        description: "每月 6 场局，说走就走",
        priceInCents: 9800,
        durationDays: 30,
      });

      const quarterly = subscriptionPlans.find((p) => p.planType === "quarterly");
      expect(quarterly).toMatchObject({
        planType: "quarterly",
        displayName: "悦聚季卡",
        priceInCents: 29400,
        durationDays: 90,
      });

      // Existing response keys stay intact (additive-only change).
      expect(body.user).toMatchObject({ id: "ritual-user-1", city: "深圳", archetype: "corgi" });
      expect(Array.isArray(body.plans)).toBe(true);
      expect(body.plans).toHaveLength(3);
      expect(body.plans.map((p: any) => p.planType)).toEqual(["monthly", "quarterly", "event_single"]);
      expect(Array.isArray(body.coupons)).toBe(true);
      expect(body.community).toMatchObject({ userCity: "深圳" });
    });
  });

  it("stays intact with fallback prices (9800/29400) when pricing rows are missing (AC-8)", async () => {
    mockGetActivePricingSettings.mockResolvedValue([]);

    await withServer(async (baseUrl) => {
      const { response, body } = await fetchRitualContext(baseUrl);

      expect(response.status).toBe(200);

      const subscriptionPlans = body.subscriptionPlans as Array<Record<string, any>>;
      expect(subscriptionPlans).toHaveLength(2);

      const monthly = subscriptionPlans.find((p) => p.planType === "monthly");
      expect(monthly).toMatchObject({
        planType: "monthly",
        displayName: "悦聚月卡",
        displayNameEn: "YueJu Monthly",
        priceInCents: 9800,
        durationDays: 30,
      });

      const quarterly = subscriptionPlans.find((p) => p.planType === "quarterly");
      expect(quarterly).toMatchObject({
        planType: "quarterly",
        displayName: "悦聚季卡",
        priceInCents: 29400,
        durationDays: 90,
      });

      // Existing keys intact even with zero pricing rows.
      expect(body.user).toMatchObject({ id: "ritual-user-1" });
      expect(body.plans).toEqual([]);
      expect(body.coupons).toEqual([]);
      expect(body.community).toBeDefined();
    });
  });
});
