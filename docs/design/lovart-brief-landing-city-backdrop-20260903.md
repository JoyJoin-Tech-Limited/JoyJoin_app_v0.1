# Lovart Brief — Landing "Dusk City Backdrop" (2026-09-03)

> Status: **pending generation**. Companion to
> `lovart-brief-landing-blind-box-city-20260726.md` (the winning 2D master +
> sprites). This backdrop is the Phase 1 "immersive city" upgrade from the
> 2026-09-03 landing redesign strategy: it replaces the flat CSS dusk gradient
> behind the hero stage with a full-bleed painterly skyline. The existing
> `hero-box-xiaoyue-dusk.webp` composite sits IN FRONT of this backdrop —
> composition below is designed around its silhouette.

## 0. Context

- **Style:** the established, A/B-winning **2D low-poly geometric illustration
  with painterly texture inside each facet** (Candidate B from the 2026-07-26
  brief). NO 3D, NO photorealism. This is the same world as the shipped hero:
  the box + Xiaoyue must read as sitting inside this scene.
- **Palette:** brand purple `#8B5CF6` family (dusky, desaturated — pull
  saturation down ~15% toward dusty violet, never neon), warm cream `#FFFAF4`
  sky highlights, dusk lavender ambient, golden window/bokeh lights
  `#FDE68A` → `#FBBF24` → `#F0A030`.
- **Hard rules:** no text/letters/numbers/logos/watermarks/signs anywhere; no
  people (no diners, no silhouettes of humans); no animals; no vehicles; no
  dark moody night — this is warm dusk, not midnight.

## 1. Composition map (canvas = hero zone, 750×900 px)

The backdrop is anchored to the landing hero zone, NOT the full screen — its
bottom edge fades away above the copy zone. Design targets (percentages of
canvas height):

```
0%  ┌─────────────────────────────┐  ← sky: dusk purple-pink gradient
    │   soft painterly clouds,    │     (bubbles float here client-side)
20% │   upper 20% fades to fully  │
    │   TRANSPARENT (feathered)   │
35% │  ── skyline silhouette ──   │  ← far towers: muted lavender/indigo
    │   ferris wheel far right,   │     low contrast, recessed
50% │   mid towers w/ warm lit    │
    │   window DOTS (no signs)    │  ← box mouth glow zone: keep the
    │                             │     center-left (x 20–65%) CALM —
65% │  ── river band ───────────  │     the glowing box renders here
    │   bokeh light reflections,  │     client-side; no busy detail
    │   lantern string lights on  │     behind the box silhouette
80% │   near embankment           │
    │  bottom 20% fades to        │  ← quiet bottom third rule:
    │  TRANSPARENT (feathered)    │     luminance-banded, calm, so the
100%└─────────────────────────────┘     mechanism strip + copy stay ≥4.5:1
```

Specific placement rules:

1. **Quiet center-left band (x 20–65%, y 50–80%):** the hero box composite
   renders here. Behind it, keep ONLY soft out-of-focus wash (river shimmer,
   gentle bokeh) — no tower edges, no bright dots, no high-contrast strokes.
2. **Skyline horizon at ~y 35–50%:** far silhouettes in muted dusk
   lavender/indigo, low saturation, clearly behind everything. One ferris
   wheel at far right (~x 78–95%), small, silhouette-only with a few warm dot
   lights. 2–3 distinctive mid towers may catch warm window light.
3. **River band at ~y 55–80%:** horizontal painterly wash reflecting the
   golden lights — scattered soft bokeh DOTS (round, warm gold, varying
   alpha), plus 1–2 strings of tiny lantern lights along the near embankment
   edge (left and right thirds only — never across the center-left quiet band).
4. **Sky at y 20–35%:** dusk gradient purple-pink with 2–3 soft brushed cloud
   shapes, low detail — 4–6 client-side bubbles will float here.
5. **Feathered edges:** upper 20% AND lower 20% fade smoothly to zero alpha so
   the image dissolves into the page's CSS dusk gradient above and below —
   no hard horizontal seam anywhere. Left/right edges must also be calm
   (no element touching the canvas edge at full contrast).

## 2. Master prompt (paste into Lovart)

