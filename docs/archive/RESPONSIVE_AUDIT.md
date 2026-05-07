# A. Current Responsive Setup Summary

This audit is MINI_PROGRAM_ONLY. It evaluates the native WeChat Mini Program surface in `apps/mini-program`, not the browser H5 output. The current implementation is mostly portrait-oriented and CSS-driven: Taro is configured with `designWidth: 750`, a custom `deviceRatio` map, and `mini.postcss.pxtransform` in `apps/mini-program/config/index.ts`, while most shared spacing, sizing, and type tokens in `apps/mini-program/src/styles/_variables.scss` are authored in `rpx`.

## Current implementation inventory

### Layout-related config and global style files found

- `apps/mini-program/config/index.ts`
  - Sets `designWidth: 750`.
  - Defines `deviceRatio` entries for `640`, `750`, `375`, and `828`.
  - Enables `mini.postcss.pxtransform`.
- `apps/mini-program/src/app.config.ts`
  - Enables the custom tab bar with `tabBar.custom = true`.
  - Uses default WeChat window navigation bar settings.
  - No page-level `navigationStyle` overrides were found during the scan.
- `apps/mini-program/project.config.json`
  - WeChat project compile settings only; no layout or orientation policy is defined here.
- `project.config.json`
  - Root WeChat project settings; likewise not layout-authoritative for responsive behavior.
- `apps/mini-program/src/app.scss`
  - Sets base `page` typography, background color, and `font-size: 28rpx`.
- `apps/mini-program/src/styles/_variables.scss`
  - Shared design tokens are predominantly `rpx`-based, including spacing, radius, button height, tab bar height, and center tab button geometry.
- `apps/mini-program/src/styles/_mixins.scss`
  - Provides `page-gradient-bg` and a shared `safe-area-bottom` mixin.
- `apps/mini-program/src/custom-tab-bar/index.scss`
  - Taro-side custom tab bar styling with bottom inset awareness.
- `apps/mini-program/src/native-custom-tab-bar/index.wxss`
  - Native WeChat custom tab bar styling mirroring the same bottom-safe-area assumptions.
- `apps/mini-program/src/index.html`
  - Contains a standard H5 viewport meta tag, but no `viewport-fit=cover`.
  - This matters for Taro H5 output, not for native WeChat mini-program rendering.

### Responsive unit strategy in use

- Primary strategy: shared `rpx` tokens and Taro scaling from a `750` design width.
- Secondary strategy: selected `vh`, `vw`, percentages, and `env(safe-area-inset-*)` for edge handling.
- Outlier strategy: `apps/mini-program/src/pages/discover/index.scss` uses a large number of uppercase `PX` values together with `vw` and `vh`.
  - In Taro, uppercase `PX` is commonly used to bypass `pxtransform`, so this screen is likely opting out of the repo's normal responsive scaling path.
  - That makes the guest discover landing page the clearest responsive exception in the current codebase.

### Components and pages currently handling safe-area or device-specific layout concerns

- Shared bottom-safe-area foundation:
  - `apps/mini-program/src/styles/_mixins.scss`
- Shared or reusable fixed-bottom UI:
  - `apps/mini-program/src/custom-tab-bar/index.scss`
  - `apps/mini-program/src/native-custom-tab-bar/index.wxss`
  - `apps/mini-program/src/components/BottomNav.scss`
- Pages using the shared `safe-area-bottom` mixin:
  - `apps/mini-program/src/pages/login/index.scss`
  - `apps/mini-program/src/pages/my-events/index.scss`
  - `apps/mini-program/src/pages/chats/index.scss`
  - `apps/mini-program/src/pages/onboarding/_placeholder.scss`
  - `apps/mini-program/src/pages/onboarding/essential-data/index.scss`
  - `apps/mini-program/src/pages/onboarding/extended-data/index.scss`
- Pages with direct bottom inset handling instead of the mixin:
  - `apps/mini-program/src/pages/center-tab-empty/index.scss`
  - `apps/mini-program/src/pages/blind-box-payment/index.scss`
  - `apps/mini-program/src/pages/payment-verification/index.scss`
  - `apps/mini-program/src/pages/pool-group-detail/index.scss`
  - `apps/mini-program/src/pages/event-coordination/index.scss`
