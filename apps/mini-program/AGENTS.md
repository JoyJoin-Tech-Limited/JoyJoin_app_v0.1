# Mini-Program — Agent Onboarding Guide

> Compact instructions for AI coding agents working on `apps/mini-program` (the WeChat Mini Program). Last updated: 2026-07-01

---

## 0. Before You Code — Mandatory Context Checklist

### Step 1: Load the domain skill

| Area you're modifying | Skill to load (mandatory) |
|----------------------|--------------------------|
| Taro page, component, WXSS, hooks, state design | `mini-program-frontend-excellence` |
| Any user-facing UI in the mini-program | `joyjoin-brand-guidelines` |
| API client, transport layer, auth session, query keys | `platform-coordination-protocol` + `wechat-ecosystem-integration` |
| Mini-program screenshot / preview capture | `mini-program-screenshot-workflow` |
| Onboarding flow, `nextStep` logic, welcome-back | `onboarding-state-architecture` |
| Personality test, archetype display, results | `personality-system` |
| Social Icebreaker (post-match), Mini-Script | `social-icebreaker-domain` + `miniscript-story-framework` |
| Persistent query cache, offline behaviour | (read `apps/mini-program/src/lib/api/persistentCache.ts` directly) |
| Performance, smoothness, device adaptation | `performance-audit` |
| Pre-ship / PR review of UI | `completeness-audit` (pipeline: `ui-layout-audit` → `frontend-design-audit` → `completeness-audit`) |

### Step 2: Pre-implementation checklist

- ☐ Relevant skill loaded
- ☐ No legacy identifiers (§1 below)
- ☐ No imports from legacy top-level `shared/` directory (enforced by `npm run guardrails`)
- ☐ No cross-app imports — only `@joyjoin/shared` or `@shared/*`
- ☐ Brand rules respected (no raw emoji on primary copy, solid `$color-primary` CTAs)
- ☐ Pixel-precision when specs exist; strict 8rpx spacing rhythm otherwise
- ☐ All interactive surfaces have haptics + `hoverClass`
- ☐ `@media (prefers-reduced-motion: reduce)` honoured for any new motion
- ☐ Loading/empty/error states use full-screen centering (`min-height: 100dvh` + flex)

### Step 3: After implementation

- ☐ Run `npm run typecheck -w mini-program`
- ☐ Run `npm run guardrails`
- ☐ For UI changes: run `completeness-audit` (full pipeline)
- ☐ For performance-sensitive changes: run `performance-audit`
- ☐ For docs/AGENTS.md updates: run `docs-sync`

---

## 1. Active vs. Legacy (Do Not Reintroduce)

**Active — use these:**
- App root: `apps/mini-program/src/app.ts` with `AuthProvider`
- Routing helpers: `lib/onboarding/onboardingRoutes.ts` (`MINI_PROGRAM_ROUTES`, `nextStepToMiniProgramRoute`)
- Auth: `hooks/useAuth.ts` + `providers/AuthProvider.tsx` (fail-closed revalidation)
- API client: `lib/api/api.ts` + `lib/api/authSession.ts` (single source of truth)
- Brand logo: `components/ui/BrandLogo.tsx` (NOT raw `<Image src="/assets/joyjoin-logo.webp" />`)
- Icon renderer: `components/ui/JoyJoinIcon.tsx` (NOT raw emoji on primary UI)
- Missing-archetype placeholder: `components/mascot/MissingArchetypePlaceholder.tsx` (JoyJoin logo mark; no initials fallback)
- Tag/pill: `components/ui/Chip.tsx` (L1/L2/L3 levels)
- Mascot: `components/mascot/XiaoyueChatBubble.tsx` (chat-based onboarding removed 2026-05)
- Welcome coupon banner: `components/FirstTimeCouponBanner.tsx` — payment-flow banner for `WELCOME50`/`WELCOME40`; zero external assets, CSS-only (cream bg + decorative circle), counter animation + confetti burst. See root `AGENTS.md` §2 for full spec.
- Welcome gift card: `components/onboarding/WelcomeGiftCard.tsx` — premium coupon card shown on first profile-review view; calls `GET /api/user/welcome-coupon`, displays Lovart coupon illustration + dynamic discount badge, reduced-motion/skeleton states supported.
- Profile-review invite card: `components/onboarding/ProfileReviewInviteCard.tsx` — invitation teaser rendered after the welcome-coupon state settles; uses Lovart `invite-teaser.webp` with CDN→local→BrandLogo fallback, disabled/busy states, haptics, and reveal-triggered predictive Discover shell prefetch.

