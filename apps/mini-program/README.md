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
- `src/pages/onboarding/personality-test/` — V4 personality test, results, and post-result auth gate (split into focused sub-components: `index.tsx` orchestrator, `PersonalityTestIntro`, `PersonalityTestQuestion`, `PersonalityTestPreloadLayer`, `PersonalityTestCompletingError`, and shared `types.ts`)
- `src/pages/index/LandingPage.tsx` + `src/hooks/auth/useWeChatLogin.ts` — landing front door with 4 CTA states: `new` / `continue` / `discover` / `loggedOut` (`?auth=logout|expired`, the retired `pages/login/index` replacement — welcome-back copy, single WeChat login CTA)
- `src/pages/blind-box-payment/`, `src/pages/payment-verification/` — JSAPI payment + post-pay polling
- `src/pages/event-ticket-payment/` — paid event-ticket registration with ceremony success/verifying states; event-type tail illustration v2 full-bleed footer vignette with 4 s load-timeout fallback to barcode; zero-discount coupon skip when test price is ¥0.01
- `src/pages/gathering-room/` — pre-event online anteroom for matched groups; renders V2 `PixelAvatarComposite` avatars with equipped outfits over the delivered `room-composite-v1.webp` scene, ephemeral WS presence, and attendance confirmation. Gated by `gatheringRoomEnabled`.
- `src/components/HeroPromoBanner.tsx` — top-of-discover hero promo banner (full-bleed Lovart illustration + glass copy panel + breathing CTA + 5 sparkles). Kill switch via `user.features.promoBannerEnabled` (env `PROMO_BANNER_ENABLED`)
- `src/pages/alang/` + `src/lib/alang/` — 街头盲盒正式多 NPC 子包，同时保留旧阿浪兼容页。正式入口读取 `/api/alang/flash/*` 在线列表，选中角色后直接进入前台地图，服务端以 10 米为到达权威并按 3 幕 × 5 NPC 故事链恢复状态；每幕完成卡在用户确认收下后才退出，正式完成与唯一故事碎片由服务端原子结算。strict single-test 可为 15 幕创建独立 `replaySession` 从开场复测，复测游标、本地第一幕/小游戏状态与正式进度完全隔离。隐藏地点坐标和未来排班不进入客户端。Staging `manual_hold` 没有倒计时，显示“测试期间在线”，仅管理员显式下线才结束。旧 config/debug 仍为 strict single-test，正式阿浪美术仍为 `awaiting-approved-art`。
- `src/components/onboarding/WelcomeGiftCard.tsx` — compact, read-only welcome-coupon status rendered inside the Profile Review admission poster; calls `GET /api/user/welcome-coupon`, shows the actual discount/validity after a real grant/refetch, and never blocks completion or presents a decorative tap target. Skeleton and reduced-motion states supported.
- `src/components/events/FootprintOracleCard.tsx` — interactive "足迹" tab event card. Wraps `EventSummaryCard` in a two-rail layout: left body (status, title, date/time/location) and right rail (compact countdown, group size, price, or "待公布" placeholder). Supports list affordances (tap, hover, haptics, entrance delay). The right rail contents are included in the card's accessible name; only the decorative `›` cue is `aria-hidden`.
- `src/components/TablemateCard/index.tsx` — reusable 桌友 portrait card (2026-08-16) that carries the squad-unboxing deck front-face recipe into matching-status and pool-group-detail. Props: `member`, `viewerPair?`, `isCurrentUser`, `dealt`, `entranceDelayMs?`, `reduceMotion`, `dealKey?`, `onTap?`. Archetype-tinted foil frame, 52/48 art/info split, connection pill or pair-temperature chip, avatar fallback to archetype asset, and haptic-throttled tap.
- `src/components/TablemateDetailSheet/index.tsx` — bottom-sheet member detail (2026-08-16) opened from `TablemateCard` taps. Shows hero-image fade-in, avatar preview, rarity-dotted connection points, interest tags, industry line, and a `现场见` CTA. Supports drag-to-dismiss and `catchMove` scroll containment.
- `src/lib/utils/pairChemistry.ts` — shared pair-chemistry display helpers used by every 桌友 surface (squad-unboxing, matching-status, pool-group-detail): `getPairChemistryWord`, `getPairChemistryTier`, `CHEMISTRY_TIER_EMOJI`, `stripConnectionPointParens`, `shortenConnectionPointForPill`, `buildInterestHookText`.
- `src/components/events/EventSummaryCard.tsx` — shared presentational event-card shell used by `FootprintOracleCard` and read-only confirmation surfaces such as pool-registration terminal states. Renders the same gradient shell, status pulse pill, segmented countdown, title, date/time/location meta, and corner vignette. Supports `interactive`, `railMode`, and `rightRail` props; title clamps to 2 lines with `keep-all` word breaking.
- `src/pages/pool-registration/components/PersonaSnapshotCard.tsx` — aggregate "persona 拼图卡" preview rendered on pool-registration step 0. Gated by `user.features.personaSnapshotEnabled`; uses CDN Lovart art with subpackage fallback and `usePersonaSnapshotAnimation.ts`. Particle colors are derived from the pool's top archetype distribution (or the user's archetype) by mapping to real colored particle assets — CSS tint filters are not used because they are unreliable in WeChat runtime. The outer merged hero+persona card uses `hoverClass` for pressed feedback and is the sole tap target; dimension pills are individually interactive once the CTA is ready.
- `src/hooks/useEventCountdown.ts` — visibility-aware countdown hook returning `display`, `segments`, `isUrgent`, `hasStarted`, `isLive`. Gated by viewport visibility, app background, reduced-motion, and device tier.
- `src/lib/utils/eventDisplay.ts` — `formatEventDateTime` (with `今天`/`明天`/`后天` relative prefixes), `getJoinedEventDisplayDateTime` for display-time vs matching-time precedence, and `isJoinedEventTerminal()` for terminal-state detection.
- `src/lib/utils/accessibility.ts` — `getSystemReducedMotion()` canonical helper for reading the OS-level reduced-motion preference.
- `src/pages/profile/index.tsx` — V1.7 “我的” target: warm sunset-street identity stage (`IdentityStageScene`), approved V4 archetype hero (`ArchetypeHead` ring + grid emblem) with resilient fallbacks, real gamification progress, real Profile shell event/connection stats, profile completion, milestones, service grid, settings, and an `alangEnabled`-gated story archive card. Glass cards, purple equipment bar, and three stat cards use brand warm/purple semantic tints with RPG-style nameplate and XP-sheen polish. The companion/equipment peer entry routes to the existing personality result and remains labelled “装备筹备中”; no FUTURE 08 inventory page or fabricated Mockup counts are implemented.

