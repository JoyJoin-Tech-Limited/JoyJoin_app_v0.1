# Mini-Program — Agent Onboarding Guide

> Compact instructions for AI coding agents working on `apps/mini-program` (the WeChat Mini Program). Last updated: 2026-07-31

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
- ☐ **For any layout, spacing, animation, or visual-state change: build and verify in WeChat DevTools (or real device) across all relevant states (loading, empty, error, happy path, and every `flowState` / screen variant). Automated checks cannot catch overlap, clipping, or collapsed offsets.**

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
- Welcome coupon banner: `components/FirstTimeCouponBanner.tsx` — payment-flow banner for the canonical `WELCOME20` (fixed ¥20 off) and legacy `WELCOME50`/`WELCOME40` coupons; fixed-amount mode renders 「首单立减 ¥20」/「立省 ¥20」, percentage mode keeps the 折 rendering. Zero external assets, CSS-only (cream bg + decorative circle), counter animation + confetti burst. See root `AGENTS.md` §2 for full spec.
- Welcome gift card: `components/onboarding/WelcomeGiftCard.tsx` — Profile Review uses the compact, read-only in-poster variant (2026-10-30). `GET /api/user/welcome-coupon` awards/refetches the actual WELCOME-family coupon; success says「见面礼已放入权益」with dynamic discount/validity, loading is bounded「确认中」, and failure is a safe non-blocking retry row. Entry remains insight-gated (rows + ≥1.5s, 10s cap; error/reduced-motion fast paths). Claim diagnostics are whitelist-only; there is no decorative tap target and no dependency on UnboxingCeremony.
- Entry-card insight reveal: `components/onboarding/InsightRevealCard.tsx` — the 悦仔的观察 section of profile-review (sprint `entry-card-insight-v2`, 2026-10-14). Renders the v2 three-line reveal (observation → inference → optional reveal, server `profile-tagline-v2`): deterministic observation + evidence pills land first (pills are chrome-less citations — 8rpx dot + 「来自你的选择」, 120ms/60ms micro-beats), LLM lines rise from dual-bar skeletons at a 420ms stagger with **only the final row** firing `haptics('success')`; reveal row carries the peak typography (32rpx display font + crescendo margin + optional `accentColor` inheritance from the themed poster + a 「 quote glyph — one, never per-row). AIGC label is ONE card-footer aggregate (fail-closed: only when a landed row has `aigc=true` and `aigcLabelsEnabled`) beside the text-link report button. **Card-level feedback (P1, 2026-11-19):** after the whole reveal lands, ONE footer asks 「这几句像你吗？」 with a two-option segmented control 「挺像的」/「不太像」 (88rpx tap height, selected primary fill + check, other muted, then 「谢谢，悦仔会记住」) → `haptics('light')` + anonymous `insight_line_feedback` `{role, vote, lineIndex, shape}` keyed to the primary reveal row; once per visit (replay-nonce reset); v2 shape only. Reduced-motion = fully static settle. Absent/empty `lines` or `entryCardInsightV2Enabled=false` → legacy single-line `insightLine` UI with section-level label and 200ms gift timing. Emits `insight_reveal_complete` (shape/lineCount/hasReveal/fallbackUsed/latencyMs, once per visit).
- Entry-card share poster: `components/onboarding/InsightShareEntry.tsx` + `lib/onboarding/insightPoster.ts` + `lib/onboarding/useInsightPosterShare.ts` — quiet 「存下这张卡」 entry inside the unified poster, before the folded details (sprint `insight-share-poster`, 2026-10-15). Fail-closed visibility: `isV2Insight` && all rows landed (`insightRowsLanded`, same signal as gift timing) && `visual !== null` && flag on. Canvas 1080×1560 (results portrait convention, legacy `createCanvasContext`, hidden `<Canvas>` = bitmap size, offscreen SCSS): archetype art + displayName + all lines + evidence + QR band (`fetchShareQrCodeImage()` fail-open — copy-only band when unavailable; temp file `unlinkSync` in generation finally) + AIGC 「内容由 AI 生成」 baked iff aigc lines present && `aigcLabelsEnabled`. **Privacy hard rule:** 小档案 fields structurally excluded from the builder input and never passed to canvas primitives (spy-locked); report affordance stays on-screen, never baked. Per-tap regeneration via `exportCanvasWithRetry` (60s auto-unlink semantics); permission chain `getSetting→showModal→openSetting`; action sheet 保存相册/分享/预览; telemetry `insight_poster_created` + `insight_poster_shared` (`option:'menu'|'album'`; menu cancel ≠ failure). Zero incentive wording anywhere (WeChat 诱导分享 ban). Style tickets: register new selectors in `scripts/verify-subpackage-styles.mjs`; results-page share files are the hardened active reference as of 2026-11-03 (honest omitted-data composition, QR copy-only fallback, flow-owned temp cleanup) — do not extract shared primitives from them without porting their focused tests.
- Profile-review completion (2026-10-30): `pages/onboarding/profile-review/useProfileReviewCompletion.ts` dedupes completion/navigation across same-tick taps and WeChat hide/show, keeps the confirmed server mutation latched, and retries navigation without repeating completion. The poster shows an opaque「入场卡已生效」state for 720ms (zero artificial delay under reduced motion), then follows the response's server `nextStep`; nullish responses alone trigger `getUserState`. The page is a fixed `100dvh` shell with the `ScrollView` as the only scroller; the CTA is a full-width white action bar outside the `ScrollView`, so expanding content can never push it below the viewport. The entry card now runs five chapters — identity (name / dot-joined 性别·年龄·城市 / archetype seal / rarity), 小档案 (职业·行业 + optional lifeStage, one 修改资料 action; hidden when empty), 想找 (dot-joined intents), 兴趣热量 (up to 4 rows, 120×8rpx absolute-level bars + 感兴趣/很热衷/必聊项 + 共 N 个, with loading/error/empty states), 悦仔的观察 (moved below the facts; island 24rpx radius / 0.72 fill) — then one 88rpx footer row (存下这张卡 inline + 完整小档案 fold + 家乡·学历 hint). A quiet 排桌参考 note sits outside the card. A dog-ear entry opens the card-back `ProfileArchiveSheet` (read-only Taro `ScrollView`, 32×4rpx accent section rules, one merged `仅自己可见 · 不会出现在分享海报里` line, content-sized 58dvh-capped body with a 5-field grid (行业 full-width), no footer CTA; `accentSurface` rides `background-image` over an opaque surface base); the full profile also remains in 「我的」. `ProfileReviewInviteCard`, the full-screen UnboxingCeremony, and the 140rpx footer reserve are no longer mounted on this page. Their inactive components/assets/tests remain; Discover shell prefetch still runs once from the actual poster reveal. The v2.1 card adds a category-heat sentence under the heat rows (top 2 macro categories) and a 相处方式 line sourced from the authenticated `GET /api/assessment/result` (max 2 traits, deviation ≥8, no scores; 404 hides the line).

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

