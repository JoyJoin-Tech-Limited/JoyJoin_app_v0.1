# 完成度 Audit: Profile Tab + Sub-screens

**Target:** `apps/mini-program/src/pages/profile`, `edit-profile`, `rewards`, `invite`, `terms`
**Prerequisites:**
- UI Layout Audit: **84/100** (3 P1 blockers: native emoji leaks in JoyJoinIcon `ui` tier, text-wrapping polish)
- Frontend Design Audit: **18/20** Excellent, 情绪价值 **22/24**
- Performance Audit: **43/60 WARN** (subpackage placement, preload, lazy-load poster, TTI)
**Date:** 2026-06-17

---

## Dimension Scores

| # | Dimension | Score | Flags |
|---|---|---|---|
| 1 | Functional completeness | 4/4 | Happy paths work; double-tap guarded; network/offline handling, retry, content-violation recovery all present. |
| 2 | State completeness | 4/4 | Skeleton, empty (Lovart/Xiaoyue), error, success, disabled, busy states handled across tab + sub-screens. |
| 3 | Copy completeness | 3/4 | Warm Chinese copy throughout; English tag `JoyJoin Legal` in Terms banner not localized. |
| 4 | Interaction completeness | 4/4 | Press feedback, haptics, pull-to-refresh, form guard, save-busy state all present. |
| 5 | Delight completeness | 3/4 | Profile has archetype greeting, milestone ceremony, 100% completion seal; Rewards hero/empty still use native emoji / generic Lovart placeholders. |
| 6 | Flow completeness | 4/4 | Tab → sub-screen → action → result → back flows intentional; edit-profile unsaved-changes guard works. |
| 7 | Accessibility completeness | 4/4 | Touch targets ≥88rpx, reduced-motion media queries, safe-area insets, aria-labels on interactive rows. |
| 8 | Taro discipline | 2/4 | Profile deep-link pages still in main package; no preload rule; `profilePoster.ts` imported eagerly. |
| 9 | Visual finish | 2/4 | Native emoji leaks (🎁/🎫/🏆/✅), hard-coded coupon-status/Term purple colors, ad-hoc radii/spacing in Edit Profile. |
| 10 | Brand soul | 3/4 | Mostly unmistakably JoyJoin (Xiaoyue, archetype family, warm voice); P1 gaps around emoji heroes and unlocalized tag hold it back. |
| 11 | Operational completeness | 4/4 | `profileRedesignEnabled`/`personalityShareEnabled` feature-flagged; analytics tracked; blast radius scoped. |
| **Total** | | **37/44** | **Band: 坚稳 (29–38)** |

---

## Gap Register (ranked by ROI quadrant)

| # | Gap | Dim | Impact | Effort | Quadrant | Fix skill | Evidence / Recommendation |
|---|---|---|---|---|---|---|---|
| 1 | **Close JoyJoinIcon `ui` tier emoji leaks** — add `ui` mappings + bundled assets for 🎫/🏆/✅, and ensure Rewards hero 🎁 passes `tier='ui'` | #9 Visual finish | 5 | 2 | **Do first** | `ui-layout-audit` → `mini-program-frontend-excellence` | `rewards/index.tsx:287` `<JoyJoinIcon emoji='🎁' size={64} />` (no tier); `invite/index.tsx:224,230` tier-less 🎫/🏆/🎁/✅. Add entries to `packages/shared/src/iconSystem/emojiToIconMap.ts` `UI_ICON_MAP` and copy assets via `config/index.ts` `src/assets/icons/ui`. |
| 2 | **Lazy-load social-card poster generator** — `profilePoster.ts` is on the critical path of `profile/index.tsx` via `useProfileShareCard` | #8 Taro discipline | 4 | 2 | **Do first** | `performance-audit` → `mini-program-frontend-excellence` | `profile/index.tsx:42` imports `useProfileShareCard`, which eagerly imports `generateProfileSharePoster`. Use dynamic `import('./profilePoster')` inside the share-card tap handler. |
| 3 | **Tokenize hard-coded visual colors** — Rewards coupon-status chips and Terms purple accent use raw `rgba()` | #9 Visual finish / #10 Brand soul | 4 | 2 | **Do first** | `design-system-governance` | `rewards/index.scss:175-194` coupon status colors; `terms/index.scss:22-23,51` purple accent. Replace with `$color-success`/`$color-warning`/`$color-text-muted` and a `$color-primary-dark` token. |
| 4 | **Move profile sub-screens to a `pages/profile` subpackage + preload rule** | #8 Taro discipline | 5 | 4 | **Schedule** | `mini-program-frontend-excellence` | `onboardingRoutes.ts:95-117` lists `editProfile`, `rewards`, `invite`, `terms` in `MINI_PROGRAM_MAIN_PACKAGE_PAGES`. Create `pages/profile` subpackage, move the 4 folders, register in `MINI_PROGRAM_SUBPACKAGES`, and add a preload rule from `pages/profile/index`. |
| 5 | **Add TTI measurement budget for profile entry and subpage navigation** | #8 Taro discipline / #11 Operational | 3 | 3 | **Schedule** | `performance-benchmark` | No `performance.mark` or analytics event for profile cold-start / subpage first-paint. Instrument in `profile/index.tsx` and subpage `useDidShow`/`useEffect`; alert if TTI > target. |
| 6 | **Localize Terms banner tag** — `JoyJoin Legal` should be Chinese | #3 Copy / #10 Brand soul | 3 | 1 | **Low-hanging** | `xiaoyue-writing-craft` | `terms/index.tsx:31` `<Text className='terms-page__banner-tag'>JoyJoin Legal</Text>`. Change to `法律说明` or `悦聚法律中心`. |
| 7 | **Tokenize Edit Profile ad-hoc radii/spacing** | #9 Visual finish | 3 | 2 | **Low-hanging** | `design-system-governance` | `edit-profile/index.scss:81,110,136,171,209,344` uses literal `16rpx`, `20rpx`, `8rpx`, `10rpx`. Map to `$radius-md`, `$radius-lg`, `$spacing-xs`, `$spacing-sm`. |
| 8 | **Audit remaining profile-bound bundled assets for CDN migration** | #8 Taro discipline | 3 | 3 | **Low-hanging** | `performance-audit` | `config/index.ts` notes Lovart rewards/shop/history are CDN-only, but verify no oversized bundled images remain under `pages/profile` or referenced statically. |

