#!/usr/bin/env python3
import json
import math
import os
import subprocess
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "apps/mini-program/assets-source/lovart/mini-program UI:status icons grid/mini-program UI:status icons grid.png")
BASE_OUT = os.path.join(ROOT, "apps/mini-program/src/assets/icons")

# 5x5 grid mapping (row, col) -> output tier/name
GRID = [
    [  # Row 1
        {"tier": "status", "name": "status-alarm-clock", "emoji": "⏰"},
        {"tier": "status", "name": "status-megaphone", "emoji": "📣"},
        {"tier": "status", "name": "status-bar-chart", "emoji": "📊"},
        {"tier": "status", "name": "status-warning", "emoji": "⚠️"},
        {"tier": "status", "name": "status-prohibited", "emoji": "🚫"},
    ],
    [  # Row 2
        {"tier": "semantic", "name": "label-cityscape", "emoji": "🌆"},
        {"tier": "semantic", "name": "label-map", "emoji": "🗺️"},
        {"tier": "semantic", "name": "label-globe-asia", "emoji": "🌏"},
        {"tier": "semantic", "name": "label-globe-meridians", "emoji": "🌐"},
        {"tier": "semantic", "name": "label-airplane", "emoji": "✈️"},
    ],
    [  # Row 3
        {"tier": "reaction", "name": "reaction-money-bag", "emoji": "💰"},
        {"tier": "reaction", "name": "reaction-smirk", "emoji": "😏"},
        {"tier": "reaction", "name": "reaction-sunglasses", "emoji": "😎"},
        {"tier": "reaction", "name": "reaction-purple-heart", "emoji": "💜"},
        {"tier": "reaction", "name": "reaction-sweat", "emoji": "😅"},
    ],
    [  # Row 4
        {"tier": "status", "name": "status-mirror", "emoji": "🪞"},
        {"tier": "status", "name": "status-unlocked", "emoji": "🔓"},
        {"tier": "status", "name": "status-star", "emoji": "🌟"},
        {"tier": "status", "name": "status-close", "emoji": "✕"},
        {"tier": "status", "name": "status-check", "emoji": "✓"},
    ],
    [  # Row 5
        {"tier": "reaction", "name": "reaction-devil", "emoji": "😈"},
        {"tier": "status", "name": "status-bell", "emoji": "🔔"},
        {"tier": "ui", "name": "icon-gift", "emoji": "🎁"},
        {"tier": "ui", "name": "icon-search", "emoji": "🔍"},
        {"tier": "ui", "name": "icon-memo", "emoji": "📝"},
    ],
]

TIER_FOLDER = {
    "status": "status-icons",
    "semantic": "info-labels",
    "reaction": "reaction-icons",
    "ui": "ui",
}

TARGET_SIZES = [96, 192, 288]
ALPHA_THRESHOLD = 20


def find_bounding_box_and_centroid(cell):
    data = cell.load()
    w, h = cell.size
    min_x, min_y = w, h
    max_x = max_y = -1
    sum_x = sum_y = total = 0
    for y in range(h):
        for x in range(w):
            alpha = data[x, y][3]
            if alpha > ALPHA_THRESHOLD:
                if x < min_x:
                    min_x = x
                if x > max_x:
                    max_x = x
                if y < min_y:
                    min_y = y
                if y > max_y:
                    max_y = y
                sum_x += x * alpha
                sum_y += y * alpha
                total += alpha
    if total == 0:
        return None
    bbox = (min_x, min_y, max_x + 1, max_y + 1)
    centroid = (sum_x / total, sum_y / total)
    return bbox, centroid


