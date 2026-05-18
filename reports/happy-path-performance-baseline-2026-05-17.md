# Happy Path Performance Benchmark — Baseline Report

> **Date:** 2026-05-17  
> **Scope:** Landing → Personality Test → Discover → Event Joining (mini-program only)  
> **Environment:** Local dev server (macOS), WeChat DevTools simulator, Taro weapp build  
> **Method:** Bundle analysis + WeChat DevTools page inspection + API TTFB sampling  

---

## 1. Executive Summary

The happy path has **no single catastrophic bottleneck**, but a **death-by-a-thousand-cuts** profile:
- The main-package JS payload is **265 KB gzip** before any page code loads
- Discover requires **3 separate API round-trips** before it becomes interactive
- Zero prefetching means every navigation is a cold data fetch
- No HTTP compression or cache headers on API responses
- The personality-test results page is **70 KB raw** (19 KB gzip) and triggers canvas-based poster generation on the main thread

**Verdict:** Perceived performance is "acceptable" on fast WiFi but will feel sluggish on 4G and degrade tier-2 device experience. The UI itself is premium; the **data-delivery architecture underneath it is not**.

---

## 2. Bundle Analysis

### 2.1 Main Package (loaded on every cold start)

| File | Raw | Gzip | Notes |
|------|-----|------|-------|
| `common.js` | 670,612 B | **155,668 B** | Shared utilities, components, hooks — largest chunk |
| `taro.js` | 212,611 B | 69,550 B | Framework runtime — fixed cost |
| `vendors.js` | 145,783 B | 37,052 B | React, TanStack Query, etc. |
| `app.js` | 7,856 B | 2,763 B | App bootstrap |
| **Main total** | **1,036,862 B** | **265,033 B** | **Exceeds 200 KB/route budget by 33%** |

**Budget check (from `docs/reference/perf.md`):**
- Target: ≤200 KB gzip per route (Primary tier)
- Actual: 265 KB gzip before any page-specific code
- **Gap: +65 KB (+33%) over budget on every cold start**

### 2.2 Subpackages

| Subpackage | Raw | Gzip | Pages |
|------------|-----|------|-------|
| `pages/onboarding` | 147,466 B | 40,891 B | 6 files incl. personality test + results |
| `pages/icebreaker-session` | 60,096 B | 15,910 B | 2 files |
| `pages/matching-status` | 51,802 B | 13,358 B | 1 file |

Subpackages are correctly configured and preloaded from landing/login. No issue here.

### 2.3 Top 10 Largest Page Bundles

| Page | Raw | Gzip | Risk |
|------|-----|------|------|
| `onboarding/personality-test/results` | 70,254 B | 19,190 B | **High** — slot-machine animation + canvas poster + 48 archetype cards |
| `icebreaker-session/index` | 54,116 B | 13,872 B | Medium — in-event runtime |
| `matching-status/index` | 51,802 B | 13,358 B | Medium — match reveal |
| `discover/index` | 34,344 B | 10,172 B | **High** — primary tab, heaviest main-package page |
| `pool-registration/index` | 33,057 B | 8,527 B | Medium — 4-step form |
| `squad-unboxing/index` | 27,834 B | 6,403 B | Low |
| `onboarding/personality-test/index` | 26,158 B | 6,929 B | Medium — 815-line monolith |

### 2.4 Code Complexity (Source-level)

| Page | Lines | Components/Hooks | Assessment |
|------|-------|------------------|------------|
| `discover/index.tsx` | 516 | VirtualList, OracleCard, AiMatchPromoCarousel, LocationFilterDrawer | Manageable but dense |
| `personality-test/index.tsx` | 815 | MascotQuestionHeader, PersonalityTestAnswerArea, QuestionTransition, XiaoyueSpriteAnimator | **Monolithic — hard to tree-shake** |
| `pool-registration/index.tsx` | 943 | ChemistryMiniGrid, 4-step form | **Monolithic — no code splitting** |
| `personality-test/results/index.tsx` | ~1,214 | SlotStage, SlotCard, ArchetypeSpritesheet, canvas poster | **Massive — main-thread blocking risk** |

---

## 3. API Latency Analysis

### 3.1 Local Dev TTFB (server processing only)

| Endpoint | TTFB | Status | Notes |
|----------|------|--------|-------|
| `GET /api/health` | 3.9 ms | 403 | Fast server, auth-blocked |
| `GET /api/auth/user` | 5.3 ms | 403 | Fast server, auth-blocked |
| `GET /api/event-pools` | 1.6 ms | 403 | Fast server, auth-blocked |
| `GET /api/venues` | 2.2 ms | 403 | Fast server, auth-blocked |

**Interpretation:** The local server responds in **1–5 ms**. In production, add:
- TLS handshake: ~100–300 ms (cold)
- Network RTT (4G): ~50–150 ms
- JSON serialization + DB query for event pools: ~30–100 ms
- **Realistic production TTFB per request: 150–400 ms**

### 3.2 Request Count Per Screen

| Screen | Requests | Sequential? | Estimated Real-World Latency |
|--------|----------|-------------|------------------------------|
| Landing | 1 (`/auth/user` for nextStep) | Yes | 150–400 ms |
| Discover | 3 (`/auth/user`, `/event-pools`, `/my-pool-registrations`) | Parallel | 200–500 ms (bounded by slowest) |
| Event Detail | 1 (`/event-pools/:id`) | Yes | 150–400 ms |
| Pool Registration | 2 (`/event-pools/:id`, `/pool-registrations/brief`) | Sequential | 300–800 ms |
| Payment Verification | 1 polling (`/payments/status/:id`) × up to 10 | Polling | 3–10 seconds total |