**Legacy — never use:**
- Chat-based onboarding (Xiaoyue chat UI, registration inline handlers) — only mascot visuals remain
- `/guide` step (removed 2026-05-07)
- Local PNG archetype bundling — use `cdnAsset()` for canvas, local for `<Image>`
- Empty `iconPath` on `tabBarConfig.ts` centerHub — `miniprogram-ci` rejects with `800059`
- Importing from legacy top-level `shared/` (enforced by `npm run guardrails`)

---

## 2. Cold-start auth routing (HARD-WON LESSON — 2026-06-04)

> **The bug:** Registered user opens mini-program → cached auth hydrates instantly → `useDidShow` invalidates and refetches → `pages/index/index.tsx` shows the LandingPage → user taps a CTA before refetch resolves → `Taro.reLaunch` from the still-pending `navigateToMiniProgramNextStep` overrides the CTA's destination → user lands on the wrong screen with a stale 500 toast from a login attempt that was overridden.

### The fix (in two parts)

1. **No re-entrancy guard in `AuthProvider.tsx`.** Do NOT add a `isFirstShowRef` / "skip first fire" guard. The bridge must refetch on **every** `useDidShow` (cold start + foreground). The earlier `isFirstShowRef` was the bug — it prevented fail-closed revalidation.

2. **Gate the landing page in `pages/index/index.tsx` via `useAuthGate(auth)`.** The gate logic lives in `src/hooks/useAuthGate.ts` (`useAuthGate`). While `auth.isLoading` is true, render a `LoadingScreen` instead of `MiniProgramLandingPage`. The user cannot race the in-flight revalidation by tapping a CTA.

### Hard cap on the gate (do not remove)

- `INDEX_GATE_TIMEOUT_MS = 4_000` (4 seconds)
- Below `useAuth`'s `AUTH_REQUEST_TIMEOUT_MS` (8s) so the gate releases before the query itself
- On timeout, render an inline `<View className='index-gate__timeout'>` with:
  - **重试** (primary, calls `queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY })`)
  - **跳过** (secondary, calls `queryClient.cancelQueries(...)` to force-resolve with cached state)
- Both CTAs emit `haptics('light')` and `logInfo('[IndexGate] ...')`
- Worst case: user sees the CTA within 4s and can manually recover

### Why this is in `pages/index/index.tsx`, not `AuthProvider`

A global overlay from `AuthProvider` would interfere with all pages (including those with their own loading/empty states). The current location is bounded to the cold-start landing surface only. If you need a global overlay, see `discover` / `matching-status` patterns first and design carefully.

### Observability (T1.2, T1.3, T3.6)

`AuthProvider.AuthRefreshBridge` logs revalidation start, success, and failure with `durationMs`. Each also fires an analytics event to `POST /api/analytics/auth` via `authAnalytics.track(...)` for structured querying — logs remain as fallback.

The index gate (`src/hooks/useAuthGate.ts`, consumed by `pages/index/index.tsx`) also logs and tracks:
- `authAnalytics.track('gate_timeout')` when the 4s ceiling trips
- `authAnalytics.track('gate_retry')` on retry CTA
- `authAnalytics.track('gate_dismiss')` on dismiss CTA