---

## Project Structure

```
src/
├── pages/               # Mini-program pages (one folder per route)
│   ├── discover/        # Tab 0: "发现" — event pool discovery feed
│   ├── events/          # Tab 1: "足迹" — user's event history
│   ├── connections/     # Tab 2: "连接" — matched group & social connections. Empty state (2026-06-30): hero card with Xiaoyue mascot + 3-step flow card using `JoyJoinIcon` dashed connectors.
│   ├── profile/         # Tab 3: "我的" — user profile & settings
│   ├── center-hub/      # Tab 4 (center): "进行中" — dynamic hub for active events, pending registrations, and empty state. Empty state (2026-06-30): hero card with Xiaoyue mascot + 4-step activity flow card.
│   ├── index/           # Landing / splash page (cold entry). Renders `AutoLoginBridge` silent re-auth; unified redirect effect routes authenticated users → `nextStep` and guests with incomplete anonymous assessment → personality test. Continue-mode CTA shows context-aware labels (`进入发现页` / `继续完善档案` / `继续完成测试`). Returning authenticated users with `nextStep='discover'` route to the Discover tab. `useResetOnShow` clears the navigation loading state on swipe-back/foreground so the CTA never stays stuck on the ellipsis spinner. 5s navigation safety timeout prevents stuck CTA on subpackage download hang.
│   ├── login/           # WeChat login entry for returning users
│   ├── onboarding/      # Subpackage: onboarding flow
│   ├── pool-registration/  # Subpackage: pool sign-up flow; terminal states reuse EventSummaryCard
│   │   └── components/
│   │       ├── PoolRegistrationHero.tsx            # frame-only hero image with meta pills (used inside merged card)
│   │       ├── PoolRegistrationHeroPersonaSection.tsx  # merged hero + persona snapshot card wrapper
│   │       ├── PersonaSnapshotCard.tsx             # aggregate persona puzzle preview card
│   │       ├── PersonaSnapshotSheet.tsx            # detail bottom sheet for the preview card
│   │       ├── usePersonaSnapshotAnimation.ts      # entrance/resolve animation orchestration (stable snapshot, user-scoped played-state)
│   │       ├── poolPersonaAssets.ts                # CDN + subpackage asset paths
│   │       └── PoolRegistrationTerminalStates.tsx  # loading / empty / already-joined / success states
│   ├── blind-box-payment/
│   ├── payment-verification/
│   ├── event-detail/
│   ├── event-feedback/
│   ├── event-ticket-payment/
│   ├── matching-status/
│   ├── squad-unboxing/    # Subpackage: match reveal (subpackage since 2026-07-14)
│   ├── pool-group-detail/
│   ├── gathering-room/    # Subpackage: pre-event online anteroom for matched groups
│   ├── icebreaker-session/
│   ├── alang/               # Subpackage: event, search, dialogue, companion, result/archive; config/debug test-only
│   └── profile-linked/      # Subpackage: edit-profile, rewards, invite, terms (preloaded from profile)
│       ├── edit-profile/
│       ├── rewards/
│       ├── invite/
│       └── terms/
├── components/          # Shared UI components & primitives
│   ├── ui/              # BrandLogo, Button, Card, StatusCard, JoyJoinIcon, Chip, SegmentedProgress, TraitRadarChart, etc.
│   ├── profile/         # Profile-specific components (ProfileArchetypeHero, InterestChipCloud, ProfessionDisplayField)
│   ├── landing/         # Landing-page-specific components (BondingCloud)
│   ├── mascot/          # XiaoyueChatBubble, XiaoyueEmptyState, etc.
│   ├── discover/        # Discover feed components (OracleCard, CompatibilityIndicator, ParticipantPresenceStrip). Empty-state presence strip uses a breathing accent ring + invitation pill (首座留给你).
│   ├── events/          # Events / footprint components (FootprintOracleCard, EventSummaryCard, EventCountdownClock)
│   └── ContentBlockedError.tsx  # Inline field error for sensitive-word violations; field-aware hints, tap-to-dismiss, haptics, aria-live, reduced-motion. Used in edit-profile and onboarding essential-data forms.
├── hooks/               # Custom React hooks
│   ├── useEventCountdown.ts # Visibility-aware countdown with segments/progress; gates ticking by viewport, app background, reduced-motion, and degradation tier
│   ├── useStaggerMount.ts   # Single RAF mount trigger for CSS-staggered entrances
│   ├── useResetOnShow.ts    # Resets transient navigation/submit flags on page re-show (swipe-back safety)
│   ├── useUnload.ts         # Page unload lifecycle cleanup (timer leaks, refs, subscriptions)
│   ├── useCountUp.ts        # Animated numeric count-up for hero stats (profile stats, etc.) with enabled/delay options and reduced-motion/degradation gating
│   ├── useDeviceTier.ts     # Runtime device-capability tiering; Android uses benchmarkLevel, iOS falls back to model/system heuristics
│   ├── usePageTTI.ts        # Lightweight time-to-first-interactive instrumentation for mini-program pages; budgets: cold ≤2000 ms, warm ≤800 ms
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

**CI build target (2026-06-30):** `.github/workflows/taro-weapp-build.yml` now defaults `TARO_APP_API_BASE_URL` to `https://staging.joyjoinapp.com`; production API builds require an explicit `workflow_dispatch` `api_target=production` selection. Local dev (`npm run dev:weapp`) still defaults to `http://localhost:5001`.

