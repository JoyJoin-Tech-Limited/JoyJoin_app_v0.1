#!/usr/bin/env node
/**
 * JoyJoin Observability MCP Server
 *
 * Lightweight stdio MCP server that exposes tools for querying
 * JoyJoin's built-in observability endpoints.
 *
 * Tools:
 *   - joyjoin_health_check      → GET /api/health
 *   - joyjoin_readiness_check   → GET /api/readyz
 *   - joyjoin_metrics_query     → GET /api/metrics (returns first 50 lines)
 *   - joyjoin_synthetic_probe   → runs scripts/synthetic/happy-path-probe.mjs
 *   - joyjoin_deployment_health → comprehensive health check across all endpoints
 *   - joyjoin_audit_logs_query  → GET /api/admin/audit-logs (requires admin auth)
 *
 * Env:
 *   JOYJOIN_API_URL        (default: http://localhost:5000)
 *   JOYJOIN_ADMIN_USERNAME (for audit log queries)
 *   JOYJOIN_ADMIN_PASSWORD (for audit log queries)
 *   PROBE_TIMEOUT_MS       (default: 5000)
 */

const API_URL = (process.env.JOYJOIN_API_URL ?? 'http://localhost:5000').replace(/\/+$/, '');
const PROBE_TIMEOUT_MS = parseInt(process.env.PROBE_TIMEOUT_MS ?? '5000', 10);
const ADMIN_USERNAME = process.env.JOYJOIN_ADMIN_USERNAME ?? '';
const ADMIN_PASSWORD = process.env.JOYJOIN_ADMIN_PASSWORD ?? '';

const TOOLS = [
  {
    name: 'joyjoin_health_check',
    description: 'Check the JoyJoin API health endpoint (/api/health)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'joyjoin_readiness_check',
    description: 'Check the JoyJoin API readiness endpoint (/api/readyz)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'joyjoin_metrics_query',
    description: 'Fetch the first 50 lines of Prometheus metrics from /api/metrics',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'joyjoin_synthetic_probe',
    description: 'Run the synthetic happy-path probe against the API',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'joyjoin_deployment_health',
    description: 'Comprehensive deployment health check: health, readiness, metrics, and auth in one call. Returns a PASS/FAIL verdict per endpoint.',
    inputSchema: {
      type: 'object',
      properties: {
        environment: {
          type: 'string',
          description: 'Optional environment label (local, staging, production) for the report',
        },
      },
      required: [],
    },
  },
  {
    name: 'joyjoin_audit_logs_query',
    description: 'Query the admin audit log endpoint (/api/admin/audit-logs). Requires JOYJOIN_ADMIN_USERNAME and JOYJOIN_ADMIN_PASSWORD env vars.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max rows to return (default 20, max 100)' },
        action: { type: 'string', description: 'Filter by action type (e.g., ADMIN_LOGIN, USER_BANNED)' },
        adminId: { type: 'string', description: 'Filter by admin ID' },
      },
      required: [],
    },
  },
];

function send(message) {
  const line = JSON.stringify(message);
  process.stdout.write(line + '\n');
}

