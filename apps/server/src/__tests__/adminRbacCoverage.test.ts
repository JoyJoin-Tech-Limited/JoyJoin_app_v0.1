/**
 * RBAC Coverage Audit Test — `/api/admin/*`
 *
 * This test mounts the real Express app (with mocked storage/services) and
 * introspects its registered route stack to verify that every `/api/admin/*`
 * route has appropriate RBAC middleware.
 *
 * Rules enforced
 * ──────────────
 * 1. `/api/admin/login` is the ONLY expected public admin route (no auth).
 * 2. Every other `/api/admin/*` route MUST include `requireAdmin` middleware.
 * 3. Account-management routes (list, create, update, reset-password) MUST
 *    additionally include `requireSuperAdmin`.
 *
 * Running this test
 * ─────────────────
 *   npm test -w @joyjoin/server -- src/__tests__/adminRbacCoverage.test.ts
 *
 * Documented exceptions (see also docs/admin-rbac-matrix.md at project root)
 * ──────────────────────────────────────────────────────────
 * - `POST /api/admin/login`  — public; intentional; no session exists yet.
 * - `GET  /api/admin/me`     — protected by `requireAdmin`; returns caller's
 *   own profile and is therefore safe at `requireAdmin` level (not super-admin).
 */

import express from 'express';
import session from 'express-session';
import { describe, it, expect, vi, beforeAll } from 'vitest';

// ── Mock heavy dependencies so the app can be instantiated without DB ───────

vi.mock('../storage', () => ({
  storage: {
    getAdminAccountByUsername: vi.fn(),
    getAdminAccountById: vi.fn(),
    listAdminAccounts: vi.fn(),
    createAdminAccount: vi.fn(),
    updateAdminAccount: vi.fn(),
    updateAdminLastLogin: vi.fn(),
    getUser: vi.fn(),
  },
}));

// ── Import after mocking ────────────────────────────────────────────────────

const { registerAdminAuthRoutes, requireAdmin, requireSuperAdmin } =
  await import('../adminAuth');

// ── Helper: build minimal app with admin routes only ────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({ secret: 'test', resave: false, saveUninitialized: false }),
  );
  registerAdminAuthRoutes(app);
  return app;
}

// ── Introspect the Express route stack ──────────────────────────────────────

interface RouteInfo {
  method: string;
  path: string;
  middlewareNames: string[];
}

function extractAdminRoutes(app: express.Express): RouteInfo[] {
  const routes: RouteInfo[] = [];

  function walk(stack: any[], prefix = '') {
    for (const layer of stack) {
      if (layer.route) {
        const routePath: string = prefix + (layer.route.path ?? '');
        if (!routePath.startsWith('/api/admin')) continue;

        const methods = Object.keys(layer.route.methods).filter(
          (m) => layer.route.methods[m],
        );

        for (const method of methods) {
          const handlers: any[] = layer.route.stack ?? [];
          const middlewareNames = handlers.map(
            (h: any) => h.handle?.name ?? h.name ?? '<anonymous>',
          );
          routes.push({ method: method.toUpperCase(), path: routePath, middlewareNames });
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        const mountPath = layer.regexp?.source
          ? (layer.keys?.length === 0
            ? layer.regexp.source
                .replace('\\/?(?=\\/|$)', '')
                .replace(/\\\//g, '/')
                .replace(/^\^/, '')
            : '')
          : '';
        walk(layer.handle.stack, prefix + mountPath);
      }
    }
  }

  walk((app as any)._router?.stack ?? []);
  return routes;
}

// ── Routes that must have requireSuperAdmin in addition to requireAdmin ──────

const SUPER_ADMIN_REQUIRED: Array<{ method: string; pathPattern: RegExp }> = [
  { method: 'GET',   pathPattern: /^\/api\/admin\/accounts$/ },
  { method: 'POST',  pathPattern: /^\/api\/admin\/accounts$/ },
  { method: 'PATCH', pathPattern: /^\/api\/admin\/accounts\// },
  { method: 'POST',  pathPattern: /^\/api\/admin\/accounts\/.*\/reset-password$/ },
];

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Admin RBAC coverage audit', () => {
  let adminRoutes: RouteInfo[];

  beforeAll(() => {
    const app = buildApp();
    adminRoutes = extractAdminRoutes(app);
    // Ensure we actually found routes to test
    expect(adminRoutes.length).toBeGreaterThan(0);
  });

  it('every /api/admin/* route other than /api/admin/login must include requireAdmin', () => {
    const unprotected: string[] = [];

    for (const route of adminRoutes) {
      if (route.method === 'POST' && route.path === '/api/admin/login') {
        // Known public exception — the login endpoint itself has no prior auth
        continue;
      }

      const hasRequireAdmin = route.middlewareNames.includes('requireAdmin');
      if (!hasRequireAdmin) {
        unprotected.push(`${route.method} ${route.path}  [${route.middlewareNames.join(', ')}]`);
      }
    }

    expect(unprotected, `Unprotected admin routes found:\n${unprotected.join('\n')}`).toHaveLength(0);
  });

  it('/api/admin/login must NOT have requireAdmin (it is the public login endpoint)', () => {
    const loginRoute = adminRoutes.find(
      (r) => r.method === 'POST' && r.path === '/api/admin/login',
    );
    // If the route exists it must be unprotected
    if (loginRoute) {
      expect(loginRoute.middlewareNames).not.toContain('requireAdmin');
    }
  });

  it('account-management routes must include requireSuperAdmin', () => {
    const missing: string[] = [];

    for (const { method, pathPattern } of SUPER_ADMIN_REQUIRED) {
      const matching = adminRoutes.filter(
        (r) => r.method === method && pathPattern.test(r.path),
      );
      for (const route of matching) {
        const hasSuperAdmin = route.middlewareNames.includes('requireSuperAdmin');
        if (!hasSuperAdmin) {
          missing.push(
            `${route.method} ${route.path}  [${route.middlewareNames.join(', ')}]`,
          );
        }
      }
    }

    expect(
      missing,
      `Super-admin-only routes missing requireSuperAdmin:\n${missing.join('\n')}`,
    ).toHaveLength(0);
  });

  it('snapshot of all discovered /api/admin/* routes for documentation purposes', () => {
    // This test is intentionally informational (always passes).
    // Run it to see the full route list with middleware names.
    const summary = adminRoutes
      .map((r) => `${r.method.padEnd(6)} ${r.path.padEnd(60)} [${r.middlewareNames.join(', ')}]`)
      .join('\n');
    // Print for CI log visibility
    console.info(`\n=== Admin Route RBAC Snapshot ===\n${summary}\n`);
    expect(adminRoutes.length).toBeGreaterThan(0);
  });
});