**Shared CDN strategy:** both production and staging mini-program builds load large assets from the same production CDN path (`https://joyjoinapp.com/static`). This avoids maintaining duplicate staging asset directories and ensures a single source of truth for ceremony heroes, badges, icons, and other CDN-backed assets. Run `npm run upload:cdn-assets` against `/var/www/cdn` after adding or updating CDN assets.

**Tencent Cloud CDN (free tier):** if downloads from the origin server are slow, put Tencent Cloud CDN in front of the origin. Recommended setup:
1. Create a CDN domain `static.joyjoinapp.com` with origin type **Self-owned origin** and origin address `joyjoinapp.com` (or your CVM IP).
2. CNAME `static.joyjoinapp.com` to the Tencent CDN CNAME.
3. Set `TARO_APP_CDN_BASE_URL=https://static.joyjoinapp.com` in `apps/mini-program/.env.local` and rebuild.
4. Whitelist `https://static.joyjoinapp.com` in the WeChat Mini Program admin console under download/upload domains.

No nginx changes are required — Tencent CDN will pull from `/var/www/cdn/` via the existing `/static/` location and respect the `Cache-Control: max-age=31536000, immutable` headers.

**Critical rules:**
1. Use `cdnAsset('/assets/...')` for CDN assets and `localAsset('/assets/...')` for bundled assets — never hardcode `/assets/` paths.
2. Production builds **guarantee** a CDN base URL: `config/index.ts` defaults to `https://joyjoinapp.com/static`, and the CI workflow falls back to the same value. Override `TARO_APP_CDN_BASE_URL` only for a custom CDN or staging origin.
3. Run `npm run validate:assets` before committing to catch orphan references.
4. Add new CDN assets to `src/assets/` **and** `scripts/cdn-asset-manifest.json` so the CDN uploader discovers them.
5. Run `npm run check:package-size` after build, then confirm the result with WeChat DevTools or `miniprogram-ci`. The current script needs a system `zip` executable for compressed measurement; without it, it falls back to raw bytes. See `docs/package-size/main-package-audit.md` for the audited boundary and remediation plan.
6. Run `npm run verify:subpackage-styles` after `npm run build:weapp` to catch Taro/Vite WXSS chunking regressions. The script fails if required selectors are missing from the owning page WXSS **or** if any `sub-common.wxss` is non-empty. Fix: `@use` the component SCSS in the consuming page SCSS **and** remove the matching `import './X.scss'` side effect from the component TSX. See `docs/runbooks/mini-program-asset-delivery.md` §4.6.
7. **Mascot policy (2026-09-03):** the sprite-sheet animator and all mascot sprite sheets were deleted; every mascot surface renders a static expression WebP via `getXiaoyueExpressionAsset()` (CDN-primary, bundled `xiaoyue-home-welcome`/`xiaoyue-loading-system` local fallbacks).
8. **Bundled icon density policy:** `status-icons`, `info-labels` (semantic), and `ui` tiers ship at `@1x`/`@2x` only; `@3x` variants are stripped by `clean:cdn-assets` to save package size. Source `@3x` files remain for CDN fallback.

