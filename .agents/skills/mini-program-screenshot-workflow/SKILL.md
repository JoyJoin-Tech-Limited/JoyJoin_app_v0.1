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
  "mini-program screenshot", "WeChat DevTools screenshot", "page preview".
---

# Mini-Program Screenshot & Preview Workflow

> **Hard truth:** There is no one-click screenshot for the WeChat Mini Program.
> The WeChat DevTools MCP provides navigation and DOM inspection, but **no visual
> capture**. Choose the correct approach based on what you actually need.

---

## Decision tree (read this first)

| Goal | Approach | Setup time | Fidelity |
|------|----------|------------|----------|
| **Visual screenshot** (pixels, colors, layout) | **H5 build → Playwright** | ~3 min | High (web render) |
| **Structural verification** (DOM, text, state) | **WeChat DevTools MCP** | instant | n/a (data only) |
| **Real device preview** (WeChat runtime) | **CLI auto-preview QR** | ~1 min | Exact |
| **Quick "what's on screen"** | **WeChat DevTools MCP `get_page_data`** | instant | n/a (tree dump) |

**Never attempt** (known failures):
- Playwright on WeChat DevTools WS/HTTP ports — DevTools is WebSocket-only, no HTTP preview
- macOS `screencapture` / AppleScript of DevTools window — window not visible in headless context, no assistive access
- WeChat CLI `auto-preview --qr-output-dest` — hangs indefinitely, no file written
- Playwright "screenshot" while connected to WeChat DevTools MCP — captures blank page

---

## Approach A: Visual Screenshot (H5 Build + Playwright)

Use when you need an actual image of the UI for design review, comparison, or documentation.

### Prerequisites
- Mock API server running on **port 5001** (or real backend running)
- Page may need **auth bypass patch** if it gates on `isAuthenticated`

### Steps

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

# 4. Playwright navigate and screenshot
playwright_navigate({ url: "http://localhost:5001/#/pages/<page>/index" })
playwright_screenshot({ name: "<page>-screenshot", savePng: true })

# 5. CRITICAL: restore the auth bypass patch
#    git checkout apps/mini-program/src/pages/<page>/index.tsx
```

### Known traps
- **Wrong API base URL**: Default is `192.168.100.105:5002` (from `.env`). Must override with `TARO_APP_API_BASE_URL=http://localhost:5001`.
- **React Query cache**: Auth query uses `staleTime: Infinity`. If it cached an unauth response once, it stays unauth forever until cache is cleared. Always clear `localStorage` + `sessionStorage` before reload.
- **Wrong endpoint paths**: `getEventPools` calls `/api/event-pools`, not `/api/pools`. `getMyPoolRegistrations` calls `/api/my-pool-registrations`.
- **Response shape**: `getEventPools` expects `EventPoolSummary[]` (raw array), not `{ pools: [...] }`.
- **Module not loading**: If H5 page is blank after rebuild, the ES module may have failed to load. Check `document.getElementById('app')` has children. If empty, rebuild may have had a syntax error.

---

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

---

## Approach C: Real Device Preview (CLI QR Code)

Use when you need to see the exact WeChat runtime rendering (fonts, native components, safe areas).

```bash
cd apps/mini-program
/Applications/wechatwebdevtools.app/Contents/MacOS/cli \
  auto-preview --project $(pwd)
```

This generates a preview QR code in the DevTools window. Scan with WeChat to open on a real device.

**Note**: The CLI `--qr-output-dest` and `--qr-format image` flags are **broken** — they hang and produce no file. Use the DevTools GUI QR or the CLI's terminal output.

---

## Approach D: Quick "What's On Screen" (Health Check)

```typescript
// Current page path + console errors
check_health({})
// → { pagePath: "pages/discover/index", recentConsoleErrors: [...] }
```

Use for smoke tests after code changes. Not a substitute for visual verification.

---

## Auth bypass pattern (for H5 screenshots only)

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

---

## Mock server reference

A reusable mock server for H5 screenshots lives at `scripts/mock-h5-server.mjs` (create if absent). It must:
- Listen on port 5001
- Serve static files from `apps/mini-program/dist`
- Respond to all API endpoints the page calls
- Set CORS headers (`Access-Control-Allow-Origin: *`)

---

## Related skills

- `mini-program-frontend-excellence` — UI quality standards, pixel precision, DevTools inspection
- `platform-coordination-protocol` — Mini-program vs web client parity checks
- `viewport-zero-scroll` — Layout policy for mini-program screens
