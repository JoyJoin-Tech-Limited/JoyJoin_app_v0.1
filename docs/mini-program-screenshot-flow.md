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
| `http://localhost:9000/squad-unboxing-revealed.png` | Squad unboxing revealed |
| `http://localhost:9000/profile-review-welcome-coupon.png` | Profile review welcome coupon |

If port 9000 is occupied, the screenshot server will use the next free port; use `SCREENSHOT_PORT=9003 node scripts/screenshot-server.mjs` to force a specific port.

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