- Pages with explicit top safe-area usage:
  - `apps/mini-program/src/pages/discover/index.scss`
    - This is the only scanned file using `env(safe-area-inset-top)` directly.
- Components with device-sensitive fixed positioning but no explicit top-safe-area compensation:
  - `apps/mini-program/src/components/AchievementPopup.scss`
  - `apps/mini-program/src/components/ModalOverlay.scss`
  - `apps/mini-program/src/components/PageLayout.scss`

### Framework-specific interpretation for Taro and WeChat Mini Program

- Because `apps/mini-program/src/app.config.ts` keeps the default WeChat navigation bar, top safe-area handling is partially delegated to system chrome on standard pages.
- That does not protect fixed overlays, popups, or custom full-screen compositions that manually pin content to the top edge.
- `apps/mini-program/src/index.html` is not authoritative for the native mini-program runtime. The missing `viewport-fit=cover` should not be treated as the root cause of native WeChat notch issues.
- No runtime JS or TS device metric usage was found in `apps/mini-program/src` for `getSystemInfo`, `getWindowInfo`, `statusBarHeight`, `menuButtonBoundingClientRect`, or `safeArea`.
- No `page-meta` or `root-portal` usage was found.
- No page orientation settings were found. Current behavior should be treated as portrait-only by default. Orientation handling becomes important only if landscape is ever enabled later.

### Strengths in the current setup

- The main token system is already `rpx`-based and aligned to a single design width.
- Bottom safe-area handling exists in a reusable mixin and is already applied across multiple pages.
- The custom tab bar is at least aware of the home-indicator bottom inset in both Taro SCSS and native WXSS.
- Default system navigation reduces the amount of custom top chrome that must be maintained across devices.

### Gaps in the current setup

- Safe-area handling is heavily bottom-biased; top inset coverage is not generalized.
- Several layouts rely on `100vh`, fixed spacers, or fixed overlays, which are the patterns most likely to drift across WeChat viewport changes, keyboards, and tall-aspect devices.
- There is no runtime metric layer to normalize device differences for Huawei punch-hole devices, iPhone notch and Dynamic Island devices, or Android variations in usable window height.
- The guest discover landing screen is a substantial responsive outlier because it mixes `vh`, `vw`, fixed geometry, and many escaped `PX` values.

# B. Issue Matrix by Device Category

Device emphasis from the current codebase:

- Huawei phones are most exposed where the layout depends on top edge assumptions, fixed-height shells, or bottom-only safe-area handling.
- iPhones with a notch or Dynamic Island are mostly protected at the bottom, but fixed-top and overlay surfaces remain vulnerable.
- General Android devices are most exposed to `100vh` and sheet-height behavior when the keyboard or usable window height changes.
- Small legacy devices are most exposed to hardcoded geometry, large reserved footer space, and escaped `PX` values that do not scale with the rest of the design system.