Events land in `discover_analytics_events` with `poolId = null`. Client module: `src/lib/analytics/authAnalytics.ts`. Server route: `/api/analytics/auth` in `apps/server/src/routes/domains/analytics.ts`.

---

## 3. Common Taro / WeChat pitfalls (with file:line)

- **`<ScrollView>` inside a flex parent** will not scroll unless the parent has `min-height: 0` or explicit height. `LocationFilterDrawer` is the canonical fix.
- **`Taro.pageScrollTo` does NOT work inside `<ScrollView>`** — use `scrollIntoView` prop with the target element's `id` (no `#` prefix).
- **WeChat keeps pages in the navigation stack alive** (hidden, not unmounted). Transient flags like `isExiting`/`isSubmitting` survive swipe-back. Always reset in `useDidShow` via `useResetOnShow` from `src/hooks/useResetOnShow.ts`.
- **Canvas `drawImage` requires a network-resolvable URL** — local bundled paths (e.g., `/pages/onboarding/assets/...`) work for `<Image>` but NOT for canvas. Pass `visual.asset` (CDN URL) to canvas.
- **`miniprogram-ci` rejects empty `iconPath`** on `tabBarConfig.ts` centerHub with `800059`. Use a placeholder; the custom tab bar component renders the center button independently.
- **Tab bar geometry**: `$tab-bar-height: 128rpx`; root footprint: `$tab-bar-root-height: 182rpx`; center CTA is a **root sibling** of `.joy-custom-tab-bar__surface`, not nested inside.
- **Tab bar route guard:** the native custom tab bar keeps an explicit `TAB_BAR_PAGE_PATHS` allow-list sourced from `src/lib/navigation/tabBarConfig.ts` and hides itself when attached to a non-tab route (e.g., the landing page), preventing the tab bar from leaking onto non-tab pages. To opt a top-level conversion page (e.g., `pool-registration`) into the tab bar, add its route to `_routeToIndex` in `src/native-custom-tab-bar/index.js` and to `TAB_INDEX_BY_PAGE_PATH` in `src/hooks/navigation/useCustomTabBarSync.ts`, then call `useCustomTabBarSync()` from the page. Detail, checkout, and session pages stay hidden to avoid ambiguous highlights.
- **`<ChallengeCardBgImage>`** (WeChat-safe `<Image>` component) must be used for challenge-card backgrounds — CSS `background-image` with CDN URLs is flaky in WeChat runtime.
- **ArchetypeSpritesheet** uses the same `<Image>` + `overflow:hidden` + `transform: translate()` pattern for spritesheet region crops — CSS `backgroundImage: url()` is unreliable in WeChat. See `apps/mini-program/src/pages/onboarding/personality-test/results/ArchetypeSpritesheet.tsx`.
- **WeChat WXSS silently drops `hsla()`** — all color values emitted from shared `@shared/archetypeColors` must use `rgba()` via `formatHSLAsRGBA()`. Canvas calls use `toCanvasRGBA()` from `canvasHelpers.ts` at `apps/mini-program/src/lib/utils/canvasHelpers.ts` (shared by both portrait and square poster renderers).
- **Page-level loading/empty/error state blocks** must use `min-height: 100dvh` + flex centering. `@include scroll-view-centered-state` from `_mixins.scss` is the canonical helper for states inside `<ScrollView>`.
- **Shimmer animations should use GPU-safe `opacity` pulse** instead of `background-position` on linear gradients. The `background-position` approach triggers paint on every frame, while opacity pulse only composites. Pattern: `animation: shimmer-pulse 1.5s ease-in-out infinite` with keyframes `0%/100% { opacity: 0.25; } 50% { opacity: 0.65; }`. See `apps/mini-program/src/pages/onboarding/profile-review/index.scss` for a canonical example replacing a `background-position` shimmer with `opacity` pulse (2026-06-10). **The `FootprintOracleCard` matched-state shimmer was migrated to opacity-only in 2026-06-30.**
- **Hero-card flex-wrap layout for text overflow prevention**: When a card has avatar + text side-by-side + tags below, use `flex-wrap: wrap` on the row container. Put copy in a `flex: 1` element (left), avatar in a fixed-width element (right), and tags in a `width: 100%` element below. All text-bearing children must have `overflow: hidden; text-overflow: ellipsis` (single-line) or `word-break: break-word; overflow-wrap: break-word` (multi-line). See `apps/mini-program/src/pages/onboarding/profile-review/index.tsx` hero-card section (2026-06-11).
- **`AnalyzingAnimation` must be the sole owner of reveal timing**: Do not set reveal-ready state (`isRevealReady`) in a separate `useEffect` with a hardcoded timeout — this creates a race where the animation is still running but the content is already shown. `AnalyzingAnimation` exposes `minDuration` (1200ms) and `onComplete` callback; set `isRevealReady = true` only inside `onComplete`. User skip is handled by AnalyzingAnimation's internal skip button (enabled after 600ms). See `apps/mini-program/src/pages/onboarding/profile-review/index.tsx` (2026-06-11).
- **`useResetOnShow` must include animation-related state for swipe-back safety**: When using a reveal animation (`AnalyzingAnimation.onComplete` sets `isRevealReady`), add `setIsRevealReady` as an argument to `useResetOnShow(setIsSubmitting, setIsPageExiting, setIsCelebrating, setIsRevealReady)`. Without this, a user who swipes back and re-enters will see the content already revealed (no animation replay). See `apps/mini-program/src/hooks/useResetOnShow.ts` and `apps/mini-program/src/pages/onboarding/profile-review/index.tsx` (2026-06-11).
- **CSS custom properties for dynamic values are unreliable in WeChat runtime** — prefer inline `style` transforms or pre-computed SCSS classes for per-frame updates (e.g. slider badge position). Static theming tokens on the native custom tab bar are the exception because they live in the native `cover-view` layer.

