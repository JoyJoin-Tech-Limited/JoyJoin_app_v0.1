# Mini-Program Events Tab Smoke Runbook

> **Scope:** Local verification for the mini-program tab shell around the
> canonical Events tab (`足迹`). The legacy `journey` and `my-events` alias
> pages were removed on 2026-11-03; no legacy-entry smoke remains.
>
> **Audience:** Frontend engineers and QA validating `apps/mini-program` in
> WeChat DevTools.
>
> **Companion runbook:** For the general native custom tab-bar visibility smoke
> (checking that the bar renders on all tab pages and hides on non-tab pages),
> see [`mini-program-tab-bar-smoke.md`](./mini-program-tab-bar-smoke.md). That
> runbook also documents the correct DevTools verification technique: verify the
> **computed `display` and outer `hidden` attribute**, not just the WXML tree.

---

## What this runbook proves

This smoke is specifically for the MP-3 shell cleanup. It verifies that:

1. The canonical second tab is `pages/events/index`.
2. The visible tab label is `足迹`.
3. The final page header is `我的足迹`.

---

## Deterministic checks to run first

From the repo root:

```bash
npx vitest run apps/mini-program/src/lib/navigation/tabBarConfig.test.ts apps/mini-program/src/lib/onboarding/onboardingRoutes.test.ts
npm run typecheck -w mini-program
npm run build:weapp -w mini-program
```

Expected result:

- All targeted Vitest checks pass.
- Mini-program typecheck passes.
- WeChat build succeeds and refreshes `apps/mini-program/dist`.

These checks validate the route inventory and tab-shell config. The manual DevTools smoke below is still required to confirm runtime navigation.

> **Visual verification note:** When confirming the tab bar appears for the
> Events tab, follow the method in [`mini-program-tab-bar-smoke.md`](./mini-program-tab-bar-smoke.md):
> select the `.joy-custom-tab-bar` root in DevTools and confirm `hidden` is
> absent and computed `display` is `block`. The WXML tree alone can show the
> component while `hidden=""` makes it invisible.

---

## Preconditions

1. Open the project at `apps/mini-program`, not the repo root.
2. Build before opening DevTools. `apps/mini-program/project.config.json` points `miniprogramRoot` at `dist/`, so stale output means stale verification.
3. Use a test account that is already authenticated and past onboarding if you want to confirm the final Events UI directly.
4. If you are only checking redirect wiring and are not logged in, expect the auth guard to send the app to login after the Events tab resolves. That is not a redirect-helper failure, but it does not confirm the final tab UI either.

---

## Open the project in WeChat DevTools

### Manual path

1. Launch WeChat DevTools.
2. Open the project folder `apps/mini-program`.
3. Wait for compilation to finish.
4. Log in with a test account if the simulator is not already authenticated.

### CLI-assisted path

After the GUI has been opened at least once:

```bash
"/Applications/wechatwebdevtools.app/Contents/MacOS/cli" open --project /Users/vincentlai/GitHub/JoyJoin_app_v0.1/apps/mini-program --lang en
```

If the CLI reports `IDE service port disabled`, open DevTools manually and turn on `Settings -> Security Settings -> Service Port`.

If the CLI reports that it cannot read the `.ide` port file, boot the GUI once, confirm the project opens successfully, then retry the CLI command.

Local macOS note:

- `cli open` succeeded after one GUI boot plus Service Port enablement.
- `cli auto --project ... --auto-port 9420` also exposed a dedicated automation socket.
- Full scripted route inspection via `miniprogram-automator` remained unstable locally because the websocket closed during runtime inspection, so manual UI confirmation remains the release gate for this smoke.

---

## Manual smoke cases

### Case 1 - Canonical Events tab

Goal: confirm the visible second tab is the canonical Events destination.

Entry:

1. In the bottom tab bar, tap `足迹`.

Expected result:

- The current page resolves to `pages/events/index`.
- The second tab is selected.
- The page title reads `我的足迹`.
- The content area shows the normal Events page, not a redirect placeholder.

### Case 2 - Events empty and error states

Goal: confirm the Events tab renders branded empty/error surfaces when appropriate.

Entry:

1. Use a test account with **zero joined events** (or mock the `joined-events` query to return `[]`).
2. Tap `足迹`.

Expected result:

- The page shows the `StatusCard` empty state with the Xiaoyue `coachGuide` mascot hero illustration.
- The title and description use warm copy.
- A primary action CTA is visible (e.g., `去发现`).

Entry (error):

1. Force the `GET /api/shell/events` and fallback `/api/events/joined` calls to fail (e.g., block the request in DevTools Network or temporarily return 500 from a local route).
2. Tap `足迹` or pull-to-refresh.

Expected result:

- The page shows `XiaoyueEmptyState` with `emotion='sad'`, an error title/subtitle, and a retry CTA.
- Tapping retry re-fetches the events list.

### Case 3 - Deleted legacy entries

Goal: confirm the removed `pages/journey` and `pages/my-events` aliases are not
restored as active flows.

Entry check:

- Do not launch either removed route in the current release.
- In WeChat DevTools, attempting `wx.reLaunch({ url: "/pages/my-events/index" })`
  or the deleted `journey` route should report the route/page as unavailable.
- A restored funnel into `pages/events/index` would mean the deleted alias page
  came back and must be investigated.

---

## Pass criteria

Treat the smoke as passed only when the canonical entry point behaves as follows:

| Entry path | Final route | Final header | Tab expectation |
| --- | --- | --- | --- |
| `pages/events/index` | `pages/events/index` | `我的足迹` | second tab selected; tab bar visible (`display: block`, no `hidden`) |

The removed `pages/journey` and `pages/my-events` routes are expected to be
unavailable; do not mark their unavailability as a smoke failure.

---

## Failure signatures

Treat any of the following as a regression:

- `pages/journey` or `pages/my-events` is restored as a routable mini-program page.
- The Events tab no longer lands on `pages/events/index`.
- The selected tab does not move to the second `足迹` slot.
- The final page title is not `我的足迹`.
- The tab bar is present in the WXML tree but invisible (`display: none` or
  `hidden=""`) on the Events tab — this is a tab-bar visibility regression, not
  an Events routing regression; debug with
  [`mini-program-tab-bar-smoke.md`](./mini-program-tab-bar-smoke.md).

Operational issues that are not product regressions:

- CLI reports `IDE service port disabled`.
- CLI reports it cannot read the `.ide` port file before the GUI has booted.
- The simulator is unauthenticated and the auth guard sends the resolved Events route to login.

---

## Related code surfaces

- Canonical tab config: `apps/mini-program/src/lib/navigation/tabBarConfig.ts`
- Events page: `apps/mini-program/src/pages/events/index.tsx`
- `pages/my-events/index` and `pages/journey/index` — **removed on 2026-11-03** (no longer registered in onboardingRoutes)
