import express from "express";
import { createWithServer } from '../test-utils/withServer';
import session from "express-session";

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock drizzle-orm operators ──────────────────────────────────────────────

const mockEq = vi.fn((a: any, b: any) => ({ op: 'eq', a, b }));
const mockAnd = vi.fn((...conditions: any[]) => ({ op: 'and', conditions }));
const mockInArray = vi.fn((col: any, values: any[]) => ({ op: 'inArray', col, values }));
const mockDesc = vi.fn((col: any) => ({ op: 'desc', col }));
const mockSql = vi.fn((strings: TemplateStringsArray, ...values: any[]) => ({
  op: 'sql',
  raw: strings.join('?'),
  values,
})) as any;

vi.mock("drizzle-orm", () => ({
  eq: mockEq,
  and: mockAnd,
  inArray: mockInArray,
  desc: mockDesc,
  sql: Object.assign(mockSql, {
    as: vi.fn((alias: string) => ({ op: 'sql', alias })),
  }),
}));

// ── Shared schema tables (lightweight proxies) ─────────────────────────────

const makeTable = (name: string) => new Proxy({ name } as any, {
  get(target, prop) {
    if (prop === 'name') return target.name;
    return { name: `${name}.${String(prop)}` };
  },
});

const eventPools = makeTable('eventPools');
const eventPoolGroups = makeTable('eventPoolGroups');
const eventPoolRegistrations = makeTable('eventPoolRegistrations');
const users = makeTable('users');
const events = makeTable('events');
const eventAttendance = makeTable('eventAttendance');
const blindBoxEvents = makeTable('blindBoxEvents');
const adminAccounts = makeTable('adminAccounts');

vi.mock("@shared/schema", () => ({
  eventPools,
  eventPoolGroups,
  eventPoolRegistrations,
  users,
  events,
  eventAttendance,
  blindBoxEvents,
  adminAccounts,
}));

// ── Mock DB chain ────────────────────────────────────────────────────────────

type Results = {
  pools?: any[];
  pool?: any;
  groups?: any[];
  registrations?: any[];
  groupCounts?: any[];
  adminAccounts?: any[];
  updatedPool?: any;
  groupCount?: number;
};

let currentResults: Results = {};

function resolver(state: { op: string; table: any; groupBy: boolean }) {
  if (state.op === 'query') return currentResults.pool ?? null;
  if (state.op === '$count') return currentResults.groupCount ?? 0;
  if (state.op === 'select') {
    if (state.table === eventPools) return currentResults.pools ?? [];
    if (state.table === eventPoolGroups) {
      return state.groupBy ? (currentResults.groupCounts ?? []) : (currentResults.groups ?? []);
    }
    if (state.table === eventPoolRegistrations) return currentResults.registrations ?? [];
    if (state.table === adminAccounts) return currentResults.adminAccounts ?? [];
  }
  if (state.op === 'update') {
    if (state.table === eventPools) return currentResults.updatedPool ? [currentResults.updatedPool] : [];
    return [];
  }
  if (state.op === 'delete') return [];
  return [];
}

function createChain() {
  const state = { op: '', table: null as any, groupBy: false };
  const chain: any = {
    select: () => { state.op = 'select'; return chain; },
    update: (table: any) => { state.op = 'update'; state.table = table; return chain; },
    delete: (table: any) => { state.op = 'delete'; state.table = table; return chain; },
    from: (table: any) => { state.table = table; return chain; },
    set: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    innerJoin: () => chain,
    groupBy: () => { state.groupBy = true; return chain; },
    returning: () => chain,
    then: (onFulfilled: any) => Promise.resolve(resolver(state)).then(onFulfilled),
  };
  return chain;
}

const mockDb = {
  query: { eventPools: { findFirst: vi.fn(() => Promise.resolve(currentResults.pool ?? null)) } },
  select: vi.fn(() => {
    const chain = createChain();
    chain.select();
    return chain;
  }),
  update: vi.fn((table: any) => {
    const chain = createChain();
    chain.update(table);
    return chain;
  }),
  delete: vi.fn((table: any) => {
    const chain = createChain();
    chain.delete(table);
    return chain;
  }),
  transaction: vi.fn((fn: (tx: any) => any) => fn(mockDb)),
  $count: vi.fn(() => Promise.resolve(currentResults.groupCount ?? 0)),
};

vi.mock("../db", () => ({ db: mockDb }));

// ── Mock other dependencies ────────────────────────────────────────────────

const mockExecutePostMatchCommitSideEffects = vi.fn();
const mockLogAdminAudit = vi.fn();

vi.mock("../lib/matchingPostMatchEffects", () => ({
  executePostMatchCommitSideEffects: mockExecutePostMatchCommitSideEffects,
}));

