# Frontend Design Audit: Profile Tab & Sub-screens

**Target:** `apps/mini-program/src/pages/profile/` + sub-screens (`edit-profile`, `rewards`, `invite`, `terms`)  
**Auditor:** Frontend Design Audit agent  
**Date:** 2026-06-17  
**Scope:** Changed files in the Profile redesign/fix batch (icons → JoyJoinIcon/ui tier, bounded scroll shell, ArchetypeHead CDN fallback, page-gradient-bg + type-mixin alignment).

---

## Health Score: 18/20 (Excellent)

| Dimension | Score | Key Finding |
|-----------|-------|-------------|
| 1. Brand Fidelity & Anti-Patterns | 3/4 | Profile hero is unmistakably JoyJoin (archetype head, Xiaoyue greeting, family names, milestone badges). Sub-screens slip into emoji-as-hero decoration in Rewards and raw-purple hard-codes in Terms. |
| 2. State Completeness | 4/4 | Full state matrix on every screen: skeleton/loading, empty, error, success, busy, disabled, pressed. Profile adds refresh-success, offline, logout-busy, and milestone celebration. |
| 3. Theming & Token Discipline | 3/4 | Profile uses CSS custom properties + dark-mode overrides. Rewards coupon-status badges and Terms focus shadow use hard-coded rgba values instead of semantic tokens. |
| 4. Responsive & Platform Safety | 4/4 | Zero-scroll shells, `ScrollView` containers, safe-area insets, `rpx` units, touch targets ≥ 88rpx. No horizontal overflow patterns. |
| 5. Performance & Motion Hygiene | 4/4 | Only `transform`/`opacity` animations, `prefers-reduced-motion` media queries, device-tier degradation class, stagger capped at ~300ms. |

---

## 情绪价值 Score: 22/24 (Emotion-Driven)

| Sub-dimension | Score | Evidence |
|---------------|-------|----------|
| 归属感 Belonging | 4 | Archetype family name (“小太阳家族”), tribe language, share-card CTA, “悦聚玩家们”. |
| 成就感 Achievement | 4 | Milestone badges, completion seal, progress bars, Xiaoyue celebration on unlock. |
| 身份认同 Identity | 4 | Archetype head avatar, personalized greeting, premium card surfaces. |
| 惊喜感 Delight | 3 | Rotating Xiaoyue greeting and stat-tap reactions; otherwise predictable layout. |
| 被理解感 Being Understood | 4 | Greeting adapts to archetype, completion %, city, first-visit state. |
| 仪式感 Ritual | 3 | Staggered entrance, milestone pop, completion ceremony; Terms/Rewards entrances are functional. |

---

## Anti-Patterns Found

### Brand / Visual
- **Emoji-as-hero decoration (身份认同 hit)**
  - `apps/mini-program/src/pages/rewards/index.scss:27-30` — `&__hero-emoji` renders a 96rpx native emoji as the page hero.
  - `apps/mini-program/src/pages/rewards/index.scss:389-392` — `&__empty-emoji` renders a 72rpx native emoji in empty states.
  - `apps/mini-program/src/pages/invite/index.tsx:224` — reward tier emojis (`🎫`, `🎁`, `🏆`) are passed to `JoyJoinIcon` but fall back to native emoji text in the reward ladder.
  - *Fix:* Map these moments to proprietary JoyJoin icons/illustrations (Lovart hero or `JoyJoinIcon` with a mapped ui/intent/achievement tier). Reserve native emoji for inline micro-copy only.

- **English legal tag feels corporate**
  - `apps/mini-program/src/pages/terms/index.tsx:31` — `JoyJoin Legal` tag is English in a Chinese legal page.
  - *Fix:* Use Chinese label, e.g. `法律说明` or `服务条款`.

### Token Drift
- **Hard-coded rgba status colors**
  - `apps/mini-program/src/pages/rewards/index.scss:181-193` — coupon status backgrounds use raw `rgba(46, 204, 113, …)`, `rgba(156, 163, 175, …)`, `rgba(240, 160, 48, …)`.
  - *Fix:* Use existing tokens: `rgba($color-success, 0.12)`, `rgba($color-text-muted, 0.18)`, `rgba($color-warning, 0.14)`.

- **Hard-coded brand purple in Terms**
  - `apps/mini-program/src/pages/terms/index.scss:23` — `background: rgba(139, 92, 246, 0.10)`.
  - `apps/mini-program/src/pages/terms/index.scss:51` — focus shadow uses `rgba(139, 92, 246, 0.18)` and `rgba(139, 92, 246, 0.08)`.
  - *Fix:* Replace with `rgba($color-primary, …)`.

- **Ad-hoc sizing in Edit Profile**
  - `apps/mini-program/src/pages/edit-profile/index.scss:81`, `110`, `171`, `209`, `257`, `130` — raw `16rpx`, `20rpx`, `10rpx`, `24rpx` radius/padding values instead of `$radius-md`, `$card-radius-sm`, `$spacing-*`.
  - `apps/mini-program/src/pages/edit-profile/index.scss:91`, `100` — 3rpx focus-ring spread (not a 4rpx hairline; document or round to 4rpx).
  - *Fix:* Swap to token equivalents; add a one-line comment if a true 4rpx optical tweak is intended.

### Minor Polish
- **Rewards loading is a full-screen spinner, not a skeleton**
  - `apps/mini-program/src/pages/rewards/index.tsx:209-211` — returns `<LoadingScreen>` on first load. The page is card-heavy, so a skeleton matching the card layout would feel more premium and reduce perceived wait.
  - *Fix:* Add a `rewards-page__skeleton` block matching the hero/stats/cards layout (similar to Edit Profile).

- **Terms page lacks reduced-motion handling**
  - No animations on Terms, so this is non-critical, but the page also lacks a dark-mode token pass beyond the root gradient. Cards will invert correctly because they use `$color-surface`, but verify the hard-coded purple focus shadow in dark mode.

---

## Fix List

### P0 — Ship-blocking
*None. The surface is shippable from a design-quality standpoint.*

### P1 — Should fix before merge
1. **Replace emoji heroes in Rewards** (`rewards/index.scss` hero + empty states) with proprietary Lovart heroes or mapped `JoyJoinIcon` assets.
2. **Tokenize Rewards coupon-status badge colors** (`rewards/index.scss:181-193`) and **Terms purple accents** (`terms/index.scss:23`, `:51`).
3. **Tokenize Edit Profile ad-hoc radii/spacing** and standardize the 3rpx focus ring to 4rpx or document the exception.
4. **Localize Terms banner tag** (`terms/index.tsx:31`) to Chinese.

### P2 — Polish
5. Add a Rewards first-load skeleton matching the card layout instead of a generic spinner.
6. Verify the Terms page in dark mode, especially the hard-coded purple focus shadow.
7. Consider a small entrance animation for Rewards/Stats to match the Profile tab’s staggered feel.

---

## Verdict

**Ship with P1 fixes.** The Profile tab is now unmistakably JoyJoin: warm, personal, and emotionally resonant. The remaining issues are token drift and a few emoji-as-hero moments in secondary screens — easy fixes that prevent the surface from feeling generic. Once P1 items are addressed, this passes the design audit and is safe to merge.
