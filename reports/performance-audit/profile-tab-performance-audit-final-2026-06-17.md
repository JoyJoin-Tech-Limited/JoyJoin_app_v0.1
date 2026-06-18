# Performance Audit — Profile Tab Redesign (Final)

**Surface:** JoyJoin WeChat Mini-Program Profile tab and linked sub-screens  
**Date:** 2026-06-17  
**Auditor:** Performance Audit agent  
**Scope:** Final audit after migrating `edit-profile`, `rewards`, `invite`, and `terms` to the `pages/profile-linked` subpackage and adding TTI instrumentation.

---

## Commands run

```bash
npm run build:weapp -w mini-program
npm run check:package-size -w mini-program
npm run test -w mini-program -- --run
node scripts/perf-audit-collect.mjs \
  --changed-files=apps/mini-program/src/pages/profile/index.tsx,apps/mini-program/src/pages/profile/index.scss,apps/mini-program/src/pages/profile/profilePoster.ts,apps/mini-program/src/pages/profile/useProfileShareCard.ts,apps/mini-program/src/components/mascot/ArchetypeHead.tsx,packages/shared/src/iconSystem/emojiToIconMap.ts,packages/shared/src/iconSystem/__tests__/iconTiers.test.ts,apps/mini-program/src/pages/profile-linked/edit-profile/index.scss,apps/mini-program/src/pages/profile-linked/rewards/index.scss,apps/mini-program/src/pages/profile-linked/invite/index.scss,apps/mini-program/src/pages/profile-linked/terms/index.tsx,apps/mini-program/src/pages/profile-linked/terms/index.scss,apps/mini-program/src/hooks/usePageTTI.ts
```

---

## Package-size results

| Metric | Before migration | After migration | Delta |
|---|---|---|---|
| Main package (zip) | 1.91 MB | **1.89 MB** | **−0.02 MB** |
| Main package (raw) | 3.17 MB | **3.10 MB** | **−0.07 MB** |
| Main pages (uncompressed) | 542.0 KiB | **469.6 KiB** | **−72.4 KiB** |
| Profile Linked subpackage (zip) | — | **23.2 KiB** | +23.2 KiB |
| Onboarding subpackage | 505.3 KiB | 505.3 KiB | 0 |
| Total (zip) | 2.53 MB | 2.54 MB | +0.01 MB |

**Status:** Main package is **under the 2.00 MB hard limit** but still **above the 1.80 MB project guideline**. The migration removed 72.4 KiB of page code/SCSS from the main package into a dedicated subpackage.

The relatively small absolute drop in main-package zip (1.91 → 1.89 MB) is because the bulk of the main package is the **core framework (1.18 MB)** and **shared assets (1.46 MB)**, neither of which were affected by page migration.

---

## Subpackage and preload verification

- `pages/profile-linked` is registered as a subpackage in `MINI_PROGRAM_SUBPACKAGES` with pages: `edit-profile/index`, `rewards/index`, `invite/index`, `terms/index`.
- `MINI_PROGRAM_PRELOAD_RULES` preloads `pages/profile-linked` from `pages/profile/index` on all network types.
- `MINI_PROGRAM_MAIN_PACKAGE_PAGES` no longer contains the migrated pages.

---

## TTI instrumentation verification

**Hook:** `apps/mini-program/src/hooks/usePageTTI.ts`

**Budgets**
- Cold start (within 3 s of app launch): ≤ 2000 ms
- Warm/preloaded start: ≤ 800 ms

**Test results**
```
npm run test -w mini-program -- --run hooks/usePageTTI.test.ts
```
- 6/6 tests passed.
- Verified: TTI is reported on mount, waits for `ready` flag when provided, reports cold vs warm budgets correctly, reports only once, supports `disabled`, and falls back to `wx.reportAnalytics`.

**Integration check**
- `terms`, `rewards`, `invite`, and `edit-profile` pages all call `usePageTTI({ pageName: ... })`.
- `terms` uses the default immediate-readiness path; others can gate on `ready` if data-dependent.

**Runtime verification note:** Automated tests confirm log emission and budget math. Real-device validation in WeChat DevTools is still recommended to ensure actual TTI stays under budget on representative Gen Z devices.

---

## Updated dimension scores

| Dimension | Previous | Current | Rationale |
|---|---|---|---|
| **流畅度 Smoothness** | 8 | **8** | No change. Animations remain `transform`/`opacity`, gated by reduced-motion and degradation. |
| **速度 Speed** | 7 | **7** | Subpackage + preload improve transition speed, but no runtime TTI trace was captured. Code is still in the main download. TTI instrumentation is in place and tests pass. |
| **设备适配 Device Adaptability** | 8 | **8** | No change. `useDeviceTier`, reduced-motion gating, and safe-area handling remain intact. |
| **内存安全 Memory Safety** | 8 | **8** | Poster generator is lazy-loaded; DPR is capped by caller and `exportCanvasWithRetry`. `usePageTTI` is non-blocking. |
| **网络韧性 Network Resilience** | 8 | **8** | No change. TanStack Query `offlineFirst`, retry, and pull-to-refresh behavior unchanged. |
| **包体积 Package Size** | 4 | **5** | Main package dropped to **1.89 MB** and subpackage migration is complete. Still above 1.80 MB guideline, but the architecture is now correct and under the 2.00 MB hard limit. |

**Composite score:** 44 / 60 (up from 43)

---

## Gate verdict

**WARN**

- Composite ≥ 36 (44).
- No dimension < 4.
- Main package remains 0.09 MB above the 1.80 MB guideline, so it does not yet qualify for a clean PASS under the strict package-size rubric.
- The structural risk has been meaningfully reduced: Profile-linked pages are now isolated, preloaded, and instrumented for TTI.

---

## Remaining recommendations (post-migration)

| Rank | Fix | Impact | Effort | Notes |
|---|---|---|---|---|
| 1 | **Move Tier 2 assets to CDN** (Lovart, promo, matching heroes, empty-state illustrations) to get main package under 1.80 MB. | High | Medium | `check-package-size` explicitly recommends this. Shared assets currently account for 1.46 MB of the main package. |
| 2 | **Run WeChat DevTools performance traces** on representative devices (Xiaomi 13/14, iPhone 15) to confirm Profile cold TTI ≤ 2000 ms and warm TTI ≤ 800 ms. | Medium | Low | Validates the new TTI budgets in production conditions. |
| 3 | **Defensively cap DPR inside `profilePoster.ts`** even though callers currently cap it. | Low | Low | Removes the only remaining automated warning for uncapped canvas DPR. |
| 4 | **Verify preload effectiveness** by throttling to 4G in WeChat DevTools and navigating Profile → Edit Profile; ensure subpackage is downloaded before tap. | Low | Low | Confirms the preload rule works in real runtime. |

---

## Sign-off

- [x] `npm run build:weapp` completed successfully
- [x] `npm run check:package-size` re-run
- [x] Six dimensions re-scored
- [x] TTI instrumentation verified via unit tests
- [x] Subpackage placement and preload rule verified in source
- [x] Updated verdict and recommendations produced
