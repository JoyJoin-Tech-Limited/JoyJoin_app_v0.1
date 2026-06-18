# Lovart Design Brief: Blind Box Payment Ritual Reveal Backdrop

## Goal
Create a dramatic but warm ritual backdrop for the archetype-family reveal moment in blind-box payment Ritual V2, making the unboxing feel like a personal ceremony.

## Brand Parameters
- **Primary color:** Vibrant Purple `#8B5CF6` (mystery, magic, brand anchor)
- **Secondary color:** Warm Coral `#FF9B85` (spark, warmth, surprise)
- **Background:** Deepened Warm Beige `#F5F1E8` with subtle purple-tinted atmospheric wash and grain
- **Mascot:** 脑洞章鱼 (Octopus) — creative, multi-faceted, curious — peeking from behind a glowing blind box as a ceremonial host
- **Typography feel:** Rounded Chinese display (AlimamaFangYuanTiVF feel), soft geometric English (Quicksand feel); text is overlaid in code, so keep illustration text-free
- **Visual tone:** warm / cute / rounded / soft / lively / surprising / refined / breathable

## Asset Specifications
- **Type:** mascot-illustration
- **Platform:** mini-program
- **Dimensions:** 750 x 840 px
- **Aspect ratio:** 8:9
- **Export format:** WebP primary + PNG fallback
- **Minimum resolution:** 2x for retina

## Style Reference
Upload these reference images to Lovart ChatCanvas before generating:
1. **Primary style lock:** `apps/mini-program/src/assets/ceremony/welcome-back-hero-20260604-v1.webp` — best single-asset example of JoyJoin low-poly geometric painterly style, warm palette with controlled purple/coral accents, minimal outlines, and atmospheric grain.
2. **Octopus archetype reference:** `apps/mini-program/src/assets/lovart/icebreaker/backgrounds/bg-personality-dice.jpg` — shows the low-poly geometric Octopus archetype (脑洞章鱼) with large glossy eyes, simplified features, and warm natural palette. Use this to keep the Octopus mascot consistent with the canonical 12-archetype rendering style.
3. **Wide backdrop composition reference:** `apps/mini-program/src/assets/lovart/icebreaker/backgrounds/bg-auction.jpg` — 750×1000 vertical scene with layered depth, atmospheric grain, and a usable UI backdrop composition.

## Prompt Draft
> A magical yet warm JoyJoin blind-box reveal ritual scene. The curious Octopus mascot (脑洞章鱼) peeks playfully from behind a large, softly glowing blind box at center, one tentacle lifting the lid as warm light spills out. Floating geometric sparkles and small paper ribbons drift upward in Vibrant Purple `#8B5CF6` and Warm Coral `#FF9B85`. The background is a deepened Warm Beige `#F5F1E8` atmospheric wash with subtle grain and a soft purple vignette at the edges. Style: 2D digital illustration with low-poly / geometric faceted aesthetic, painterly textured rendering with soft brushed feel within each facet, soft gradients within polygonal facets, minimal or no outlines, atmospheric background with grain. Centered composition with the box as focal point, generous negative space around the edges for UI text overlay. Natural warm palette with controlled purple and coral magic accents. No text, no watermarks, no photorealism.

## Export Requirements
- **File naming:** `lovart-ceremony-blind-box-reveal-20260616-v1.webp`
- **Save location:** `apps/mini-program/src/assets/ceremony/`
- **Lazy loading:** Yes — only loaded when Ritual V2 is enabled
- **Subtarget:** pool-registration or blind-box subpackage
- **CDN path:** `/assets/ceremony/lovart-ceremony-blind-box-reveal-20260616-v1.webp`

## Review Checklist
- [ ] Brand colors match JoyJoin palette exactly
- [ ] Octopus personality is curious and ceremonial, not chaotic
- [ ] No text or watermarks on the art
- [ ] Dramatic but still warm and cute
- [ ] Export includes WebP + PNG
- [ ] File size under ~150 KB WebP at 2x

## Downstream handoff
- **frontend-component-architecture:** Wire into `apps/mini-program/src/pages/blind-box-payment/index.tsx` `RitualActRevelation` when `PAYMENT_RITUAL_V2_ENABLED` is true.
- **wow-elements:** Pair with existing particle burst and Xiaoyue `actionSuccess` expression.