- `INDEX_GATE_TIMEOUT_MS = 2_500` (2.5 seconds)
- Below `useAuth`'s `AUTH_REQUEST_TIMEOUT_MS` (8s) so the gate releases before the query itself
- On timeout, render an inline `<View className='index-gate__timeout'>` with:
  - **重试** (primary, calls `queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY })`)
  - **跳过** (secondary, calls `queryClient.cancelQueries(...)` to force-resolve with cached state)
- Both CTAs emit `haptics('light')` and `logInfo('[IndexGate] ...')`
- Worst case: user sees the CTA within 2.5s and can manually recover

### Why this is in `pages/index/index.tsx`, not `AuthProvider`

A global overlay from `AuthProvider` would interfere with all pages (including those with their own loading/empty states). The current location is bounded to the cold-start landing surface only. If you need a global overlay, see `discover` / `matching-status` patterns first and design carefully.

### Observability (T1.2, T1.3, T3.6)

`AuthProvider.AuthRefreshBridge` logs revalidation start, success, and failure with `durationMs`. Each also fires an analytics event to `POST /api/analytics/auth` via `authAnalytics.track(...)` for structured querying — logs remain as fallback.

The index gate (`src/hooks/useAuthGate.ts`, consumed by `pages/index/index.tsx`) also logs and tracks:
- `authAnalytics.track('gate_timeout')` when the 2.5s ceiling trips
- `authAnalytics.track('gate_retry')` on retry CTA
- `authAnalytics.track('gate_dismiss')` on dismiss CTA

