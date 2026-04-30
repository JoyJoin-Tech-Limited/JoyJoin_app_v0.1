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

Keep web and mini-program surfaces fast to load, cheap to interact with, and
deliberate about loading states. Owns runtime loading strategy, not component
placement or visual token decisions.

## When to use this skill

- Adding a new route or page and deciding its loading strategy
- Changing route splitting, `React.lazy()`, `Suspense`, or `LoadingScreen`
- Optimizing asset loading, image decoding, or data prefetch behavior
- Reviewing long lists, grids, or scroll-heavy surfaces for jank risk
- Adapting a performance-sensitive screen for mini-program constraints

## Core rules

1. **Keep non-critical routes lazy by default.** `App.tsx` is the reference for
   route-level code splitting.
2. **Separate loading strategy from component placement.** Use this skill for
   performance; use `frontend-component-architecture` for component location.
3. **Gate prefetch work on real need.** Do not prefetch heavy assets or next-step
   data for users unlikely to use it.
4. **Use shared performance references.** `docs/perf.md` is the runtime strategy
   guide; `.github/skills/design-system-governance/references/frontend-excellence-thresholds.md`
   has reusable list and interaction heuristics.
5. **Treat web and mini-program as different renderers.** Performance intent should
   match, but list handling and heavy-asset strategies may differ.
6. **Loading states are part of the feature.** If a route or action can wait, the
   loading, empty, and retry states should be explicit.

For `React.lazy` examples, `prefetchQuery` specifics, `VirtualList` setup, bundle
analysis steps, and LCP optimization checklists, see
[`references/performance-patterns.md`](./references/performance-patterns.md).

## Current repo anchors

- `docs/perf.md` — active web performance strategy
- `apps/user-client/src/App.tsx` — route-level lazy loading reference
- `scripts/test-performance-fixes.sh` — lightweight verification style

## Quick examples

- **Add a new page** → default to `React.lazy()` unless it is on the critical path.
- **Review a long feed** → profile, then virtualize or paginate before jank appears.
- **Tune a mini-program collection** → use shared thresholds; prefer
  `VirtualList` or subpackages.
- **Budget large new assets** → flag oversized rasters per repo scripts and align
  first-load expectations with `docs/perf.md`.

## Troubleshooting

**New page added with a static import in `App.tsx`**
→ Convert to `React.lazy()` and keep the loading path explicit.

**Screen feels slow because of images**
→ Check decoding, lazy loading, hero asset format, and critical-render-path placement.

**List works on desktop but janks on mobile**
→ Re-check item density, media cost, and shared thresholds before adding decoration.

**Performance fix is described without measurement**
→ Pair with a benchmark or before/after comparison instead of relying on feel.

## Review checklist

- [ ] Non-critical routes use lazy loading by default on the web
- [ ] Loading, empty, and retry states are explicit for slow or deferred work
- [ ] Asset prefetching is gated on real user need
- [ ] Long-list heuristics come from the shared thresholds reference
- [ ] Mini-program choices respect the Taro renderer
- [ ] The change has a concrete validation path, not only subjective claims

## Related files

- `docs/perf.md`
- `apps/user-client/src/App.tsx`
- `scripts/test-performance-fixes.sh`
- `.github/skills/design-system-governance/references/frontend-excellence-thresholds.md`
- [`references/performance-patterns.md`](./references/performance-patterns.md)
