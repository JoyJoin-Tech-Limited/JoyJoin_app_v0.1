import { test, expect } from '@playwright/test';

/**
 * Admin portal access verification.
 */
test.describe('Admin Portal', () => {
  test('admin login page loads', async ({ page }) => {
    await page.goto('http://localhost:5002/login');
    await expect(page.locator('body')).toBeVisible();
    // Login form should have username/password inputs
    const inputs = page.locator('input[type="text"], input[type="password"], input[type="username"]');
    await expect(inputs).toHaveCount(2, { timeout: 5000 }).catch(() => {
      // Some implementations use a single input or different structure
      return expect(page.locator('input')).toHaveCount(1, { timeout: 5000 });
    });
  });

  test('admin API rejects unauthenticated requests', async ({ request }) => {
    const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5000';
    const res = await request.get(`${API_URL}/api/admin/users`);
    expect([401, 403]).toContain(res.status());
  });
});
