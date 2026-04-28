# JoyJoin Phase 2 Icon System — Lovart Prompts

> Phase 2 scope: Chemistry badges + Phase emblems + Status icons
> De-scoped to Phase 3: Achievement emoji (requires server contract change)

---

## Design System References

| Token | Value | Usage |
|-------|-------|-------|
| Brand Primary | `#8B5CF6` | Crown tint |
| Warm Family | `#C79450` | Fire chemistry, Warmup phase accent |
| Cool Family | `#C0A17B` | Chat chemistry, Theater phase accent |
| Fire Family | `#877B93` | Challenge phase accent |
| Calm Family | `#8E8E88` | Sprout chemistry, Dice phase accent |

**Style Lock (all icons):**
- Low-poly geometric aesthetic (same family as JoyJoin archetype animal illustrations)
- Solid fill only — no gradients, no outlines, no shadows
- Rounded, organic geometry — soft curves, simple polygons
- Transparent background PNG output

---

## PROMPT 1 — Chemistry Badges (4 icons)

```
A horizontal artboard with 4 chemistry badge icons arranged left-to-right.
These appear in the matching status screen to indicate the "temperature"
of the group chemistry. Each badge gets a subtle color identity.

═══════════════════════════════════════════════════════════════════
COLOR TREATMENT — FAMILY TINTS (same as mood icons)
═══════════════════════════════════════════════════════════════════

Each badge uses a SINGLE tinted color:

- FIRE: Warm Family #C79450 (golden amber)
- SPROUT: Calm Family #8E8E88 (soft sage gray)
- CHAT: Cool Family #C0A17B (warm taupe)
- WARM SPARKLE: Fire Family #877B93 (muted violet-gray)

═══════════════════════════════════════════════════════════════════
STYLE LOCK
═══════════════════════════════════════════════════════════════════

- Low-poly geometric aesthetic
- Solid fill only — no gradients, no outlines, no shadows
- Abstract symbolic shapes — not photorealistic
- Rounded, organic geometry
- Must be readable at 32x32px
- Same visual weight as the mood icons (reference those)

═══════════════════════════════════════════════════════════════════
CELL DESCRIPTIONS
═══════════════════════════════════════════════════════════════════

CELL 1 — "Fire" (replaces 🔥, tint: #C79450):
Flame shape made of 3-4 stacked geometric teardrop/polygons, pointed top,
wider base. Suggests energy, intensity, high chemistry. Abstract fire,
not realistic. Bold and energetic.

CELL 2 — "Sprout" (replaces 🌱, tint: #8E8E88):
Small seedling with two rounded leaves on a short curved stem, growing
from a tiny oval seed at the base. Suggests growth, potential, slow
warmth. Gentle and organic.

CELL 3 — "Chat" (replaces 💬, tint: #C0A17B):
Speech bubble shape — rounded rectangle with a small triangular tail
pointing down-left. Two small dots inside representing conversation.
Suggests dialogue, connection, balance. Clean and friendly.

CELL 4 — "Sparkle" (replaces ✨, tint: #877B93):
Four-pointed star burst shape with 4 sharp rays and 4 shorter rays
between them. Like a diamond with elongated points. Suggests magic,
surprise, delight. Unique to chemistry — not the same as any existing icon.

═══════════════════════════════════════════════════════════════════
LAYOUT
═══════════════════════════════════════════════════════════════════

- 4 cells in a single horizontal row
- Each cell: 200x200px with icon centered at ~96x96px
- Light gray background (#F5F5F5) for overall composition frame only
- Title above: "Chemistry Badges — JoyJoin Matching Status" in clean sans-serif
- Cell labels below: "Fire · Warm", "Sprout · Calm", "Chat · Cool",
  "Sparkle · Fire" in 11px gray

═══════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════

1. Single preview grid image
2. Individual PNG exports at 3 sizes:
   - 32x32px (1×, for 32rpx display)
   - 64x64px (2×, for 32rpx @2x)
   - 96x96px (3×, for 32rpx @3x)
3. All PNGs: transparent background, single tinted color per icon
4. File naming: chem-{name}.png (e.g. chem-fire.png)
```

