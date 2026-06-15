# Mini-Program Workspace

This workspace contains JoyJoin's Taro + React WeChat Mini Program client.

> **Launch status:** This is the **launch-primary client** for the current execution track. Production WeChat users ship here first. `apps/user-client` remains the web sandbox and parity reference.

---

## Quick Reference

| | |
|---|---|
| **Platform** | WeChat Mini Program (`weapp`) |
| **Framework** | Taro 4.2.0 + React 18 |
| **Language** | TypeScript 5.4+ (strict, ESM) |
| **Styling** | Sass / SCSS (custom token system) |
| **State** | TanStack React Query v5 |
| **Build** | Vite 4 (via `@tarojs/vite-runner`) |
| **Test** | Vitest (Node environment) |

---

## Source-of-Truth Entry Points

- `src/app.ts` — app lifecycle entry (launch, providers, `AutoLoginBridge` for silent returning-user re-auth, pending-order resume bridge)
- `src/app.config.ts` — consumes main package pages, subpackages, and `preloadRule` from `lib/onboarding/onboardingRoutes.ts` + tab config from `lib/navigation/tabBarConfig.ts`
- `src/lib/onboarding/onboardingRoutes.ts` — **register new pages here** (main package list, subpackages under `pages/onboarding`, `pages/pool-registration`, etc., preload rules)
- `src/lib/api/api.ts` — mini-program auth/API bootstrap surface (`authenticateMiniProgramUser`, `authenticateMiniProgramUserWithTest`, `getUserState`)
- `src/pages/onboarding/personality-test/` — V4 personality test, results, and post-result auth gate
- `src/pages/login/index.tsx` + `src/hooks/auth/useWeChatLogin.ts` — returning-user WeChat login
- `src/pages/blind-box-payment/`, `src/pages/payment-verification/` — JSAPI payment + post-pay polling
- `src/components/HeroPromoBanner.tsx` — top-of-discover hero promo banner (full-bleed Lovart illustration + glass copy panel + breathing CTA + 5 sparkles). Kill switch via `user.features.promoBannerEnabled` (env `PROMO_BANNER_ENABLED`)

---

## Project Structure

```
src/
├── pages/               # Mini-program pages (one folder per route)
│   ├── discover/        # Tab 0: "发现" — event pool discovery feed
│   ├── events/          # Tab 1: "足迹" — user's event history
│   ├── connections/     # Tab 2: "连接" — matched group & social connections
│   ├── profile/         # Tab 3: "我的" — user profile & settings
│   ├── center-hub/      # Tab 4 (center): "进行中" — dynamic hub for active events, pending registrations, and empty state
│   ├── index/           # Landing / splash page (cold entry). Renders `AutoLoginBridge` silent re-auth; unified redirect effect routes authenticated users → `nextStep` and guests with incomplete anonymous assessment → personality test. Continue-mode CTA shows context-aware labels (`进入发现页` / `继续完善档案` / `继续完成测试`). Returning authenticated users with `nextStep='discover'` route to the Discover tab. `useResetOnShow` clears the navigation loading state on swipe-back/foreground so the CTA never stays stuck on the ellipsis spinner. 5s navigation safety timeout prevents stuck CTA on subpackage download hang.
│   ├── login/           # WeChat login entry for returning users
│   ├── onboarding/      # Subpackage: onboarding flow
│   ├── pool-registration/  # Subpackage: pool sign-up flow (assets live here)
│   ├── blind-box-payment/
│   ├── payment-verification/
│   ├── event-detail/
│   ├── event-feedback/
│   ├── pool-registration/
│   ├── matching-status/
│   ├── squad-unboxing/
│   ├── pool-group-detail/
│   ├── icebreaker-session/
│   ├── edit-profile/
│   ├── rewards/
│   ├── invite/
│   └── terms/
├── components/          # Shared UI components & primitives
│   ├── ui/              # BrandLogo, Button, Card, StatusCard, JoyJoinIcon, Chip, SegmentedProgress, TraitRadarChart, etc.
│   ├── profile/         # Profile-specific components (ProfileArchetypeHero, InterestChipCloud, ProfessionDisplayField)
│   ├── landing/         # Landing-page-specific components (BondingCloud)
│   ├── mascot/          # XiaoyueSpriteAnimator, XiaoyueChatBubble, XiaoyueEmptyState, etc.
│   ├── discover/        # Discover feed components (OracleCard, CompatibilityIndicator, EcosystemBar)
│   └── ContentBlockedError.tsx  # Inline field error for sensitive-word violations; field-aware hints, tap-to-dismiss, haptics, aria-live, reduced-motion. Used in edit-profile and onboarding essential-data forms.
├── hooks/               # Custom React hooks
│   ├── useStaggerMount.ts   # Single RAF mount trigger for CSS-staggered entrances
│   ├── useResetOnShow.ts    # Resets transient navigation/submit flags on page re-show (swipe-back safety)
│   ├── useUnload.ts         # Page unload lifecycle cleanup (timer leaks, refs, subscriptions)
│   ├── useDeviceTier.ts     # Runtime device-capability tiering; Android uses benchmarkLevel, iOS falls back to model/system heuristics
├── lib/                 # Runtime helpers & business logic
├── providers/           # App-level React context providers
├── assets/              # Static assets (copied to dist/assets)
├── styles/              # Global Sass token system
│   ├── _variables.scss      # Color, spacing, typography tokens (includes $color-text-primary-warm)
│   ├── _stagger.scss        # Stagger entrance animation utilities (.stagger-in, .stagger-in--N)
│   └── colors.ts            # TypeScript brand color constants for JS consumption
├── native-custom-tab-bar/  # ACTIVE native WeChat tab bar (WXML/WXSS/JS)
├── app.ts               # App lifecycle entry
├── app.config.ts        # App config: pages, subpackages, tabBar, preloadRule
└── app.scss             # Global styles
```

