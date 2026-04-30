# Performance Patterns

## React.lazy Examples

```tsx
// apps/user-client/src/App.tsx
const DiscoverPage = React.lazy(() => import("./pages/DiscoverPage"));
const MatchingStatusPage = React.lazy(() => import("./pages/MatchingStatusPage"));

// Critical path stays eager
import LandingPage from "./pages/LandingPage";
```

- Wrap lazy routes in a shared `<Suspense fallback={<LoadingScreen />}>`
- Do not static-import non-critical pages

## prefetchQuery Specifics

```tsx
// Prefetch only when the user is likely to navigate
useEffect(() => {
  if (userHasIncompleteOnboarding) {
    queryClient.prefetchQuery({
      queryKey: ["onboarding", "nextStep"],
      queryFn: fetchNextStep,
      staleTime: 30_000,
    });
  }
}, [userHasIncompleteOnboarding]);
```

Rules:
- Gate prefetch on real need (e.g., incomplete onboarding, in-progress flow)
- Do not prefetch heavy assets or next-step data for users unlikely to use it
- Set a reasonable `staleTime` to avoid redundant fetches

## VirtualList Setup

### Web
```tsx
import { FixedSizeList } from "react-window";
<FixedSizeList height={600} itemCount={items.length} itemSize={80}>
  {Row}
</FixedSizeList>
```

### Mini-program (Taro)
```tsx
import { VirtualList } from "@tarojs/components";
<VirtualList
  height="800px"
  itemData={items}
  itemCount={items.length}
  itemSize={100}
  renderItem={ItemRenderer}
/>
```

Use virtualization when collections approach ~100 lightweight rows or ~40 rich cards (web), or ~60 rich cards / ~100 lightweight rows (mini-program).

## Bundle Analysis Steps

1. Run `npm run build` in the target app workspace
2. Inspect `dist/assets/*.js` output sizes
3. Use `scripts/check-bundle-size.mjs` or `npm run dep-check` for guardrails
4. For mini-program: check `apps/mini-program/scripts/check-xiaoyue-asset-size.mjs`
5. Flag oversized rasters or SVGs before they reach production

## LCP Optimization Checklist

- [ ] Hero image is the only above-the-fold image and uses modern format (WebP/AVIF)
- [ ] Hero image has explicit `width` and `height` to prevent layout shift
- [ ] Critical CSS is inlined or loaded before render-blocking resources
- [ ] No synchronous third-party scripts in `<head>` without `async`/`defer`
- [ ] Font display uses `font-display: swap` for custom fonts
- [ ] Preconnect to API origin and CDN origins

## Mini-program Subpackage Strategy

1. Start with ordinary subpackages and `preloadRule` for heavy non-tab flows
2. Measure main-package size and target-page first-open time
3. Add `preloadRule` from the likely entry page
4. Revisit independent subpackages only if measured gains justify self-contained bootstrap and duplicated setup

## Related Thresholds

See `.github/skills/design-system-governance/references/frontend-excellence-thresholds.md` for list-size heuristics and touch-target baselines.
