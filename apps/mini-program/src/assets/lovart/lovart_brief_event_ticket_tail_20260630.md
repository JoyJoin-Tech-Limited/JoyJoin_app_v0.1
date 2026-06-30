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
- Type: decorative tail / stamp illustration
- Platform: WeChat Mini Program (Taro)
- Dimensions: 400 × 200 px (delivers 2×/3× for ~200rpx target width)
- Aspect ratio: 2:1 horizontal
- Export format: WebP, q=55–65
- Minimum resolution: 2×

## Prompt Draft

Create a small, warm horizontal vignette for the bottom of a social event ticket card. The scene should feel like a friendly "ticket tail" stamp — a cozy miniature moment that reinforces the event type and lets the corgi host make a playful cameo.

**饭局 / dining variant:**
A soft, rounded dinner-table vignette: a few cute dishes, a pair of chopsticks, a small bowl of rice, warm candlelight glow, maybe a tiny napkin or garnish. The corgi host is playfully integrated — for example: peeking over the edge of the table, holding up a tiny topic card, or sitting on a stool at the corner of the table looking curious and welcoming.

**酒局 / drinks variant:**
A relaxed drinks vignette: a couple of elegant glasses, a small bottle or coaster, subtle bubbles or light reflections, warm bar lighting. The corgi host is playfully integrated — for example: sitting on a tiny bar stool, raising a small glass, peeking from behind a bottle, or holding a cocktail stirrer.

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
- Keep the corgi size around 25–30% of the frame area.
- The corgi should interact with the scene naturally (holding a prop, peeking, sitting).
- Match the same low-poly painterly style as the rest of the scene.
- Corgi expression: curious, welcoming, slightly excited.

The focal point of the scene should still read as "dining" or "drinks" first; the corgi host adds the JoyJoin icebreaker personality. Transparent or white-safe edges so it floats cleanly on a white card background. The two variants should feel like siblings — same lighting, same softness, same world as the existing corgi ceremony hero.

## Export Requirements
- File naming:
  - `lovart-event-ticket-tail-dining-20260630-v1.webp`
  - `lovart-event-ticket-tail-drinks-20260630-v1.webp`
- Save location: `apps/mini-program/src/assets/lovart/` then uploaded to CDN via `cdn-asset-manifest.json`
- Lazy loading: No — rendered eagerly below the fold inside the ticket card
- Subpackage: Main bundle reference, asset served from CDN

## Code Handoff Notes
- Target usage: inside `.ticket-card` bottom area, replacing the barcode decoration when the event type is known and the device is not degradation-tier
- Target rendered size: 240rpx wide (asset is 500×250 to give ~2× resolution)
- Use `<Image mode='widthFix'>` with `height: auto` and `aspect-ratio: 500 / 250` to reserve the footprint before decode
- Wrap in `aria-hidden='true'` — purely decorative
- Fallback: barcode decoration on `onError`; skip entirely on degradation-tier devices
- Fade-in animation on load, suppressed under `prefers-reduced-motion`

## Review Checklist
- [ ] Brand colors match JoyJoin palette exactly
- [ ] No text overlays or watermarks
- [ ] Event type reads clearly at ~240rpx width
- [ ] Corgi host is playful but does not steal the scene
- [ ] Transparent / white-safe edges
- [ ] WebP export under ~25KB each
- [ ] Both dining and drinks variants feel like a matched pair
- [ ] Anti-generic test: could this illustration appear in a generic app? If yes, iterate.

## Shipped Revision (2026-06-30)
- Mascot: switched from Xiaoyue to the corgi host to match the existing ticket ceremony hero and avoid two different mascots on the same card.
- Dimensions: 500 × 250 px (renders at 240rpx wide).
- Final file sizes: dining ~17 KB, drinks ~25 KB.
- Implementation: `apps/mini-program/src/lib/eventTicketTailAssets.ts` resolves the CDN URL by event type; `apps/mini-program/src/pages/event-ticket-payment/index.tsx` renders the illustration with `onError` fallback to the barcode decoration and degradation-tier gating.
