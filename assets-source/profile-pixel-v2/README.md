# Profile Pixel V2 source assets

The runtime avatar is a layered paper doll. A body image is reused, and every garment is
stored once as a transparent image rather than as one full-outfit render per archetype.
The 12 starter bodies come from each archetype's `atlas-source.png`. Nine archetypes use a
dedicated `equipment-sheet-source.png` containing four isolated items in a 2×2 grid
(top, bottom, shoes, accessory); elephant, turtle, and cat already contain isolated item cells
in their canonical atlas. Generated starter PNG layers and visual proof sheets are reproducible
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

Run `npm run build:profile-pixel-v2 -w mini-program` from the repository root. The build:

- re-extracts the 48 initial layers from the approved isolated equipment sources;
- generates cropped, content-hashed WebP files;
- updates the runtime avatar manifest and CDN upload manifest;
- verifies dimensions, transparency, placements, content hashes, and CDN mappings.

The build uses a staging directory, so invalid new source data does not erase the last valid
runtime output. `generated-starter-layers/` is reproducible intermediate output and is ignored
by Git; the approved atlases/equipment sheets, extraction logic, final hashed WebPs, and
manifests are canonical.
