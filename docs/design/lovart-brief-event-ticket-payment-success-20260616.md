# Lovart Design Brief: Event Ticket Payment Success Hero

> **Superseded by [`lovart-brief-event-ticket-payment-success-v2-20260701.md`](./lovart-brief-event-ticket-payment-success-v2-20260701.md)** (2026-07-01). The v1 Corgi-only asset and dimensions below are retained for historical reference only; the active implementation uses `eventTicketSuccessV2`.

## Goal
Create a full-bleed ceremony illustration for the WeChat Mini Program event-ticket payment success screen, making the "报名成功！" moment feel warm, celebratory, and distinctly JoyJoin.

## Brand Parameters
- **Primary color:** Vibrant Purple `#8B5CF6` (accent lights, confetti, ticket ribbon)
- **Secondary color:** Warm Coral `#FF9B85` (highlights, sparks, emotional peak)
- **Background:** Warm Beige `#F5F1E8` with soft textured grain wash
- **Mascot:** 社牛柯基 (Corgi) — playful, energetic, optimistic — jumping or cheering while holding a golden event ticket
- **Typography feel:** Rounded Chinese display (AlimamaFangYuanTiVF feel), soft geometric English (Quicksand feel); text is overlaid in code, so keep illustration text-free
- **Visual tone:** warm / cute / rounded / soft / lively / minimal / refined / breathable

## Asset Specifications
- **Type:** mascot-illustration
- **Platform:** mini-program
- **Dimensions:** 750 x 600 px
- **Aspect ratio:** 5:4
- **Export format:** WebP primary + PNG fallback
- **Minimum resolution:** 2x for retina

## Style Reference
Upload these reference images to Lovart ChatCanvas before generating:
1. **Primary character lock:** `tmp/xiaoyue-reference-grid.webp` — canonical Xiaoyue / 悦仔 model (purple hoodie, sunglasses, watch, chain, circular vignette, 16 expressions). Use this to keep the Corgi mascot on-model and in the same low-poly geometric painterly family.
2. **Primary style lock:** `apps/mini-program/src/assets/ceremony/welcome-back-hero-20260604-v1.webp` — best single-asset example of JoyJoin low-poly geometric painterly style, warm palette with controlled purple/coral accents, minimal outlines, and atmospheric grain.

## Prompt Draft
> A warm, celebratory JoyJoin ceremony scene. In the center, the playful Corgi mascot (社牛柯基) jumps joyfully with both paws holding a golden event ticket that emits a soft glow. Small confetti, paper streamers, and tiny sparkles float around. The background is a breathable Warm Beige `#F5F1E8` textured wash with subtle grain. Key accents in Vibrant Purple `#8B5CF6` and Warm Coral `#FF9B85` appear on the ticket ribbon, confetti, and glow. Style: 2D digital illustration with low-poly / geometric faceted aesthetic, painterly textured rendering with soft brushed feel within each facet, soft gradients within polygonal facets, minimal or no outlines, atmospheric background with grain. Circular vignette feel around the mascot, centered composition, generous negative space. Natural warm palette with controlled purple accent. No text, no watermarks, no photorealism.

## Export Requirements
- **File naming:** `lovart-ceremony-event-ticket-success-20260616-v1.webp`
- **Save location:** `apps/mini-program/src/assets/ceremony/`
- **Lazy loading:** Yes — loaded only on success screen
- **Subtarget:** main bundle or pool-registration subpackage
- **CDN path:** `/assets/ceremony/lovart-ceremony-event-ticket-success-20260616-v1.webp`

## Review Checklist
- [ ] Brand colors match JoyJoin palette exactly
- [ ] Corgi personality is playful and energetic
- [ ] No text or watermarks on the art
- [ ] Soft, rounded, warm emotional tone
- [ ] Export includes WebP + PNG
- [ ] File size under ~120 KB WebP at 2x

## Downstream handoff
- **frontend-component-architecture:** Wire into `apps/mini-program/src/pages/event-ticket-payment/index.tsx` success state (around line 323).
- **wow-elements:** Pair with the existing CSS checkmark animation; hero appears above the checkmark or replaces it.

## Implementation Update (2026-07-01)
A warmer rework (`eventTicketSuccessV2`) is now wired into the success state.
- **New asset:** `event-ticket-success-20260701-v2.webp` + `.png` fallback under `/assets/ceremony/`.
- **Integration:** full-bleed hero at `width: 100%` with `mode='widthFix'`, page background `#F5F1E8` (`$color-bg-warm-to`), and a CSS `linear-gradient` bridge (transparent → `#F5F1E8`) over the hero bottom edge. No blur / backdrop-filter.
- **Motion:** stagger entrance for hero (0 ms), title/subtitle (150 ms), event chip (250 ms), CTA (350 ms) using only `opacity` + `transform` with `cubic-bezier(0.22, 1, 0.36, 1)`; total ≤ 900 ms. One-shot confetti (≤ 16 pieces, 2–2.5 s) is gated by OS reduced-motion and `useDeviceTier().isDegradation`.
- **Copy:** state-aware subtitle that switches on pool `matching` status, using `DEFAULT_MASCOT_DISPLAY_NAME` instead of hardcoded "悦仔".
