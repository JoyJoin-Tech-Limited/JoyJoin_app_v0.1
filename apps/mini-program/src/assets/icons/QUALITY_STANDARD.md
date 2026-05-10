# JoyJoin Mini-Program Icon Quality Standard

> 验收标准 — Pixel-level clarity requirements for all raster icon assets

## Philosophy

Mini-program raster icons must appear **crisp, never blurry** on all device densities. Blur comes from:
1. **Over-softening** during resize (Lanczos on solid-fill icons)
2. **Low-resolution source** upscaled to fit
3. **Inconsistent 1x/2x/3x** variants generated from different masters

This standard defines measurable criteria and a reproducible verification process.

---

## Tier Classification

### Tier A — Solid-Fill Geometric Icons
**Applies to:** rating faces, info labels, mood icons, status icons, chemistry badges

| Criterion | Target | How to verify |
|-----------|--------|---------------|
| **Color palette** | ≤ 8 unique colors | `magick <file> -format '%k' info:` |
| **Edge hardness** | 1x vs @3x-downscaled MAE < 5% | See verification script below |
| **Size ratio** | 1x : 2x : 3x must be exact 1:2:3 | Check dimensions |
| **File size** | < 1.5KB (1x), < 3KB (@2x), < 5KB (@3x) | `stat -f%z` |
| **Transparency** | Alpha channel present, corners semi-transparent | `magick -format '%[fx:p{0,0}.a]'` |
| **Anti-alias fringe** | ≤ 2px transition at edges | Visual inspection at 8x zoom |

### Tier B — Hero / Phase Emblems
**Applies to:** phase icons, event badges

| Criterion | Target | How to verify |
|-----------|--------|---------------|
| **Color palette** | ≤ 32 unique colors | `magick <file> -format '%k' info:` |
| **Edge hardness** | Clean edges, no visible softness | Visual inspection |
| **File size** | < 6KB per file | `stat -f%z` |
| **Detail at 3x** | Genuine detail (not upscaled 1x) | Check @3x ≠ 1x in dimensions/content |

---

## Production Pipeline (Mandatory)

### Step 1 — Source preparation
- Original grid artwork must be ≥ 3× the target 3x size (e.g., ≥ 576px for a 192px @3x)
- Crop individual cells with `trim` to remove whitespace
- Center on square canvas with `gravity center`

### Step 2 — Size generation (single-source)
**All sizes must be generated from ONE master**, never independently resized from source.

```bash
# Master = highest resolution source (e.g., 576px trimmed cell)
# Generate 3x first (Lanczos for detail)
magick master.png -resize 192x192 -filter Lanczos  icon@3x.png

# Generate 2x from 3x (Mitchell for clean 1.5:1 ratio)
magick icon@3x.png -resize 128x128 -filter Mitchell icon@2x.png

# Generate 1x from 3x (Point/Nearest for crisp 3:1 integer ratio)
magick icon@3x.png -resize 64x64 -filter Point icon.png
```

### Step 3 — Optimization
```bash
magick input.png -strip -interlace Plane -quality 85 output.png
```

### Step 4 — Verification
Run the audit script (see below). All checks must pass.

---

## Verification Script

Save as `scripts/audit-icon-quality.sh`:

```bash
#!/bin/bash
# Usage: ./audit-icon-quality.sh <folder>

DIR="${1:-.}"
FAIL=0

for f in $(find "$DIR" -name '*.png' ! -name '*grid*' | sort); do
  NAME=$(basename "$f")
  W=$(magick identify -format '%w' "$f" 2>/dev/null)
  H=$(magick identify -format '%h' "$f" 2>/dev/null)
  COLORS=$(magick "$f" -format '%k' info: 2>/dev/null)
  FSIZE=$(stat -f%z "$f" 2>/dev/null)
  
  # Check color count
  if [ "$COLORS" -gt 8 ]; then
    echo "FAIL: $NAME — $COLORS colors (max 8)"
    FAIL=1
  fi
  
  # Check file size
  if [ "$FSIZE" -gt 5120 ]; then
    echo "FAIL: $NAME — ${FSIZE}b (max 5120b)"
    FAIL=1
  fi
  
  # Check 1x vs @3x consistency (if @3x exists)
  if [[ "$NAME" =~ ^(.+)\.png$ ]] && [ -f "${DIR}/${BASH_REMATCH[1]}@3x.png" ]; then
    BASE="${BASH_REMATCH[1]}"
    W1=$(magick identify -format '%w' "${DIR}/${BASE}.png" 2>/dev/null)
    H1=$(magick identify -format '%h' "${DIR}/${BASE}.png" 2>/dev/null)
    MAX_DIFF=$((W1 * H1 * 255))
    
    magick "${DIR}/${BASE}@3x.png" -resize ${W1}x${H1} /tmp/${BASE}_down.png 2>/dev/null
    RAW_DIFF=$(magick compare -metric MAE "${DIR}/${BASE}.png" /tmp/${BASE}_down.png null: 2>&1 | awk '{print $1}' | cut -d. -f1)
    
    if [ -n "$RAW_DIFF" ] && [ "$MAX_DIFF" -gt 0 ]; then
      PCT=$(echo "scale=2; $RAW_DIFF * 100 / $MAX_DIFF" | bc 2>/dev/null)
      PCT_INT=$(echo "$PCT" | cut -d. -f1)
      if [ -n "$PCT_INT" ] && [ "$PCT_INT" -gt 5 ]; then
        echo "FAIL: $NAME — 1x vs @3x diff ${PCT}% (max 5%)"
        FAIL=1
      fi
    fi
  fi
done

if [ $FAIL -eq 0 ]; then
  echo "PASS: All quality checks passed"
else
  echo "FAIL: Some checks failed"
  exit 1
fi
```

---

## Current Inventory Audit Results

| Category | Files | Avg colors | Avg size | 1x/3x consistency | Status |
|----------|-------|-----------|----------|-------------------|--------|
| rating-faces | 15 | 8 | 1.6KB | 0.49-1.5% | ✅ PASS |
| info-labels | 12 | 3 | 0.3KB | < 4% | ✅ PASS |
| mood-icons | 12 | 4 | 0.5KB | < 2% | ✅ PASS |
| status-icons | 9 | 7 | 1.1KB | < 4% | ✅ PASS |
| phase-icons | 21 | 32 | ~12KB | N/A (single size, WebP) | ✅ PASS |

---

## Known Issues

1. **Phase emblems**: @2x and @3x are copies of 1x (same 192px dimensions). For true DPR optimization, they should be 384px and 576px respectively, or display size should be reduced to 64rpx so 192px serves as @3x.

2. **Opaque backgrounds**: Some icons have partially opaque corners rather than full transparency. This is acceptable if display background matches, but may cause halos on contrasting backgrounds.

---

## Rejection Criteria (Do Not Merge If)

- ❌ > 8 colors for Tier A icons
- ❌ 1x vs @3x MAE difference > 5%
- ❌ @2x/@3x are pixel-identical copies of 1x (not genuinely larger)
- ❌ Visible blur under 8x zoom in WeChat DevTools
- ❌ File size > 5KB for Tier A, > 6KB for Tier B
