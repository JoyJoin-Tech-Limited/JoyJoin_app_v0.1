# Lovart Design Brief: Social Icebreaker Custom Tier Backdrop

> **Status:** Superseded 2026-06-25. The tier selector now uses CDN-backed Lovart side-art `tier-card-custom.webp` (see `docs/design/lovart-brief-tier-selector-side-art-20260625.md`). `TIER_VIBE_BACKDROPS` has been removed from `apps/mini-program/src/lib/ceremonyHeroes.ts`. This brief is kept for historical reference only.

## Goal
Create a dedicated ceremony backdrop for the `custom` social icebreaker tier, instead of reusing the `glow` hero, giving host-driven free-form sessions their own visual identity.

## Brand Parameters
- **Primary color:** Vibrant Purple `#8B5CF6` (host authority, brand anchor)
- **Secondary color:** Fresh Green `#9ACD32` (flexibility, possibility)
- **Background:** Warm Beige `#F5F1E8` with soft textured grain wash
- **Mascot:** 人脉蛛 (Spider) — intricate, connected, detailed — weaving a small constellation of phase icons into a playful web
- **Typography feel:** Rounded Chinese display (AlimamaFangYuanTiVF feel), soft geometric English (Quicksand feel); text is overlaid in code, so keep illustration text-free
- **Visual tone:** warm / cute / rounded / soft / lively / minimal / refined / breathable

## Asset Specifications
- **Type:** mascot-illustration
- **Platform:** mini-program
- **Dimensions:** 750 x 420 px
- **Aspect ratio:** 16:9
- **Export format:** WebP primary + PNG fallback
- **Minimum resolution:** 2x for retina

## Style Reference
Upload these reference images to Lovart ChatCanvas before generating:
1. **Primary style lock:** `apps/mini-program/src/assets/ceremony/welcome-back-hero-20260604-v1.webp` — best single-asset example of JoyJoin low-poly geometric painterly style, warm palette with controlled accents, minimal outlines, and atmospheric grain.
2. **Wide backdrop composition reference:** `apps/mini-program/src/assets/lovart/icebreaker/backgrounds/bg-personality-dice.jpg` — 750×1000 vertical scene with layered depth, atmospheric grain, and controlled purple/green accent colors. Best reference for composing a usable UI backdrop.
3. **Archetype animal reference:** `apps/mini-program/src/assets/lovart/icebreaker/backgrounds/bg-group-mirror.jpg` — shows how multiple archetype animals interact in a low-poly geometric scene with environmental storytelling.

## Prompt Draft
> A warm, host-centric JoyJoin social icebreaker custom-tier backdrop. The intricate Spider mascot (人脉蛛) sits cheerfully at the center of a delicate web, weaving small glowing constellation-like nodes that hint at different game phases (dice, cards, speech bubbles) in Vibrant Purple `#8B5CF6` and Fresh Green `#9ACD32`. The web feels playful, not spooky. Background is a breathable Warm Beige `#F5F1E8` textured wash with subtle grain. Style: 2D digital illustration with low-poly / geometric faceted aesthetic, painterly textured rendering with soft brushed feel within each facet, soft gradients within polygonal facets, minimal or no outlines, atmospheric background with grain. Wide horizontal composition, centered subject, generous negative space on the sides for tier label and host controls. Natural warm palette with controlled purple and green accents. No text, no watermarks, no photorealism.

## Export Requirements
- **File naming:** `lovart-ceremony-tier-custom-20260616-v1.webp`
- **Save location:** `apps/mini-program/src/assets/ceremony/`
- **Lazy loading:** Yes
- **Subtarget:** icebreaker subpackage
- **CDN path:** `/assets/ceremony/lovart-ceremony-tier-custom-20260616-v1.webp`

## Review Checklist
- [ ] Brand colors match JoyJoin palette exactly
- [ ] Spider personality is intricate but friendly, not spooky
- [ ] No text or watermarks on the art
- [ ] Reads well as a wide backdrop behind tier text
- [ ] Export includes WebP + PNG
- [ ] File size under ~100 KB WebP at 2x

## Downstream handoff
> No longer required — the custom tier visual identity is now delivered by `tier-card-custom.webp` in `pages/icebreaker-session/tier-selector/index.tsx`.

- **frontend-component-architecture:** Add `custom` entry to `TIER_VIBE_BACKDROPS` in `apps/mini-program/src/lib/ceremonyHeroes.ts` and wire into the icebreaker tier selector. *(Superseded 2026-06-25)*
- **design-system-governance:** Update tier backdrop token mapping if needed. *(Superseded 2026-06-25)*
