# Performance Audit — Profile Tab Redesign

**Surface:** JoyJoin WeChat Mini-Program Profile tab and linked sub-screens  
**Date:** 2026-06-17  
**Auditor:** Performance Audit agent  
**Changed files:**
- `apps/mini-program/src/pages/profile/index.tsx`
- `apps/mini-program/src/pages/profile/index.scss`
- `apps/mini-program/src/components/mascot/ArchetypeHead.tsx`
- `packages/shared/src/iconSystem/emojiToIconMap.ts`
- `packages/shared/src/iconSystem/__tests__/iconTiers.test.ts`
- `apps/mini-program/src/pages/edit-profile/index.scss`
- `apps/mini-program/src/pages/rewards/index.scss`
- `apps/mini-program/src/pages/invite/index.scss`
- `apps/mini-program/src/pages/terms/index.tsx`
- `apps/mini-program/src/pages/terms/index.scss`

---

## Automated evidence

```bash
node scripts/perf-audit-collect.mjs \
  --changed-files=apps/mini-program/src/pages/profile/index.tsx,apps/mini-program/src/pages/profile/index.scss,apps/mini-program/src/components/mascot/ArchetypeHead.tsx,packages/shared/src/iconSystem/emojiToIconMap.ts,packages/shared/src/iconSystem/__tests__/iconTiers.test.ts,apps/mini-program/src/pages/edit-profile/index.scss,apps/mini-program/src/pages/rewards/index.scss,apps/mini-program/src/pages/invite/index.scss,apps/mini-program/src/pages/terms/index.tsx,apps/mini-program/src/pages/terms/index.scss
```

```bash
npm run check:package-size -w mini-program
```

**Key measurements**
- Main package (zip): **1.91 MB** (limit: 2.00 MB; project guideline: 1.80 MB)
- Main package (raw): **3.17 MB**
- Onboarding subpackage: 505.3 KiB
- Icebreaker Session subpackage: 29.0 KiB
- Matching Status subpackage: 23.2 KiB
- Pool Registration subpackage: 69.4 KiB
- Total (zip): 2.53 MB (limit: 20 MB)

**Auto-detected anti-patterns**
| File | Pattern | Assessment |
|---|---|---|
| `packages/shared/src/iconSystem/emojiToIconMap.ts` | `missing-reduced-motion-check` | **False positive** — static mapping data file, no runtime animation. |
| `apps/mini-program/src/pages/terms/index.tsx` | `list-missing-virtual-list` | **False positive** — legal sections are fixed and small (< 30 items). |
| `apps/mini-program/src/pages/terms/index.tsx` | `page-check-lazy` | **Valid finding** — `terms` is a non-tab page in the main package. |
| `apps/mini-program/src/pages/terms/index.tsx` | `new-page-in-main-package` | **Valid finding** — same as above. |

---

## Dimension scores

| Dimension | Score | Rationale |
|---|---|---|
| **流畅度 Smoothness** | 8 | Entrance animations use only `transform`/`opacity` with `cubic-bezier(0.22, 1, 0.36, 1)`. `prefers-reduced-motion` and `.profile-page--degradation` disable motion. No `filter: blur()` or layout-thrashing patterns. Profile content is short and does not need `VirtualList`. |
| **速度 Speed** | 7 | Tab switch is instant (main package). Data fetched via TanStack Query behind skeletons. `PrefetchEngine` preloads Events/Connections shells after Profile shell resolves. No measured cold-start TTI available; non-tab linked pages (`terms`, `edit-profile`, `rewards`, `invite`) are not lazy-loaded. |
| **设备适配 Device Adaptability** | 8 | `useDeviceTier` gates animations. iPhone model heuristic handles missing `benchmarkLevel`. `prefers-reduced-motion` + degradation class both disable motion. Safe-area mixins used. Canvas share poster uses DPR 2 on primary / 1 on degradation. No hardcoded `px` values. |
| **内存安全 Memory Safety** | 8 | Canvas DPR is capped (`preferredDpr: isDegradation ? 1 : 2`) with `exportCanvasWithRetry` 2→1 fallback. Timers, network listeners, and loading toasts are cleaned up. Off-screen canvas is 1×1 px. No uncapped DPR or retained large arrays detected. |
| **网络韧性 Network Resilience** | 8 | `useQuery` uses `offlineFirst`, exponential backoff retry, and `staleTime`. Pull-to-refresh checks network type first. `Taro.onNetworkStatusChange` auto-refetches when connectivity returns. Error card with retry is rendered above the fold. |
| **包体积 Package Size** | 4 | Main package zip is **1.91 MB**, exceeding the 1.80 MB guideline. It is under the 2.00 MB hard limit. Subpackages exist and are actively used, but `terms`, `edit-profile`, `rewards`, and `invite` live in the main package. `lazyCodeLoading: 'requiredComponents'` is active. |

