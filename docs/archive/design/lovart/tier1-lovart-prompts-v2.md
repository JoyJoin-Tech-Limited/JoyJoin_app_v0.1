# JoyJoin Tier 1 Icon System — Lovart Prompts (Consensus v2)

> Delivered by multi-agent deliberation. Scope: 13 icons across 3 grids.
> De-scoped: Chemistry badges, icebreaker phase emblems, achievement emoji (Phase 2).

---

## Design System References

| Token | Value | Usage |
|-------|-------|-------|
| Brand Primary | `#8B5CF6` (hsl(258, 90%, 65%)) | JoyJoin signature purple |
| Brand Primary Dark | `#7C3AED` (hsl(262, 83%, 58%)) | Pressed/active states |
| Neutral Dark | `#2D2D2D` | Facial features, outlines |
| Neutral Mid | `#333333` | Semantic icons |
| Warm Family | `#C79450` | Funny mood tint |
| Cool Family | `#C0A17B` | Emotional mood tint |
| Fire Family | `#877B93` | Relaxed mood tint |
| Calm Family | `#8E8E88` | Life mood tint |

**Style Lock (all icons):**
- Low-poly geometric aesthetic (same family as JoyJoin archetype animal illustrations)
- Solid fill only — no gradients, no outlines, no shadows, no blur
- Rounded, organic geometry — soft curves, simple polygons
- Transparent background PNG output
- Crisp at intended display size (not oversized and downscaled)

---

## PROMPT 1 — Rating Faces (5 icons) ⭐ PREMIUM CENTERPIECE

```
A horizontal artboard with 5 circular face icons arranged left-to-right, evenly spaced.
These are the emotional centerpiece of the JoyJoin app — the moment users rate their
experience. They must feel delightful, expressive, and unmistakably JoyJoin.

═══════════════════════════════════════════════════════════════════
COLOR TREATMENT — 2-TONE SYSTEM
═══════════════════════════════════════════════════════════════════

Each face uses TWO solid colors only:
- HEAD SHAPE: Brand Purple #8B5CF6 (hsl(258, 90%, 65%)) — the primary circle/head
- FACIAL FEATURES: Neutral Dark #2D2D2D — eyes, mouth, eyebrows, stars

No other colors. No gradients. The purple head against transparent background
with dark features creates a bold, instantly readable icon.

═══════════════════════════════════════════════════════════════════
STYLE LOCK
═══════════════════════════════════════════════════════════════════

- Low-poly geometric aesthetic (same style as JoyJoin archetype characters)
- Circular head shape for all 5 faces — slightly organic, not perfect geometric circle
- Simple geometric eyes: dots, short lines, or tilted ovals
- Mouth expressed as a simple curved line (upturned, downturned, or flat)
- Expressive eyebrows where needed (angled lines)
- Rounded, friendly proportions — approachable, not corporate
- Each face must be instantly readable emotion at 64x64px
- The faces should feel like they belong to the same character family

═══════════════════════════════════════════════════════════════════
CELL DESCRIPTIONS
═══════════════════════════════════════════════════════════════════

CELL 1 — "Disappointed" (replaces 😕):
Slightly downturned mouth. One raised eyebrow (short angled line) suggesting
mild confusion. Small dot eyes looking slightly sideways. Expression: "meh, not great"

CELL 2 — "Sad" (replaces 🙁):
Clear downturned frown mouth. Downturned curved-line eyes (like sad eyebrows
that are also eyes). Expression: "sad, disappointed"

CELL 3 — "Neutral" (replaces 😐):
Flat horizontal line mouth. Two small dot eyes, neutral forward gaze.
Expression: "okay, neutral, no strong feelings"

CELL 4 — "Happy" (replaces 🙂):
Gentle upturned smile curve. Soft relaxed dot eyes, maybe slightly curved up at
the corners. Expression: "good, content, pleased"

CELL 5 — "Ecstatic" (replaces 🤩):
Wide open grin with simple rectangular teeth gaps showing. Star-shaped excited
eyes (4-pointed stars, geometric). Expression: "amazing, thrilled, love it"

═══════════════════════════════════════════════════════════════════
LAYOUT
═══════════════════════════════════════════════════════════════════

- 5 cells in a single horizontal row
- Each cell: 240x240px artboard with the face centered at ~140x140px
- Ample whitespace around each face — don't crowd
- Light gray background (#F5F5F5) for the overall composition frame only
- Each face rendered on transparent background within its cell
- Title above: "Rating Faces — JoyJoin Expression System" in clean sans-serif
- Cell labels below each face: "1 · Disappointed", "2 · Sad", "3 · Neutral",
  "4 · Happy", "5 · Ecstatic" in 11px gray

═══════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════

1. Single preview grid image (showing all 5 faces in composition)
2. Individual PNG exports for each face at 3 sizes:
   - 64x64px (1×, for 64rpx display)
   - 128x128px (2×, for 64rpx @2x)
   - 192x192px (3×, for 64rpx @3x)
3. All PNGs: transparent background, solid fill only, no compression artifacts
4. File naming: rating-{1..5}-{emotion}.png (e.g. rating-1-disappointed.png)
```

