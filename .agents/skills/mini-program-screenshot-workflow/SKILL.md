---
name: mini-program-screenshot-workflow
description: >
  Canonical workflow for capturing screenshots, previews, and visual verification
  of the JoyJoin WeChat Mini Program (apps/mini-program). Documents what works,
  what does not, and the exact steps for each approach. Use whenever asked to
  "screenshot the mini-program", "show me the UI", "preview this page", or
  "capture the mini-program screen". Prevents repeated wasted effort on approaches
  that are known to fail. Trigger phrases: "screenshot mini-program",
  "mini-program preview", "capture UI", "show me the page", "visual check",
  "mini-program screenshot", "WeChat DevTools screenshot", "page preview",
  "H5 screenshot flow", "playwright screenshot mini-program".
---

# Mini-Program Screenshot & Preview Workflow

> **Hard truth:** There is no one-click screenshot for the WeChat Mini Program.
> The WeChat DevTools MCP provides navigation and DOM inspection, but **no visual
> capture**. Choose the correct approach based on what you actually need.

## Decision tree (read this first)

| Goal | Approach | Setup time | Fidelity |
|------|----------|------------|----------|
| **Visual screenshot** (pixels, colors, layout) | **H5 build → Playwright → on-demand PNG URL** | ~3 min | High (web render) |
| **Structural verification** (DOM, text, state) | **WeChat DevTools MCP** | instant | n/a (data only) |
| **Real device preview** (WeChat runtime) | **CLI auto-preview QR** | ~1 min | Exact |
| **Quick "what's on screen"** | **WeChat DevTools MCP `get_page_data`** | instant | n/a (tree dump) |

**Never attempt** (known failures):
- Playwright on WeChat DevTools WS/HTTP ports — DevTools is WebSocket-only, no HTTP preview
- macOS `screencapture` / AppleScript of DevTools window — window not visible in headless context, no assistive access
- WeChat CLI `auto-preview --qr-output-dest` — hangs indefinitely, no file written
- Playwright "screenshot" while connected to WeChat DevTools MCP — captures blank page

## Approach overview

- **Approach A** — H5 build + Playwright, served on-demand as a PNG URL (`http://localhost:9000/<name>.png`)
- **Approach B** — WeChat DevTools MCP for structural verification (WXML tree, text, state)
- **Approach C** — CLI QR code for real-device WeChat runtime preview
- **Approach D** — `check_health` for quick smoke tests after code changes

See [references/approaches.md](references/approaches.md) for full step-by-step instructions, reusable scripts, auth bypass pattern, mock server setup, known traps, and detailed code snippets.

## When to use this skill

- The user asks to "screenshot the mini-program", "show me the UI", or "preview this page"
- You need a pixel-perfect visual of a mini-program screen for design review
- You need to verify structural rendering (DOM, text, state) without visual capture
- You need to test on a real WeChat runtime device
- You want to avoid known-failure approaches (Playwright on DevTools, AppleScript capture, etc.)

## Quick examples

- **Visual design review:** Run `npm run screenshot:events` from the repo root. It builds H5, starts the mock + screenshot servers on free ports, and opens the browser automatically. Other pages: `npm run screenshot:tier-selector`, `npm run screenshot:pool-registration`, `npm run screenshot:event-ticket-payment`. The PNG is generated on every request — no files are saved to the repo.
- **Structural smoke test:** Use Approach B (DevTools MCP) with `get_page_data` after navigating to `/pages/discover/index` to verify text and element presence. For visibility checks (e.g., the native custom tab bar), also inspect the **outer `hidden` attribute and computed `display`** — the WXML tree can contain the element while `hidden=""` makes it invisible.

## Troubleshooting

- **H5 page is blank after build** → Check `TARO_APP_API_BASE_URL` is `http://localhost:5001`; clear `localStorage` + `sessionStorage`; verify `document.getElementById('app')` has children.
- **Playwright screenshot shows unauthenticated landing page** → Auth query cached an unauth response; clear storage, bypass auth in source temporarily, or ensure mock server returns a valid user.
- **Mock server returns 404** → Verify endpoint paths exactly (e.g., `/api/event-pools`, not `/api/pools`) and response shapes (raw array vs wrapped object).
- **Screenshot server returns 404** → Generator name not registered in `scripts/screenshot-server.mjs`; visit `http://localhost:9000/` to see the list. If port 9000 is occupied, override with `SCREENSHOT_PORT`.
- **Terminal says "no such file or directory" when you paste the URL** → URLs must be opened in a browser, not typed into the terminal. Use `open http://...` or let `npm run screenshot:*` open it for you.
- **EADDRINUSE port 5001 or 9000** → Another instance is already running. Use `npm run screenshot:events` which kills old processes and picks free ports automatically.
- **DevTools MCP `get_page_data` returns empty tree** → Confirm navigation succeeded with `check_health`; verify the page path matches the compiled route.
- **QR code preview never loads** → Use DevTools GUI QR instead of `--qr-output-dest`; the CLI image export flag is broken.
- **Tab bar appears in WXML but is invisible on a tab page** → Check the computed `display` value and the outer `hidden` attribute. If `display: none`, the visibility guard may have regressed. See [`docs/runbooks/mini-program-tab-bar-smoke.md`](../../docs/runbooks/mini-program-tab-bar-smoke.md).

## Review checklist

- [ ] Approach chosen matches the actual goal (visual vs structural vs real device)
- [ ] Auth bypass patches are restored immediately after screenshot (`git checkout`)
- [ ] Mock server listens on port 5001 with correct endpoints and CORS headers
- [ ] Screenshot server listens on port 9000 (or `$SCREENSHOT_PORT`) and page generator is registered
- [ ] H5 build uses `TARO_APP_API_BASE_URL=http://localhost:5001`
- [ ] No known-failure approach was attempted (Playwright on DevTools WS, AppleScript, CLI QR export)
- [ ] Screenshot is viewed via URL in a browser, not saved as a committed file or pasted into a terminal
- [ ] Sibling platform parity checked if the screen also exists on web

## Related skills

- `mini-program-frontend-excellence` — UI quality standards, pixel precision, DevTools inspection
- `platform-coordination-protocol` — Mini-program vs web client parity checks
- `viewport-zero-scroll` — Layout policy for mini-program screens