**Composite score:** 43 / 60

---

## Gate verdict

**WARN**

Reasoning:
- Composite ≥ 36 (43).
- No dimension < 4 (lowest is Package Size at 4).
- However, the main package exceeds the project’s 1.8 MB guideline and the performance-audit rubric’s 1.5–1.8 MB “good” band. This is a documented trade-off driven by the Profile tab being a mandatory tab-bar page plus several linked utility pages currently placed in the main package.

---

## Grill-me stress-test

Dimensions scoring < 8: **Speed (7)**, **Package Size (4)**.

### Speed

**Q1 (smoke-test):** What’s the measured cold-start time to interactive for the changed page on 5G?  
**A:** No dedicated cold-start TTI measurement was run for this change. The Profile tab is a tab-bar page in the main package, so tab switches are effectively instant once the main package is loaded. First paint is covered by the skeleton (`showSkeleton`). Mini-program cold start is bounded by the 1.91 MB main-package download; on 5G this is sub-second, but we lack a trace.

**Q2:** Is the changed page behind `React.lazy()` if non-critical?  
**A:** Profile is a tab-bar page and must remain in the main package. The linked pages `terms`, `edit-profile`, `rewards`, and `invite` are non-tab pages but are currently in the main package without lazy-loading.

**Q3:** Are there blocking API calls in the component render path?  
**A:** No. Shell and referral stats are fetched via `useQuery`; the render path shows skeletons while loading.

**Q4:** Is there predictive prefetch for the next likely screen?  
**A:** Yes — after `hasShellData` becomes true and the device is online, `PrefetchEngine` stages `profile-events` and `profile-connections` to warm the Events and Connections tabs.

**Q5:** What’s the gzip bundle size of the changed page/subpackage?  
**A:** The whole main package is 1.91 MB. Per-page bundle deltas were not isolated by the tooling.

### Package Size

**Q1 (smoke-test):** What’s the gzip size impact of this change on the main package?  
**A:** Main package zip is 1.91 MB, which is 0.11 MB above the 1.80 MB guideline. The Profile redesign, new `terms` page, and icon-system changes all land in the main package.

**Q2:** Are new assets bundled locally or served from CDN? Any local asset > 20 KB?  
**A:** `ArchetypeHead` uses small bundled WebP head icons with CDN fallback. UI icons (`ui` tier) are bundled locally. `terms` is text-only. No single new large asset was introduced; the size pressure is from accumulated main-package code/SCSS.

**Q3:** Does the changed code land in the correct package?  
**A:** Profile must be main. `terms`, `edit-profile`, `rewards`, and `invite` are utility pages linked only from Profile; they **could** be moved to a subpackage to reduce main-package pressure.

**Q4:** Are there new dependencies?  
**A:** No new runtime dependencies. `JoyJoinIcon` is a local component and the icon map changes are data-only.

**Q5:** Is `lazyCodeLoading: 'requiredComponents'` active?  
**A:** Yes, `app.config.ts` has `lazyCodeLoading: 'requiredComponents'`.

---

## Ranked fix recommendations

| Rank | Fix | Impact | Effort | Expected size saving |
|---|---|---|---|---|
| 1 | **Move `terms`, `edit-profile`, `rewards`, `invite` to a new Profile-linked subpackage** (e.g. `pages/profile-extra`). | High — directly shrinks main package; these pages are only reached from Profile. | Medium | ~50–150 KB zip (depends on compiled output). |
| 2 | **Add a preload rule from `pages/profile/index` to the new Profile-extra subpackage** so navigation stays fast. | Medium — keeps speed after subpackaging. | Low | — |
| 3 | **Measure cold-start TTI with WeChat DevTools** and add a performance mark for Profile tab first paint. | Medium — closes the evidence gap flagged by grill-me. | Low | — |
| 4 | **Consider lazy-loading the social-card poster generator** (`profilePoster.ts` + `useProfileShareCard`) so the canvas drawing code is only downloaded when the user opens the share action sheet. | Low–Medium — code is already gated by feature flag, but static import still contributes to main bundle. | Low | ~10–30 KB zip. |
| 5 | **Audit `shared/assets` contributing 1.46 MB** for unused icons/illustrations that can be moved to CDN. | High if significant dead weight exists, but out of scope for this PR. | Medium–High | Potentially 100+ KB. |

---

## Sign-off

- [x] Automated evidence collected
- [x] Six dimensions scored with rubric rationale
- [x] Grill-me completed for all dimensions < 8
- [x] Gate verdict determined
- [x] WARN verdict includes documented trade-off and ranked fixes