---

## 4. Asset loading strategy (HARD rules)

- **Build-time CDN URL guarantee**: `config/index.ts` defaults `TARO_APP_CDN_BASE_URL` to `https://joyjoinapp.com/static` in production; CI workflow has the same fallback. Source code must use `cdnAsset()` / `localAsset()` helpers — never hardcode the CDN hostname.
- **Two-tier brand font**: minimal Alimama subset (66KB) bundled; full font (621KB) loads from CDN with 500ms defer.
- **Quicksand English font** (256KB) bundled and loaded on app launch.
- **Slot machine archetype spritesheet** (`archetype-spritesheet.webp`) — bundled at `/pages/onboarding/assets/archetypes/` (subpackage, preloaded at landing).
- **Full-size archetype images** — served from CDN as WebP. Preload during idle time.
- **Canvas poster** — WebP primary with **CDN PNG fallback**. Local PNGs are NOT bundled.
- **Promo banner** (`HeroPromoBanner`): CDN-only (`/assets/promo/banner-hero-lovart-v1.webp`) to keep the main package under the 2 MB ceiling; persistent asset cache reduces repeat network reads. Gradient overlay still renders while the image loads. Kill switch: `PROMO_BANNER_ENABLED` (default `true`).
- **Welcome coupon banner** (`FirstTimeCouponBanner`): zero external assets, zero package weight. Solid cream bg + CSS decorative circle. Archetype-tinted via inline `hsla()`. Analytics: `welcome_coupon_banner_impression` + `welcome_coupon_banner_tap` via `discoverAnalytics`.
- **Tab bar logo**: dedicated 128×128 `joyjoin-logo-tab.png` (19KB) — NOT the full `joyjoin-logo.png` (596KB).
- **Mascot sprite bundle policy (2026-06-18)**: only 6 core Xiaoyue sprite states (`welcome`, `idle`, `coach`, `loading`, `listening`, `thinking`) are bundled locally (~235KB); the remaining 14 states are CDN-primary. `XiaoyueSpriteAnimator` tries CDN first and falls back to the local bundled `.webp` on `onError`.
- **Bundled icon density policy (2026-06-22)**: all bundled icon tiers ship as a single high-resolution bare `.webp` per asset (no `@2x`/`@3x` variants). WeChat's runtime auto-resolves density suffixes; mixed naming causes 404 fallbacks to emoji. `validate:icon-transparency` now fails the build if any `src/assets/icons/**/*.webp` contains `@`.
- **Interest taxonomy v2.0 illustrations (2026-06-18)**: 48 active interests across 6 macro categories are CDN-only. Canonical `imageUrl` lives in `packages/shared/src/interests.ts`; mini-program resolves via `getInterestAssetUrl()` → `cdnAsset()`. 4 refreshed category icon sets are bundled locally with CDN fallback copies.
- **Never** bundle local PNG archetype art. If canvas needs PNG, use `cdnAsset('/assets/personality/archetypes')`.
- **Archetype images must not have text overlays** — no archetype-name initials or watermarks on hero art.
- **`MissingArchetypePlaceholder`** (`apps/mini-program/src/components/mascot/MissingArchetypePlaceholder.tsx`) is the canonical fallback for missing/failed archetype images: it renders the JoyJoin logo mark via `BrandLogo` and must not show initials or text overlays.
- **Batch C + D ceremony/badges (2026-06-04 Path B local-bundle → 2026-06-16 CDN)**: 8 ceremony WebP in `src/assets/ceremony/` + 9 badge WebP in `src/assets/badges/` (q=55, 600px) are uploaded to CDN; they are no longer copied to `dist/`. Registries in `src/lib/ceremonyHeroes.ts` + `src/lib/milestoneBadges.ts` use `cdnAsset()` (NOT `localAsset()`). PNG masters live in `assets-source/lovart/batch-{c,d}/` and are NOT bundled. Re-encode via `node scripts/optimize-ceremony-batch-c.mjs` / `node scripts/optimize-badges-batch-d.mjs` before committing new tiles, then upload via the CDN workflow.
- **Phase 1 asset/CDN migration (2026-07-06)**: matching-status puzzle prelude pieces are bundled as WebP only; source PNGs + `_contact-sheet.png` live in `assets-source/lovart/puzzle/`. `xiaoyue-coach-guide.webp`, pool-registration ceremony heroes, and the Discover hero promo banner are CDN-only (subpackage copy remains for pool-registration offline resilience).
- **Phase 2 asset/CDN migration (2026-07-07)**: `flow-icons` (center-hub / connections) and `rating-faces` (event feedback) are CDN-only; the bundled local copies were removed from `dist/` via `clean:cdn-assets` and the `config/index.ts` copy patterns were dropped. Emoji fallback remains for both. Main package compressed size after Phase 2: **1.73 MB**.

