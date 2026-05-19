# Lovart Brief: JoyJoin Blind Box Reveal Asset — Option C (Layered Hybrid)

**Date:** 2026-05-18  
**Asset type:** Mascot illustration / UI element — **layered transparent assets**  
**Target platform:** WeChat Mini Program (Taro)  
**Usage context:** Squad unboxing page — the "blind box" visual that users tap to reveal their matched group

---

## Scene & Context

The user has been matched into a group for a social event (饭局 or 酒局). Before revealing who their tablemates are, they see a "blind box" — a mysterious gift box that represents the surprise of discovering their group. The box should feel:
- **Joyful and anticipatory** — this is a moment of happy surprise
- **Premium** — not a cheap game loot box; this is a curated social experience
- **On-brand** — unmistakably JoyJoin, not generic

We use a **layered hybrid architecture**: Lovart delivers illustrated transparent layers, and CSS drives the animation (floating, lid lift, glow, sparks). This gives us the richness of illustration with the smoothness of procedural motion.

---

## Architecture

```
Container (360×292rpx, CSS-animated float)
├── Aura — CSS procedural glow (kept)
├── Body Image — Lovart illustrated box body (static layer)
├── Interior Image — Lovart illustrated inner glow (fades in when opening)
├── Sparks — CSS procedural particles (kept)
├── Lid Image — Lovart illustrated lid (CSS-animated lift + rotate)
└── Shadow — CSS procedural ground shadow (kept)
```

**Why layered?** The lid lifts, tilts, and floats above the body during the reveal. If baked into a single image, we lose that physical motion. Separating lid from body lets us animate them independently with CSS transforms.

---

## Composition (per layer)

All layers share the same **600×600px canvas** with the box centered. Elements must align perfectly when overlaid.

| Layer | Subject | Position in 600×600 canvas |
|-------|---------|---------------------------|
| Body | Closed box body, front-facing | Centered, ~lower half |
| Lid | Lid with ribbon, matching body width | Centered, sitting flush on body top edge |
| Interior | Warm glow emanating from inside | Centered, filling the body cavity |

**Background:** Transparent PNG for all layers (for overlay on gradient backgrounds).

---

## Color System (exact hex codes)

| Token | Hex | Usage |
|-------|-----|-------|
| Vibrant Purple | `#8B5CF6` | Primary ribbon, accents, box edge highlights |
| Warm Coral | `#FF9B85` | Warm glow from inside the box, spark particles |
| Warm Beige | `#F5F1E8` | Box body base color, paper texture |
| Soft White | `#FFFFFF` | Ribbon sheen, highlight reflections |
| Sky Blue | `#A8C5DD` | Subtle secondary accent on box edges |

**Prompt instruction:** Use Vibrant Purple #8B5CF6 for the ribbon and primary accents, Warm Coral #FF9B85 for the warm inner glow, Warm Beige #F5F1E8 for the box body.

---

## Style Lock (画风统一) — MANDATORY

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed feel within each polygonal facet — NOT flat vector or 3D render
- **Outlines:** Minimal or none — let facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** Transparent PNG (no background)
- **Characters/Objects:** Geometric polygonal construction, simplified features, warm expressions
- **Composition:** Centered subject, generous negative space
- **Color treatment:** Natural warm palette; brand purple #8B5CF6 for key elements only

---

## Anti-Generic Test

Before approving, ask: *"Could this exact illustration appear in a generic dating app or mobile game loot box without modification?"* If yes → iterate. The box must feel uniquely JoyJoin — warm, social, premium, not gambling-adjacent.

---

## Technical Specs

| Property | Value |
|----------|-------|
| Format | WebP (primary), PNG fallback |
| Canvas per layer | 600×600px |
| Transparency | Yes — all layers transparent PNG |
| DPR targets | 2× (600×600), 3× (900×900) |
| Max file size | 80KB per layer per resolution |
| Naming | `lovart-blind-box-{layer}-20260518.webp` where `{layer}` = `body`, `lid`, `interior` |

---

## Layers Needed

### Layer 1: Body
The closed box body — what you see when looking at the box from the front. Includes the box walls, bottom, and the ribbon wrapping around the body. The top opening should be visible (where the lid sits).

- No lid — the lid is a separate layer
- The top edge should be clean where the lid will overlay
- Warm beige body with purple ribbon accents

### Layer 2: Lid
The box lid, separate and self-contained. Should include the full lid surface, ribbon knot/bow on top, and the ribbon edges that drape over the sides. When placed over the body layer, it should look like a closed gift box.

- Must align with the body's top opening when both are centered in their 600×600 canvas
- Slightly wider than the body (overhangs like a real box lid)

### Layer 3: Interior
The glowing interior of the box — what you see when the lid lifts off. Soft warm light emanating upward, with subtle sparkles or light rays. This fades in beneath the lid during the opening animation.

- Fills the body cavity area
- Warm coral glow with soft gradients
- Should feel inviting and full of pleasant surprises

---

## Animation Reference (for alignment)

The CSS animation drives the motion. Your layers must work with these transforms:

| Animation | Target layer | Motion |
|-----------|-------------|--------|
| `squad-unboxing-float` | Container | Entire box floats up/down 10rpx, 3.2s loop |
| `squad-unboxing-lid-lift` | Lid image | Lid lifts 80rpx up, rotates -8deg, 0.92s loop |
| `squad-unboxing-box-bounce` | Body image | Body scales 1.02x and drops 6rpx, 0.92s loop |
| `squad-unboxing-aura` | CSS aura | Glow pulses opacity 0.26→0.52, scale 0.94→1.05 |
| `squad-unboxing-spark` | CSS particles | 3 sparks float up and fade |

**Important:** The lid and body images must be sized and positioned so that when the lid is at rest (no transform), it sits perfectly on the body. The CSS will handle the lift motion.

---

## Deliverables

1. **Body layer** — `lovart-blind-box-body-20260518.webp`
2. **Lid layer** — `lovart-blind-box-lid-20260518.webp`
3. **Interior layer** — `lovart-blind-box-interior-20260518.webp`

Each in 2× (600×600) and 3× (900×900) resolutions.

---

## Downstream Handoff

After asset approval:
- Place in `apps/mini-program/src/assets/illustrations/`
- `BlindBoxVisual.tsx` already wired — layers are referenced via `blindBoxAssets.ts`
- CSS animations already configured — verify lid/body alignment in WeChat DevTools
- Run `npm run build:weapp` and visually QA all 3 states

---

## Related Skills
- `mini-program-frontend-excellence` — pixel discipline, Taro-native Image component
- `design-system-governance` — token alignment, asset size budgets
