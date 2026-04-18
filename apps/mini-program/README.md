# Mini-Program Workspace

This workspace contains JoyJoin's Taro + React WeChat Mini Program client.

## Launch status

**This is the launch-primary client** for the current execution track: production WeChat users ship here first. `apps/user-client` remains the web sandbox and parity reference; any change that touches auth, payments, or shared contracts should follow [`docs/PLATFORM_COORDINATION.md`](../../docs/PLATFORM_COORDINATION.md) and [`.github/skills/platform-coordination-protocol/SKILL.md`](../../.github/skills/platform-coordination-protocol/SKILL.md). Visual and interaction quality bar: [`.github/skills/mini-program-frontend-excellence/SKILL.md`](../../.github/skills/mini-program-frontend-excellence/SKILL.md) (including `references/pixel-precision.md`).

## Source-of-truth entry points

- `apps/mini-program/src/app.ts` — app lifecycle entry
- `apps/mini-program/src/app.config.ts` — consumes main package pages, subpackages, and `preloadRule` from `lib/onboardingRoutes.ts` + tab config from `lib/tabBarConfig.ts`
- `apps/mini-program/src/lib/onboardingRoutes.ts` — **register new pages here** (main package list, onboarding subpackage under `pages/onboarding`, preload rules)
- `apps/mini-program/src/lib/api.ts` — mini-program auth/API bootstrap surface (`authenticateMiniProgramUser`, `authenticateMiniProgramUserWithTest`, `getUserState`)
- `apps/mini-program/src/pages/onboarding/personality-test/` — V4 personality test, results, and post-result auth gate (same assessment APIs as web)
- `apps/mini-program/src/pages/login/index.tsx` + `src/hooks/useWeChatLogin.ts` — **returning-user** WeChat login (`POST /api/auth/wechat/login`)
- `apps/mini-program/src/pages/blind-box-payment/`, `src/pages/payment-verification/` — JSAPI payment + post-pay polling; helpers in `src/lib/paymentEntry.ts`, `paymentPendingOrder.ts`, `paymentPendingOrderStorage.ts`
- `docs/PLATFORM_COORDINATION.md` — canonical coordination playbook for duplicated auth, API, and payment flows
- [`../../docs/mini-program-data-fetching.md`](../../docs/mini-program-data-fetching.md) — React Query key conventions (`['mini-program', …]`) for pool registration, group detail, and matching surfaces

## Coordination rules

- Treat the mini-program as the strongest current reference for payment mechanics.
- Before changing auth/session, API wrapper behavior, or payment flow here, review the matching web surface in `apps/user-client` and the guidance in [`../../docs/PLATFORM_COORDINATION.md`](../../docs/PLATFORM_COORDINATION.md).
- Keep mini-program runtime wiring here, but move genuinely shared contracts toward `packages/shared/src/`.

## Visual QA and pixel discipline

- Canonical rules (spec-exact vs **8rpx** rhythm, **WeChat DevTools** pre-merge gate, reviewer expectations): [`.github/skills/mini-program-frontend-excellence/references/pixel-precision.md`](../../.github/skills/mini-program-frontend-excellence/references/pixel-precision.md).
- Durable backlog for optional automation (PR template, narrow style tests): [`repo-memory/candidates/mini-program-visual-qa-wechat-devtools-ci-gap.md`](../../repo-memory/candidates/mini-program-visual-qa-wechat-devtools-ci-gap.md).

## Package Loading Strategy

- Keep tabBar pages in the main package.
- Move heavy non-tab flows into ordinary subpackages first.
- Add `preloadRule` from likely entry pages before reaching for more complex package modes.
- Do not reject independent subpackages categorically, but only propose them when benchmarks show a material first-open or launch win after ordinary splitting, preload, and asset cleanup.
- Any independent-subpackage proposal must include a self-contained bootstrap plan because `src/app.ts` and `src/providers/AuthProvider.tsx` currently centralize app-level providers and auth/query setup.
- Async loading can help defer code paths, but it does not remove WeChat package-boundary rules.

## Native Custom Tab Bar

The shipped mini-program tab bar is the native WeChat component copied from `src/native-custom-tab-bar/` to `dist/custom-tab-bar/` during build. The Taro JSX implementation in `src/custom-tab-bar/` is not the active runtime path.

### Source-of-truth files

- `apps/mini-program/src/app.config.ts` — `tabBar.custom` ownership plus tab list
- `apps/mini-program/config/index.ts` — build copy from `src/native-custom-tab-bar/` to `dist/custom-tab-bar/`
- `apps/mini-program/src/native-custom-tab-bar/` — active WXML/WXSS/JS runtime
- `apps/mini-program/src/hooks/useCustomTabBarSync.ts` — per-page selected-state and center-CTA sync

### Renderer and layering rules