Canonical CDN base URL for all phases: `https://joyjoinapp.com/static`.

---

## 5. Brand & copy governance

- **CTAs use solid `$color-primary` (`#8B5CF6`) — no gradient.** Gradient was purged from all mini-program CTAs.
- **Bottom action bar pattern**: solid white (`$color-surface`) + subtle top shadow (`rgba($color-text-primary, 0.04)`).
- **Empty-state typography standard (2026-06-18):**
  - Use `XiaoyueEmptyState` for mascot-led empty/loading/error states (Connections, Center Hub).
  - Use `StatusCard` for Lovart-hero empty/error states (Discover, Events).
  - Titles: Alimama brand font, `line-height ≥ 1.4`, bold.
  - Subtitles/body: system UI font, `line-height ≥ 1.6`.
  - Title-to-subtitle spacing: 16–24rpx (`$spacing-sm` to `$spacing-md`).
- **Zero-emoji on primary copy**. Use `JoyJoinIcon` for reactions, categories, intents, achievements, chemistry badges, status icons, phase emblems, info labels.
- **Xiaoyue copy**: subject to `xiaoyue-writing-craft` 9 axioms. Use `getErrorMessage`, `getEmptyStateMessage`, etc. from `packages/shared/src/copy/`.
- **Error-state ARIA**: `role='alert'` + `aria-live='polite'` for inline error states; `role='status'` + `aria-live='polite'` + `aria-busy='true'` for loading screens (e.g., `JoyJoinLoadingScreen`).
- **Haptics are mandatory** on non-onboarding interactive surfaces. Intensity: `light` (secondary), `medium` (primary CTA), `success` (emotional peaks).
- **Completion celebration micro-interaction**: After a final onboarding step API call succeeds, set `isCelebrating` state → `haptics('success')` → wait 500ms → navigate. During the delay, disable the CTA and change text (e.g., "入场卡已确认") for a brief emotional peak before transitioning. Reset `isCelebrating` via `useResetOnShow` for swipe-back safety. See `apps/mini-program/src/pages/onboarding/profile-review/index.tsx` `handleComplete` (2026-06-10).
- **hoverClass on View-based interactive elements** — `transition: background 0.12s ease` + `rgba($color-primary, 0.06–0.08)` tint.
- **`$font-mono` token (2026-06-28):** Added to `src/styles/_variables.scss` for monospace numeric readouts (e.g., segmented countdown clocks). Use it for any numeric display that needs tabular alignment.