def main():
    img = Image.open(SOURCE).convert("RGBA")
    W, H = img.size
    rows = len(GRID)
    cols = len(GRID[0])

    x_boundaries = [round(i * W / cols) for i in range(cols + 1)]
    y_boundaries = [round(i * H / rows) for i in range(rows + 1)]

    report = []
    verification = img.copy()

    for r in range(rows):
        for c in range(cols):
            meta = GRID[r][c]
            left = x_boundaries[c]
            right = x_boundaries[c + 1]
            top = y_boundaries[r]
            bottom = y_boundaries[r + 1]
            cell_w = right - left
            cell_h = bottom - top

            cell = img.crop((left, top, right, bottom))
            result = find_bounding_box_and_centroid(cell)
            if result is None:
                report.append({**meta, "row": r, "col": c, "error": "empty cell"})
                print(f"[EMPTY] {meta['emoji']} @ row {r}, col {c}")
                continue

            (min_x, min_y, max_x, max_y), (cx, cy) = result
            bbox_w = max_x - min_x
            bbox_h = max_y - min_y
            bbox_cx = (min_x + max_x) / 2
            bbox_cy = (min_y + max_y) / 2

            # Square crop centered on centroid with 12% padding
            side = max(bbox_w, bbox_h) * 1.12
            side = min(side, cell_w, cell_h)
            crop_left = round(cx - side / 2)
            crop_top = round(cy - side / 2)
            if crop_left < 0:
                crop_left = 0
            if crop_top < 0:
                crop_top = 0
            if crop_left + side > cell_w:
                crop_left = round(cell_w - side)
            if crop_top + side > cell_h:
                crop_top = round(cell_h - side)
            side = round(side)

            cropped = cell.crop((crop_left, crop_top, crop_left + side, crop_top + side))

            folder = os.path.join(BASE_OUT, TIER_FOLDER[meta["tier"]])
            os.makedirs(folder, exist_ok=True)

            outputs = []
            for size in TARGET_SIZES:
                suffix = "" if size == 96 else f"@{size // 96}x"
                png_path = os.path.join(folder, f"{meta['name']}{suffix}.png")
                webp_path = os.path.join(folder, f"{meta['name']}{suffix}.webp")

                resized = cropped.resize((size, size), Image.Resampling.LANCZOS)
                resized.save(png_path, "PNG")

                quality = 90 if size == 96 else 85
                subprocess.run(
                    ["cwebp", "-q", str(quality), "-alpha_q", "100", png_path, "-o", webp_path],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                os.remove(png_path)
                outputs.append(os.path.basename(webp_path))

            # Draw verification overlay
            overlay = verification.load()
            v_left = left + crop_left
            v_top = top + crop_top
            for i in range(side):
                # red crosshair / box
                overlay[v_left + i, v_top] = (255, 0, 0, 255)
                overlay[v_left + i, v_top + side - 1] = (255, 0, 0, 255)
                overlay[v_left, v_top + i] = (255, 0, 0, 255)
                overlay[v_left + side - 1, v_top + i] = (255, 0, 0, 255)
            center_x = v_left + side // 2
            center_y = v_top + side // 2
            for i in range(-side // 6, side // 6 + 1):
                overlay[center_x + i, center_y] = (255, 0, 0, 255)
                overlay[center_x, center_y + i] = (255, 0, 0, 255)

            report.append(
                {
                    **meta,
                    "row": r,
                    "col": c,
                    "cell": f"{cell_w}x{cell_h}",
                    "bbox": f"{bbox_w}x{bbox_h}",
                    "centroidOffset": {
                        "x": round(cx - bbox_cx, 2),
                        "y": round(cy - bbox_cy, 2),
                    },
                    "crop": f"{side}x{side}",
                    "outputs": outputs,
                }
            )

            off_x = cx - bbox_cx
            off_y = cy - bbox_cy
            ok = abs(off_x) <= 4 and abs(off_y) <= 4
            print(
                f"{'✅' if ok else '⚠️'} {meta['emoji']} {meta['name']} | "
                f"centroid offset {off_x:+.2f},{off_y:+.2f} | crop {side}x{side}"
            )

    verif_path = os.path.join(ROOT, "tmp", "lovart-grid-crop-verification.png")
    verification.save(verif_path, "PNG")

    report_path = os.path.join(ROOT, "tmp", "lovart-grid-crop-report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\nCropped {len([r for r in report if not r.get('error')])}/{rows * cols} icons.")
    print(f"Verification overlay: {verif_path}")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
