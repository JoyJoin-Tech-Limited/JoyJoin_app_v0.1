/**
 * Security finding N1 — `/api/test/**` anonymous-exposure regression lock.
 *
 * Background (2026-09-16)
 * ──────────────────────
 * `apps/server/src/routes/domains/testAdmin.ts` imported `requireAdmin` but never
 * applied it; `routes.ts` registered the test routers unconditionally, so every
 * `/api/test/admin/*` route (create user / create pool / register / reset) was an
 * anonymous, unauthenticated mutation surface in staging and production. The
 * existing `adminRbacCoverage.test.ts` scoped itself to `path.startsWith('/api/admin')`
 * and therefore never saw `/api/test/admin/*`.
 *
 * This test is the regression lock. It has two halves:
 *
 * 1. BEHAVIOURAL — boots the real routers and enumerates the app's registered
 *    routes from Express internals. Every `/api/test/**` route is hit anonymously
 *    and must return 401/403. This auto-covers any route added to these routers,
 *    because the route list is read from the live app rather than hand-maintained.
 *
 * 2. STRUCTURAL — scans every `routes/domains/*.ts` file for `/api/test/**` route
 *    declarations and fails if any lacks an auth token in its declaration or
 *    handler body. This closes the "brand new router file" gap that a mount-list
 *    behavioural test alone cannot see.
 *
 * Run:
 *   npm test -w @joyjoin/server -- src/__tests__/testAdminAuth.test.ts
 */

import express from "express";
import session from "express-session";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withServerForApp } from "../test-utils/withServer";

// ── Mocks (hoisted; assign real vi.fn() per test in beforeEach) ─────────────