---

## 6. Persistent Query Cache (Tier 2 offline)

- **Whitelisted keys only**: `['mini-program', 'event-pools']` (`POOLS_QUERY_KEY`) and `['mini-program', 'joined-events']` (`JOINED_EVENTS_QUERY_KEY`).
- **Schema version**: `CACHE_SCHEMA_VERSION = 1` — bump on response shape change.
- **TTL**: 4 hours (`MAX_CACHE_AGE_MS`).
- **Size cap**: 75KB total (UTF-8 byte count).
- **False-freshness guard**: hydration passes `{ updatedAt: entry.timestamp }` to `queryClient.setQueryData` so TanStack Query knows the true data age.
- **Mutation-triggered eviction**: call `evictPersistedQuery(key)` after any mutation that changes persisted data.
- **Multi-user safety**: `clearPersistentCache()` inside `clearMiniProgramAuthSession({ mode: 'hard' })` (logout).
- **Never** inline `Taro.setStorageSync` calls in page components — go through `persistentCache.ts`.

---

## 7. Database schema drift guard

- Server startup calls `validateDbSchema()` before accepting traffic.
- Always run `npm run db:push` (local) or apply migrations (production) before deploying code that adds new columns.

---

## 8. Commands

```bash
npm run typecheck -w mini-program       # tsc --noEmit
npm run guardrails                      # env, secrets, legacy, import checks
npm run dev:weapp --workspace=mini-program   # Taro watch build
npm run check:package-size -w mini-program   # zip-compressed size vs 2MB WeChat limit
```

**WeChat Mini-Program upload (开发版)**: CI auto-uploads on push to main. Manual upload requires `--appid` flag (`miniprogram-ci` will not auto-read from `project.config.json`):

```bash
npx miniprogram-ci upload \
  --appid wx5a038ee6dee12032 \
  --pp apps/mini-program \
  --pkp <private-key-file> \
  --uv "1.0.$(date +%Y%m%d).$(date +%H%M)" \
  --ud "dev build" \
  --rp 1
```

---

## 9. Where to put new code

- **New page**: `apps/mini-program/src/pages/<feature>/index.tsx` (+ `index.scss`).
- **New shared component**: `apps/mini-program/src/components/<group>/<Name>.tsx` (e.g., `ui/`, `mascot/`, `profile/`, `loading/`, `pool/`).
- **Reusable logic**: `apps/mini-program/src/hooks/` (one folder per feature area).
- **API client / transport**: `apps/mini-program/src/lib/api/`.
- **Cross-app types / Zod schemas / DTOs**: `packages/shared/src/` (not in mini-program).

---

## 10. Cross-references

