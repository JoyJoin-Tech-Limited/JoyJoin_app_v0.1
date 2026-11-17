#!/usr/bin/env node
/**
 * JoyJoin Synthetic Happy-Path Probe
 * 合成监控探针 — 关键路径验证
 *
 * Exercises the most critical API paths to verify the server is healthy and
 * functional from an end-user perspective.  Run this script from a location
 * OUTSIDE the application process (e.g. a separate cron job, a GitHub Actions
 * scheduled workflow, or a cloud synthetic monitor).
 *
 * Probed flow:
 *   1. Health check   GET /api/health            → expect 200, status "ok"
 *   2. Metrics check  GET /api/metrics            → expect 200, Prometheus text
 *   3. Auth attempt   GET /api/auth/user          → expect 401 (no session cookie)
 *      (A 401 confirms the auth middleware is reachable and responding.)
 *   4. Admin shell    GET <ADMIN_BASE_URL>/        → expect 200, mount node + hashed
 *      bundle present, and NO third-party stylesheet (skipped when ADMIN_BASE_URL unset)
 *
 * Exit codes:
 *   0 → all probes passed
 *   1 → one or more probes failed
 *
 * Environment variables:
 *   BASE_URL          Server base URL (default: http://localhost:5001)
 *   ADMIN_BASE_URL    Admin portal origin (e.g. https://admin.joyjoinapp.com).
 *                     Unset = skip the portal-shell probe.
 *   PROBE_TIMEOUT_MS  Per-request timeout in ms (default: 5000)
 *   PUSHGATEWAY_URL   Optional Prometheus Pushgateway URL to push probe result
 *
 * Cron example (every 5 minutes):
 *   *\/5 * * * *  node /path/to/scripts/synthetic/happy-path-probe.mjs >> /var/log/joyjoin-probe.log 2>&1
 *
 * GitHub Actions example (see .github/workflows/synthetic-probe.yml):
 *   Uses the workflow_dispatch + schedule triggers.
 */

// @ts-check

import { findRenderBlockingExternals } from '../check/check-render-blocking-externals.mjs';

const DEFAULT_BASE_URL = 'http://localhost:5001';
const BASE_URL = normalizeBaseUrl(process.env.BASE_URL, DEFAULT_BASE_URL);
/**
 * Admin portal origin (the HTML shell, not the API). Empty = skip the portal probe,
 * which is what local runs want.
 *
 * Why this exists (2026-11-17): the probe used to check ONLY /api/*. The API stayed
 * green through a ~14-hour admin-portal white screen, because nothing ever asserted
 * that the SPA shell was still bootable.
 */
const ADMIN_BASE_URL = normalizeBaseUrl(process.env.ADMIN_BASE_URL, '');
const PROBE_TIMEOUT_MS = parseInt(process.env.PROBE_TIMEOUT_MS ?? '5000', 10);
const PUSHGATEWAY_URL = process.env.PUSHGATEWAY_URL ?? '';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @param {string | undefined} rawBaseUrl
 * @param {string} fallback
 */
function normalizeBaseUrl(rawBaseUrl, fallback) {
  const trimmed = rawBaseUrl?.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/\/+$/, '');
}

/**
 * @param {string} url
 * @param {{ expectedStatus?: number; expectedBodyContains?: string | string[]; forbiddenBodyContains?: string | string[]; validate?: (body: string) => string | null; method?: string }} opts
 * @returns {Promise<{ ok: boolean; status: number; ms: number; error?: string }>}
 */
async function probe(
  url,
  {
    expectedStatus = 200,
    expectedBodyContains,
    forbiddenBodyContains,
    validate,
    method = 'GET',
  } = {},
) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    const res = await fetch(url, { method, signal: controller.signal });
    clearTimeout(timer);

    const body = await res.text();
    const ms = Date.now() - start;

    if (res.status !== expectedStatus) {
      return {
        ok: false,
        status: res.status,
        ms,
        error: `Expected HTTP ${expectedStatus}, got ${res.status}`,
      };
    }

    for (const needle of toNeedleList(expectedBodyContains)) {
      if (!body.includes(needle)) {
        return {
          ok: false,
          status: res.status,
          ms,
          error: `Response body does not contain "${needle}"`,
        };
      }
    }

    for (const needle of toNeedleList(forbiddenBodyContains)) {
      if (body.includes(needle)) {
        return {
          ok: false,
          status: res.status,
          ms,
          error: `Response body contains forbidden marker "${needle}"`,
        };
      }
    }

    if (validate) {
      const failure = validate(body);
      if (failure) {
        return { ok: false, status: res.status, ms, error: failure };
      }
    }

    return { ok: true, status: res.status, ms };
  } catch (/** @type {any} */ err) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - start,
      error: err?.name === 'AbortError' ? `Timeout after ${PROBE_TIMEOUT_MS}ms` : String(err),
    };
  }
}

