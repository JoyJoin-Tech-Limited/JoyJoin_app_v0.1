# Lovart Brief — Landing "Blind-box City" Hero Series (2026-07-26)

> Status: **pending generation**. The Lovart MCP bridge was broken on 2026-07-26
> (Playwright sync/async error), so this brief is written for manual execution
> in Lovart.ai. Code is already wired to the paths in §4 — once the assets are
> generated, converted, and uploaded, the landing lights up with zero code
> changes (the bundled mascot fallback covers the gap until then).

## 0. Context

The mini-program landing screen is repositioned from "personality-test entry"
to **盲盒城市体验平台** (blind-box city experience platform). First-screen
fantasy: a glowing blind box floating in dusk light, city elements drifting
out of it, Xiaoyue (悦仔, our corgi mascot) peeking from behind the box.

- **Style:** 3D clay toy render, Pop-Mart blind-box quality. This is an
  **authorized exception** to the brand's 2D low-poly style lock — see
  `.github/skills/joyjoin-brand-guidelines/references/mascots-and-illustration.md`.
- **Palette:** brand purple `#8B5CF6`, warm cream `#FFFAF4`, dusk lavender
  ambient; golden glow `#FDE68A` → `#FBBF24` → `#F0A030`.
- **Hard rules:** no text/letters/numbers/logos/watermarks anywhere in any
  image; no photorealism; no dark moody night; no extra characters; Xiaoyue's
  identity anchors must survive 3D translation.
- **Generation order:** master composite FIRST (style anchor), then the 5
  sprites **in the same Lovart session** ("same series as the previous image")
  so lighting and material stay consistent. Generate 2 variants of the master
  and pick the stronger one before continuing.

## 1. Xiaoyue identity anchors (red lines for any style translation)

1. Pembroke Welsh Corgi — warm orange-tan + cream-white fur; white blaze from
   nose bridge to forehead; white muzzle, cheeks and chest.
2. Oversized upright pointed ears — tan outside, soft pink-cream inside,
   perked forward.
3. Large round glossy dark-brown eyes with bright catchlights.
4. Black oval nose; small open smile with a hint of pink tongue.
5. Brand-purple `#8B5CF6` matte clay hoodie with white drawstrings — **no text
   on the hoodie** (existing 2D assets carry a "joyjoin" wordmark; it must be
   removed here).
6. Round dark sunglasses with thin frames hanging at the collar — a strong
   recognition anchor, must be kept.

## 2. Master composite prompt (paste into Lovart)

> **A/B protocol (2026-07-26):** generate BOTH candidate A (3D clay, §2a) and
> candidate B (2D brand illustration, §2b) — same scene, same composition. The
> code, layout, motion, and sprite slots are style-agnostic; the winner is
> chosen by side-by-side review against the §5b rubric (rows 5/10 are the
> discriminators: material craft, handmade feel). If B wins, the 3D exception
> in the brand-guidelines skill is reverted and sprites are generated in 2D.

### 2a. Candidate A — 3D clay (anti-slop reinforced)

> Anti-slop defenses are baked directly into the prompt (2026-07-26 revision):
> pseudo-text, waxy material, dead eyes, extra limbs, neon palette, horror
> uplight, and confetti slop are each killed by an explicit line. Do not delete
> the "Never" block or soften the style lock when iterating.

