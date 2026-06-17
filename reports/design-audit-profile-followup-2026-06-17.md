# Frontend Design Audit Follow-Up: Profile Tab & Sub-screens

**Target:** `apps/mini-program/src/pages/profile/` + sub-screens (`edit-profile`, `rewards`, `invite`, `terms`)  
**Auditor:** Frontend Design Audit agent  
**Date:** 2026-06-17  
**Previous score:** 18/20 (Excellent)

---

## Health Score: 19/20 (Excellent)

| Dimension | Score | Key Finding |
|-----------|-------|-------------|
| 1. Brand Fidelity & Anti-Patterns | 4/4 | Emoji heroes replaced with proprietary `JoyJoinIcon/ui` assets; Terms tag localized; no remaining AI tells. Rewards hero is a single icon — still on-brand but could be elevated to a Lovart hero for more emotional impact. |
| 2. State Completeness | 4/4 | Full state matrix intact across all screens. Profile share-card lazy-loads the poster generator, keeping the tab light until the feature is invoked. |
| 3. Theming & Token Discipline | 3/4 | Hard-coded colors in Rewards/Terms are now tokenized. Remaining micro-spacing deviations in badge/tag padding (10rpx, 18rpx, 20rpx) sit outside the 8rpx rhythm. |
| 4. Responsive & Platform Safety | 4/4 | Zero-scroll shells, `ScrollView` containers, safe-area insets, `rpx` units, and ≥ 88rpx touch targets remain consistent. |
| 5. Performance & Motion Hygiene | 4/4 | `transform`/`opacity` animations only, `prefers-reduced-motion` respected, dynamic `import()` for the share-card poster generator reduces initial tab cost. |

---

## P1 Issues from Previous Audit — Status

| # | Previous P1 | Status | Evidence |
|---|-------------|--------|----------|
| 1 | Replace Rewards emoji heroes/empty-states with proprietary assets | ✅ Resolved | `rewards/index.tsx:287` now uses `<JoyJoinIcon emoji='🎁' tier='ui' size={64} />`; empty states use Lovart heroes. |
| 2 | Tokenize Rewards coupon-status colors and Terms purple accents | ✅ Resolved | `rewards/index.scss:181-193` uses `$color-success`, `$color-text-muted`, `$color-warning`; `terms/index.scss:23`, `:51` uses `$color-primary`. |
| 3 | Tokenize Edit Profile ad-hoc radii/spacing | ✅ Resolved | Inputs/radio/chips now use `$radius-md`/`$card-radius-sm` and `$spacing-*`; primary focus ring standardized to 4rpx with a comment. |
| 4 | Localize Terms "JoyJoin Legal" tag | ✅ Resolved | `terms/index.tsx:31` now renders `<View className='terms-page__banner-tag'>法律说明</View>`. |

---

## Remaining Gaps & Polish Opportunities

### Token Discipline (minor)
- **Non-rhythm spacing in badges/tags**
  - `rewards/index.scss:130` — `padding: 10rpx 20rpx` (`&__chip`).
  - `rewards/index.scss:177`, `187`, `192`, `257` — `padding: 8rpx 18rpx` (`&__coupon-status`, `&__catalog-tag`).
  - `terms/index.scss:18` — `padding: 8rpx 18rpx` (`&__banner-tag`).
  - *Fix:* Round to token rhythm (`$spacing-xs` 8rpx + `$spacing-sm` 16rpx) or document as intentional optical padding.

- **Inconsistent error focus ring**
  - `edit-profile/index.scss:101` — `box-shadow: 0 0 0 3rpx rgba($color-error, 0.08);` while the primary focus ring at line 92 is 4rpx.
  - *Fix:* Align to 4rpx for consistency.

- **Skeleton radius**
  - `edit-profile/index.scss:384` — `border-radius: 16rpx` could be `$radius-md` (same value, tokenizes intent).

### Brand / Emotional Polish
- **Rewards hero could feel more premium**
  - `rewards/index.tsx:287` — a single 96rpx `JoyJoinIcon` is on-brand but reads as a utility header. A small Lovart hero (e.g., `lovart-rewards-hero`) would lift 仪式感/惊喜感.
  - *Fix:* Replace with a Lovart hero image or a Xiaoyue-coached header treatment.

### Performance / UX Polish
- **Rewards first-load still uses generic `LoadingScreen`**
  - `rewards/index.tsx:209-211` — returns `<LoadingScreen message='正在整理你的成长足迹…' />`.
  - *Fix:* Add a skeleton matching the hero/stats/card layout (similar to Edit Profile) for lower perceived wait.

### Dark Mode
- **Verify Terms focus shadow in dark mode**
  - `terms/index.scss:51` — now tokenized but still worth a DevTools pass to ensure the `rgba($color-primary, 0.18)` outline is visible on `$dark-color-surface`.

---

## Fix List

### P0 — Ship-blocking
*None.*

### P1 — Should fix before merge
*None from the original batch remain. The surface is merge-ready.*

### P2 — Polish
1. Tokenize remaining micro-spacing in Rewards chips/status badges and Terms banner tag.
2. Align Edit Profile error focus ring to 4rpx.
3. Replace `border-radius: 16rpx` in Edit Profile skeleton with `$radius-md`.
4. Consider a Lovart/Xiaoyue hero for the Rewards page header.
5. Add a Rewards skeleton loader to replace the generic `LoadingScreen`.
6. Verify Terms dark-mode visibility for the focus shadow.

---

## Verdict

**Approve for merge.** All previous P1 issues are resolved and no new ship-blocking issues were introduced. The Profile tab is now a cohesive, on-brand surface with strong emotional resonance (archetype identity, Xiaoyue coaching, milestone celebration, and proprietary iconography). Remaining items are P2 polish that can be picked up in a future quality pass without blocking release.
