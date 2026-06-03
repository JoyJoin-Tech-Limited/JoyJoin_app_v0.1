# Performance Audit — Personality Test Results Page

**Scope:** `apps/mini-program/src/pages/onboarding/personality-test/results/`  
**Date:** 2026-06-03  
**Auditor:** Agent (static code review)  
**Device Baseline:** Gen Z Primary tier (8GB+ / 120Hz / 5G)

---

## Dimension Scores

| # | Dimension | Score | Evidence | Rationale |
|---|-----------|:---:|:---:|---|
| 1 | **流畅度 (Smoothness)** | 8 | Slot machine uses composited `translateY`; card tilt uses `rotateX/Y` transforms; detail sheet uses CSS animation with `cubic-bezier(0.22, 1, 0.36, 1)`; segmented trait bars are static (zero animation cost). No `filter: blur()`, no `box-shadow` animation, no layout-thrashing properties animated. | Animations are fully composited. Only deduction: no frame-timing traces on real device to confirm 120Hz butter-smoothness. |
| 2 | **速度 (Speed)** | 8 | Results page lives in onboarding subpackage (preloaded from index/login). Local archetype images prioritized over CDN (`displayAsset` local → `visual.asset` CDN fallback). Canvas poster generation is on-demand, non-blocking. No new API endpoints introduced. | Cold start and route transition performance unchanged by this PR. Predictive prefetch already covers onboarding subpackage. |
| 3 | **设备适配 (Device Adaptability)** | 7 | Reduced-motion fully supported (CSS `@media` + JS `getSystemInfoSync().reduceMotion` + `SlotStage` static fallback + `.personality-results--reduce-motion` class). Safe areas via `safe-area-bottom-padding`. Canvas WebP → PNG fallback handles iPhone WKWebView compat. **Gap:** No `benchmarkLevel` or device-tier detection to gate slot animation complexity on low-end devices. | Solid accessibility and safe-area handling. Missing runtime capability gating for heavy animations. |
| 4 | **内存安全 (Memory Safety)** | 6 | Canvas DPR is capped at 2× (`Math.min(Math.max(dpr, 1), 2)`). Triple fallback `[exportMultiplier, 2, 1]` for canvas export. `timeoutHandlesRef` bulk-clears pending timeouts. **Gap:** No `useUnload` / `onUnload` cleanup for timers, refs, or analytics subscriptions when user swipes back or navigates away. | DPR cap prevents iPhone canvas crash. Timer cleanup is present but not tied to page lifecycle. |
| 5 | **网络韧性 (Network Resilience)** | 7 | Local bundled archetype images are primary; CDN WebP is fallback. `ErrorStage` provides retry + restart on network failures. Share poster failure surfaces toast with warm copy. **Gap:** No explicit `Taro.request` timeout configuration; no automatic retry on transient network errors. | Graceful degradation with local-first assets. Missing explicit timeout and auto-retry. |
| 6 | **包体积 (Package Size)** | 9 | This PR changes only CSS/TSX code — zero new assets, zero new dependencies. Archetype images remain in local subpackage (already budgeted). No bloat to main package. | Neutral impact on bundle. `check-package-size` would show no regression. |

**Composite Score: 45 / 60**

---

## Gate Verdict

| Threshold | Required | Actual |
|-----------|:---:|:---:|
| PASS | ≥ 48, no dim < 6 | 45 |
| WARN | ≥ 36, no dim < 4 | **✅ 45** |
| BLOCK | < 36 or any dim < 4 | — |

**Verdict: WARN** — Ship with documented trade-offs. Two dimensions are within 1–2 points of PASS.

---

## ROI-Ranked Fix Recommendations

| # | Fix | Dimension | Impact | Effort | Score Gain |
|---|-----|-----------|:---:|:---:|---:|
| 1 | **Add `useUnload` cleanup** for `timeoutHandlesRef`, `mountedRef`, and analytics callbacks | #4 Memory | Medium | 1h | +1 → 7 |
| 2 | **Add `benchmarkLevel` gating** for slot animation complexity | #3 Device | Medium | 2h | +1 → 8 |
| 3 | **Add explicit request timeout** (~10s) to `fetchResult` and `generatePersonalitySharePoster` | #5 Network | Low | 1h | +0–1 → 7–8 |

**Applying fixes #1 + #2 would raise composite to 47/60** — within 1 point of PASS.

---

## Grill-Me Stress-Test

### Q: Did you test scroll performance inside the detail sheet on a Xiaomi 13 at 120Hz?
> ScrollView inside flex parent uses `flex: 1; min-height: 0; overflow: hidden`. No `VirtualList` needed (only 6 trait rows + archetype description). No heavy shadows or blur filters. Expected smooth at 120Hz on Primary tier.

### Q: What happens if the user opens results, then immediately swipes back?
> `useDidShow` resets `isAnimatingRef` on page reuse. **But** `timeoutHandlesRef` is not cleared on page unload — timers may fire after the component is unmounted. Fix #1 addresses this.

### Q: Canvas poster at 2× DPR on iPhone 15 — memory safe?
> Poster dimensions are 750×1334 logical. At 2× DPR = 1500×2668 px. PNG memory = ~16MB. Below iPhone's ~300–500MB mini-program ceiling. Triple fallback `[dpr, 2, 1]` ensures graceful degradation if export fails.

### Q: Is the segmented trait bar (10 pills) more expensive than the old continuous bar?
> Old bar: single `View` with animated `scaleX`. New bar: 10 static `View` nodes with conditional class. **No animation** on the new bars — they render once and never change. Slightly more DOM nodes (10 vs 1) but zero animation cost. Net performance impact is neutral or slightly positive (no scaleX repaints).

---

## Trade-Off Documentation (for WARN)

**Why WARN is acceptable for this PR:**

1. **No performance regression introduced.** All changes are CSS/layout or copy — no new animations, no new network calls, no new assets.
2. **Memory Safety gap (#4) is pre-existing.** The missing `useUnload` cleanup exists in the baseline, not introduced by this PR.
3. **Device Adaptability gap (#3) is architectural.** `benchmarkLevel` gating is a platform-wide improvement, not scoped to results page.
4. **Fixes #1 and #2 are small, isolated PRs** that can be scheduled for the next sprint without blocking this release.
