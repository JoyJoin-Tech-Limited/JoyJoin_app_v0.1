# Performance Audit — Dimension Scoring Rubrics

## 1. 流畅度 (Smoothness) — 0–10

How the screen *feels* during interaction. Measures frame consistency, not raw speed.

| Score | Criteria |
|-------|----------|
| 0–2 | Visible jank on every scroll; animations stutter at < 20fps; layout thrashing on every interaction |
| 3–4 | Occasional frame drops (every 3–5 scrolls); animations feel "heavy" but not broken |
| 5–6 | Mostly smooth; rare micro-stutter on complex screens (30+ list items); entrance animations complete without visible drops |
| 7–8 | 120Hz smooth on Primary tier; only `ScrollView` with VirtualList shows minor jank under extreme load (100+ items) |
| 9–10 | Butter-smooth at all scroll speeds on Primary tier; Degradation tier shows zero visible jank |

**Evidence required:**
- WeChat DevTools Performance panel trace (≥3 interactions)
- Frame timing data for entrance/exit animations
- Scroll jank measurement on Primary tier device or benchmarkLevel ≤ 15 emulation (active threshold in `apps/mini-program/src/hooks/useDeviceTier.ts`)

**Common killers:**
- `filter: blur()` on animated elements
- Layout thrashing (read-then-write in the same frame)
- Missing `VirtualList` for lists > 50 items
- Heavy `box-shadow` on scroll containers
- Non-composited animations (animating `width`, `height`, `left`, `top` instead of `transform`)

---

## 2. 速度 (Speed) — 0–10

Time-to-interactive: how fast the user reaches a usable state from navigation trigger.

| Score | Criteria |
|-------|----------|
| 0–2 | Cold start > 3s white screen; route transitions > 1.5s; API calls block UI rendering |
| 3–4 | Cold start 2–3s; route transitions 1–1.5s; visible loading spinners on every navigation |
| 5–6 | Cold start < 2s; route transitions < 1s; loading shells render within 300ms |
| 7–8 | Cold start < 1.5s on 5G; route transitions < 600ms; predictive prefetch covers next likely screen |
| 9–10 | Cold start < 1s on 5G; route transitions feel instant (< 400ms); zero visible loading on tab switches |

**Evidence required:**
- Cold-start timing (WeChat DevTools or `scripts/measure-mini-program-cold-entry.sh`)
- Route transition timing (performance marks)
- Bundle size (gzip) per changed page/subpackage
- API response time (if new endpoints)
- Long-running AI generation surfaces: shell renders immediately; heartbeat progress visible; generation settles to a terminal state within budget (client never waits on a stalled socket)