const h = vi.hoisted(() => ({
  audit: null as any,
  createTestUser: null as any,
  createTestEventPool: null as any,
  registerTestUserToPool: null as any,
  resetTestData: null as any,
  getTestStatus: null as any,
  getSessionByIcebreakerSessionId: null as any,
  updateSession: null as any,
  listParticipants: null as any,
  dbDeleteWhere: null as any,
  getAdminAccountById: null as any,
  startSingleTestSession: null as any,
  cleanupSingleTestData: null as any,
  ensureMatchingTestPool: null as any,
  seedMatchingTestBots: null as any,
  finalizeMatchingTestGroups: null as any,
  cleanupMatchingTestData: null as any,
  matchEventPool: null as any,
  saveMatchResults: null as any,
  generateSpeedFriendingPairs: null as any,
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock("../lib/adminAuditLogger", () => ({
  logAdminAudit: (...args: unknown[]) => h.audit(...args),
}));

vi.mock("../db", () => ({
  db: {
    delete: () => ({
      where: (...args: unknown[]) => h.dbDeleteWhere(...args),
    }),
  },
}));

vi.mock("../storage", () => ({
  storage: {
    getAdminAccountById: (...args: unknown[]) => h.getAdminAccountById(...args),
    getUser: vi.fn(),
  },
}));

vi.mock("../services/testAdminService", () => ({
  createTestUser: (...args: unknown[]) => h.createTestUser(...args),
  createTestEventPool: (...args: unknown[]) => h.createTestEventPool(...args),
  registerTestUserToPool: (...args: unknown[]) => h.registerTestUserToPool(...args),
  resetTestData: (...args: unknown[]) => h.resetTestData(...args),
  getTestStatus: (...args: unknown[]) => h.getTestStatus(...args),
}));

vi.mock("../lib/socialIcebreakerStore", () => ({
  getSessionByIcebreakerSessionId: (...args: unknown[]) => h.getSessionByIcebreakerSessionId(...args),
  updateSession: (...args: unknown[]) => h.updateSession(...args),
  listParticipants: (...args: unknown[]) => h.listParticipants(...args),
}));

vi.mock("../routes/socialIcebreakerHelpers", () => ({
  generateSpeedFriendingPairs: (...args: unknown[]) => h.generateSpeedFriendingPairs(...args),
}));

vi.mock("../lib/isSingleTestMode", () => ({
  isSingleTestMode: () => true,
  isMatchingTestMode: () => true,
}));

vi.mock("../services/singleTestService", () => ({
  startSingleTestSession: (...args: unknown[]) => h.startSingleTestSession(...args),
  cleanupSingleTestData: (...args: unknown[]) => h.cleanupSingleTestData(...args),
}));

vi.mock("../services/matchingTestService", () => ({
  ensureMatchingTestPool: (...args: unknown[]) => h.ensureMatchingTestPool(...args),
  seedMatchingTestBots: (...args: unknown[]) => h.seedMatchingTestBots(...args),
  finalizeMatchingTestGroups: (...args: unknown[]) => h.finalizeMatchingTestGroups(...args),
  cleanupMatchingTestData: (...args: unknown[]) => h.cleanupMatchingTestData(...args),
}));

vi.mock("../poolMatchingService", () => ({
  matchEventPool: (...args: unknown[]) => h.matchEventPool(...args),
  saveMatchResults: (...args: unknown[]) => h.saveMatchResults(...args),
}));

const { registerTestAdminRoutes } = await import("../routes/domains/testAdmin");
const { registerSingleTestRoutes } = await import("../routes/domains/singleTest");
const { registerMatchingTestRoutes } = await import("../routes/domains/matchingTest");

// ── Helpers ─────────────────────────────────────────────────────────────────

interface RouteEntry {
  method: string;
  path: string;
}

/** Enumerate routes actually registered on an Express app (Express 4 internals). */
function listRegisteredRoutes(app: express.Express): RouteEntry[] {
  const stack: any[] = (app as any)._router?.stack ?? (app as any).router?.stack ?? [];
  const routes: RouteEntry[] = [];
  for (const layer of stack) {
    if (!layer?.route) continue;
    for (const [method, enabled] of Object.entries(layer.route.methods ?? {})) {
      if (enabled) routes.push({ method: String(method).toUpperCase(), path: String(layer.route.path) });
    }
  }
  return routes;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));

  // Test-only session seeding endpoints (never registered in production).
  app.post("/__test__/admin-login", (req, res) => {
    req.session.adminAccountId = "admin-1";
    req.session.save(() => res.json({ ok: true }));
  });
  app.post("/__test__/user-login", (req, res) => {
    req.session.userId = "user-1";
    req.session.save(() => res.json({ ok: true }));
  });

  registerTestAdminRoutes(app);
  registerSingleTestRoutes(app);
  registerMatchingTestRoutes(app);
  return app;
}

function cookieHeader(response: Response): string {
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

function testRoutes(app: express.Express): RouteEntry[] {
  return listRegisteredRoutes(app).filter((route) => route.path.startsWith("/api/test"));
}

function toRequestPath(routePath: string): string {
  return routePath.replace(/:[^/]+/g, "dummy");
}

const originalNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
  h.audit = vi.fn();
  h.createTestUser = vi.fn(async () => ({ id: "user-new", phoneNumber: "+8613800009999", displayName: "T" }));
  h.createTestEventPool = vi.fn(async () => ({ id: "pool-new", title: "T", city: "深圳", status: "active" }));
  h.registerTestUserToPool = vi.fn(async () => ({ id: "reg-new" }));
  h.resetTestData = vi.fn(async () => ({ deletedUsers: 2, deletedPools: 1 }));
  h.getTestStatus = vi.fn(async () => ({ mode: "test", userCount: 3, poolCount: 1 }));
  h.getSessionByIcebreakerSessionId = vi.fn(async () => ({
    socialSessionId: "social-1",
    expired: false,
    state: { currentPhase: "warmup" },
  }));
  h.updateSession = vi.fn(async () => undefined);
  h.listParticipants = vi.fn(async () => []);
  h.dbDeleteWhere = vi.fn(async () => undefined);
  h.getAdminAccountById = vi.fn(async (id: string) => ({
    id,
    username: "admin",
    status: "active",
    role: "super_admin",
  }));
  h.startSingleTestSession = vi.fn(async () => ({ socialSessionId: "s", groupId: "g", bots: [] }));
  h.cleanupSingleTestData = vi.fn(async () => ({}));
  h.ensureMatchingTestPool = vi.fn(async () => "pool-test");
  h.seedMatchingTestBots = vi.fn(async () => ({ botUsers: [] }));
  h.finalizeMatchingTestGroups = vi.fn(async () => ({}));
  h.cleanupMatchingTestData = vi.fn(async () => ({}));
  h.matchEventPool = vi.fn(async () => []);
  h.saveMatchResults = vi.fn(async () => undefined);
  h.generateSpeedFriendingPairs = vi.fn(() => []);
});

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