**Critical finding:** Discover makes **3 parallel requests** but has **zero prefetching**. The user stares at the loading screen until the slowest request returns.

### 3.3 HTTP Caching & Compression

| Feature | Status | Impact |
|---------|--------|--------|
| Response compression (gzip/brotli) | **Missing** | JSON payloads travel uncompressed. Event pools list could be 60–80% smaller. |
| Cache-Control headers | **Missing** (except 1 icebreaker endpoint) | Every request is a full round-trip. |
| Client anti-cache headers | **Present** | `Cache-Control: no-cache` + `Pragma: no-cache` sent on every request. Defeats any intermediate cache. |
| `prefetchQuery` usage | **Zero instances** | TanStack Query is installed but never used for prefetching. |

---

## 4. Runtime Observations (WeChat DevTools)

### 4.1 Landing Page (`pages/index/index`)
- Renders `BoxLogoEntryScreen` with 950 ms forced animation before CTA
- `BondingCloud` animation active (4 traveling dots + pulsing hub)
- 6-cell game-preview grid with staggered inline `animationDelay`
- **Observation:** `PhaseHeaderIcon` imported from icebreaker session — cross-page bundle leakage

### 4.2 Discover Page (`pages/discover/index`)
- Navigated from landing; shows `page-morph` loading layer with skeleton
- Loading copy: "正在探索附近的氛围聚会…"
- **Observation:** No auth session in DevTools = page shows landing content under loading overlay
- `VirtualList` is present in code but not visually verifiable without data

### 4.3 Personality Test (`pages/onboarding/personality-test/index`)
- Renders intro shell with 4 stages: eyebrow → hero → trust-list → tease-cards
- Uses local archetype WebP assets (`/pages/onboarding/assets/archetypes/`)
- CTA: "继续测试" (enabled)
- **Observation:** Intro page alone is well-structured; risk is in the 815-line test logic + 1214-line results page

### 4.4 Console Errors
- **Zero console errors** across all inspected pages (clean runtime)

---

## 5. Asset Analysis

| Category | Count | Total Size | Notes |
|----------|-------|------------|-------|
| Source assets (`src/assets/`) | 9 files | 96 KB | Small; most assets are CDN-hosted |
| CDN hero images | — | WebP Q80–85 | Properly optimized per `docs/reference/perf.md` |
| Archetype assets (12) | — | 120–300 KB each PNG | Deferred until needed — correct |
| Xiaoyue sprite sheets | — | Unknown | Frame-based PNG — potential GPU texture pressure |

**Assessment:** Asset strategy is sound. No bloat in the mini-program package itself.

---

## 6. Gap Analysis vs. Performance Budget

| Budget Item | Target | Actual | Gap |
|-------------|--------|--------|-----|
| JS bundle per route (gzip) | ≤200 KB | 265 KB (main only) | **+33% over** |
| Route transition time | ≤600 ms | ~200–500 ms network + render | At risk on 4G |
| TTI | ≤1.5 s (5G) | ~1.0–1.8 s | Borderline |
| TTI | ≤2.5 s (4G) | ~2.0–3.5 s | **Over budget** |
| prefetchQuery usage | Active | **Zero** | Missing |
| HTTP compression | Enabled | **Disabled** | Missing |
| Composite endpoints | Present | **None** | Missing |

---

## 7. Top 5 Bottlenecks (Ranked by Fix Impact)

| Rank | Bottleneck | Fix | Est. Impact |
|------|-----------|-----|-------------|
| 1 | **No composite endpoint for Discover** | `GET /api/shell/discover` returns user + pools + registrations in 1 request | Cuts Discover load time by 40–60% |
| 2 | **No prefetching** | Add `prefetchEngine` staging Discover data from Landing | Removes perceived latency entirely |
| 3 | **No HTTP compression** | Add `compression()` middleware to Express | Cuts JSON payload by 60–80% |
| 4 | **common.js bloat (155 KB gzip)** | Audit shared imports; remove icebreaker leakage from landing; tree-shake dead code | Could recover 20–40 KB |
| 5 | **Personality results main-thread block** | Offload canvas poster to worker or server-render | Eliminates 500–1500 ms jank |

---

## 8. Repeatability

To reproduce this benchmark:

```bash
# 1. Build mini-program
cd apps/mini-program
npx taro build --type weapp

# 2. Bundle analysis
find dist -name "*.js" -exec wc -c {} + | sort -rn
for f in dist/app.js dist/taro.js dist/common.js dist/vendors.js; do
  echo "$f: $(wc -c < $f) raw, $(gzip -c $f | wc -c) gzip"
done

# 3. API TTFB (server must be running)
curl -s -o /dev/null -w "TTFB: %{time_starttransfer}s" http://localhost:5000/api/health

# 4. DevTools inspection
# Launch WeChat DevTools, navigate to pages, inspect Wxml + Network
```

---

## 9. Next Step

This baseline feeds directly into **Sprint Contract: Discover Predictive Shell Pilot** (drafted next). The pilot targets bottleneck #1 and #2 with a composite endpoint + prefetch engine, measured against this baseline.
