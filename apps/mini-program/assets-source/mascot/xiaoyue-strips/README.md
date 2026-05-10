# 悦仔 (Xiaoyue) Sprite Strip Pipeline

This directory holds AI-generated horizontal strip images before they are extracted into individual frames.

## Workflow

### 1. Place Strip Images

Drop Lovart-generated strip images here:

```
xiaoyue-strips/
  idle.png          ← 512×4608px, 9 frames horizontal
  curious.png       ← 512×4608px, 9 frames horizontal
  listening.png     ← 512×4608px, 9 frames horizontal
  thinking.png      ← 512×4608px, 9 frames horizontal
  nod.png           ← 512×4608px, 9 frames horizontal
  celebrate.png     ← 512×4608px, 9 frames horizontal
  surprised.png     ← 512×4608px, 9 frames horizontal
  coach.png         ← 512×4608px, 9 frames horizontal
  intro.png         ← 512×4608px, 9 frames horizontal (NEW)
```

**Strip spec:**
- Frame size: 512×512px
- Frames: 9 per strip, left-to-right
- Background: transparent (PNG with alpha)
- No padding between frames (edge-to-edge)
- Total strip size: 4608×512px

### 2. Extract Frames

```bash
# Extract all strips
node scripts/extract-xiaoyue-strip-frames.mjs --all

# Or extract one state
node scripts/extract-xiaoyue-strip-frames.mjs --state idle

# Force re-extraction
node scripts/extract-xiaoyue-strip-frames.mjs --state idle --force
```

Extracted frames go to:
```
../xiaoyue-animations/<state>/
  frame-00.png
  frame-01.png
  frame-02.png
  frame-03.png
```

### 3. QA Contact Sheet

```bash
node scripts/generate-xiaoyue-contact-sheet.mjs
```

Generates `tmp/xiaoyue-contact-sheet.png` for visual identity review.

### 4. Repair Failed Frames

```bash
# Auto-detect issues
node scripts/queue-xiaoyue-repairs.mjs

# Or flag specific frame manually
node scripts/queue-xiaoyue-repairs.mjs --state nod --frame 2
```

Replace the broken strip and re-extract with `--force`.

### 5. Build Sprite Sheets

```bash
node scripts/generate-xiaoyue-spritesheet.mjs
```

Generates per-state WebP/PNG sheets + manifest.

---

## Repair Queue

Failed frames are tracked in `.repair/repair-manifest.json`.

Common issues:
- **empty_frame** — frame extraction got a blank cell
- **transparency_anomaly** — chroma-key bleed or alpha channel issue
- **brightness_outlier** — frame looks completely different from its row
