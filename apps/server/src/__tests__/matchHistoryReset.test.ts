/**
 * W6 (gm-debrief) AC-W6.6b — match-history reset route.
 *
 * Verifies the self-scoped appeal/reset endpoint added to the Match Compass
 * router: auth-gated, derived from the session (never the body), idempotent
 * (reports `cleared: 0` on a repeat), and failure-observable.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { clearNegativeMatchHistoryForUser, loggerInfo, loggerError, createRateLimiterSpy } =
  vi.hoisted(() => ({
    clearNegativeMatchHistoryForUser: vi.fn(),
    loggerInfo: vi.fn(),
    loggerError: vi.fn(),
    // AC-W6.6b: capture the limiter config passed at module load so the
    // throttle boundaries can be asserted (the middleware itself is mocked).
    createRateLimiterSpy: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  }));

vi.mock("@shared/schema", () => ({
  eventPools: Symbol("eventPools"),
  eventPoolRegistrations: Symbol("eventPoolRegistrations"),
  users: Symbol("users"),
}));

vi.mock("drizzle-orm", () => ({
  eq: (_field: unknown, value: unknown) => ({ type: "eq", value }),
  and: (...conditions: unknown[]) => ({ type: "and", conditions }),
  inArray: (_field: unknown, values: unknown[]) => ({ type: "inArray", values }),
  sql: () => ({}),
}));

vi.mock("../db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    query: { eventPools: { findFirst: () => Promise.resolve(null) } },
    update: () => ({ set: () => ({ where: () => Promise.resolve([]) }) }),
  },
}));

vi.mock("../lib/logger", () => ({
  logger: { info: loggerInfo, warn: vi.fn(), error: loggerError, debug: vi.fn() },
}));

vi.mock("../rateLimiter", () => ({
  createRateLimiter: createRateLimiterSpy,
}));

vi.mock("../lib/requestAuth", () => ({
  getAuthenticatedUserId: (req: any) => req.session?.userId ?? null,
}));

vi.mock("../poolMatchingService", () => ({
  pairMeetsDealbreakers: vi.fn().mockReturnValue(true),
}));

vi.mock("../lib/matchCompass", () => ({
  buildDefaultPreferencesFromArchetype: vi.fn(),
  coerceStrictness: vi.fn(),
  resolveEffectivePreferenceDNA: vi.fn(),
  resolveTemperatureBand: vi.fn(),
}));

vi.mock("../repositories/matchHistoryRepo", () => ({
  clearNegativeMatchHistoryForUser,
}));

const { registerMatchCompassRoutes } = await import("../routes/domains/matchCompass");

function makeApp() {
  const routes: Array<{ method: string; path: string; handler: any }> = [];
  const app: any = {
    get: (path: string, ...handlers: any[]) => routes.push({ method: "GET", path, handler: handlers[handlers.length - 1] }),
    patch: (path: string, ...handlers: any[]) => routes.push({ method: "PATCH", path, handler: handlers[handlers.length - 1] }),
    post: (path: string, ...handlers: any[]) => routes.push({ method: "POST", path, handler: handlers[handlers.length - 1] }),
    _routes: routes,
  };
  registerMatchCompassRoutes(app as any);
  return app;
}

function mockReq(options: { userId?: string; body?: any }): any {
  return { session: { userId: options.userId }, body: options.body ?? {}, params: {} };
}

function mockRes() {
  const res: any = {
    statusCode: 200,
    jsonBody: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.jsonBody = body;
      return this;
    },
  };
  return res;
}

const RESET_PATH = "/api/me/match-history/reset";

describe("W6 match-history reset route", () => {
  beforeEach(() => {
    clearNegativeMatchHistoryForUser.mockReset();
    loggerInfo.mockClear();
    loggerError.mockClear();
  });

  it("returns 401 without auth (fail-closed)", async () => {
    const app = makeApp();
    const route = app._routes.find((r: any) => r.path === RESET_PATH);
    const res = mockRes();
    await route.handler(mockReq({}), res);
    expect(res.statusCode).toBe(401);
    expect(clearNegativeMatchHistoryForUser).not.toHaveBeenCalled();
  });

  it("clears negatives for the SESSION user, never the body user (self-scoped)", async () => {
    clearNegativeMatchHistoryForUser.mockResolvedValueOnce(2);
    const app = makeApp();
    const route = app._routes.find((r: any) => r.path === RESET_PATH);
    const res = mockRes();

    await route.handler(mockReq({ userId: "user-1", body: { userId: "victim-2" } }), res);

    expect(clearNegativeMatchHistoryForUser).toHaveBeenCalledWith("user-1");
    expect(res.jsonBody).toEqual({ reset: true, cleared: 2 });
  });

  it("is idempotent — a repeat call reports cleared: 0", async () => {
    clearNegativeMatchHistoryForUser.mockResolvedValueOnce(0);
    const app = makeApp();
    const route = app._routes.find((r: any) => r.path === RESET_PATH);
    const res = mockRes();

    await route.handler(mockReq({ userId: "user-1" }), res);

    expect(res.jsonBody).toEqual({ reset: true, cleared: 0 });
  });

  it("surfaces a persistence failure as a 500", async () => {
    clearNegativeMatchHistoryForUser.mockRejectedValueOnce(new Error("db down"));
    const app = makeApp();
    const route = app._routes.find((r: any) => r.path === RESET_PATH);
    const res = mockRes();

    await route.handler(mockReq({ userId: "user-1" }), res);

    expect(res.statusCode).toBe(500);
    expect(loggerError).toHaveBeenCalled();
  });

  // AC-W6.6b: the reset route must be throttled independently of preference
  // edits — a rare, user-initiated appeal at 5 requests/hour.
  it("throttles the reset route at 5 requests per hour", () => {
    expect(createRateLimiterSpy).toHaveBeenCalledWith({
      windowMs: 3600000,
      maxRequests: 5,
      keyPrefix: "mh-reset",
    });
  });
});
