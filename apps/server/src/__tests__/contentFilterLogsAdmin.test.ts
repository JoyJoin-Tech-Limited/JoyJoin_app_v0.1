/**
 * Sprint S2 — Admin content-filter log review queue tests.
 *
 * Covers:
 *  - PATCH /api/admin/content-filter/logs/:id — RBAC (401/403), 404, 400
 *    (invalid enum / empty body / oversized note), happy path (changed:true,
 *    reviewedBy/reviewedAt set), mandatory audit with TOP-LEVEL before/after
 *    (A1), idempotent repeat (changed:false, single audit, no write),
 *    missFlag toggle, reviewNote persistence.
 *  - GET /api/admin/content-filter/logs — reviewStatus/missFlag filters
 *    (+400 on invalid values), reviewer displayName via aliased join (A3),
 *    pageSize cap ≤ 100.
 *
 * Mock strategy mirrors adminMatchingReview.test.ts: drizzle operators,
 * @shared/schema table proxies, ../db chain, ../adminAuth middleware.
 */
import express from "express";
import session from "express-session";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWithServer } from '../test-utils/withServer';

// ── Mock drizzle-orm operators ──────────────────────────────────────────────

const mockEq = vi.fn((a: any, b: any) => ({ op: 'eq', a, b }));
const mockAnd = vi.fn((...conditions: any[]) => ({ op: 'and', conditions }));
const mockDesc = vi.fn((col: any) => ({ op: 'desc', col }));
const mockSql = vi.fn((strings: TemplateStringsArray, ...values: any[]) => ({
  op: 'sql',
  raw: strings.join('?'),
  values,
})) as any;
const mockGte = vi.fn((a: any, b: any) => ({ op: 'gte', a, b }));
const mockLte = vi.fn((a: any, b: any) => ({ op: 'lte', a, b }));

vi.mock("drizzle-orm", () => ({
  eq: mockEq,
  and: mockAnd,
  desc: mockDesc,
  sql: mockSql,
  gte: mockGte,
  lte: mockLte,
}));

// A3: `alias` is imported from drizzle-orm/pg-core (not the main barrel).
const mockAlias = vi.fn((table: any, name: string) => {
  const base = typeof table?.name === 'string' ? table.name : 'unknown';
  return new Proxy({ name: `${base}Alias` } as any, {
    get(_target, prop) {
      if (prop === 'name') return `${base}Alias`;
      return { name: `${name}.${String(prop)}` };
    },
  });
});

vi.mock("drizzle-orm/pg-core", () => ({
  alias: mockAlias,
}));

// ── Shared schema tables (lightweight proxies) ─────────────────────────────

const makeTable = (name: string) => new Proxy({ name } as any, {
  get(target, prop) {
    if (prop === 'name') return target.name;
    return { name: `${name}.${String(prop)}` };
  },
});

const contentFilterLogs = makeTable('contentFilterLogs');
const users = makeTable('users');

vi.mock("@shared/schema", () => ({
  contentFilterLogs,
  users,
}));

// ── Mock DB chain ───────────────────────────────────────────────────────────

// Knobs per query shape:
//   - mockExisting: PATCH minimal pre-fetch ({id, reviewStatus, missFlag, reviewNote})
//   - mockPatchFullRow: PATCH response full row (has reviewedByDisplayName)
//   - mockGetRows: GET rows query result
//   - mockCount: GET count query result
let mockExisting: any = null;
let mockPatchFullRow: any = null;
let mockGetRows: any[] = [];
let mockCount = 0;

// Captured write calls for assertions
let updateCalls: { table: any; payload: any }[] = [];

function resolveResult(state: any): any {
  if (state.op === 'select') {
    const cfg = state.config ?? {};
    if ('count' in cfg) return [{ count: mockCount }];
    if ('reviewedByDisplayName' in cfg) {
      return mockPatchFullRow ? [mockPatchFullRow] : mockGetRows;
    }
    if ('reviewStatus' in cfg) return mockExisting ? [mockExisting] : [];
    return [];
  }
  return [];
}

