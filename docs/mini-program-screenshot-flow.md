# Mini-Program UI Screenshot Verification Flow

> One repeatable way to capture pixel-perfect mini-program UI screenshots for design review / QA without WeChat DevTools GUI.
>
> **Agent canonical reference:** `.github/skills/mini-program-screenshot-workflow/SKILL.md`

## Overview

We build the mini-program as **H5** using `@tarojs/plugin-platform-h5`, serve it with a local mock API server, then use **Playwright** to navigate and screenshot specific pages. Screenshots are served on-demand as PNG URLs from `scripts/screenshot-server.mjs` and are **never saved to the repo**.

## Prerequisites

- `@tarojs/plugin-platform-h5` installed in `apps/mini-program`
- `playwright` available in the workspace
- Mock API server: `scripts/mock-h5-server.mjs`

## One-command usage (recommended)

From the repo root:

```bash
npm run screenshot:events
```

This builds H5, starts the mock and screenshot servers on free ports, and opens the screenshot URL in your default browser automatically.

Other available pages:

```bash
npm run screenshot:tier-selector
npm run screenshot:pool-registration
npm run screenshot:event-ticket-payment
npm run screenshot:squad-unboxing
npm run screenshot:profile-review
```

Run `npm run screenshot:help` to list them.

## Manual flow

If you prefer to keep servers running across multiple screenshots:

```bash
# 1. Build H5
cd apps/mini-program
TARO_APP_API_BASE_URL=http://localhost:5001 npx taro build --type h5

# 2. Start mock API server
cd ../..
node scripts/mock-h5-server.mjs

# 3. In another terminal, start the screenshot server
node scripts/screenshot-server.mjs
```

Then open the URL in a browser (do not paste the URL into the terminal):

| URL | Page |
|-----|------|
| `http://localhost:9000/events-footprint-oracle-card.png` | 我的足迹 |
| `http://localhost:9000/tier-selector-preset-cards.png` | Icebreaker tier selector |
| `http://localhost:9000/pool-registration-step-0-brief.png` | Pool registration brief |
| `http://localhost:9000/event-ticket-payment.png` | Event ticket payment |
| `http://localhost:9000/squad-unboxing-ready.png` | Squad unboxing ready (gift box) |
| `http://localhost:9000/squad-unboxing-shaking.png` | Squad unboxing shaking |
| `http://localhost:9000/squad-unboxing-revealed.png` | Squad unboxing revealed (face-down fan, tap-to-reveal) |
| `http://localhost:9000/squad-unboxing-revealed-6.png` | Squad unboxing revealed, 6 members (two rows) |
| `http://localhost:9000/squad-unboxing-revealed-partial.png` | Squad unboxing partial flip (reveal-all hint chip) |
| `http://localhost:9000/squad-unboxing-revealed-allup.png` | Squad unboxing all cards face-up |
| `http://localhost:9000/squad-unboxing-revealed-overflow.png` | Squad unboxing 9-member overflow (+N chip) |
| `http://localhost:9000/squad-unboxing-focused.png` | Squad unboxing focused card |
| `http://localhost:9000/profile-review-welcome-coupon.png` | Profile review welcome coupon |
| `http://localhost:9000/profile-v17.png` | V1.7 “我的”页（透明像素人格、真实统计、成长进度、故事/形象入口） |
| `http://localhost:9000/discover-alang-v17.png` | V1.7 发现页阿浪入口（完整同尺寸视口，卡片位于真实页面上下文） |
| `http://localhost:9000/alang-search-v17.png` | V1.7 阿浪寻找页（模拟用户定位） |
| `http://localhost:9000/personal-story-v17.png` | V1.7 私人连续“我的故事”页 |
| `http://localhost:9000/my-image-v17.png` | V1.7 “我的形象”页 |
| `http://localhost:9000/profile-settings-v17.png` | V1.7 Profile 齿轮“设置与服务”页 |