// ── 1. Behavioural: anonymous denial over the live route table ──────────────

describe("N1 — every /api/test/** route denies anonymous callers", () => {
  it("enumerates the expected test-route family", () => {
    const routes = testRoutes(createApp()).map((route) => `${route.method} ${route.path}`);
    // Guard against the introspection silently seeing nothing.
    expect(routes.length).toBeGreaterThanOrEqual(12);
    expect(routes).toContain("GET /api/test/admin/status");
    expect(routes).toContain("POST /api/test/admin/users");
    expect(routes).toContain("POST /api/test/admin/event-pools");
    expect(routes).toContain("POST /api/test/admin/registrations");
    expect(routes).toContain("POST /api/test/admin/reset");
    expect(routes).toContain("POST /api/test/social-icebreaker/:icebreakerSessionId/force-phase");
    expect(routes).toContain("POST /api/test/social-icebreaker/:icebreakerSessionId/cleanup");
    expect(routes).toContain("POST /api/test/single-test/start");
    expect(routes).toContain("POST /api/test/single-test/reset");
    expect(routes).toContain("POST /api/test/matching-test/start");
    expect(routes).toContain("POST /api/test/matching-test/:poolId/match");
    expect(routes).toContain("POST /api/test/matching-test/cleanup");
  });

  it("returns 401/403 for every route when called with no session", async () => {
    const app = createApp();
    const routes = testRoutes(app);

    await withServerForApp(app, async (_baseUrl, request) => {
      for (const route of routes) {
        const response = await request(toRequestPath(route.path), {
          method: route.method,
          headers: { "content-type": "application/json" },
          body: route.method === "GET" ? undefined : JSON.stringify({}),
        });

        expect(
          [401, 403],
          `Anonymous ${route.method} ${route.path} returned ${response.status} — must be 401/403`,
        ).toContain(response.status);
      }
    });

    // Fail-closed means the services are never reached.
    expect(h.createTestUser).not.toHaveBeenCalled();
    expect(h.createTestEventPool).not.toHaveBeenCalled();
    expect(h.registerTestUserToPool).not.toHaveBeenCalled();
    expect(h.resetTestData).not.toHaveBeenCalled();
    expect(h.updateSession).not.toHaveBeenCalled();
    expect(h.dbDeleteWhere).not.toHaveBeenCalled();
    expect(h.startSingleTestSession).not.toHaveBeenCalled();
    expect(h.cleanupSingleTestData).not.toHaveBeenCalled();
    expect(h.seedMatchingTestBots).not.toHaveBeenCalled();
    expect(h.cleanupMatchingTestData).not.toHaveBeenCalled();
    expect(h.matchEventPool).not.toHaveBeenCalled();
    expect(h.audit).not.toHaveBeenCalled();
  });

  it("still rejects an authenticated NON-admin user on /api/test/admin/** (403)", async () => {
    const app = createApp();
    await withServerForApp(app, async (baseUrl, request) => {
      const login = await fetch(`${baseUrl}/__test__/user-login`, { method: "POST" });
      const cookie = cookieHeader(login);
      expect(cookie).not.toBe("");

      const response = await request("/api/test/admin/status", { headers: { cookie } });
      expect(response.status).toBe(403);
    });

    expect(h.getTestStatus).not.toHaveBeenCalled();
  });
});

