import { test, expect } from '@playwright/test';

/**
 * Critical user journey: onboarding flow verification.
 * Validates that core onboarding pages load with expected elements.
 */
test.describe('Onboarding Journey', () => {
  test('landing page loads with brand elements', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/JoyJoin|悦聚/);
    // Brand should be visible
    await expect(page.locator('body')).toContainText(/JoyJoin|悦聚/);
  });

  test('onboarding setup page loads', async ({ page }) => {
    await page.goto('/onboarding/setup');
    // Page should render without crashing
    await expect(page.locator('body')).toBeVisible();
    // Should contain form-like elements for profile setup
    const inputs = page.locator('input, textarea, select');
    await expect(inputs).toHaveCount(1, { timeout: 5000 }).catch(() => {
      // Fallback: some setups use custom components
      return expect(page.locator('button')).toHaveCount(1, { timeout: 5000 });
    });
  });

  test('discover page loads after onboarding', async ({ page }) => {
    await page.goto('/discover');
    await expect(page.locator('body')).toBeVisible();
    // Discover should show event pool content or loading state
    const hasContent = await page.locator('text=/event|pool|activity|发现/i').isVisible().catch(() => false);
    const hasLoading = await page.locator('text=/loading|加载/i').isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=/empty|暂无/i').isVisible().catch(() => false);
    expect(hasContent || hasLoading || hasEmpty).toBe(true);
  });
});
