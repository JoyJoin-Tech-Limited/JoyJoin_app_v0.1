# Stitch Brief: Profile Page Redesign

> **Screen:** `apps/mini-program/src/pages/profile/index.tsx`  
> **Priority:** P1 — Frequently visited  
> **Current Grade:** C (30/50)  
> **Goal:** B (36+)

---

## Current Problems

1. Flat list of settings links — feels like a utility page, not an identity page
2. Archetype is shown as plain text, not celebrated
3. No visual summary of interests, connections, or activity
4. Logout button is visually prominent (should be de-emphasized)
5. Stats are plain numbers without context

---

## Brand System (LOCK)

Same as 01-landing-page.md.

---

## Design Requirements

### Layout
- Scrollable page
- Background: subtle warm gradient

### Hero Section
- **Archetype banner:** full-width card with archetype color as background gradient
  - Archetype mascot illustration (left, 120rpx)
  - Archetype name: "气氛组柯基" — 36rpx, bold, white
  - Trait tags: "气氛担当 · 乐观 · 热心" — small pills
  - "社交 passport" feel
- **Avatar + Name row:**
  - Circular avatar with gradient border (use brand gradient)
  - Display name: 40rpx, bold
  - Archetype glyph + name pill

### Stats Row
- 3 stat cards in a row:
  - "参加活动 5 场" with small trophy icon
  - "连接 12 人" with people icon
  - "获赞 28 次" with heart icon
- Each card has icon + number + label

### Menu Cards (not plain list)
- **我的活动:** preview next event date + title, arrow right
- **我的连接:** count badge, arrow right
- **奖励中心:** coupon count + coin balance, arrow right
- **编辑资料:** pencil icon, arrow right
- Each menu item is a card with icon, title, preview, and arrow

### Xiaoyue Greeting
- Chat bubble at top: "[Name]，你今天想探索什么？"
- Pose: `casual`, horizontal

### Logout
- Small text link at very bottom: "退出登录" — de-emphasized, gray, centered

---

## Technical Constraints

- HTML/CSS mockup, mobile-first (375px)
- WXSS-safe
- Menu cards should have tap feedback (`:active { opacity: 0.9 }`)

---

## Stitch Prompt (Copy-Paste Ready)

```
Design a WeChat Mini Program profile page for JoyJoin (悦聚).

BRAND SYSTEM:
- Primary: #8B5CF6, Secondary: #FF9B85, Background: #F5F1E8
- Font: AlimamaFangYuanTiVF, Archetype colors: 12 colors for 12 personality types
- Style: 插画风 low-poly, personal and celebratory

DESIGN REQUIREMENTS:
- Top: Archetype banner card with archetype color gradient background, mascot illustration, archetype name "气氛组柯基", trait tags as pills
- Avatar + name row: circular avatar with gradient border, display name, archetype glyph + name pill
- Stats row: 3 cards — "参加活动 5 场" (trophy), "连接 12 人" (people), "获赞 28 次" (heart)
- Menu cards (not plain list):
  - "我的活动" with next event preview
  - "我的连接" with count badge
  - "奖励中心" with coupon count
  - "编辑资料"
- Xiaoyue greeting: "[Name]，你今天想探索什么？"
- Bottom: small "退出登录" text link (de-emphasized)
- Personal, warm, identity-celebrating — like a social passport

TECHNICAL: HTML/CSS mockup, mobile-first, WXSS-safe, tap feedback on cards.
```
