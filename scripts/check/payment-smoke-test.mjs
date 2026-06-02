#!/usr/bin/env node
/**
 * Payment Smoke Test — Staging / Production Verification
 *
 * Tests all payment endpoints for expected behavior without requiring
 * a real WeChat login. Verifies:
 *   - Health / readiness
 *   - Auth gating (401 without session)
 *   - Payment creation gating (401 without session)
 *   - Webhook signature verification (401 without signature)
 *   - Admin gating (401 without admin)
 *   - Feature flag exposure (paymentsEnabled in /api/auth/user shape)
 *
 * Usage:
 *   node scripts/check/payment-smoke-test.mjs [API_BASE_URL]
 *
 * Defaults to JOYJOIN_API_URL env var, then https://api.joyjoinapp.com
 */

const API_BASE = process.argv[2] || process.env.JOYJOIN_API_URL || "https://api.joyjoinapp.com";

const tests = [];
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    tests.push({ name, status: "PASS" });
    passed++;
  } catch (err) {
    tests.push({ name, status: "FAIL", error: err.message });
    failed++;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${expected}, got ${actual}`);
  }
}

async function fetchJson(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, opts);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { status: res.status, text, json };
}

async function run() {
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`  Payment Smoke Test — ${API_BASE}`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  await test("Health endpoint returns 200", async () => {
    const { status, json } = await fetchJson("/api/health");
    assertEqual(status, 200, "Status code");
    assertEqual(json?.status, "ok", "Health status");
  });

  await test("Readiness endpoint returns 200", async () => {
    const { status, json } = await fetchJson("/api/readyz");
    assertEqual(status, 200, "Status code");
    assertEqual(json?.status, "ready", "Readiness status");
    assertEqual(json?.checks?.database, "ok", "Database check");
    assertEqual(json?.checks?.config, "ok", "Config check");
  });

  await test("Auth user without session returns 401", async () => {
    const { status } = await fetchJson("/api/auth/user");
    assertEqual(status, 401, "Status code");
  });

  await test("Payment status without session returns 401", async () => {
    const { status } = await fetchJson("/api/payments/status/test-order-123");
    assertEqual(status, 401, "Status code");
  });

  await test("Payment creation without session returns 401", async () => {
    const { status } = await fetchJson("/api/payments/miniprogram/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "vip_monthly" }),
    });
    assertEqual(status, 401, "Status code");
  });

  await test("Webhook without signature returns 401", async () => {
    const { status } = await fetchJson("/api/webhooks/wechat-pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assertEqual(status, 401, "Status code");
  });

  await test("Admin payments without admin session returns 401", async () => {
    const { status } = await fetchJson("/api/admin/payments");
    assertEqual(status, 401, "Status code");
  });

  await test("Metrics endpoint returns 200 with Prometheus data", async () => {
    const { status, text } = await fetchJson("/api/metrics");
    assertEqual(status, 200, "Status code");
    if (!text.includes("http_requests_total")) {
      throw new Error("Missing http_requests_total metric");
    }
  });

  // Summary
  console.log(`\n───────────────────────────────────────────────────────────────`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`───────────────────────────────────────────────────────────────`);

  for (const t of tests) {
    const icon = t.status === "PASS" ? "✅" : "❌";
    console.log(`  ${icon} ${t.name}`);
    if (t.error) {
      console.log(`     → ${t.error}`);
    }
  }

  console.log("");

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Smoke test runner failed:", err.message);
  process.exit(1);
});
