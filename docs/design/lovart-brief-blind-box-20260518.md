# Lovart Brief: JoyJoin Blind Box Reveal Asset

**Date:** 2026-05-18  
**Asset type:** Mascot illustration / UI element  
**Target platform:** WeChat Mini Program (Taro)  
**Usage context:** Squad unboxing page — the "blind box" visual that users tap to reveal their matched group

---

## Scene & Context

The user has been matched into a group for a social event (饭局 or 酒局). Before revealing who their tablemates are, they see a "blind box" — a mysterious gift box that represents the surprise of discovering their group. The box should feel:
- **Joyful and anticipatory** — this is a moment of happy surprise
- **Premium** — not a cheap game loot box; this is a curated social experience
- **On-brand** — unmistakably JoyJoin, not generic

The box is shown in three states:
1. **Ready** — closed, gently floating/pulsing, inviting the user to tap
2. **Opening** — lid lifts, warm glow emanates from inside, sparks
3. **Open** — lid fully open, revealing warm light from within, ready to show the member cards below

## Composition

- **Subject:** A stylized gift box with ribbon, centered in frame
- **Pose:** Front-facing, symmetrical, lid slightly ajar in opening state
- **Expression:** The box itself doesn't have a face, but the overall feeling should be "inviting" and "full of pleasant surprises"
- **Background:** Transparent PNG (for overlay on gradient backgrounds) OR atmospheric warm wash
- **Framing:** Centered subject with generous negative space on all sides

## Color System (exact hex codes)

| Token | Hex | Usage |
|-------|-----|-------|
| Vibrant Purple | `#8B5CF6` | Primary ribbon, accents, box edge highlights |
| Warm Coral | `#FF9B85` | Warm glow from inside the box, spark particles |
| Warm Beige | `#F5F1E8` | Box body base color, paper texture |
| Soft White | `#FFFFFF` | Ribbon sheen, highlight reflections |
| Sky Blue | `#A8C5DD` | Subtle secondary accent on box edges |

**Prompt instruction:** Use Vibrant Purple #8B5CF6 for the ribbon and primary accents, Warm Coral #FF9B85 for the warm inner glow, Warm Beige #F5F1E8 for the box body.

## Style Lock (画风统一) — MANDATORY

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed feel within each polygonal facet — NOT flat vector or 3D render
- **Outlines:** Minimal or none — let facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** Transparent PNG (no background) OR atmospheric textured wash with subtle grain/noise
- **Characters/Objects:** Geometric polygonal construction, simplified features, warm expressions
- **Composition:** Centered subject, generous negative space
- **Color treatment:** Natural warm palette; brand purple #8B5CF6 for key elements only

## Anti-Generic Test

Before approving, ask: *"Could this exact illustration appear in a generic dating app or mobile game loot box without modification?"* If yes → iterate. The box must feel uniquely JoyJoin — warm, social, premium, not gambling-adjacent.

## Technical Specs

| Property | Value |
|----------|-------|
| Format | WebP (primary), PNG fallback |
| Dimensions | 600×600px (square, for scaling to ~360rpx display) |
| Transparency | Yes — transparent background for overlay on page gradients |
| DPR targets | 1×, 2×, 3× (ship 2× and 3×, let 1× fall back to 2×) |
| Max file size | 80KB per resolution |
| Naming | `lovart-blind-box-{state}-20260518.webp` where `{state}` = `ready`, `opening`, `open` |

## States Needed

### State 1: Ready (closed)
Closed gift box, ribbon tied neatly, gentle floating feel. Soft aura/glow around it. Inviting.

### State 2: Opening (lid lifting)
Lid is lifting off, rotating slightly, warm light spilling from the gap. Sparks/particles floating up. Energy building.

### State 3: Open (lid off)
Lid fully removed and floating above, bright warm light emanating from inside the box. The interior is a soft glowing void — the "reveal" is about to happen.

## Deliverables

1. **Ready state** — `lovart-blind-box-ready-20260518.webp`
2. **Opening state** — `lovart-blind-box-opening-20260518.webp`
3. **Open state** — `lovart-blind-box-open-20260518.webp`

Each in 2× (600×600) and 3× (900×900) resolutions.

## Downstream Handoff

After asset approval:
- Place in `apps/mini-program/src/assets/illustrations/`
- Update `BlindBoxVisual.tsx` to use `<Image>` with state-based src switching
- Remove CSS-drawn blind box elements from `squad-unboxing/index.scss`
- Run `npm run optimize:xiaoyue` equivalent for illustration assets

## Related Skills
- `mini-program-frontend-excellence` — pixel discipline, Taro-native Image component
- `design-system-governance` — token alignment, asset size budgets
