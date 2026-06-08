# JoyJoin Mini Program — Technical Stack Reference

> Deep reference for the runtime, build pipeline, state layer, styling system, API surface, navigation, payments, testing, and assets in `apps/mini-program`.

---

## Runtime Environment

| Layer | Technology |
|-------|------------|
| Platform | WeChat Mini Program (`weapp`) |
| Framework adapter | Taro 4.2.0 |
| UI framework | React 18 + React DOM 18 |
| Language | TypeScript 5.4+ (strict, ESM) |
| Module system | ESM (`"type": "module"` inherited from monorepo) |
| Design resolution | 750 rpx canvas |
| Safe area | Handled via `env(safe-area-inset-*)` and `constant(safe-area-inset-*)` |

### TypeScript configuration

- Extends `../../tsconfig.base.json`
- Target: `ES2020`
- JSX: `react-jsx`
- Path aliases:
  - `@/*` → `./src/*`
  - `@shared/*` → `../../packages/shared/src/*`

---

## Build Toolchain

### Taro + Vite

Taro 4.2 uses **Vite** as the compiler backend (`@tarojs/vite-runner`). The build config lives in `config/index.ts`.

Key config values:

```ts
designWidth: 750
deviceRatio: { 640: 2.34/2, 750: 1, 375: 2, 828: 1.81/2 }
sourceRoot: 'src'
outputRoot: 'dist'
framework: 'react'
compiler: { type: 'vite' }
```

### PostCSS / pxtransform

- `pxtransform` is enabled for the `mini` target. It converts `px` values to `rpx` at build time.
- CSS Modules are **disabled** by default (`enable: false`).
- `imageUrlLoaderOption.limit: 0` forces **all images to real paths** — no base64 inlining.

### Copy patterns

Assets and the native custom tab bar are copied at build time:

```ts
copy: {
  patterns: [
    { from: 'src/assets', to: 'dist/assets' },
    { from: 'src/native-custom-tab-bar/', to: 'dist/custom-tab-bar/' },
  ]
}
```

### Environment defines

Build-time env vars are injected via `defineConstants`:

| Variable | Source |
|----------|--------|
| `TARO_APP_API_BASE_URL` | `config/apiBaseUrl.ts` (loads repo-root `.env`) |
| `TARO_APP_WECHAT_SUBSCRIBE_TMPL_IDS` | Comma-separated WeChat template IDs |
| `TARO_APP_SHOW_GROUP_ANALYSIS_DEBUG` | Optional flag for beta/preview builds |

---

## State Management

### React Query architecture

The mini-program does **not** use Redux, Zustand, or Context for server state. All server-state caching, deduplication, background refetch, and mutation invalidation is handled by `@tanstack/react-query` v5.

**Global query client** (`src/lib/queryClient.ts`):

```ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})
```

### Auth as a query

Auth is modeled as a query, not a separate store:

- **Key:** `AUTH_QUERY_KEY = ['mini-program', 'auth-user']`
- **Fn:** `GET /api/auth/user`
- **Behavior:** 401/403 are swallowed and returned as `null` (unauthenticated). All other errors throw.
- **Stale time:** `Infinity` — auth is considered fresh until explicitly invalidated.

### Foreground revalidation

`AuthProvider` contains an `AuthRefreshBridge` that calls `bootstrapMiniProgramAuthSession(client)` on every `useDidShow`. This revalidates auth when the user returns to the mini-program from background.

`useAuth` treats `isFetching` as part of `isLoading`, so protected pages **fail closed** during foreground refresh — they show loading shells instead of trusting potentially stale cached auth.

### Session seed / clear helpers

| Function | Purpose |
|----------|---------|
| `seedMiniProgramAuthSession(user, client)` | Hard reset + write auth data after login |
| `clearMiniProgramAuthSession({ mode })` | Clear auth; `mode: 'soft'` removes user-scoped queries, `mode: 'hard'` clears entire cache |
| `bootstrapMiniProgramAuthSession(client)` | Invalidate the auth query to trigger a refetch |

### Query key conventions

Prefix all mini-program queries with `'mini-program'` to avoid collisions with web-client keys:

```ts
['mini-program', 'auth-user']
['mini-program', 'my-pool-registrations']
['mini-program', 'my-blind-box-events']
['mini-program', 'pool-detail', poolId]
```

### UI Constants (`src/lib/uiConstants.ts`)

All magic timing values, polling intervals, stale times, animation durations, and brand colors are centralized in `src/lib/uiConstants.ts`:

| Category | Constants | Example |
|----------|-----------|---------|
| Toast timing | `TOAST_SHORT_MS`, `TOAST_DEFAULT_MS`, `TOAST_MEDIUM_MS`, `TOAST_LONG_MS`, `TOAST_ERROR_MS`, `TOAST_FATAL_MS` | `TOAST_DEFAULT_MS = 2000` |
| Polling intervals | `POLL_PAYMENT_MS`, `POLL_SOCIAL_SESSION_MS`, `POLL_REGISTRATION_MS`, `POLL_NOTIFICATIONS_MS` | `POLL_REGISTRATION_MS = 30_000` |
| Stale times | `STALE_TIME_BRIEF_MS`, `STALE_TIME_GROUP_DETAILS_MS`, `STALE_TIME_GROUP_ANALYSIS_MS` | `STALE_TIME_GROUP_ANALYSIS_MS = 1000 * 60 * 7` |
| Animation | `TRANSITION_DEFAULT_MS`, `SWIPER_INTERVAL_MS`, `SWIPER_TRANSITION_MS` | `SWIPER_INTERVAL_MS = 4200` |
| Brand colors | `COLOR_PRIMARY`, `COLOR_DANGER`, `COLOR_ACCENT_PINK`, `COLOR_TAB_INACTIVE` | `COLOR_PRIMARY = '#8B5CF6'` |

**Rule:** Any new toast duration, polling interval, or stale time expression should be added to `uiConstants.ts` and imported rather than hardcoded inline.

---

## Styling

### Sass / SCSS architecture

Styles are authored in **Sass** (SCSS syntax). There is no Tailwind, no CSS-in-JS, and no CSS Modules.

**Global entry:** `src/app.scss`

```scss
@use './styles/variables' as *;
@use './styles/mixins' as *;
@use './styles/reset';
```

### Token file (`styles/_variables.scss`)

| Token category | Examples |
|----------------|----------|
| **Brand gradient** | `$brand-gradient-from: #FF6B9D`, `$brand-gradient-to: #A86BFF` |
| **Colors** | `$color-primary: #8B5CF6`, `$color-bg: #FAFAFA`, `$color-surface: #FFFFFF` |
| **Typography** | `$font-ui` (system), `$font-cn-display` (Alimama), `$font-en-brand` (Quicksand) |
| **Font sizes** | `$font-size-xs: 22rpx` → `$font-size-brand: 64rpx` |
| **Spacing** | `$spacing-xs: 8rpx` → `$spacing-2xl: 80rpx` |
| **Sizing** | `$button-height: 96rpx`, `$card-radius: 32rpx`, `$tab-bar-height: 120rpx` |
| **Shadows** | `$shadow-sm` → `$shadow-lg`, `$shadow-card` |
| **Archetype colors** | 12 HSL tokens for personality archetypes |
| **Z-index** | `$z-tab-bar: 100`, `$z-custom-tab-bar: 120`, `$z-modal: 200`, `$z-toast: 300` |

### Mixins (`styles/_mixins.scss`)

| Mixin | Purpose |
|-------|---------|
| `@mixin gradient-text` | Text clipped to brand gradient |
| `@mixin font-cn-display` | Alimama display face |
| `@mixin type-display-hero` | Hero typography (black weight, tight leading) |
| `@mixin type-en-brand-numeric` | Quicksand numerals for prices/stats |
| `@mixin cta-pressed-active` | Scale + opacity `:active` feedback |
| `@mixin button-primary` | Full primary CTA style |
| `@mixin card` | White surface + radius + shadow |
| `@mixin viewport-min-height` | `100dvh` with fallback |
| `@mixin no-scroll-page-shell` | Flex column, `overflow: hidden` |
| `@mixin safe-area-top / -inline / -bottom` | Safe-area inset helpers |
| `@mixin page-shell-padding` | Standard page padding + safe areas |
| `@mixin onboarding-page-exit-transition` | Exit transition for onboarding pages |
| `@mixin onboarding-stage` | Staggered entrance animation |
| `@mixin text-truncate` | Single-line ellipsis |

### Global reset (`styles/_reset.scss`)

- `box-sizing: border-box` on `*` and Taro elements (`view`, `text`, `input`, etc.)
- Button normalization (remove padding, margin, background, border, `::after` border)
- Input outline/border removal

---

## API Layer

### `apiRequest` wrapper

`src/lib/api.ts` exports a typed `apiRequest<T>({ path, method?, data?, handleUnauthorized? })` built on `Taro.request`.

**Features:**

