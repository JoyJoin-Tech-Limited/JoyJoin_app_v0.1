# Lovart Design Brief: Matching-Status Puzzle Piece Set

## Goal
Create a set of 6 interlocking puzzle-piece silhouettes that animate from scattered “falling” positions into a completed 2×3 puzzle cluster on the matching-status live-reveal prelude. The pieces must feel premium, warm, and unmistakably JoyJoin — not generic clip-art.

## Brand Parameters (Hard Style Lock)

### Required visual style
- **2D low-poly / geometric faceted illustration.** Every surface is broken into flat polygonal facets.
- **Painterly, soft-brush texture inside each facet** — no solid flat vector fills.
- **Minimal or zero black outlines** — form is defined by facet edges and value shifts only.
- **Soft gradients within facets**, not smooth airbrush gradients across the whole piece.
- **Subtle atmospheric grain / paper texture** across the whole image.
- **Warm natural palette with controlled purple accent.**

### Required color palette
| Role | Hex | Usage |
|------|-----|-------|
| Primary purple | `#8B5CF6` | shadows, puzzle edge tint, accent facets |
| Secondary coral | `#FF9B85` | warm rim light, accent facets |
| Surface beige | `#F5F1E8` | main face of light pieces |
| Soft white | `#FFFFFF` | highlight facets |
| Lavender | `#C4B5FD` | light purple facets |
| Deep violet | `#7C3AED` | dark purple facets |
| Pale gold | `#FDE68A` | warm highlight pieces |
| Warm peach | `#FDBA74` | transition tones |

### Per-piece dominant hue
Each piece must read as distinct but stay in the same family:
- Piece 01: warm beige/cream (`#F5F1E8`)
- Piece 02: soft coral (`#FF9B85`)
- Piece 03: lavender/light purple (`#C4B5FD`)
- Piece 04: warm peach (`#FDBA74`)
- Piece 05: soft violet (`#A78BFA`)
- Piece 06: pale gold (`#FDE68A`)

## Style-Lock Prompt (Copy-Paste)

```
STYLE LOCK — DO NOT DEVIATE:
- 2D low-poly / geometric faceted digital illustration.
- Every color area is broken into visible polygonal facets.
- Inside each facet: soft painterly brush texture, subtle value shifts, no flat vector fills.
- NO black outlines. Form is defined by facet edges and light/shadow only.
- NO smooth airbrush gradients across large areas; gradients must live inside individual facets.
- Subtle paper/grain texture over the whole image.
- Warm natural color palette with Vibrant Purple #8B5CF6 and Warm Coral #FF9B85 as accents only.
- Cute but refined, rounded, lively, breathable.
- Transparent background.

NEGATIVE CONSTRAINTS:
- No photorealism.
- No 3D render.
- No heavy shadows under the pieces (engineering adds shadows in code).
- No text, watermarks, logos, or signatures.
- No sparkles, stars, hearts, or decorative ornaments on the pieces themselves.
- No glossy plastic / emoji / sticker look.
- No thin black stroke borders.
```

## Style References in Repo
Use these already-shipped assets as the exact style target:

- `apps/mini-program/src/assets/lovart/lovart-pool-persona-base-20260701-v1.{webp,png}` — facet density and palette
- `apps/mini-program/src/assets/lovart/lovart-pool-persona-cluster-texture-20260701-v1.{webp,png}` — grain/texture feel
- `apps/mini-program/src/assets/lovart/lovart-particle-purple-20260701-v1.{webp,png}` — warm purple facet treatment
- `apps/mini-program/src/assets/lovart/lovart-particle-coral-20260701-v1.{webp,png}` — coral accent treatment

The puzzle pieces must look like they came from the same artist and project as these assets.

## Interlock Specification: 2 Columns × 3 Rows

### Canvas
- **Square tile:** 192×192 px (2×) minimum; 288×288 px (3×) recommended.
- **Transparent background** outside the piece silhouette.
- **Finished rectangle:** 2 pieces wide × 3 pieces tall.

### Tab geometry
- **Tab height:** 24 px on a 192 px tile (12.5% of edge length).
- **Tab width:** 48 px on a 192 px tile (25% of edge length).
- **Corner radius:** 4 px on tabs/blanks for softness.
- **Tab shape:** rounded semicircular protrusion centered on the edge.
- **Blank shape:** matching inverse cutout centered on the edge.

### Edge rules per piece

| Piece ID | Position (col, row) | Top edge | Right edge | Bottom edge | Left edge |
|---|---|---|---|---|---|
| 01 | (0, 0) | flat | tab-out | tab-out | flat |
| 02 | (1, 0) | flat | flat | blank-in | tab-in |
| 03 | (0, 1) | blank-in | tab-out | tab-out | flat |
| 04 | (1, 1) | tab-in | flat | blank-in | tab-in |
| 05 | (0, 2) | blank-in | tab-out | flat | flat |
| 06 | (1, 2) | tab-in | flat | flat | tab-in |

