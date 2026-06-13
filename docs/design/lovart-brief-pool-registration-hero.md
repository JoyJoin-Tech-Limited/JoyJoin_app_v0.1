# Lovart Brief — Pool Registration Step 0 Hero

## Asset purpose
Invitation-card hero illustration for the pool-registration Step 0 ceremony. It should feel like receiving a hand-crafted event invitation, not a generic listing thumbnail.

## Deliverables
Two 750 × 560 px hero illustrations, exported as WebP (≈25 KB each):

- `lovart-pool-registration-hero-dining-20260613-v1.webp`
- `lovart-pool-registration-hero-drinks-20260613-v1.webp`

## Art direction
- Style: soft 3D/painterly illustration, warm studio lighting, shallow depth of field.
- Mood: anticipation, warmth, a little premium but never stiff.
- Color palette: anchored by JoyJoin brand primaries (coral/orange warmth) with cream and muted gold accents. No neon, no corporate blue.
- Composition: left/center negative space reserved for glass meta pills; focal object slightly right of center.

### Dining variant (`饭局`)
- A round wooden table with warm overhead light, empty wine/water glasses, a small vase, folded napkins, and gentle bokeh in the background suggesting a private room.
- Avoid showing full faces; hands or silhouettes only if needed.

### Drinks variant (`酒局`)
- A low bar/counter scene with amber bottles, cocktail glasses catching light, soft neon-free atmosphere, intimate grouping of stools.
- Same faceless rule.

## Technical constraints
- Aspect ratio: 750 × 560 (≈ 4:3).
- No text, logos, watermarks, or date labels on the art.
- Safe zone: keep the left 40 % relatively clean so the scrim + meta pills remain readable.
- Export: WebP, quality ~85, file size target ≤ 30 KB.

## Fallback
If the hero image fails to load, the component renders a CSS aurora gradient so the page never looks broken.

## Local path
`apps/mini-program/src/assets/ceremony/pool-registration/`

## Build wiring
`apps/mini-program/config/index.ts` copies `src/assets/ceremony/pool-registration` to `dist/assets/ceremony/pool-registration/` so the heroes survive the `clean:cdn-assets` step.
