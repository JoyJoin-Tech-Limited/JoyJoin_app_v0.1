#!/usr/bin/env python3
"""
Generate an ultra-minimal Alimama font subset for the landing page + onboarding.

Only includes characters needed for instant brand display on early screens.
The full font (621KB) loads from CDN in background.

Usage:
    python3 scripts/subset-minimal-font.py

Prerequisites:
    pip install fonttools brotli
"""

import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter

SCRIPT_DIR = Path(__file__).parent.resolve()
MINI_PROGRAM_ROOT = SCRIPT_DIR.parent

SOURCE_FONT = MINI_PROGRAM_ROOT / "assets-source" / "fonts" / "AlimamaFangYuanTiVF-Thin-original.ttf"
OUTPUT_DIR = MINI_PROGRAM_ROOT / "src" / "assets" / "fonts" / "Alimama"
OUTPUT_FONT = OUTPUT_DIR / "AlimamaFangYuanTiVF-Thin-minimal.woff2"

# Ultra-minimal character set for landing + onboarding instant display
MINIMAL_CHARS = (
    # ASCII safety buffer
    "abcdefghijklmnopqrstuvwxyz"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "0123456789"
    " !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"
    # Punctuation
    "\u2018\u2019\u201C\u201D\u2026\u2013\u2014\u00B7"
    "。，、；：？！''\"\"（）《》【】～·…—"
    # Tab labels + common UI
    "发现连接足迹我的活动筛选全部定位中立即报名查看详情推荐热门附近"
    # Greetings + status
    "早上好下午晚上已待开始匹配中"
    # Archetype names (results + profile)
    "开心柯基太阳鸡好奇猫温柔海豚机智狐狸稳重海龟"
    "社交孔雀冷静猫头鹰领导力狮子创意蜘蛛乐天仓鼠治愈考拉"
    # Onboarding common
    "悦仔下一步跳过返回欢迎选择请选择填写请输入您的确认同意隐私政策服务条款个人信息"
)


def main():
    print("=" * 60)
    print("  JoyJoin Minimal Font Subsetter")
    print("=" * 60)

    if not SOURCE_FONT.exists():
        print(f"❌ Source font not found: {SOURCE_FONT}")
        sys.exit(1)

    font = TTFont(str(SOURCE_FONT))
    text = "".join(sorted(set(MINIMAL_CHARS)))
    print(f"🔤 Unique characters: {len(set(MINIMAL_CHARS))}")

    subsetter = Subsetter()
    subsetter.populate(text=text)
    subsetter.subset(font)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    font.flavor = "woff2"
    font.save(str(OUTPUT_FONT))

    original_size = SOURCE_FONT.stat().st_size
    new_size = OUTPUT_FONT.stat().st_size
    reduction = (1 - new_size / original_size) * 100

    print(f"\n✅ Minimal subset saved: {OUTPUT_FONT}")
    print(f"   Original: {original_size / 1024 / 1024:.2f} MB")
    print(f"   Subset:   {new_size / 1024:.1f} KB")
    print(f"   Reduction: {reduction:.1f}%")


if __name__ == "__main__":
    main()
