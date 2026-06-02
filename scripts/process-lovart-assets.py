#!/usr/bin/env python3
"""
Lovart Asset Pipeline — Batch processor for proprietary icon assets.

Takes raw Lovart outputs (individual files or grid sheets), crops, centers,
trims backgrounds, and generates production-ready @1x/@2x/@3x PNG + WebP
assets for the JoyJoin mini-program icon system.

Usage:
    # Process all individual files in batch-a and batch-b
    python3 scripts/process-lovart-assets.py

    # Process a specific grid sheet with config
    python3 scripts/process-lovart-assets.py \
        --grid apps/mini-program/assets-source/lovart/batch-a/reactions.png \
        --config apps/mini-program/assets-source/lovart/batch-a/reactions.json

Workflow:
    1. Drop raw Lovart images into apps/mini-program/assets-source/lovart/batch-a/ or batch-b/
    2. Name each file after its asset key: e.g. "reaction-funny.png"
    3. Run this script
    4. Script outputs to apps/mini-program/src/assets/icons/{tier}-icons/
    5. Script prints a summary of what to paste into emojiToIconMap.ts
"""

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import List, Optional

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow is required. Install with: pip3 install Pillow")
    sys.exit(1)


# ═══════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════

REPO_ROOT = Path(__file__).parent.parent.resolve()
SOURCE_DIR = REPO_ROOT / "apps/mini-program/assets-source/lovart"
OUTPUT_DIR = REPO_ROOT / "apps/mini-program/src/assets/icons"

# Tier → output folder mapping
TIER_FOLDERS = {
    "reaction": "reaction-icons",
    "category": "category-icons",
    "intent": "intent-icons",
    "reveal": "reveal-icons",
    "achievement": "achievement-badges",
}

# Base display sizes (rpx) per tier
TIER_BASE_SIZES = {
    "reaction": 56,
    "category": 32,
    "intent": 48,
    "reveal": 96,
    "achievement": 72,
}

# Pixel densities to generate
DENSITIES = {
    "": 1,      # @1x
    "@2x": 2,
    "@3x": 3,
}

# How much breathing room around the icon (fraction of canvas)
PADDING_FRACTION = 0.12


def _infer_tier_from_name(name: str) -> Optional[str]:
    """Infer tier from filename prefix like 'reaction-funny'."""
    parts = name.split("-")
    if parts[0] in TIER_FOLDERS:
        return parts[0]
    # Common aliases
    aliases = {
        "reactions": "reaction",
        "categories": "category",
        "intents": "intent",
        "reveals": "reveal",
        "achievements": "achievement",
    }
    if parts[0] in aliases:
        return aliases[parts[0]]
    return None


# ═══════════════════════════════════════════════════════════════════
# IMAGE PROCESSING
# ═══════════════════════════════════════════════════════════════════

def trim_background(img: Image.Image, tolerance: int = 10) -> Image.Image:
    """Trim excess transparent or near-white background."""
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    data = img.getdata()
    width, height = img.size

    def is_content(pixel):
        r, g, b, a = pixel
        if a < tolerance:
            return False
        # Near-white background
        if abs(r - 255) < tolerance and abs(g - 255) < tolerance and abs(b - 255) < tolerance:
            return False
        return True

    pixels = list(data)
    mask = [is_content(p) for p in pixels]

    left = width
    top = height
    right = 0
    bottom = 0

    for y in range(height):
        for x in range(width):
            idx = y * width + x
            if mask[idx]:
                left = min(left, x)
                top = min(top, y)
                right = max(right, x)
                bottom = max(bottom, y)

    if left >= right or top >= bottom:
        return img  # empty or uniform

    return img.crop((left, top, right + 1, bottom + 1))


def center_on_square(img: Image.Image, size: int) -> Image.Image:
    """Center image content on a square canvas with breathing room."""
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    content_size = int(size * (1.0 - PADDING_FRACTION * 2))
    img.thumbnail((content_size, content_size), Image.LANCZOS)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - img.width) // 2
    y = (size - img.height) // 2
    canvas.paste(img, (x, y), img)
    return canvas