| Script | Purpose |
|--------|---------|
| `npm run validate:assets` | Build-time validator: every asset reference must resolve to `src/assets/` or `cdn-asset-manifest.json` |
| `npm run optimize:xiaoyue` | Generate Xiaoyue expression WebPs and intro animated/static fallbacks into `src/assets/personality/xiaoyue/` |
| `npm run check:xiaoyue-assets` | Validate Xiaoyue asset sizes and dimensions |
| `npm run extract:xiaoyue-frames` | Extract raw frames from Xiaoyue source strips |
| `npm run contact-sheet:xiaoyue` | Generate contact-sheet preview of Xiaoyue frames |
| `npm run repair:xiaoyue` | Queue Xiaoyue asset repair jobs |
| `npm run optimize:archetypes` | Generate archetype WebP/PNG assets into `src/pages/onboarding/assets/archetypes/` |
| `npm run check:archetype-assets` | Validate archetype asset sizes |
| `npm run generate:spritesheet` | Generate archetype spritesheet + manifest for share-poster canvas |
| `npm run optimize:promo` | Generate promotional image assets |
| `npm run optimize:lovart` | Generate Lovart-designed image assets |
| `npm run check:lovart-assets` | Validate Lovart asset sizes |
| `npm run upload:cdn-assets` | Upload manifest assets to CDN (`--dry-run` for preview). For production, trigger `gh workflow run "Upload CDN Assets"` which builds + uploads via GitHub Actions. **Symlink resolution:** the uploader resolves symlinks (e.g. `src/assets/archetypes/` → `src/pages/onboarding/assets/archetypes/`) before rsync so the remote host receives real files, not broken symlinks. |
| `npm run check:package-size` | Audit mini-program bundle size against the 2MB WeChat limit; compressed measurement currently requires a system `zip`, so verify the reported mode and use WeChat tooling as authority |
| `npm run verify:subpackage-styles` | Post-build regression gate: fails if required component selectors are missing from the owning page WXSS **or** any `sub-common.wxss` is non-empty. Fix by `@use`-ing the component SCSS in the page SCSS and removing the matching `import './X.scss'` from the component TSX. |

**Active copy patterns** (`config/index.ts`) — bundled assets:

*Tab bar & shell (critical — must be local):*
- `src/assets/tab-icons` → `dist/assets/tab-icons` (~80KB)
- `src/assets/joyjoin-logo.png` → `dist/assets/joyjoin-logo.png` (~32KB)
- `src/assets/joyjoin-logo-tab.png` → `dist/assets/joyjoin-logo-tab.png` (~15KB)
- `src/assets/tab-bar-notch-bg.png` → `dist/assets/tab-bar-notch-bg.png` (~4KB)
- `src/native-custom-tab-bar/` → `dist/custom-tab-bar/`

*Onboarding subpackage:*
- `src/pages/onboarding/assets/archetypes` → `dist/pages/onboarding/assets/archetypes`

*Pool-registration subpackage:*
- `src/pages/pool-registration/assets/` → `dist/pages/pool-registration/assets/` (pool-specific hero backdrops; Batch C ceremony registry is CDN-backed)
- `src/pages/pool-registration/assets/ceremony/lovart-pool-registration-hero-*.webp` → `dist/assets/pool-heroes/` (main-package local fallback that survives `clean:cdn-assets`; CDN primary via `assets/ceremony/`)
- `src/pages/pool-registration/assets/pool-persona/` → `dist/pages/pool-registration/assets/pool-persona/` (persona snapshot card CDN fallbacks)

*Icon tiers (bundled as single high-resolution bare `.webp` files; no `@2x`/`@3x` variants; WeChat downscales automatically. `validate:icon-transparency` fails the build if any bundled `src/assets/icons/**/*.webp` contains `@`):*
- `src/assets/icons/mood-icons` (~16KB raw)
- `src/assets/icons/chemistry-badges` (~16KB raw)
- `src/assets/icons/status-icons` (~360KB raw, Lovart 5×5 status grid: alarm/bar-chart/bell/check/close/mirror/sparkle/unlock + legacy crown/info)
- `src/assets/icons/category-icons` (~108KB raw)
- `src/assets/icons/intent-icons` (~51KB raw, single 144×144 WebP)
- `src/assets/icons/info-labels` (~216KB raw, semantic info labels such as calendar/location/people/target/globe)
- `src/assets/icons/ui` (~204KB raw, profile/settings list icons + gift/search/memo from Lovart 5×5 UI grid)
- `src/assets/icons/archetype` (~108KB raw, head icons for avatars)

*Source-only icon tiers (uploaded to CDN, not copied to `dist`):*
- `src/assets/icons/flow-icons` (~60KB source, center-hub / connections empty-state flow diagrams)
- `src/assets/icons/rating-faces` (~84KB source, event-feedback 5-step rating selector)
- `src/assets/icons/reaction-icons` (~120KB source)
- `src/assets/icons/reveal-icons` (~156KB source)
- `src/assets/icons/achievement-badges` (~144KB source)

*Fonts (CDN-upload sources only; not copied into the mini-program package):*
- `src/assets/fonts/Quicksand/Quicksand-VariableFont_wght.woff2` (~16KB, English brand font source)
- `src/assets/fonts/Alimama/AlimamaFangYuanTiVF-Thin-minimal.woff2` (~66KB, minimal Chinese display font source; both Alimama tiers load from CDN at runtime because WeChat `loadFontFace` requires network URLs)

