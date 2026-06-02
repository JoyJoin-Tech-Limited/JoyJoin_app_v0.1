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

- `src/app.ts` — app lifecycle entry (launch, providers, pending-order resume bridge)
- `src/app.config.ts` — consumes main package pages, subpackages, and `preloadRule` from `lib/onboarding/onboardingRoutes.ts` + tab config from `lib/navigation/tabBarConfig.ts`
- `src/lib/onboarding/onboardingRoutes.ts` — **register new pages here** (main package list, onboarding subpackage under `pages/onboarding`, preload rules)
- `src/lib/api/api.ts` — mini-program auth/API bootstrap surface (`authenticateMiniProgramUser`, `authenticateMiniProgramUserWithTest`, `getUserState`)
- `src/pages/onboarding/personality-test/` — V4 personality test, results, and post-result auth gate
- `src/pages/login/index.tsx` + `src/hooks/auth/useWeChatLogin.ts` — returning-user WeChat login
- `src/pages/blind-box-payment/`, `src/pages/payment-verification/` — JSAPI payment + post-pay polling

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
│   ├── index/           # Landing / splash page (cold entry)
│   ├── login/           # WeChat login entry for returning users
│   ├── onboarding/      # Subpackage: onboarding flow
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
│   └── discover/        # Discover feed components (OracleCard, CompatibilityIndicator, EcosystemBar)
├── hooks/               # Custom React hooks
│   ├── useStaggerMount.ts   # Single RAF mount trigger for CSS-staggered entrances
│   ├── useResetOnShow.ts    # Resets transient navigation/submit flags on page re-show (swipe-back safety)
├── lib/                 # Runtime helpers & business logic
├── providers/           # App-level React context providers
├── assets/              # Static assets (copied to dist/assets)
├── styles/              # Global Sass token system
│   ├── _variables.scss      # Color, spacing, typography tokens (includes $color-text-primary-warm)
│   ├── _stagger.scss        # Stagger entrance animation utilities (.stagger-in, .stagger-in--N)
│   └── colors.ts            # TypeScript brand color constants for JS consumption
├── native-custom-tab-bar/  # ACTIVE native WeChat tab bar (WXML/WXSS/JS)
├── custom-tab-bar/      # INACTIVE Taro JSX tab bar (not shipped)
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

Assets are **CDN-first** in production. The build inlines `TARO_APP_CDN_BASE_URL` from `apps/mini-program/.env.local` and all runtime references go through `cdnAsset('/assets/...')`.

**Critical rules:**
1. Always use `cdnAsset('/assets/...')` — never hardcode `/assets/` paths.
2. Production builds **fail** if `TARO_APP_CDN_BASE_URL` is missing.
3. Run `npm run validate:assets` before committing to catch orphan references.
4. Add new assets to `src/assets/` **and** `scripts/cdn-asset-manifest.json` so the CDN uploader discovers them.

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
| `npm run check:package-size` | Audit mini-program bundle size against budget |

**Active copy patterns** (`config/index.ts`) — only critical bundled assets:
- `src/assets/tab-icons` → `dist/assets/tab-icons` (~52KB, tab bar icons — must be local)
- `src/assets/joyjoin-logo.webp` → `dist/assets/joyjoin-logo.webp` (~94KB, native tab bar center button)
- `src/assets/tab-bar-notch-bg.png` → `dist/assets/tab-bar-notch-bg.png` (~3KB, custom tab bar notch)
- `src/native-custom-tab-bar/` → `dist/custom-tab-bar/`
- `src/pages/onboarding/assets/archetypes` → `dist/pages/onboarding/assets/archetypes` (subpackage assets)
- `src/assets/icons/mood-icons` → `dist/assets/icons/mood-icons` (~3KB, bundled)
- `src/assets/icons/chemistry-badges` → `dist/assets/icons/chemistry-badges` (~8KB, bundled)
- `src/assets/icons/status-icons` → `dist/assets/icons/status-icons` (~3KB, bundled)
- `src/assets/fonts/Quicksand` → `dist/assets/fonts/Quicksand` (~124KB, English brand font)
- `src/assets/fonts/Alimama/AlimamaFangYuanTiVF-Thin-minimal.woff2` → `dist/assets/fonts/Alimama/...` (~66KB, minimal Chinese display font; full 621KB font loads from CDN)

> Other icon tiers (reaction, category, intent, reveal, achievement, info-label, rating-face, phase) and all illustration assets are loaded from CDN via `cdnAsset()`. See `routePreloadAssets.ts` for per-route preload configuration.

### Proprietary Icon System

The mini-program replaces raw Unicode emoji with brand-aligned proprietary icons on all primary UI surfaces. The system lives in two places:

1. **Shared registry** — `packages/shared/src/iconSystem/emojiToIconMap.ts`
   - Maps Unicode emoji → `assetKey` + `tier` + `fallbackEmoji`
   - Supports **composite lookup** (same emoji resolves to different assets per tier)
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

**When to use raw emoji intentionally** (do not wire through `JoyJoinIcon`):
- Dynamic conversational copy (`ProfessionChatOverlay`, Xiaoyue bubbles)
- Transient particle effects (`ParticleBurst`)
- Functional symbols (`✓`, `✕`, `✅`) where native rendering is preferred
- Text-heavy inline content where asset count would explode

---

## Native Custom Tab Bar

The shipped mini-program tab bar is the **native WeChat component** copied from `src/native-custom-tab-bar/` to `dist/custom-tab-bar/` during build. The Taro JSX implementation in `src/custom-tab-bar/` is **not** the active runtime path.

| Aspect | Details |
|--------|---------|
| **Active runtime** | `src/native-custom-tab-bar/` → copied to `dist/custom-tab-bar/` at build time |
| **Inactive Taro JSX** | `src/custom-tab-bar/index.tsx` (kept for reference; not compiled into dist) |
| **Copy rule** | `config/index.ts` `copy.patterns` handles the native → dist copy |
| **WXML root** | `<cover-view class="joy-custom-tab-bar">` with nested `<cover-view>` and `<cover-image>` only |
| **Center CTA** | Floating circular button ("进行中") with gradient, shadow, and negative offset geometry |
| **Center hub page** | `/pages/center-hub/index` — dynamic content: active event card, pending registration status, or empty-state CTA |
| **Routing model** | Center button always `switchTab` to hub; hub CTAs `navigateTo` detail pages or `switchTab` to discover |
| **State sync** | `useCustomTabBarSync.ts` calls `Taro.getTabBar(page).syncState(...)` on every `useDidShow` |
| **Badges** | Notification counts mapped to `discover`, `activities`, `chat` categories |

### Layering & compatibility rules

- Only `cover-view`, `cover-image`, and `button` are valid children inside the native tab bar tree.
- Root uses `position: fixed` + `z-index: 120`.
- `textarea` and `input` near the bottom of the screen require real-device verification.
- Skyline renderer is **disabled** by default; re-validate `getTabBar` behavior if enabling later.

---

## Package Loading Strategy

1. **Tab pages** (`discover`, `events`, `connections`, `profile`, `center-hub`) live in the **main package**.
2. **Heavy non-tab flows** (onboarding: personality test, profile forms, review) are in the **`pages/onboarding` subpackage**.
3. **Preload rules** are declared from likely entry pages (`index`, `login`) before reaching for independent subpackages.
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