| Issue | File(s) | Affected Devices | Severity | Recommended Fix |
| --- | --- | --- | --- | --- |
| Guest discover landing bypasses the normal tokenized scaling model with heavy uppercase `PX`, `vh`, `vw`, `max-width: 384PX`, and `overflow: hidden` | `apps/mini-program/src/pages/discover/index.scss` | Huawei phones with tall aspect ratios, iPhone Pro Max and Dynamic Island devices, general Android, small legacy devices | High | Rebuild this screen around shared `rpx` tokens, flex layout, and scroll-safe content flow; remove escaped `PX` except where a true physical pixel is intentional. |
| Viewport-height-locked shells rely on `height: 100vh` or `min-height: 100vh`, which is brittle in WeChat when the usable window height changes | `apps/mini-program/src/pages/discover/index.scss`, `apps/mini-program/src/pages/event-coordination/index.scss`, `apps/mini-program/src/components/PageLayout.scss`, `apps/mini-program/src/pages/login/index.scss`, `apps/mini-program/src/pages/onboarding/extended-data/index.scss` | Huawei, general Android, iPhone notch and Dynamic Island devices, small legacy devices | High | Prefer flex-column shells with internal scroll regions; use runtime window metrics only where fixed viewport math is unavoidable. |
| Top-fixed surfaces do not have a shared top-safe-area strategy | `apps/mini-program/src/components/AchievementPopup.scss`, `apps/mini-program/src/pages/event-coordination/index.scss`, `apps/mini-program/src/components/ModalOverlay.scss` | iPhone X-class notch devices, iPhone 14 Pro and 15 Pro Dynamic Island devices, Huawei punch-hole phones, tall Android status-bar variants | High | Add a shared top inset utility or a small runtime metrics layer for top-edge surfaces, then migrate popups, sheets, and fixed headers to it. |
| Full-screen overlays and bottom sheets are bottom-inset aware but not fully normalized for top inset, internal scroll, or actual usable window height | `apps/mini-program/src/components/ModalOverlay.scss`, `apps/mini-program/src/pages/event-coordination/index.scss` | iPhone notch and Dynamic Island devices, Huawei punch-hole phones, general Android | Medium-High | Create a shared overlay and sheet shell with top and bottom padding, window-height-aware max height, and an internal scroll container. |
| Custom tab bar and bottom nav account for bottom inset only and use fixed center-button geometry with no horizontal safe-area strategy | `apps/mini-program/src/custom-tab-bar/index.scss`, `apps/mini-program/src/native-custom-tab-bar/index.wxss`, `apps/mini-program/src/components/BottomNav.scss` | iPhones with home indicator, Huawei curved-edge devices, narrow Android phones, small legacy devices | Medium | Add shared inline padding rules and width-class adjustments for center-button geometry; ensure the horizontal footprint remains safe on narrow screens. |
| Several pages reserve footer space with one-off hardcoded values instead of a single footer or tab-bar contract | `apps/mini-program/src/pages/onboarding/extended-data/index.scss`, `apps/mini-program/src/pages/center-tab-empty/index.scss`, `apps/mini-program/src/pages/pool-group-detail/index.scss`, `apps/mini-program/src/pages/blind-box-payment/index.scss`, `apps/mini-program/src/pages/payment-verification/index.scss` | Small legacy devices, large iPhones, Huawei phones, general Android | Medium | Replace per-page spacer math with a shared footer reserve mixin or layout utility derived from the actual fixed footer or tab bar height. |
| Responsive behavior is almost entirely CSS-driven; there is no runtime metric service for status bar, capsule, safe area rect, or window height | `apps/mini-program/src/styles/_mixins.scss`, `apps/mini-program/src/app.config.ts` and the absence of any metric utility under `apps/mini-program/src` | Huawei phones, iPhone notch and Dynamic Island devices, general Android | Medium-High | Introduce a small Taro-native metrics utility using `Taro.getWindowInfo()` with fallback handling, and use it only on layouts that need device-aware precision. |
| Orientation handling is implicit rather than explicit; there is no current landscape policy | `apps/mini-program/src/app.config.ts`, `apps/mini-program/project.config.json`, `project.config.json` | Landscape-only cases, foldables, tablets, rotated phones if the product later enables them | Low now, High if landscape is enabled later | Document portrait-only as the current contract; if landscape is ever enabled, treat it as a separate responsive project with its own QA matrix. |

# C. Quick Wins (Low Effort, High Impact)

- Add `safe-area-top` and `safe-area-inline` mixins beside the existing `safe-area-bottom` mixin in `apps/mini-program/src/styles/_mixins.scss`.
- Normalize `apps/mini-program/src/components/AchievementPopup.scss` so its `top: 24rpx` becomes top-safe-area aware instead of assuming a flat status bar.
- Wrap `apps/mini-program/src/components/ModalOverlay.scss` in a shared overlay shell that adds top and bottom padding and an internal content scroller.
- Refactor the guest state in `apps/mini-program/src/pages/discover/index.scss` first. It is the biggest responsive outlier and will remove the highest concentration of escaped `PX` values in one pass.
- Replace `height: 100vh` with `min-height: 100vh` plus flex scrolling where possible, especially in `apps/mini-program/src/pages/event-coordination/index.scss` and `apps/mini-program/src/pages/discover/index.scss`.
- Consolidate footer reserve logic used by onboarding, payment, and empty-state pages into one shared utility so future responsive fixes happen in one place.
- Add a lightweight grep-based review check for new uppercase `PX`, new `100vh`, and new top-fixed surfaces without safe-area protection in `apps/mini-program/src`.

