/**
 * RBAC Coverage Audit Test — `/api/admin/*`
 *
 * This audit scans the authoritative admin route definitions in:
 * - `apps/server/src/adminAuth.ts`
 * - `apps/server/src/routes.ts`
 * - `apps/server/src/routes/domains/payments.ts`
 *
 * and verifies that every declared `/api/admin/*` route has the expected RBAC
 * middleware attached.
 *
 * Rules enforced
 * ──────────────
 * 1. `POST /api/admin/login` is the ONLY expected public admin route.
 * 2. Every other `/api/admin/*` route MUST include `requireAdmin`.
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
 * - `GET  /api/admin/me`     — protected by `requireAdmin`; returns the
 *   caller's own profile and is therefore safe at `requireAdmin` level.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

interface RouteInfo {
  method: string;
  path: string;
  middlewareNames: string[];
  sourceFile: string;
}

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, '../../../..');
const ADMIN_ROUTE_FILES = [
  'apps/server/src/adminAuth.ts',
  'apps/server/src/routes/domains/adminMatchingShadow.ts',
  'apps/server/src/routes.ts',
  'apps/server/src/routes/domains/payments.ts',
] as const;

const SUPER_ADMIN_REQUIRED: Array<{ method: string; pathPattern: RegExp }> = [
  { method: 'GET', pathPattern: /^\/api\/admin\/accounts$/ },
  { method: 'POST', pathPattern: /^\/api\/admin\/accounts$/ },
  { method: 'PATCH', pathPattern: /^\/api\/admin\/accounts\/:id$/ },
  { method: 'POST', pathPattern: /^\/api\/admin\/accounts\/:id\/reset-password$/ },
];

function extractAdminRoutesFromSource(filePath: string): RouteInfo[] {
  const source = readFileSync(path.join(REPO_ROOT, filePath), 'utf8');
  const routes: RouteInfo[] = [];

  // This parser intentionally targets the concrete route declaration style
  // used in adminAuth.ts, routes.ts, and domain modules today:
  //   app.get('/api/admin/...', middlewareA, middlewareB, async (req, res) => {})
  // It will not detect future `app.use('/api/admin', router)` mounts or
  // substantially different multiline/template-literal registration styles.
  const routePattern = /^\s*app\.(get|post|patch|put|delete)\(\s*(["'])((?:\\.|(?!\2).)+)\2\s*,\s*(.*?)(?:,\s*)?(?:async\s*)?\(/gm;

  for (const match of source.matchAll(routePattern)) {
    const method = match[1]?.toUpperCase();
    const routePath = match[3];
    const middlewareSegment = (match[4] ?? '').trim();

    if (!method || !routePath?.startsWith('/api/admin')) {
      continue;
    }

    const middlewareNames = middlewareSegment.length
      ? middlewareSegment
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [];

    routes.push({
      method,
      path: routePath,
      middlewareNames,
      sourceFile: filePath,
    });
  }

  return routes;
}

describe('Admin RBAC coverage audit', () => {
  let adminRoutes: RouteInfo[];

  beforeAll(() => {
    adminRoutes = ADMIN_ROUTE_FILES.flatMap(extractAdminRoutesFromSource);
    expect(adminRoutes.length).toBeGreaterThan(80);
    expect(adminRoutes.some((route) => route.sourceFile.endsWith('adminAuth.ts'))).toBe(true);
    expect(adminRoutes.some((route) => route.sourceFile.endsWith('adminMatchingShadow.ts'))).toBe(true);
    expect(adminRoutes.some((route) => route.sourceFile.endsWith('routes.ts'))).toBe(true);
    expect(adminRoutes.some((route) => route.sourceFile.endsWith('payments.ts'))).toBe(true);
  });

  it('discovers admin routes from adminAuth.ts, routes.ts, and extracted domain files', () => {
    const summaryByFile = adminRoutes.reduce<Record<string, number>>((acc, route) => {
      acc[route.sourceFile] = (acc[route.sourceFile] ?? 0) + 1;
      return acc;
    }, {});

    expect(summaryByFile['apps/server/src/adminAuth.ts'] ?? 0).toBeGreaterThan(0);
    expect(summaryByFile['apps/server/src/routes/domains/adminMatchingShadow.ts'] ?? 0).toBeGreaterThan(0);
    expect(summaryByFile['apps/server/src/routes.ts'] ?? 0).toBeGreaterThan(75);
    expect(summaryByFile['apps/server/src/routes/domains/payments.ts'] ?? 0).toBeGreaterThan(0);
  });

  it('every /api/admin/* route other than POST /api/admin/login includes requireAdmin', () => {
    const unprotected = adminRoutes.filter((route) => {
      if (route.method === 'POST' && route.path === '/api/admin/login') {
        return false;
      }

      return !route.middlewareNames.includes('requireAdmin');
    });

    expect(
      unprotected,
      `Unprotected admin routes found:\n${unprotected
        .map((route) => `${route.method} ${route.path} [${route.middlewareNames.join(', ')}] in ${route.sourceFile}`)
        .join('\n')}`,
    ).toHaveLength(0);
  });

  it('POST /api/admin/login remains the only public admin route', () => {
    const publicRoutes = adminRoutes.filter(
      (route) => !route.middlewareNames.includes('requireAdmin'),
    );

    expect(publicRoutes).toEqual([
      {
        method: 'POST',
        path: '/api/admin/login',
        middlewareNames: [],
        sourceFile: 'apps/server/src/adminAuth.ts',
      },
    ]);
  });

  it('account-management routes include requireSuperAdmin', () => {
    const missing = adminRoutes.filter((route) =>
      SUPER_ADMIN_REQUIRED.some(
        ({ method, pathPattern }) =>
          route.method === method && pathPattern.test(route.path) && !route.middlewareNames.includes('requireSuperAdmin'),
      ),
    );

    expect(
      missing,
      `Super-admin-only routes missing requireSuperAdmin:\n${missing
        .map((route) => `${route.method} ${route.path} [${route.middlewareNames.join(', ')}] in ${route.sourceFile}`)
        .join('\n')}`,
    ).toHaveLength(0);
  });

  it('prints an admin route snapshot for CI visibility', () => {
    const summary = adminRoutes
      .map(
        (route) =>
          `${route.method.padEnd(6)} ${route.path.padEnd(72)} [${route.middlewareNames.join(', ')}] (${route.sourceFile})`,
      )
      .join('\n');

    console.info(`\n=== Admin Route RBAC Snapshot ===\n${summary}\n`);
    expect(adminRoutes.length).toBeGreaterThan(80);
  });
});