---

## PROMPT 2 — Info Labels (4 icons)

```
A horizontal artboard with 4 minimal functional icons arranged left-to-right.
These are pure affordances — the smallest, most minimal icons in the system.
They communicate function instantly and then get out of the way.

═══════════════════════════════════════════════════════════════════
COLOR TREATMENT — NEUTRAL MONOCHROME
═══════════════════════════════════════════════════════════════════

All 4 icons use a SINGLE color:
- Neutral Mid #333333 — solid fill for all shapes

No tints. No gradients. No brand color. These icons are intentionally
invisible until needed, then crystal clear.

═══════════════════════════════════════════════════════════════════
STYLE LOCK — EXTRA MINIMAL
═══════════════════════════════════════════════════════════════════

- Low-poly geometric aesthetic (same family as JoyJoin archetype characters)
- Solid fill only — no gradients, no outlines, no shadows
- EXTRA simple geometry — fewer polygons than other icon sets
- Consistent visual weight/density across all 4
- Must be perfectly readable at 24x24px (the primary use size)
- Clean, functional, not decorative
- Slightly rounded corners on all rectangular elements

═══════════════════════════════════════════════════════════════════
CELL DESCRIPTIONS
═══════════════════════════════════════════════════════════════════

CELL 1 — "Calendar" (replaces 📅):
Simple calendar page — square with rounded corners, two small semicircle loops
or rings at the top (like a wall calendar hanger), and a 2x2 grid of 4 tiny
square dots inside representing days. Minimal, not detailed.

CELL 2 — "Location" (replaces 📍):
Map pin — classic teardrop/pin shape with rounded pointed bottom, small circle
in the center. Simple geometric, like a soft inverted drop. No map, no ground line.

CELL 3 — "People" (replaces 👥):
Two overlapping heads — two simple circular head silhouettes side by side,
slightly overlapping. The front one is fully visible, the back one peeks from
behind. No faces, no features — just clean silhouettes. Both circles same size.

CELL 4 — "Target" (replaces 🎯):
Concentric circles — three concentric circles (outer, middle, inner) with a
small dot at the very center. Like a dartboard target or bullseye. Even spacing
between rings. Clean geometric precision.

═══════════════════════════════════════════════════════════════════
LAYOUT
═══════════════════════════════════════════════════════════════════

- 4 cells in a single horizontal row
- Each cell: 160x160px with icon centered at ~72x72px
- Light gray background (#F5F5F5) for overall composition frame only
- Title above: "Info Labels — JoyJoin Functional Icons" in clean sans-serif
- Cell labels below: "Calendar", "Location", "People", "Target" in 11px gray

═══════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════

1. Single preview grid image
2. Individual PNG exports at 3 sizes:
   - 24x24px (1×, for 24rpx display)
   - 48x48px (2×, for 24rpx @2x)
   - 72x72px (3×, for 24rpx @3x)
3. All PNGs: transparent background, solid fill #333333 only
4. File naming: label-{name}.png (e.g. label-calendar.png)
```

---

## PROMPT 3 — Mood Icons (4 icons)