> Generate this in the SAME Lovart session family as the shipped
> `hero-box-xiaoyue-dusk` master if possible ("same series as the previous
> image"), so facet language and grain match. If starting fresh, the style
> lock below is self-contained.

```
Brand system (JoyJoin — landing dusk city backdrop, established 2D illustration language):
- Brand purple family: dusty desaturated #8B5CF6 (pull saturation DOWN ~15%,
  never neon violet), dusk lavender ambient, warm cream #FFFAF4 sky highlights
- Golden lights: hot core #FDE68A, main gold #FBBF24, outer amber #F0A030

Never (anti-slop red lines):
- any text, letters, numbers, logos, watermarks, signs, billboards, symbols
  or pseudo-glyphs anywhere — every surface stays blank
- people, human silhouettes, faces, animals, cars, boats
- 3D render, photorealism, glossy plastic, airbrushed smoothness, CGI look
- flat corporate vector look, generic gradient meshes, neon colors
- dark moody midnight scenes, horror lighting, heavy black shadows

Style lock (MANDATORY — JoyJoin's established Lovart illustration language):
- 2D low-poly geometric illustration: clean polygonal facets with painterly
  soft-brushed texture INSIDE each facet — NOT flat vector fills
- Soft gradients within facets; visible painterly grain everywhere
- It must read as a hand-crafted editorial illustration with visible craft —
  generous negative space, intentional asymmetry, no digital-render perfection

Scene — a warm dusk city waterfront, painted as an ambient backdrop:
- Overall mood: golden hour fading into violet dusk — warm, soft, inviting,
  NOT night. The sky carries a purple-pink dusk gradient with 2–3 soft
  brushed cloud shapes in the upper third.
- A distant city skyline across the middle of the canvas (y 35–50%): muted
  lavender-indigo silhouettes, low saturation, clearly far away. Include one
  small ferris wheel at the far right with a few warm dot lights. 2–3 mid
  towers may carry scattered warm golden lit-window DOTS (dots only — no
  signs, no symbols).
- A calm river band across the lower middle (y 55–80%): a horizontal
  painterly wash reflecting the golden lights as soft round bokeh dots of
  varying transparency. 1–2 strings of tiny warm lantern lights along the
  near embankment, ONLY in the left and right thirds.
- CRITICAL quiet zone: keep the center-left region (x 20–65%, y 50–80%)
  calm and low-contrast — only soft out-of-focus river shimmer and gentle
  bokeh there. No tower edges, no bright dots, no crisp strokes in that
  region (a glowing gift-box illustration will be composited on top of it
  client-side).
- Feathering: the top 20% and bottom 20% of the canvas fade smoothly to fully
  transparent — no hard seams. Left and right edges stay calm, nothing
  touches the canvas edge at full contrast.
- Lighting logic: one warm dusk light from the sky; all golden lights are
  small, warm, candle-like points. Shadows and cool tones are soft lavender,
  never black.

Export: transparent PNG (feathered alpha top and bottom), 750×900 px, no text
anywhere in the image. Please give me 2 variants so I can pick the stronger one.
```

## 3. Delivery checklist

| Step | Action |
|---|---|
| Review | Zero text/signs; zero people/animals; quiet center-left band held; top+bottom feather to alpha 0; dusk (not night) mood; purple is dusty not neon |
| Convert | PNG → WebP q80 (pattern: `scripts/optimize-ceremony-batch-c.mjs`); also derive a 48×48 blurred LQIP |
| Name/place | CDN-only: `landing-backdrop-city-dusk.webp` (~120–160KB budget) + `landing-backdrop-city-dusk-lqip.webp` (~2KB, bundled). Register in `apps/mini-program/scripts/cdn-asset-manifest.json` |
| Upload | `gh workflow run "Upload CDN Assets"` (production `/var/www/cdn`) — 404s must stay non-cacheable per the 2026-08-01 nginx rule |
| Code wiring | L1 backdrop `<Image>` layer inside `hero-stage__scale`, z-index below halo; CSS gradient stays as L0 silent fallback; `onError`/6s-timeout → remove backdrop silently; `landingAnalytics.trackHeroAsset` with new `asset: 'backdrop-city-dusk'` key (server analytics allow-list in the same PR) |
| Gate | Extend `check:landing-hero-assets` to cover the backdrop (alpha feather checks: outer 8px top/bottom rows alpha≈0; quiet-zone contrast check on x 20–65%/y 50–80%; saturation/neon/weight budgets) |

## 4. Acceptance gate

- §Programmatic: extended `npm run check:landing-hero-assets -w mini-program` PASS
- Vision rubric (reuse the 2026-07-26 §5b table, adapted rows):
  1. **Zero text/signs/pseudo-glyphs** (windows are DOTS only)
  2. **Zero people/animals/vehicles**
  3. Style = same low-poly painterly family as shipped hero (cross-asset unity)
  4. Quiet center-left band held (nothing crisp behind the box zone)
  5. Feathering: top/bottom dissolve, no hard seams, nothing hugs edges
  6. Palette discipline: dusty purple, candlelight golds, dusk not night
  7. Painterly craft (grain inside facets, not flat vector)
  8. Composition breathes (sky negative space for future bubbles)
  - Ship threshold: ≥13/16 equivalent rigor AND no zero on rows 1–4.
- Renders cleanly over the CSS dusk gradient at all three screen tiers
  (`--short`/`--mid`/default), verified in WeChat DevTools
