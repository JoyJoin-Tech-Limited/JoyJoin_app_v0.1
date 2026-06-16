# Lovart Design Brief: Payment Verifying / Trust Illustration

## Goal
Create a small trust illustration for the event-ticket payment "verifying" state, replacing the current CSS circle placeholder and reassuring the user while WeChat Pay confirms the transaction.

## Brand Parameters
- **Primary color:** Sky Blue `#A8C5DD` (calm, trust, processing)
- **Secondary color:** Vibrant Purple `#8B5CF6` (subtle brand pulse)
- **Background:** Warm Beige `#F5F1E8` with soft textured grain wash; or transparent for flexible placement
- **Mascot:** 靠谱大象 (Elephant) — steady, reliable, grounding — standing calmly with a small glowing shield or checkmark orb
- **Typography feel:** Rounded Chinese display (AlimamaFangYuanTiVF feel), soft geometric English (Quicksand feel); text is overlaid in code, so keep illustration text-free
- **Visual tone:** warm / cute / rounded / soft / calm / minimal / refined / breathable

## Asset Specifications
- **Type:** mascot-illustration
- **Platform:** mini-program
- **Dimensions:** 400 x 320 px
- **Aspect ratio:** 5:4
- **Export format:** WebP primary + PNG fallback with transparency
- **Minimum resolution:** 2x for retina

## Style Reference
Upload these reference images to Lovart ChatCanvas before generating:
1. **Primary style lock:** `apps/mini-program/src/assets/ceremony/welcome-back-hero-20260604-v1.webp` — best single-asset example of JoyJoin low-poly geometric painterly style, warm palette with controlled accents, minimal outlines, and atmospheric grain.
2. **Elephant archetype reference:** `apps/mini-program/src/assets/lovart/icebreaker/backgrounds/bg-auction.jpg` — contains a low-poly geometric Elephant archetype with large glossy eyes, simplified features, and warm natural palette. Use this to keep the Elephant mascot consistent with the canonical 12-archetype rendering style.

## Prompt Draft
> A calm, reassuring JoyJoin payment processing illustration. The steady Elephant mascot (靠谱大象) stands gently with eyes half-closed, holding or standing beside a small glowing orb that contains a soft checkmark pulse in Sky Blue `#A8C5DD`. Subtle Vibrant Purple `#8B5CF6` accents appear as tiny spark trails around the orb. The mood is patient and trustworthy, not frantic. Background is transparent or a very soft Warm Beige `#F5F1E8` textured wash with grain. Style: 2D digital illustration with low-poly / geometric faceted aesthetic, painterly textured rendering with soft brushed feel within each facet, soft gradients within polygonal facets, minimal or no outlines, atmospheric background with grain. Circular vignette feel, centered composition, generous negative space. Natural warm palette with controlled blue and purple accents. No text, no watermarks, no photorealism.

## Export Requirements
- **File naming:** `lovart-ceremony-payment-verifying-20260616-v1.webp`
- **Save location:** `apps/mini-program/src/assets/ceremony/`
- **Lazy loading:** Yes
- **Subtarget:** pool-registration subpackage or main bundle
- **CDN path:** `/assets/ceremony/lovart-ceremony-payment-verifying-20260616-v1.webp`

## Review Checklist
- [ ] Brand colors match JoyJoin palette exactly
- [ ] Elephant personality is steady and grounding
- [ ] No text or watermarks on the art
- [ ] Calm, patient mood — not celebratory
- [ ] Export includes WebP + PNG with transparency
- [ ] File size under ~80 KB WebP at 2x

## Downstream handoff
- **frontend-component-architecture:** Wire into `apps/mini-program/src/pages/event-ticket-payment/index.tsx` verifying state; can be paired with `xiaoyue-paymentTrust` expression as fallback.