---

## Build & Development Commands

```bash
# Development
npm run dev:weapp --workspace=mini-program

# Production build (WeChat)
npm run build:weapp --workspace=mini-program

# Type checking
npm run typecheck --workspace=mini-program

# Testing (Vitest)
npm run test --workspace=mini-program
```

### Asset pipeline scripts

Assets are **CDN-first** in production, with a curated set of critical assets bundled locally for instant display and offline resilience. The build inlines `TARO_APP_CDN_BASE_URL` from `apps/mini-program/.env.local`.

**Critical rules:**
1. Use `cdnAsset('/assets/...')` for CDN assets and `localAsset('/assets/...')` for bundled assets — never hardcode `/assets/` paths.
2. Production builds **fail** if `TARO_APP_CDN_BASE_URL` is missing.
3. Run `npm run validate:assets` before committing to catch orphan references.
4. Add new CDN assets to `src/assets/` **and** `scripts/cdn-asset-manifest.json` so the CDN uploader discovers them.
5. Run `npm run check:package-size` after build to verify the compressed main package stays under the 2MB WeChat limit.

| Script | Purpose |
|--------|---------|
| `npm run validate:assets` | Build-time validator: every asset reference must resolve to `src/assets/` or `cdn-asset-manifest.json` |
| `npm run optimize:xiaoyue` | Generate Xiaoyue expression WebPs and intro animated/static fallbacks into `src/assets/personality/xiaoyue/` |
| `npm run check:xiaoyue-assets` | Validate Xiaoyue asset sizes and dimensions |
| `npm run generate:xiaoyue-spritesheet` | Generate Xiaoyue sprite animation sheets into `src/assets/mascot/` |
| `npm run extract:xiaoyue-frames` | Extract raw frames from Xiaoyue source strips |
| `npm run contact-sheet:xiaoyue` | Generate contact-sheet preview of Xiaoyue frames |
| `npm run repair:xiaoyue` | Queue Xiaoyue asset repair jobs |
| `npm run optimize:archetypes` | Generate archetype WebP/PNG assets into `src/pages/onboarding/assets/archetypes/` |
| `npm run check:archetype-assets` | Validate archetype asset sizes |
| `npm run generate:spritesheet` | Generate archetype spritesheet + manifest for share-poster canvas |
| `npm run optimize:promo` | Generate promotional image assets |
| `npm run optimize:lovart` | Generate Lovart-designed image assets |
| `npm run check:lovart-assets` | Validate Lovart asset sizes |
| `npm run upload:cdn-assets` | Upload manifest assets to CDN (`--dry-run` for preview). For production, trigger `gh workflow run "Upload CDN Assets"` which builds + uploads via GitHub Actions. |
| `npm run check:package-size` | Audit mini-program bundle size against 2MB WeChat limit (measures actual zip-compressed size) |

**Active copy patterns** (`config/index.ts`) — bundled assets:

*Tab bar & shell (critical — must be local):*
- `src/assets/tab-icons` → `dist/assets/tab-icons` (~80KB)
- `src/assets/joyjoin-logo.webp` → `dist/assets/joyjoin-logo.webp` (~128KB)
- `src/assets/joyjoin-logo-tab.png` → `dist/assets/joyjoin-logo-tab.png` (~20KB)
- `src/assets/tab-bar-notch-bg.png` → `dist/assets/tab-bar-notch-bg.png` (~4KB)
- `src/native-custom-tab-bar/` → `dist/custom-tab-bar/`

*Onboarding subpackage:*
- `src/pages/onboarding/assets/archetypes` → `dist/pages/onboarding/assets/archetypes`

*Pool-registration subpackage:*
- `src/pages/pool-registration/assets/ceremony` → `dist/pages/pool-registration/assets/ceremony`

*Icon tiers (bundled with @1x/@2x/@3x retina support via `JoyJoinIcon`):*
- `src/assets/icons/mood-icons` (~16KB)
- `src/assets/icons/chemistry-badges` (~16KB)
- `src/assets/icons/status-icons` (~8KB)
- `src/assets/icons/category-icons` (~60KB)
- `src/assets/icons/intent-icons` (~60KB)
- `src/assets/icons/reaction-icons` (~120KB)
- `src/assets/icons/reveal-icons` (~156KB)
- `src/assets/icons/achievement-badges` (~144KB)
- `src/assets/icons/archetype` (~72KB, head icons for avatars)

*Fonts:*
- `src/assets/fonts/Quicksand` (~256KB, English brand font)
- `src/assets/fonts/Alimama/AlimamaFangYuanTiVF-Thin-minimal.woff2` (~66KB, minimal Chinese display font; full 621KB font loads from CDN)

*First-impression & empty states:*
- `src/assets/icons/phase-icons/phase-*.webp` → `dist/assets/landing-phase-icons/` (~80KB, 6 landing page icons)
- `src/assets/empty-state` (~16KB)
- `src/assets/qr` (~12KB)

*Mascot expressions (critical first impression):*
- `src/assets/personality/xiaoyue/xiaoyue-loading-system.webp` (~49KB)
- `src/assets/personality/xiaoyue/xiaoyue-home-welcome.webp` (~39KB)

*Game UI:*
- `src/assets/lovart/icebreaker/icons/icon-coin-*.png` → `dist/assets/auction-icons/` (~28KB)

*Lovart ceremony & milestone heroes (Batch C + D, 2026-06-04, Path B — local-bundle):*
- `src/assets/ceremony/*.webp` → `dist/assets/ceremony/` (8 files, ~285KB total, q=55, 600px)
- `src/assets/badges/*.webp` → `dist/assets/badges/` (9 files, ~300KB total, q=55, 600px)
- Registries in `src/lib/ceremonyHeroes.ts` + `src/lib/milestoneBadges.ts` use `localAsset()` (NOT `cdnAsset()`).
- PNG masters live in `assets-source/lovart/batch-{c,d}/` and are NOT bundled.
- Re-encode via `node scripts/optimize-ceremony-batch-c.mjs` / `node scripts/optimize-badges-batch-d.mjs` (q=55, 600px) before committing new tiles.

*CDN-only assets (too large for bundle or non-critical):*
Archetype full-body images, matching heroes, promo banners, Lovart illustrations (Batches A + B — pre-Path-B), icebreaker backgrounds, celebration images, extra Xiaoyue expressions, mini-script heroes, UI info-label icons. Loaded via `cdnAsset()` with route-based preloading via `routePreloadAssets.ts`.

### Proprietary Icon System

The mini-program replaces raw Unicode emoji with brand-aligned proprietary icons on all primary UI surfaces. The system lives in two places:

1. **Shared registry** — `packages/shared/src/iconSystem/emojiToIconMap.ts`
   - Maps Unicode emoji → `assetKey` + `tier` + `fallbackEmoji`
   - Supports **composite lookup** (same emoji resolves to different assets per tier)
   - `CDN_ICON_TIERS` controls which tiers load from CDN vs the local bundle. Tiers listed there resolve via `cdnAsset()`; tiers **not** listed resolve via `require()` against bundled `src/assets/icons/<tier>/`. Keep critical UI chrome (e.g. `intent`, `category`) out of `CDN_ICON_TIERS` so subpackage pages never block on a network path.
   - `getIconMapping(emoji, tier?)` → tier-specific match first, then global fallback
   - `getIconAssetPath(assetKey, tier, density)` → builds `require()` path for Taro

