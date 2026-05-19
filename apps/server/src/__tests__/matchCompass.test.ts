/**
 * Match Compass API endpoint tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = {
  pools: [] as any[],
  registrations: [] as any[],
  users: [] as any[],
  updateSetCalls: [] as any[],
  updateReturningQueue: [] as any[],
};

const eventPoolsTable = Symbol("eventPools");
const eventPoolRegistrationsTable = Symbol("eventPoolRegistrations");
const usersTable = Symbol("users");

vi.mock("@shared/schema", () => ({
  eventPools: eventPoolsTable,
  eventPoolRegistrations: eventPoolRegistrationsTable,
  users: usersTable,
}));

vi.mock("drizzle-orm", () => ({
  eq: (_field: unknown, value: unknown) => ({ type: "eq", value }),
  and: (...conditions: unknown[]) => ({ type: "and", conditions }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: "sql",
    strings,
    values,
  }),
}));

function makeAwaitable(value: unknown) {
  return {
    limit: () => Promise.resolve(value),
    returning: () => Promise.resolve(value),
    then: (resolve: (v: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  };
}

vi.mock("../db", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: any) => {
          if (table === eventPoolsTable) {
            const poolId = condition?.value;
            const found = mockState.pools.find((p) => p.id === poolId);
            return makeAwaitable(found ? [found] : []);
          }
          if (table === eventPoolRegistrationsTable) {
            if (condition?.type === "and") {
              const poolId = condition.conditions?.[0]?.value;
              const userId = condition.conditions?.[1]?.value;
              const found = mockState.registrations.find(
                (r) => r.poolId === poolId && r.userId === userId,
              );
              return makeAwaitable(found ? [found] : []);
            }
            if (condition?.type === "eq") {
              const regId = condition?.value;
              const found = mockState.registrations.find((r) => r.id === regId);
              return makeAwaitable(found ? [found] : []);
            }
            return makeAwaitable(mockState.registrations);
          }
          if (table === usersTable) {
            const userId = condition?.value;
            const found = mockState.users.find((u) => u.id === userId);
            return makeAwaitable(found ? [found] : []);
          }
          return makeAwaitable([]);
        },
        innerJoin: () => ({
          where: () => makeAwaitable([]),
        }),
      }),
    }),
    query: {
      eventPools: {
        findFirst: ({ where }: any) => {
          const poolId = where?.value;
          return Promise.resolve(mockState.pools.find((p) => p.id === poolId) ?? null);
        },
      },
    },
    update: (_table: unknown) => ({
      set: (values: any) => {
        mockState.updateSetCalls.push(values);
        return {
          where: () => ({
            returning: () =>
              Promise.resolve([
                { ...mockState.registrations[0], ...values },
              ]),
          }),
        };
      },
    }),
  },
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../rateLimiter", () => ({
  createRateLimiter: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../lib/requestAuth", () => ({
  getAuthenticatedUserId: (req: any) => req.session?.userId ?? null,
}));

vi.mock("../poolMatchingService", () => ({
  pairMeetsDealbreakers: vi.fn().mockReturnValue(true),
}));

const { registerMatchCompassRoutes } = await import("../routes/domains/matchCompass");

function makeApp() {
  const routes: Array<{ method: string; path: string; handler: any }> = [];
  const app: any = {
    get: (path: string, ...handlers: any[]) =>
      routes.push({ method: "GET", path, handler: handlers[handlers.length - 1] }),
    patch: (path: string, ...handlers: any[]) =>
      routes.push({ method: "PATCH", path, handler: handlers[handlers.length - 1] }),
    post: (path: string, ...handlers: any[]) =>
      routes.push({ method: "POST", path, handler: handlers[handlers.length - 1] }),
    _routes: routes,
  };
  registerMatchCompassRoutes(app as any);
  return app;
}

function mockReq(options: { userId?: string; body?: any; params?: any }): any {
  return {
    session: { userId: options.userId },
    body: options.body ?? {},
    params: options.params ?? {},
  };
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

describe("Match Compass API", () => {
  beforeEach(() => {
    mockState.pools = [];
    mockState.registrations = [];
    mockState.users = [];
    mockState.updateSetCalls = [];
    mockState.updateReturningQueue = [];
  });

  describe("GET /api/event-pools/:id/match-compass", () => {
    it("returns 401 without auth", async () => {
      const app = makeApp();
      const req = mockReq({});
      const res = mockRes();
      const route = app._routes.find((r: any) => r.path === "/api/event-pools/:id/match-compass");
      await route.handler(req, res);
      expect(res.statusCode).toBe(401);
    });

    it("returns match compass data for a valid registration", async () => {
      mockState.pools = [
        {
          id: "pool-1",
          status: "active",
          preferenceLockAt: null,
          eventType: "饭局",
        },
      ];
      mockState.registrations = [
        {
          id: "reg-1",
          poolId: "pool-1",
          userId: "user-1",
          matchStatus: "pending",
          preferenceStrictness: 50,
          preferredDistricts: null,
          genderCompositionPreference: null,
          acceptPairs: true,
          kolComfortLevel: null,
        },
      ];
      mockState.users = [
        {
          id: "user-1",
          primaryArchetype: "corgi",
          gender: "女性",
          ageMatchPreference: null,
          tableVibePreference: null,
        },
      ];

      const app = makeApp();
      const req = mockReq({ userId: "user-1", params: { id: "pool-1" } });
      const res = mockRes();
      const route = app._routes.find((r: any) => r.path === "/api/event-pools/:id/match-compass");
      await route.handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.jsonBody.matchCompass.strictness).toBe(50);
    });
  });

  describe("PATCH /api/event-pool-registrations/:id/preferences", () => {
    it("rejects edits when pool.status !== active", async () => {
      mockState.pools = [
        {
          id: "pool-1",
          status: "matching",
          preferenceLockAt: null,
        },
      ];
      mockState.registrations = [
        {
          id: "reg-1",
          poolId: "pool-1",
          userId: "user-1",
          matchStatus: "pending",
          preferenceStrictness: 50,
        },
      ];

      const app = makeApp();
      const req = mockReq({ userId: "user-1", params: { id: "reg-1" }, body: { strictness: 40 } });
      const res = mockRes();
      const route = app._routes.find(
        (r: any) => r.path === "/api/event-pool-registrations/:id/preferences",
      );
      await route.handler(req, res);
      expect(res.statusCode).toBe(409);
      expect(res.jsonBody.code).toBe("pool_not_active");
    });

    it("rejects edits when registration.matchStatus !== pending", async () => {
      mockState.pools = [
        {
          id: "pool-1",
          status: "active",
          preferenceLockAt: null,
        },
      ];
      mockState.registrations = [
        {
          id: "reg-1",
          poolId: "pool-1",
          userId: "user-1",
          matchStatus: "matched",
          preferenceStrictness: 50,
        },
      ];

      const app = makeApp();
      const req = mockReq({ userId: "user-1", params: { id: "reg-1" }, body: { strictness: 40 } });
      const res = mockRes();
      const route = app._routes.find(
        (r: any) => r.path === "/api/event-pool-registrations/:id/preferences",
      );
      await route.handler(req, res);
      expect(res.statusCode).toBe(409);
      expect(res.jsonBody.code).toBe("registration_not_pending");
    });

    it("rejects edits after lock time", async () => {
      const lockAt = new Date(Date.now() - 3600_000); // 1 hour ago
      mockState.pools = [
        {
          id: "pool-1",
          status: "active",
          preferenceLockAt: lockAt,
        },
      ];
      mockState.registrations = [
        {
          id: "reg-1",
          poolId: "pool-1",
          userId: "user-1",
          matchStatus: "pending",
          preferenceStrictness: 50,
        },
      ];

      const app = makeApp();
      const req = mockReq({ userId: "user-1", params: { id: "reg-1" }, body: { strictness: 40 } });
      const res = mockRes();
      const route = app._routes.find(
        (r: any) => r.path === "/api/event-pool-registrations/:id/preferences",
      );
      await route.handler(req, res);
      expect(res.statusCode).toBe(409);
      expect(res.jsonBody.code).toBe("preferences_locked");
    });

    it("rejects invalid strictness values", async () => {
      mockState.pools = [
        {
          id: "pool-1",
          status: "active",
          preferenceLockAt: null,
        },
      ];
      mockState.registrations = [
        {
          id: "reg-1",
          poolId: "pool-1",
          userId: "user-1",
          matchStatus: "pending",
          preferenceStrictness: 50,
        },
      ];

      const app = makeApp();
      const req = mockReq({
        userId: "user-1",
        params: { id: "reg-1" },
        body: { strictness: 150 },
      });
      const res = mockRes();
      const route = app._routes.find(
        (r: any) => r.path === "/api/event-pool-registrations/:id/preferences",
      );
      await route.handler(req, res);
      expect(res.statusCode).toBe(400);
    });

    it("rejects invalid genderComposition", async () => {
      mockState.pools = [
        {
          id: "pool-1",
          status: "active",
          preferenceLockAt: null,
        },
      ];
      mockState.registrations = [
        {
          id: "reg-1",
          poolId: "pool-1",
          userId: "user-1",
          matchStatus: "pending",
          preferenceStrictness: 50,
        },
      ];

      const app = makeApp();
      const req = mockReq({
        userId: "user-1",
        params: { id: "reg-1" },
        body: { genderComposition: "invalid" },
      });
      const res = mockRes();
      const route = app._routes.find(
        (r: any) => r.path === "/api/event-pool-registrations/:id/preferences",
      );
      await route.handler(req, res);
      expect(res.statusCode).toBe(400);
    });

    it("allows valid patch and logs the edit", async () => {
      mockState.pools = [
        {
          id: "pool-1",
          status: "active",
          preferenceLockAt: null,
        },
      ];
      mockState.registrations = [
        {
          id: "reg-1",
          poolId: "pool-1",
          userId: "user-1",
          matchStatus: "pending",
          preferenceStrictness: 50,
          preferredDistricts: null,
          genderCompositionPreference: null,
          acceptPairs: null,
          kolComfortLevel: null,
        },
      ];

      const app = makeApp();
      const req = mockReq({
        userId: "user-1",
        params: { id: "reg-1" },
        body: { strictness: 30, genderComposition: "mixed" },
      });
      const res = mockRes();
      const route = app._routes.find(
        (r: any) => r.path === "/api/event-pool-registrations/:id/preferences",
      );
      await route.handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.jsonBody.ok).toBe(true);
    });
  });

  describe("POST /api/event-pool-registrations/:id/preferences/reset", () => {
    it("resets to DNA defaults", async () => {
      mockState.pools = [
        {
          id: "pool-1",
          status: "active",
          preferenceLockAt: null,
        },
      ];
      mockState.registrations = [
        {
          id: "reg-1",
          poolId: "pool-1",
          userId: "user-1",
          matchStatus: "pending",
          preferenceStrictness: 80,
          preferredDistricts: ["南山区"],
          genderCompositionPreference: "female_only",
          acceptPairs: false,
          kolComfortLevel: "avoid",
        },
      ];
      mockState.users = [
        {
          id: "user-1",
          primaryArchetype: "corgi",
        },
      ];

      const app = makeApp();
      const req = mockReq({ userId: "user-1", params: { id: "reg-1" } });
      const res = mockRes();
      const route = app._routes.find(
        (r: any) => r.path === "/api/event-pool-registrations/:id/preferences/reset",
      );
      await route.handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.jsonBody.ok).toBe(true);
    });
  });

  describe("POST /api/users/me/preference-dna", () => {
    it("saves DNA defaults", async () => {
      mockState.users = [{ id: "user-1" }];

      const app = makeApp();
      const req = mockReq({
        userId: "user-1",
        body: { strictness: 40, acceptPairs: true },
      });
      const res = mockRes();
      const route = app._routes.find((r: any) => r.path === "/api/users/me/preference-dna");
      await route.handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.jsonBody.ok).toBe(true);
    });

    it("rejects invalid strictness for DNA", async () => {
      mockState.users = [{ id: "user-1" }];

      const app = makeApp();
      const req = mockReq({
        userId: "user-1",
        body: { strictness: -5 },
      });
      const res = mockRes();
      const route = app._routes.find((r: any) => r.path === "/api/users/me/preference-dna");
      await route.handler(req, res);
      expect(res.statusCode).toBe(400);
    });
  });
});