```
A horizontal artboard with 4 mood icons arranged left-to-right.
These appear in the icebreaker topic selection flow — users tap a mood
and the AI generates questions in that tone. Each mood gets a subtle
color identity from the JoyJoin archetype family system.

═══════════════════════════════════════════════════════════════════
COLOR TREATMENT — FAMILY TINTS
═══════════════════════════════════════════════════════════════════

Each mood icon uses a SINGLE tinted color (no gradients, no second color):

- FUNNY: Warm Family #C79450 (golden amber)
- LIFE: Calm Family #8E8E88 (soft sage gray)
- RELAXED: Fire Family #877B93 (muted violet-gray)
- EMOTIONAL: Cool Family #C0A17B (warm taupe)

The tint should feel intentional and cohesive — like each mood belongs to
a different archetype family. Not bright or neon — muted, sophisticated,
aligned with the JoyJoin color palette.

═══════════════════════════════════════════════════════════════════
STYLE LOCK
═══════════════════════════════════════════════════════════════════

- Low-poly geometric aesthetic (same family as JoyJoin archetype characters)
- Solid fill only — no gradients, no outlines, no shadows
- Abstract or simplified symbolic shapes — not literal illustrations
- Rounded, organic geometry with soft curves
- Must be readable at 32x32px
- Slightly more expressive than info labels, but still geometric and clean

═══════════════════════════════════════════════════════════════════
CELL DESCRIPTIONS
═══════════════════════════════════════════════════════════════════

CELL 1 — "Funny" (replaces 😂, tint: #C79450 warm):
Grinning face icon — circular head with wide upturned smile (curved line),
two tilted oval eyes (like laughing eyes, angled slightly inward).
Simple and expressive. The face should feel joyful and lighthearted.

CELL 2 — "Life" (replaces ☕, tint: #8E8E88 calm):
Coffee cup icon — simple mug shape (rounded rectangle with slightly wider
top) with a small C-shaped handle on the right side. Three small wavy lines
rising from the top as steam. Warm, everyday, comforting feel.

CELL 3 — "Relaxed" (replaces ✨, tint: #877B93 fire):
Soft glow icon — a central small circle with 6-8 short rounded rays
extending outward evenly, like a soft sunburst or sparkle. Not sharp —
the rays should have rounded ends. Gentle, calming energy.

CELL 4 — "Emotional" (replaces 💫, tint: #C0A17B cool):
Heart with ripple icon — a simple rounded heart shape with 2-3 small
concentric arc lines on the right side, like sound or emotion waves
radiating outward. The heart is solid; the arcs are simple curves.

═══════════════════════════════════════════════════════════════════
LAYOUT
═══════════════════════════════════════════════════════════════════

- 4 cells in a single horizontal row
- Each cell: 200x200px with icon centered at ~96x96px
- Light gray background (#F5F5F5) for overall composition frame only
- Title above: "Mood Icons — JoyJoin Icebreaker Atmosphere" in clean sans-serif
- Cell labels below: "Funny · Warm", "Life · Calm", "Relaxed · Fire",
  "Emotional · Cool" in 11px gray (showing the family association)

═══════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════

1. Single preview grid image
2. Individual PNG exports at 3 sizes:
   - 32x32px (1×, for 32rpx display)
   - 64x64px (2×, for 32rpx @2x)
   - 96x96px (3×, for 32rpx @3x)
3. All PNGs: transparent background, single tinted color per icon
4. File naming: mood-{name}.png (e.g. mood-funny.png)
```

---

## Asset Delivery Checklist

| Grid | Icons | Sizes | Total PNGs | Est. Size |
|------|-------|-------|-----------|-----------|
| Rating Faces | 5 | 64/128/192 | 15 | ~30KB |
| Info Labels | 4 | 24/48/72 | 12 | ~12KB |
| Mood Icons | 4 | 32/64/96 | 12 | ~18KB |
| **Total** | **13** | — | **39** | **~60KB** |

### Post-processing (after Lovart delivery):
1. Run all PNGs through ImageMagick optimization:
   ```bash
   magick input.png -strip -interlace Plane -quality 85 output.png
   ```
2. Verify each PNG renders crisply in WeChat DevTools at 1×/2×/3× density
3. Confirm transparent backgrounds (no white fringing)
4. Run `npm run check:clients` after integration

---

## De-scoped Items (Phase 2)

| Item | Reason | Future Trigger |
|------|--------|---------------|
| Chemistry badges (🔥✨🌱💬💫) | Overlap with archetype chemistry matrix; needs product design review | Matching status redesign |
| Icebreaker phase emblems (⚡🎲🎭🎪🧩) | Different asset class (hero illustrations, not icons); 80-120rpx display | Phase emblem illustration system |
| Achievement emoji | Server-driven; requires API contract change | Achievement system v2 |

---

*Prompts generated by multi-agent deliberation consensus.*
*Last updated: 2026-04-23*