// ── 2. Behavioural: production gate + authorized happy path ─────────────────

describe("N1 — production gate and legitimate admin access", () => {
  it("keeps the production 403 on the social-icebreaker test routes even for an authenticated admin", async () => {
    process.env.NODE_ENV = "production";

    const app = createApp();
    await withServerForApp(app, async (baseUrl, request) => {
      const login = await fetch(`${baseUrl}/__test__/admin-login`, { method: "POST" });
      const cookie = cookieHeader(login);
      expect(cookie).not.toBe("");

      const forcePhase = await request("/api/test/social-icebreaker/social-1/force-phase", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ phase: "recap" }),
      });
      expect(forcePhase.status).toBe(403);

      const cleanup = await request("/api/test/social-icebreaker/social-1/cleanup", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(cleanup.status).toBe(403);
    });

    expect(h.updateSession).not.toHaveBeenCalled();
    expect(h.dbDeleteWhere).not.toHaveBeenCalled();
  });

  it("still denies ANONYMOUS callers in production (fail-closed before the env guard)", async () => {
    process.env.NODE_ENV = "production";

    const app = createApp();
    await withServerForApp(app, async (_baseUrl, request) => {
      const response = await request("/api/test/social-icebreaker/social-1/force-phase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phase: "recap" }),
      });
      expect(response.status).toBe(401);
    });
  });

  it("permits a super_admin and emits one audit row per sensitive mutation", async () => {
    const app = createApp();
    await withServerForApp(app, async (baseUrl, request) => {
      const login = await fetch(`${baseUrl}/__test__/admin-login`, { method: "POST" });
      const cookie = cookieHeader(login);

      const createUser = await request("/api/test/admin/users", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ phoneNumber: "+8613800009999", password: "super-secret-pw", displayName: "T" }),
      });
      expect(createUser.status).toBe(201);

      const createPool = await request("/api/test/admin/event-pools", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ title: "T" }),
      });
      expect(createPool.status).toBe(201);

      const forcePhase = await request("/api/test/social-icebreaker/social-1/force-phase", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ phase: "recap" }),
      });
      expect(forcePhase.status).toBe(200);

      const cleanup = await request("/api/test/social-icebreaker/social-1/cleanup", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(cleanup.status).toBe(200);
    });

    const actions = h.audit.mock.calls.map((call: any[]) => call[0].action);
    expect(actions).toContain("TEST_USER_CREATED");
    expect(actions).toContain("TEST_EVENT_POOL_CREATED");
    expect(actions).toContain("TEST_ICEBREAKER_FORCE_PHASE");
    expect(actions).toContain("TEST_ICEBREAKER_CLEANED");

    // No audit row may carry the request password.
    const serialized = JSON.stringify(h.audit.mock.calls);
    expect(serialized).not.toContain("super-secret-pw");
  });

  it("documents the deliberate policy: super_admin /api/test/admin/* remains available in production (OQ-1)", async () => {
    process.env.NODE_ENV = "production";

    const app = createApp();
    await withServerForApp(app, async (baseUrl, request) => {
      const login = await fetch(`${baseUrl}/__test__/admin-login`, { method: "POST" });
      const cookie = cookieHeader(login);

      const response = await request("/api/test/admin/status", { headers: { cookie } });
      expect(response.status).toBe(200);
    });
  });
});

// ── 3. Structural: source scan across the whole test-route family ───────────

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");
const DOMAINS_DIR = path.join(REPO_ROOT, "apps/server/src/routes/domains");

