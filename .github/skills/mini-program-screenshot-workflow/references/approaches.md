# Screenshot Approaches — Detailed Steps

## Approach A: Visual Screenshot (H5 Build + Playwright, On-Demand PNG URL)

Use when you need an actual image of the UI for design review, comparison, or documentation.

**Screenshots are never saved to the repo.** They are generated on every HTTP request and served from `http://localhost:9000/<name>.png` (default port; override with `$SCREENSHOT_PORT`).

### Prerequisites

- Mock API server running on **port 5001** (or real backend running)
- Page may need **auth bypass patch** if it gates on `isAuthenticated`
- `@tarojs/plugin-platform-h5` installed in `apps/mini-program`

### One-command usage (recommended)

From the repo root:

```bash
npm run screenshot:events
```

This single command:

1. Kills any leftover mock / screenshot server processes
2. Builds H5 with `TARO_APP_API_BASE_URL=http://localhost:5001`
3. Starts `scripts/mock-h5-server.mjs` on port 5001
4. Starts `scripts/screenshot-server.mjs` on the first free port (9000, or 9001/9002/...)
5. Opens your default browser to the generated PNG URL
6. Waits for you to press Enter, then stops both servers

Other pages:

```bash
npm run screenshot:tier-selector
npm run screenshot:pool-registration
npm run screenshot:event-ticket-payment
```

Run `npm run screenshot:help` to list available pages.

### Manual three-step flow

Use this if you prefer to keep the servers running across multiple screenshots.

```bash
# 1. Build H5 with correct API base URL
cd apps/mini-program
TARO_APP_API_BASE_URL=http://localhost:5001 npx taro build --type h5

# 2. Start mock API server on EXACT port 5001
cd ../..
node scripts/mock-h5-server.mjs

# 3. In another terminal, start the screenshot server
node scripts/screenshot-server.mjs
# If port 9000 is occupied:
# SCREENSHOT_PORT=9003 node scripts/screenshot-server.mjs
```

Open the URL in a browser. Every refresh re-runs Playwright and returns a fresh PNG.

### Existing screenshot generators

| URL | Page / flow |
|-----|-------------|
| `http://localhost:9000/events-footprint-oracle-card.png` | 我的足迹 Oracle cards |
| `http://localhost:9000/tier-selector-preset-cards.png` | Icebreaker tier selector preset cards |
| `http://localhost:9000/pool-registration-step-0-brief.png` | Pool registration brief step |
| `http://localhost:9000/event-ticket-payment.png` | Event ticket payment |

If port 9000 is occupied, override it: `SCREENSHOT_PORT=9003 node scripts/screenshot-server.mjs`, then use `http://localhost:9003/...`.

### Adding a new on-demand screenshot

Edit `scripts/screenshot-server.mjs`:

1. Write an async `captureMyPage()` function that returns `page.screenshot({ fullPage: true })`.
2. Register it with `register('my-page', captureMyPage)`.
3. Restart the server and open `http://localhost:9000/my-page.png`.

Keep generators stateless and idempotent — each request launches a fresh browser context.

### Manual steps (when no reusable script exists)

```bash
# 1. If the page requires auth, temporarily bypass it in source
#    Edit: apps/mini-program/src/pages/<page>/index.tsx
#    Change: isAuthenticated ? <RealComponent /> : <LandingPage />
#    To:     <RealComponent />

# 2. Build H5 with correct API base URL
cd apps/mini-program
TARO_APP_API_BASE_URL=http://localhost:5001 npx taro build --type h5

# 3. Start mock server on EXACT port 5001
#    Must expose these endpoints:
#      GET /api/auth/user       → { id, displayName, archetype, ... }
#      GET /api/event-pools     → EventPoolSummary[] (array, not wrapped)
#      GET /api/my-pool-registrations → []
#      GET /api/notifications/unread  → { unreadCounts: {}, totalUnread: 0 }
#    See: scripts/mock-h5-server.mjs in repo root

# 4. Start the screenshot server
node scripts/screenshot-server.mjs
# If port 9000 is occupied, use SCREENSHOT_PORT=9003

# 5. Open the generated PNG URL
open http://localhost:9000/<page>.png

# 6. CRITICAL: restore the auth bypass patch
#    git checkout apps/mini-program/src/pages/<page>/index.tsx
```

### Known traps

- **Wrong API base URL**: Default is `192.168.100.105:5002` (from `.env`). Must override with `TARO_APP_API_BASE_URL=http://localhost:5001`.
- **React Query cache**: Auth query uses `staleTime: Infinity`. If it cached an unauth response once, it stays unauth forever until cache is cleared. Always clear `localStorage` + `sessionStorage` before reload.
- **Wrong endpoint paths**: `getEventPools` calls `/api/event-pools`, not `/api/pools`. `getMyPoolRegistrations` calls `/api/my-pool-registrations`.
- **Response shape**: `getEventPools` expects `EventPoolSummary[]` (raw array), not `{ pools: [...] }`.
- **Module not loading**: If H5 page is blank after rebuild, the ES module may have failed to load. Check `document.getElementById('app')` has children. If empty, rebuild may have had a syntax error.
- **H5 runtime differences**: Native-only APIs (e.g., `wx.login`, canvas, custom tab bar) may not render exactly as on device. CDN assets require network.
- **Do not save screenshots to the repo**: The screenshot server returns PNGs in-memory. Never commit `.png` files under `apps/mini-program/screenshots/` or `tmp/screenshots/`.