Events land in `discover_analytics_events` with `poolId = null`. Client module: `src/lib/analytics/authAnalytics.ts`. Server route: `/api/analytics/auth` in `apps/server/src/routes/domains/analytics.ts`.

---

## 3. Common Taro / WeChat pitfalls (with file:line)

- **`<ScrollView>` inside a flex parent** will not scroll unless the parent has `min-height: 0` or explicit height. `LocationFilterDrawer` is the canonical fix.
- **WeChat ignores `padding` on the native `<ScrollView>` element in webview rendering mode** (vConsole warning: "the padding property is not yet supported in webview rendering mode"). DevTools/H5 render it, device silently drops it. Padding must live on an inner wrapper `View` (pattern: `&__scroll-inner`; static non-scrolling state shells use a `--static` modifier). Canonical examples: `pages/icebreaker-session`, `pages/matching-status`, `pages/event-detail`.
- **`Taro.pageScrollTo` does NOT work inside `<ScrollView>`** — use `scrollIntoView` prop with the target element's `id` (no `#` prefix).
- **WeChat keeps pages in the navigation stack alive** (hidden, not unmounted). Transient flags like `isExiting`/`isSubmitting` survive swipe-back. Always reset in `useDidShow` via `useResetOnShow` from `src/hooks/useResetOnShow.ts`.
- **Canvas `drawImage` requires a network-resolvable URL** — local bundled paths (e.g., `/pages/onboarding/assets/...`) work for `<Image>` but NOT for canvas. Pass `visual.asset` (CDN URL) to canvas.
- **`miniprogram-ci` rejects empty `iconPath`** on `tabBarConfig.ts` centerHub with `800059`. Use a placeholder; the custom tab bar component renders the center button independently.
- **Tab bar geometry**: `$tab-bar-height: 128rpx`; root footprint: `$tab-bar-root-height: 182rpx`; center CTA is a **root sibling** of `.joy-custom-tab-bar__surface`, not nested inside.
- **Tab bar route guard:** the native custom tab bar resolves its own selection and visibility from the route (`_reconcileSelection()` is the only route-derived writer) and hides itself when attached to a non-tab route (e.g., the landing page), preventing the tab bar from leaking onto non-tab pages. Its `getCurrentPages()` read is **not trustworthy on its own**: a tab bar mounts *before* its page's `onLoad`/`onShow` and hidden tab pages are dangling pages outside the stack, so attach/show report the tab the user is leaving — never treat that read as final, and never remove the deferred `_armRouteRecheck()` pass (a lost page-hook push used to leave 足迹 lit as 连接 permanently; `tabBarBehavior.test.ts` → `route-truth settle re-check` locks it). To opt a top-level conversion page (e.g., `pool-registration`) into the tab bar, add its route to `_routeToIndex` in `src/native-custom-tab-bar/index.js` **and** to `TAB_BAR_ROUTE_INDEX` in `src/lib/navigation/tabBarRouteIndex.ts` (both maps are locked together by `tabBarRouteIndexParity.test.ts`), then call `useCustomTabBarSync()` from the page. Detail, checkout, and session pages stay hidden to avoid ambiguous highlights.
- **`<ChallengeCardBgImage>`** (WeChat-safe `<Image>` component) must be used for challenge-card backgrounds — CSS `background-image` with CDN URLs is flaky in WeChat runtime.
- **ArchetypeSpritesheet** uses the same `<Image>` + `overflow:hidden` + `transform: translate()` pattern for spritesheet region crops — CSS `backgroundImage: url()` is unreliable in WeChat. See `apps/mini-program/src/pages/onboarding/personality-test/results/ArchetypeSpritesheet.tsx`.
- **WeChat WXSS silently drops `hsla()`** — all color values emitted from shared `@shared/archetypeColors` must use `rgba()` via `formatHSLAsRGBA()`. Canvas calls use `toCanvasRGBA()` from `canvasHelpers.ts` at `apps/mini-program/src/lib/utils/canvasHelpers.ts` (shared by both portrait and square poster renderers).
- **Page-level loading/empty/error state blocks** must use `min-height: 100dvh` + flex centering. `@include scroll-view-centered-state` from `_mixins.scss` is the canonical helper for states inside `<ScrollView>`.
- **Safe-area mixins override preceding `padding-top` / `padding-bottom` declarations.** `@include safe-area-top(padding-top, $offset)` emits multiple `padding-top` rules that override any earlier explicit value. If you set `padding-top: clamp(...)` and then call `safe-area-top`, the clamp value is lost. Either include the safe-area inset in your explicit value, or structure the SCSS so the final declaration is the one you want.
- **Fixed-position stages must be verified in every state.** A fixed stage sized with both `top` and `bottom` offsets becomes `height = 100vh - top - bottom`, which is often smaller than the visual it contains (gift box, card deck). Size fixed stages with `top: 0` + explicit `height`, and match the scroll container's `padding-top` to that height for every `flowState`. DevTools preview is mandatory.
- **Shimmer animations should use GPU-safe `opacity` pulse** instead of `background-position` on linear gradients. The `background-position` approach triggers paint on every frame, while opacity pulse only composites. Pattern: `animation: shimmer-pulse 1.5s ease-in-out infinite` with keyframes `0%/100% { opacity: 0.25; } 50% { opacity: 0.65; }`. See `apps/mini-program/src/pages/onboarding/profile-review/index.scss` for a canonical example replacing a `background-position` shimmer with `opacity` pulse (2026-06-10). **The `FootprintOracleCard` matched-state shimmer was migrated to opacity-only in 2026-06-30.**
- **Hero-card flex-wrap layout for text overflow prevention**: When a card has avatar + text side-by-side + tags below, use `flex-wrap: wrap` on the row container. Put copy in a `flex: 1` element (left), avatar in a fixed-width element (right), and tags in a `width: 100%` element below. All text-bearing children must have `overflow: hidden; text-overflow: ellipsis` (single-line) or `word-break: break-word; overflow-wrap: break-word` (multi-line). See `apps/mini-program/src/pages/onboarding/profile-review/index.tsx` hero-card section (2026-06-11).
- **`AnalyzingAnimation` must be the sole owner of reveal timing**: Do not set reveal-ready state (`isRevealReady`) in a separate `useEffect` with a hardcoded timeout — this creates a race where the animation is still running but the content is already shown. `AnalyzingAnimation` exposes `minDuration` (default `ANALYZING_MIN_DURATION_MS = 1200`ms in `src/lib/utils/uiConstants.ts`; the profile-review page overrides it to 600ms) and `onComplete` callback; set `isRevealReady = true` only inside `onComplete`. User skip is handled by AnalyzingAnimation's internal skip button (enabled after 600ms). See `apps/mini-program/src/pages/onboarding/profile-review/index.tsx` (2026-06-11).
- **`useResetOnShow` must include animation-related state for swipe-back safety**: When using a reveal animation (`AnalyzingAnimation.onComplete` sets `isRevealReady`), add `setIsRevealReady` as an argument to `useResetOnShow(setIsSubmitting, setIsPageExiting, setIsCelebrating, setIsRevealReady)`. Without this, a user who swipes back and re-enters will see the content already revealed (no animation replay). See `apps/mini-program/src/hooks/useResetOnShow.ts` and `apps/mini-program/src/pages/onboarding/profile-review/index.tsx` (2026-06-11).
- **CSS custom properties for dynamic values are unreliable in WeChat runtime** — prefer inline `style` transforms or pre-computed SCSS classes for per-frame updates (e.g. slider badge position). Static theming tokens on the native custom tab bar are the exception because they live in the native `cover-view` layer.
- **Tab bar setSelected no-op guard (2026-07-24):** `setSelected` skips `setData` when the tab is already selected and visible, preventing redundant renders.
- **Tab bar single-icon src swap (2026-11-22):** Each tab mounts ONE `<image>` whose `src` switches between `icon` and `selectedIcon`. Replaces the 2026-07-24 dual-icon opacity crossfade, whose stacked overlay never painted on device (the selected tab showed muted artwork under an active label). Route truth is also re-read ~400ms after every show/push so a mid-transition push cannot leave the icon unlit until a second tap.
- **Show-refresh staleness gate:** `src/lib/utils/showRefreshGate.ts` — `shouldRefreshOnShow(key)` with 30s per-key TTL via module-level Map. Applied to discover, events, and profile to prevent redundant per-show invalidations. `events`, `connections`, `center-hub` queries also use 30s `staleTime` for the same reason.
- **Taro H5 aspectFit + `text-align: right` traps (2026-09-08):** Taro H5's `.taro-img__mode-aspectfit` inner img is `position: absolute` with NO left offset, so it takes its static inline position — an ancestor's `text-align: right` pushes it fully outside the `overflow: hidden` core and the image renders blank (found on the personality-test slider right anchor; WeChat native is unaffected because the native Image has no inner img). Fix: set `text-align: left` on the icon's fixed shell.
- **Inline `rpx` styles are silently dropped by the H5 style parser** — any JS-computed inline style (measured geometry, drag-follow positions) must be emitted in `px` (`boundingClientRect` space), never `rpx`. WXSS classes still use rpx as usual. Convert via `getWindowInfoCompat().windowWidth / 750` from `src/lib/utils/systemInfo.ts` (never memoize window metrics). `JoyJoinIcon` was converted globally (2026-09-14) after icons silently fell back to taro-image's 320×240 default in H5; `BrandLogo.tsx`, `ResponsiveSpacer.tsx`, and `TraitRadarChart.tsx` still emit inline rpx and remain H5-broken until they converge on the same pattern.
- **jsdom range-input mock fidelity (2026-09-08):** React co-fires its synthetic `onChange` prop on every native `input` event for `<input type='range'>`, so a Slider mock that wires `onChanging→onInput` + `onChange→onChange` can never simulate WeChat's drag-vs-release split (`onChanging` per frame, `onChange` on release). Wire the commit path with a raw `addEventListener('change')` in a ref instead (canonical: `PersonalityTestAnswerArea.slider.test.tsx`).
- **Absolutely-positioned pill + `numberOfLines` shrink-to-fit trap (2026-09-08):** an absolute element's shrink-to-fit width measures a webkit-line-clamp `Text` at min-content (few glyphs), so a max-width pill truncates hard. Compute the pill width in JS from glyph count and set it inline in px (canonical: `estimateSliderBadgeWidthRpx` in `PersonalityTestAnswerArea.tsx`).

