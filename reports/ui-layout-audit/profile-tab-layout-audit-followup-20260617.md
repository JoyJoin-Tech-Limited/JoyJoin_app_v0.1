# Follow-up UI Layout Audit — Profile tab & sub-screens

**Date:** 2026-06-17  
**Scope:** `apps/mini-program/src/pages/profile/index.tsx|.scss`, `edit-profile/index.scss`, `rewards/index.tsx|.scss`, `invite/index.tsx|.scss`, `terms/index.tsx|.scss`  
**Previous audit:** `reports/ui-layout-audit/profile-tab-layout-audit-20260617.md` (score 84/100)

---

## 1. Executive summary

The previous P1 emoji leaks are **fixed**: all JoyJoinIcon call sites in Rewards/Invite now pass `tier='ui'`, the corresponding `icon-ticket.webp`, `icon-trophy.webp`, and `icon-check.webp` assets are in the bundle, and the Invite status row no longer nests an icon inside `<Text>`. The overall score rises to **89/100**. Remaining work is low-risk polish: a `word-break: keep-all` overflow risk on Profile menu labels, a few dead SCSS rules, and some missing line-heights / icon-size mismatches in Rewards/Invite.

---

## 2. Previous blockers — verification

| # | Previous blocker | Status | Evidence |
|---|------------------|--------|----------|
| 1 | Invite reward tiers rendered native emoji (`invite/index.tsx:224`) | ✅ Fixed | `tier='ui'` added; `🎫`/`🎁`/`🏆` mapped to `icon-ticket`/`icon-coupon`/`icon-trophy` |
| 2 | Invite tier status rendered native ✅ inside `<Text>` (`invite/index.tsx:230`) | ✅ Fixed | Status wrapped in `<View className='invite-page__tier-status--unlocked'>`; `✅` mapped to `icon-check` with `tier='ui'` |
| 3 | Rewards hero rendered native 🎁 (`rewards/index.tsx:287`) | ✅ Fixed | `tier='ui'` added; class renamed `rewards-page__hero-icon` |

---

## 3. Scores

| Screen | New score | Δ | Notes |
|--------|-----------|---|-------|
| Profile tab | 88/100 | +2 | Emoji scan clean; menu-label `keep-all` and dead SCSS remain. |
| Edit Profile | 93/100 | +1 | Colors/radii/spacing now tokenized; only inherited `type-heading` tightness. |
| Rewards | 86/100 | +8 | Hero emoji fixed; hero-subtitle / invite-text line-height missing; icon size mismatch. |
| Invite | 84/100 | +12 | Emoji and link-break fixed; minor line-height / icon-size polish left. |
| Terms | 96/100 | +2 | Tag changed to `<View>`, colors tokenized, focus shadow tokenized. |
| **Overall** | **89/100** | **+5** | Safe to ship after P2 polish. |

---

## 4. Remaining findings — ranked fix list

### P2 — Layout / reading comfort

