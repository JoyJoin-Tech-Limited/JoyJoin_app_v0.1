# Stitch Brief: Edit Profile Page Redesign

> **Screen:** `apps/mini-program/src/pages/edit-profile/index.tsx`  
> **Priority:** P2 — Lower frequency but important  
> **Current Grade:** C (26/50)  
> **Goal:** B (33+)

---

## Current Problems

1. Form-only layout — no visual delight
2. No preview of how profile will look to others
3. Interest selection is dense and overwhelming
4. Save button is the only visual anchor
5. No emotional coaching or mascot presence (FIXED in quick wins — Xiaoyue added)

---

## Brand System (LOCK)

Same as 01-landing-page.md.

---

## Design Requirements

### Layout
- Scrollable form page
- Background: subtle warm gradient
- Sticky bottom save button

### Profile Preview Card (top)
- "预览资料" label
- Mini version of how others see the user:
  - Avatar + name + archetype badge
  - Top 3 interests as colored pills
  - City + age
- Updates live as user edits form

### Form Sections (as cards)
- **基本信息:** nickname, gender, birth year — inside a Card
- **职业身份:** education, industry — inside a Card
- **兴趣标签:** category tabs + chip grid
  - Selected chips: filled with archetype color
  - Unselected: outlined gray
  - Heat levels: tap once = selected, tap again = higher heat (color intensity increases)

### Xiaoyue Coaching (FIXED in quick wins)
- Already added: "随时更新你的资料，匹配会更精准哦。"

### Sticky Bottom
- "保存修改" — full-width, purple, rounded
- Disabled state when no changes made

---

## Technical Constraints

- HTML/CSS mockup, mobile-first (375px)
- WXSS-safe
- Form inputs must be large enough for touch (min 88rpx height)

---

## Stitch Prompt (Copy-Paste Ready)

```
Design a WeChat Mini Program "Edit Profile" page for JoyJoin (悦聚).

BRAND SYSTEM:
- Primary: #8B5CF6, Secondary: #FF9B85, Background: #F5F1E8
- Font: AlimamaFangYuanTiVF
- Style: 插画风 low-poly, friendly and approachable

DESIGN REQUIREMENTS:
- Top: Profile preview card showing how others see the user (avatar, name, archetype, top 3 interests, city, age)
- Form sections in cards:
  - "基本信息" (nickname, gender, birth year)
  - "职业身份" (education, industry)
  - "兴趣标签" with category tabs + chip grid
    - Selected: filled with color
    - Unselected: outlined gray
    - Heat levels shown by color intensity
- Xiaoyue coaching bubble: "随时更新你的资料，匹配会更精准哦。"
- Sticky bottom "保存修改" CTA
- Friendly studio feel — not a bureaucratic form

TECHNICAL: HTML/CSS mockup, mobile-first, WXSS-safe, touch-friendly inputs (min 88rpx).
```