If port 9000 is occupied, the screenshot server will use the next free port; use `SCREENSHOT_PORT=9003 node scripts/screenshot-server.mjs` to force a specific port.

## V1.7 Profile + Alang verification (Windows-safe manual flow)

The six V1.7 generators (`profile-v17`, `profile-settings-v17`, `discover-alang-v17`, `alang-search-v17`, `personal-story-v17`, and `my-image-v17`) use the same `390×844` CSS viewport at 2× device scale, request reduced motion, wait for loaded data selectors, and return a `780×1688` PNG as the HTTP response buffer. Discover scrolls the Alang card into view but keeps the surrounding page context. They do not write image files.

The final 2026-07-16 H5 production build completed with 1,397 modules. All six `780×1688` captures were generated outside the repository and reviewed: Profile, Profile Settings, Discover Alang card, Search, Personal Story, and My Image are F3. The clipping-aware My Image scan reports 0 blocking overlaps; the two previously reported sticky-save-bar intersections were false positives caused by labels already clipped outside their scroll viewport. H5 screenshots do not establish F4: formal layered equipment raster art, WeChat native Map, custom TabBar, safe areas, device fonts, location lifecycle, real providers, long-list behavior, and the physical-device matrix still require approval, DevTools, and device verification.

Run these commands in separate PowerShell terminals from the repository root:

```powershell
# Terminal 1 — build H5 once
$env:TARO_APP_API_BASE_URL='http://localhost:5001'
$env:TARO_APP_ENABLE_STORY_MODE='true'
npm.cmd run build:h5 --workspace=mini-program

# Terminal 2 — authenticated API + H5 static server
node scripts/mock-h5-server.mjs

# Terminal 3 — on-demand, in-memory PNG generator
$env:SCREENSHOT_PORT='9000'
$env:PLAYWRIGHT_EXECUTABLE_PATH='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node scripts/screenshot-server.mjs
```

`PLAYWRIGHT_EXECUTABLE_PATH` is optional. Set it when Playwright's bundled Chromium is not installed; on macOS/Linux, omit it or point it to an installed Chromium-compatible browser.

Request one of the six V1.7 URLs shown in the table above. Every request creates a fresh browser context and returns a new PNG buffer. The current one-command `screenshot-open.mjs` helper uses Unix process/open commands, so no V1.7 npm aliases are added until that launcher has a Windows lifecycle path.

The V1.7 mock server supplies these authenticated data boundaries:

| Boundary | Endpoint |
|---|---|
| Profile predictive shell | `GET /api/shell/profile` |
| Growth progress | `GET /api/user/gamification` |
| Discover predictive shell | `GET /api/shell/discover` |
| Alang missions + stage authority | `GET /api/alang/missions`, `GET /api/alang/missions/:slug` |
| Search distance report | `POST /api/alang/missions/:slug/gps` |
| Private continuous story | `GET /api/personal-story`, `GET /api/personal-story/update-status` |
| My Image inventory/outfit | `GET /api/equipment/me`, `GET /api/equipment/shop` |

For `alang-search-v17`, Playwright grants geolocation only for a simulated **user** position. The searching mission response contains no target coordinate or `routeDestination`; the GPS endpoint returns distance and the fixed 5-metre radius only.

## Adding a new page screenshot

1. Add any missing mock endpoints in `scripts/mock-h5-server.mjs`.
2. Add a `captureMyPage()` generator in `scripts/screenshot-server.mjs` and `register('my-page', captureMyPage)`.
3. Add a script alias in root `package.json`: `"screenshot:my-page": "node scripts/screenshot-open.mjs my-page"`.
4. Run `npm run screenshot:my-page`.

## When to use this vs. DevTools

| Goal | Use |
|------|-----|
| Pixel-perfect layout / typography review | **H5 + Playwright** (this flow) |
| Native WeChat runtime behavior | WeChat DevTools / real device |
| Structural DOM / state verification | WeChat DevTools MCP |

For full protocol details, see `.github/skills/mini-program-screenshot-workflow/SKILL.md` and `references/approaches.md`.
