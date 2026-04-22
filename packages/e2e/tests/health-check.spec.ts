import { test, expect } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5000';

/**
 * Synthetic health and auth probe.
 * Mirrors scripts/synthetic/happy-path-probe.mjs in Playwright.
 */
test.describe('API Health & Auth', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('metrics endpoint returns Prometheus text', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/metrics`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('# TYPE');
  });

  test('auth endpoint returns 401 without session', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/auth/user`);
    expect(res.status()).toBe(401);
  });

  test('readiness endpoint returns ready', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/readyz`);
    expect(res.status()).toBe(200);
  });
});
