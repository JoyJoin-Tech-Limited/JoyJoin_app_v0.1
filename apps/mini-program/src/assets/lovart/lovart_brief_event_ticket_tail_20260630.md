# Lovart Design Brief: Event Ticket Tail Illustration (Playful Corgi Host)

## Goal
Create a pair of small, event-type-specific "ticket tail" illustrations for the bottom of the event-ticket payment card. The tail should reinforce the event type (饭局 / 酒局) and JoyJoin's signature social-icebreaker experience by letting the event host corgi (matching the existing ceremony hero banner) playfully appear inside the scene — without competing with the existing ceremony hero banner above.

## Brand Parameters
- Primary color: Vibrant Purple #8B5CF6 (small accents only)
- Secondary color: Warm Coral #FF9B85 (warm highlights)
- Background: transparent / warm-safe edges (sits on a white card surface)
- Visual tone: warm, cute, rounded, soft, lively, minimal, refined, breathable
- Mascot: Corgi host — the same archetype hero character used in the ticket banner (`lovart-event-ticket-payment-hero-20260617-v1.webp`)
- Typography feel: not applicable — no text in the illustration

## Asset Specifications
- Type: decorative full-bleed ticket footer vignette
- Platform: WeChat Mini Program (Taro)
- Dimensions: 750 × 280 px (full card width; ~37% card aspect)
- Aspect ratio: ~2.68:1 horizontal
- Export format: WebP, q=75–85
- Minimum resolution: 1× (delivers 2× on 375 px-wide devices)
- File size: ≤ 40 KB each

## Prompt Draft

Create a full-bleed horizontal footer vignette for the bottom of a social event ticket card. The scene should feel like ink printed on the ticket paper itself — a cozy miniature moment that reinforces the event type without looking like a pasted sticker.

**Layout intent:**
- The illustration spans the full width of the white ticket card.
- The top ~80–100 px of the asset should dissolve into the card background (either transparent with a CSS fade overlay, or a soft white-safe gradient baked into the asset).
- The focal scene sits in the lower two-thirds of the frame.
- No hard rectangular boundary; the vignette should feel like a printed finish, not a floating image.

**饭局 / dining variant:**
A soft, rounded dinner-table vignette: a few cute dishes, a pair of chopsticks, a small bowl of rice, warm candlelight glow, maybe a tiny napkin or garnish. The corgi host is playfully integrated — for example: peeking over the edge of the table, holding up a tiny topic card, or sitting on a stool at the corner of the table looking curious and welcoming. The scene should feel grounded at the bottom of the ticket.

**酒局 / drinks variant:**
A relaxed drinks vignette: a couple of elegant glasses, a small bottle or coaster, subtle bubbles or light reflections, warm bar lighting. The corgi host is playfully integrated — for example: sitting on a tiny bar stool, raising a small glass, peeking from behind a bottle, or holding a cocktail stirrer. Same grounded, full-width treatment.

**Style lock (must follow):**
- 2D digital illustration with low-poly / geometric faceted aesthetic
- Painterly, textured rendering with soft brushed feel within each facet
- Soft gradients within polygonal facets, no flat vector
- Minimal or no outlines — facet edges define form
- Atmospheric textured background with subtle grain/noise
- Warm natural palette; use Vibrant Purple #8B5CF6 only for tiny accents
- Rounded, soft, cute but tasteful — not childish
- No text, no watermarks, no photorealism, no harsh contrasts

**Corgi host integration rules:**
- The corgi host should be clearly present and playful, but not the only focal point.
- Keep the corgi size around 15–20% of the frame area (smaller than in the centered v1 stamp, because the banner above already carries the hero corgi).
- The corgi should interact with the scene naturally (holding a prop, peeking, sitting).
- Match the same low-poly painterly style as the rest of the scene.
- Corgi expression: curious, welcoming, slightly excited.

The focal point of the scene should still read as "dining" or "drinks" first; the corgi host adds the JoyJoin icebreaker personality. The top edge should fade cleanly into the white card surface so the vignette looks printed, not pasted. The two variants should feel like siblings — same lighting, same softness, same world as the existing corgi ceremony hero.

## Export Requirements
- File naming:
  - `lovart-event-ticket-tail-dining-20260630-v2.webp`
  - `lovart-event-ticket-tail-drinks-20260630-v2.webp`
- Save location: `apps/mini-program/src/assets/lovart/` then uploaded to CDN via `cdn-asset-manifest.json`
- Lazy loading: No — rendered eagerly below the fold inside the ticket card
- Subpackage: Main bundle reference, asset served from CDN

## Code Handoff Notes
- Target usage: inside `.ticket-card` bottom area as a full-bleed footer vignette, replacing the barcode decoration when the event type is known and the device is not degradation-tier
- Target rendered size: 750rpx × 280rpx (full card width), achieved by `width: calc(100% + 64rpx); margin-left: -32rpx` so the asset bleeds to the card edges and is clipped by the card's `overflow: hidden` + `border-radius`
- Use `<Image mode='aspectFill'>` with `width: 100%; height: 100%` so the asset crops gracefully to the card width
- Layer a CSS fade overlay (`ticket-card__tail-fade`) at the top of the footer to dissolve the illustration into the white card body
- Wrap in `aria-hidden='true'` — purely decorative
- Fallback: barcode decoration on `onError` or after a 4s load timeout; skip entirely on degradation-tier devices
- Fade-in animation on load uses brand motion curve `cubic-bezier(0.22, 1, 0.36, 1)`, suppressed under `prefers-reduced-motion`
- Analytics: `ticket_tail_image_impression` fires only after successful `onLoad`; `ticket_tail_image_load_error` fires on `onError` or timeout

## Review Checklist
- [ ] Brand colors match JoyJoin palette exactly
- [ ] No text overlays or watermarks
- [ ] Event type reads clearly at full card width
- [ ] Corgi host is playful but does not steal the scene
- [ ] Top edge dissolves cleanly into the white card (transparent or white-safe fade)
- [ ] WebP export under ~40KB each
- [ ] Both dining and drinks variants feel like a matched pair
- [ ] Anti-generic test: could this illustration appear in a generic app? If yes, iterate.

## Shipped Revision (2026-06-30)
- Mascot: switched from Xiaoyue to the corgi host to match the existing ticket ceremony hero and avoid two different mascots on the same card.
- Layout treatment: full-bleed footer vignette inside the ticket card (750 × 280 px), replacing the previous centered 240rpx stamp.
- Dimensions: 750 × 280 px (full card width × ~37% height).
- Final file sizes: dining ~21 KB, drinks ~20 KB (v2 assets converted from source PNGs at `apps/mini-program/assets-source/lovart/registration flow/`).
- Source files:
  - `饭局票尾插画 v1.png`
  - `酒局票尾插画 v1.png`
- Implementation: `apps/mini-program/src/lib/eventTicketTailAssets.ts` resolves the CDN URL by event type; `apps/mini-program/src/pages/event-ticket-payment/index.tsx` renders the full-bleed illustration with `aspectFill`, a CSS top fade overlay, `onError` fallback to the barcode decoration, and degradation-tier gating.

## Asset Generation Note
The v2 files currently in the repo are **placeholders** produced by cropping/scaling the v1 Lovart assets to 750 × 280 px and applying a baked-in top fade. They prove the full-bleed layout and file-size budget. Before merging to `main` or uploading to production CDN, replace them with final Lovart-generated 750 × 280 px full-bleed illustrations that match this brief.