---

## 4. Asset loading strategy (HARD rules)

> Full inventory + build pipelines: `docs/agent-context/mini-program-assets.md`. The rules below are the ones that must not be violated.

- **Build-time CDN URL guarantee**: `config/index.ts` defaults `TARO_APP_CDN_BASE_URL` to `https://joyjoinapp.com/static` in production; CI workflow has the same fallback. Source code must use `cdnAsset()` / `localAsset()` helpers — never hardcode the CDN hostname.
- **Two-tier brand font**: minimal Alimama subset (66KB, family `AlimamaFangYuanTiVF`) and full font (621KB, family `AlimamaFangYuanTiVF-Full`) both load from CDN immediately (the 236-glyph subset cannot cover dynamic titles). Font source files remain in `src/assets/fonts/**` for CDN upload only; they are not copied into the mini-program package. WeChat `loadFontFace` consumes CDN URLs at runtime. The tiers MUST use distinct family names — a same-family override is unreliable on device and caused mixed PingFang/Alimama "irregular bold" (fixed 2026-10-05; immediate complete-font start locked 2026-11-10 by `src/lib/utils/__tests__/brandFont.test.ts`).
- **Quicksand English font** (256KB) bundled and loaded on app launch.
- **Slot machine archetype spritesheet** (`archetype-spritesheet.webp`) — bundled at `/pages/onboarding/assets/archetypes/` (subpackage, preloaded at landing).
- **Full-size archetype images** — served from CDN as WebP. Preload during idle time.
- **Canvas poster** — WebP primary with **CDN PNG fallback**. Local PNGs are NOT bundled.
- **Promo banner** (`HeroPromoBanner`): CDN-only (`/assets/promo/banner-hero-lovart-v1.webp`) to keep the main package under the 2 MB ceiling; persistent asset cache reduces repeat network reads. Gradient overlay still renders while the image loads. Kill switch: `PROMO_BANNER_ENABLED` (default `true`).
- **Welcome coupon banner** (`FirstTimeCouponBanner`): zero external assets, zero package weight. Solid cream bg + CSS decorative circle. Archetype-tinted via inline `hsla()`. Analytics: `welcome_coupon_banner_impression` + `welcome_coupon_banner_tap` via `discoverAnalytics`.
- **Tab bar logo**: dedicated 128×128 `joyjoin-logo-tab.png` (19KB) — NOT the full `joyjoin-logo.png` (596KB).
- **Mascot sprite pipeline deleted (2026-09-03)**: `XiaoyueSpriteAnimator`, all sprite sheets (`src/assets/mascot/`), the spritesheet manifest, and sprite preloads were removed — sprite frame-stepping performed poorly on-device. All mascot surfaces render static expression WebP via `getXiaoyueExpressionAsset()` (CDN-primary; bundled `xiaoyue-home-welcome` / `xiaoyue-loading-system` in `dist/assets/xiaoyue-expressions/` serve as local fallbacks). Do not reintroduce sprite-sheet mascot animation.
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
- **Empty-state typography standard (updated 2026-11-09):**
  - Use `XiaoyueEmptyState variant='editorial'` for the scoped no-data states on Discover, Events, Center Hub, and Connections. This is an opt-in, no-card treatment: one group entrance, static mascot/halo afterward, no infinite breathing, and complete reduced-motion disablement.
  - Keep `StatusCard` for the existing Discover/Events error branches and other established Lovart-hero status surfaces; do not globally restyle it or migrate Notifications/Gathering Room without a separate review. Meaningful grouping cards such as Connections `flow-card` and Discover `CityUnlockFeedCard` remain.
  - Canonical decision tree, copy/motion rules, inventory, and exclusions: `docs/design/empty-state-visual-strategy-20261109.md`.
  - Titles: Alimama brand font, `line-height ≥ 1.4`, bold.
  - Subtitles/body: system UI font, `line-height ≥ 1.6`.
  - Title-to-subtitle spacing: 16–24rpx (`$spacing-sm` to `$spacing-md`).
