#!/usr/bin/env node
/**
 * Generate archetype head icons (240×240px) from the Lovart 4×3 grid sheet.
 *
 * Extraction strategy:
 *   - The source sheet is a 4×3 grid of head/bust portraits.
 *   - Each cell is cropped, then the non-transparent content bounding box is
 *     extracted and contain-fitted onto a 240×240 transparent canvas so the
 *     head stays fully visible inside a circular avatar.
 *   - Output WebP primary to src/assets/icons/archetype/
 *
 * The 240px resolution gives @2x crispness at 120rpx display size and
 * acceptable quality at 180rpx (@3x devices). WeChat downscales automatically;
 * no @2x/@3x suffixes are used (avoids the @3x@3x double-suffix bug).
 *
 * Usage (from apps/mini-program):
 *   node scripts/generate-archetype-heads.mjs
 *
 * Requires: sharp (devDependency)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const GRID_PATH = path.join(ROOT, 'assets-source/lovart/archetype/Archetype 4x3 grid.png')
const OUTPUT_DIR = path.join(ROOT, 'src/assets/icons/archetype')

const HEAD_SIZE = 240

/**
 * Row-major mapping from the 4×3 grid to canonical archetype keys.
 * Source of truth for the grid layout: ../../../docs/archive/design/lovart/tier1-grid-prompts-3x4.md
 */
const GRID_LAYOUT = [
  ['fox', 'corgi', 'turtle', 'rooster'],
  ['cat', 'koala', 'hamster_praise', 'dolphin_calm'],
  ['octopus', 'elephant', 'owl', 'spider'],
]

async function getContentBbox(sharpInstance) {
  const { data, info } = await sharpInstance
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = info
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  let hasPixel = false

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4
      const alpha = data[idx + 3]
      if (alpha > 10) {
        hasPixel = true
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  if (!hasPixel) {
    return { left: 0, top: 0, width, height }
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  }
}

async function main() {
  const { default: sharp } = await import('sharp')

  if (!fs.existsSync(GRID_PATH)) {
    console.error(`Missing source grid: ${GRID_PATH}`)
    process.exit(1)
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const grid = sharp(GRID_PATH)
  const gridMeta = await grid.metadata()
  const cellW = gridMeta.width / 4
  const cellH = gridMeta.height / 3

  let totalIn = 0
  let totalOut = 0

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const key = GRID_LAYOUT[row][col]
      const outputWebp = path.join(OUTPUT_DIR, `archetype-${key}-head.webp`)

      const left = Math.round(col * cellW)
      const top = Math.round(row * cellH)
      const width = Math.round((col + 1) * cellW) - left
      const height = Math.round((row + 1) * cellH) - top

      const cellBuf = await grid
        .clone()
        .extract({ left, top, width, height })
        .toBuffer()

      const cellSharp = sharp(cellBuf)
      const bbox = await getContentBbox(cellSharp.clone())

      const croppedBuf = await cellSharp.extract(bbox).toBuffer()
      const cropped = sharp(croppedBuf)
      const metadata = await cropped.metadata()
      const contentW = metadata.width
      const contentH = metadata.height
      const scale = Math.min(HEAD_SIZE / contentW, HEAD_SIZE / contentH)
      const resizeW = Math.round(contentW * scale)
      const resizeH = Math.round(contentH * scale)
      const offsetLeft = Math.round((HEAD_SIZE - resizeW) / 2)
      const offsetTop = Math.round((HEAD_SIZE - resizeH) / 2)

      const resizedBuf = await cropped
        .resize(resizeW, resizeH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer()

      const webpBuf = await sharp({
        create: {
          width: HEAD_SIZE,
          height: HEAD_SIZE,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([{ input: resizedBuf, left: offsetLeft, top: offsetTop }])
        .webp({ quality: 85, effort: 6, alphaQuality: 100 })
        .toBuffer()

      fs.writeFileSync(outputWebp, webpBuf)

      const outStat = fs.statSync(outputWebp)
      totalOut += outStat.size

      console.log(
        `${key}: cell ${width}×${height} → content ${contentW}×${contentH} → ` +
          `${resizeW}×${resizeH} on ${HEAD_SIZE}×${HEAD_SIZE} canvas (${(outStat.size / 1024).toFixed(1)}KB)`,
      )
    }
  }

  const gridStat = fs.statSync(GRID_PATH)
  totalIn += gridStat.size

  console.log(
    `\nTotal: ${GRID_LAYOUT.flat().length} heads — ` +
      `${(totalIn / 1024).toFixed(0)}KB grid → ${(totalOut / 1024).toFixed(0)}KB webp`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
