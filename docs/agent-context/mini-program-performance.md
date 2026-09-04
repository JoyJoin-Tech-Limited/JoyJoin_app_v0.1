# Mini-Program Performance — Agent Context

> Research audit (2026-08-01). Static analysis with `file:line` evidence; no runtime profiling yet. Load when working on rendering hot paths, polling/continuous work, assets, startup, or perf tooling in `apps/mini-program`. Goals: 流畅度, no overheating, minimal battery drain, instant response.

## Rendering hot paths

- **Discover is fully virtualized — the reference pattern.** `VirtualList` (`components/VirtualList/index.tsx`): fixed item height 560rpx, 50ms scroll throttle + rAF window recalc (:23, :257-273), 3-item buffer, first 6 non-virtual, IntersectionObserver sentinel (:285-315). Derived data memoized (`displayPools`/`visiblePools`/`openPools`/`dynamicSubtitle`/`bannerVariant`, `pages/discover/index.tsx:362,392,415,428,434`); card render fn + key extractor `useCallback` (:499, :520). `useDidShow` invalidations gated by 30s staleness TTL (`lib/utils/showRefreshGate.ts`).
- **Events / Connections / Center-hub are NOT virtualized.** `displayEvents.map(...)` in ScrollView (`pages/events/index.tsx:220,244`), `connections.map(...)` (`pages/connections/index.tsx:95-156`), `events.map(...)` (`pages/center-hub/index.tsx:168-177`). Every card mounts ~5-8 Image/View nodes → multi-hundred-node setData diff per tab switch. **Top jank fix: threshold-gated VirtualList adoption** using `MINI_PROGRAM_LONG_LIST_ROW_THRESHOLD` (`lib/utils/longListThreshold.ts`).
- Minor: `displayPools` filter re-runs `shenzhenClusters.find(...).districts.map(...)` per pool inside the filter loop (`discover/index.tsx:367-369`) — hoist once. Profile re-creates `new Map(...)` for equipment per render (`profile/index.tsx:338`).
- Icebreaker (`pages/icebreaker-session/index.tsx`, 1831 lines) is a documented God-component (:365) but mitigated: `notifyOnChangeProps: ['data','isError','error']` on the 3s poll (:285-287), memoized participants (:380-383), ~50 useCallback handlers, 31 bridge preloads hoisted to a stable const (`ICEBREAKER_PRELOAD_ASSETS`, :102-103) to avoid re-firing per render.

## Animation & continuous work

- **Compositor-only discipline holds:** every sampled infinite keyframe animates transform/opacity only (e.g. `FootprintOracleCard.scss:491-523`, `profile/index.scss:638-647,679-686,874-882`; "stays on the compositor" comment `HeroPromoBanner.scss:311`). The `background-position` shimmer anti-pattern was purged (2026-06-10).
- **Always-on infinite CSS on visible tab surfaces (145 `infinite` usages total):** HeroPromoBanner 7 concurrent animations — sparkles 4.2s + CTA breathe 2.4s + shimmer 1.8s (`HeroPromoBanner.scss:127,234,335`); profile avatar breath 5.6s + platform pulse 5.6s + XP sheen 8s (`profile/index.scss:624,668,871`); FootprintOracleCard shimmer 2.6s + pulses 2s/1.8s/1.2s (`FootprintOracleCard.scss:87,211,290,369`). Keep GPU compositor busy the whole time tabs are visible — heat source; worst offenders (CTA breathe, XP sheen) could be once-per-enter.
- **Countdown ticker is the highest-frequency render loop:** 1s tick (`hooks/useEventCountdown.ts:242-244`) but thoroughly gated (viewport IO, app hide, reduced-motion, degradation tier, terminal status, stops after event start :170-174). N visible cards = N re-renders/sec; consider shared parent ticker.
- **(Resolved 2026-09-03)** `XiaoyueSpriteAnimator` and its `setInterval` frame-stepping were deleted — all mascots render static expression WebP.
- Event-triggered systems self-terminate: `ParticleBurst` (rAF canvas, module-scope reduced-motion check :16, static-emoji fallback :377-385, `fill` prop for full-bleed wrappers, CSS-size cap at 420px to avoid high-DPR memory kills), `FirstTimeCouponBanner` (:46-50), `useCountUp` (900ms once), `useStaggerMount`, `useFlowTimeline/useFlowProgress`. **`PixelAvatar3D` (WebGL, `profile/PixelAvatar3D.tsx`) renders on demand only** (gestures/reset, :226-232) + decaying inertia rAF; visibility-gated (:390-406); NO device-tier gate (any device with canvas support boots WebGL; fallback exists for non-spider archetypes :491-514).