- **Zero-emoji on primary copy**. Use `JoyJoinIcon` for reactions, categories, intents, achievements, chemistry badges, status icons, phase emblems, info labels.
- **Xiaoyue copy**: subject to `xiaoyue-writing-craft` 9 axioms. Use `getErrorMessage`, `getEmptyStateMessage`, etc. from `packages/shared/src/copy/`.
- **Error-state ARIA**: `role='alert'` + `aria-live='polite'` for inline error states; `role='status'` + `aria-live='polite'` + `aria-busy='true'` for loading screens (e.g., `JoyJoinLoadingScreen`).
- **Haptics are mandatory** on non-onboarding interactive surfaces. Intensity: `light` (secondary), `medium` (primary CTA), `success` (emotional peaks).
- **Completion celebration micro-interaction**: After a final onboarding step API call succeeds, set `isCelebrating` state → `haptics('success')` → wait 720ms → navigate. During the delay, replace the action bar with a non-interactive status/progress strip (`正在前往下一步`) and dim the gift region with the card; the in-card overlay carries the success title. Reset `isCelebrating` via `useResetOnShow` for swipe-back safety. See `apps/mini-program/src/pages/onboarding/profile-review/index.tsx` `handleComplete` (2026-06-10; copy/dwell updated 2026-10-30).
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
- **Registration-mutating flows must bust query caches (2026-07-31):** after any successful registration/payment/single-test action, call `bustRegistrationCaches(queryClient)` from `lib/api/registrationCacheBust.ts` (invalidates pools, `REGISTRATIONS_QUERY_KEY`, joined events, shells, auth + evicts persisted keys). The shared `REGISTRATIONS_QUERY_KEY` carries `staleTime: 30s` — `SingleTestBanner` (single-test `/start`/`/reset`) missed this and the freshly-created tester registration stayed invisible on matching-status for up to 30s.
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
npm run verify:subpackage-styles -w mini-program  # assert required selectors in compiled page WXSS (CI gate after check:package-size)
```

**WeChat Mini-Program upload (开发版)**: A push to `main` first deploys staging; CI uploads the matching commit only after that staging deployment succeeds. Manual upload requires `--appid` flag (`miniprogram-ci` will not auto-read from `project.config.json`):

```bash
npx miniprogram-ci upload \
  --appid wx5a038ee6dee12032 \
  --pp apps/mini-program \
  --pkp <private-key-file> \
  --uv "1.0.$(date +%Y%m%d).$(date +%H%M)" \
  --ud "dev build" \
  --rp 1