- Base URL resolution from `TARO_APP_API_BASE_URL` (defaults to `http://localhost:5001`)
- 15-second timeout (`REQUEST_TIMEOUT_MS = 15000`)
- JSON content-type + `Cache-Control: no-cache`
- **304 retry:** If WeChat returns `304` on a GET, the wrapper retries once with `_mpcb` cache-bust parameter
- **Transport error localization:**
  - Timeout → Chinese message with API target
  - Domain list error → whitelist guidance
  - SSL/Certificate error → cert config guidance
- **401 handling:** Calls `handleMiniProgramUnauthorized` unless `handleUnauthorized: false`

### Auth bootstrap functions

```ts
authenticateMiniProgramUser()           // Taro.login → POST /api/auth/wechat/login
authenticateMiniProgramUserWithTest()   // Same + imports anonymous test answers
getUserState()                          // GET /api/auth/user (returns nextStep)
```

All three are mini-program-only; there is no web OAuth redirect involved.

---

## Navigation

### `useJoyJoinNavigation`

`src/hooks/useJoyJoinNavigation.ts` wraps Taro navigation APIs with a CSS exit transition (default 220 ms).

```ts
const { isExiting, navigateBack, redirectTo, navigateTo, switchTab } = useJoyJoinNavigation()
```

Pages apply an `--exiting` modifier class to animate out before the native navigation fires.

### Route constants

All page paths and route strings are centralized in `src/lib/onboardingRoutes.ts`:

- `MINI_PROGRAM_PAGE_PATHS` — path strings for `app.config.ts` and route normalization
- `MINI_PROGRAM_ROUTES` — leading-slash URLs for navigation
- `MINI_PROGRAM_SUBPACKAGES` — subpackage definitions
- `MINI_PROGRAM_PRELOAD_RULES` — preload rules

### Onboarding routing

Server-driven `nextStep` values from `GET /api/auth/user` are mapped to mini-program routes via `nextStepToMiniProgramRoute()`:

| `nextStep` | Route |
|------------|-------|
| `onboarding` | `/pages/onboarding/onboarding/index` |
| `personality-test` | `/pages/onboarding/personality-test/index` |
| `essential-data` | `/pages/onboarding/essential-data/index` |
| `extended-data` | `/pages/onboarding/extended-data/index` |
| `profile-review` | `/pages/onboarding/profile-review/index` |
| `discover` / `guide` / default | `/pages/discover/index` |

`navigateToMiniProgramNextStep()` in `src/lib/onboardingNavigation.ts` handles the switch between `switchTab` and `redirectTo` based on target type.

---

## Routing & Tab Bar Map

### Tab Bar Items

| # | Text | pagePath | Icon (inactive) | Icon (active) |
|---|------|----------|-----------------|---------------|
| 0 | 发现 | `pages/discover/index` | `assets/tab-icons/发现 icon_inactive.png` | `assets/tab-icons/发现 icon.png` |
| 1 | 足迹 | `pages/events/index` | `assets/tab-icons/足迹 icon_inactive.png` | `assets/tab-icons/足迹 icon.png` |
| 2 | 连接 | `pages/connections/index` | `assets/tab-icons/连接 icon_inactive.png` | `assets/tab-icons/连接 icon.png` |
| 3 | 我的 | `pages/profile/index` | `assets/tab-icons/我的 icon_inactive.png` | `assets/tab-icons/我的 icon.png` |

Tab config source: `src/lib/tabBarConfig.ts`.  
Bar styling: `color: #9CA3AF`, `selectedColor: #8B5CF6`, `backgroundColor: #ffffff`, `borderStyle: 'white'`.

### Subpackages

| Root | Pages |
|------|-------|
| `pages/onboarding` | `onboarding/index`, `personality-test/index`, `personality-test/results/index`, `essential-data/index`, `extended-data/index`, `profile-review/index` |

### Preload Rules

| Entry Page | Preloaded Package | Network |
|------------|-------------------|---------|
| `pages/index/index` | `pages/onboarding` | `all` |
| `pages/login/index` | `pages/onboarding` | `all` |

---

## Payment Flow

### Pages

| Page | Purpose |
|------|---------|
| `pages/blind-box-payment/index` | JSAPI payment initiation page |
| `pages/payment-verification/index` | Post-payment polling & result display |

### Entry & storage

- `src/lib/paymentEntry.ts` — `openMiniProgramPaymentPage()` reads stored pending order, checks `paymentsEnabled`, and navigates or shows a toast block.
- `src/lib/paymentPendingOrderStorage.ts` — `wxStorage` persistence for pending orders and return contexts.
- `src/lib/paymentPendingOrder.ts` — State machine for pending orders:
  - Max age: **30 minutes**
  - Return context max age: **2 hours**
  - Auto-resume decision logic: waits for auth, clears on expiry/wrong-user, resumes on app foreground