### Auth bypass pattern (for H5 screenshots only)

Some pages conditionally render based on `useAuth().isAuthenticated`. To screenshot the authenticated variant:

1. Locate the conditional in the page's `index.tsx`:
   ```tsx
   content={isAuthenticated ? <AuthenticatedView /> : <LandingPage />}
   ```
2. Temporarily hardcode:
   ```tsx
   content={<AuthenticatedView />}
   ```
3. Build H5, screenshot, then **immediately restore**:
   ```bash
   git checkout apps/mini-program/src/pages/<page>/index.tsx
   ```

**Do not commit auth bypasses.**

## Approach B: Structural Verification (WeChat DevTools MCP)

Use when you need to verify what's rendered (text, elements, state) but don't need pixels.

```typescript
// Navigate to page
navigate_to({ url: "/pages/discover/index" })

// Get full WXML tree (positions, classes, attributes)
get_page_data({})

// Inspect a specific element
get_element({ selector: ".discover-auth__greeting", action: "wxml" })

// Tap / trigger events
get_element({ selector: ".discover-auth__action-card", action: "tap" })
```

### What you get

- Full WXML tree with `nn` (node name), `cl` (class), `sid` (stable ID)
- Text content via `v` fields
- Image sources via `p4` attributes
- No colors, fonts, or layout metrics

### Correct DevTools smoke test for visibility-dependent components

Some components — most importantly the **native custom tab bar** — can exist in the WXML tree while being invisible because WeChat's `hidden` attribute sets `display: none`. A smoke test that only checks "is the element in the tree?" will give false positives.

Use this procedure after any tab-bar or routing change:

1. Build and reload DevTools:

   ```bash
   cd apps/mini-program
   npm run build:weapp
   ```

   Then close and reopen the project in DevTools (or press `Command + R`) to clear the custom-tab-bar compile cache.

2. Navigate to a tab page, e.g.:

   ```typescript
   navigate_to({ url: "/pages/discover/index" })
   ```

3. In DevTools, select the tab-bar root (`.joy-custom-tab-bar`).
4. In the right-hand styles / computed pane, verify:

   | Check | Pass criteria on a tab page |
   | --- | --- |
   | Outer `hidden` attribute | **absent** |
   | Computed `display` | `block` (or any non-`none` value) |

5. Navigate to a non-tab page and verify the opposite:

   ```typescript
   // AppService console
   wx.reLaunch({ url: "/pages/login/index" })
   ```

   | Check | Pass criteria on a non-tab page |
   | --- | --- |
   | Element presence | Not in the tree, **or** `hidden=""` present |
   | Computed `display` | `none` |

6. Record results in a small matrix:

   | Page | Route | `display` | `hidden` attr |
   | --- | --- | --- | --- |
   | 发现 | `pages/discover/index` | `block` | absent ✅ |
   | 足迹 | `pages/events/index` | `block` | absent ✅ |
   | 连接 | `pages/connections/index` | `block` | absent ✅ |
   | 我的 | `pages/profile/index` | `block` | absent ✅ |
   | 中心入口 | `pages/center-hub/index` | `block` | absent ✅ |
   | Login | `pages/login/index` | n/a | hidden / not attached ✅ |

For the complete runbook, see [`docs/runbooks/mini-program-tab-bar-smoke.md`](../../../docs/runbooks/mini-program-tab-bar-smoke.md).

## Approach C: Real Device Preview (CLI QR Code)

Use when you need to see the exact WeChat runtime rendering (fonts, native components, safe areas).

```bash
cd apps/mini-program
/Applications/wechatwebdevtools.app/Contents/MacOS/cli \
  auto-preview --project $(pwd)
```

This generates a preview QR code in the DevTools window. Scan with WeChat to open on a real device.

**Note**: The CLI `--qr-output-dest` and `--qr-format image` flags are **broken** — they hang and produce no file. Use the DevTools GUI QR or the CLI's terminal output.

## Approach D: Quick "What's On Screen" (Health Check)

```typescript
// Current page path + console errors
check_health({})
// → { pagePath: "pages/discover/index", recentConsoleErrors: [...] }
```

Use for smoke tests after code changes. Not a substitute for visual verification.

## Mock server reference

A reusable mock API server for H5 screenshots lives at `scripts/mock-h5-server.mjs`. It must:

- Listen on port 5001
- Serve static files from `apps/mini-program/dist`
- Respond to all API endpoints the page calls
- Set CORS headers (`Access-Control-Allow-Origin: *`)
- Return a fake authenticated user + feature flags so pages render the real authenticated UI

Add new endpoints to `scripts/mock-h5-server.mjs` following the existing patterns when screenshotting pages that call APIs not yet mocked.

## Screenshot server reference

A separate on-demand screenshot server lives at `scripts/screenshot-server.mjs`. It:

- Listens on port 9000 by default (`$SCREENSHOT_PORT` to override)
- Registers Playwright capture functions by name
- Serves `GET /:name.png` by running the generator and returning the PNG buffer
- Never writes images to disk

Register a new capture in `scripts/screenshot-server.mjs`:

```js
async function captureMyPage() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  await page.goto('http://localhost:5001/#/pages/my-page/index', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('.my-page__root', { timeout: 10000 })
  await page.waitForTimeout(1000)

  const buffer = await page.screenshot({ fullPage: true })
  await browser.close()
  return buffer
}

register('my-page', captureMyPage)
```

Then visit `http://localhost:9000/my-page.png`.