function createChain() {
  const state: any = { op: '', table: null, config: null, payload: null };
  const chain: any = {
    select: (config: any) => { state.op = 'select'; state.config = config; return chain; },
    update: (table: any) => { state.op = 'update'; state.table = table; return chain; },
    from: (table: any) => { state.table = table; return chain; },
    set: (payload: any) => {
      state.op = 'set';
      state.payload = payload;
      if (state.table) updateCalls.push({ table: state.table, payload });
      return chain;
    },
    where: () => chain,
    leftJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    returning: () => chain,
    then: (onFulfilled: any) => Promise.resolve(resolveResult(state)).then(onFulfilled),
  };
  return chain;
}

const mockDb = {
  select: vi.fn((config: any) => {
    const chain = createChain();
    chain.select(config);
    return chain;
  }),
  update: vi.fn((table: any) => {
    const chain = createChain();
    chain.update(table);
    return chain;
  }),
};

vi.mock("../db", () => ({ db: mockDb }));

// ── Mock other dependencies ────────────────────────────────────────────────

const mockAudit = vi.fn();

vi.mock("../adminAuth", () => ({
  requireAdmin: (req: any, res: any, next: any) => {
    if (req.session?.adminId) {
      (req as any).adminAccount = { id: req.session.adminId, role: req.session.adminRole || 'operator' };
      (req as any).adminRole = req.session.adminRole || 'operator';
      next();
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  },
  requireOperatorOrAbove: (req: any, res: any, next: any) => {
    const role = (req as any).adminAccount?.role;
    if (role === 'viewer') {
      res.status(403).json({ message: "Forbidden: viewer cannot perform this action" });
    } else {
      next();
    }
  },
}));

vi.mock("../lib/adminAuditLogger", () => ({
  logAdminAudit: mockAudit,
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

// ── App + session helpers ───────────────────────────────────────────────────

const { registerAdminOperationsRoutes } = await import("../routes/domains/adminOperations");

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

  registerAdminOperationsRoutes(app);
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

const DEFAULT_EXISTING = {
  id: "log-1",
  reviewStatus: "pending",
  missFlag: false,
  reviewNote: null,
};

const DEFAULT_FULL_ROW = {
  id: "log-1",
  userId: "user-1",
  displayName: "User One",
  field: "nickname",
  violationType: "harassment",
  severity: "warning",
  matchedKeywords: ["badword"],
  inputPreview: "hello badword",
  source: "onboarding",
  createdAt: new Date("2026-08-01T10:00:00Z"),
  reviewStatus: "pending",
  reviewedBy: null,
  reviewedAt: null,
  missFlag: false,
  reviewNote: null,
  reviewedByDisplayName: null,
};

describe("PATCH /api/admin/content-filter/logs/:id", () => {
  beforeEach(() => {
    mockExisting = { ...DEFAULT_EXISTING };
    mockPatchFullRow = { ...DEFAULT_FULL_ROW };
    mockGetRows = [];
    mockCount = 0;
    updateCalls = [];
    vi.clearAllMocks();
  });

  it("returns 401 without an admin session", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/admin/content-filter/logs/log-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: "reviewed" }),
      });
      expect(res.status).toBe(401);
      expect(mockAudit).not.toHaveBeenCalled();
    });
  });

  it("returns 403 for viewer role", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl, "viewer");
      const res = await fetch(`${baseUrl}/api/admin/content-filter/logs/log-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ reviewStatus: "reviewed" }),
      });
      expect(res.status).toBe(403);
      expect(updateCalls).toHaveLength(0);
      expect(mockAudit).not.toHaveBeenCalled();
    });
  });

  it("returns 404 when the log row does not exist", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      mockExisting = null;
      const res = await fetch(`${baseUrl}/api/admin/content-filter/logs/nope`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ reviewStatus: "reviewed" }),
      });
      expect(res.status).toBe(404);
      expect(updateCalls).toHaveLength(0);
      expect(mockAudit).not.toHaveBeenCalled();
    });
  });

  it("returns 400 for an invalid reviewStatus enum", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const res = await fetch(`${baseUrl}/api/admin/content-filter/logs/log-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ reviewStatus: "bogus" }),
      });
      expect(res.status).toBe(400);
      expect(updateCalls).toHaveLength(0);
      expect(mockAudit).not.toHaveBeenCalled();
    });
  });

  it("returns 400 for an empty body", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const res = await fetch(`${baseUrl}/api/admin/content-filter/logs/log-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      expect(updateCalls).toHaveLength(0);
    });
  });

  it("returns 400 for a note longer than 500 chars", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const res = await fetch(`${baseUrl}/api/admin/content-filter/logs/log-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ note: "x".repeat(501) }),
      });
      expect(res.status).toBe(400);
      expect(updateCalls).toHaveLength(0);
    });
  });

  it("returns 200 for operator: effective status change writes row + audit with top-level before/after", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl, "operator");
      mockPatchFullRow = {
        ...DEFAULT_FULL_ROW,
        reviewStatus: "reviewed",
        reviewedBy: "admin-1",
        reviewedAt: new Date(),
        missFlag: false,
        reviewNote: "legit block",
      };

      const res = await fetch(`${baseUrl}/api/admin/content-filter/logs/log-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ reviewStatus: "reviewed", missFlag: false, note: "legit block" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.changed).toBe(true);
      expect(body.row.reviewStatus).toBe("reviewed");
      expect(body.row.reviewNote).toBe("legit block");

      // Single-row update with server-derived reviewedBy/reviewedAt
      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0].payload.reviewStatus).toBe("reviewed");
      expect(updateCalls[0].payload.missFlag).toBe(false);
      expect(updateCalls[0].payload.reviewNote).toBe("legit block");
      expect(updateCalls[0].payload.reviewedBy).toBe("admin-1");
      expect(updateCalls[0].payload.reviewedAt).toBeInstanceOf(Date);

      // A1: audit called ONCE with TOP-LEVEL before/after (not nested in context)
      expect(mockAudit).toHaveBeenCalledTimes(1);
      const auditCall = mockAudit.mock.calls[0][0];
      expect(auditCall.action).toBe("CONTENT_FILTER_LOG_REVIEWED");
      expect(auditCall.adminId).toBe("admin-1");
      expect(auditCall.adminRole).toBe("operator");
      expect(auditCall.targetEntityType).toBe("content_filter_log");
      expect(auditCall.targetEntityId).toBe("log-1");
      expect(auditCall.before).toEqual({ reviewStatus: "pending", missFlag: false });
      expect(auditCall.after).toEqual({ reviewStatus: "reviewed", missFlag: false });
      // before/after live at top level, NOT inside context
      expect(auditCall.context?.before).toBeUndefined();
      expect(auditCall.context?.after).toBeUndefined();
      expect(auditCall.context?.note).toBe("legit block");
    });
  });

  it("is idempotent: identical repeat PATCH → changed:false, single audit, no write", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const body = JSON.stringify({ reviewStatus: "reviewed", note: "checked twice" });

      // First call: effective
      mockPatchFullRow = {
        ...DEFAULT_FULL_ROW,
        reviewStatus: "reviewed",
        reviewedBy: "admin-1",
        reviewedAt: new Date(),
        reviewNote: "checked twice",
      };
      const res1 = await fetch(`${baseUrl}/api/admin/content-filter/logs/log-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body,
      });
      expect(((await res1.json()) as any).changed).toBe(true);
      expect(mockAudit).toHaveBeenCalledTimes(1);
      expect(updateCalls).toHaveLength(1);

      // Simulate the DB row now reflecting the first PATCH
      mockExisting = {
        id: "log-1",
        reviewStatus: "reviewed",
        missFlag: false,
        reviewNote: "checked twice",
      };

      // Second call: identical body → true no-op
      const res2 = await fetch(`${baseUrl}/api/admin/content-filter/logs/log-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body,
      });
      const body2 = (await res2.json()) as any;
      expect(body2.changed).toBe(false);
      expect(mockAudit).toHaveBeenCalledTimes(1); // no duplicate audit
      expect(updateCalls).toHaveLength(1);        // no second write
    });
  });

  it("missFlag toggle is an effective change with before/after reflecting the flip", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      mockPatchFullRow = {
        ...DEFAULT_FULL_ROW,
        missFlag: true,
        reviewedBy: "admin-1",
        reviewedAt: new Date(),
      };

      const res = await fetch(`${baseUrl}/api/admin/content-filter/logs/log-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ missFlag: true }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.changed).toBe(true);
      expect(body.row.missFlag).toBe(true);
      expect(updateCalls[0].payload.missFlag).toBe(true);
      expect(mockAudit).toHaveBeenCalledTimes(1);
      const auditCall = mockAudit.mock.calls[0][0];
      expect(auditCall.before).toEqual({ reviewStatus: "pending", missFlag: false });
      expect(auditCall.after).toEqual({ reviewStatus: "pending", missFlag: true });
    });
  });

  it("persists reviewNote and keeps prior note on status-only change", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      mockExisting = {
        id: "log-1",
        reviewStatus: "pending",
        missFlag: false,
        reviewNote: "prior rationale",
      };
      mockPatchFullRow = {
        ...DEFAULT_FULL_ROW,
        reviewStatus: "dismissed",
        reviewNote: "prior rationale", // unchanged — no new note supplied
        reviewedBy: "admin-1",
        reviewedAt: new Date(),
      };

      const res = await fetch(`${baseUrl}/api/admin/content-filter/logs/log-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ reviewStatus: "dismissed" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.changed).toBe(true);
      // status-only change must NOT wipe the prior note
      expect(updateCalls[0].payload.reviewNote).toBe("prior rationale");
      expect(body.row.reviewNote).toBe("prior rationale");
    });
  });
});

describe("GET /api/admin/content-filter/logs", () => {
  beforeEach(() => {
    mockExisting = null;
    mockPatchFullRow = null;
    mockGetRows = [];
    mockCount = 0;
    updateCalls = [];
    vi.clearAllMocks();
  });

  const row = (overrides: Record<string, unknown> = {}) => ({
    ...DEFAULT_FULL_ROW,
    ...overrides,
  });

  it("returns 401 without an admin session", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/admin/content-filter/logs`);
      expect(res.status).toBe(401);
    });
  });

  it("returns 403 for viewer role", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl, "viewer");
      const res = await fetch(`${baseUrl}/api/admin/content-filter/logs`, {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(403);
    });
  });

  it("filters by reviewStatus and returns reviewer displayName", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      mockGetRows = [
        row({ id: "log-1", reviewStatus: "reviewed", reviewedBy: "admin-2", reviewedByDisplayName: "Admin Two" }),
      ];
      mockCount = 1;

      const res = await fetch(`${baseUrl}/api/admin/content-filter/logs?reviewStatus=reviewed`, {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.total).toBe(1);
      expect(body.rows).toHaveLength(1);
      expect(body.rows[0].reviewStatus).toBe("reviewed");
      expect(body.rows[0].reviewedByDisplayName).toBe("Admin Two");

      // eq() was used for the reviewStatus condition (proxy objects are
      // recreated per access, so compare by column name, not identity)
      const eqCall = mockEq.mock.calls.find(
        ([col]: any[]) => col?.name === 'contentFilterLogs.reviewStatus'
      );
      expect(eqCall).toBeDefined();
      expect(eqCall![1]).toBe("reviewed");
      // A3: reviewer join used an aliased users table (vitest proxy equality
      // quirks on toHaveBeenCalledWith — assert by call index instead)
      expect(mockAlias).toHaveBeenCalledTimes(1);
      expect(mockAlias.mock.calls[0][1]).toBe("reviewer");
    });
  });

  it("filters by missFlag=true", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      mockGetRows = [row({ id: "log-2", missFlag: true })];
      mockCount = 1;

      const res = await fetch(`${baseUrl}/api/admin/content-filter/logs?missFlag=true`, {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.rows[0].missFlag).toBe(true);

      const eqCall = mockEq.mock.calls.find(
        ([col]: any[]) => col?.name === 'contentFilterLogs.missFlag'
      );
      expect(eqCall).toBeDefined();
      expect(eqCall![1]).toBe(true);
    });
  });

  it("returns 400 for an invalid missFlag query value", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const res = await fetch(`${baseUrl}/api/admin/content-filter/logs?missFlag=yes`, {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(400);
    });
  });

  it("returns 400 for an invalid reviewStatus query value", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const res = await fetch(`${baseUrl}/api/admin/content-filter/logs?reviewStatus=bogus`, {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(400);
    });
  });

  it("caps pageSize at 100", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      mockGetRows = Array.from({ length: 100 }, (_, i) => row({ id: `log-${i}` }));
      mockCount = 500;

      const res = await fetch(`${baseUrl}/api/admin/content-filter/logs?pageSize=200`, {
        headers: { Cookie: cookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.pageSize).toBe(100);
      expect(body.rows).toHaveLength(100);
    });
  });
});