*First-impression & empty states:*
- `src/assets/landing-phase-icons/phase-*.webp` → `dist/assets/landing-phase-icons/` (~80KB, 6 landing page icons)
- `src/assets/empty-state` (~16KB)
- `src/assets/qr` (~12KB)

*Mascot expressions (critical first impression):*
- `src/assets/personality/xiaoyue/xiaoyue-loading-system.webp` (~49KB)
- `src/assets/personality/xiaoyue/xiaoyue-home-welcome.webp` (~39KB)

*Mascot expressions:* CDN-primary static WebP via `getXiaoyueExpressionAsset()`; bundled `xiaoyue-home-welcome` / `xiaoyue-loading-system` are the local fallbacks. The sprite-sheet pipeline was deleted 2026-09-03.

*Interest taxonomy v2.0 illustrations (CDN-only):*
- 48 active interests across 6 macro categories (`food`, `play`, `sports`, `culture`, `life`, `growth`).
- Canonical `imageUrl` lives in `packages/shared/src/interests.ts`; mini-program resolves via `getInterestAssetUrl()` → `cdnAsset()`.
- 4 refreshed category icon sets are bundled locally with CDN fallback copies.

*Game UI:*
- `src/assets/lovart/icebreaker/icons/icon-coin-*.png` → `dist/assets/auction-icons/` (~28KB)

*Lovart ceremony & milestone heroes (Batch C + D, 2026-06-04 → moved to CDN 2026-06-16):*
- `src/assets/ceremony/*.webp` (14 files: Batch C 8 + v0.1 gap-fill 6, ~363KB total, q=55, 600px) are uploaded to CDN; not copied to `dist`.
- `src/assets/badges/*.webp` (9 files, ~300KB total, q=55, 600px) are uploaded to CDN; not copied to `dist`.
- Registries in `src/lib/ceremonyHeroes.ts` + `src/lib/milestoneBadges.ts` use `cdnAsset()` (NOT `localAsset()`).
- PNG masters live in `assets-source/lovart/batch-{c,d}/` and are NOT bundled.
- Re-encode via `node scripts/optimize-ceremony-batch-c.mjs` / `node scripts/optimize-badges-batch-d.mjs` (q=55, 600px) before committing new tiles, then upload via the CDN workflow.

*CDN-only assets (too large for bundle or non-critical):*
Archetype full-body images (WebP primary + PNG fallback for canvas), matching heroes, Lovart illustrations (Batches A + B), Lovart ceremony & milestone heroes (Batches C + D), **phase-emblem** icon tier, **expression / rating-faces** icon tier (event-feedback 5-step selector), **flow-icons** (center-hub / connections empty-state flow diagrams), reaction/reveal/achievement icon tiers, icebreaker backgrounds, celebration images, extra Xiaoyue expressions, mini-script heroes, ceremony heroes, milestone badges, **interest taxonomy v2.0 illustrations** (`images/interests/*.webp`). Loaded via `cdnAsset()` with route-based preloading via `routePreloadAssets.ts`. The icebreaker session also preloads `ICEBREAKER_PHASE_EMBLEM_ASSETS` on entry.

*CDN-only with local skeleton first paint:*
- Discover promo banner (`src/assets/promo/banner-hero-lovart-v1.webp`) is uploaded to CDN and loaded via `cdnAsset('/assets/promo/banner-hero-lovart-v1.webp')`; a gradient overlay skeleton preserves first paint while the asset loads. The local `promo-local/` copy was removed in 2026-07-06 to keep the main package under the 2 MB ceiling.

*CDN fallbacks for locally bundled assets:*
- `ArchetypeHead` head icons (`src/assets/icons/archetype/archetype-*-head.webp`) are bundled locally; CDN fallback copies exist at the same path under `https://joyjoinapp.com/static/` for subpackage/cache-miss robustness.
- Profile-share canvas uses `assets/personality/archetypes/archetype-*.webp` (CDN) with `archetype-*.png` (CDN) fallback because canvas `drawImage` cannot resolve local bundled paths.

### Proprietary Icon System

The mini-program replaces raw Unicode emoji with brand-aligned proprietary icons on all primary UI surfaces. The system lives in two places:

1. **Shared registry** — `packages/shared/src/iconSystem/emojiToIconMap.ts`
   - Maps Unicode emoji → `assetKey` + `tier` + `fallbackEmoji`
   - Supports **composite lookup** (same emoji resolves to different assets per tier)
   - `CDN_ICON_TIERS` controls which tiers load from CDN vs the local bundle. Tiers listed there should be wrapped with `cdnAsset()`; tiers **not** listed should be wrapped with `localAsset()` against bundled `src/assets/icons/<tier>/`. Keep critical UI chrome (e.g. `intent`, `category`) out of `CDN_ICON_TIERS` so subpackage pages never block on a network path.
   - `getIconMapping(emoji, tier?)` → tier-specific match first, then global fallback; if the emoji exists in exactly one tier map and no explicit `tier` is provided, the unambiguous tier mapping is used automatically
   - `getLocalIconAssetPath(assetKey, tier, density)` → builds root-relative `/assets/icons/...` path (preferred)
   - `getIconAssetPath(assetKey, tier, density)` → legacy relative `require()` path (deprecated; `require()` of non-JS assets crashes in WeChat subpackages)