- **flat** = straight edge (outer boundary of the finished rectangle).
- **tab-out** = protruding knob centered on that edge.
- **blank-in** / **tab-in** = matching indentation; the receiving side when the neighbor has a tab-out.

### Visual grid

```
┌─────────┬─────────┐
│  piece  │  piece  │
│   01    │   02    │
│──tab────│─blank───│
│  blank  │   tab   │
│   03    │   04    │
│──tab────│─blank───│
│  blank  │   tab   │
│   05    │   06    │
└─────────┴─────────┘
```

### Rendering rules for each piece
1. Draw the tile as a square 192×192 px canvas.
2. Add the tab or blank shape centered on the relevant edge.
3. Keep the artwork inside the piece boundaries; do not draw into the neighbor’s tile area.
4. The facets and color should flow across interlocking edges so adjacent pieces read as one continuous surface when snapped.
5. Transparent background outside the silhouette.

## Asset Specifications
- **Type:** icon / illustration set (game-asset style)
- **Platform:** WeChat Mini Program (Taro)
- **Dimensions per piece:** 192×192 px minimum (2×); 288×288 px recommended (3×)
- **Aspect ratio:** square 1:1 per piece
- **Export format:** WebP primary, PNG fallback with transparency
- **Count:** 6 unique pieces

## Final Prompt to Lovart

```
Create a set of 6 interlocking puzzle-piece illustrations for a WeChat mini-program.
Each piece is a square tile that snaps with neighbors into a 2-column × 3-row rectangle.

STYLE LOCK — DO NOT DEVIATE:
- 2D low-poly / geometric faceted digital illustration.
- Every surface broken into visible polygonal facets.
- Soft painterly brush texture inside each facet; no flat vector fills.
- NO black outlines. NO smooth airbrush gradients. NO photorealism. NO 3D render.
- Subtle paper/grain texture over the whole image.
- Warm natural palette with controlled Vibrant Purple #8B5CF6 and Warm Coral #FF9B85 accents.
- Cute but refined, rounded, lively, breathable.
- Transparent background.

NEGATIVE CONSTRAINTS:
- No text, watermarks, logos, signatures.
- No sparkles, stars, hearts, or decorative ornaments.
- No glossy plastic / emoji / sticker look.
- No heavy drop shadows.

INTERLOCK GEOMETRY (192×192 px square per piece, centered tabs/blanks):
- Piece 01 (top-left): top=flat, right=tab-out, bottom=tab-out, left=flat
- Piece 02 (top-right): top=flat, right=flat, bottom=blank-in, left=tab-in
- Piece 03 (mid-left): top=blank-in, right=tab-out, bottom=tab-out, left=flat
- Piece 04 (mid-right): top=tab-in, right=flat, bottom=blank-in, left=tab-in
- Piece 05 (bottom-left): top=blank-in, right=tab-out, bottom=flat, left=flat
- Piece 06 (bottom-right): top=tab-in, right=flat, bottom=flat, left=tab-in

Tab dimensions: width 48 px, height 24 px, rounded corners 4 px.

DOMINANT HUE PER PIECE:
01 warm beige/cream #F5F1E8
02 soft coral #FF9B85
03 lavender #C4B5FD
04 warm peach #FDBA74
05 soft violet #A78BFA
06 pale gold #FDE68A

The finished set must feel like fragments of a friend-group constellation coming together.
Export each piece as a separate transparent WebP and PNG with square aspect ratio.
```

## Export Requirements
- **File naming:** `lovart-puzzle-piece-{01..06}-20260701-v1.{webp,png}`
- **Save location:** `apps/mini-program/src/assets/lovart/puzzle/`
- **Lazy loading:** yes — loaded inside matching-status subpackage
- **Bundle location:** main package only if total compressed set < 60 KB; otherwise place in matching-status subpackage
- **Companion preview:** `lovart-puzzle-table-glow-20260701-v1.{webp,png}` — optional soft table glow overlay

## Review Checklist
- [ ] 6 pieces truly interlock into a clean 2×3 rectangle
- [ ] Each piece has transparent background and square canvas
- [ ] Tab/blank geometry matches the edge spec exactly
- [ ] Style matches `lovart-pool-persona-base-*` and `lovart-particle-*` facet treatment
- [ ] Brand colors match the palette table exactly
- [ ] No text, watermarks, logos, or signatures
- [ ] No black outlines, no glossy sticker look
- [ ] Exports include both WebP and PNG fallbacks
- [ ] File sizes are acceptable for mini-program loading
