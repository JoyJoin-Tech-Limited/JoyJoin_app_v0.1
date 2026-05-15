# 悦仔 (Xiaoyue) Sprite Strip Pipeline

This directory holds AI-generated 2-row sprite strip images before they are extracted into individual frames.

## Strip Format

Each strip is a transparent PNG with **5 frames in the top row + 4 frames in the bottom row**:

```
xiaoyue-strips/
  celebrate sprite.png
  coach sprite.png
  curious sprite.png
  idle breathing sprite.png
  intro sprite.png
  listening sprite.png
  nod sprite.png
  surprise sprite.png
  thinking sprite.png
```

**Strip spec:**
- 9 frames total, arranged in a 2-row grid
- Transparent background (PNG with alpha channel)
- Variable dimensions (~511×205px, exact size depends on source)
- Characters are separated by transparent gaps (used for auto-detection)

## Workflow

### 1. Place Strip Images

Drop Lovart-generated strip images here. The extractor will auto-detect frame boundaries from the transparent gaps.

### 2. Extract Frames

```bash
# Extract all strips
node scripts/extract-xiaoyue-strip-frames.mjs

# Or extract one state
node scripts/extract-xiaoyue-strip-frames.mjs --state intro
```

Extracted frames go to:
```
../xiaoyue-animations/<state>/
  frame-00.png
  frame-01.png
  ...
  frame-08.png
```

**Extraction uses zero-drift shared bounding box:** all 9 frames are cropped with the same dimensions centered on each frame's content, so the mascot stays perfectly anchored with no positional jitter.

### 3. Build Sprite Sheets

```bash
node scripts/generate-xiaoyue-spritesheet.mjs
```

Generates per-state WebP/PNG sheets + manifest.

## Single-frame states

States without strip sources (`empty`, `error`, `loading`, `neutral`, `reassure`, `reveal`, `success`, `thanks`, `trust`, `waiting`, `welcome`) are managed as individual 200×200 frames directly in `../xiaoyue-animations/<state>/frame-00.png`. The spritesheet generator handles them the same way as multi-frame states.
