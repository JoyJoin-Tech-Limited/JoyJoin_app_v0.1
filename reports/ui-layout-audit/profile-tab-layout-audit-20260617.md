# UI Layout Audit — Profile tab & sub-screens

**Date:** 2026-06-17  
**Scope:** `apps/mini-program/src/pages/profile/index.tsx|.scss`, `edit-profile/index.scss`, `rewards/index.tsx|.scss`, `invite/index.tsx|.scss`, `terms/index.tsx|.scss`  
**Auditor:** UI Layout Audit skill + `mini-program-frontend-excellence`, `joyjoin-brand-guidelines`, `viewport-zero-scroll`

---

## 1. Executive summary

The Profile tab is structurally sound: spacing follows the 8rpx rhythm, tap targets are ≥88rpx, safe-area insets are wired, and the scroll shell is bounded. The main regressions are **emoji leakage** in the Rewards hero and Invite reward-ladder rows, plus a handful of text-wrapping / dead-code polish items. Fixing the three P1 emoji issues will lift the overall score by ~10 points.

---

## 2. Scores

| Screen | Score | Notes |
|--------|-------|-------|
| Profile tab | 86/100 | Good hierarchy & spacing; menu/milestone labels risk overflow with `word-break: keep-all`; two dead SCSS blocks. |
| Edit Profile | 92/100 | Clean form spacing, 88rpx inputs, tokens respected; only minor inherited `type-heading` tightness. |
| Rewards | 78/100 | Native 🎁 emoji renders in the hero; a few body subtitles lack line-height; one dead emoji class. |
| Invite | 72/100 | Native emojis in reward tiers & status; `word-break: break-all` on the invite path mangles line breaks. |
| Terms | 94/100 | Readable legal cards; `<Text>` used as an inline-flex tag is the only real quirk. |
| **Overall** | **84/100** | Safe to ship after P1 emoji fixes; P2/P3 are polish. |

---

## 3. What passed

- **Spacing rhythm:** Sections use `$spacing-lg` (40rpx) or `$spacing-md` (24rpx); cards use `$spacing-lg` internal padding. No accidental <16rpx inter-section gaps.
- **Touch targets:** Menu rows `min-height: $cta-min-tap` (88rpx), buttons `min-height: max($button-height, $cta-min-tap)` (96rpx), edit-profile inputs/radios/chips all ≥88–96rpx.
- **Safe area:** `safe-area-top`, `safe-area-bottom-padding`, and tab-bar reserves are present.
- **Viewport discipline:** Profile/Edit-Profile use flex shells with a single bounded `ScrollView`; Terms documents its scroll exception.
- **Typography body:** Chinese body copy in Terms (`line-height: 1.8`), profile bio/greeting (`$line-height-relaxed` = 1.6) meet the ≥1.6 rule.
- **Primary copy:** Menu labels, CTAs, headings contain zero literal emojis (except the icon-key literals handled by `JoyJoinIcon`).

---

## 4. Findings — ranked fix list

### P1 — Emoji leakage in primary surfaces

#### 1. Invite reward tiers render native emoji icons
- **File:** `apps/mini-program/src/pages/invite/index.tsx:224`
- **SCSS:** `apps/mini-program/src/pages/invite/index.scss:157` (`font-size: $font-size-xl` / 40rpx)
- **Issue:** `JoyJoinIcon emoji={tier.emoji} size={40} …` is called **without `tier='ui'`**. The reward emojis `🎫`, `🎁`, `🏆` are not in the global flat `EMOJI_TO_ICON_MAP` (that map excludes `ui`), so `JoyJoinIcon` falls back to native `Text` rendering and a 40rpx emoji is displayed in each primary card row.
- **Fix:**
  1. Pass `tier='ui'` on the `JoyJoinIcon`.
  2. Add `🎫 → icon-ticket` and `🏆 → icon-trophy` mappings to `UI_ICON_MAP` in `packages/shared/src/iconSystem/emojiToIconMap.ts:186` and ship the corresponding `.webp` assets to `apps/mini-program/src/assets/icons/ui/`.
  3. `🎁` is already mapped to `icon-coupon`; it only needs `tier='ui'`.
- **Effort:** ~45 min (assets + mapping + prop).

#### 2. Invite tier status renders a native ✅ emoji and nests an icon inside `<Text>`
- **File:** `apps/mini-program/src/pages/invite/index.tsx:230`
- **Issue:**
  - `JoyJoinIcon emoji='✅' size={20} />` has no `tier` prop; `✅` is not mapped, so it renders as a native 20rpx emoji next to “已达成”.
  - The icon is placed as a child of `<Text>`, which is invalid in WeChat `<text>` (it can only contain text nodes / nested `<text>`). If the mapping were fixed and an `<image>` rendered, it would likely disappear or break layout.
