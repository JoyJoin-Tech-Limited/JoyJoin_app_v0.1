# Stitch Brief: LandingPage Redesign

> **Screen:** `apps/mini-program/src/pages/index/LandingPage.tsx`  
> **Priority:** P0 — First impression, highest visibility  
> **Current Grade:** C (30/50)  
> **Goal:** B+ (38+)

---

## Current Problems

1. Hero cards use generic photos (`match.webp`, `dinner.webp`, `continue.webp`) instead of 插画风 low-poly illustrations
2. Card border/background colors (`#E8A598`, `#C9A87C`, `#8FBFA3`) were ad-hoc (FIXED in quick wins — now use brand tokens)
3. Two CTAs compete for attention (primary + login)
4. No scroll — content crammed above fold on small screens
5. Xiaoyue mascot is small and bottom-aligned; lacks presence

---

## Brand System (LOCK — do not deviate)

| Token | Hex | Usage |
|-------|-----|-------|
| Vibrant Purple | `#8B5CF6` | Primary CTA, accents |
| Warm Coral | `#FF9B85` | Emotional peaks, highlights |
| Sky Blue | `#A8C5DD` | Calm states, info |
| Fresh Green | `#9ACD32` | Success, nature |
| Warm Beige | `#F5F1E8` | Page backgrounds |
| Soft White | `#FFFFFF` | Cards, clean space |
| Medium Gray | `#9CA3AF` | Borders, disabled |
| Dark Gray | `#374151` | Primary text |

- **Font:** AlimamaFangYuanTiVF (rounded, friendly Chinese display)
- **Mascot:** Xiaoyue (小悦), purple AI assistant character
- **Illustration style:** 插画风 low-poly, flat vector, vibrant colors
- **Spacing:** 8rpx base grid

---

## Design Requirements

### Layout
- Full-screen viewport, **no page scroll** (`100dvh` shell)
- Content centered vertically with `flex: 1` distribution
- Safe areas respected (`env(safe-area-inset-*)`)

### Hero Section (top 55%)
- **3 overlapping cards** in perspective arrangement:
  - Left card: "饭局" theme — rotated `-8deg`, smaller, behind
  - Center card: "酒局" theme — straight, largest, front
  - Right card: "户外活动" theme — rotated `+8deg`, smaller, behind
- Cards use **插画风 low-poly illustrations** (placeholder rectangles with gradient fills for now)
- Card colors: left = coral-tinted, center = purple-tinted, right = mint-tinted
- Subtle floating animation on cards (CSS `@keyframes`, `transform: translateY()`)

### Text Content (middle 25%)
- Headline: "让对的相遇不再错过" — 48rpx, `$font-brand`, `$color-text-primary`
- Subtitle: "AI 驱动的精选线下聚会，每一次都有新惊喜" — 28rpx, `$color-text-secondary`
- 3 value-prop badges in a row:
  - "🎯 智能匹配" · "🎉 惊喜氛围" · "🤝 真实连接"

### Bottom CTA Zone (bottom 20%)
- **Primary CTA:** "看看我会遇见谁" — full-width, 96rpx height, purple gradient (`$brand-gradient`), rounded 48rpx, shadow
- **Secondary link:** "已有账号？登录" — text-only, centered, `$color-text-secondary`
- **Legal checkbox:** "已阅读并同意《服务条款》和《隐私政策》" — small text with checkbox

### Mascot
- Xiaoyue peeking from **bottom-right corner** (not center)
- Size: 160rpx × 160rpx
- Expression: `coachGuide` (welcoming)
- Subtle bounce animation on load

---

## Technical Constraints

- **HTML/CSS mockup only** (Stitch output format)
- Mobile-first: 375px viewport
- WXSS-safe: no `backdrop-filter`, no CSS Grid (use Flexbox)
- TaroJS-compatible class naming (BEM-style)
- All animations use `transform` and `opacity` only
- `prefers-reduced-motion: reduce` respected

---

## Success Criteria

- [ ] Single clear primary action (no competing CTAs)
- [ ] All colors from brand palette (no ad-hoc hexes)
- [ ] Xiaoyue mascot prominently placed
- [ ] Cards feel premium and playful (not generic)
- [ ] Works at 320px–430px widths
- [ ] No page scroll (all content visible)

---

## Stitch Prompt (Copy-Paste Ready)

```
Design a WeChat Mini Program landing page for "JoyJoin" (悦聚), a social-matching app for urban Chinese youth (18-35).

BRAND SYSTEM (must follow exactly):
- Primary: Vibrant Purple #8B5CF6
- Secondary: Warm Coral #FF9B85
- Background: Warm Beige #F5F1E8
- Surface: Soft White #FFFFFF
- Text Primary: Dark Gray #374151
- Text Secondary: Medium Gray #9CA3AF
- Accent Mint: #9ACD32, Accent Sky: #A8C5DD
- Font: AlimamaFangYuanTiVF (rounded, friendly Chinese display font)
- Mascot: Xiaoyue (小悦), a cute purple AI assistant character
- Illustration style: 插画风 low-poly, flat vector, vibrant colors

DESIGN REQUIREMENTS:
- Full-screen viewport, no page scroll (100dvh)
- Top: 3 overlapping hero cards in perspective (饭局/酒局/户外), each with gradient placeholder representing 插画风 illustration
- Center: Large headline "让对的相遇不再错过" in brand font, subtitle, 3 value-prop badges
- Bottom: Large primary CTA "看看我会遇见谁" (purple gradient, rounded, shadow), secondary text link "已有账号？登录"
- Xiaoyue mascot peeking from bottom-right corner with bounce animation
- Warm, inviting, premium feel — like a high-end social app

TECHNICAL: HTML/CSS mockup, mobile-first (375px), WXSS-safe (no backdrop-filter, Flexbox only), all animations use transform/opacity, prefers-reduced-motion respected.
```