2. **Renderer** — `apps/mini-program/src/components/ui/JoyJoinIcon.tsx`
   - Props: `emoji`, `size?`, `tier?`, `className?`, `style?`, `lazyLoad?`
   - 4-tier fallback: no mapping → asset resolve fail → image load fail → native emoji
   - **Loading policy:** CDN tiers lazy-load by default; locally bundled tiers load eagerly by default to avoid emoji fallback in subpackage pages. Pass `lazyLoad` to override.
   - Load animation: fade-in + spring-bounce scale (`cubic-bezier(0.34, 1.56, 0.64, 1)`)
   - Reduced-motion support via `Taro.getSystemInfoSync().reduceMotion`
   - Shimmer placeholder while loading; `alt={fallbackEmoji}` for accessibility

3. **Utility classes** — `apps/mini-program/src/styles/_utilities.scss`
   - `.jj-icon-text` — flex row for icon + label (8rpx gap; `--tight` / `--loose` modifiers)
   - `.jj-icon-loading` — shimmer placeholder animation

4. **Build-time guard** — `npm run validate:icon-transparency`
   - Fails the build if any bundled icon that floats on a variable background is fully opaque (e.g. a white matte behind `category-social`).
   - Run automatically before `npm run build:weapp`.

**Tier inventory** (`IconTier`): `expression` (rating faces), `semantic` (maps to `info-labels` folder), `mood`, `chemistry`, `phase`, `status`, `reaction`, `category`, `intent`, `reveal`, `achievement`, `ui`

**Preloader hooks for bundled icon tiers:**
- `usePreloadCategoryIcons` — warms the five bundled category icons before the interest-heat picker renders.
- `usePreloadIntentIcons` — warms the bundled intent icons before the intent grid renders; skips on 2G/offline and runs once per session.
- `preloadOnboardingAssets` (`src/lib/utils/onboardingPreload.ts`) — app-launch staggered preloader for onboarding-critical raster assets. Tier 1 (immediate) warms intro/welcome art; Tier 2 (~400ms) warms test expressions, personality emoji icons, intent icons, milestone badge, and welcome-back hero. The former Tier 3 mascot-sprite tier was removed 2026-09-03. Skips entirely on 2G/offline.

**Archetype asset registry:**
- `src/lib/utils/archetypeAssets.ts` is the canonical source for full-size archetype WebP/PNG URLs, the bundled slot-machine spritesheet path, and bulk-preload helpers (`getAllArchetypeAssetUrls`, `getArchetypeSpritesheetLocalPath`). The personality-test subpackage re-exports these from `pages/onboarding/personality-test/visuals.ts` for historical consumers.

**When to use raw emoji intentionally** (do not wire through `JoyJoinIcon`):
- Dynamic conversational copy (`ProfessionChatOverlay`, Xiaoyue bubbles)
- Transient particle effects (`ParticleBurst`)
- Functional symbols (`✓`, `✕`, `✅`) where native rendering is preferred
- Text-heavy inline content where asset count would explode

---

## Native Custom Tab Bar

The shipped mini-program tab bar is the **native WeChat component** copied from `src/native-custom-tab-bar/` to `dist/custom-tab-bar/` during build. There is no secondary Taro JSX tab bar in this workspace; all tab bar work happens in `src/native-custom-tab-bar/`.

**Route-based visibility guard:** the native component resolves its own selection and visibility from the route — `_reconcileSelection()` is the only route-derived writer, and the route→index map it uses is mirrored in TypeScript at `src/lib/navigation/tabBarRouteIndex.ts` (`TAB_BAR_ROUTE_INDEX`), locked together by `tabBarRouteIndexParity.test.ts`. The bar stays hidden on non-tab routes (e.g., the landing page) because `data.hidden` defaults to `true` and reconcile only reveals on a mapped tab route.

The guard normalizes route formats (`pages/discover/index`, `/pages/discover/index`, and `pages/discover/index?$taroTimestamp=...`) before the route-map lookup, defaults to `hidden: true`, and resolves the active tab from the route **inside `attached`**, so a tab page normally renders already visible and already lit instead of waiting for a later callback. Treat "`setData` in `attached` lands in the same first paint" as expected behaviour, not a documented platform guarantee: if the page stack is still mid-`switchTab`, attach can read the outgoing route and paint that tab for a frame, which the page's own publish corrects immediately. The visible page's `useCustomTabBarSync` publishes its own `page.route` index on every `useDidShow` (not gated by auth/data `enabled`) and retries while `getTabBar()` is still undefined. This covers both historical failure modes: a DevTools/device bug where `getCurrentPages()` is empty or un-normalized at attach time, and a lost one-shot push that left the bar unlit until a second tap.

> **Smoke test:** after any tab-bar or routing change, run the DevTools smoke in
> [`docs/runbooks/mini-program-tab-bar-smoke.md`](../../docs/runbooks/mini-program-tab-bar-smoke.md).
> It documents the correct verification technique: check the **computed
> `display` and outer `hidden` attribute**, not just the WXML tree.