/**
 * Normalises a single marker or a list of markers to an array.
 * @param {string | string[] | undefined} value
 * @returns {string[]}
 */
function toNeedleList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Push probe result to Prometheus Pushgateway (fire-and-forget).
 * @param {number} success 1 = all passed, 0 = at least one failed
 */
async function pushResult(success) {
  if (!PUSHGATEWAY_URL) return;
  const body = [
    '# HELP joyjoin_synthetic_probe_success Whether the JoyJoin synthetic probe succeeded (1 = ok, 0 = failed)',
    '# TYPE joyjoin_synthetic_probe_success gauge',
    `joyjoin_synthetic_probe_success ${success}`,
    '',
  ].join('\n');

  try {
    await fetch(`${PUSHGATEWAY_URL}/metrics/job/joyjoin_synthetic_probe`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body,
    });
  } catch (err) {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'warn', message: 'Failed to push to Pushgateway', error: String(err) }));
  }
}

// ---------------------------------------------------------------------------
// Probe definitions
// ---------------------------------------------------------------------------

const PROBES = [
  {
    name: 'health_check',
    url: `${BASE_URL}/api/health`,
    opts: { expectedStatus: 200, expectedBodyContains: '"status":"ok"' },
  },
  {
    name: 'metrics_endpoint',
    url: `${BASE_URL}/api/metrics`,
    opts: { expectedStatus: 200, expectedBodyContains: 'http_requests_total' },
  },
  {
    name: 'auth_middleware_reachable',
    url: `${BASE_URL}/api/auth/user`,
    // Expect 401 — the endpoint is reachable and auth is enforced
    opts: { expectedStatus: 401 },
  },
  ...(ADMIN_BASE_URL
    ? [
        {
          name: 'admin_portal_shell',
          url: `${ADMIN_BASE_URL}/`,
          opts: {
            expectedStatus: 200,
            // A built SPA shell must expose the mount node and reference its hashed bundle.
            expectedBodyContains: ['id="root"', '/assets/'],
            // The 2026-11-17 regression: a third-party stylesheet that cannot be reached
            // from mainland China gated first paint and left #root empty for 30s+.
            // Shares its parser with the CI gate so the two can never disagree.
            validate: (body) => {
              const [hit] = findRenderBlockingExternals(body);
              return hit ? `render-blocking external resource: ${hit.message}` : null;
            },
          },
        },
      ]
    : []),
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  const ts = new Date().toISOString();
  let allPassed = true;

  /** @type {Array<Record<string, unknown>>} */
  const results = [];

  for (const p of PROBES) {
    const result = await probe(p.url, p.opts);
    const entry = {
      timestamp: ts,
      probe: p.name,
      url: p.url,
      ok: result.ok,
      status: result.status,
      ms: result.ms,
      ...(result.error ? { error: result.error } : {}),
    };
    results.push(entry);
    if (!result.ok) allPassed = false;
  }

  // Emit one structured log line per probe
  for (const r of results) {
    const level = r.ok ? 'info' : 'error';
    process[level === 'info' ? 'stdout' : 'stderr'].write(
      JSON.stringify({ level, service: 'synthetic-probe', ...r }) + '\n',
    );
  }

  const summary = {
    timestamp: ts,
    service: 'synthetic-probe',
    level: allPassed ? 'info' : 'error',
    message: allPassed ? 'All probes passed' : 'One or more probes FAILED',
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    total: results.length,
  };
  process[allPassed ? 'stdout' : 'stderr'].write(JSON.stringify(summary) + '\n');

  await pushResult(allPassed ? 1 : 0);

  process.exit(allPassed ? 0 : 1);
})();