```
Brand system (JoyJoin — "Blind-box City" landing series, authorized 3D clay exception):
- Brand purple #8B5CF6 (box body, hoodie), warm cream #FFFAF4, soft dusk lavender ambient
- Golden glow: hot core #FDE68A, main gold #FBBF24, outer amber #F0A030

Never (anti-slop red lines):
- any text, letters, numbers, logos, watermarks, symbols, embossed marks, printed
  patterns or pseudo-glyphs anywhere — every surface stays blank (ribbon, cards,
  dice faces have only the stated pips)
- photorealism, dark moody night scenes, extra characters, neon colors
- glossy varnish, plastic sheen, airbrushed smoothness, greasy specular highlights
- blank glassy stare, dead eyes, asymmetric or void-black eyes
- extra limbs, melted geometry, fused or doubled ears, broken anatomy
- confetti, rainbow accents, random sparkles or extra decorative elements

Style lock (MANDATORY, same for the whole series):
- 3D clay toy render, Pop-Mart blind-box quality: matte polymer-clay surfaces with
  subtle fingerprint texture and micro imperfections, soft fingerprint-soft edges,
  miniature collectible figurine feel
- It must read as a product photograph of a real handcrafted desk toy in a
  photographer's lightbox — slight hand-sculpted asymmetry, NOT a digital render
- Soft diffused studio lighting, gentle subsurface softness, no harsh speculars
- Crisp focus across the whole figurine (clean cutout for compositing)
- Muted, desaturated matte finish: the purple reads dusty #8B5CF6 (never neon
  violet); the gold is soft warm candlelight (never radioactive yellow)

Scene:
- A brand-purple matte clay gift box (rounded corners, slightly darker purple base,
  plain cream-gold satin ribbon with NO pattern, lid ajar and tilted open) sits
  center-left, occupying x 22–62% and y 52–88% of the canvas. Warm golden light
  bursts softly from the lid seam — the box is the ONLY light source in the scene.
- Xiaoyue, a Pembroke Welsh Corgi clay figurine, peeks half her head from behind
  the box's upper edge (the box cleanly occludes her neck and chest). She wears a
  plain matte clay hoodie in brand purple #8B5CF6 with white drawstrings —
  absolutely no text on the hoodie — and round dark sunglasses with thin frames
  hanging at the collar. Corgi anchors: warm orange-tan and cream-white fur, white
  blaze from nose bridge to forehead, white muzzle and cheeks, exactly two oversized
  upright pointed ears (tan outside, soft pink-cream inside, perked forward), large
  round glossy dark-brown eyes — each with exactly two bright catchlights at the
  upper left, lively and curious, not a blank stare — black oval nose, small open
  smile with a hint of pink tongue. Expression: curious and expectant, eyes looking
  toward the golden glow and slightly upward, gentle head tilt. Anatomically
  correct: exactly two ears, at most two visible front paws, no extra limbs.
- Lighting logic: soft candlelight-like warm gold from the box mouth kisses her
  cheek, chin and ear rims (warm golden rim light) — cozy, NOT horror uplight, no
  harsh under-shadows on the face. Cool dusk-lavender ambient fill from the upper
  back-left; shadow sides read as soft lavender dusk. One consistent light logic —
  shadows fall only away from the box.
- 2–3 tiny clay light motes float just above the lid seam — nothing else floats.
  One soft contact shadow under the box. No ground plane, no horizon, no
  environment geometry.
- Background: FULLY TRANSPARENT. The golden glow must fall off to zero alpha well
  before the canvas edges. Keep the upper 30% of the canvas completely empty
  (client-side sprites will float there). Minimum 12% transparent margin on all
  sides.

Export: transparent PNG, 1440×1440 px, no text anywhere in the image.
Please give me 2 variants so I can pick the stronger one.
```

### 2b. Candidate B — 2D brand illustration (established Lovart language)

Same scene and composition as §2a, rendered in the app's existing low-poly +
painterly illustration language (oracle cards, phase bands, empty states).
Zero mascot-translation risk (Xiaoyue already lives in this style) and full
continuity with the rest of the product. Its anti-slop defense is the house
style itself: visible painterly craft beats flat-vector AI cliché.

