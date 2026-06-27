# Mini-Program UI Screenshot Verification Flow

> One repeatable way to capture pixel-perfect mini-program UI screenshots for design review / QA without WeChat DevTools GUI.

## Overview

We build the mini-program as **H5** using `@tarojs/plugin-platform-h5`, serve it with a local mock API server, then use **Playwright** to navigate and screenshot specific pages.

## Prerequisites

- `@tarojs/plugin-platform-h5` installed in `apps/mini-program`
- `playwright` available in the workspace
- Mock API server: `scripts/mock-h5-server.mjs`

## Quick start

```bash
# 1. Build H5 (API base points to mock server)
cd apps/mini-program
TARO_APP_API_BASE_URL=http://localhost:5001 npx taro build --type h5

# 2. Start mock API server
cd ..
node scripts/mock-h5-server.mjs

# 3. In another terminal, run the screenshot script
node scripts/screenshot-tier-selector.mjs
```

Screenshot is saved to `screenshots/tier-selector-preset-cards.png`.

## How it works

1. **H5 build** compiles the mini-program pages to a browser-runnable SPA under `apps/mini-program/dist`.
2. **Mock server** (`scripts/mock-h5-server.mjs`) runs on `localhost:5001` and returns a fake authenticated user + feature flags so the page renders the real authenticated UI.
3. **Playwright** opens the H5 app in a mobile viewport, navigates to the target route, waits for key selectors, and screenshots.

## Adding a new page screenshot

1. Make sure the mock server returns any data the page needs (copy the pattern in `scripts/mock-h5-server.mjs`).
2. Create a new script under `scripts/screenshot-<page>.mjs`:

```js
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const OUTPUT_DIR = path.resolve(process.cwd(), 'screenshots')
fs.mkdirSync(OUTPUT_DIR, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
})
const page = await context.newPage()

await page.goto(
  'http://localhost:5001/#/pages/<your-page>/index?param=value',
  { waitUntil: 'networkidle' },
)

await page.waitForSelector('.your-page__root', { timeout: 10000 })
await page.waitForTimeout(1000)

const screenshotPath = path.join(OUTPUT_DIR, 'your-page.png')
await page.screenshot({ path: screenshotPath, fullPage: true })

console.log('Screenshot saved:', screenshotPath)
await browser.close()
```

3. Run it while the mock server is up.

## Mock user configuration

The mock server currently returns a user with all staging-ready feature flags enabled. To test a different state, edit `MOCK_USER.features` in `scripts/mock-h5-server.mjs`.

Key flags for icebreaker / tier-selector:

```js
runPlanTemplatesEnabled: true,            // shows preset cards
socialIcebreakerCustomModeEnabled: true,  // shows 自由局
```

## Limitations

- **H5 is not WeChat runtime**: native-only APIs (e.g., `wx.login`, canvas, custom tab bar) may not render exactly as on device.
- **CDN assets require network**: card background images load from CDN; screenshot on slow/offline machine may show blank backgrounds.
- **Auth is mocked**: any flow that requires a real backend mutation (payment, matching) cannot be fully exercised.

## When to use this vs. DevTools

| Goal | Use |
|------|-----|
| Pixel-perfect layout / typography review | **H5 + Playwright** (this flow) |
| Native WeChat runtime behavior | WeChat DevTools / real device |
| Structural DOM / state verification | WeChat DevTools MCP |

## Troubleshooting

- **Build fails with "找不到插件依赖 @tarojs/plugin-platform-h5"**
  Run: `npm install @tarojs/plugin-platform-h5 --workspace=mini-program`

- **Screenshot shows blank page**
  Check the H5 build succeeded and `apps/mini-program/dist/index.html` exists. Verify mock server is running on port 5001.

- **Page shows unauthenticated landing**
  The mock `/api/auth/user` may not be returning first. Ensure `scripts/mock-h5-server.mjs` is running and the page route is correct.

- **Background images missing**
  Check CDN availability. The card backgrounds load from `TARO_APP_CDN_BASE_URL`. For local H5 builds without a CDN URL, images may 404.
