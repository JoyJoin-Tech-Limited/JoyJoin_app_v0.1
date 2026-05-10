#!/usr/bin/env node
/**
 * Extract 9 frames from Lovart grid images + remove checkerboard background.
 *
 * Grid layout: 2560×1024, 5 frames top row + 4 frames bottom row
 * Each cell center: spaced at 512px intervals
 * Characters overlap across cells — we use generous crops + connected-component
 * isolation to extract each character without adjacent bleed.
 *
 * Output: 200×200 transparent PNGs
 *
 * Usage:
 *   node scripts/extract-and-clean-xiaoyue-grid.mjs
 *   node scripts/extract-and-clean-xiaoyue-grid.mjs --state idle
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const STRIPS_DIR = path.join(ROOT, 'assets-source/mascot/xiaoyue-strips')
const OUTPUT_DIR = path.join(ROOT, 'assets-source/mascot/xiaoyue-animations')

const GRID_W = 2560
const GRID_H = 1024
const CELL_W = 512
const CELL_H = 512
const TOP_ROW_COUNT = 5
const BOTTOM_ROW_COUNT = 4
const OUTPUT_SIZE = 200
const CORNER_SAMPLE_SIZE = 32
const BG_THRESHOLD = 30
const EDGE_SOFTNESS = 20
/** Extraction crop size per frame. Large enough to capture full character. */
const CROP_SIZE = 640
/** Padding around detected character bounding box */
const BBOX_PAD = 20

/** Map grid filename → state name */
function resolveStateName(filename) {
  const base = path.basename(filename, '.png')
  if (base.includes('idle')) return 'idle'
  if (base.includes('curious')) return 'curious'
  if (base.includes('listening')) return 'listening'
  if (base.includes('thinking')) return 'thinking'
  if (base.includes('nod')) return 'nod'
  if (base.includes('celebrate')) return 'celebrate'
  if (base.includes('surprised')) return 'surprised'
  if (base.includes('coach')) return 'coach'
  if (base.includes('intro')) return 'intro'
  throw new Error(`Cannot resolve state name from: ${filename}`)
}

/** Compute centered crop coordinates for frame index (0-8) */
function getCellCoords(frameIndex) {
  const col = frameIndex < TOP_ROW_COUNT ? frameIndex : (frameIndex - TOP_ROW_COUNT)
  const row = frameIndex < TOP_ROW_COUNT ? 0 : 1

  const cellCenterX = col * CELL_W + CELL_W / 2
  const cellCenterY = row * CELL_H + CELL_H / 2

  let left = Math.round(cellCenterX - CROP_SIZE / 2)
  let top = Math.round(cellCenterY - CROP_SIZE / 2)
  let width = CROP_SIZE
  let height = CROP_SIZE

  if (left < 0) { left = 0 }
  if (top < 0) { top = 0 }
  if (left + width > GRID_W) { width = GRID_W - left }
  if (top + height > GRID_H) { height = GRID_H - top }

  return { left, top, width, height }
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

/** Sample corners to detect the two dominant checkerboard background colors */
async function detectBackgroundColors(frameBuffer, frameW, frameH) {
  const samples = []
  const corners = [
    { x: 0, y: 0 },
    { x: frameW - CORNER_SAMPLE_SIZE, y: 0 },
    { x: 0, y: frameH - CORNER_SAMPLE_SIZE },
    { x: frameW - CORNER_SAMPLE_SIZE, y: frameH - CORNER_SAMPLE_SIZE },
  ]

  for (const { x, y } of corners) {
    for (let dy = 0; dy < CORNER_SAMPLE_SIZE; dy++) {
      for (let dx = 0; dx < CORNER_SAMPLE_SIZE; dx++) {
        const px = x + dx
        const py = y + dy
        const idx = (py * frameW + px) * 4
        samples.push({
          r: frameBuffer[idx],
          g: frameBuffer[idx + 1],
          b: frameBuffer[idx + 2],
        })
      }
    }
  }

  const buckets = new Map()
  for (const { r, g, b } of samples) {
    const key = `${Math.round(r / 8) * 8},${Math.round(g / 8) * 8},${Math.round(b / 8) * 8}`
    buckets.set(key, (buckets.get(key) || 0) + 1)
  }

  const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1])
  const bgColors = sorted.slice(0, 2).map(([key]) => {
    const [r, g, b] = key.split(',').map(Number)
    return { r, g, b }
  })

  return bgColors
}

/** Remove background pixels matching detected checkerboard colors */
async function removeBackground(rawBuffer, width, height, bgColors) {
  const channels = 4
  const output = Buffer.from(rawBuffer)

  for (let i = 0; i < output.length; i += channels) {
    const r = output[i]
    const g = output[i + 1]
    const b = output[i + 2]

    let minDist = Infinity
    for (const bg of bgColors) {
      const d = colorDistance(r, g, b, bg.r, bg.g, bg.b)
      if (d < minDist) minDist = d
    }

    if (minDist < BG_THRESHOLD) {
      output[i + 3] = 0
    } else if (minDist < BG_THRESHOLD + EDGE_SOFTNESS) {
      const alpha = Math.round(255 * (minDist - BG_THRESHOLD) / EDGE_SOFTNESS)
      output[i + 3] = Math.max(0, Math.min(255, alpha))
    }
  }

  return output
}