```
Brand system (JoyJoin — landing hero, established 2D illustration language):
- Brand purple #8B5CF6 (box body, hoodie), warm cream #FFFAF4, dusk lavender ambient
- Golden glow: hot core #FDE68A, main gold #FBBF24, outer amber #F0A030

Never (anti-slop red lines):
- any text, letters, numbers, logos, watermarks, symbols, embossed marks, printed
  patterns or pseudo-glyphs anywhere — every surface stays blank (ribbon has no
  pattern, cards are plain)
- 3D render, photorealism, glossy plastic, airbrushed smoothness
- flat corporate vector look (big-head-tiny-limb "tech illustration" cliché),
  generic gradient meshes, neon colors, rainbow confetti
- dark moody night scenes, horror uplight, extra characters

Style lock (MANDATORY — JoyJoin's established Lovart illustration language):
- 2D low-poly geometric illustration: subjects built from clean polygonal facets,
  with painterly soft-brushed texture INSIDE each facet — NOT flat vector fills
- Soft gradients within facets; visible painterly grain/texture everywhere
- Warm expressions, simplified features, large expressive glossy eyes with
  bright catchlights
- It must read as a hand-crafted editorial illustration with visible craft —
  generous negative space, intentional asymmetry, no digital-render perfection

Scene:
- A brand-purple geometric-faceted gift box (rounded-silhouette, slightly darker
  purple base, plain cream-gold satin ribbon with NO pattern, lid ajar and
  tilted open) sits center-left, occupying x 22–62% and y 52–88% of the canvas.
  Warm golden light pours softly from the lid seam — painted as a textured,
  grainy wash — the box is the ONLY light source in the scene.
- Xiaoyue, a Pembroke Welsh Corgi in the same low-poly painterly style, peeks
  half her head from behind the box's upper edge (the box cleanly occludes her
  neck and chest). She wears a plain brand-purple #8B5CF6 hoodie with white
  drawstrings — absolutely no text on the hoodie — and round dark sunglasses
  with thin frames hanging at the collar. Corgi anchors: warm orange-tan and
  cream-white fur, white blaze from nose bridge to forehead, white muzzle and
  cheeks, exactly two oversized upright pointed ears (tan outside, soft
  pink-cream inside, perked forward), large round glossy dark-brown eyes with
  bright catchlights (lively and curious, not a blank stare), black oval nose,
  small open smile with a hint of pink tongue. Expression: curious and
  expectant, eyes toward the golden glow and slightly upward, gentle head tilt.
- Lighting logic: the golden wash from the box mouth warms her cheek, chin and
  ear rims — cozy candlelight feel, NOT horror uplight, no harsh under-shadows.
  Cool dusk-lavender ambient on the shadow sides. One consistent light logic.
- 2–3 tiny light motes float just above the lid seam — nothing else floats.
  One soft painted contact shadow under the box. No ground plane, no horizon.
- Background: FULLY TRANSPARENT (texture lives inside the painted shapes, not
  on the canvas). The golden glow must fall off to zero alpha well before the
  canvas edges. Keep the upper 30% of the canvas completely empty (client-side
  sprites will float there). Minimum 12% transparent margin on all sides.

Export: transparent PNG, 1440×1440 px, no text anywhere in the image.
Please give me 2 variants so I can pick the stronger one.
```

### 2c. Decision rule

1. Generate A and B masters (2 variants each) — four images total, one session
   per candidate for internal consistency.
2. Side-by-side review: user eyeball vote + agent §5b rubric scoring. Rows 5
   (material craft) and 10 (handmade feel) discriminate the styles; rows 1–4
   (text, anchors, anatomy, light logic) must be clean on BOTH.
3. Winner locked → generate the 5 sprites in the same session as the winning
   master, using the §3 shared block (2D or 3D variant to match).
4. If B wins: revert the 3D exception paragraph in the brand-guidelines skill
   (both `.github/skills/` and `.agents/skills/` mirrors) — one small edit.

## 3. Sprite prompts (same session, after the master is locked)

