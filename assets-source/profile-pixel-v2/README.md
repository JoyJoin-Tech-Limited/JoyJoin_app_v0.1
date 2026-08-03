# Profile Pixel V2 source assets

The runtime avatar is a layered paper doll. A body image is reused, and every garment is
stored once as a transparent image rather than as one full-outfit render per archetype.

## Canonical sources and extraction (2026-07-21)

Each archetype's `atlas-source.png` is the single source of truth: a 2×3 grid of
**dressed-stage renders sharing one body pose** —

```
[ base (permanent underwear) ] [ +top ] [ +bottom ]
[ +shoes ] [ +accessory ]      [ full-dress ]
```

For the nine archetypes with dressed-stage atlases (corgi, rooster, hamster_praise,
fox, dolphin_calm, spider, koala, octopus, owl), starter layers are derived by
**atlas character-difference**:

1. Each dressed cell is aligned to the base cell (downsampled silhouette coarse
   alignment ±140px, then head-region colour-score refine ±10px). Independent cell
   renders can sit tens of pixels apart — never assume they share coordinates.
2. The garment layer is (aligned dressed cell − base cell), restricted to the
   slot's ROI, cleaned (connected components, morphological close) and painted
   from the aligned dressed cell verbatim. Bottom layers additionally union a
   hip-seeded garment palette (covers garment-over-underwear regions with similar
   colours, e.g. beige-on-beige).
3. Placement = diff bounding box, so layers fit by construction.
4. **Fit quality gate** (hard fail): per slot, the composite base+layer must
   reproduce the aligned guide — interior missed garment pixels ≤ 3%, non-garment
   captures ≤ 5% (boundary jitter ±2px forgiven via erode/dilate; thin structures
   like chains and spider legs would otherwise phantom-fail). `fit-proof-*.png`
   sheets in `agent_tmp/profile-pixel-atlas-proofs/` show guide-vs-composite A/B
   pairs for design review. Debug: `PROFILE_PIXEL_DEBUG_FIT=1` prints per-slot
   metrics, `PROFILE_PIXEL_DEBUG_FIT_DIR=<dir>` dumps failing overlays,
   `PROFILE_PIXEL_FIT_GATE_MODE=warn` downgrades the gate to warnings.

Elephant, turtle and cat keep **isolated-cell fitting** (`ISOLATED_TARGETS`)
because their canonical atlases contain isolated equipment cells instead of
dressed stages. Their garments were approved in-place; composites are reviewed
via the same proof sheets. To move them onto the diff pipeline, regenerate their
atlases as dressed-stage grids first.

Each archetype also emits `full-starter.png` (the approved full-dress cell). The
runtime swaps to this single illustration when the complete starter set is
equipped (`getPixelAvatarApprovedStarterLookUrl`), so the default look is
pixel-perfect even where per-slot layers interact. Spider keeps its byte-approved
V1 art (`assets/profile-pixel/archetypes/spider/base-v1.webp`).

The old per-archetype `equipment-sheet-source.png` files (2×2 isolated garments)
are retained as a documented fallback: re-adding an archetype to
`ISOLATED_TARGETS` restores isolated fitting. Do not use them for new work —
their garment poses do not match the body (2026-07-21 incident: arm sticking out
of the dolphin jacket, misaligned shoes).

## Thumbnails (2026-08-01)

Inventory/shop thumbnails are **garment-only product shots**, never crops of the
worn layers. Worn layers intentionally re-paint body pixels at their seams
(chin fur, belly, leg strands) so they composite seamlessly — that context
reads as dirty scribble inside a small tile. The build derives each starter
thumb from the isolated garment cell instead: the 2×2
`equipment-sheet-source.png` for the nine dressed-stage archetypes (pose
mismatch is irrelevant for a flat product shot), or the isolated garment
cells of the canonical atlas for cat/elephant/turtle. Thumbs are chroma-keyed,
tight-cropped, lanczos-downscaled into a 224px art window, and padded to a
256px square. If an archetype ever lacks isolated art, the build falls back to
the worn-layer crop for that thumb.

Generated starter PNG layers and visual proof sheets are reproducible
intermediates and are not committed.

## Add reusable equipment

1. Put a transparent PNG or WebP under `equipment/`, for example
   `equipment/pools/night-market/star-jacket.png`.
2. Add one entry to `equipment-items.json`:

```json
{
  "assetKey": "equipment/pools/night-market/star-jacket/v1",
  "slot": "top",
  "source": "equipment/pools/night-market/star-jacket.png",
  "depth": 0.55,
  "placements": {
    "corgi": { "left": 92, "top": 248, "width": 328, "height": 230 },
    "cat": { "left": 96, "top": 242, "width": 320, "height": 226 }
  }
}
```

Placements use the canonical 512×768 body canvas. Only archetypes listed in `placements`
can wear the item. `slot` is one of `top`, `bottom`, `shoes`, or `accessory`; `depth` is from
0 to 1. Asset keys use lowercase portable path segments and are limited to 120 characters;
the `equipment/starter/` namespace is reserved for the 48 initial items. Source paths are
lowercase POSIX-style paths under `equipment/` and use only `.png` or `.webp` files.

For catalog items, placements are still authored per archetype. The same
character-difference trick works for new art: render the item worn on the
canonical body, diff against the body, and use the diff bounds.

Run `npm run build:profile-pixel-v2 -w mini-program` from the repository root. The build:

- re-extracts the 48 initial layers and 12 full-starter looks from the approved atlases;
- generates cropped, content-hashed WebP files;
- updates the runtime avatar manifest and CDN upload manifest;
- verifies dimensions, transparency, placements, content hashes, CDN mappings, and the
  fit quality gate;
- replaces only the generated subtrees (`archetypes/`, `equipment/`,
  `avatar-assets-v2.json`) — independently governed files in the v2 tree
  (e.g. `stage-assets-v1.json` and `stage/*.webp` for IdentityStageScene) are preserved.

The build uses a staging directory, so invalid new source data does not erase the last valid
runtime output. `generated-starter-layers/` is reproducible intermediate output and is ignored
by Git; the approved atlases/equipment sheets, extraction logic, final hashed WebPs, and
manifests are canonical.