## Assets

- WebP everywhere, CDN-primary with local fallback (`lib/utils/cdnAssets.ts`); mascot sprite sheets are gone (2026-09-03) — static expression WebP only, `xiaoyue-home-welcome`/`xiaoyue-loading-system` bundled as fallbacks. Fonts: 66KB subset bundled + 621KB full from CDN (500ms defer), Quicksand bundled; loaded at launch (`app.ts:177`).
- Avatar compositing is layered `<Image>` stacking (`profile/PixelAvatarComposite.tsx:187,206`), not canvas — WeChat caches decoded images per URL.
- **Preload discipline is strong:** app-critical (animated WebP intro is iOS-can't-bundle, `lib/utils/routePreloadAssets.ts:31-40`), route-level per tab, predictive cross-tab, staggered tiers 0/400/1200ms (`onboardingPreload.ts`), gated by network (2g skip) and device (`benchmarkLevel < 20` skip, `lib/prefetchEngine.ts:46-47,211-229`). Persistent file cache in `wx.env.USER_DATA_PATH` with versioned djb2 keys (`lib/utils/persistentAssetCache.ts:25-60`) — repeat visitors fetch zero network.
- Risk: **cold-start fan-out** — launch fires font load + CDN preloads + onboarding tiers + AuthProvider bootstrap + AutoLoginBridge simultaneously (~10+ parallel ops; `app.ts:153-188`). Serialize tier 1 to 2-3 at a time (`preloadImages` already has a concurrency param, `lib/utils/imagePreload.ts:80-108`).

## Data fetching on client

- Query defaults: `staleTime 30s`, `retry 1`, `refetchOnWindowFocus: false`, mutations `retry: false` (`lib/api/queryClient.ts:8-19`); `REQUEST_TIMEOUT_MS = 15000` prod / 5000 dev (`lib/api/api.ts:24-25`). Persistent Tier-2 offline cache: pools + joined-events, 4h TTL, 75KB cap, mutation-evicted (`lib/api/persistentCache.ts`). `PrefetchEngine` injects `/api/shell/*` with auth/network/device gates.
- **CRITICAL — polling never pauses in the WeChat runtime.** TanStack Query v5 pauses `refetchInterval` only via `document.hidden`; **`document` does not exist in the mini-program**, so `refetchIntervalInBackground: false` never engages. WeChat keeps stack-hidden pages alive. Codebase-wide misconception: squad-unboxing comment claims "React Query pauses interval refetches when the window is unfocused" (`useSquadUnboxingController.ts:247`) — false. Un-paused poll sites:
  - **Matching-status: 5 concurrent polls** — 30s registrations / 15s compass / 20s fills / 30s details / 60s analysis (`useMatchingStatusController.ts:150,169,183,239,250`; two with `staleTime: 0` :170,184) + a duplicate 30s registrations query on the page (`pages/matching-status/index.tsx:131`). Left in the stack → ~6 requests/min indefinitely.
  - **Icebreaker: 3s** (`POLL_SOCIAL_SESSION_MS`, `pages/icebreaker-session/index.tsx:282`) — 0 `useDidHide` in the file.
  - **Notification counts: 30s, app-lifetime** (`hooks/useNotificationCounts.ts:17` via `useTabBarStateBridge.ts:38`) — no `useAppHide`/`onAppHide` anywhere in the chain; keeps polling while app is backgrounded.
  - Gated ones (reference patterns): payment status poll clears on terminal state (`pages/event-ticket-payment/index.tsx:380-387`); ALang 60s poll pauses on `useDidHide` (`pages/alang/event/index.tsx:270`); squad-unboxing polls 30s only while `venueAssignmentStatus === 'unassigned'` (`useSquadUnboxingController.ts:249-251`).
- Fix direction: pause intervals when page leaves stack / app backgrounds (app-visibility observer + `refetchInterval` function returning `false`, or `useDidHide`), and consolidate the duplicate matching-status registrations query.

## Startup & navigation

- Cold-start chain (`app.ts`): polyfill (:3) → font + asset preloads in `useLaunch` (:153-188) → providers (Auth, DynamicAccent, Achievement) + 4 bridges (AutoLogin, PendingOrderResume, ProfessionRetry, AchievementPopup) + TabBarStateBridge. No synchronous blocking work; storage reads try/caught (:160-172); cached auth hydrates synchronously (`queryClient.ts:32-42`); landing gate caps 4s (`useAuthGate`).
- Packaging: `lazyCodeLoading: 'requiredComponents'` (`app.config.ts:31`), 6 subpackages + 16 main-package pages (`lib/onboarding/onboardingRoutes.ts:140-158`), preload rules on every main entry (:172-206). Main zip ≈1.73MB.
- `perf-audit-collect.mjs` flags non-tab main-package pages (`scripts/perf-audit-collect.mjs:122-138`) — city-unlock/event-coordination/pool-group-detail/center-tab-empty are subpackage candidates.
- Page-stack discipline is good: `useResetOnShow` resets transient flags on swipe-back (`hooks/useResetOnShow.ts`); cached tab-bar scroll position re-applied synchronously on `useDidShow` (`discover/index.tsx:772-801`).

## Perf tooling

- `scripts/perf-audit-collect.mjs` (root): 9 regex detectors — uncapped canvas DPR, missing reduced-motion gate, `filter: blur()` without gate, non-composited animation props, **list-without-VirtualList**, main-package page check, missing cleanup, hardcoded px; + subpackage audit + zip sizes. **Limitations:** regex-only (can't parse keyframe bodies), and defaults to `--changed-files` (git diff) — known offenders only get flagged in the PR that touches them; no CI `--all` ratchet.
- **The VirtualList detector DOES fire on events/connections/center-hub** (ScrollView + `.map(` + no VirtualList + no slice/pagination + no IO — all criteria met). Detection works; enforcement is the gap.
- Asset gates: `check-package-size.mjs` (zip vs 2MB, CI-wired), archetype/lovart/xiaoyue asset size scripts, `validate-icon-transparency.mjs`, `validate-asset-references.mjs`, `validate-wechat-app-config.mjs`.
- **Missing:** ① poll-loop audit (refetchInterval/setInterval without hide-gating — the exact class of bug above); ② TTI coverage — `usePageTTI` (cold ≤2000ms / warm ≤800ms) is on only 6 pages (edit-profile, rewards, terms, personal-story, invite, squad-unboxing) — **none of the hot pages** (discover, events, center-hub, profile, matching-status, icebreaker); ③ `performance.mark`/`wx.reportPerformance` — **zero hits in src**; ④ per-page render/setData-size telemetry.
- Runtime tiering exists: `useDeviceTier` (`benchmarkLevel ≤ 15` → degradation, `LOW_END_BENCHMARK_LEVEL`), `frameBudget.ts` FPS tiers (55/30/15), used by countdown, sprites, OracleCard, tab bar (`native-custom-tab-bar/index.js`: lowEnd setData :123, 50ms debounced diffed setData :192).

## Top 5 fixes by impact (recommended order)

1. **Pause polls when pages leave the stack / app backgrounds** — matching-status (5 polls + duplicate), icebreaker (3s), notification counts (app-lifetime). Battery + data win; also correct the false "React Query pauses on unfocus" assumption in comments/AGENTS.md.
2. **Virtualize Events / Connections / Center-hub lists** using the existing `VirtualList`, threshold-gated like Discover.
4. **Trim always-on infinite animations on tab chrome** (HeroPromoBanner sparkles/breathe, profile breath/XP-sheen) to once-per-enter or visibility-gated.
5. **Extend `usePageTTI` + add `performance.mark` to the 5 hot pages**; add a poll-lifecycle detector to `perf-audit-collect.mjs` and run `--all` in CI with a ratchet.

## Runtime verification still needed

- Confirm with WeChat DevTools Network panel that matching-status/icebreaker polls continue while the page is stack-hidden (code-path analysis says yes — no `document`).
- Real FPS cost of N-card infinite animations + full-list renders on low-end devices (benchmarkLevel ≤ 15).
- Cold-start fan-out timing vs the 2s TTI budget on 3G (Discover is not currently instrumented).