**Common killers:**
- Missing `React.lazy()` for non-critical pages
- No `prefetchQuery` / Predictive Shell for tab data
- Blocking API calls in component render (not behind Suspense)
- Over-fetching (loading data for tabs the user hasn't opened)
- No HTTP compression on API responses
- Full-screen wait with no progress or timeout during AI generation (miniscript / icebreaker phases)
- Progress derived from device clock — clock skew freezes the bar (compare epochs, never `updatedAt` across clocks)

---

## 3. 设备适配 (Device Adaptability) — 0–10

Behavior across representative Gen Z devices. Primary tier is the target; Degradation is fallback.

| Score | Criteria |
|-------|----------|
| 0–2 | Crashes or white screen on ≥1 representative device; no tier detection logic |
| 3–4 | Works on Primary tier but Degradation tier shows severe issues; no reduced-motion path |
| 5–6 | Works on both tiers but Primary tier doesn't use available headroom (e.g., 60Hz on 120Hz device) |
| 7–8 | Primary tier at full fidelity; Degradation tier gracefully reduces; `benchmarkLevel` detection active |
| 9–10 | Device-capability-aware rendering; tier detection gates heavy features at runtime; multiple device profiles tested |

**Evidence required:**
- Test on ≥2 representative Primary tier devices (mix of Xiaomi, OPPO, vivo, Huawei **+ at least 1 iPhone**)
- Test on ≥1 Degradation tier device or benchmarkLevel ≤ 15 emulation
- `prefers-reduced-motion` detection for animation gating
- `getSystemInfoSync().benchmarkLevel` usage on Android; model-based tier detection on iPhone (no benchmarkLevel)
- Verify `env(safe-area-inset-*)` handling on iPhone with notch / Dynamic Island
- Canvas WebP rendering tested on iPhone specifically (WKWebView compat gap)

**Representative devices (Gen Z Primary tier):**
- Xiaomi 13/14, Redmi K70 (Snapdragon 8 Gen 2/3, 8–12GB)
- OPPO Reno 12/13, Find X7 (Dimensity 8200+, 8–12GB)
- vivo X100/S20 (Dimensity 9300, 8–12GB)
- Huawei Pura 70/Mate 60 (Kirin 9000S, 12GB)
- **iPhone 15 (A16, 6GB, 60Hz) — most common Gen Z iPhone**
- **iPhone 16 Pro (A18 Pro, 8GB, 120Hz) — high-end baseline**

**Common killers:**
- Assuming all devices support `filter: blur()` performantly (especially WKWebView on iPhone)
- No `prefers-reduced-motion` check before heavy animations
- Hardcoded pixel values that break on different screen densities
- Canvas operations at full resolution on low-memory devices (iPhone's ~300–500MB ceiling is tighter than Android)
- Using `benchmarkLevel` without an iPhone fallback (iOS WeChat doesn't expose it)
- `position: fixed` elements untested with iPhone keyboard open
- Missing `env(safe-area-inset-*)` for iPhone notch / Dynamic Island / home indicator
- Assuming canvas WebP works on iPhone without testing (WKWebView support is newer)

---

## 4. 内存安全 (Memory Safety) — 0–10

Risk of WeChat mini-program memory kill or canvas crash on real devices.

| Score | Criteria |
|-------|----------|
| 0–2 | Known crash path (e.g., canvas at full DPR on 4GB device); memory leak confirmed |
| 3–4 | Unverified canvas usage; large image arrays held in memory; no cleanup on `onUnload` |
| 5–6 | Canvas DPR capped at 3×; images preloaded but not leaked; `onUnload` cleans subscriptions |
| 7–8 | Canvas resolution gated on device memory; large assets freed after use; no retained references to unmounted components |
| 9–10 | Memory profiled on Degradation tier device; zero leaks over 5+ navigation cycles; canvas operations batched |

**Evidence required:**
- Canvas DPR cap check (max 3×, see personality card sharing rules)
- `onUnload` / `useUnload` cleanup audit for subscriptions, timers, image refs
- Memory profile on Degradation tier device or benchmarkLevel ≤ 15 emulation

**Common killers:**
- Canvas export at `systemInfo.pixelRatio` (can be 3.5×) without cap
- Event listeners / observers not removed in `onUnload`
- Large image arrays retained after canvas draw
- `setInterval` without `clearInterval` in `onUnload`

---

## 5. 网络韧性 (Network Resilience) — 0–10

Behavior under real-world network conditions: 4G, weak signal, timeout, offline.

| Score | Criteria |
|-------|----------|
| 0–2 | White screen or crash on network error; no timeout handling; no retry |
| 3–4 | Basic error state but no retry; user stuck on error; no offline detection |
| 5–6 | Error states with retry button; timeout configured; loading states show during refetch |
| 7–8 | Graceful degradation (stale data shown while refetching); exponential backoff retry; 4G-aware prefetch gating |
| 9–10 | Offline-first with cached data; background sync on reconnect; network-quality-adaptive asset loading |

**Evidence required:**
- WeChat DevTools network throttling (Slow 3G / 4G profiles)
- Timeout configuration on new API calls
- Error state + retry UI on every data-dependent screen
- Stale-while-revalidate pattern or equivalent
- WS surfaces (gathering room, icebreaker): reconnect with heartbeat + backoff; presence leave-grace handled; HTTP poll fallback works when the socket is down

**Common killers:**
- No timeout on `fetch` / `Taro.request` calls
- Error state missing retry action
- Prefetch engine fires on 4G without checking network type
- No `navigator.onLine` / `Taro.getNetworkType` check before heavy data loads
- WS reconnect storm — reconnect without exponential backoff hammers the server on flaky networks
- Silent WS disconnect leaves stale presence or a frozen room state (no heartbeat-based liveness detection)
- Realtime page with no poll fallback when `connectSocket` fails or is unavailable

---

## 6. 包体积 (Package Size) — 0–10

Main package and subpackage sizes against WeChat's 2MB limit.

| Score | Criteria |
|-------|----------|
| 0–2 | Main package > 1.8MB gzip; no subpackage strategy; bundle growing unchecked |
| 3–4 | Main package 1.5–1.8MB gzip; some subpackages but new code lands in main |
| 5–6 | Main package < 1.5MB gzip; subpackages for deep-link pages; `check-package-size` passes |
| 7–8 | Main package < 1.2MB gzip; predictive preloading via `preloadRule`; large assets on CDN |
| 9–10 | Main package < 1MB gzip; lazy component loading (`lazyCodeLoading`); per-route bundle analysis in CI |

**Evidence required:**
- `npm run check:package-size` output
- Subpackage placement audit for changed code
- Any new local assets (images, fonts) > 20KB must be justified or moved to CDN

**Common killers:**
- New large images bundled locally instead of CDN
- Importing heavy libraries into main package
- Tab bar page bloat (cannot be subpackaged)
- Duplicate dependencies across subpackages