```

**Upload gotchas (2026-07-22):**
- `.github/workflows/taro-weapp-build.yml` uses `--use-cos=false` so `miniprogram-ci` waits for WeChat backend validation. Without synchronous upload, the async COS path returns exit 0 before WeChat scans the package, so rejected uploads look like successes in CI.
- `scope.*` permission descriptions in `src/app.config.ts` must be **≤30 characters**. Exceeding this causes `errcode 80058` and an invisible upload. CI runs `npm run validate:wechat-app-config -w mini-program` (also part of `npm run build:weapp`) to catch this locally before upload.

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

> Full component + rule reference: `docs/agent-context/mini-program-events.md` (FootprintOracleCard, EventSummaryCard, EventCountdownClock, useEventCountdown, venue disclosure, vignette layout, terminal-state detection, pool-registration terminal states). Non-negotiable: venue location is hidden until `displayStatus` is `confirmed`/`venue_unlocked`; countdown uses `aria-live="polite"`; terminal states stay reachable on short phones via `pool-reg__scroll`.

## 14. Discover / OracleCard

- **`OracleCard`** (`src/components/discover/OracleCard.tsx`) — primary pool card on `pages/discover/index`. 6-layer visual hierarchy: L1 hero message, L2 status rail (momentum pill + count/deadline chip), L3 decision facts, L4 title, L5 social-proof teaser, L6 progress bar + CTA. Per-pool 4-branch narrative pivot (empty/rare/present/dominant). Full-pool disabled state with grey CTA + "已满员". High-chemistry celebration badge when ≥3 high-match archetypes.
- **Header status rail (2026-11-10, replaces the floating corner badge):** The participant count and the registration deadline share **one** right-hand pill — `5 人入座中 · 1 天后截止` — sitting on the same 48rpx baseline as the left momentum pill (`● 越来越热闹了`). Both chips use the same shell (`rgba($color-surface, 0.72)` fill, `1rpx` hairline, 999rpx radius, 24rpx type) so the header reads as one system instead of two stickers. The old absolutely-positioned `__corner-stat` block is gone; the count is still shown above the fold, factual and not scarcity-driven.
- **Count segment:** Shows real participant count when `currentParticipants > 0` and the pool is not full. Event-type-aware copy: `饭局` → "X 人入座中", `酒局` → "X 人已入席", others → "X 位伙伴已加入". Count capped at `999+` for predictable chip width. The number is 32rpx bold, the label 24rpx medium.
- **Deadline segment:** Derived from `pool.hoursUntilDeadline` → `即将截止` / `N 小时后截止` / `N 天后截止`, hidden beyond 72h. Shares the chip with the count; urgent (≤24h) inherits the family colour and ≤6h turns `$color-error`. When the count segment is off, the chip renders the deadline alone.
- **Badge color:** Number uses `getContrastSafeArchetypeColor(userArchetype)` when the user's archetype is known; otherwise falls back to the card's `accentFamily` color. No artificial urgency colors (red/orange) — signal is factual, not scarcity-driven.
- **Feature flag:** Kill-switched via `user.features.oracleCardCornerStatEnabled` (env `ORACLE_CARD_CORNER_STAT_ENABLED`, default `true`). The page passes the flag into `OracleCard`; the component defaults to `true` when absent. When off, only the count segment disappears — the deadline chip and the footer presence strip stay.
- **Animation / performance:** The rail fades in as one unit (`oracle-status-enter`, opacity only) alongside the card entrance. Count-up animation is intentionally omitted to reduce noise and paint cost. Animation is suppressed under `prefers-reduced-motion` or on degradation-tier devices via `getSystemReducedMotion()` + `useDeviceTier().isDegradation`.
- **Layout safety:** The rail reserves its own 48rpx row (`margin-bottom: $spacing-sm`) so the chip never overlaps readable copy; the momentum label truncates before the chip, which is `flex-shrink: 0`. The translucent chip keeps the vignette visible behind it.
- **Skeleton state:** Two shimmer pills (`--status-pill` / `--status-chip`) mirror the rail footprint while pool data loads, gated by the same reduced-motion / degradation rules.
- **Analytics:** `corner_badge_impression` once per mount (if count > 0), `corner_badge_live_update` when count changes while mounted, and `pool_card_tap` carries `hasCornerCount` + `cornerCount`. Event names are unchanged for continuity even though the count now lives in the rail.
- **Accessibility / ARIA:** Card keeps `role='button'`, `aria-label` includes the participant count when the count segment is shown, and `aria-disabled` is set when full or disabled. Tap target remains ≥88rpx.
- **Footer people row (2026-11-10):** `ParticipantPresenceStrip` renders one archetype face per seated member, up to `MAX_VISIBLE_COINS = 10`; the slice is capped by `totalPresence` (`Math.min(MAX_VISIBLE_COINS, totalPresence)`) so a longer sample array can never produce more faces than people. The `+N` overflow coin only appears for genuine overflow, never beside a truthful `5/8` readout. Server samples 10 archetypes per pool (`SAMPLE_ARCHETYPE_COUNT = 10` in `shellRepository.ts` / `userEventPools.ts`). The `N 人和你合拍` chemistry chip lives in the same `__people-row`, to the right of the seat count, as a soft family-tinted pill (14% fill / 33% border, 24rpx) — chemistry is about people, so it belongs on the people row, not the date line.
- **Footprint table identity (Phase 2 + 3, 2026-11-10):** `JoinedEventSummary` now carries `theme`, `themeVibe`, `matchScore`, `memberArchetypes` (server caps at 6, real archetypes, **no masking** — the viewer is a member of the table). `FootprintOracleCard` renders the table faces in `__facts` (40rpx `ArchetypeHead` coins, `-16rpx` overlap shared with Discover), the table count as the row's payload (`__fact` semibold primary, `__fact--price` stepped back to secondary), and the theme as annotated identity (`__theme-row`: 22rpx `主题` label + 24rpx value, no capsule chrome — the rail already owns capsule discipline). The theme hugs the title (`__title-row--with-theme` 8rpx) and opens 24rpx to the geography run (`__meta--after-theme`). Facts/text face render only when `groupSizeLabel` exists, so unlabelled faces or a price-only band are impossible. Footer hint is state-aware: `看看这桌的合拍度` (upcoming, assigned table) / `翻翻这场回顾` (`completed`/`attended`, regardless of table) / nothing otherwise; one hairline per card (the hint closes the card rather than opening a second band). Terminal dimming covers title/theme-value/status/facts; cancelled cards render no facts band.

## 15. My-Image stage scene & subpackage WXSS guard (2026-07-21)

> Full reference (stage scene, WebGL 3D avatar, chunk routing, slot hotspots, equipment layers): `docs/agent-context/mini-program-profile.md`. Non-negotiable:
> - **Subpackage WXSS splitting is a hard trap**: any component SCSS used by a `profile-linked` page MUST be `@use`d in the page SCSS. CI gate: `npm run verify:subpackage-styles -w mini-program`.
> - **Percentage-height stage trap (2026-07-23)**: stage hosts MUST set an explicit `height` next to `min-height` (pattern: `my-image__stage`); `IdentityStageScene` carries `min-height: inherit` as defense.
> - **`identity-stage__content` pointer-events removed (2026-07-29)**: children declare their own interactive targets; do not reintroduce the `pointer-events: none` wrapper pattern.
