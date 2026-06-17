# Performance Audit — Profile Tab Redesign (Follow-up)

**Surface:** JoyJoin WeChat Mini-Program Profile tab and linked sub-screens  
**Date:** 2026-06-17  
**Auditor:** Performance Audit agent  
**Scope:** Re-audit after lazy-loading the social-card poster generator (`generateProfileSharePoster`). Subpackage migration of utility pages was deferred.

---

## Re-run automated evidence

```bash
npm run check:package-size -w mini-program
```

```bash
node scripts/perf-audit-collect.mjs \
  --changed-files=apps/mini-program/src/pages/profile/index.tsx,apps/mini-program/src/pages/profile/index.scss,apps/mini-program/src/pages/profile/profilePoster.ts,apps/mini-program/src/pages/profile/useProfileShareCard.ts,apps/mini-program/src/components/mascot/ArchetypeHead.tsx,packages/shared/src/iconSystem/emojiToIconMap.ts,packages/shared/src/iconSystem/__tests__/iconTiers.test.ts,apps/mini-program/src/pages/edit-profile/index.scss,apps/mini-program/src/pages/rewards/index.scss,apps/mini-program/src/pages/invite/index.scss,apps/mini-program/src/pages/terms/index.tsx,apps/mini-program/src/pages/terms/index.scss
```

**Package-size measurements (after fix)**

| Metric | Before fix | After fix | Delta |
|---|---|---|---|
| Main package (zip) | 1.91 MB | **1.91 MB** | **0 KB** |
| Main package (raw) | 3.17 MB | 3.17 MB | 0 KB |
| Main pages | 541.5 KiB | 542.0 KiB | +0.5 KiB |
| Onboarding subpackage | 505.3 KiB | 505.3 KiB | 0 KB |
| Total (zip) | 2.53 MB | 2.53 MB | 0 KB |

**New / changed anti-patterns**

| File | Pattern | Assessment |
|---|---|---|
| `apps/mini-program/src/pages/profile/profilePoster.ts` | `uncapped-canvas-dpr` | **False positive in current call path** — DPR is capped by caller (`useProfileShareCard` passes `preferredDpr`) and by `exportCanvasWithRetry`. However, `profilePoster.ts` itself does not enforce a cap, so calling it from another site could be risky. |
| `apps/mini-program/src/pages/profile/profilePoster.ts` | `new-page-in-main-package` | **False positive** — subpackage audit regex treats any file under `pages/` as a page. |
| `apps/mini-program/src/pages/profile/useProfileShareCard.ts` | `new-page-in-main-package` | **False positive** — same reason. |
| `packages/shared/src/iconSystem/emojiToIconMap.ts` | `missing-reduced-motion-check` | **False positive** — static data file. |
| `apps/mini-program/src/pages/terms/index.tsx` | `list-missing-virtual-list`, `page-check-lazy`, `new-page-in-main-package` | Unchanged findings from previous audit. |

---

## Updated dimension scores

| Dimension | Previous | Current | Rationale |
|---|---|---|---|
| **流畅度 Smoothness** | 8 | **8** | No change. Motion is still `transform`/`opacity`, gated by reduced-motion and degradation. |
| **速度 Speed** | 7 | **7** | Dynamic import defers poster-generator parse/execution until first share tap, but the module is still in the main package, so download/parse on Profile cold start is unchanged. No TTI measurement available. |
| **设备适配 Device Adaptability** | 8 | **8** | No change. `useDeviceTier`, reduced-motion gating, and safe-area handling remain intact. |
| **内存安全 Memory Safety** | 8 | **8** | Poster code is loaded on demand, lowering initial memory footprint. DPR still capped via caller and `exportCanvasWithRetry`. |
| **网络韧性 Network Resilience** | 8 | **8** | No change. TanStack Query `offlineFirst`, retry, and pull-to-refresh behavior unchanged. |
| **包体积 Package Size** | 4 | **4** | Main package zip remains **1.91 MB**, exceeding the 1.80 MB guideline. Lazy-loading did **not** move code out of the main package. |

**Composite score:** 43 / 60 (unchanged)

---

## Did lazy-loading help?

**Package size:** **No measurable improvement.** The main package zip is identical (1.91 MB). This indicates Taro/Webpack is keeping `profilePoster.ts` inside the main chunk despite the dynamic `import()`. In WeChat Mini Program builds, dynamic imports often do not create independently counted subpackages unless the bundler is configured to split code, and even then the split chunk may still be downloaded with the main package.

**Speed:** **Marginal theoretical benefit, no measured evidence.** Because the poster code is not parsed/executed until the user taps “分享我的社交名片”, initial JS parse and memory pressure on Profile load are slightly lower. However, since the bytes still travel over the wire in the main package, cold-start download time is unchanged. No DevTools trace was captured to quantify parse-time savings.

**Memory safety:** **Slight improvement.** The canvas drawing code and its helper imports are not instantiated until the share flow is triggered, reducing the memory footprint of the Profile tab for users who never open the share card.

---

## Updated verdict

**WARN** (unchanged)

Composite ≥ 36 and no dimension < 4, so the change is not a BLOCK. The main package remains over the 1.80 MB guideline, and the deferred subpackage migration is still the highest-ROI fix.

---

## Ranked fix recommendations (updated)

| Rank | Fix | Impact | Effort | Notes |
|---|---|---|---|---|
| 1 | **Move `terms`, `edit-profile`, `rewards`, `invite` to a new Profile-linked subpackage** (e.g. `pages/profile-extra`). | High | Medium | This is the only change that will materially reduce main-package size. Deferred due to regression risk; do it in a dedicated branch with full smoke test. |
| 2 | **Add preload rule from `pages/profile/index` to the new subpackage** so navigation stays fast. | Medium | Low | — |
| 3 | **Investigate Taro dynamic-import chunk splitting.** If `profilePoster.ts` must stay in main, consider moving it to a separate subpackage page or using `webpackChunkName` / Taro config to force a split. | Medium | Medium | Current lazy import is correct code hygiene but does not help package-size budget. |
| 4 | **Defensively cap DPR inside `profilePoster.ts`** even though callers currently cap it, to prevent future misuse. | Low | Low | Add `const dpr = Math.min(input.preferredDpr ?? 2, 2)` and pass it through. |
| 5 | **Measure Profile cold-start TTI with WeChat DevTools** after subpackage migration to validate improvement. | Medium | Low | — |

---

## Sign-off

- [x] Re-run automated evidence collection
- [x] Six dimensions re-scored
- [x] Lazy-loading impact confirmed (package size unchanged; parse/memory marginally improved)
- [x] Updated verdict and recommendations produced
