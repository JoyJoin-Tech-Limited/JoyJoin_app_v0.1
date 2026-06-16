# Lovart Design Brief: Pool Registration Free Success Hero

## Goal
Create a celebration illustration for the pool-registration free-success screen, conveying "you're in" — a warm sense of belonging and anticipation before matching begins.

## Brand Parameters
- **Primary color:** Fresh Green `#9ACD32` (success signal, checkmark glow)
- **Secondary color:** Warm Coral `#FF9B85` (spark, warmth)
- **Background:** Warm Beige `#F5F1E8` with soft textured grain wash
- **Mascot:** 树洞考拉 (Koala) — warm, empathetic, protective — hugging a small round event badge or ticket with a gentle smile
- **Typography feel:** Rounded Chinese display (AlimamaFangYuanTiVF feel), soft geometric English (Quicksand feel); text is overlaid in code, so keep illustration text-free
- **Visual tone:** warm / cute / rounded / soft / lively / minimal / refined / breathable

## Asset Specifications
- **Type:** mascot-illustration
- **Platform:** mini-program
- **Dimensions:** 750 x 560 px
- **Aspect ratio:** 4:3
- **Export format:** WebP primary + PNG fallback
- **Minimum resolution:** 2x for retina

## Style Reference
Upload these reference images to Lovart ChatCanvas before generating:
1. **Primary style lock:** `apps/mini-program/src/assets/ceremony/welcome-back-hero-20260604-v1.webp` — best single-asset example of JoyJoin low-poly geometric painterly style, warm palette with controlled accents, minimal outlines, and atmospheric grain.
2. **Archetype animal reference:** `apps/mini-program/src/assets/lovart/icebreaker/backgrounds/bg-personality-dice.jpg` — shows how non-Xiaoyue archetype animals (hamster, octopus) are rendered with low-poly bodies, large glossy eyes, simplified features, and warm natural palette.

## Prompt Draft
> A warm "you're in" celebration scene for JoyJoin. The empathetic Koala mascot (树洞考拉) gently hugs a round glowing event badge or ticket, eyes closed in a happy, content expression. A soft green checkmark glows behind the badge in Fresh Green `#9ACD32`. Tiny sparkles and warm coral `#FF9B85` accents float around like fireflies. Background is a breathable Warm Beige `#F5F1E8` textured wash with subtle grain. Style: 2D digital illustration with low-poly / geometric faceted aesthetic, painterly textured rendering with soft brushed feel within each facet, soft gradients within polygonal facets, minimal or no outlines, atmospheric background with grain. Circular vignette feel, centered composition, generous negative space. Natural warm palette with controlled green and coral accents. No text, no watermarks, no photorealism.

## Export Requirements
- **File naming:** `lovart-ceremony-pool-registration-success-20260616-v1.webp`
- **Save location:** `apps/mini-program/src/assets/ceremony/`
- **Lazy loading:** Yes — loaded only in registered state
- **Subtarget:** pool-registration subpackage
- **CDN path:** `/assets/ceremony/lovart-ceremony-pool-registration-success-20260616-v1.webp`

## Review Checklist
- [ ] Brand colors match JoyJoin palette exactly
- [ ] Koala personality is warm and reassuring
- [ ] No text or watermarks on the art
- [ ] Soft, rounded, warm emotional tone
- [ ] Export includes WebP + PNG
- [ ] File size under ~120 KB WebP at 2x

## Downstream handoff
- **frontend-component-architecture:** Wire into `apps/mini-program/src/pages/pool-registration/index.tsx` registered/success state.
- **wow-elements:** Consider a gentle scale-in animation for the hero and badge glow.
