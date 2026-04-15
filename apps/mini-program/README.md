# Mini-Program Workspace

This workspace contains JoyJoin's Taro + React WeChat Mini Program client.

## Source-of-truth entry points

- `apps/mini-program/src/app.ts` — app lifecycle entry
- `apps/mini-program/src/app.config.ts` — route and page registration
- `apps/mini-program/src/lib/api.ts` — mini-program auth/API bootstrap surface
- `docs/PLATFORM_COORDINATION.md` — canonical coordination playbook for duplicated auth, API, and payment flows

## Coordination rules

- Treat the mini-program as the strongest current reference for payment mechanics.
- Before changing auth/session, API wrapper behavior, or payment flow here, review the matching web surface in `apps/user-client` and the guidance in [`../../docs/PLATFORM_COORDINATION.md`](../../docs/PLATFORM_COORDINATION.md).
- Keep mini-program runtime wiring here, but move genuinely shared contracts toward `packages/shared/src/`.

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

## Related docs

- [`../../docs/PLATFORM_COORDINATION.md`](../../docs/PLATFORM_COORDINATION.md)
- [`../../docs/perf.md`](../../docs/perf.md)
- [`../../docs/wechat-mini-program-reference.md`](../../docs/wechat-mini-program-reference.md)
- [`../../.github/skills/platform-coordination-protocol/SKILL.md`](../../.github/skills/platform-coordination-protocol/SKILL.md)