async function fetchEndpoint(path, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}${path}`, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    const text = await res.text();
    return { status: res.status, text, ok: res.ok };
  } catch (err) {
    clearTimeout(timer);
    return { status: 0, text: err.message, ok: false };
  }
}

async function runProbe() {
  try {
    const { stdout } = await new Promise((resolve, reject) => {
      const chunks = [];
      const proc = spawn('node', ['../../scripts/synthetic/happy-path-probe.mjs'], {
        env: { ...process.env, BASE_URL: API_URL },
        cwd: new URL('..', import.meta.url),
      });
      proc.stdout.on('data', (d) => chunks.push(d));
      proc.stderr.on('data', (d) => chunks.push(d));
      proc.on('close', (code) => {
        resolve({ stdout: Buffer.concat(chunks).toString('utf-8'), code });
      });
      proc.on('error', reject);
    });
    return { status: 200, text: stdout, ok: true };
  } catch (err) {
    return { status: 0, text: err.message, ok: false };
  }
}

async function adminLogin() {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    return null;
  }
  const res = await fetchEndpoint('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) return null;
  try {
    const json = JSON.parse(res.text);
    // Extract cookie from Set-Cookie header if present
    return json;
  } catch {
    return null;
  }
}

import { spawn } from 'child_process';

const handlers = {
  async joyjoin_health_check() {
    const { status, text, ok } = await fetchEndpoint('/api/health');
    return {
      content: [{ type: 'text', text: `HTTP ${status}\n${text}` }],
      isError: !ok,
    };
  },

  async joyjoin_readiness_check() {
    const { status, text, ok } = await fetchEndpoint('/api/readyz');
    return {
      content: [{ type: 'text', text: `HTTP ${status}\n${text}` }],
      isError: !ok,
    };
  },

  async joyjoin_metrics_query() {
    const { status, text, ok } = await fetchEndpoint('/api/metrics');
    const lines = text.split('\n').slice(0, 50).join('\n');
    return {
      content: [{ type: 'text', text: `HTTP ${status}\n${lines}\n... (${text.split('\n').length} total lines)` }],
      isError: !ok,
    };
  },

  async joyjoin_synthetic_probe() {
    const { status, text, ok } = await runProbe();
    return {
      content: [{ type: 'text', text: text }],
      isError: !ok,
    };
  },

  async joyjoin_deployment_health({ environment = 'unspecified' } = {}) {
    const results = [];

    const health = await fetchEndpoint('/api/health');
    results.push({ endpoint: '/api/health', status: health.status, ok: health.ok });

    const readyz = await fetchEndpoint('/api/readyz');
    results.push({ endpoint: '/api/readyz', status: readyz.status, ok: readyz.ok });

    const metrics = await fetchEndpoint('/api/metrics');
    results.push({ endpoint: '/api/metrics', status: metrics.status, ok: metrics.ok });

    const auth = await fetchEndpoint('/api/auth/user');
    results.push({ endpoint: '/api/auth/user', status: auth.status, ok: auth.status === 401 }); // 401 = middleware reachable

    const allOk = results.every((r) => r.ok);
    const report = [
      `Environment: ${environment}`,
      `API URL: ${API_URL}`,
      `Overall: ${allOk ? 'PASS' : 'FAIL'}`,
      '',
      ...results.map((r) => `  ${r.endpoint} → HTTP ${r.status} → ${r.ok ? 'PASS' : 'FAIL'}`),
    ].join('\n');

    return {
      content: [{ type: 'text', text: report }],
      isError: !allOk,
    };
  },

  async joyjoin_audit_logs_query({ limit = 20, action, adminId } = {}) {
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      return {
        content: [{ type: 'text', text: 'Missing JOYJOIN_ADMIN_USERNAME or JOYJOIN_ADMIN_PASSWORD env vars.' }],
        isError: true,
      };
    }

    // First login to get a session cookie
    const loginRes = await fetchEndpoint('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    });

    if (!loginRes.ok) {
      return {
        content: [{ type: 'text', text: `Admin login failed: HTTP ${loginRes.status}\n${loginRes.text}` }],
        isError: true,
      };
    }

    // Build query params
    const params = new URLSearchParams();
    params.set('limit', String(Math.min(limit, 100)));
    if (action) params.set('action', action);
    if (adminId) params.set('adminId', adminId);

    const queryRes = await fetchEndpoint(`/api/admin/audit-logs?${params.toString()}`);
    return {
      content: [{ type: 'text', text: `HTTP ${queryRes.status}\n${queryRes.text}` }],
      isError: !queryRes.ok,
    };
  },
};

process.stdin.setEncoding('utf-8');
let buffer = '';

process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    handleLine(line);
  }
});

async function handleLine(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }

  const { id, method, params } = msg;

  if (method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'joyjoin-observability', version: '1.1.0' },
      },
    });
    return;
  }

  if (method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id,
      result: { tools: TOOLS },
    });
    return;
  }

  if (method === 'tools/call') {
    const name = params?.name;
    const handler = handlers[name];
    if (!handler) {
      send({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Unknown tool: ${name}` },
      });
      return;
    }
    try {
      const result = await handler(params?.arguments ?? {});
      send({ jsonrpc: '2.0', id, result });
    } catch (err) {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        },
      });
    }
    return;
  }

  send({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
}