- Root: `AGENTS.md` — repo-wide onboarding, command reference, harness/guardrails philosophy
- Shared: `packages/shared/AGENTS.md` — `packages/shared` ownership
- Admin: `apps/admin-client/AGENTS.md` — Recharts + shadcn admin portal patterns
- Docs index: `docs/README.md`

---

## 11. Shared animation hooks

- **`useMiniRevealMotion.ts`** (`src/hooks/useMiniRevealMotion.ts`) — shared reveal-animation hook consumed by `AnalyzingAnimation` (results page), profile-review stagger entries, personality-test card tilt, and squad-unboxing drag-reveal. Provides `shouldReduceMotion` boolean. **Honors only the OS-level `Taro.getSystemInfoSync().reduceMotion` accessibility setting.** The previous benchmark-based low-end gate (`LOW_MOTION_BENCHMARK_LEVEL`) was removed in 2026-06-18 because product defaults now mandate carousel and slot animations; `useDeviceTier()` remains available for surfaces that still need degradation-aware gating.

---

## 12. Events / Footprint tab

- **`FootprintOracleCard`** (`src/components/events/FootprintOracleCard.tsx`) — interactive event card for the "足迹" tab list. Wraps `EventSummaryCard` in a two-rail layout: left body carries the status pill, title, date/time/location; right rail carries a compact segmented countdown, group-size hint, price, or a "待公布" placeholder when none are available. Haptic feedback on tap; `hoverClass` pressed state; index-based entrance delay; reduced-motion/degradation tier disables entrance delay.
- **`EventSummaryCard`** (`src/components/events/EventSummaryCard.tsx`) — shared presentational base for `FootprintOracleCard` and any read-only confirmation surfaces (e.g. pool-registration terminal states). Renders the same gradient shell, status pulse pill, segmented countdown, title, date/time/location meta, and corner vignette. Supports `interactive` prop to toggle tap affordances and `railMode` + `rightRail` props for the two-rail layout. Title clamps to 2 lines with `keep-all` word breaking to avoid 孤字.
- **`EventCountdownClock`** (colocated in `EventSummaryCard.tsx`) — memoized segmented clock sub-component so the parent card does not re-render every second.
- **`useEventCountdown`** (`src/hooks/useEventCountdown.ts`) — visibility-aware countdown hook returning `display`, structured `segments` (`days/hours/minutes/seconds/progress`), `isUrgent`, `hasStarted`, and `isLive`. Ticks are gated by in-viewport IntersectionObserver state, app hide/show lifecycle, `prefers-reduced-motion`, and `useDeviceTier().isDegradation`.
- **Venue disclosure rule:** Venue location is hidden when status is `registered`/`pending`/`upcoming`; disclosed only for `confirmed` or `venue_unlocked`. The raw `matched` status means the group has been formed but the venue is still being assigned, and the server derives the user-facing `displayStatus` from `matchStatus`, `poolStatus`, `venueAssignmentStatus`, and `venueName`. Terminal pool states (`completed`/`cancelled`) override the registration-level status. The card always renders event type + city/district and only appends the venue name once unlocked.
- **Two-rail accessibility:** The right rail itself is not `aria-hidden`; only the decorative `›` cue is hidden. `FootprintOracleCard` builds a `railAriaLabel` from the rail contents (countdown, group size, price) and appends it to the card's accessible name, so screen readers announce the same facts sighted users see.
- **Corner vignette layout guard:** In rail mode the Lovart event-type vignette is clamped to `168rpx × 168rpx` so it stays inside the right rail and never overlaps the left-body text.
- **Terminal-state detection:** `FootprintOracleCard` consumes `isJoinedEventTerminal()` from `eventDisplay.ts` instead of maintaining its own status list.
- **`formatEventDateTime`** (`src/lib/utils/eventDisplay.ts`) — renders `今天`/`明天`/`后天` prefixes for near-term event dates.
- **`getSystemReducedMotion()`** (`src/lib/utils/accessibility.ts`) — canonical helper for reading the OS-level reduced-motion preference. Prefer this over duplicating `Taro.getSystemInfoSync()` reads.
- **Accessibility:** The countdown clock uses `aria-live="polite"` for screen-reader announcements.