> **Candidate B (2D illustration) won the A/B on 2026-07-26** (user + agent
> review of 4 masters: 1× 3D clay vs 3× 2D low-poly). Use §3b. §3a is kept for
> the record only. Winning master: the "chin-on-rim upward gaze" variant —
> picked for emotion fit (curious anticipation, the "它也好奇" mirror), clean
> above-rim head geometry for the `hero-peek` clip-path, upper-40% empty float
> zone, and zero mascot-translation risk. Known fixes at conversion time:
> purple is too royal (pull −15% sat toward dusty #8B5CF6), glow core slightly
> blown (compress highlights).

### 3a. Shared block — 3D clay variant (record only, not used)

```
[Same brand block + style lock as the previous image — same series]

Shared rules for this sprite set (anti-slop):
- Transparent background, ONE object group per image, centered, 10% margin
- Same matte clay material with subtle fingerprint texture as the gift-box scene —
  no glossy varnish, no plastic sheen, no airbrushed smoothness
- Lighting: warm golden key light from the LEFT and slightly below (the glowing
  box mouth), plus a soft cool studio fill from the upper left; lavender dusk
  ambient in the shadows — exactly matching the main scene, one shadow direction
- Absolutely blank surfaces: no text, letters, numbers, card suits, symbols,
  embossed marks, printed patterns or pseudo-glyphs anywhere
- Muted desaturated colors — no neon, no rainbow accents, no random sparkles
- Gentle floating pose with a slight tilt, as if just drifted up out of the box
- Crisp focus (clean cutout), solid single connected geometry — no melted or
  fragmented shapes
```

### 3b. Shared block — 2D illustration variant (ACTIVE)

```
[Same brand block + 2D illustration style lock as the previous image — same series]

Shared rules for this sprite set (anti-slop):
- Transparent background, ONE object group per image, centered, 10% margin
- Same low-poly geometric illustration style with painterly texture inside each
  facet as the gift-box scene — NOT flat vector fills, NOT 3D render
- Lighting: warm golden light from the LEFT and slightly below (the glowing box
  mouth) painted into each object; dusk-lavender shadow sides — exactly matching
  the main scene, one light logic
- Absolutely blank surfaces: no text, letters, numbers, card suits, symbols,
  embossed marks, printed patterns or pseudo-glyphs anywhere
- Muted warm palette consistent with the main scene — no neon, no rainbow
- Gentle floating pose with a slight tilt, as if just drifted up out of the box
- Clean silhouette edges (transparent cutout), solid connected shapes
```

1. **dice** — a pair of warm-cream dice in the same low-poly painterly style,
   soft pink recessed pips (dots only, no numerals), mid-tumble, one die tilted
   12°, one tiny golden sparkle facet at a corner. 512×512.
2. **cards** — three fanned playing cards in the same low-poly painterly style,
   completely blank cream faces with a faint lavender edge tint, slight -10° fan
   tilt, soft golden light catching the left edges. 512×512.
3. **glass** — a small coupe glass in the same low-poly painterly style, warm
   amber liquid inside, gentle golden highlight on the left wall of the glass,
   8° playful tilt. 512×512.
4. **buildings** — a cluster of three miniature city towers in the same low-poly
   painterly style, rounded silhouettes (cream, pale lavender, pale pink), a few
   tiny warm golden lit-window DOTS (no symbols, no signs), staggered heights,
   reading as a cozy pocket city. 640×400.
5. **map pin** — one rounded map pin in the same low-poly painterly style, brand
   purple #8B5CF6 body with a cream center dot, soft golden rim light on the
   left, slight -4° tilt. 512×512.

## 4. Delivery checklist

| Step | Action |
|---|---|
| Review | Zero text in every image; Xiaoyue's 6 anchors intact; glow falls to alpha 0 before canvas edges; upper 30% of master is empty |
| Convert | PNG → WebP q80 with alpha (pattern: `scripts/optimize-ceremony-batch-c.mjs`); also derive the 48×48 blurred LQIP from the master |
| Name/place | `apps/mini-program/src/assets/lovart/landing/` — `hero-box-xiaoyue-dusk.webp` (≤240KB), `hero-box-xiaoyue-dusk-lqip.webp` (≤6KB), `sprite-dice.webp` / `sprite-cards.webp` / `sprite-glass.webp` / `sprite-map-pin.webp` (≤30KB each), `sprite-buildings.webp` (≤36KB) |
| Register | Move the 7 paths from `pendingAssets` to `assets[]` in `apps/mini-program/scripts/cdn-asset-manifest.json` (already registered as pending on 2026-07-26) |
| Upload | `gh workflow run "Upload CDN Assets"` (production `/var/www/cdn`) |
| Calibrate | Re-measure the box-rim position (% of canvas height) in the shipped master and update `hero-peek`'s `from` inset in `apps/mini-program/src/pages/index/index.scss` (currently 52% placeholder, marked CALIBRATION PENDING FINAL ART) |

## 5. Anti-AI-slop acceptance gate (two layers)

The prompts carry the prevention (§2/§3 "Never" blocks); this gate is the
verification. **Both layers must pass before conversion/upload.**

### 5a. Programmatic gate (objective)

```bash
npm run check:landing-hero-assets -w mini-program          # default dir: src/assets/lovart/landing/
npm run check:landing-hero-assets -w mini-program -- --dir ~/Downloads/lovart-landing   # raw PNGs anywhere
```

Checks: exact canvas sizes · alpha channel present · glow/art decays to
alpha≈0 in the outer 8px ring (no hard cutoffs) · master's upper 30% empty ·
mean saturation in [0.12, 0.75] · ≤1% neon pixels (S>0.95 & L>0.6) · brand
purple family present in master · WebP weight budgets. Missing files = FAIL.

### 5b. Vision rubric (subjective slop review)

Applied by the agent via `ReadMediaFile` (or by a human reviewer) — score each
row 0 (slop) / 1 (acceptable) / 2 (crafted). **Ship threshold: ≥16/20 AND no
zero in any red-line row.** One retry loop per failed row uses the re-prompt
phrase below; two consecutive failures on the same row → regenerate from the
master with a fresh seed rather than patching.

| # | Check (red lines **bold**) | Slop tell | Re-prompt phrase to add |
|---|---|---|---|
| 1 | **Zero text / pseudo-glyphs** (ribbon, cards, hoodie, windows) | Gibberish glyphs, fake logos, embossed marks | "absolutely blank surfaces, no embossed marks, no symbols" |
| 2 | **Xiaoyue anchors** (fur/blaze/ears/eyes/hoodie/sunglasses) | Wrong eye color, missing blaze, merged ears, dropped sunglasses | regenerate; anchors are non-negotiable |
| 3 | **Anatomy** (2 ears, ≤2 visible paws, clean box occlusion) | Extra limbs, melted geometry, fused ears | "anatomically correct corgi figurine, exactly two ears, no extra limbs" |
| 4 | **One light logic** (shadows fall only away from the box) | Second shadow direction, horror under-shadows | "one consistent light logic — shadows fall only away from the box" |
| 5 | Material: matte clay with micro-texture | Waxy/greasy/plastic sheen, airbrushed smoothness | "matte polymer clay with subtle fingerprint texture, no glossy varnish, no specular highlights" |
| 6 | Eyes are alive (2 catchlights upper-left each) | Blank glassy stare, void-black eyes | "large glossy dark-brown eyes, exactly two bright catchlights each, lively curious gaze" |
| 7 | Palette discipline (dusty purple, candlelight gold) | Neon violet, radioactive yellow, rainbow accents | "muted desaturated matte finish, dusty #8B5CF6, soft warm candlelight gold" |
| 8 | Composition breathes (upper 30% empty, margins held) | Edge-hugging glow, centered mugshot, clutter | "glow fades to transparent well before canvas edges; keep generous negative space" |
| 9 | Cross-asset unity (sprites = same world as master) | Different clay thickness/light/saturation across files | "same series as the previous image, identical material and lighting" |
| 10 | Handcrafted feel (slight asymmetry, real-toy photo) | Digital-render perfection, CGI look | "product photograph of a real handcrafted desk toy, slight hand-sculpted asymmetry" |

## 6. Acceptance checklist (per asset)

- Transparent background, no fringing/halo artifacts
- Size/weight budgets met (§4)
- Zero text, zero logos
- Light direction matches the master (golden key from left-and-below)
- Clay material reads as the same family as the master
- Renders cleanly over the CSS dusk gradient (no visible seams)
- §5a programmatic gate PASS + §5b rubric ≥16/20 with no red-line zero