2. **Renderer** — `apps/mini-program/src/components/ui/JoyJoinIcon.tsx`
   - Props: `emoji`, `size?`, `tier?`, `className?`, `style?`
   - 4-tier fallback: no mapping → `require()` fail → image load fail → native emoji
   - Load animation: fade-in + spring-bounce scale (`cubic-bezier(0.34, 1.56, 0.64, 1)`)
   - Reduced-motion support via `Taro.getSystemInfoSync().reduceMotion`
   - Shimmer placeholder while loading; `alt={fallbackEmoji}` for accessibility

3. **Utility classes** — `apps/mini-program/src/styles/_utilities.scss`
   - `.jj-icon-text` — flex row for icon + label (8rpx gap; `--tight` / `--loose` modifiers)
   - `.jj-icon-loading` — shimmer placeholder animation

**Tier inventory** (`IconTier`): `expression`, `semantic`, `mood`, `chemistry`, `phase`, `status`, `reaction`, `category`, `intent`, `reveal`, `achievement`

**Preloader hooks for bundled icon tiers:**
- `usePreloadCategoryIcons` — warms the five bundled category icons before the interest-heat picker renders.
- `usePreloadIntentIcons` — warms the six bundled intent icons before the intent grid renders.
Both skip on 2G and run once per session.

**When to use raw emoji intentionally** (do not wire through `JoyJoinIcon`):
- Dynamic conversational copy (`ProfessionChatOverlay`, Xiaoyue bubbles)
- Transient particle effects (`ParticleBurst`)
- Functional symbols (`✓`, `✕`, `✅`) where native rendering is preferred
- Text-heavy inline content where asset count would explode

---

## Native Custom Tab Bar

The shipped mini-program tab bar is the **native WeChat component** copied from `src/native-custom-tab-bar/` to `dist/custom-tab-bar/` during build. There is no secondary Taro JSX tab bar in this workspace; all tab bar work happens in `src/native-custom-tab-bar/`.

| Aspect | Details |
|--------|---------|
| **Active runtime** | `src/native-custom-tab-bar/` → copied to `dist/custom-tab-bar/` at build time |
| **Copy rule** | `config/index.ts` `copy.patterns` handles the native → dist copy |
| **WXML root** | `<view class="joy-custom-tab-bar">` with nested `<view>` and `<image>` only. WeChat's `cover-view` overlay drops plain `<view>`/`<image>` children, so the active tab bar intentionally uses the standard view tree. |
| **Center CTA** | Floating circular button ("进行中") with **solid `#FFF4F8` fill** (`$color-bg-tint-pink`, via CSS custom property `--jj-bg-tint-pink`), outer ring in `$color-secondary` at ~18% opacity, and shadow. Positioned via a flexbox wrapper (`justify-content: center`) instead of `left:50% + transform` to avoid WeChat `cover-view` compositing bugs during `setData` re-renders. **Not gradient** — solid fill is the mini-program CTA standard |
| **Center hub page** | `/pages/center-hub/index` — dynamic content: active event card, pending registration status, or empty-state CTA |
| **Routing model** | Center button always `switchTab` to hub (requires `centerHub` in `tabBar.list` — WeChat validates `switchTab` targets against `tabBar.list` even with `custom: true`); hub CTAs `navigateTo` detail pages or `switchTab` to discover |
| **State sync** | `useCustomTabBarSync.ts` calls `Taro.getTabBar(page).syncState(...)` on every `useDidShow`. Native side debounces at 50ms with shallow diff to avoid icon flicker. `_confirmedSelected` tracks the authoritative selection for rollback |
| **Badges** | Notification counts mapped to `discover`, `activities`, `chat` categories. Badge updates use WeChat path syntax (`leftTabs[idx].badgeCount`) to avoid array reconstruction and icon reload flicker |
| **Device tiering** | `wx.getSystemInfoSync().benchmarkLevel <= 15` gates all animations (badge pop-in, pulse, fade-in, transitions) on low-end devices |
| **Swipe-back safety** | `pageLifetimes.show` resets `selected` to `_confirmedSelected` after 100ms, correcting any stuck optimistic state after swipe-back |

### Layering & compatibility rules

