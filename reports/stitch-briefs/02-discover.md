# Stitch Brief: Discover Feed Redesign

> **Screen:** `apps/mini-program/src/pages/discover/index.tsx`  
> **Priority:** P0 — Most visited screen  
> **Current Grade:** C (29/50)  
> **Goal:** B (35+)

---

## Current Problems

1. Background gradient was ad-hoc (FIXED in quick wins — now uses brand token)
2. Pool cards are functional but generic — no visual punch (OracleCard redesign shipped 2026-05-13)
3. No Xiaoyue presence on the main discovery surface (Xiaoyue mascot added to hero)
4. ~~Filter chips are plain text buttons~~ → **FIXED 2026-05-15:** Replaced with `LocationFilterDrawer` (bottom-sheet district selector). See implementation in `apps/mini-program/src/components/discover/LocationFilterDrawer.tsx`.
5. Quick action row lacks visual hierarchy
6. VirtualList is good for performance but cards need redesign (OracleCard shipped)

---

## Brand System (LOCK)

Same as 01-landing-page.md.

---

## Design Requirements

### Layout
- Scrollable feed (not viewport-locked)
- Sticky header with greeting + filter chips
- Background: subtle warm gradient (`$color-bg-gradient`)

### Hero + Location Filter
- Greeting: "[Name]，今晚想怎么玩？" — 40rpx, `$font-brand`
- Xiaoyue mascot avatar (148rpx circle) beside greeting text
- **Location pill** (right-aligned in hero row):
  - Default: `📍 在 深圳 · 探索全部 ▼` — frosted glass surface, subtle border
  - Active (has saved filter): `📍 在 深圳 · {district} ▼` — brand gradient background, white text
  - Tap opens `LocationFilterDrawer` bottom sheet

### LocationFilterDrawer (bottom sheet)
- **Trigger:** Tap location pill in hero row
- **Surface:** White card, 32rpx top radius, max-height 70vh, spring open animation
- **All Regions tile:** Full-width gradient button (`🌐 全部区域`)
- **Cluster sections:** Grouped by district cluster (南山区 / 福田区)
- **District grid:** 3-column grid of rounded tiles (20rpx radius, 88rpx min-height)
  - Heat indicator: colored dot + label (热门 = pink, 活跃 = gold)
  - Active tile: `$color-primary-light` background + `$color-primary` border
- **Smart default:** Remembers last selection in local storage (30-day TTL). First visit defaults to "全部区域".
- **Accessibility:** `aria-role="button"`, `aria-label` on all interactive elements, reduced-motion support
- **Analytics:** Tracks `filter_open`, `filter_select`, `filter_close` events

### Quick Actions Row
- 2 cards side by side:
  - Left: "🤖 AI 配桌" — purple gradient, "让 AI 帮你挑最合适的局"
  - Right: "📅 我的活动" — coral gradient, "查看已报名和待参加"

### Event Pool Cards (vertical feed)
Each card:
- **Top band:** event type badge (饭局/酒局) + status dot (报名中/即将满员/已截止)
- **Hero area:** gradient placeholder (no image yet) with event title overlaid
- **Info row:** 📅 date · 📍 location (1 line) · 💰 price
- **Social proof:** "已有 X 人报名 / 共 Y 人" with mini avatar stack (3 overlapping circles)
- **Progress bar:** fill percentage with animation
- **CTA:** "立即报名" button (small, right-aligned)
- **Blind box seal:** For unmatched pools, show a sealed "盲盒" ribbon overlay

### Empty State
- Xiaoyue illustration + "今天没有新活动，明天再来看看~"
- "开启通知，新活动第一时间告诉你" button

### Bottom Tab Bar
- Custom tab bar (already implemented): 发现 / 活动 / + / 消息 / 我的

---

## Technical Constraints

- HTML/CSS mockup, mobile-first (375px)
- WXSS-safe (no backdrop-filter)
- Card height should be consistent for VirtualList compatibility
- All animations use transform/opacity

---

## Stitch Prompt (Copy-Paste Ready)

```
Design a WeChat Mini Program "Discover" feed for JoyJoin (悦聚), showing social event "pools" (盲盒活动) that users can join.

BRAND SYSTEM (must follow exactly):
- Primary: Vibrant Purple #8B5CF6
- Secondary: Warm Coral #FF9B85
- Background: Warm Beige #F5F1E8
- Surface: Soft White #FFFFFF
- Text: Dark Gray #374151 / Medium Gray #9CA3AF
- Accent: Mint #9ACD32, Sky #A8C5DD
- Font: AlimamaFangYuanTiVF
- Illustration: 插画风 low-poly flat vector

DESIGN REQUIREMENTS:
- Sticky top header with greeting "[Name]，今晚想怎么玩？"
- Horizontal scroll filter chips: "全部", "饭局", "酒局", "户外", "桌游" — active chip has purple background + white text + shadow
- Quick action row: 2 cards "🤖 AI 配桌" (purple) and "📅 我的活动" (coral)
- Event pool cards in vertical feed, each card:
  - Event type badge + status dot
  - Gradient hero area with title overlay
  - Date, location, price in one row
  - "X/Y 人已报名" with avatar stack
  - Progress bar
  - "立即报名" CTA
  - Blind box seal ribbon for unmatched pools
- Empty state with Xiaoyue illustration
- Warm, playful, premium — like a social marketplace

TECHNICAL: HTML/CSS mockup, mobile-first, WXSS-safe, consistent card heights.
```
