# Stitch Brief: Event Detail Page Redesign

> **Screen:** `apps/mini-program/src/pages/event-detail/index.tsx`  
> **Priority:** P1 — High intent page (users view before registering)  
> **Current Grade:** C (27/50)  
> **Goal:** B (33+)

---

## Current Problems

1. Background gradient was ad-hoc (FIXED in quick wins)
2. Info rows are plain label-value pairs with emoji prefixes — no visual hierarchy
3. No hero image or event atmosphere preview
4. No Xiaoyue mascot
5. Support QR card is the most visually interesting element (shouldn't be)
6. No sense of event "vibe" or atmosphere

---

## Brand System (LOCK)

Same as 01-landing-page.md.

---

## Design Requirements

### Layout
- Scrollable page (content may exceed viewport)
- Background: subtle warm gradient
- Fixed bottom CTA bar

### Hero Section
- **Full-bleed hero image/gradient** at top (300rpx height)
- Gradient overlay from bottom (black 30% → transparent)
- Event title overlaid on hero: 40rpx, white, bold
- Type badge: "饭局" or "酒局" — top-left, colored pill
- Status badge: "报名中" — top-right, animated pulse dot

### Info Cards
- **Atmosphere card:** "活动氛围" with 3 vibe tags (e.g., "轻松小酌", "深度交流", "美食探索") as colored pills
- **Details card:**
  - Date with calendar icon
  - Location with pin icon
  - Price with tag icon
  - Attendee count with people icon
  - Each row has icon + label + value, with subtle divider
- **Host card:** (if available) host name + archetype + brief intro
- **Description card:** event description with section header

### Xiaoyue Tip
- Chat bubble: "小悦提示：这场活动的氛围和你很搭哦~" with `coachGuide` expression
- Positioned between info cards

### Fixed Bottom CTA
- "立即报名 ¥XXX" — full-width, purple gradient, rounded, shadow
- If already registered: "已报名 · 查看匹配状态" — secondary style

---

## Technical Constraints

- HTML/CSS mockup, mobile-first (375px)
- WXSS-safe
- Fixed bottom bar must not overlap content (add padding-bottom)

---

## Stitch Prompt (Copy-Paste Ready)

```
Design a WeChat Mini Program event detail page for JoyJoin (悦聚).

BRAND SYSTEM:
- Primary: #8B5CF6, Secondary: #FF9B85, Background: #F5F1E8
- Font: AlimamaFangYuanTiVF, Text: #374151 / #9CA3AF
- Style: 插画风 low-poly flat vector, warm and inviting

DESIGN REQUIREMENTS:
- Hero section: 300rpx gradient area with event title overlaid, type badge (饭局/酒局), status badge with pulse dot
- Atmosphere card: "活动氛围" with 3 colored vibe tags (e.g., "轻松小酌", "深度交流")
- Details card: date (calendar icon), location (pin icon), price (tag icon), attendee count (people icon) — each row has icon + label + value
- Host card: host name + archetype badge + brief intro
- Description card: event description with section header
- Xiaoyue tip bubble: "小悦提示：这场活动的氛围和你很搭哦~"
- Fixed bottom CTA: "立即报名 ¥XXX" (large purple button)
- Premium, magazine-like layout — not a form

TECHNICAL: HTML/CSS mockup, mobile-first, WXSS-safe, fixed bottom bar with content padding.
```