- The active tab bar uses plain `<view>`/`<image>` (not `<cover-view>`/`<cover-image>`). WeChat's native `cover-view` layer only reliably renders `cover-view`/`cover-image` children; mixing plain `<view>`/`<image>` inside a `<cover-view>` causes blank icons and labels. Do not reintroduce `<cover-view>` wrappers.
- Root uses `position: fixed` + `z-index: 120`.
- The center CTA button is a **root sibling** of the surface container (not nested inside it) to avoid surface clipping children.
- The center CTA is wrapped in `.joy-custom-tab-bar__center-wrap` (flexbox `justify-content: center`) instead of using `left: 50%; transform: translateX(-50%)`. The `transform` pattern is unsafe in the WeChat mini-program renderer because `setData` re-renders combined with `hover-class` transforms can drop the `translateX` offset, causing the button to shift right.
- `textarea` and `input` near the bottom of the screen require real-device verification.
- Skyline renderer is **disabled** by default; re-validate `getTabBar` behavior if enabling later.

### Interaction & motion

| Feature | Implementation |
|---------|----------------|
| **Tap feedback** | `hover-class` on side tabs + center button with `hover-stay-time="150"`. Transitions live on base elements (not `hover-class`) for WeChat compatibility |
| **Active tab pill** | `rgba(139, 92, 246, 0.08)` background + `border-radius: 24rpx` (8rpx grid). Entrance animation: `active-pill-enter` (200ms micro-bounce, scale 0.94→1) |
| **Haptics** | `wx.vibrateShort({ type: 'light' })` on every side-tab tap |
| **Badge pop-in** | `scale(0→1.15→1)` spring animation (200ms) |
| **Center badge pulse** | Continuous `scale` pulse on the center red dot |
| **Cover-image fade-in** | Scoped 200ms opacity fade on specific elements only (global selector removed to prevent re-trigger on every `setData`) |
| **Reduced motion** | `@media (prefers-reduced-motion: reduce)` disables all animations, including `will-change` reset to `auto`; respects system setting |
| **SwitchTab rollback** | Rollback uses `_confirmedSelected` (authoritative, not optimistic) to handle rapid tab switching. Success/fail tracked via `wx.reportAnalytics` (`mini_program_tab_bar_switch_success` / `_fail`). 300ms double-tap debounce on tap handlers |
| **Sync debounce** | 50ms debounce + shallow diff in `syncState`; path-syntax badge updates prevent flicker |
| **Haptics** | Platform-aware: `type: 'light'` on iOS, plain `wx.vibrateShort()` on Android. Silently fails on unsupported devices |
| **CSS theming** | 8 brand tokens declared as CSS custom properties on root (e.g. `--jj-primary`, `--jj-secondary`, `--jj-bg-tint-pink`). All hardcoded color values reference these tokens |
| **GPU compositing** | `will-change: transform` / `opacity` / `box-shadow` / `background-color` hints on 7 animated subtrees; reset to `auto` on low-end + reduced-motion |
| **Accessibility** | Hidden `aria-live="polite"` region announces tab switches ("已切换到发现"). Tab items use `role="button"`, `aria-label`, `aria-pressed` |
| **Offline resilience** | `wx.getNetworkType` / `wx.onNetworkStatusChange` detection; `syncState` skipped when offline to avoid stale badge counts |

---

## Package Loading Strategy

1. **Tab pages** (`discover`, `events`, `connections`, `profile`, `center-hub`) live in the **main package**.
2. **Heavy non-tab flows** are in subpackages:
   - `pages/onboarding` — personality test, profile forms, review.
   - `pages/pool-registration` — pool sign-up and ceremony assets.
   - `pages/matching-status` — match waiting / reveal.
   - `pages/icebreaker-session` — in-event social icebreaker.
3. **Preload rules** are declared from likely entry pages (`index`, `login`, `event-detail`, `events`) before reaching for independent subpackages.
4. Any proposal for independent subpackages must include a self-contained bootstrap plan because `app.ts` and `AuthProvider` centralize app-level providers and auth setup.

---

## Where New Files Go

| What | Where |
|------|-------|
| New page | `apps/mini-program/src/pages/<page-name>/index.tsx` (+ `.scss`, `.config.ts` if needed) |
| New component | `apps/mini-program/src/components/<ComponentName>.tsx` (+ `.scss`) — place in `ui/`, `loading/`, or `mascot/` subdir by domain |
| New hook | `apps/mini-program/src/hooks/use<HookName>.ts` — place in `auth/`, `payment/`, `navigation/`, or `onboarding/` subdir by domain |
| New lib helper | `apps/mini-program/src/lib/<helper>.ts` — place in domain subdir (`api/`, `auth/`, `payment/`, `onboarding/`, `navigation/`, `wechat/`, `matching/`, `mascot/`, `analytics/`, `utils/`) |
| UI constants (timing, colors, intervals) | `apps/mini-program/src/lib/utils/uiConstants.ts` — **centralized source of truth** |
| App-level config / registration | `apps/mini-program/src/app.ts`, `src/app.config.ts` |
| Shared types, schemas, constants | `packages/shared/src/` (import via `@shared/*` or `@joyjoin/shared`) |
| New tab bar item | `src/lib/navigation/tabBarConfig.ts` + `src/native-custom-tab-bar/index.js` + `src/lib/onboarding/onboardingRoutes.ts` + `src/app.config.ts` |

