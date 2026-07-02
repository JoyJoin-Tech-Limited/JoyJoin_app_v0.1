# Lovart Brief — Pool Registration Step 0 Hero

## Asset purpose
Invitation-card hero illustration for the pool-registration Step 0 ceremony. It should feel like receiving a hand-crafted event invitation, not a generic listing thumbnail.
## Deliverables

Two 750 × 560 px hero illustrations, exported as WebP (≈25–40 KB each):

- `lovart-pool-registration-hero-dining-20260702-v2.webp`
- `lovart-pool-registration-hero-drinks-20260702-v2.webp`

PNG runtime fallbacks and subpackage copies are also produced from the same source.

## Art direction
- Style: soft 3D/painterly illustration, warm studio lighting, shallow depth of field.
- Mood: anticipation, warmth, a little premium but never stiff.
- Color palette: anchored by JoyJoin brand primaries (coral/orange warmth) with cream and muted gold accents. No neon, no corporate blue.
- Composition: left/center negative space reserved for glass meta pills; focal object slightly right of center. The updated v2 art preserves the corgi/invitation-card mascot clearly and leaves readable negative space for the meta pills.

### Dining variant (`饭局`)
- A round wooden table with warm overhead light, empty wine/water glasses, a small vase, folded napkins, and gentle bokeh in the background suggesting a private room.
- The corgi/invitation-card element should be readable, not cropped by the frame.
- Avoid showing full faces; hands or silhouettes only if needed.

### Drinks variant (`酒局`)
- A low bar/counter scene with amber bottles, cocktail glasses catching light, soft neon-free atmosphere, intimate grouping of stools.
- Same faceless rule and mascot readability rule.

## Technical constraints
- Aspect ratio: 750 × 560 (≈ 4:3).
- No text, logos, watermarks, or date labels on the art.
- Safe zone: keep the left 40 % relatively clean so the scrim + meta pills remain readable.
- Export: WebP, quality ~85, file size target ≤ 30 KB.

## Fallback
If the hero image fails to load, the component renders a CSS aurora gradient so the page never looks broken.

## Local paths

- CDN source (uploaded to CDN, not bundled in main package): `apps/mini-program/src/assets/ceremony/`
- Main-package local fallback (survives `clean:cdn-assets`): copied to `dist/assets/pool-heroes/`
- Subpackage fallback (for offline resilience): `apps/mini-program/src/pages/pool-registration/assets/ceremony/`

## Build wiring

`apps/mini-program/config/index.ts` copies the ceremony hero files to `dist/assets/pool-heroes/` so they survive the `clean:cdn-assets` step, which wipes the `dist/assets/ceremony/` CDN-source directory. The subpackage copy is also registered in `apps/mini-program/scripts/cdn-asset-manifest.json` for completeness. The `PersonaSnapshotCard` particle set (`lovart-particle-*`) is CDN-only with subpackage fallback under `pages/pool-registration/assets/pool-persona/`.