| Aspect | Details |
|--------|---------|
| **Active runtime** | `src/native-custom-tab-bar/` → copied to `dist/custom-tab-bar/` at build time |
| **Copy rule** | `config/index.ts` `copy.patterns` handles the native → dist copy |
| **WXML root** | `<view class="joy-custom-tab-bar">` with nested `<view>` and `<image>` only. WeChat's `cover-view` overlay drops plain `<view>`/`<image>` children, so the active tab bar intentionally uses the standard view tree. |
| **Center CTA** | Floating circular button ("进行中") with **solid `#FFF4F8` fill** (`$color-bg-tint-pink`, via CSS custom property `--jj-bg-tint-pink`), outer ring in `$color-secondary` at ~18% opacity, and shadow. Positioned via a flexbox wrapper (`justify-content: center`) instead of `left:50% + transform` to avoid WeChat `cover-view` compositing bugs during `setData` re-renders. **Not gradient** — solid fill is the mini-program CTA standard |
| **Center hub page** | `/pages/center-hub/index` — dynamic content: active event card, pending registration status, or empty-state CTA |
| **Routing model** | Center button always `switchTab` to hub (requires `centerHub` in `tabBar.list` — WeChat validates `switchTab` targets against `tabBar.list` even with `custom: true`); hub CTAs `navigateTo` detail pages or `switchTab` to discover |
| **State sync** | Center + badges: `useCustomTabBarSync.ts` calls `Taro.getTabBar(page).syncState(...)` on every `useDidShow` and on data updates while the page is visible. Native side debounces at 50ms with shallow diff to avoid icon flicker. Selection is **not** part of `syncState`: it is route truth, published once per show by the same hook via `setSelected()`, recorded in `lib/navigation/tabBarState.ts`, and retried on `0/16/64/160/400ms` while the native instance is unresolved. `_confirmedSelected` mirrors the last push for the failure-rollback fallback only. Offline state is detected via `wx.getNetworkType` / `wx.onNetworkStatusChange`; `syncState` skips updates while offline and replays the latest pending state on reconnect |
| **Badges** | Notification counts mapped to `discover`, `activities`, `chat` categories. Badge updates use WeChat path syntax (`leftTabs[idx].badgeCount`) to avoid array reconstruction and icon reload flicker |
| **Visibility** | `data.hidden` defaults to `true`; `_reconcileSelection()` reveals and lights the bar at `attached` on any mapped tab route, hides it on a known non-tab route, and leaves it untouched when the page stack is unreadable (the page hook covers that window). Selection is a state paint, not a transition. Opting a NEW route in means adding it to **both** `_routeToIndex` in `src/native-custom-tab-bar/index.js` and `TAB_BAR_ROUTE_INDEX` in `src/lib/navigation/tabBarRouteIndex.ts` (the parity test locks the two together) **and** listing it in `tabBar.list`, then calling `useCustomTabBarSync()` from the page — WeChat only attaches a tab-bar instance to pages in `tabBar.list`. `pages/pool-registration/index` maps to Discover as **inert defence only**: it is deliberately NOT in `tabBar.list`, so no bar is ever attached there; do not add it. Detail, checkout, and session pages (e.g. `event-detail`, `event-ticket-payment`, `matching-status`, `icebreaker-session`, `profile-linked`) remain hidden to preserve focus and avoid ambiguous tab highlights. |
| **Device tiering** | `wx.getSystemInfoSync().benchmarkLevel <= 15` or iOS devices without a `benchmarkLevel` value gate all remaining animation (logo settle, transitions) via `.joy-custom-tab-bar--low-end` |
| **Swipe-back safety** | `pageLifetimes.show` re-runs the idempotent route reconcile (no `setData` when already correct), correcting any drift after swipe-back. It defers the immediate read to a selection push that landed within the last 400ms, because `getCurrentPages()` can still report the outgoing route mid-transition, and always arms the bounded re-read chain (400 ms then 800 ms) that converges once the stack settles. `sheetOpen` is never touched by reconciliation |

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
| **Tap feedback** | `hover-class` on side tabs + center button with `hover-start-time="0"` / `hover-stay-time="100"`. The icon wrap scales (`0.94`) and the label only dims (`0.72`) — no transform on the label, so nothing displaces, and a tap anywhere in the item is acknowledged, not just the icon. Transitions live on base elements (not `hover-class`) for WeChat compatibility |
| **Active tab highlight** | The active background hugs the 64rpx icon wrap (`.joy-custom-tab-bar__item--active .joy-custom-tab-bar__item-icon-wrap`, `rgba(139, 92, 246, 0.10)` + `border-radius: 24rpx`), painted instantly with no transition. The item itself carries no background: the old full-item tile measured 115.5×112rpx around a 48rpx icon and competed with the 154rpx center CTA. Label contrast is measured, not eyeballed — inactive `#59616C` on white = 6.27:1 (was `#9CA3AF` at 2.54:1), active `#7C3AED` on the pill = 5.17:1 (was `#8B5CF6` at 3.84:1). The previous shared sliding `translateX` pill and `pillTranslateX` data field were removed 2026-06-23. Center-hub selection hides the side-tab highlight instead of animating a pill off-screen |
| **PageMorphWrapper immediate mode** | If `isLoading` was never true, the loading layer renders with `transition: none` (`page-morph--immediate`) so cached auth does not flash a loading shell on tab switches |
| **Tab-page entrance** | `.tab-page-enter` animation is gated by `consumeTabEntrance()` in `src/lib/utils/tabEntranceState.ts`; it plays only on the first tab page rendered after app cold start, not on every tab switch |
| **Haptics** | `wx.vibrateShort({ type: 'light' })` on every side-tab tap |
| **Badge pop-in** | `scale(0→1.15→1)` spring animation (200ms) |
| **Center badge pulse** | Continuous `scale` pulse on the center red dot |
| **Cover-image fade-in** | Scoped 200ms opacity fade on specific elements only (global selector removed to prevent re-trigger on every `setData`) |
| **Reduced motion** | `@media (prefers-reduced-motion: reduce)` disables all animations, including `will-change` reset to `auto`; respects system setting |
| **SwitchTab rollback** | Rollback uses `_confirmedSelected` (authoritative, not optimistic) and shows a `切换失败，请重试` toast on `wx.switchTab` fail. An in-flight guard (`_switchInFlight`) prevents concurrent `switchTab` calls; a 2s safety timeout releases the guard. Success/fail tracked via `wx.reportAnalytics` (`mini_program_tab_bar_switch_success` / `_fail`). 180ms double-tap debounce on tap handlers |
| **Sync debounce** | 50ms debounce + shallow diff in `syncState`; path-syntax badge updates prevent flicker |
| **Announcements** | `data.announcement` carries tab-switch confirmations (`已切换到发现`) and feeds the hidden `aria-live` region. Each message is cleared after 1s so a stale line is never re-announced |
| **CSS theming** | 8 brand tokens declared as CSS custom properties on root (e.g. `--jj-primary`, `--jj-secondary`, `--jj-bg-tint-pink`). All hardcoded color values reference these tokens |
| **GPU compositing** | `will-change: transform` / `opacity` / `box-shadow` / `background-color` hints on 7 animated subtrees; reset to `auto` on low-end + reduced-motion |
| **Accessibility** | Hidden `aria-live="polite"` region announces tab switches ("已切换到发现"). Tab items use `role="button"`, `aria-label`, `aria-pressed` |
| **Offline resilience** | `wx.getNetworkType` initial read + `wx.onNetworkStatusChange` listener; `syncState` skipped when offline to avoid stale badge counts and replayed on reconnect |
| **setSelected no-op guard (2026-07-24)** | `setSelected` skips `setData` when already selected + visible, preventing redundant re-renders on same-tab taps |
| **Single-icon src swap (2026-11-22)** | Each tab mounts ONE `<image>`; `src` switches between `icon` and `selectedIcon`. Replaced the 2026-07-24 dual-icon opacity crossfade, whose stacked overlay never painted on device |