---

## ROI Scatter Summary

```
           Impact ↑
           ┌──────────────────────────┐
  Do first │  G1 ui emoji leaks       │  Schedule
           │  G2 lazy poster          │  G4 subpackage + preload
           │  G3 tokenize colors      │  G5 TTI budget
           │  G6 localize tag         │
           ├──────────────────────────┤
Low-hanging│  G7 edit-profile tokens  │  Skip
           │  G8 asset CDN audit      │  —
           └──────────────────────────┘
                              Effort →
```

---

## Grill-Me Stress-Test (dimensions ≤ 2)

### Taro Discipline (Dim 8) — Score 2

**Q13: Is this page in the correct subpackage? Any code accidentally in the main package?**
- The tab root `pages/profile/index` belongs in the main package, but its deep-link sub-screens (`edit-profile`, `rewards`, `invite`, `terms`) are also in `MINI_PROGRAM_MAIN_PACKAGE_PAGES`. They are reachable by direct navigation and add JS/template/assets to the 2 MB main package. This violates the subpackage discipline used for onboarding (`pages/onboarding`), matching (`pages/matching-status`), and pool registration (`pages/pool-registration`).
- **Verdict:** Move the four sub-screens to a `pages/profile` subpackage and add a preload rule from the profile tab.

### Visual Finish (Dim 9) — Score 2

**Q: Show me every hard-coded value and emoji that breaks the token/typography system.**
- `rewards/index.tsx:287` renders a 64 rpx native 🎁 because no `tier='ui'` is passed and the global `EMOJI_TO_ICON_MAP` does not include `ui` tier entries.
- `invite/index.tsx:19-23,224,230` uses 🎫/🎁/🏆/✅ without `tier='ui'`; `UI_ICON_MAP` currently only covers ✏️/🎁/🔗/📤/👑/👣/📄/👥, missing 🎫/🏆/✅.
- `rewards/index.scss:175-194` hard-codes green/grey/orange `rgba()` for coupon status.
- `terms/index.scss:22-23,51` hard-codes purple `rgba(139, 92, 246, …)`.
- `edit-profile/index.scss` uses literal `16rpx`/`20rpx` radii and `8rpx`/`10rpx` padding.
- **Verdict:** Add missing `ui` icon mappings, pass `tier='ui'`, and replace hard-coded values with design tokens.

---

## Verdict

**Fix the Do-first gaps (G1–G3 + G6) and schedule the subpackage move (G4), then ship.**

The Profile tab is functionally complete, emotionally crafted, and operationally safe. It scores **37/44 (坚稳)**. However, the upstream UI Layout Audit P1 blockers (native emoji leaks) and the Performance Audit WARN (main-package bloat, eager poster import) are real ship risks. The good news: the highest-impact fixes are low-effort (icon mappings + tokenization + lazy-load). The subpackage migration is the only heavy item and can land in the next sprint without blocking the P1 polish pass.