/** Find bounding box of the largest connected component (alpha > threshold) */
function findLargestComponentBoundingBox(buffer, width, height, alphaThreshold = 10) {
  const visited = new Uint8Array(width * height)
  let best = null
  let bestArea = 0

  const getIdx = (x, y) => y * width + x
  const getAlpha = (x, y) => buffer[(getIdx(x, y) * 4) + 3]

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = getIdx(x, y)
      if (visited[idx] || getAlpha(x, y) <= alphaThreshold) continue

      let minX = x, maxX = x, minY = y, maxY = y
      let area = 0
      const queue = [{ x, y }]
      visited[idx] = 1

      while (queue.length > 0) {
        const { x: cx, y: cy } = queue.pop()
        area++
        if (cx < minX) minX = cx
        if (cx > maxX) maxX = cx
        if (cy < minY) minY = cy
        if (cy > maxY) maxY = cy

        const neighbors = [
          { x: cx + 1, y: cy },
          { x: cx - 1, y: cy },
          { x: cx, y: cy + 1 },
          { x: cx, y: cy - 1 },
        ]
        for (const n of neighbors) {
          if (n.x < 0 || n.x >= width || n.y < 0 || n.y >= height) continue
          const nIdx = getIdx(n.x, n.y)
          if (visited[nIdx] || getAlpha(n.x, n.y) <= alphaThreshold) continue
          visited[nIdx] = 1
          queue.push(n)
        }
      }

      if (area > bestArea) {
        bestArea = area
        best = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
      }
    }
  }

  return best
}

/** Crop buffer to a square bounding box with padding, centered on the component */
function cropToSquare(buffer, srcW, srcH, bbox, padding) {
  const channels = 4
  const centerX = bbox.x + bbox.w / 2
  const centerY = bbox.y + bbox.h / 2
  const halfSize = Math.max(bbox.w, bbox.h) / 2 + padding
  let size = Math.round(halfSize * 2)

  let left = Math.round(centerX - halfSize)
  let top = Math.round(centerY - halfSize)

  // Clamp to source bounds
  if (left < 0) left = 0
  if (top < 0) top = 0
  if (left + size > srcW) size = srcW - left
  if (top + size > srcH) size = srcH - top

  const output = Buffer.alloc(size * size * channels)

  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const srcX = left + dx
      const srcY = top + dy
      if (srcX < 0 || srcX >= srcW || srcY < 0 || srcY >= srcH) {
        const dstIdx = (dy * size + dx) * channels
        output[dstIdx + 3] = 0
        continue
      }
      const srcIdx = (srcY * srcW + srcX) * channels
      const dstIdx = (dy * size + dx) * channels
      output[dstIdx] = buffer[srcIdx]
      output[dstIdx + 1] = buffer[srcIdx + 1]
      output[dstIdx + 2] = buffer[srcIdx + 2]
      output[dstIdx + 3] = buffer[srcIdx + 3]
    }
  }

  return { buffer: output, size }
}

async function processGrid(gridPath, stateName, sharp) {
  const stateOutDir = path.join(OUTPUT_DIR, stateName)
  fs.mkdirSync(stateOutDir, { recursive: true })

  // Clean existing frames
  const existing = fs.readdirSync(stateOutDir).filter(f => f.startsWith('frame-'))
  for (const f of existing) fs.unlinkSync(path.join(stateOutDir, f))

  const totalFrames = TOP_ROW_COUNT + BOTTOM_ROW_COUNT
  console.log(`${stateName}: extracting ${totalFrames} frames...`)

  for (let i = 0; i < totalFrames; i++) {
    const coords = getCellCoords(i)

    // Extract generous crop
    const cellBuffer = await sharp(gridPath)
      .extract(coords)
      .raw()
      .ensureAlpha()
      .toBuffer()

    // Detect and remove checkerboard background
    const bgColors = await detectBackgroundColors(cellBuffer, coords.width, coords.height)
    const cleanedBuffer = await removeBackground(cellBuffer, coords.width, coords.height, bgColors)

    // Find main character component
    const bbox = findLargestComponentBoundingBox(cleanedBuffer, coords.width, coords.height)
    if (!bbox) {
      console.warn(`  ⚠️ frame-${String(i).padStart(2, '0')}: no character found`)
      continue
    }

    // Crop to square around character
    const { buffer: squareBuffer, size: squareSize } = cropToSquare(
      cleanedBuffer, coords.width, coords.height, bbox, BBOX_PAD
    )

    // Resize to output size and save
    const outPath = path.join(stateOutDir, `frame-${String(i).padStart(2, '0')}.png`)
    await sharp(squareBuffer, { raw: { width: squareSize, height: squareSize, channels: 4 } })
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'contain', position: 'center', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(outPath)
  }

  console.log(`  ✓ ${stateName}: ${totalFrames} frames → ${stateOutDir}`)
}

async function main() {
  const { default: sharp } = await import('sharp')

  const args = process.argv.slice(2)
  const targetState = args.includes('--state') ? args[args.indexOf('--state') + 1] : null

  const gridFiles = fs.readdirSync(STRIPS_DIR)
    .filter(f => f.endsWith('.png') && (f.includes('_sprite_grid') || f.includes('_grid')))
    .sort()

  if (gridFiles.length === 0) {
    console.error('No grid files found in', STRIPS_DIR)
    process.exit(1)
  }

  console.log(`Found ${gridFiles.length} grid files:\n  ${gridFiles.join('\n  ')}\n`)

  for (const file of gridFiles) {
    const stateName = resolveStateName(file)
    if (targetState && stateName !== targetState) continue

    const gridPath = path.join(STRIPS_DIR, file)
    await processGrid(gridPath, stateName, sharp)
  }

  console.log('\n✅ Extraction complete. Next: generate spritesheets')
  console.log('   node scripts/generate-xiaoyue-spritesheet.mjs')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