- For `custom-tab-bar` specifically, WeChat docs still recommend `cover-view` plus `cover-image` with bottom-fixed positioning. Do not generalize that recommendation to ordinary page overlays.
- Keep the native tab bar tree within `cover-view` nesting rules: only `cover-view`, `cover-image`, and `button`.
- The outermost `cover-view` may use `position: fixed` and `z-index`; keep the root bar fixed to the bottom when changing layout.
- Same-layer rendering reduces many historical native-component stacking issues, but it does not remove the specialized `custom-tab-bar` guidance or the need to test against bottom-page content.
- `textarea` and `input` interactions near the bottom of the screen still require device verification.

### Styling caveats

- Treat shadows, gradients, and overflow-based protrusions as compatibility-sensitive, not guaranteed cross-renderer primitives.
- The current center CTA uses shadow, gradient, and negative-offset geometry to create the floating circular look. Keep that design only if you are willing to verify it on target devices after every visual change.
- If you need maximum compatibility, prefer simple filled shapes, internal spacing, and non-overflowing geometry over decorative effects.

### State and instance model

- Each tab page gets its own custom-tab-bar instance; selection state is not a global singleton.
- Keep selected-index and center CTA updates page-driven through `useCustomTabBarSync`.
- If `getTabBar` lookup or instance shape changes, update both the page hook and the native component contract together.

### Skyline caveat

- Current local dev config keeps Skyline disabled by default.
- If Skyline is enabled later, re-validate root positioning, pointer events, and tab-bar instance lookup against the active WeChat docs before assuming the current implementation still works unchanged.

### Change checklist

1. Keep `tabBar.custom: true` and the full tab list in `src/app.config.ts`.
2. Keep the active runtime under `src/native-custom-tab-bar/` when the change depends on WeChat-specific layering behavior.
3. Do not add non-`cover-*` children to the native tab bar tree.
4. When changing the center button shape or height, test the protruding geometry on real devices because overflow-style layouts are the least stable part of the implementation.
5. After changing selection or badge logic, verify every tab page re-synchronizes through `useCustomTabBarSync`.
6. After enabling Skyline or changing renderer assumptions, re-check `getTabBar` behavior before shipping.

## Where new files go

- **New mini-program page:** `apps/mini-program/src/pages/`
- **Mini-program runtime helpers:** `apps/mini-program/src/lib/`
- **App-level registration/config:** `apps/mini-program/src/app.ts` and `apps/mini-program/src/app.config.ts`
- **Shared contracts/constants:** `packages/shared/src/`

## Common commands

```bash
npm run build:weapp --workspace=mini-program
npm run dev:weapp --workspace=mini-program
```

## Cold-entry timing probe

Use the repo-root probe when you need repeatable DevTools-based timing for mini-program cold entry and onboarding preload checks.

```bash
bash scripts/measure-mini-program-cold-entry.sh
```

Optional overrides are available via environment variables, for example:

```bash
SAMPLES=7 PRELOAD_SETTLE_MS=2000 bash scripts/measure-mini-program-cold-entry.sh
```

The script installs `miniprogram-automator` only in a temporary directory, emits JSON with per-sample and summary stats, and treats `login -> personality-test` as a preload proxy rather than a full WeChat auth benchmark. It also exits early if WeChat DevTools CLI is not logged in.

## Group analysis debug (WP4)

For **matched** flows, `GET /api/pool-groups/:groupId/analysis` returns `fromCache` and `generatedAt`. To help QA trust the pipeline without exposing noise to all users:

- **Local `dev:weapp`:** a subtle line (**调试 · 桌友分析 实时生成** or **缓存**, plus a short timestamp) appears under the AI group-analysis blocks on **matching status** (chemistry card), **squad unboxing** (“这桌的整体氛围”), and **pool group detail** (“AI · 这桌氛围”).
- **Production WeChat releases:** that line is **off** unless you opt in at build time.
- **Beta / internal preview:** set `TARO_APP_SHOW_GROUP_ANALYSIS_DEBUG=1` in the environment when running `npm run build:weapp --workspace=mini-program` so preview builds show the same hint.

## Manual QA — AI surfaces (WP4)

Use this as a quick checklist before shipping AI-touched MP work; the same matrix lives in [`docs/runbooks/mini-program-ai-smoke.md`](../../docs/runbooks/mini-program-ai-smoke.md).

| Check | Where |
|-------|--------|
| Profile tagline | Onboarding → profile review |
| Pool detail AI card | Matched user → pool group detail page |
| Theme after match / WS | Matching status after match + theme reveal |
| Group analysis copy | Matching status, squad unboxing, pool group detail |
| Social icebreaker | Host: warmup topics → phase advance |

## Related docs

- [`../../docs/PLATFORM_COORDINATION.md`](../../docs/PLATFORM_COORDINATION.md)
- [`../../docs/perf.md`](../../docs/perf.md)
- [`../../docs/wechat-mini-program-reference.md`](../../docs/wechat-mini-program-reference.md)
- [`../../.github/skills/platform-coordination-protocol/SKILL.md`](../../.github/skills/platform-coordination-protocol/SKILL.md)
