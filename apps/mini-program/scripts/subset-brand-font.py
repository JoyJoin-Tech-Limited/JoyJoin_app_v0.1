#!/usr/bin/env python3
"""
JoyJoin brand font processor — converts the AlimamaFangYuanTiVF TTF to woff2.

Prevents the "bold fallback character" bug where a missing glyph in the custom
font causes WeChat to render that single character in PingFang SC, looking
visibly bolder than surrounding text.

Usage:
    # Zero-maintenance mode (default): converts full font to woff2 (~2.3 MB).
    # Covers all GB2312 characters. Run once, then forget about it.
    python3 scripts/subset-brand-font.py

    # Aggressive mode: subsets to only characters found in source code (~600 KB).
    # Must be re-run whenever copy changes.
    python3 scripts/subset-brand-font.py --aggressive

Prerequisites:
    pip install fonttools brotli
"""

import argparse
import os
import re
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter

# ─── Paths ──────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent.resolve()
MINI_PROGRAM_ROOT = SCRIPT_DIR.parent
REPO_ROOT = MINI_PROGRAM_ROOT.parent.parent

SOURCE_FONT = MINI_PROGRAM_ROOT / "assets-source" / "fonts" / "AlimamaFangYuanTiVF-Thin-original.ttf"
OUTPUT_DIR = MINI_PROGRAM_ROOT / "src" / "assets" / "fonts" / "Alimama"
OUTPUT_FONT = OUTPUT_DIR / "AlimamaFangYuanTiVF-Thin.woff2"

# Directories to scan for Chinese text that might render in the display font
SCAN_PATHS = [
    MINI_PROGRAM_ROOT / "src",
    REPO_ROOT / "packages" / "shared" / "src" / "copy",
    REPO_ROOT / "packages" / "shared" / "src" / "personality",
]

FILE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".scss", ".css", ".json"}
SKIP_DIRS = {"node_modules", "assets", "native-custom-tab-bar", "__tests__", "__mocks__"}

# Safety buffer: characters commonly used even if not found by static scan
SAFETY_BUFFER = set(
    "abcdefghijklmnopqrstuvwxyz"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "0123456789"
    " !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"
    "。，、；：？！''\"\"（）《》【】～·…—"
    "\u2018\u2019\u201C\u201D"        # smart quotes
    "\u2026\u2013\u2014"             # ellipsis, en-dash, em-dash
    "\u00B7"                        # middle dot
)


def gather_chinese_chars() -> set[str]:
    """Walk source files and collect every CJK character."""
    chars: set[str] = set()
    cjk_pattern = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f]")

    for base_path in SCAN_PATHS:
        if not base_path.exists():
            print(f"  ⚠️  Scan path does not exist, skipping: {base_path}")
            continue

        for root, dirs, files in os.walk(base_path):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

            for filename in files:
                if not any(filename.endswith(ext) for ext in FILE_EXTENSIONS):
                    continue

                filepath = Path(root) / filename
                try:
                    text = filepath.read_text(encoding="utf-8")
                except UnicodeDecodeError:
                    continue

                found = cjk_pattern.findall(text)
                if found:
                    chars.update(found)

    return chars


def format_size(bytes_count: int) -> str:
    if bytes_count > 1024 * 1024:
        return f"{bytes_count / (1024 * 1024):.2f} MB"
    return f"{bytes_count / 1024:.1f} KB"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert AlimamaFangYuanTiVF to woff2 for the mini-program.",
    )
    parser.add_argument(
        "--aggressive",
        action="store_true",
        help=(
            "Subset to ONLY characters found in source code (~600 KB). "
            "Must be re-run whenever copy changes."
        ),
    )
    args = parser.parse_args()

    print("🔤 JoyJoin Brand Font Processor")
    print("=" * 50)

    if not SOURCE_FONT.exists():
        print(f"❌ Source font not found: {SOURCE_FONT}")
        return 1

    # ── 1. Scan source files (always done for diagnostics) ──────────
    print("\n📖 Scanning source files for CJK characters...")
    scanned_chars = gather_chinese_chars()
    scanned_chars.update(SAFETY_BUFFER)
    print(f"   Found {len(scanned_chars)} unique characters in source code")

    # ── 2. Load font ────────────────────────────────────────────────
    print(f"\n✂️  Loading: {SOURCE_FONT.name}")
    font = TTFont(str(SOURCE_FONT))
    original_cmap = font["cmap"].getBestCmap()

    # ── 3. Subset or keep full glyph set ────────────────────────────
    if args.aggressive:
        print("   Mode: AGGRESSIVE — keeping only scanned characters")
        subsetter = Subsetter()
        subsetter.populate(text="".join(scanned_chars))
        subsetter.subset(font)
    else:
        print("   Mode: FULL — keeping all glyphs from original font (~zero maintenance)")
        # No subsetting; we just convert the whole font to woff2.
        # The original font is already GB2312-complete (6763 CJK chars).
        # This covers virtually any copy change without regeneration.

    # ── 4. Export woff2 ─────────────────────────────────────────────
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    font.flavor = "woff2"
    font.save(str(OUTPUT_FONT))

    source_size = SOURCE_FONT.stat().st_size
    output_size = OUTPUT_FONT.stat().st_size
    reduction = (1 - output_size / source_size) * 100

    print(f"\n💾 Saved: {OUTPUT_FONT}")
    print(f"   Original: {format_size(source_size)}")
    print(f"   Output:   {format_size(output_size)} ({reduction:.1f}% smaller)")

    # ── 5. Verify coverage ──────────────────────────────────────────
    print("\n🔍 Verifying glyph coverage...")
    cmap = font["cmap"].getBestCmap()

    missing_from_original = {c for c in scanned_chars if ord(c) not in original_cmap}
    missing_from_output = {c for c in scanned_chars if ord(c) not in cmap}
    subsetting_bugs = missing_from_output - missing_from_original

    if subsetting_bugs:
        print(f"   ❌ {len(subsetting_bugs)} characters were in original font but LOST during subsetting:")
        for c in sorted(subsetting_bugs)[:50]:
            print(f"      U+{ord(c):04X}  {c}")
        if len(subsetting_bugs) > 50:
            print(f"      ... and {len(subsetting_bugs) - 50} more")
        return 1

    if missing_from_original:
        print(f"   ⚠️  {len(missing_from_original)} characters are missing from the")
        print(f"      ORIGINAL font (will always use system fallback):")
        for c in sorted(missing_from_original)[:30]:
            print(f"      U+{ord(c):04X}  {c}")
        if len(missing_from_original) > 30:
            print(f"      ... and {len(missing_from_original) - 30} more")
        print(f"\n   💡 If these characters are important, you need a different source font.")
    else:
        print("   ✅ All scanned characters are present in the original font")

    # ── 6. Recommendations ──────────────────────────────────────────
    print("\n✅ Done.")
    if args.aggressive:
        print("\n⚠️  AGGRESSIVE mode selected:")
        print("   You MUST re-run this script every time Chinese copy changes.")
        print("   npm run subset:brand-font -- --aggressive")
    else:
        print("\n🛡️  FULL mode selected:")
        print("   The font contains all ~7000 glyphs from the original.")
        print("   Normal copy changes do NOT require regeneration.")
        print("   Re-run only if you need rare characters outside GB2312.")

    print("\n   Next steps:")
    print("   1. Ensure Taro config copies src/assets/fonts → dist/assets/fonts")
    print("   2. Update cdn-asset-manifest.json if needed")
    print("   3. Run: node scripts/upload-cdn-assets.mjs")

    return 0


if __name__ == "__main__":
    sys.exit(main())
