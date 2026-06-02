#!/usr/bin/env python3
"""
Generate a minimal Alimama font subset for early-stage screens only.

Scans landing page, discover, login, and onboarding source files for Chinese
characters, then produces a lightweight woff2 (~50-150KB) that can be bundled
in the main package for instant brand display.

The full font (621KB) stays on CDN and loads in background via loadFontFace.

Usage:
    python3 scripts/subset-early-font.py

Prerequisites:
    pip install fonttools brotli
"""

import os
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter

SCRIPT_DIR = Path(__file__).parent.resolve()
MINI_PROGRAM_ROOT = SCRIPT_DIR.parent
REPO_ROOT = MINI_PROGRAM_ROOT.parent.parent

SOURCE_FONT = MINI_PROGRAM_ROOT / "assets-source" / "fonts" / "AlimamaFangYuanTiVF-Thin-original.ttf"
OUTPUT_DIR = MINI_PROGRAM_ROOT / "src" / "assets" / "fonts" / "Alimama"
OUTPUT_FONT = OUTPUT_DIR / "AlimamaFangYuanTiVF-Thin-early.woff2"

# Only scan early-stage screens + shared copy they reference
SCAN_PATHS = [
    MINI_PROGRAM_ROOT / "src" / "pages" / "index",
    MINI_PROGRAM_ROOT / "src" / "pages" / "discover",
    MINI_PROGRAM_ROOT / "src" / "pages" / "login",
    MINI_PROGRAM_ROOT / "src" / "pages" / "onboarding",
    MINI_PROGRAM_ROOT / "src" / "components" / "loading",
    MINI_PROGRAM_ROOT / "src" / "components" / "mascot",
    REPO_ROOT / "packages" / "shared" / "src" / "copy",
]

FILE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".scss", ".css", ".json"}
SKIP_DIRS = {"node_modules", "assets", "native-custom-tab-bar", "__tests__", "__mocks__"}

# Safety buffer: common characters even if not found by scan
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

# Force-include archetype names (shown in onboarding results + profile)
ARCHETYPE_NAMES = set(
    "开心柯基太阳鸡好奇猫温柔海豚机智狐狸稳重海龟"
    "社交孔雀冷静猫头鹰领导力狮子创意蜘蛛乐天仓鼠治愈考拉"
)


def collect_chars():
    """Walk scan paths and collect all unique Chinese characters."""
    chars = set(SAFETY_BUFFER)
    chars.update(ARCHETYPE_NAMES)

    for scan_path in SCAN_PATHS:
        if not scan_path.exists():
            print(f"  ⚠️  Skip missing path: {scan_path}")
            continue

        for root, dirs, files in os.walk(scan_path):
            # Prune skip dirs
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

            for fname in files:
                if not any(fname.endswith(ext) for ext in FILE_EXTENSIONS):
                    continue

                fpath = Path(root) / fname
                try:
                    content = fpath.read_text(encoding="utf-8")
                except Exception as e:
                    print(f"  ⚠️  Cannot read {fpath}: {e}")
                    continue

                for ch in content:
                    # CJK Unified Ideographs, CJK Ext A, and common symbols
                    if "\u4e00" <= ch <= "\u9fff" or "\u3400" <= ch <= "\u4dbf":
                        chars.add(ch)

    return chars


def subset_font(chars):
    """Subset SOURCE_FONT to only the given characters, output woff2."""
    if not SOURCE_FONT.exists():
        print(f"❌ Source font not found: {SOURCE_FONT}")
        print("   Download the original TTF and place it at the path above.")
        sys.exit(1)

    print(f"📖 Loading source font: {SOURCE_FONT}")
    font = TTFont(str(SOURCE_FONT))

    text = "".join(sorted(chars))
    print(f"🔤 Unique characters: {len(chars)}")
    print(f"   Sample: {text[:80]}{'...' if len(text) > 80 else ''}")

    print("✂️  Subsetting...")
    subsetter = Subsetter()
    subsetter.populate(text=text)
    subsetter.subset(font)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    font.flavor = "woff2"
    font.save(str(OUTPUT_FONT))

    original_size = SOURCE_FONT.stat().st_size
    new_size = OUTPUT_FONT.stat().st_size
    reduction = (1 - new_size / original_size) * 100

    print(f"\n✅ Early subset saved: {OUTPUT_FONT}")
    print(f"   Original: {original_size / 1024 / 1024:.2f} MB")
    print(f"   Subset:   {new_size / 1024:.1f} KB")
    print(f"   Reduction: {reduction:.1f}%")


def main():
    print("=" * 60)
    print("  JoyJoin Early-Stage Font Subsetter")
    print("=" * 60)
    print()
    print("Scanning early-stage source files for Chinese characters...")
    chars = collect_chars()
    subset_font(chars)


if __name__ == "__main__":
    main()
