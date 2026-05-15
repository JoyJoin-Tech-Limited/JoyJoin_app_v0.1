#!/usr/bin/env node
/**
 * Extract 9 frames from Xiaoyue 2-row sprite strips with ZERO drift.
 *
 * Uses alpha-channel gap detection for precise frame boundaries,
 * then applies a SHARED content bounding box across all frames
 * so the mascot stays perfectly centered with no positional drift.
 *
 * Input:  assets-source/mascot/xiaoyue-strips/*.png
 * Output: assets-source/mascot/xiaoyue-animations/<state>/frame-00.png ... frame-08.png
 *
 * Usage (from apps/mini-program):
 *   node scripts/extract-xiaoyue-strip-frames.mjs
 *   node scripts/extract-xiaoyue-strip-frames.mjs --state intro
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const STRIP_DIR = path.join(ROOT, 'assets-source/mascot/xiaoyue-strips')
const OUTPUT_DIR = path.join(ROOT, 'assets-source/mascot/xiaoyue-animations')

const TARGET_SIZE = 200
const FILL_RATIO = 0.95

const STATE_MAP = {
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

function findHorizontalDivider(alpha, w, h) {
  const rowSums = []
  for (let y = 0; y < h; y++) {
    let s = 0
    for (let x = 0; x < w; x++) {
      s += alpha[y * w + x]
    }
    rowSums.push(s)
  }
  const midStart = Math.floor(h / 3)
  const midEnd = Math.floor(2 * h / 3)
  let minIdx = midStart
  let minVal = rowSums[midStart]
  for (let i = midStart; i < midEnd; i++) {
    if (rowSums[i] < minVal) {
      minVal = rowSums[i]
      minIdx = i
    }
  }
  return minIdx
}

function findGapsInRow(alpha, w, y0, y1) {
  const colSums = []
  for (let x = 0; x < w; x++) {
    let s = 0
    for (let y = y0; y < y1; y++) {
      s += alpha[y * w + x]
    }
    colSums.push(s)
  }
  const maxSum = Math.max(...colSums) || 1
  const threshold = 0.05
  let inGap = false
  let gapStart = 0
  const gaps = []
  for (let i = 0; i < colSums.length; i++) {
    const v = colSums[i] / maxSum
    if (v < threshold && !inGap) {
      gapStart = i
      inGap = true
    } else if (v >= threshold && inGap) {
      gaps.push([gapStart, i])
      inGap = false
    }
  }
  if (inGap) {
    gaps.push([gapStart, colSums.length])
  }
  return gaps
}

function extractFrames(stripPath, sharp) {
  return sharp(stripPath)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => {
      const w = info.width
      const h = info.height
      const alpha = new Uint8Array(w * h)
      for (let i = 0; i < w * h; i++) {
        alpha[i] = data[i * 4 + 3]
      }

      const dividerY = findHorizontalDivider(alpha, w, h)

      const topGaps = findGapsInRow(alpha, w, 0, dividerY)
      const topFrames = []
      for (let i = 0; i < topGaps.length - 1; i++) {
        const left = topGaps[i][1]
        const right = topGaps[i + 1][0]
        topFrames.push({ left, top: 0, width: right - left, height: dividerY })
      }

      const bottomGaps = findGapsInRow(alpha, w, dividerY, h)
      const bottomFrames = []
      for (let i = 0; i < bottomGaps.length - 1; i++) {
        const left = bottomGaps[i][1]
        const right = bottomGaps[i + 1][0]
        bottomFrames.push({ left, top: dividerY, width: right - left, height: h - dividerY })
      }

      return topFrames.concat(bottomFrames)
    })
}

function getContentBBox(buffer, w, h) {
  let minX = w, minY = h, maxX = 0, maxY = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = buffer[(y * w + x) * 4 + 3]
      if (alpha > 10) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (minX > maxX) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

async function processStrip(stripPath, stateName, sharp) {
  const stateOutDir = path.join(OUTPUT_DIR, stateName)
  fs.mkdirSync(stateOutDir, { recursive: true })

  // Clean existing frames
  const existing = fs.readdirSync(stateOutDir).filter(f => f.startsWith('frame-'))
  for (const f of existing) fs.unlinkSync(path.join(stateOutDir, f))

  const rawFrames = await extractFrames(stripPath, sharp)
  if (rawFrames.length !== 9) {
    console.warn(`  ⚠️ expected 9 frames, got ${rawFrames.length}`)
  }

  // Extract frame buffers and compute content bboxes
  const frames = []
  const bboxes = []
  for (let i = 0; i < rawFrames.length; i++) {
    const coords = rawFrames[i]
    const buffer = await sharp(stripPath)
      .extract(coords)
      .raw()
      .ensureAlpha()
      .toBuffer()

    const bbox = getContentBBox(buffer, coords.width, coords.height)
    frames.push({ buffer, coords, bbox })
    if (bbox) bboxes.push(bbox)
  }

  if (bboxes.length === 0) {
    console.warn(`  ⚠️ no content found in any frame`)
    return
  }

  // Compute SHARED crop dimensions (max content size across all frames)
  const maxContentW = Math.max(...bboxes.map(b => b.w))
  const maxContentH = Math.max(...bboxes.map(b => b.h))

  // Add small padding for breathing room
  const pad = 4
  const cropW = maxContentW + pad * 2
  const cropH = maxContentH + pad * 2

  // Target content size after scaling
  const targetContentSize = Math.round(TARGET_SIZE * FILL_RATIO)
  const scale = Math.min(targetContentSize / cropW, targetContentSize / cropH)
  const finalW = Math.max(1, Math.round(cropW * scale))
  const finalH = Math.max(1, Math.round(cropH * scale))

  for (let i = 0; i < frames.length; i++) {
    const { buffer, coords, bbox } = frames[i]
    if (!bbox) {
      console.warn(`  ⚠️ frame-${String(i).padStart(2, '0')}: empty`)
      continue
    }

    // Center the shared crop on this frame's content center
    const cx = bbox.x + bbox.w / 2
    const cy = bbox.y + bbox.h / 2

    let left = Math.round(cx - cropW / 2)
    let top = Math.round(cy - cropH / 2)
    let right = left + cropW
    let bottom = top + cropH

    // Clamp to source bounds
    let padLeft = 0, padTop = 0, padRight = 0, padBottom = 0
    if (left < 0) { padLeft = -left; left = 0 }
    if (top < 0) { padTop = -top; top = 0 }
    if (right > coords.width) { padRight = right - coords.width; right = coords.width }
    if (bottom > coords.height) { padBottom = bottom - coords.height; bottom = coords.height }

    const srcW = right - left
    const srcH = bottom - top

    // Build a square crop buffer with padding if needed
    const squareSize = Math.max(srcW + padLeft + padRight, srcH + padTop + padBottom)
    const squareBuffer = Buffer.alloc(squareSize * squareSize * 4, 0)

    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const srcIdx = ((top + y) * coords.width + (left + x)) * 4
        const dstIdx = ((padTop + y) * squareSize + (padLeft + x)) * 4
        squareBuffer[dstIdx] = buffer[srcIdx]
        squareBuffer[dstIdx + 1] = buffer[srcIdx + 1]
        squareBuffer[dstIdx + 2] = buffer[srcIdx + 2]
        squareBuffer[dstIdx + 3] = buffer[srcIdx + 3]
      }
    }

    // Resize to final frame size and save
    const outPath = path.join(stateOutDir, `frame-${String(i).padStart(2, '0')}.png`)
    await sharp(squareBuffer, { raw: { width: squareSize, height: squareSize, channels: 4 } })
      .resize(finalW, finalH, { fit: 'contain', position: 'center', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: Math.floor((TARGET_SIZE - finalH) / 2),
        bottom: Math.ceil((TARGET_SIZE - finalH) / 2),
        left: Math.floor((TARGET_SIZE - finalW) / 2),
        right: Math.ceil((TARGET_SIZE - finalW) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toFile(outPath)
  }

  console.log(`  ✓ ${stateName}: ${frames.length} frames → ${stateOutDir}`)
}

async function main() {
  const { default: sharp } = await import('sharp')

  const args = process.argv.slice(2)
  const targetState = args.includes('--state') ? args[args.indexOf('--state') + 1] : null

  const stripFiles = fs.readdirSync(STRIP_DIR)
    .filter(f => f.endsWith('.png') && !f.startsWith('.') && !f.includes('_grid'))
    .sort()

  if (stripFiles.length === 0) {
    console.error('No strip files found in', STRIP_DIR)
    process.exit(1)
  }

  console.log(`Found ${stripFiles.length} strip files:\n  ${stripFiles.join('\n  ')}\n`)

  for (const file of stripFiles) {
    const baseName = path.basename(file, '.png')
    const stateName = STATE_MAP[baseName]
    if (!stateName) {
      console.log(`Skipping unknown strip: ${file}`)
      continue
    }
    if (targetState && stateName !== targetState) continue

    const stripPath = path.join(STRIP_DIR, file)
    await processStrip(stripPath, stateName, sharp)
  }

  console.log('\n✅ Extraction complete. Next: generate spritesheets')
  console.log('   node scripts/generate-xiaoyue-spritesheet.mjs')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