vi.mock("../lib/adminAuditLogger", () => ({
  logAdminAudit: mockLogAdminAudit,
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

vi.mock("../rateLimiter", () => ({
  createRateLimiter: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../adminAuth", () => ({
  requireAdmin: (req: any, res: any, next: any) => {
    if (req.session?.adminId) {
      (req as any).adminAccount = { id: req.session.adminId, role: req.session.adminRole || 'operator' };
      return next();
    }
    return res.status(403).json({ message: "Forbidden" });
  },
  requireOperatorOrAbove: (_req: any, _res: any, next: any) => next(),
}));

// ── Import route under test ──────────────────────────────────────────────────

const { registerAdminMatchingReviewRoutes } = await import("../routes/domains/adminMatchingReview");

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

  app.post("/__setAdmin", (req, res) => {
    (req.session as any).adminId = req.body.adminId || "admin-1";
    (req.session as any).adminRole = req.body.adminRole || "operator";
    req.session.save(() => res.json({ ok: true }));
  });

  registerAdminMatchingReviewRoutes(app);
  return app;
}

const withServer = createWithServer(createApp);

function cookieHeader(response: Response) {
  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

async function adminCookie(baseUrl: string, role = "operator") {
  const res = await fetch(`${baseUrl}/__setAdmin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminId: "admin-1", adminRole: role }),
  });
  return cookieHeader(res);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/admin/matching-reviews/pools", () => {
  beforeEach(() => {
    currentResults = {};
    vi.clearAllMocks();
  });

  it("returns 403 without an admin session", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/admin/matching-reviews/pools`);
      expect(res.status).toBe(403);
    });
  });

  it("returns review pools with group counts and reviewer names", async () => {
    currentResults = {
      pools: [
        {
          id: "pool-1",
          title: "Test Pool",
          operatorReviewStatus: "pending",
          operatorReviewedBy: "admin-2",
          matchedAt: new Date(),
          createdAt: new Date(),
        },
      ],
      groupCounts: [{ poolId: "pool-1", count: 3 }],
      adminAccounts: [{ id: "admin-2", displayName: "Reviewer Two" }],
    };

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const res = await fetch(`${baseUrl}/api/admin/matching-reviews/pools`, {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.pools).toHaveLength(1);
      expect(body.pools[0].groupCount).toBe(3);
      expect(body.pools[0].reviewedByName).toBe("Reviewer Two");
    });
  });

  it("filters by status query param", async () => {
    currentResults = { pools: [], groupCounts: [], adminAccounts: [] };

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const res = await fetch(`${baseUrl}/api/admin/matching-reviews/pools?status=approved`, {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.pools).toHaveLength(0);
    });
  });
});

describe("GET /api/admin/matching-reviews/pools/:id/groups", () => {
  beforeEach(() => {
    currentResults = {};
    vi.clearAllMocks();
  });

  it("returns 404 when pool is not found", async () => {
    currentResults = { pool: null };
    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const res = await fetch(`${baseUrl}/api/admin/matching-reviews/pools/pool-missing/groups`, {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(404);
    });
  });

  it("returns groups and members for the pool", async () => {
    currentResults = {
      pool: { id: "pool-1", title: "Test Pool", operatorReviewStatus: "pending" },
      groups: [
        { id: "group-1", poolId: "pool-1", groupNumber: 1 },
      ],
      registrations: [
        { assignedGroupId: "group-1", userId: "user-1", displayName: "Alice", archetype: "corgi", gender: "female" },
      ],
    };

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const res = await fetch(`${baseUrl}/api/admin/matching-reviews/pools/pool-1/groups`, {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.poolTitle).toBe("Test Pool");
      expect(body.groups).toHaveLength(1);
      expect(body.groups[0].members).toHaveLength(1);
      expect(body.groups[0].members[0].displayName).toBe("Alice");
    });
  });
});

