# Stitch Brief: Connections Page Redesign

> **Screen:** `apps/mini-program/src/pages/connections/index.tsx`  
> **Priority:** P1 — Social core  
> **Current Grade:** C (28/50)  
> **Goal:** B (34+)

---

## Current Problems

1. Avatars are text initials on colored circles — no archetype visuals (PARTIALLY FIXED in quick wins — now uses archetype colors)
2. Cards are plain with minimal info
3. No grouping by event
4. No chemistry score or compatibility indicator
5. Action is limited to "copy WeChat ID"

---

## Brand System (LOCK)

Same as 01-landing-page.md.

---

## Design Requirements

### Layout
- Scrollable list
- Background: subtle warm gradient

### Header
- Title: "我的连接" — 48rpx, bold
- Subtitle: "活动后建立的联系" — 28rpx, gray
- Connection count badge

### Connection Cards
- **Archetype avatar:** 80rpx circle with archetype color background, white initial
- **Name row:** display name + archetype badge (colored pill with archetype name)
- **Event tag:** "来自：周五南山饭局" — small, muted
- **Chemistry score:** "默契度 85%" — progress ring or bar, coral color
- **Actions:** "复制微信号" button (small, secondary)
- Card has subtle left border in archetype color

### Grouping
- Group connections by event with sticky section headers
- Section header: event date + event type icon + event title

### Empty State
- Xiaoyue illustration (center, 240rpx)
- "参加活动后，这里会出现你的新朋友"
- CTA: "去发现活动" → navigate to discover

---

## Technical Constraints

- HTML/CSS mockup, mobile-first (375px)
- WXSS-safe
- Sticky headers must use `position: sticky` (supported in WXSS)

---

## Stitch Prompt (Copy-Paste Ready)

```
Design a WeChat Mini Program "Connections" page for JoyJoin (悦聚), showing people the user met at events.

BRAND SYSTEM:
- Primary: #8B5CF6, Background: #F5F1E8, Surface: #FFFFFF
- Font: AlimamaFangYuanTiVF
- Style: 插画风 low-poly, social and warm

DESIGN REQUIREMENTS:
- Header: "我的连接" with subtitle "活动后建立的联系" + connection count badge
- Connections grouped by event with sticky section headers (date + type icon + title)
- Connection cards:
  - Archetype avatar: 80rpx circle with archetype color background, white initial
  - Name + archetype badge as colored pill
  - "来自：周五南山饭局" event tag
  - "默契度 85%" chemistry score with mini progress ring
  - "复制微信号" action button
  - Subtle left border in archetype color
- Empty state: Xiaoyue illustration + "参加活动后，这里会出现你的新朋友" + CTA
- Premium social network feel — not a contacts list

TECHNICAL: HTML/CSS mockup, mobile-first, WXSS-safe, sticky section headers.
```
