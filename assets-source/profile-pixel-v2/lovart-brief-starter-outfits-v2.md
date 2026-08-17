# Lovart Brief — Starter Outfits v2 (Gender-Neutral 软萌奶油居家风)

**Date:** 2026-08-15
**Runtime manifest:** `apps/mini-program/src/assets/profile-pixel/v2/avatar-assets-v2.json`
**Target platform:** WeChat Mini-Program, CDN-hosted WebP (content-hashed)
**Source output path:** `assets-source/profile-pixel-v2/<archetype>/atlas-source.png`
**Build pipeline:** `npm run build:profile-pixel-v2 -w mini-program` (extract → build → check)

## Why

Two pieces of user feedback on the V2 pixel avatars:

1. **The default look reads male-coded.** All 12 starter outfits follow one formula — jacket / cargo / sneakers streetwear (denim jacket, military jacket, dark workwear). This limits female-vibe flexibility. There is no gender data path in code; the male read comes entirely from the outfit art, so we fix the art.
2. (Tracked separately) Bodies are 3+ heads tall and feel lanky. A render-time squash (`$pixel-avatar-squash: 0.85` in `PixelAvatarComposite.scss`) is the interim mitigation. **This brief does NOT change body proportions** — bodies stay exactly as they are. A true chibi (2–2.5头身) body re-art is a future project (Path B).

## What we need

A **new set of starter outfits** for all 12 archetypes, delivered as updated `atlas-source.png` files. The design direction is **软萌奶油居家风 (soft cream loungewear)**:

- **Formula (same for all 12):** oversized cream hoodie (top) + relaxed tapered lounge pants (bottom) + round-toe canvas slip-ons (shoes) + one soft accessory per species.
- **Gender-neutral by construction:** no cargo, no military/denim jackets, no dark workwear, no muscle-emphasizing cuts; also avoid pink-dominant or frilly reads. Rounded, slightly oversized silhouettes. The outfit should read as "cozy at home, ready to go meet friends" — matching JoyJoin's pre-event anteroom fantasy.
- **Per-species variation** comes from the accent color and the accessory, not from silhouette changes — silhouettes stay uniform so the paper-doll layers align across species.

### Palette

Brand-injected (exact hex):

- Cream hoodie body: Warm Beige `#F5F1E8` → Soft White `#FFFFFF` range
- Lounge pants: warm oatmeal / light mocha (near `#D8C2A6`–`#B49472` family), never dark navy/black
- Canvas shoes: Soft White `#FFFFFF` with Warm Coral `#FF9B85` sole accent
- Species accent (drawstrings, cuff ribbing, accessory): pick ONE per species from Warm Coral `#FF9B85`, Sky Blue `#A8C5DD`, Fresh Green `#9ACD32`, or muted Vibrant Purple `#8B5CF6` (purple sparingly)
- No pure black, no neon, no high-contrast streetwear blocking

### Style lock (mandatory — pixel art)

The bodies are **pixel art** (`image-rendering: pixelated` at runtime). Garments get machine-diffed onto the existing pixel bodies, so:

- Pixel-art rendering is **mandatory** here — the brand low-poly painterly fallback is NOT acceptable for this deliverable (it would clash with the body raster and break the diff pipeline's color scoring).
- Clean single-pixel-ish outlines consistent with the existing body art, soft 2–3 tone shading per garment region, no anti-aliased photoreal texture.
- No text, no logos, no brand marks on the clothing.

## Hard technical spec (pipeline contract — do not deviate)

Each archetype's deliverable is one `atlas-source.png`:

- **Canvas:** 1254 × 1254 px, transparent background
- **Grid:** 3 columns × 2 rows, each cell 418 × 627 px
- **Layout:**

```
[ base (permanent underwear) ] [ +top ]        [ +bottom ]
[ +shoes ]                     [ +accessory ]  [ full-dress ]
```

- **Pose lock (critical):** the body in every cell must match the CURRENT atlas body pixel-for-pixel as closely as Lovart allows — same stance, same proportions, same position inside the cell. The extraction pipeline aligns dressed cells to the base cell (coarse ±140 px silhouette, head-region refine ±10 px) and hard-fails if garment fit misses >3% interior / >5% extra pixels. Use the existing atlas as an image reference / remix source.
- **Base cell:** unchanged from the current atlas (permanent vest + safety shorts). If Lovart must re-render it, it must be visually identical to the current body.
- **full-dress cell:** top + bottom + shoes + accessory worn together, same pose. It is shipped as the single `fullStarter` illustration users see by default — if its pose/proportions diverge from the per-slot cells, the dressed/undressed transition visibly pops.
- **Garment coverage must match the body regions below** (512×768 body-canvas coordinates; the build rescales each cell into this space):

| Archetype | torso top→bottom | hip top | feet y-range | Current outfit (to replace) |
|---|---|---|---|---|
| corgi | 254→454 | 414 | 610–672 | denim jacket + cargo shorts + high-tops + satchel |
| rooster | 242→450 | 414 | 600–664 | cream vest + rust workwear pants + boots + necklace |
| hamster_praise | 270→466 | 424 | 603–664 | beige knit + dark slacks + tan shoes + satchel |
| fox | 250→454 | 414 | 612–673 | military jacket + cargo pants + dark sneakers + satchel |
| dolphin_calm | 238→452 | 414 | 610–672 | track jacket + navy joggers + sneakers + necklace |
| spider | 252→438 | 400 | 556–614 | dark purple jacket + black pants + boots + belt |
| koala | 252→454 | 414 | 606–668 | blue shirt + navy chinos + sneakers + satchel |
| octopus | 282→468 | 424 | 607–669 | cream cardigan + khaki pants + dark shoes + satchel |
| owl | 250→466 | 426 | 598–663 | brown jacket + khaki pants + sneakers + satchel |
| elephant | 250→454 | 414 | 607–672 | navy workshirt + khaki pants + dark shoes + satchel |
| turtle | 246→452 | 414 | 606–670 | green field jacket + beige pants + sneakers + beanie |
| cat | 244→454 | 414 | 606–668 | cream fleece + blue jeans + dark shoes + satchel |

- Hoodie hem should land near `torso bottom`; pants from `hip top` to just above `feet`; shoes inside the feet y-range.

### Special extraction path: cat / elephant / turtle

These three have no dressed-stage history — their layers are extracted via isolated-cell fitting (`ISOLATED_ATLAS_IDS` in `extract-profile-pixel-atlas-layers.mjs`). Same atlas layout, same pose lock; just flag in delivery that these three may need the isolated fitting path and slightly looser alignment tolerance.

## Per-species accent + accessory direction

| Archetype | Species vibe | Accent | Accessory (soft, neutral) |
|---|---|---|---|
| corgi | playful | Warm Coral `#FF9B85` drawstrings | coral knit beanie |
| rooster | bright | Fresh Green `#9ACD32` cuffs | small green neckerchief |
| hamster_praise | warm | Warm Coral `#FF9B85` hood lining | round coral scarf |
| fox | clever | muted Vibrant Purple `#8B5CF6` drawstrings | purple knit beanie |
| dolphin_calm | steady | Sky Blue `#A8C5DD` cuffs | blue neck warmer |
| spider | detailed | muted Vibrant Purple `#8B5CF6` hood lining | small purple crossbody pouch |
| koala | empathetic | Sky Blue `#A8C5DD` drawstrings | blue knit beanie |
| octopus | creative | Warm Coral `#FF9B85` cuffs | coral crossbody pouch |
| owl | wise | muted Vibrant Purple `#8B5CF6` cuffs | round purple scarf |
| elephant | grounding | Sky Blue `#A8C5DD` hood lining | blue neck warmer |
| turtle | patient | Fresh Green `#9ACD32` drawstrings | green knit beanie (keep — already soft) |
| cat | independent | Warm Coral `#FF9B85` drawstrings | coral neck warmer |

## Lovart master prompt (template — swap {species}, {accent}, {accessory})

```
Using the attached pixel-art character atlas as a strict reference, create an updated
1254x1254 transparent PNG atlas for the {species} mascot. Keep the EXACT same body,
pose, proportions, and per-cell positioning as the reference — only the clothing changes.

Grid: 3 columns x 2 rows, each cell 418x627 px:
[ base (unchanged, permanent underwear) ] [ wearing hoodie only ]   [ wearing pants only ]
[ wearing shoes only ]                    [ wearing accessory only ] [ full outfit ]

New outfit (all cells): soft cozy loungewear — an oversized cream hoodie
(Warm Beige #F5F1E8 body) with {accent} drawstring/cuff accents, relaxed tapered
oatmeal lounge pants, and white round-toe canvas slip-ons (#FFFFFF with a subtle
Warm Coral #FF9B85 sole). Accessory: {accessory}. The read must be gender-neutral:
no streetwear, no cargo, no denim or military jackets, no dark heavy fabrics, no
frills. Rounded, slightly oversized, cozy-at-home silhouettes.

Style: clean pixel art matching the reference exactly — same pixel density, same
outline treatment, soft 2-3 tone shading. No text, no logos, no background.
```

Run one ChatCanvas thread per archetype; remix from the previous approved cell to lock consistency.

## Review checklist

- [ ] Pixel-art style matches existing bodies (no low-poly / painterly drift)
- [ ] Gender-neutral read: no streetwear/workwear cues, no frilly/pink-dominant cues
- [ ] Cream/oatmeal/white base palette with exactly one accent color per species
- [ ] Pose + proportions + in-cell position match the current atlas (diff-pipeline tolerance)
- [ ] Garments cover the region anchors in the table above (hoodie hem ≈ torso bottom, pants hip→ankle, shoes inside feet range)
- [ ] full-dress cell visually equals top+bottom+shoes+accessory combined
- [ ] No text, no logos, transparent background, 1254×1254, 3×2 grid, cell 418×627
- [ ] Anti-generic test: could this outfit appear in a generic dating app unchanged? If yes → iterate
- [ ] cat / elephant / turtle flagged for isolated fitting

## Brand sign-off gate

Do NOT replace `assets-source/profile-pixel-v2/<arch>/atlas-source.png` or run the build pipeline until this brief's output has been reviewed and approved by the brand reviewer. The current streetwear starters stay live until then.

## Post-approval pipeline

1. Replace `assets-source/profile-pixel-v2/<arch>/atlas-source.png` with the approved atlases.
2. `npm run build:profile-pixel-v2 -w mini-program` — extraction fit gates must pass (≤3% missed / ≤5% extra garment pixels per slot).
3. Verify regenerated `avatar-assets-v2.json` keeps `sourceAssetCount: 120` (12 bodies + 12 fullStarters + 48 layers + 48 thumbs) — the CDN post-upload jq verification keys off this count.
4. Asset-key contract `equipment/starter/<arch>/<slot>/v1` is unchanged → zero code changes; placements/thumbs/hashes recompute automatically.
5. Commit + push, then immediately run the `Upload CDN Assets` workflow — new content hashes 404 until the CDN syncs (2026-08-01 incident; nginx serves immutable caching, and pre-fix devices cached 404s).
6. Device spot-check: profile identity stage, my-image stage, gathering-room seats, equipment edit — dressed (fullStarter) and partially-undressed (layered) states.