- **Fix:** Replace the inline `JoyJoinIcon` with a CSS checkmark pseudo-element, or wrap the whole status in a `<View className='invite-page__tier-status-row'>` and render a 20rpx check icon there. If using an icon asset, add `✅ → icon-check` to `UI_ICON_MAP` and pass `tier='ui'`.
- **Effort:** ~20 min.

#### 3. Rewards hero renders a native 🎁 emoji
- **File:** `apps/mini-program/src/pages/rewards/index.tsx:287`
- **SCSS:** `apps/mini-program/src/pages/rewards/index.scss:27-31` (`font-size: 96rpx`, `margin-bottom: 24rpx`)
- **Issue:** `JoyJoinIcon emoji='🎁' size={64} …` is missing `tier='ui'`, so the 64rpx fallback emoji is drawn above the page title.
- **Fix:** Add `tier='ui'` to the `JoyJoinIcon`. The class name `rewards-page__hero-emoji` should also be renamed `rewards-page__hero-icon` to match the icon system.
- **Effort:** ~5 min.

---

### P2 — Text wrapping / reading comfort / 孤字 risk

#### 4. Invite link value breaks words mid-character
- **File:** `apps/mini-program/src/pages/invite/index.scss:118`
- **Issue:** `word-break: break-all;` on the invitation path (`/pages/pool-registration/index?invitationCode=…`) allows breaks inside `index`, `invitationCode`, etc., producing ragged, hard-to-read lines.
- **Fix:** Use `word-break: normal; overflow-wrap: break-word;` (or `overflow-wrap: anywhere` only if the path is a single long token). This keeps readable word boundaries.
- **Effort:** ~5 min.

#### 5. Profile menu labels use `word-break: keep-all` without overflow containment
- **File:** `apps/mini-program/src/pages/profile/index.scss:676-685`
- **Issue:** `word-break: keep-all` prevents CJK characters from wrapping. The longest current label “分享我的社交名片” (7 chars ≈ 224rpx at 32rpx base) still fits, but any longer label or narrower screen will overflow the flex row instead of wrapping, producing 孤字 or clipping.
- **Fix:** Since menu rows are intended to be single-line, add `@include text-truncate` (`overflow: hidden; white-space: nowrap; text-overflow: ellipsis`) and remove `word-break: keep-all`. If multi-line is desired, remove `keep-all` and rely on normal CJK wrapping.
- **Effort:** ~10 min.

#### 6. Rewards invite-card body text lacks line-height
- **File:** `apps/mini-program/src/pages/rewards/index.scss:368-373`
- **Issue:** `&__invite-text` (font-size `$font-size-sm` = 24rpx) has no explicit line-height. Default WXSS line-height can drop below 1.5, making the two-line body feel tight.
- **Fix:** Add `line-height: $line-height-relaxed;` (1.6).
- **Effort:** ~2 min.

#### 7. Rewards hero subtitle lacks line-height
- **File:** `apps/mini-program/src/pages/rewards/index.scss:38-42`
- **Issue:** `&__hero-subtitle` (font-size `$font-size-base` = 28rpx) has no line-height. On a 2-line subtitle this falls below the ≥1.6 body rule.
- **Fix:** Add `line-height: $line-height-relaxed;` (1.6) or at least `1.5`.
- **Effort:** ~2 min.

---

### P3 — Visual coherence / dead code

#### 8. Dead SCSS rules
- **Profile menu-chevron:** `apps/mini-program/src/pages/profile/index.scss:712-717` defines `&__menu-chevron`, but the row uses `.profile-page__chevron--menu` instead. Remove.
- **Rewards empty-emoji:** `apps/mini-program/src/pages/rewards/index.scss:389-393` defines `&__empty-emoji`, but empty states use `<Image>` heroes. Remove.
- **Effort:** ~5 min.

#### 9. Terms banner tag uses `<Text>` as an inline-flex element
- **File:** `apps/mini-program/src/pages/terms/index.tsx:31`, `apps/mini-program/src/pages/terms/index.scss:15-24`
- **Issue:** `display: inline-flex;` is applied to a `<Text>` node. WeChat `<text>` does not reliably honor flex layout; the tag’s padding/margin and vertical alignment may behave inconsistently across devices.
- **Fix:** Change the JSX element from `<Text>` to `<View>` and keep `display: inline-flex` (or switch to `inline-block`).
- **Effort:** ~10 min.

#### 10. Terms focus shadow hardcodes brand purple
- **File:** `apps/mini-program/src/pages/terms/index.scss:51`
- **Issue:** `box-shadow: 0 0 0 2rpx rgba(139, 92, 246, 0.18) …` duplicates the primary hex. Use `rgba($color-primary, 0.18)`.
- **Effort:** ~2 min.

---

## 5. Recommended order of work

1. Fix P1 emoji leaks (Invite tiers/status, Rewards hero) — biggest visual/brand impact.
2. Fix P2 text wrapping/line-height issues — reading comfort.
3. Clean P3 dead code / minor coherence items.
4. Re-run `npm run guardrails` and a quick WeChat DevTools pass on Profile, Rewards, Invite, Terms.
