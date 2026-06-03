# Grill-Me Interview — Performance Stress-Test Questions

> Run this interview after dimension scoring. One question per turn.
> For every dimension scoring < 8, ask ALL questions in that dimension's section.
> For dimensions scoring ≥ 8, ask only the bold "smoke-test" question.
> Do not stop until every triggered question is answered or the developer explicitly ends the session.

---

## 流畅度 (Smoothness)

Ask these when Smoothness < 8:

**Q1 (smoke-test):** Did you profile scroll performance on a 120Hz device with 30+ list items?
- Recommended: Yes, using WeChat DevTools Performance panel with benchmarkLevel ≤ 30. Frame timing shows ≤ 1 dropped frame per 100 scroll events.

**Q2:** Are all animations using only `transform` and `opacity`? Any `width`, `height`, `left`, `top`, or `filter: blur()` in animated properties?
- Recommended: Only compositor-friendly properties. Any `filter: blur()` must be behind a `prefers-reduced-motion` gate.

**Q3:** Is there a `VirtualList` for any list that can exceed 50 items? If not, what's the max expected item count?
- Recommended: VirtualList for any list capable of exceeding 50 items. If max is bounded at ≤ 30, document the bound.

**Q4:** Did you test scroll jank on a vivo or OPPO device (most common Gen Z brands)?
- Recommended: Yes, tested on ≥1 MediaTek device (Dimensity 8200+ class). MediaTek GPUs handle `box-shadow` and `border-radius` differently from Snapdragon Adreno.

**Q5:** Is there any layout thrashing (read DOM property then write DOM property in the same synchronous block)?
- Recommended: No. All layout reads batched before writes. No `getBoundingClientRect()` followed by style changes in the same frame.

---

## 速度 (Speed)

Ask these when Speed < 8:

**Q1 (smoke-test):** What's the measured cold-start time to interactive for the changed page on 5G?
- Recommended: < 1.5s on Primary tier. Measured via `scripts/measure-mini-program-cold-entry.sh` or WeChat DevTools with 5G throttling.

**Q2:** Is the changed page behind `React.lazy()` if non-critical? Or is it a tab bar page that must be in main package?
- Recommended: Non-tab-bar pages use `React.lazy()`. Tab bar pages minimize initial bundle with `lazyCodeLoading: 'requiredComponents'`.

**Q3:** Are there blocking API calls in the component render path? Or is data fetching behind Suspense with a loading shell?
- Recommended: Zero blocking calls in render. All data behind Suspense + TanStack Query with a loading shell that renders within 200ms.

**Q4:** Is there predictive prefetch for the next likely screen? Does `PrefetchEngine` cover the flow?
- Recommended: Yes, if this page is a likely next step after a high-traffic entry point. Prefetch staged during idle time on the preceding screen.

**Q5:** What's the gzip bundle size of the changed page/subpackage? Does it stay within the Primary tier budget (≤ 200KB gzip)?
- Recommended: Measured via `npm run check:package-size` or build output analysis. Any increase > 10KB gzip must be justified.

---

## 设备适配 (Device Adaptability)

Ask these when Device Adaptability < 8:

**Q1 (smoke-test):** Did you test on at least 2 representative Primary tier devices from different brands, including at least 1 iPhone?
- Recommended: Yes. Tested on ≥2 devices: one Android (Snapdragon or MediaTek) + one iPhone (iPhone 15 or 16). Each platform has distinct WebView behavior.

**Q2:** Does the implementation use `getSystemInfoSync().benchmarkLevel` to gate heavy features at runtime? What's the iPhone equivalent since iOS WeChat doesn't expose `benchmarkLevel`?
- Recommended: Yes, benchmarkLevel on Android. On iPhone, use model name + system version heuristics (e.g., `systemInfo.model` + `systemInfo.system`). Document the fallback tier-detection path.

**Q3:** Is `prefers-reduced-motion` respected for all entrance animations, staggered reveals, and particle effects?
- Recommended: Yes. All animations check `prefers-reduced-motion` and fall back to instant reveal. CSS `@media (prefers-reduced-motion: reduce)` used alongside JS detection.

**Q4:** Are there any hardcoded pixel values that could break on different screen densities (e.g., a vivo X100 at 452ppi vs an older 720p device)?
- Recommended: No. All layout uses `rpx` units. Any fixed pixel values are justified and tested across densities.

**Q5:** Does canvas usage cap DPR at 3× and check available memory before full-resolution export? Tested specifically on iPhone where memory kills are more aggressive (~300–500MB ceiling)?
- Recommended: Yes. Canvas DPR = `Math.min(systemInfo.pixelRatio, 3)`. Export resolution capped. iPhone tested separately — WKWebView has tighter memory limits than Android WebView.

