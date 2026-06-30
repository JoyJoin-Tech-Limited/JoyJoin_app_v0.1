# Lovart Brief — 入场卡 Invitation Teaser (Card-Integrated)

## Goal
Create a subtle, card-integrated invitation illustration for the JoyJoin 入场卡 (profile-review) screen. The image should not dominate the card; it should sit quietly in the background, adding warmth and emotional texture while the Chinese copy and pulsing dot remain the heroes. Xiaoyue should feel present but not loud — like a friend sitting beside the message, not jumping in front of it.

## Asset type
Atmospheric / decorative brand illustration for a UI card surface

## Character
- **悦仔 (Xiaoyue)** — social corgi mascot, warm and optimistic
- Pose: small, partially cropped, peeking in from the left/bottom edge of the frame, or gently resting at the corner
- Expression: soft contented smile, eyes looking toward the copy area as if listening along
- Scale: no larger than roughly 40% of the frame height; the illustration should read as texture, not a hero

## Scene
- No hard background separation. The image should fade into the card background using soft, feathered edges.
- Suggest a cozy evening gathering with very subtle, low-contrast elements: rounded table edge, tiny warm lights, soft bokeh-like dots.
- Avoid a full scene or detailed environment. Keep it impressionistic and quiet.
- The right ~50% of the frame must remain visually quiet so copy can sit cleanly on top.

## Style (插画风统一)
- 2D digital illustration with low-poly / geometric faceted aesthetic
- Painterly, textured rendering with soft brushed feel within each facet
- Soft gradients within polygonal facets
- Minimal or no outlines — facet edges define form
- Atmospheric textured background with subtle grain/noise
- Generous negative space; the character should not feel centered or front-facing
- Low contrast between character and background so the image doesn't "pop" off the card

## Brand colors
Use only muted, desaturated versions of the brand palette so the illustration stays in the background:
- Muted Vibrant Purple `#C4B5FD` — Xiaoyue hoodie / small accents
- Muted Warm Coral `#FFCDBA` — tiny warm light dots, blush tones
- Warm Beige `#F5F1E8` — main background wash, should dominate
- Soft White `#FFFFFF` — tiny eye glints only
- Muted Sky Blue `#CFE0ED` — subtle cool shadow accents
- Muted Medium Gray `#C4C8CD` — soft table/environment shapes

Avoid saturated `#8B5CF6` or `#FF9B85` here; they will fight with the card's text and pulsing dot.

## Mood
Quiet, warm, slightly expectant, intimate. Like a friend left a thoughtful note on your desk. Not a party invitation, not a sales banner.

## Composition
- Aspect ratio: 4:3 (wider than tall)
- Recommended dimensions: 1200×900px
- Focal weight biased to the left 30–40% and bottom edge
- Right side and top should be mostly empty / atmospheric wash
- Soft fade to transparent or matching beige on the right edge so it can sit behind text
- No text in the illustration

## Integration constraints
- This image will be placed inside a rounded card with a warm cream-to-blush gradient background.
- It must read well when scaled down to ~176×144rpx on a 375px-wide screen.
- The card already contains: a pulsing coral dot, Chinese title/body/hint text, and a tap affordance. The illustration must not compete with any of these.
- Preferred effect: user notices the warm illustration only after reading the copy.

## Export
- PNG with transparency or matching beige matte, 1200×900px
- Also provide a 600×450px fallback preview
- File naming: `lovart-profile-review-invite-teaser-20260630-v1.png`
- WeChat mini-program surface; must compress cleanly under ~40KB as WebP

## Anti-generic test
Could this exact illustration appear in a generic dating app without modification? If yes → iterate. It should feel unmistakably JoyJoin: low-poly corgi, warm beige atmosphere, quiet intimacy.

## Downstream handoff
Frontend will convert to WebP and place in `apps/mini-program/src/assets/lovart/profile-review/invite-teaser.webp`, then add to `cdn-asset-manifest.json`. The card is built in `apps/mini-program/src/components/onboarding/ProfileReviewInviteCard.tsx` with `aspectFill` image sizing.