describe("POST /api/admin/matching-reviews/pools/:id/approve", () => {
  beforeEach(() => {
    currentResults = {};
    vi.clearAllMocks();
  });

  it("returns 400 when pool is not pending review", async () => {
    currentResults = {
      pools: [{ id: "pool-1", operatorReviewStatus: "none" }],
      updatedPool: { id: "pool-1", operatorReviewStatus: "none" },
    };

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const res = await fetch(`${baseUrl}/api/admin/matching-reviews/pools/pool-1/approve`, {
        method: "POST",
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(400);
    });
  });

  it("approves pending pool, logs audit, and runs post-match side effects", async () => {
    currentResults = {
      pool: { id: "pool-1", title: "Test Pool", eventType: "饭局", operatorReviewStatus: "pending" },
      pools: [{ id: "pool-1", operatorReviewStatus: "pending" }],
      updatedPool: { id: "pool-1", operatorReviewStatus: "approved" },
      groups: [{ id: "group-1", poolId: "pool-1", groupNumber: 1, overallScore: 80 }],
      registrations: [
        {
          assignedGroupId: "group-1",
          userId: "user-1",
          displayName: "Alice",
          gender: "female",
          archetype: "corgi",
          budgetRange: "100-200",
          barBudgetRange: null,
          preferredLanguages: ["zh"],
          eventIntent: ["networking"],
          userIntent: ["networking"],
          cuisinePreferences: [],
          dietaryRestrictions: [],
          tasteIntensity: [],
          barThemes: [],
          alcoholComfort: null,
          preferenceStrictness: 50,
          preferredDistricts: [],
          genderCompositionPreference: null,
          acceptPairs: true,
          kolComfortLevel: 50,
          birthdate: null,
          industryNiche: null,
          industryNicheLabel: null,
          industryCategoryLabel: null,
          educationLevel: null,
          secondaryArchetype: null,
          lifeStage: null,
          workMode: null,
          hometown: null,
          hometownAffinityOptin: false,
          ageMatchPreference: null,
          tableVibePreference: null,
          vibeVector: null,
        },
      ],
      groupCount: 1,
    };

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const res = await fetch(`${baseUrl}/api/admin/matching-reviews/pools/pool-1/approve`, {
        method: "POST",
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.approvedGroups).toBe(1);

      expect(mockLogAdminAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "MATCHING_REVIEW_APPROVED", targetEntityId: "pool-1" })
      );
      expect(mockExecutePostMatchCommitSideEffects).toHaveBeenCalled();
    });
  });

  it("is idempotent when pool is already approved", async () => {
    currentResults = {
      pools: [{ id: "pool-1", operatorReviewStatus: "approved" }],
    };

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const res = await fetch(`${baseUrl}/api/admin/matching-reviews/pools/pool-1/approve`, {
        method: "POST",
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.message).toBe("Already approved");
      expect(mockExecutePostMatchCommitSideEffects).not.toHaveBeenCalled();
      expect(mockLogAdminAudit).not.toHaveBeenCalled();
    });
  });

  it("handles concurrent approval race by returning success without duplicate side effects", async () => {
    currentResults = {
      pools: [{ id: "pool-1", operatorReviewStatus: "pending" }],
      updatedPool: undefined, // simulates conditional update missing because another request changed the row
    };

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const res = await fetch(`${baseUrl}/api/admin/matching-reviews/pools/pool-1/approve`, {
        method: "POST",
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.message).toBe("Already approved");
      expect(mockExecutePostMatchCommitSideEffects).not.toHaveBeenCalled();
    });
  });
});

describe("POST /api/admin/matching-reviews/pools/:id/reject", () => {
  beforeEach(() => {
    currentResults = {};
    vi.clearAllMocks();
  });

  it("validates that a reason is provided", async () => {
    currentResults = { pools: [{ id: "pool-1", operatorReviewStatus: "pending" }] };

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const res = await fetch(`${baseUrl}/api/admin/matching-reviews/pools/pool-1/reject`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "" }),
      });
      expect(res.status).toBe(400);
    });
  });

  it("rejects the pool, deletes generated events, and resets registrations", async () => {
    currentResults = {
      pools: [{ id: "pool-1", operatorReviewStatus: "pending" }],
      updatedPool: { id: "pool-1", operatorReviewStatus: "rejected" },
      groups: [
        { id: "group-1", eventId: "event-1", blindBoxEventId: "blind-1" },
      ],
    };

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const res = await fetch(`${baseUrl}/api/admin/matching-reviews/pools/pool-1/reject`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Group composition needs rework" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(mockLogAdminAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: "MATCHING_REVIEW_REJECTED", targetEntityId: "pool-1" })
      );
    });
  });

  it("returns 409 when a concurrent request changes the pool state", async () => {
    currentResults = {
      pools: [{ id: "pool-1", operatorReviewStatus: "pending" }],
      updatedPool: undefined, // conditional update missed
      groups: [{ id: "group-1", eventId: "event-1", blindBoxEventId: null }],
    };

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const res = await fetch(`${baseUrl}/api/admin/matching-reviews/pools/pool-1/reject`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Concurrent change" }),
      });
      expect(res.status).toBe(409);
    });
  });

  it("is idempotent when pool is already rejected", async () => {
    currentResults = {
      pools: [{ id: "pool-1", operatorReviewStatus: "rejected" }],
    };

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const res = await fetch(`${baseUrl}/api/admin/matching-reviews/pools/pool-1/reject`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Already rejected" }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.message).toBe("Already rejected");
      expect(mockLogAdminAudit).not.toHaveBeenCalled();
    });
  });
});