## 13. Pool-registration terminal states

- **`PoolRegistrationTerminalStates.tsx`** (`src/pages/pool-registration/components/PoolRegistrationTerminalStates.tsx`) owns the loading, empty/error, already-joined, and success states for pool registration.
- **Already-joined and success screens** reuse `EventSummaryCard` so the event summary is visually identical to the "我的足迹" card.
- **Read-only card mode:** terminal-state cards do not pass `interactive`, so they have no hover state, tap hint, or navigation.
- **Scroll safety:** both terminal states wrap the centered card in `<ScrollView className='pool-reg__scroll'>` so the CTA and any follow-up content (e.g. `ChemistryMiniGrid`) remain reachable on short phones.
- **Haptics:** primary CTAs (`去我的足迹查看状态`) use `haptics('medium')`; the secondary "开启匹配结果通知" button uses `haptics('light')`.
- **Analytics:** terminal states emit `registration_terminal_state_view` on mount and `registration_terminal_cta_tap` / `registration_terminal_notify_tap` on tap.
- **Notification button state:** the parent page (`pool-registration/index.tsx`) tracks `isEnablingNotifications` / `notificationsEnabled`; the button shows a loading spinner during the WeChat subscribe request and becomes disabled with "已开启提醒" after success.

## 14. Discover / OracleCard

- **`OracleCard`** (`src/components/discover/OracleCard.tsx`) — primary pool card on `pages/discover/index`. 6-layer visual hierarchy: L1 hero message, L2 topline (pulse + countdown), L3 decision facts, L4 title, L5 social-proof teaser, L6 progress bar + CTA. Per-pool 4-branch narrative pivot (empty/rare/present/dominant). Full-pool disabled state with grey CTA + "已满员". High-chemistry celebration badge when ≥3 high-match archetypes.
- **Corner registration-count badge (2026-07-01):** Top-right warm beige pill that overlaps the Lovart event-type vignette. Shows real participant count when `currentParticipants > 0` and the pool is not full. Event-type-aware copy: `饭局` → "X 人入座中", `酒局` → "X 人已入席", others → "X 位伙伴已加入". Count capped at `999+` for predictable pill width.
- **Badge color:** Number uses `getContrastSafeArchetypeColor(userArchetype)` when the user's archetype is known; otherwise falls back to the card's `accentFamily` color. No artificial urgency colors (red/orange) — signal is factual, not scarcity-driven.
- **Feature flag:** Kill-switched via `user.features.oracleCardCornerStatEnabled` (env `ORACLE_CARD_CORNER_STAT_ENABLED`, default `true`). The page passes the flag into `OracleCard`; the component defaults to `true` when absent.
- **Animation / performance:** Badge entrance is a single pop-in (`transform + opacity`). Count-up animation is intentionally omitted to reduce noise and paint cost. Animation is suppressed under `prefers-reduced-motion` or on degradation-tier devices via `getSystemReducedMotion()` + `useDeviceTier().isDegradation`.
- **Layout safety:** All card text layers reserve vertical space so the badge never overlaps readable copy. The badge sits inside the vignette's safe zone; vignette remains visible behind the translucent pill.
- **Skeleton state:** A shimmer placeholder pill renders while pool data is loading, gated by the same reduced-motion / degradation rules.
- **Analytics:** `corner_badge_impression` once per mount (if count > 0), `corner_badge_live_update` when count changes while mounted, and `pool_card_tap` carries `hasCornerCount` + `cornerCount`.
- **Accessibility / ARIA:** Card keeps `role='button'`, `aria-label` includes the participant count when badge is shown, and `aria-disabled` is set when full or disabled. Tap target remains ≥88rpx.
