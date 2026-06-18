# Screenshot Approaches — Detailed Steps

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

Some components — most importantly the **native custom tab bar** — can exist in
 the WXML tree while being invisible because WeChat's `hidden` attribute sets
`display: none`. A smoke test that only checks "is the element in the tree?"
will give false positives.

Use this procedure after any tab-bar or routing change:

1. Build and reload DevTools:

   ```bash
   cd apps/mini-program
   npm run build:weapp
   ```

   Then close and reopen the project in DevTools (or press `Command + R`) to
   clear the custom-tab-bar compile cache.

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

For the complete runbook, see
[`docs/runbooks/mini-program-tab-bar-smoke.md`](../../../docs/runbooks/mini-program-tab-bar-smoke.md).

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

## Mock server reference

A reusable mock server for H5 screenshots lives at `scripts/mock-h5-server.mjs` (create if absent). It must:
- Listen on port 5001
- Serve static files from `apps/mini-program/dist`
- Respond to all API endpoints the page calls
- Set CORS headers (`Access-Control-Allow-Origin: *`)