def export_icon(img: Image.Image, asset_key: str, tier: str, output_folder: Path, base_size_rpx: Optional[int] = None) -> List[Path]:
    """Generate @1x/@2x/@3x PNG + WebP from a PIL Image."""
    base_rpx = base_size_rpx or TIER_BASE_SIZES.get(tier, 64)
    base_px = base_rpx * 2  # @2x pixel size

    generated = []
    for suffix, density in DENSITIES.items():
        px = max(base_px * density // 2, 32)

        centered = center_on_square(img.copy(), px)

        # PNG
        png_path = output_folder / f"{asset_key}{suffix}.png"
        centered.save(png_path, "PNG")
        generated.append(png_path)

        # WebP
        webp_path = output_folder / f"{asset_key}{suffix}.webp"
        centered.save(webp_path, "WEBP", quality=90, method=6)
        generated.append(webp_path)

    return generated


def process_file(src_path: Path, asset_key: Optional[str] = None, tier: Optional[str] = None, base_size_rpx: Optional[int] = None, source_label: Optional[str] = None) -> dict:
    """Process a single source file."""
    img = Image.open(src_path)
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    name = asset_key or src_path.stem
    inferred_tier = tier or _infer_tier_from_name(name)

    if not inferred_tier:
        return {"error": f"Cannot infer tier from filename '{name}'. Rename to 'tier-name.png' or specify --tier."}

    folder = OUTPUT_DIR / TIER_FOLDERS[inferred_tier]
    folder.mkdir(parents=True, exist_ok=True)

    trimmed = trim_background(img)
    outputs = export_icon(trimmed, name, inferred_tier, folder, base_size_rpx)

    return {
        "source": source_label or str(src_path.relative_to(REPO_ROOT)),
        "asset_key": name,
        "tier": inferred_tier,
        "outputs": [str(p.relative_to(REPO_ROOT)) for p in outputs],
    }


def process_grid(src_path: Path, config_path: Path) -> List[dict]:
    """Process a grid image using a JSON config."""
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    img = Image.open(src_path)
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    rows = config["grid"]["rows"]
    cols = config["grid"]["cols"]
    cell_w = img.width // cols
    cell_h = img.height // rows

    results = []
    for asset in config["assets"]:
        row, col = asset["cell"]
        x = col * cell_w
        y = row * cell_h
        cell = img.crop((x, y, x + cell_w, y + cell_h))

        # Save cell to temp file so process_file can open it
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            cell.save(tmp.name, "PNG")
            tmp_path = Path(tmp.name)

        try:
            result = process_file(
                tmp_path,
                asset_key=asset["name"],
                tier=asset.get("tier", "reaction"),
                base_size_rpx=asset.get("size"),
                source_label=f"grid:{src_path.name} cell:{asset['cell']}",
            )
            results.append(result)
        finally:
            tmp_path.unlink(missing_ok=True)

    return results


# ═══════════════════════════════════════════════════════════════════
# BATCH PROCESSING
# ═══════════════════════════════════════════════════════════════════

def process_batch_folder(batch_dir: Path) -> dict:
    """Scan a batch folder and process all individual images."""
    results = {"processed": [], "skipped": [], "tiers_updated": set()}

    if not batch_dir.exists():
        return results

    for src_file in sorted(batch_dir.iterdir()):
        if src_file.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
            continue
        if src_file.stem.endswith("_grid") or src_file.suffix == ".json":
            continue

        try:
            result = process_file(src_file)
            if "error" in result:
                results["skipped"].append(f"{src_file.name}: {result['error']}")
            else:
                results["processed"].append(result)
                results["tiers_updated"].add(result["tier"])
        except Exception as e:
            results["skipped"].append(f"{src_file.name}: {e}")

    return results


def print_code_updates(results: dict):
    """Print TypeScript mapping snippets."""
    if not results["processed"]:
        print("\n⚠️  No assets were processed. Nothing to update.")
        return

    print("\n" + "=" * 60)
    print("📝 CODE UPDATE REQUIRED")
    print("=" * 60)
    print("\nUpdate these entries in packages/shared/src/iconSystem/emojiToIconMap.ts:\n")

    by_tier = {}
    for item in results["processed"]:
        by_tier.setdefault(item["tier"], []).append(item)

    tier_map_names = {
        "reaction": "REACTION_MAP",
        "category": "CATEGORY_MAP",
        "intent": "INTENT_MAP",
        "reveal": "REVEAL_MAP",
        "achievement": "ACHIEVEMENT_MAP",
    }

    for tier, items in sorted(by_tier.items()):
        map_name = tier_map_names.get(tier, f"{tier.upper()}_MAP")
        print(f"// {map_name}")
        for item in items:
            size = TIER_BASE_SIZES.get(tier, 64)
            print(f"  '{item['asset_key']}': {{ assetKey: '{item['asset_key']}', tier: '{tier}', size: {size}, fallbackEmoji: '...' }},")
        print()

    print("Don't forget to set the correct fallbackEmoji for each entry!")


def main():
    parser = argparse.ArgumentParser(description="Process Lovart icon assets")
    parser.add_argument("--grid", type=str, help="Path to a grid image")
    parser.add_argument("--config", type=str, help="Path to grid config JSON")
    parser.add_argument("--batch", type=str, choices=["a", "b"], help="Process only batch-a or batch-b")
    args = parser.parse_args()

    print("🎨 Lovart Asset Pipeline")
    print(f"   Source:  {SOURCE_DIR}")
    print(f"   Output:  {OUTPUT_DIR}")
    print()

    all_results = {"processed": [], "skipped": [], "tiers_updated": set()}

    if args.grid and args.config:
        print(f"📐 Processing grid: {args.grid}")
        grid_results = process_grid(Path(args.grid), Path(args.config))
        all_results["processed"].extend(grid_results)
        for r in grid_results:
            all_results["tiers_updated"].add(r["tier"])

    else:
        batches = [args.batch] if args.batch else ["a", "b"]
        for batch in batches:
            batch_dir = SOURCE_DIR / f"batch-{batch}"
            if not batch_dir.exists():
                print(f"⏭️  batch-{batch} not found, skipping")
                continue

            print(f"📁 Processing batch-{batch}: {batch_dir}")
            batch_results = process_batch_folder(batch_dir)
            all_results["processed"].extend(batch_results["processed"])
            all_results["skipped"].extend(batch_results["skipped"])
            all_results["tiers_updated"].update(batch_results["tiers_updated"])

    # Summary
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    print(f"   ✅ Processed: {len(all_results['processed'])} assets")
    print(f"   ⚠️  Skipped:   {len(all_results['skipped'])} files")

    if all_results["processed"]:
        print("\n   Generated assets:")
        for item in all_results["processed"]:
            print(f"   • {item['asset_key']} ({item['tier']})")

    if all_results["skipped"]:
        print("\n   Skipped:")
        for s in all_results["skipped"]:
            print(f"   • {s}")

    print_code_updates(all_results)


if __name__ == "__main__":
    main()