#### 1. Profile menu labels use `word-break: keep-all` without overflow containment
- **File:** `apps/mini-program/src/pages/profile/index.scss:676-685`
- **Issue:** `word-break: keep-all` prevents CJK characters from wrapping. The longest current label “分享我的社交名片” (≈224rpx at 32rpx base) still fits, but any longer label or narrower screen will overflow the flex row instead of wrapping, risking 孤字 or clipping.
- **Fix:** Since menu rows are single-line, replace `word-break: keep-all; overflow-wrap: normal;` with `@include text-truncate` (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`).
- **Effort:** ~10 min.

#### 2. Dead SCSS rules in Profile
- **Files:** `apps/mini-program/src/pages/profile/index.scss:471-480` (`&__stat-chevron`) and `:712-717` (`&__menu-chevron`)
- **Issue:** Both rules are unused. The stats use `.profile-page__chevron--stat` and the menu uses `.profile-page__chevron--menu` instead. Dead rules mislead future audits and bloat the sheet.
- **Fix:** Remove both blocks.
- **Effort:** ~5 min.

#### 3. Rewards body subtitles lack line-height
- **Files:** `apps/mini-program/src/pages/rewards/index.scss:39-43` (`&__hero-subtitle`) and `:369-374` (`&__invite-text`)
- **Issue:** Neither rule sets `line-height`. Default WXSS line-height can drop below 1.5, making two-line body copy feel tight and failing the ≥1.6 body-text guidance.
- **Fix:** Add `line-height: $line-height-relaxed;` (1.6) to both.
- **Effort:** ~5 min.

#### 4. Rewards / Invite icon size mismatch with CSS container
- **Rewards:** `apps/mini-program/src/pages/rewards/index.scss:27-32` declares `width: 96rpx; height: 96rpx`, but `JoyJoinIcon size={64}` writes an inline `64rpx` style that overrides the class.
- **Invite:** `apps/mini-program/src/pages/invite/index.scss:157-161` declares `48rpx × 48rpx`, but `JoyJoinIcon size={40}` renders the icon at `40rpx`.
- **Issue:** The container dimensions are misleading/dead and the rendered icon is smaller than the CSS suggests, which can cause subtle misalignment if someone later edits only the class.
- **Fix:** Align the two: either set the `size` prop to match the class (`96` / `48`) or remove `width/height` from the class and let `JoyJoinIcon` own the sizing.
- **Effort:** ~5 min.

#### 5. Profile milestone labels use `word-break: keep-all`
- **File:** `apps/mini-program/src/pages/profile/index.scss:532-538` (`&__milestone-label`) and `:553-561` (`&__milestone-sublabel`)
- **Issue:** `keep-all` prevents graceful wrapping. Today’s labels are short (4 chars), but a future longer label would overflow the ~160rpx flex card rather than wrap.
- **Fix:** Remove `word-break: keep-all`; rely on normal CJK wrapping. Add `text-align: center;` to keep the card visually tidy.
- **Effort:** ~10 min.

### P3 — Visual-coherence micro-fixes

#### 6. Rewards chips / status pills use non-token padding
- **Files:** `apps/mini-program/src/pages/rewards/index.scss:130` (`padding: 10rpx 20rpx`), `:177` (`padding: 8rpx 18rpx`), `:258` (`padding: 8rpx 18rpx`)
- **Issue:** 10rpx/18rpx/20rpx are not on the 8rpx spacing rhythm. The values are small enough to be accidental rather than intentional.
- **Fix:** Move to nearest tokens (e.g., `padding: $spacing-xs $spacing-sm;` for 8/16, or `padding: $spacing-xs $spacing-md;` for 8/24) and add a comment if a custom value is truly required.
- **Effort:** ~5 min.

#### 7. Invite hero subtitle and tier-reward lack line-height
- **Files:** `apps/mini-program/src/pages/invite/index.scss:46-50` (`&__hero-subtitle`), `:177-184` (`&__tier-reward`)
- **Issue:** No explicit `line-height` on body/meta text.
- **Fix:** Add `line-height: $line-height-normal;` (1.5) or `$line-height-relaxed` (1.6) for readability.
- **Effort:** ~5 min.

---

## 5. What still passes

- **Emoji scan:** No native emojis rendered in primary copy, headings, CTAs, or list rows. Only remaining emoji literals are icon keys routed through `JoyJoinIcon` and the ✨ in Xiaoyue mascot speech.
- **Touch targets:** All interactive rows/buttons remain ≥88rpx; primary buttons are 96rpx.
- **Safe areas:** Top/bottom safe-area insets and tab-bar reserves are wired.
- **Spacing rhythm:** Inter-section gaps are 24rpx/40rpx; card internal padding is 32–60rpx.
- **Viewport discipline:** Profile/Edit-Profile use bounded single-ScrollView shells; Terms documents its scroll exception.

---

## 6. Recommended order of work

1. Fix #1 (Profile menu label truncation) — highest-impact remaining layout risk.
2. Fix #2 (dead SCSS) and #4 (icon size mismatch) — quick cleanup.
3. Fix #3, #6, #7 (line-height / token padding) — reading comfort.
4. Fix #5 (milestone keep-all) — future-proofing.
5. Run `npm run guardrails` and a final WeChat DevTools spot-check on Profile, Rewards, Invite.
