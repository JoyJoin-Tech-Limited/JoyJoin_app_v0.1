# Lovart Design Brief: Event Ticket Payment Hero

## Goal
Create a full-bleed banner illustration for the WeChat Mini Program event-ticket payment page. The hero sits at the top of a ticket-shaped card and must make the "pay to join" moment feel warm, celebratory, and distinctly JoyJoin — like holding a ticket to a curated gathering.

## Brand Parameters
- **Primary color:** Vibrant Purple `#8B5CF6` (accent lights, confetti, ticket ribbon)
- **Secondary color:** Warm Coral `#FF9B85` (highlights, sparks, emotional peak)
- **Background:** Warm Beige `#F5F1E8` with soft textured grain wash, blending into white ticket body
- **Mascot:** 社牛柯基 (Corgi) — playful, energetic, optimistic — peeking over or holding a golden event ticket
- **Typography feel:** Rounded Chinese display (AlimamaFangYuanTiVF feel), soft geometric English (Quicksand feel); text is overlaid in code, so keep illustration text-free
- **Visual tone:** warm / cute / rounded / soft / lively / minimal / refined / breathable

## Asset Specifications
- **Type:** mascot-illustration
- **Platform:** mini-program
- **Dimensions:** 750 x 320 px
- **Aspect ratio:** ~2.34:1
- **Export format:** WebP primary + PNG fallback
- **Minimum resolution:** 2x for retina

## Style Reference
Upload these reference images to Lovart ChatCanvas before generating:
1. **Primary character lock:** `tmp/xiaoyue-reference-grid.webp` — canonical Xiaoyue / 悦仔 model (purple hoodie, sunglasses, watch, chain, circular vignette, 16 expressions). Use this to keep the Corgi mascot on-model and in the same low-poly geometric painterly family.
2. **Primary style lock:** `apps/mini-program/src/assets/ceremony/welcome-back-hero-20260604-v1.webp` — best single-asset example of JoyJoin low-poly geometric painterly style, warm palette with controlled purple/coral accents, minimal outlines, and atmospheric grain.
3. **Layout lock:** screenshot of `apps/mini-program/src/pages/event-ticket-payment/index.tsx` ticket card — the hero occupies the rounded-top banner area; title and event meta are overlaid at the bottom, so the bottom 25% should be relatively quiet / light.

## Prompt Draft
> A warm JoyJoin event-ticket ceremony banner. Center: the playful Corgi mascot (社牛柯基) peeking over an oversized golden event ticket or purple gift box, paws resting on the ticket edge, looking excited and welcoming. Soft confetti, paper streamers, and tiny sparkles float around. Background: breathable Warm Beige `#F5F1E8` textured wash that lightens toward the bottom so it blends into the white ticket body below. Accents: Vibrant Purple `#8B5CF6` on the ticket ribbon and small glows; Warm Coral `#FF9B85` on confetti highlights. Style: 2D digital illustration with low-poly / geometric faceted aesthetic, painterly textured rendering with soft brushed feel within each facet, soft gradients within polygonal facets, minimal or no outlines, atmospheric background with grain. Centered composition, generous negative space at the bottom for gradient overlay and title text. No text, no watermarks, no photorealism.

## Export Requirements
- **File naming:** `lovart-event-ticket-payment-hero-20260617-v1.webp`
- **Save location:** `apps/mini-program/src/assets/ceremony/`
- **Source PNG:** `apps/mini-program/assets-source/lovart/registration flow/lovart-event-ticket-payment-hero-20260617-v1.png`
- **Lazy loading:** No — this hero is the first thing the user sees on the payment page, so it should be available quickly (but it is a CDN asset, not bundled)
- **Subtarget:** main package (event-ticket-payment is in the main package)
- **CDN path:** `/assets/ceremony/lovart-event-ticket-payment-hero-20260617-v1.webp`

## Review Checklist
- [ ] Brand colors match JoyJoin palette exactly
- [ ] Corgi personality is playful and energetic
- [ ] No text or watermarks on the art
- [ ] Bottom 25% is light/quiet enough for overlaid title text
- [ ] Soft, rounded, warm emotional tone
- [ ] Export includes WebP + PNG
- [ ] File size under ~120 KB WebP at 2x

## Downstream handoff
- **frontend-component-architecture:** Wire into `apps/mini-program/src/pages/event-ticket-payment/index.tsx` as `TICKET_HERO_FALLBACK` / primary banner source.
- **wow-elements:** Pair with the page entrance fade-in; hero banner can have a subtle scale-in on first mount (already guarded by reduced-motion and device tier).