# D. Implementation Plan (If Major Refactor Needed)

1. Establish a target device matrix before changing layouts.
   - Minimum matrix for this repo: iPhone SE class, iPhone X or 11 Pro notch class, iPhone 14 Pro or 15 Pro Dynamic Island class, large iPhone Pro Max class, a Huawei punch-hole device profile, a generic 360x800 Android profile, and a smaller 320 to 360 width legacy Android profile.
   - Use WeChat DevTools for quick iteration, but confirm final results on at least one real iPhone and one real Android or Huawei-class device.

2. Add a responsive foundation layer that matches Taro and WeChat constraints.
   - Keep `rpx` as the default unit system.
   - Add shared Sass helpers for top safe area, inline safe area, fixed-footer reserve, and overlay sheet padding.
   - If CSS alone is not enough, add a small metrics utility based on `Taro.getWindowInfo()` with a safe fallback path. Do not introduce browser-only viewport fixes such as `dvh` or `svh` as the primary strategy for the mini-program runtime.

3. Normalize shared containers before page-by-page cleanup.
   - Update `apps/mini-program/src/components/PageLayout.scss` so it becomes the standard full-height shell.
   - Normalize `apps/mini-program/src/components/BottomNav.scss`, `apps/mini-program/src/custom-tab-bar/index.scss`, and `apps/mini-program/src/native-custom-tab-bar/index.wxss` to share the same bottom and horizontal inset assumptions.
   - Update `apps/mini-program/src/components/ModalOverlay.scss` and `apps/mini-program/src/components/AchievementPopup.scss` so fixed surfaces stop managing edge spacing ad hoc.

4. Tackle the highest-risk page first: the guest discover landing state.
   - Replace escaped `PX` values with shared `rpx` tokens or proportional layout rules.
   - Remove `height: 100vh` plus `overflow: hidden` unless the screen truly cannot scroll.
   - Convert hero card geometry to a more scalable layout that does not depend on `46vw`, `30vw`, `40vw`, and hard `PX` caps simultaneously.
   - Re-test this page on narrow Android widths and large iPhone widths before moving on.

5. Refactor live and overlay-heavy surfaces next.
   - Update `apps/mini-program/src/pages/event-coordination/index.scss` so the message area owns scroll, the input bar remains safe above the home indicator, and modal sheets use top and bottom inset protection.
   - Ensure any overlay max height is based on actual usable window height if the CSS-only approach still clips content in WeChat.

6. Unify fixed-footer pages under one contract.
   - Bring `apps/mini-program/src/pages/onboarding/extended-data/index.scss`, `apps/mini-program/src/pages/onboarding/essential-data/index.scss`, `apps/mini-program/src/pages/blind-box-payment/index.scss`, `apps/mini-program/src/pages/payment-verification/index.scss`, `apps/mini-program/src/pages/center-tab-empty/index.scss`, and `apps/mini-program/src/pages/pool-group-detail/index.scss` onto the same footer-reserve pattern.
   - Remove page-specific magic numbers like `200rpx`, `220rpx`, and duplicated bottom padding formulas where the same fixed-bottom contract is intended.

7. Add regression guardrails after the main cleanup.
   - Add a small audit script or CI grep that flags new uppercase `PX` in mini-program styles.
   - Flag new `height: 100vh` usages for manual review.
   - Flag new fixed-top or fixed-bottom components that do not use shared safe-area helpers.

8. Validate against concrete acceptance criteria.
   - No top-fixed popup, sheet, or header may overlap the notch, Dynamic Island, punch-hole region, or status bar.
   - No fixed CTA, tab bar, or input bar may sit under the home indicator or WeChat bottom gesture area.
   - No primary page should require clipped content or hidden overflow just to fit on small devices.
   - The guest discover screen should remain visually centered without card overlap or CTA truncation across the target matrix.
   - If the product remains portrait-only, document that explicitly and defer landscape support. If landscape is ever enabled, reopen this audit with a separate landscape QA pass.