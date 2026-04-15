---
name: frontend-performance-and-loading
description: >-
  Frontend loading and runtime performance guidance for route splitting, Suspense,
  asset loading, list-size heuristics, and platform-appropriate loading strategies.
  Use when improving page load speed, route transitions, bundle behavior, or long-list
  rendering in web or mini-program clients. Trigger phrases: "React.lazy",
  "bundle size", "LCP", "prefetchQuery", "VirtualList", "loading strategy".
---

# Frontend Performance and Loading

## Purpose

This skill covers how JoyJoin keeps web and mini-program surfaces fast to load,
cheap to interact with, and deliberate about loading states. It owns the runtime
loading strategy, not general component placement or visual token decisions.

## When to use this skill

Use this skill when you are:

- adding a new route or page and deciding its loading strategy
- changing route splitting, `React.lazy()`, `Suspense`, or `LoadingScreen`
- optimizing asset loading, image decoding, or data prefetch behavior
- reviewing long lists, grids, or scroll-heavy surfaces for jank risk
- adapting a performance-sensitive screen for mini-program constraints

## Core rules

1. Keep non-critical routes lazy by default.
   `apps/user-client/src/App.tsx` is the current reference for route-level code splitting.

2. Separate loading strategy from component placement.
   Use this skill for performance and loading behavior. Use `frontend-component-architecture`
   for deciding where components belong.

3. Gate prefetch work on real need.
   Do not prefetch heavy assets or next-step data for users who are not likely to use it.

4. Use the repo's shared performance references instead of duplicating thresholds.
   `docs/perf.md` is the runtime strategy guide, and
   `.github/skills/design-system-governance/references/frontend-excellence-thresholds.md`
   is the canonical source for reusable list and interaction heuristics.

5. Treat web and mini-program as different renderers.
   The performance intent should match, but list handling, interaction models, and
   heavy-asset strategies may differ between Vite web and Taro mini-program surfaces.

6. Loading states are part of the feature, not a fallback afterthought.
   If a route or action can wait, the loading, empty, and retry states should be explicit.

7. Mini-program package splitting is benchmark-driven.
   Start with ordinary subpackages and `preloadRule` for heavy non-tab flows. Do not recommend independent subpackages by default, but do not reject them categorically either; use them only when measured wins justify self-contained bootstrap and duplicated setup.

## Current repo anchors

- `docs/perf.md` defines the active web performance strategy and guardrails.
- `apps/user-client/src/App.tsx` is the reference for route-level lazy loading.
- `scripts/test-performance-fixes.sh` shows the current lightweight performance verification style.
- The shared frontend thresholds reference centralizes reusable heuristics for long lists and touch targets.

## Quick examples

- **Add a new user-client page**: default to `React.lazy()` unless it is part of the critical initial path.
- **Review a long feed**: profile it, then use virtualization, pagination, or progressive disclosure before visible jank appears.
- **Tune a mini-program collection**: use the shared thresholds reference and prefer renderer-appropriate approaches such as `VirtualList` or subpackages.
- **Mini-program personality flow feels heavy**: measure main-package size and target-page first-open time, split into ordinary subpackages, add `preloadRule` from the likely entry page, and revisit independent subpackages only if the measured gain is still insufficient.

## Troubleshooting

**A new page was added with a static import in `App.tsx`**
If the page is not critical to first render, convert it to `React.lazy()` and keep the loading path explicit.

**The screen feels slow because of images**
Check decoding, lazy loading, hero asset format, and whether the image is on the critical render path at all.

**A list works on desktop but janks on mobile**
Re-check item density, media cost, and the shared thresholds reference before adding more decoration.

**A performance fix is described without measurement**
Pair the change with a benchmark, verification step, or before/after comparison instead of relying on feel alone.

**The team wants independent subpackages immediately**
Treat that as a hypothesis, not a conclusion. Compare ordinary subpackages plus preload against independent subpackages with real numbers and an explicit bootstrap plan.

## Review checklist

- [ ] Non-critical routes use lazy loading by default on the web
- [ ] Loading, empty, and retry states are explicit for slow or deferred work
- [ ] Asset prefetching is gated on real user need
- [ ] Long-list heuristics come from the shared thresholds reference instead of copied numbers
- [ ] Mini-program performance choices respect the Taro renderer rather than assuming DOM behavior
- [ ] Mini-program package proposals compare ordinary subpackages plus preload against independent subpackages with a real benchmark and bootstrap plan
- [ ] The change has a concrete validation path, not only subjective performance claims

## Related files

- `docs/perf.md`
- `.github/skills/design-system-governance/references/frontend-excellence-thresholds.md`
- `apps/user-client/src/App.tsx`
- `apps/user-client/src/pages/LandingPage.tsx`
- `apps/user-client/src/pages/DiscoverPage.tsx`
- `apps/user-client/src/pages/MatchingStatusPage.tsx`
- `apps/mini-program/src/pages/`
- `scripts/test-performance-fixes.sh`