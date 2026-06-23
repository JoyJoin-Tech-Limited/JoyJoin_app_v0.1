# Mini-Program Native Custom Tab Bar — Smoke Runbook

> **Scope:** Verify that the native custom tab bar shows on every tab page and
> stays hidden on every non-tab page after a build or routing change.
>
> **Audience:** Frontend engineers and QA validating `apps/mini-program` in
> WeChat DevTools or on a real device.
>
> **Last updated:** 2026-06-23

---

## What this runbook proves

The mini-program uses a **native WeChat custom tab bar** (`tabBar.custom: true`)
that lives in `src/native-custom-tab-bar/` and is copied to `dist/custom-tab-bar/`
at build time. WeChat attaches this component to tabBar pages, but it can also
be attached to non-tab pages (e.g., the landing page) in some base-library /
routing scenarios.

This smoke proves:

1. The tab bar is **visible** on all five tab pages.
2. The tab bar is **hidden / not attached** on confirmed non-tab pages.
3. Route-format quirks (leading `/`, Taro timestamp query string) do not
   accidentally hide the bar on a valid tab page.
4. The active highlight and center button render and respond to taps.
5. Collapse, screen-reader announcements, and offline replay do not regress.

---

## Deterministic checks to run first

From the repo root:

```bash
npx vitest run apps/mini-program/src/native-custom-tab-bar/__tests__/tabBarBehavior.test.ts
npm run typecheck -w mini-program
npm run build:weapp -w mini-program
```

Expected result:

- All tab-bar behavior tests pass (37 tests as of 2026-06-23).
- Mini-program typecheck passes.
- WeChat build succeeds and refreshes `apps/mini-program/dist`.

These checks validate route normalization, allow-list membership, and the
visibility state machine. The manual DevTools smoke below is still required to
confirm runtime rendering.

---

## The golden rule of tab-bar smoke tests

