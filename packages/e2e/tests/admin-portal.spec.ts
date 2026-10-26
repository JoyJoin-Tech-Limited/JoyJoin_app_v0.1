import { test, expect, type Page } from '@playwright/test';

/**
 * Admin portal smoke tests.
 *
 * Why this file asserts `#root` children: when a React component throws during
 * render, React 18 unmounts the entire root, so the operator sees a white page
 * while `document.title` still updates (routing already happened). Neither
 * `vite build` nor a type check can catch that — only mounting the app can.
 * 2026-10-26: two independent crashes shipped this way (`<Button asChild>`
 * receiving two children, and `/admin/pricing` reading snake_case fields from a
 * camelCase payload). Both produced a blank screen on the first route after login.
 *
 * Prerequisites (the Playwright config only starts the API):
 *   npm run dev:server
 *   cd apps/admin-client && npx vite --port 5002
 *
 * Run:
 *   E2E_ADMIN_URL=http://localhost:5002 \
 *   E2E_ADMIN_USERNAME=devadmin E2E_ADMIN_PASSWORD='...' \
 *   npm run test:e2e -w @joyjoin/e2e -- admin-portal
 */

const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:5002';
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';

/** Routes that carry the console-rework code paths (KPI, queue, finance, pricing). */
const CRITICAL_ROUTES = [
  '/admin/dashboard',
  '/admin/war-room',
  '/admin/users',
  '/admin/finance',
  '/admin/pricing',
  '/admin/event-pools',
  '/admin/feature-flags',
  '/admin/matching-reviews',
  '/admin/audit-logs',
];

/** Collect uncaught render errors — the thing that blanks the page. */
function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function assertMounted(page: Page, label: string) {
  // React paints the tree once and only then unmounts it when a descendant
  // throws. Measured on this exact bug: kids=2 / 173 chars immediately after
  // login, then kids=0 from ~1s onwards. A single "root has children" sample
  // therefore passes on a doomed page, so the condition must hold across two
  // samples one second apart. Lazy route chunks also need the wait.
  const snapshot = () =>
    page.evaluate(() => ({
      kids: document.getElementById('root')?.children.length ?? 0,
      text: document.body.innerText.trim().length,
    }));

  const deadline = Date.now() + 20_000;
  let consecutive = 0;
  let last = { kids: 0, text: 0 };

  while (Date.now() < deadline) {
    last = await snapshot();
    consecutive = last.kids > 0 && last.text > 50 ? consecutive + 1 : 0;
    if (consecutive >= 2) return;
    await page.waitForTimeout(1_000);
  }

  throw new Error(
    `${label} did not render: #root children = ${last.kids}, visible text = ${last.text} chars. ` +
      (last.kids === 0
        ? 'React unmounted the tree — a component threw during render.'
        : 'Root mounted but stayed empty — check the loading/error state.'),
  );
}

async function login(page: Page) {
  await page.goto(`${ADMIN_URL}/admin/login`);
  await page.getByTestId('input-admin-username').fill(ADMIN_USERNAME);
  await page.getByTestId('input-admin-password').fill(ADMIN_PASSWORD);
  await page.getByTestId('button-admin-login').click();
  await page.waitForURL(/\/admin\/(dashboard|$)/, { timeout: 15_000 });
}

