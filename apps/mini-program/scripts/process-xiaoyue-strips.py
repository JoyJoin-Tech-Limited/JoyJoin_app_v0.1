#!/usr/bin/env python3
"""
Extract frames from 2-row sprite strips, scale content to fill 200x200,
center each frame's content, and save for spritesheet generation.

Input: assets-source/mascot/xiaoyue-strips/*.png
       2-row grid: 5 frames top, 4 frames bottom, left-aligned
       Each strip has 9 frames total.

Output: assets-source/mascot/xiaoyue-animations/<state>/frame-00.png ... frame-08.png
"""

from PIL import Image
import os
import shutil

# Paths
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STRIP_DIR = os.path.join(ROOT, 'assets-source', 'mascot', 'xiaoyue-strips')
OUTPUT_DIR = os.path.join(ROOT, 'assets-source', 'mascot', 'xiaoyue-animations')

# State name mapping from filename
STATE_MAP = {
    'celebrate sprite': 'celebrate',
    'coach sprite': 'coach',
    'curious sprite': 'curious',
    'idle breathing sprite': 'idle',
    'intro sprite': 'intro',
    'listening sprite': 'listening',
    'nod sprite': 'nod',
    'surprise sprite': 'surprised',
    'thinking sprite': 'thinking',
}

TARGET_SIZE = 200
FILL_RATIO = 0.92  # Content fills 92% of the target frame (small padding)

def find_horizontal_divider(alpha, w, h):
    """Find the horizontal gap between top and bottom rows."""
    row_sums = []
    for y in range(h):
        s = sum(alpha.getpixel((x, y)) for x in range(w))
        row_sums.append(s)
    mid_start = h // 3
    mid_end = 2 * h // 3
    min_idx = mid_start
    min_val = row_sums[mid_start]
    for i in range(mid_start, mid_end):
        if row_sums[i] < min_val:
            min_val = row_sums[i]
            min_idx = i
    return min_idx

def find_gaps_in_row(alpha, w, y0, y1):
    """Find vertical gaps between frames within a row."""
    col_sums = []
    for x in range(w):
        s = sum(alpha.getpixel((x, y)) for y in range(y0, y1))
        col_sums.append(s)
    max_sum = max(col_sums) if max(col_sums) > 0 else 1
    normalized = [s / max_sum for s in col_sums]
    threshold = 0.05
    in_gap = False
    gaps = []
    for i, v in enumerate(normalized):
        if v < threshold and not in_gap:
            gap_start = i
            in_gap = True
        elif v >= threshold and in_gap:
            gaps.append((gap_start, i))
            in_gap = False
    if in_gap:
        gaps.append((gap_start, len(normalized)))
    return gaps

def extract_frames_from_strip(strip_path):
    """Extract 9 frames from a 2-row strip (5 top + 4 bottom)."""
    img = Image.open(strip_path)
    alpha = list(img.split())[-1]
    w, h = img.size
    divider_y = find_horizontal_divider(alpha, w, h)
    
    top_gaps = find_gaps_in_row(alpha, w, 0, divider_y)
    top_frames = []
    for i in range(len(top_gaps) - 1):
        left = top_gaps[i][1]
        right = top_gaps[i + 1][0]
        top_frames.append(img.crop((left, 0, right, divider_y)))
    
    bottom_gaps = find_gaps_in_row(alpha, w, divider_y, h)
    bottom_frames = []
    for i in range(len(bottom_gaps) - 1):
        left = bottom_gaps[i][1]
        right = bottom_gaps[i + 1][0]
        bottom_frames.append(img.crop((left, divider_y, right, h)))
    
    frames = top_frames + bottom_frames
    return frames

def get_content_bbox(img):
    """Get bounding box of non-transparent pixels."""
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    alpha = list(img.split())[-1]
    return alpha.getbbox()

def center_and_scale_frame(frame, target_size=200, fill_ratio=0.92):
    """
    Extract content from frame, scale it to fill the target canvas,
    and center it. Eliminates drift by aligning all frames to the same
    content-relative position.
    """
    if frame.mode != 'RGBA':
        frame = frame.convert('RGBA')
    
    bbox = get_content_bbox(frame)
    if not bbox:
        # Empty frame
        return frame.resize((target_size, target_size), Image.LANCZOS)
    
    # Crop to content with small margin
    margin = 2
    left = max(0, bbox[0] - margin)
    top = max(0, bbox[1] - margin)
    right = min(frame.width, bbox[2] + margin)
    bottom = min(frame.height, bbox[3] + margin)
    content = frame.crop((left, top, right, bottom))
    
    content_w = content.width
    content_h = content.height
    
    # Calculate scale to fill target canvas at fill_ratio
    target_content_size = int(target_size * fill_ratio)
    scale = min(target_content_size / content_w, target_content_size / content_h)
    
    new_w = max(1, int(content_w * scale))
    new_h = max(1, int(content_h * scale))
    
    # Scale up using high-quality resampling
    scaled = content.resize((new_w, new_h), Image.LANCZOS)
    
    # Center on transparent canvas
    canvas = Image.new('RGBA', (target_size, target_size), (0, 0, 0, 0))
    paste_x = (target_size - new_w) // 2
    paste_y = (target_size - new_h) // 2
    canvas.paste(scaled, (paste_x, paste_y), scaled)
    return canvas

def process_all_strips():
    strip_files = sorted([f for f in os.listdir(STRIP_DIR) if f.endswith('.png') and not f.startswith('.')])
    
    for strip_file in strip_files:
        base_name = os.path.splitext(strip_file)[0]
        if base_name not in STATE_MAP:
            print(f"Skipping unknown strip: {strip_file}")
            continue
        
        state_name = STATE_MAP[base_name]
        strip_path = os.path.join(STRIP_DIR, strip_file)
        
        print(f"\nProcessing {strip_file} → {state_name}")
        
        try:
            raw_frames = extract_frames_from_strip(strip_path)
        except Exception as e:
            print(f"  ERROR extracting frames: {e}")
            continue
        
        if len(raw_frames) != 9:
            print(f"  WARNING: expected 9 frames, got {len(raw_frames)}")
        
        centered_frames = [center_and_scale_frame(f, TARGET_SIZE, FILL_RATIO) for f in raw_frames]
        
        state_dir = os.path.join(OUTPUT_DIR, state_name)
        if os.path.exists(state_dir):
            shutil.rmtree(state_dir)
        os.makedirs(state_dir, exist_ok=True)
        
        for i, frame in enumerate(centered_frames):
            frame_path = os.path.join(state_dir, f"frame-{i:02d}.png")
            frame.save(frame_path, 'PNG')
        
        print(f"  Saved {len(centered_frames)} frames to {state_dir}")

if __name__ == '__main__':
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    process_all_strips()
    print("\nDone! Next: run generate-xiaoyue-spritesheet.mjs")