---

## PROMPT 2 — Phase Emblems Part 1 (4 icons)

```
A horizontal artboard with 4 large phase emblem icons arranged left-to-right.
These are the "game mode loading" icons for the JoyJoin social icebreaker.
They appear at 80rpx scale and set the tone for each phase. They should
feel like entering a different game mode — each distinct, each exciting.

═══════════════════════════════════════════════════════════════════
COLOR TREATMENT — PHASE-SPECIFIC ACCENTS
═══════════════════════════════════════════════════════════════════

Each emblem uses a SINGLE tinted color (no gradients, no second color):

- WARMUP: Warm Family #C79450 (golden sunrise)
- CHALLENGE: Fire Family #877B93 (electric violet)
- DETECTIVE: Cool Family #C0A17B (warm taupe)
- DICE: Calm Family #8E8E88 (soft sage)

═══════════════════════════════════════════════════════════════════
STYLE LOCK — HERO / GAME MODE
═══════════════════════════════════════════════════════════════════

- Low-poly geometric aesthetic (same family as JoyJoin archetype characters)
- Solid fill only — no gradients, no outlines, no shadows
- MORE detailed than small icons — these are hero moments at 80x80px
- Still geometric and clean, but can have slightly more polygons
- Each emblem must feel like a distinct "game mode" — unique silhouette
- Rounded, friendly proportions — approachable, not aggressive
- Must be readable and impactful at 80x80px

═══════════════════════════════════════════════════════════════════
CELL DESCRIPTIONS
═══════════════════════════════════════════════════════════════════

CELL 1 — "Warmup" (replaces 🌅, tint: #C79450):
Sunrise over horizon — a semi-circle sun rising from a curved horizon
line, with 3-4 short rays extending upward from the sun. The horizon
is a gentle curve. Suggests beginning, warmth, easing in. Soft and
inviting.

CELL 2 — "Challenge" (replaces ⚡, tint: #877B93):
Lightning bolt — a zigzag bolt shape with 2 sharp angles, pointing
diagonally down-right. Clean geometric, bold and energetic. Suggests
action, energy, quick thinking. Dynamic and punchy.

CELL 3 — "Lie Detective" (replaces 🕵️, tint: #C0A17B):
Magnifying glass — a circular lens with a short diagonal handle
extending down-right. A small curved line inside the lens suggesting
a reflection or search pattern. Suggests investigation, curiosity,
uncovering truth. Playful detective feel.

CELL 4 — "Dice" (replaces 🎲, tint: #8E8E88):
Die cube — a 3D isometric cube showing 3 visible faces. Each visible
face has 1-3 small dots (pips) arranged in a pattern. Suggests chance,
play, personality reveal. Game-like and fun.

═══════════════════════════════════════════════════════════════════
LAYOUT
═══════════════════════════════════════════════════════════════════

- 4 cells in a single horizontal row
- Each cell: 280x280px with icon centered at ~160x160px
- Light gray background (#F5F5F5) for overall composition frame only
- Title above: "Phase Emblems Part 1 — JoyJoin Icebreaker" in clean sans-serif
- Cell labels below: "Warmup", "Challenge", "Lie Detective", "Dice" in 11px gray

═══════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════

1. Single preview grid image
2. Individual PNG exports at 3 sizes:
   - 80x80px (1×, for 80rpx display)
   - 160x160px (2×, for 80rpx @2x)
   - 240x240px (3×, for 80rpx @3x)
3. All PNGs: transparent background, single tinted color per icon
4. File naming: phase-{name}.png (e.g. phase-warmup.png)
```

---

## PROMPT 3 — Phase Emblems Part 2 + Status Crown (4 icons)