test.describe('Admin Portal', () => {
  test('admin API rejects unauthenticated requests', async ({ request }) => {
    const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5000';
    const res = await request.get(`${API_URL}/api/admin/users`);
    expect([401, 403]).toContain(res.status());
  });

  test('admin login page loads', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/login`);

    await expect(page.getByTestId('input-admin-username')).toBeVisible();
    await expect(page.getByTestId('input-admin-password')).toBeVisible();
    await expect(page.getByTestId('button-admin-login')).toBeVisible();
  });

  test.describe('authenticated console', () => {
    // Every test here logs in through the same admin login endpoint. Running
    // them in parallel made one worker time out clicking the login button
    // (observed 2026-10-26: 6 passed / 1 failed, then 7/7 with --workers=1),
    // because parallel logins contend on the dev server / login rate limiter.
    // These are smoke tests, so serial is the correct trade: a real regression
    // fails here faster than the suite would save by parallelising.
    test.describe.configure({ mode: 'serial' });

    test.skip(
      !ADMIN_USERNAME || !ADMIN_PASSWORD,
      'Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD to run console smoke tests',
    );

    test('console renders after login', async ({ page }) => {
      const errors = collectPageErrors(page);

      await login(page);

      await assertMounted(page, 'dashboard after login');
      expect(errors, 'render crashed after login').toEqual([]);

      // The sidebar is part of the shared chrome every route depends on.
      await expect(page.getByRole('link', { name: /数据看板/ }).first()).toBeVisible();
    });

    test('dashboard 经营分析 link navigates (asChild regression)', async ({ page }) => {
      const errors = collectPageErrors(page);
      await login(page);
      await assertMounted(page, 'dashboard');

      // `<Button asChild><Link/></Button>` used to pass two children to Radix
      // Slot and unmount the root on this exact screen.
      await page.getByTestId('link-analytics').click();
      await page.waitForURL(/\/admin\/data-insights/, { timeout: 15_000 });

      await assertMounted(page, 'data-insights');
      expect(errors, 'asChild link crashed the tree').toEqual([]);
    });

    test('critical routes mount without crashing', async ({ page }) => {
      test.setTimeout(180_000); // 9 routes × (settle window + load)
      const errors = collectPageErrors(page);
      await login(page);

      for (const route of CRITICAL_ROUTES) {
        const response = await page.goto(`${ADMIN_URL}${route}`, { waitUntil: 'domcontentloaded' });
        expect(response?.status(), `${route} returned HTTP ${response?.status()}`).toBeLessThan(400);

        await assertMounted(page, route);
        expect(errors, `${route} crashed during render`).toEqual([]);
      }
    });

    test('shared button styles are compiled (tailwind content regression)', async ({ page }) => {
      const errors = collectPageErrors(page);
      await login(page);

      await page.goto(`${ADMIN_URL}/admin/venues`, { waitUntil: 'domcontentloaded' });
      await assertMounted(page, '/admin/venues');

      // `buttonVariants` lives in packages/shared/src/ui/buttonVariants.ts. If
      // Tailwind's `content` globs do not cover that folder, none of those
      // utilities are emitted and every Button collapses to bare text — on
      // 2026-10-26 the active toolbar tab rendered white-on-white at 106×18 px.
      // Only the rendered box can catch that; no type check or unit test can.
      const activeTab = page.getByRole('button', { name: '场地列表' });
      await expect(activeTab).toBeVisible();

      const box = await activeTab.boundingBox();
      expect(box?.height ?? 0, 'button collapsed to bare text height — shared buttonVariants CSS missing').toBeGreaterThanOrEqual(30);

      const styles = await activeTab.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { paddingLeft: cs.paddingLeft, borderRadius: cs.borderRadius, backgroundImage: cs.backgroundImage };
      });
      expect(parseFloat(styles.paddingLeft), 'button lost horizontal padding').toBeGreaterThan(0);
      expect(parseFloat(styles.borderRadius), 'button lost its radius').toBeGreaterThan(0);

      expect(errors, '/admin/venues crashed during render').toEqual([]);
    });

    test('unknown route shows fallback and its action works', async ({ page }) => {
      const errors = collectPageErrors(page);
      await login(page);

      await page.goto(`${ADMIN_URL}/admin/does-not-exist`);
      await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible({ timeout: 15_000 });
      await assertMounted(page, 'not-found fallback');

      // AdminNotFound's back link is the second `asChild` call site (Slot + Link
      // → renders an <a>, so it is a link role, not a button).
      await page.getByTestId('button-back-dashboard').click();
      await page.waitForURL(/\/admin\/dashboard/, { timeout: 15_000 });
      await assertMounted(page, 'dashboard via not-found action');

      expect(errors, 'not-found fallback crashed during render').toEqual([]);
    });
  });
});
