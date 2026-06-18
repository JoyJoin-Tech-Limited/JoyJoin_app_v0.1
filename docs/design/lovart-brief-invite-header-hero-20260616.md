# Lovart Design Brief: Invite Page Header Hero

## Goal
Create a small, friendly header illustration for the invite page, replacing the current emoji `🎉` fallback with a proprietary JoyJoin moment that encourages sharing.

## Brand Parameters
- **Primary color:** Warm Coral `#FF9B85` (celebration, share, warmth)
- **Secondary color:** Vibrant Purple `#8B5CF6` (brand accent, spark)
- **Background:** Warm Beige `#F5F1E8` with soft textured grain wash; or transparent
- **Mascot:** 社牛柯基 (Corgi) — playful, energetic, optimistic — holding a small envelope or share card toward the viewer
- **Typography feel:** Rounded Chinese display (AlimamaFangYuanTiVF feel), soft geometric English (Quicksand feel); text is overlaid in code, so keep illustration text-free
- **Visual tone:** warm / cute / rounded / soft / lively / minimal / refined / breathable

## Asset Specifications
- **Type:** mascot-illustration
- **Platform:** mini-program
- **Dimensions:** 320 x 240 px
- **Aspect ratio:** 4:3
- **Export format:** WebP primary + PNG fallback with transparency
- **Minimum resolution:** 2x for retina

## Style Reference
Upload these reference images to Lovart ChatCanvas before generating:
1. **Primary character lock:** `tmp/xiaoyue-reference-grid.webp` — canonical Xiaoyue / 悦仔 model (purple hoodie, sunglasses, watch, chain, circular vignette, 16 expressions). Use this to keep the Corgi mascot on-model.
2. **Primary style lock:** `apps/mini-program/src/assets/ceremony/welcome-back-hero-20260604-v1.webp` — best single-asset example of JoyJoin low-poly geometric painterly style, warm palette with controlled accents, minimal outlines, and atmospheric grain.

## Prompt Draft
> A friendly JoyJoin invite header illustration. The playful Corgi mascot (社牛柯基) stands at a slight angle, holding out a small envelope or share card toward the viewer with a bright, inviting smile. Tiny sparkles and heart-shaped confetti in Warm Coral `#FF9B85` and Vibrant Purple `#8B5CF6` float around. Background is transparent or a very soft Warm Beige `#F5F1E8` textured wash with grain. Style: 2D digital illustration with low-poly / geometric faceted aesthetic, painterly textured rendering with soft brushed feel within each facet, soft gradients within polygonal facets, minimal or no outlines, atmospheric background with grain. Circular vignette feel, centered composition, generous negative space. Natural warm palette with controlled coral and purple accents. No text, no watermarks, no photorealism.

## Export Requirements
- **File naming:** `lovart-ceremony-invite-header-20260616-v1.webp`
- **Save location:** `apps/mini-program/src/assets/ceremony/`
- **Lazy loading:** Yes
- **Subtarget:** main bundle or invite subpackage
- **CDN path:** `/assets/ceremony/lovart-ceremony-invite-header-20260616-v1.webp`

## Review Checklist
- [ ] Brand colors match JoyJoin palette exactly
- [ ] Corgi personality is playful and inviting
- [ ] No text or watermarks on the art
- [ ] Small scale reads well at ~160 x 120 dp
- [ ] Export includes WebP + PNG with transparency
- [ ] File size under ~60 KB WebP at 2x

## Downstream handoff
- **frontend-component-architecture:** Wire into `apps/mini-program/src/pages/invite/index.tsx` top hero area, replacing the emoji fallback.
- **wow-elements:** Optional gentle bounce-in animation on first view.