```
A horizontal artboard with 4 icons arranged left-to-right.
Three are phase emblems (same hero style as Part 1). One is a small
status crown for the icebreaker host badge.

═══════════════════════════════════════════════════════════════════
COLOR TREATMENT
═══════════════════════════════════════════════════════════════════

Phase emblems use SINGLE tinted colors:
- AUCTION: Warm Family #C79450 (golden)
- THEATER: Cool Family #C0A17B (warm taupe)
- RECAP: Fire Family #877B93 (violet sparkle)

Status crown uses BRAND COLOR:
- CROWN: Brand Purple #8B5CF6

═══════════════════════════════════════════════════════════════════
STYLE LOCK
═══════════════════════════════════════════════════════════════════

Phase emblems (3 cells):
- Same hero/game mode style as Part 1
- Solid fill only, low-poly geometric
- MORE detailed than small icons, readable at 80x80px

Status crown (1 cell):
- Simple geometric crown — 3 points with rounded tips
- Extra minimal — readable at 24x24px
- Brand purple fill

═══════════════════════════════════════════════════════════════════
CELL DESCRIPTIONS
═══════════════════════════════════════════════════════════════════

CELL 1 — "Auction" (replaces 🎪, tint: #C79450):
Circus tent / pavilion — a triangular tent shape with a small flag on
top, and a wide rounded entrance at the bottom. Suggests bidding,
showmanship, competition. Playful and theatrical.

CELL 2 — "Theater" (replaces 🎭, tint: #C0A17B):
Theater masks — two overlapping masks (comedy and tragedy). The front
mask is smiling (upturned curve), the back mask peeks from behind with
a sad expression (downturned curve). Simple oval shapes. Suggests
storytelling, roleplay, drama. Creative and expressive.

CELL 3 — "Recap" (replaces ✨, tint: #877B93):
Sparkle burst — a central 4-pointed star with 8-10 short rounded rays
extending outward in all directions. Like a celebration firework or
magic burst. Suggests completion, celebration, summary. Festive and
satisfying.

CELL 4 — "Crown" (replaces 👑, tint: #8B5CF6):
Simple geometric crown — a flat base with 3 rounded points rising from
it. The center point is tallest, side points are shorter and symmetrical.
Small circular jewel dots at the base between points. Minimal, regal,
readable at 24px. Brand purple.

═══════════════════════════════════════════════════════════════════
LAYOUT
═══════════════════════════════════════════════════════════════════

- 4 cells in a single horizontal row
- Cells 1-3: 280x280px with icon centered at ~160x160px
- Cell 4: 160x160px with icon centered at ~72x72px (smaller crown)
- Light gray background (#F5F5F5) for overall composition frame only
- Title above: "Phase Emblems Part 2 + Status — JoyJoin" in clean sans-serif
- Cell labels below: "Auction", "Theater", "Recap", "Host Crown" in 11px gray

═══════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════

PHASE EMBLEMS (cells 1-3):
1. Single preview grid image
2. Individual PNG exports at 3 sizes:
   - 80x80px (1×)
   - 160x160px (2×)
   - 240x240px (3×)
3. File naming: phase-{name}.png

STATUS CROWN (cell 4):
1. Individual PNG exports at 3 sizes:
   - 24x24px (1×)
   - 48x48px (2×)
   - 72x72px (3×)
2. File naming: status-crown.png

All PNGs: transparent background, solid fill only.
```

---

## Asset Delivery Checklist

| Grid | Icons | Display Size | Export Sizes | Est. Size |
|------|-------|-------------|-------------|-----------|
| Chemistry Badges | 4 | 32rpx | 32/64/96 | ~8 KB |
| Phase Emblems P1 | 4 | 80rpx | 80/160/240 | ~20 KB |
| Phase Emblems P2 + Crown | 3+1 | 80/24rpx | mixed | ~15 KB |
| **Total** | **12** | — | **44 files** | **~43 KB** |

### Post-processing (after Lovart delivery):
1. Run all PNGs through ImageMagick optimization:
   ```bash
   magick input.png -strip -interlace Plane -quality 85 output.png
   ```
2. Verify each PNG renders crisply in WeChat DevTools at 1×/2×/3× density
3. Confirm transparent backgrounds (no white fringing)
4. Run `npm run check:clients` after integration

---

*Prompts generated for Phase 2 icon system.*
*Last updated: 2026-04-24*