**Q6 (iPhone-specific):** Did you test `backdrop-filter`, `position: fixed` with keyboard open, and safe area handling on a physical iPhone?
- Recommended: Yes. `backdrop-filter: blur()` replaced with opaque bg + separate blur layer on iPhone. Fixed positioning tested with keyboard. `env(safe-area-inset-*)` verified on notch + Dynamic Island models.

**Q7 (iPhone-specific):** Did you test canvas WebP rendering on iPhone? WKWebView canvas support for WebP is newer than Chromium.
- Recommended: Yes. Canvas draws WebP and falls back to PNG/CDN PNG on decode failure. Tested on iPhone 15 running iOS 17+.

---

## 内存安全 (Memory Safety)

Ask these when Memory Safety < 8:

**Q1 (smoke-test):** Are all event listeners, timers, observers, and image refs cleaned up in `onUnload` / `useUnload`?
- Recommended: Yes. Every `addEventListener`, `setInterval`, `setTimeout`, `Taro.on*`, and observer has a corresponding cleanup in the unload path.

**Q2:** If canvas is used, is the DPR capped at 3×? Is the canvas context released after export?
- Recommended: DPR = `Math.min(pixelRatio, 3)`. Canvas ref nulled + context released after export. No retained canvas in component state after unload.

**Q3:** Are large image arrays or data structures freed when no longer needed? Any retained references to unmounted component state?
- Recommended: Yes. Image arrays cleared after draw. No `useRef` holding large objects after the view is unmounted.

**Q4:** Did you profile memory across 5+ navigation cycles (enter → leave → enter → leave) on a Degradation tier device or benchmarkLevel ≥ 30 emulation?
- Recommended: Yes. Memory returns to baseline after each cycle. No monotonic growth.

**Q5:** Are there any recursive or unbounded data structures (e.g., accumulating arrays in global state, unpruned query caches)?
- Recommended: No. All accumulators have explicit size bounds or TTL-based eviction.

---

## 网络韧性 (Network Resilience)

Ask these when Network Resilience < 8:

**Q1 (smoke-test):** What happens when the network request for this page's data times out? Show me the error state.
- Recommended: Error state renders with a retry button. No white screen. Timeout configured at ≤ 10s.

**Q2:** Is there an exponential backoff retry strategy for transient failures? Or does the user have to manually retry?
- Recommended: TanStack Query's default retry (3 attempts, exponential backoff) is active. No custom fetch that bypasses TanStack Query.

**Q3:** Does the implementation check network type before heavy data loads (e.g., prefetch, image preloading)? Is 4G behavior different from 5G?
- Recommended: Yes. `Taro.getNetworkType()` checked before aggressive prefetch. 4G gates preloading to current screen only. 5G allows predictive preload.

**Q4:** Is there an offline or stale-data fallback? Can the user see cached content while waiting for network?
- Recommended: Stale-while-revalidate via TanStack Query `staleTime` + `gcTime`. If no cache exists, a branded empty/loading state renders.

**Q5:** Are WebSocket connections (if any) handled with reconnect + heartbeat? What happens on a 30-second tunnel disconnection?
- Recommended: Yes. Heartbeat every 30s. Exponential backoff reconnect. UI shows "reconnecting..." indicator after 3 missed heartbeats.

---

## 包体积 (Package Size)

Ask these when Package Size < 8:

**Q1 (smoke-test):** What's the gzip size impact of this change on the main package? Run `npm run check:package-size`.
- Recommended: Main package gzip < 1.5MB. Any increase > 5KB gzip must have a documented justification.

**Q2:** Are new assets (images, fonts, JSON) bundled locally or served from CDN? Any local asset > 20KB?
- Recommended: Assets > 20KB on CDN. Only essential UI assets (icons, spritesheets) bundled locally. Fonts use the two-tier strategy: minimal subset (66KB) local, full font on CDN.

**Q3:** Does the changed code land in the correct package (main vs subpackage)? Is new code accidentally in the main package?
- Recommended: Deep-link pages in subpackages. Only tab bar pages and shared utilities in main package. Verified via `onboardingRoutes.ts` subpackage configuration.

**Q4:** Are there any new dependencies added? If so, what's their tree-shaken size? Are they shared across subpackages or duplicated?
- Recommended: New dependencies < 10KB gzip tree-shaken. If shared across subpackages, verified no duplication via build analysis.

**Q5:** Is `lazyCodeLoading: 'requiredComponents'` active? Are there components that could be lazy-loaded but are eagerly imported?
- Recommended: `lazyCodeLoading` active in `app.config.ts`. Any non-critical component uses dynamic import or is in a lazy-loaded subpackage.
