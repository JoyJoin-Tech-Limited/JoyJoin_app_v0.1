# Mini-Program Events Tab Smoke Runbook

> **Scope:** Local verification for the mini-program tab-shell cleanup around the
> canonical Events tab (`足迹`) and the legacy `journey` / `my-events` entries.
>
> **Audience:** Frontend engineers and QA validating `apps/mini-program` in
> WeChat DevTools.

---

## What this runbook proves

This smoke is specifically for the MP-3 shell cleanup. It verifies that:

1. The canonical second tab is `pages/events/index`.
2. The visible tab label is `足迹`.
3. The final page header is `我的足迹`.
4. The legacy `pages/journey/index` and `pages/my-events/index` entries both recover into the canonical Events tab instead of behaving like separate destinations.

---

## Deterministic checks to run first

From the repo root:

```bash
npx vitest run apps/mini-program/src/lib/eventsTabRedirect.test.ts apps/mini-program/src/lib/tabBarConfig.test.ts apps/mini-program/src/lib/onboardingRoutes.test.ts apps/mini-program/src/pages/journey/redirect.test.ts
npm run typecheck -w mini-program
npm run build:weapp -w mini-program
```

Expected result:

- All targeted Vitest checks pass.
- Mini-program typecheck passes.
- WeChat build succeeds and refreshes `apps/mini-program/dist`.

These checks validate the route inventory, redirect helper, and tab-shell config. The manual DevTools smoke below is still required to confirm runtime navigation.

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

### Case 2 - Legacy `journey` alias

Goal: confirm the legacy route now behaves only as a redirect shell.

Entry options:

1. Add a temporary compile mode that starts at `/pages/journey/index`.
2. Or, in the AppService console, run:

```javascript
wx.reLaunch({ url: "/pages/journey/index" })
```

Expected result:

- You may briefly see the loading message `正在前往「我的足迹」...`.
- The app lands on the canonical Events destination, not a standalone Journey screen.
- Final route is `pages/events/index`.
- The second tab is selected.
- The header reads `我的足迹`.

### Case 3 - Legacy `my-events` alias

Goal: confirm the older my-events entry now funnels into the same Events tab.

Entry options:

1. Add a temporary compile mode that starts at `/pages/my-events/index`.
2. Or, in the AppService console, run:

```javascript
wx.reLaunch({ url: "/pages/my-events/index" })
```

Expected result:

- You may briefly see the placeholder copy `旧入口已迁移到「足迹」`.
- The app lands on the canonical Events destination.
- Final route is `pages/events/index`.
- The second tab is selected.
- The header reads `我的足迹`.

---

## Pass criteria

Treat the smoke as passed only when all three entry points behave as follows:

| Entry path | Final route | Final header | Tab expectation |
| --- | --- | --- | --- |
| `pages/events/index` | `pages/events/index` | `我的足迹` | second tab selected |
| `pages/journey/index` | `pages/events/index` | `我的足迹` | second tab selected |
| `pages/my-events/index` | `pages/events/index` | `我的足迹` | second tab selected |

---

## Failure signatures

Treat any of the following as a regression:

- `journey` still renders its old standalone timeline UI.
- `my-events` remains a separate destination instead of funneling into Events.
- The final route after either alias is still the alias path instead of `pages/events/index`.
- The selected tab does not move to the second `足迹` slot.
- The final page title is not `我的足迹`.

Operational issues that are not product regressions:

- CLI reports `IDE service port disabled`.
- CLI reports it cannot read the `.ide` port file before the GUI has booted.
- The simulator is unauthenticated and the auth guard sends the resolved Events route to login.

---

## Related code surfaces

- Canonical tab config: `apps/mini-program/src/lib/tabBarConfig.ts`
- Events page: `apps/mini-program/src/pages/events/index.tsx`
- Shared legacy redirect helper: `apps/mini-program/src/lib/eventsTabRedirect.ts`
- Journey alias shell: `apps/mini-program/src/pages/journey/index.tsx`
- My-events alias shell: `apps/mini-program/src/pages/my-events/index.tsx`
