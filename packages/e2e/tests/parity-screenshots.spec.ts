import { test, expect } from '@playwright/test';

/**
 * Cross-platform parity screenshot capture.
 *
 * This spec captures baseline screenshots from the web client (`apps/user-client`)
 * so they can be compared against mini-program renders during parity audits.
 *
 * Since WeChat Mini Programs require the WeChat DevTools simulator, this suite
 * captures web baselines only. Mini-program screenshots must be taken manually
 * in WeChat DevTools and compared against these baselines.
 *
 * Usage:
 *   npm run test:e2e:headed -w @joyjoin/e2e -- parity-screenshots
 *
 * Baselines are stored in `packages/e2e/parity-baselines/`.
 */

const BASELINES_DIR = 'parity-baselines';

const SCREENSHOT_PATHS = {
  landing: `${BASELINES_DIR}/web-landing.png`,
  onboardingSetup: `${BASELINES_DIR}/web-onboarding-setup.png`,
  discover: `${BASELINES_DIR}/web-discover.png`,
  eventPoolDetail: `${BASELINES_DIR}/web-event-pool-detail.png`,
  profile: `${BASELINES_DIR}/web-profile.png`,
  adminLogin: `${BASELINES_DIR}/web-admin-login.png`,
};

test.describe('Web Baseline Screenshots (for mini-program parity)', () => {
  test('landing page baseline', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(SCREENSHOT_PATHS.landing, {
      maxDiffPixels: 100,
    });
  });

  test('onboarding setup baseline', async ({ page }) => {
    await page.goto('/onboarding/setup');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(SCREENSHOT_PATHS.onboardingSetup, {
      maxDiffPixels: 100,
    });
  });

  test('discover page baseline', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(SCREENSHOT_PATHS.discover, {
      maxDiffPixels: 100,
    });
  });

  test('admin login baseline', async ({ page }) => {
    await page.goto('http://localhost:5002/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot(SCREENSHOT_PATHS.adminLogin, {
      maxDiffPixels: 100,
    });
  });
});

test.describe('Screenshot parity checklist (manual mini-program comparison)', () => {
  test('generate parity checklist', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // This test always passes — it generates a report of what to check
    const checklist = [
      '# Mini-Program Parity Screenshot Checklist',
      '',
      '## Critical Screens (capture in WeChat DevTools and compare against web baselines)',
      '',
      '1. **Landing / Login**',
      `   - Web baseline: ${SCREENSHOT_PATHS.landing}`,
      '   - Mini-program page: pages/login/index',
      '   - Check: brand logo, CTA button placement, copy text',
      '',
      '2. **Onboarding Setup**',
      `   - Web baseline: ${SCREENSHOT_PATHS.onboardingSetup}`,
      '   - Mini-program page: subpackages/onboarding/setup',
      '   - Check: form field labels, spacing, step indicator',
      '',
      '3. **Discover (Event Pools)**',
      `   - Web baseline: ${SCREENSHOT_PATHS.discover}`,
      '   - Mini-program page: pages/discover/index',
      '   - Check: card layout, spacing, typography, empty state',
      '',
      '4. **Event Pool Detail**',
      `   - Web baseline: ${SCREENSHOT_PATHS.eventPoolDetail}`,
      '   - Mini-program page: pages/event-pool/detail',
      '   - Check: info hierarchy, action buttons, registration CTA',
      '',
      '5. **Profile**',
      `   - Web baseline: ${SCREENSHOT_PATHS.profile}`,
      '   - Mini-program page: pages/profile/index',
      '   - Check: avatar, display name, stats layout',
      '',
      '## How to capture mini-program screenshots',
      '',
      '1. Open WeChat DevTools',
      '2. Navigate to the target page',
      '3. Use DevTools screenshot tool (⌘⇧S / Ctrl+Shift+S)',
      '4. Save to `packages/e2e/parity-baselines/mp-{page}.png`',
      '5. Compare side-by-side with web baseline',
      '',
      '## Tolerance rules',
      '',
      '- Layout: matching structure within 8rpx (mini-program) / 4px (web)',
      '- Typography: same hierarchy, readable sizes',
      '- Colors: brand palette aligned (exact hex not required for platform-native components)',
      '- Copy: identical Chinese text',
      '- Interactions: equivalent pressed/loading/error states',
    ].join('\n');

    console.log(checklist);
    expect(true).toBe(true);
  });
});