---

## Package Loading Strategy

1. **Tab pages** (`discover`, `events`, `connections`, `profile`, `center-hub`) live in the **main package**.
2. **Heavy non-tab flows** are in subpackages:
   - `pages/onboarding` — personality test, profile forms, review.
   - `pages/pool-registration` — pool sign-up (free registration success uses CDN ceremony hero).
   - `pages/matching-status` — match waiting / reveal.
   - `pages/icebreaker-session` — in-event social icebreaker.
   - `pages/profile-linked` — edit-profile, rewards, invite, terms (preloaded from `pages/profile`).
3. **Preload rules** are declared from likely entry pages (`index`, `login`, `event-detail`, `events`, `profile`) before reaching for independent subpackages.
4. Any proposal for independent subpackages must include a self-contained bootstrap plan because `app.ts` and `AuthProvider` centralize app-level providers and auth setup.
5. `useAuth` hydrates from `HYDRATE_AUTH_STORAGE_KEY` (`mj_auth_cache`) via `getStoredAuthUser()` so returning users skip the auth-loading gate on tab switches. `AuthProvider` triggers a background revalidation on mount and on app foreground.

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
| [`../../docs/mini-program/mini-program-data-fetching.md`](../../docs/mini-program/mini-program-data-fetching.md) | React Query key conventions |
| [`docs/TECH_STACK.md`](./docs/TECH_STACK.md) | Deep technical stack reference |
| [`docs/USER_FLOW.md`](./docs/USER_FLOW.md) | Complete user flow mapping |
| [`.github/skills/platform-coordination-protocol/SKILL.md`](../../.github/skills/platform-coordination-protocol/SKILL.md) | Skill: cross-platform coordination |
| [`.github/skills/mini-program-frontend-excellence/SKILL.md`](../../.github/skills/mini-program-frontend-excellence/SKILL.md) | Skill: UI quality, pixel precision, 8rpx rhythm |
| [`docs/DEVICE_QA_CHECKLIST.md`](./docs/DEVICE_QA_CHECKLIST.md) | Pre-release device QA checklist |
| [`docs/LIST_VIRTUALIZATION.md`](./docs/LIST_VIRTUALIZATION.md) | Long-list thresholds and animation budget |