// Same declaration style parser used by adminRbacCoverage.test.ts, but scoped to
// /api/test and aware of inline auth (requireAuthenticatedUserId) in the body.
const routeDeclarationPattern =
  /^\s*app\.(get|post|patch|put|delete)\(\s*(["'])((?:\\.|(?!\2).)+)\2\s*,\s*(.*?)(?:,\s*)?(?:async\s*)?\(/gm;

const AUTH_TOKEN_PATTERN = /requireAdmin|requireSuperAdmin|requireAuth\b|requireAuthenticatedUserId/;

interface TestRouteDeclaration {
  method: string;
  routePath: string;
  middlewareNames: string[];
  body: string;
  sourceFile: string;
}

function scanTestRouteDeclarations(filePath: string): TestRouteDeclaration[] {
  const source = readFileSync(filePath, "utf8");
  const matches = [...source.matchAll(routeDeclarationPattern)];
  const declarations: TestRouteDeclaration[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const routePath = match[3] ?? "";
    if (!routePath.startsWith("/api/test")) continue;

    const segmentEnd = matches[index + 1]?.index ?? source.length;
    declarations.push({
      method: (match[1] ?? "").toUpperCase(),
      routePath,
      middlewareNames: (match[4] ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
      body: source.slice(match.index ?? 0, segmentEnd),
      sourceFile: path.relative(REPO_ROOT, filePath),
    });
  }

  return declarations;
}

describe("N1 structural — every /api/test/** declaration carries auth", () => {
  const domainFiles = readdirSync(DOMAINS_DIR)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => path.join(DOMAINS_DIR, name))
    .filter((filePath) => existsSync(filePath));

  const declarations = domainFiles.flatMap(scanTestRouteDeclarations);

  it("discovers the full /api/test route family from source (auto-covers new files)", () => {
    // If this drops, a route regex/move regressed — do not delete the guard.
    expect(declarations.length).toBeGreaterThanOrEqual(12);
    const files = new Set(declarations.map((declaration) => declaration.sourceFile));
    expect([...files]).toEqual(
      expect.arrayContaining([
        "apps/server/src/routes/domains/testAdmin.ts",
        "apps/server/src/routes/domains/singleTest.ts",
        "apps/server/src/routes/domains/matchingTest.ts",
      ]),
    );
  });

  it("every /api/test/admin/** route carries requireAdmin AND requireSuperAdmin", () => {
    const adminDeclarations = declarations.filter((declaration) =>
      declaration.routePath.startsWith("/api/test/admin"),
    );
    expect(adminDeclarations.length).toBeGreaterThanOrEqual(5);

    const offenders = adminDeclarations.filter(
      (declaration) =>
        !declaration.middlewareNames.includes("requireAdmin") ||
        !declaration.middlewareNames.includes("requireSuperAdmin"),
    );

    expect(
      offenders,
      `Test-admin routes missing requireAdmin/requireSuperAdmin:\n${offenders
        .map((d) => `${d.method} ${d.routePath} [${d.middlewareNames.join(", ")}] in ${d.sourceFile}`)
        .join("\n")}`,
    ).toHaveLength(0);
  });

  it("every other /api/test/** route carries an auth token (middleware or inline)", () => {
    const nonAdminDeclarations = declarations.filter(
      (declaration) => !declaration.routePath.startsWith("/api/test/admin"),
    );
    expect(nonAdminDeclarations.length).toBeGreaterThanOrEqual(7);

    const offenders = nonAdminDeclarations.filter((declaration) => {
      const hasMiddlewareAuth = declaration.middlewareNames.some((name) => AUTH_TOKEN_PATTERN.test(name));
      const hasInlineAuth = AUTH_TOKEN_PATTERN.test(declaration.body);
      return !hasMiddlewareAuth && !hasInlineAuth;
    });

    expect(
      offenders,
      `Unauthenticated /api/test routes found:\n${offenders
        .map((d) => `${d.method} ${d.routePath} in ${d.sourceFile}`)
        .join("\n")}`,
    ).toHaveLength(0);
  });
});