---

## Coordination Rules

- Treat the mini-program as the strongest current reference for payment mechanics.
- Before changing auth/session, API wrapper behavior, or payment flow here, review the matching web surface in `apps/user-client` and the guidance in [`../../docs/reference/PLATFORM_COORDINATION.md`](../../docs/reference/PLATFORM_COORDINATION.md).
- Keep mini-program runtime wiring here, but move genuinely shared contracts toward `packages/shared/src/`.

---

## Visual QA and Pixel Discipline

- Canonical rules (spec-exact vs **8rpx** rhythm, **WeChat DevTools** pre-merge gate): [`.github/skills/mini-program-frontend-excellence/references/pixel-precision.md`](../../.github/skills/mini-program-frontend-excellence/references/pixel-precision.md).
- Durable backlog for optional automation: [`repo-memory/candidates/mini-program-visual-qa-wechat-devtools-ci-gap.md`](../../repo-memory/candidates/mini-program-visual-qa-wechat-devtools-ci-gap.md).

---

## Cold-Entry Timing Probe

```bash
bash scripts/measure-mini-program-cold-entry.sh
```

Optional overrides: `SAMPLES=7 PRELOAD_SETTLE_MS=2000 bash scripts/measure-mini-program-cold-entry.sh`

---

## Group Analysis Debug (WP4)

For **matched** flows, `GET /api/pool-groups/:groupId/analysis` returns `fromCache` and `generatedAt`. To help QA trust the pipeline without exposing noise to all users:

- **Local `dev:weapp`:** a subtle line appears under the AI group-analysis blocks on matching status, squad unboxing, and pool group detail.
- **Production WeChat releases:** that line is **off** unless you opt in at build time.
- **Beta / internal preview:** set `TARO_APP_SHOW_GROUP_ANALYSIS_DEBUG=1` in the environment when running `npm run build:weapp --workspace=mini-program`.

---

## Manual QA — AI Surfaces (WP4)

| Check | Where |
|-------|--------|
| Profile tagline | Onboarding → profile review |
| Pool detail AI card | Matched user → pool group detail page |
| Theme after match / WS | Matching status after match + theme reveal |
| Group analysis copy | Matching status, squad unboxing, pool group detail |
| Social icebreaker | Host: warmup topics → phase advance |

---

## Related Docs

| Document | Purpose |
|----------|---------|
| [`../../docs/reference/PLATFORM_COORDINATION.md`](../../docs/reference/PLATFORM_COORDINATION.md) | Auth, API, and payment flow parity between mini-program and web |
| [`../../docs/reference/perf.md`](../../docs/reference/perf.md) | Performance guidelines for the monorepo |
| [`../../docs/reference/wechat-mini-program-reference.md`](../../docs/reference/wechat-mini-program-reference.md) | WeChat-specific API reference |
| [`../../docs/mini-program-data-fetching.md`](../../docs/mini-program-data-fetching.md) | React Query key conventions |
| [`docs/TECH_STACK.md`](./docs/TECH_STACK.md) | Deep technical stack reference |
| [`docs/USER_FLOW.md`](./docs/USER_FLOW.md) | Complete user flow mapping |
| [`.github/skills/platform-coordination-protocol/SKILL.md`](../../.github/skills/platform-coordination-protocol/SKILL.md) | Skill: cross-platform coordination |
| [`.github/skills/mini-program-frontend-excellence/SKILL.md`](../../.github/skills/mini-program-frontend-excellence/SKILL.md) | Skill: UI quality, pixel precision, 8rpx rhythm |
| [`docs/DEVICE_QA_CHECKLIST.md`](./docs/DEVICE_QA_CHECKLIST.md) | Pre-release device QA checklist |
| [`docs/LIST_VIRTUALIZATION.md`](./docs/LIST_VIRTUALIZATION.md) | Long-list thresholds and animation budget |
