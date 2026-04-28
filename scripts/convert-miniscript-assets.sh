#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# MiniScript Asset Conversion Script
# Converts Lovart-generated PNG source files into bundle-ready WebP assets.
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage:
#   1. Place Lovart PNG exports in: apps/mini-program/src/assets/miniscript/source/
#      (recommended: 1200×1800 or higher, 2:3 portrait ratio)
#   2. Run: ./scripts/convert-miniscript-assets.sh
#   3. Check output sizes — thumbs should be ≤4KB, heroes ≤80KB
#
# Requires: cwebp (install via `brew install webp`)

set -euo pipefail

SOURCE_DIR="apps/mini-program/assets-source/miniscript"
OUTPUT_DIR="apps/mini-program/src/assets/miniscript"

if ! command -v cwebp &> /dev/null; then
  echo "❌ cwebp not found. Install with: brew install webp"
  exit 1
fi

if [ ! -d "$SOURCE_DIR" ]; then
  echo "❌ Source directory not found: $SOURCE_DIR"
  echo "   Place Lovart PNG exports there first."
  exit 1
fi

echo "🎨 Converting MiniScript assets from $SOURCE_DIR..."
echo ""

THUMB_MAX=4     # KB
HERO_MAX=80     # KB

for png in "$SOURCE_DIR"/*.png; do
  [ -e "$png" ] || continue

  name=$(basename "$png" .png)
  echo "Processing: $name"

  # ─── Thumbnail: 120×180, target ≤4KB ─────────────────────────────────────
  # Try q50 first, fall back to q40, then q30 if needed
  for q in 50 40 30; do
    cwebp -resize 120 180 -q "$q" "$png" -o "$OUTPUT_DIR/${name}-thumb.webp" 2>/dev/null
    size=$(stat -f%z "$OUTPUT_DIR/${name}-thumb.webp" 2>/dev/null || echo 0)
    kb=$(echo "scale=1; $size / 1024" | bc)
    if (( $(echo "$kb <= $THUMB_MAX" | bc -l) )); then
      echo "  ✅ thumb (q$q): ${kb}KB"
      break
    fi
    if [ "$q" = "30" ]; then
      echo "  ⚠️  thumb (q$q): ${kb}KB — exceeds ${THUMB_MAX}KB budget"
    fi
  done

  # ─── Hero: 600×900, target ≤80KB ─────────────────────────────────────────
  # Try q75 first, fall back in steps
  for q in 75 60 50 40; do
    cwebp -resize 600 900 -q "$q" "$png" -o "$OUTPUT_DIR/${name}-hero.webp" 2>/dev/null
    size=$(stat -f%z "$OUTPUT_DIR/${name}-hero.webp" 2>/dev/null || echo 0)
    kb=$(echo "scale=1; $size / 1024" | bc)
    if (( $(echo "$kb <= $HERO_MAX" | bc -l) )); then
      echo "  ✅ hero  (q$q): ${kb}KB"
      break
    fi
    if [ "$q" = "40" ]; then
      echo "  ⚠️  hero  (q$q): ${kb}KB — exceeds ${HERO_MAX}KB budget"
    fi
  done
done

echo ""
echo "📦 Output directory: $OUTPUT_DIR"
echo "🚀 Next: update miniscriptCatalog.ts with thumbnailPath and heroCdnUrl"