### Auto-resume bridge

`App` in `src/app.ts` renders a `PendingOrderResumeBridge` component. On every `useDidShow` and auth-state change, it evaluates whether to automatically navigate to `payment-verification` for an interrupted order.

### Payment verification

- `src/lib/paymentVerificationStatus.ts` — Polling logic for order status.
- `src/lib/paymentFlowController.ts` — High-level payment flow state machine.
- `src/lib/paymentPageModel.ts` — Page-level business model for the payment UI.
- `src/components/FirstTimeCouponBanner.tsx` — Premium welcome-coupon banner rendered on the payment page. Surfaces `WELCOME50` (preferred) or `WELCOME40` fallback. Solid cream background, archetype-tinted decorative circle, counter animation, confetti burst on tap, "已领取" celebration overlay. Zero external assets. Analytics: `welcome_coupon_banner_impression` + `welcome_coupon_banner_tap`.

---

## Testing

### Vitest

`vitest.config.ts` configures a Node-environment test runner:

```ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx'],
    coverage: { reporter: ['text', 'json', 'html'] },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
})
```

**Existing test files:** 19 test files covering lib utilities and hooks.

Run with:

```bash
npm run test --workspace=mini-program
```

---

## Asset Strategy

### Images

- **Format:** PNG for icons and illustrations; WebP for optimized personality assets.
- **Inlining:** Disabled (`imageUrlLoaderOption.limit: 0`). All images remain as file references.
- **Optimization:** `scripts/optimize-xiaoyue-assets.mjs` compresses personality-test assets. `scripts/check-xiaoyue-asset-size.mjs` guards against oversized uploads.

### Fonts

Brand fonts are loaded on-demand via `src/lib/utils/brandFont.ts`:

| Font | Family | File | Usage | Load trigger |
|------|--------|------|-------|--------------|
| AlimamaFangYuanTiVF | `AlimamaFangYuanTiVF` | `assets/fonts/Alimama/AlimamaFangYuanTiVF-Thin.woff2` | Chinese display / emotional surfaces | Deferred in `app.ts` `useLaunch` (100ms) + eagerly on `LandingPage.tsx` mount |
| Quicksand | `Quicksand` | `assets/fonts/Quicksand/Quicksand-VariableFont_wght.ttf` | English wordmarks, hero numerals | On-demand when first English brand surface appears (not yet wired) |

Both use `Taro.loadFontFace({ global: true, source: "url(...)" })` with system-stack fallbacks.
A module-level guard in `brandFont.ts` prevents redundant `loadFontFace` calls.

### Tab bar icons

Tab bar icons are **PNG** files under `src/assets/tab-icons/`. Each tab has an inactive and active variant. These are referenced both in `src/lib/tabBarConfig.ts` (for `app.config.ts`) and in `src/native-custom-tab-bar/index.js` (for the native runtime).

---

## Additional Runtime Notes

### WebSocket

`src/lib/websocket.ts` and `src/hooks/useWebSocket.ts` manage a WebSocket connection for real-time match status and social icebreaker events.

| Aspect | Detail |
|--------|--------|
| URL | Derived from `TARO_APP_API_BASE_URL` → `ws://` or `wss://` + `/ws` |
| Singleton | `getWebSocket()` returns one shared instance |
| Background handling | `useDidHide` disconnects; `useDidShow` reconnects if previously connected |
| Heartbeat | 30s interval PING |
| Reconnect | Exponential back-off (max 5 attempts, cap 30s) |
| Subscriptions | Type-scoped (`on(eventType)`), event-scoped (`onEvent(eventId, eventType)`), global (`onAny`) |

### WeChat subscribe messages

`src/lib/wechatSubscribeMessage.ts` wraps `Taro.requestSubscribeMessage`. Template IDs are injected at build time via `TARO_APP_WECHAT_SUBSCRIBE_TMPL_IDS`.

### Haptics

`src/lib/haptics.ts` provides WeChat vibration feedback (`Taro.vibrateShort`) used during match reveals and icebreaker moments.

### Group analysis debug

For beta / internal preview builds, set `TARO_APP_SHOW_GROUP_ANALYSIS_DEBUG=1` when running `build:weapp`. This reveals a subtle "实时生成 / 缓存" hint under AI group-analysis blocks on matching status, squad unboxing, and pool group detail pages.

### Anonymous onboarding

`src/lib/anonymousOnboarding.ts` supports pre-auth personality test sessions. Answers can be imported into the real account via `authenticateMiniProgramUserWithTest()`.