> **Check the rendered effect, not just the WXML tree.**
>
> The tab-bar root can exist in the WXML tree while `hidden=""` makes it
> invisible (`display: none`). A passing structural check ("I see
> `.joy-custom-tab-bar` in the WXML panel") is **not** enough. You must verify
> the **computed `display` value** and the **outer `hidden` attribute**.

### Why this matters

`getCurrentPages()[n].route` returns inconsistent formats across WeChat base
libraries and Taro builds:

```text
pages/discover/index
/pages/discover/index
pages/discover/index?$taroTimestamp=1718700000000
```

The tab-bar allow-list lookup normalizes the leading `/` and strips the query
string, but an over-aggressive default could still hide the bar when the route
is temporarily unknown at attach time. The runtime fix (2026-06-18):

- Defaults `hidden` to `true`.
- Only hides when it is **certain** the current route is a known non-tab page.
- `setSelected()` (called from every tab page on `useDidShow`) explicitly sets
  `hidden: false`.

So the only reliable pass criterion is: **does the tab bar actually render on
screen for a tab page?**

---

## Preconditions

1. Build before opening DevTools. `apps/mini-program/project.config.json` points
   `miniprogramRoot` at `dist/`, so stale output means stale verification.
2. Open the project at `apps/mini-program` in WeChat DevTools.
3. If you previously inspected the tab bar, **close and reopen the project** (or
   press `Command + R`) to clear DevTools' custom-tab-bar compile cache.
4. Use a test account that is already authenticated and past onboarding so you
   can reach the tab pages directly.

---

## Manual DevTools smoke

### Step 1 — Open the WXML/element inspector

1. In DevTools, switch to the **调试器** / Debugger panel.
2. Open the **WXML** tab (element tree).
3. Select the **select-element tool** (cursor icon) and click the tab bar on the
   simulator screen, **or** type `.joy-custom-tab-bar` in the search box.

### Step 2 — Read the effect, not just the tree

With the tab-bar root selected, look at the right-hand **styles / computed**
pane:

| What to read | Tab page pass criteria | Non-tab page pass criteria |
| --- | --- | --- |
| **Outer element attributes** | `hidden` attribute is **absent** | `hidden` attribute is present (`hidden=""`) or element is not in the tree |
| **Computed `display`** | `block` (or other non-`none` value) | `none` |
| **Computed `visibility` / opacity** | Visible, opacity near `1` | Not applicable when `display: none` |

> **Anti-pattern:** Do not stop at "I see `.joy-custom-tab-bar` nodes in the
> tree." Confirm the attribute/computed panel above.

### Step 3 — Tab-page matrix

Navigate to each page and record the result. Use `wx.switchTab` or tap the tab
bar itself; do not use `wx.navigateTo` for tab pages.

| Page | Expected route | Tab bar `display` | `hidden` attr | Active highlight / center |
| --- | --- | --- | --- | --- |
| 发现 | `pages/discover/index` | `block` | absent | first tab |
| 足迹 | `pages/events/index` | `block` | absent | second tab |
| 连接 | `pages/connections/index` | `block` | absent | third tab |
| 我的 | `pages/profile/index` | `block` | absent | fourth tab |
| 中心入口 | `pages/center-hub/index` | `block` | absent | center button selected, side highlight hidden |

### Step 4 — Non-tab-page checks

From the AppService console, navigate to a known non-tab page:

```javascript
wx.reLaunch({ url: '/pages/login/index' })
// or
wx.reLaunch({ url: '/pages/index/index' })
```

| Page | Expected behavior |
| --- | --- |
| `pages/login/index` | `.joy-custom-tab-bar` element not found, or `hidden=""` + `display: none` |
| `pages/index/index` (landing) | `.joy-custom-tab-bar` element not found, or `hidden=""` + `display: none` |

If the tab bar is still visible on a non-tab page, the allow-list lookup or the
`_updateVisibility` guard has regressed.

### Step 5 — Interaction sanity

On a tab page:

1. Tap a different tab. The active tab should highlight with a rounded
   background pill.
2. Tap the center button. The side highlight should disappear and the center
   button should show its selected state.
3. Rapidly tap two different side tabs. Only one `wx.switchTab` should fire; the
   second tap is ignored while in-flight.
4. Collapse / expand the bar (e.g., by calling `getTabBar().setCollapsed(true)`
   from a page that supports it). The bar should animate to a collapsed state,
   the announcement text should read `标签栏已收起`, and the bar should expand
   again with `setCollapsed(false)`.
5. Toggle the device network to **offline** and tap a tab. The bar should remain
   responsive because tab switches are local; `syncState` calls should be queued
   and replayed when the network returns.

---

## Real-device sanity check

DevTools rendering is close but not identical to a real WeChat runtime. After a
change that touches tab-bar visibility, also verify on a physical device:

1. Generate a preview build:

   ```bash
   cd apps/mini-program
   /Applications/wechatwebdevtools.app/Contents/MacOS/cli \
     auto-preview --project $(pwd)
   ```

2. Scan the QR code with WeChat.
3. Confirm the tab bar appears on 发现 / 足迹 / 连接 / 我的 / 中心入口.
4. Navigate to a non-tab page (e.g., via a share link or temporary compile mode)
   and confirm the tab bar is not visible.

---

## Pass criteria

The smoke passes only when **all** of the following are true:

1. `tabBarBehavior.test.ts` passes.
2. `npm run typecheck -w mini-program` passes.
3. `npm run build:weapp -w mini-program` succeeds.
4. DevTools computed `display` is `block` and `hidden` is absent on all five tab
   pages.
5. DevTools shows the tab bar hidden or not attached on at least one non-tab
   page (e.g., `pages/login/index`).
6. Tab taps and center-button taps animate and switch correctly.
7. Collapse / expand and screen-reader announcements update `data.announcement`.
8. No console errors from the tab bar component (`check_health` or DevTools
   Console).

---

## Failure signatures

Treat any of the following as a regression:

- Tab bar is invisible on a tab page despite the WXML tree containing the
  component (look for `hidden=""` or `display: none`).
- Tab bar is visible on a non-tab page.
- Active pill does not align with the selected tab after navigation.
- Center button tap does not hide the pill or switch to `pages/center-hub/index`.
- Rapid tab taps queue multiple `wx.switchTab` calls.
- `setCollapsed` leaves the bar in a visually inconsistent state or fails to
  announce the change.
- Offline reconnect does not replay pending `syncState` updates.
- `wx.switchTab` failure does not roll back the optimistic selected index or
  surface a toast.

Common environmental false positives:

- **DevTools cache:** after rebuilding, close and reopen the project before
  inspecting the tab bar.
- **Auth guard redirect:** if the simulator is unauthenticated, tapping a tab
  may land on `pages/login/index`. That is expected auth behavior, not a tab-bar
  bug.
- **Stale `dist/`:** always run `npm run build:weapp -w mini-program` before the
  smoke.

---

## Related code surfaces

- Active component: `apps/mini-program/src/native-custom-tab-bar/index.js`
- Component tests: `apps/mini-program/src/native-custom-tab-bar/__tests__/tabBarBehavior.test.ts`
- Allow-list source of truth: `apps/mini-program/src/lib/navigation/tabBarConfig.ts`
- App registration: `apps/mini-program/src/app.config.ts`
- Page sync hook: `apps/mini-program/src/hooks/useCustomTabBarSync.ts`
- Runtime docs: `apps/mini-program/README.md` §Native Custom Tab Bar

---

## See also

- [`mini-program-events-tab-smoke.md`](./mini-program-events-tab-smoke.md) —
  smoke for the canonical Events tab and legacy alias routing.
- [`mini-program-screenshot-workflow` skill](../../.agents/skills/mini-program-screenshot-workflow/SKILL.md) —
  general guidance on visual vs structural verification in WeChat DevTools.
