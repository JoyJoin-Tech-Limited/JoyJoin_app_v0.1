#!/usr/bin/env node
/**
 * Generate archetype head icons (240×240px) from full-body PNG masters.
 *
 * Extraction strategy:
 *   - Find the bounding box of non-transparent pixels in the source PNG
 *   - Crop to that content region
 *   - Scale with "contain" fit onto a 240×240 transparent canvas so the
 *     full character head stays visible inside a circular badge
 *   - Output WebP primary to src/assets/icons/archetype/
 *
 * The 240px resolution gives @2x crispness at 120rpx display size and
 * @1.5x acceptable quality at 180rpx (@3x devices). Previous 120×120
 * assets were only @1x, producing visible softness on retina screens.
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
const INPUT_DIR = path.join(ROOT, 'assets-source/personality/archetypes')
const OUTPUT_DIR = path.join(ROOT, 'src/assets/icons/archetype')

const HEAD_SIZE = 240

const MANIFEST = [
  { base: 'archetype-corgi', key: 'corgi' },
  { base: 'archetype-rooster', key: 'rooster' },
  { base: 'archetype-hamster_praise', key: 'hamster_praise' },
  { base: 'archetype-fox', key: 'fox' },
  { base: 'archetype-dolphin_calm', key: 'dolphin_calm' },
  { base: 'archetype-spider', key: 'spider' },
  { base: 'archetype-koala', key: 'koala' },
  { base: 'archetype-octopus', key: 'octopus' },
  { base: 'archetype-owl', key: 'owl' },
  { base: 'archetype-elephant', key: 'elephant' },
  { base: 'archetype-turtle', key: 'turtle' },
  { base: 'archetype-cat', key: 'cat' },
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

  let totalIn = 0
  let totalOut = 0

  for (const { base, key } of MANIFEST) {
    const inputPng = path.join(INPUT_DIR, `${base}.png`)
    const outputWebp = path.join(OUTPUT_DIR, `${base}-head.webp`)

    if (!fs.existsSync(inputPng)) {
      console.error(`Missing input: ${inputPng}`)
      process.exitCode = 1
      continue
    }

    const inputStat = fs.statSync(inputPng)
    totalIn += inputStat.size

    const inputSharp = sharp(inputPng)
    const bbox = await getContentBbox(inputSharp.clone())

    // Crop to content bbox, then contain-fit onto a 240x240 transparent canvas
    const croppedBuf = await inputSharp
      .extract(bbox)
      .toBuffer()

    const cropped = sharp(croppedBuf)
    const metadata = await cropped.metadata()
    const contentW = metadata.width
    const contentH = metadata.height
    const scale = Math.min(HEAD_SIZE / contentW, HEAD_SIZE / contentH)
    const resizeW = Math.round(contentW * scale)
    const resizeH = Math.round(contentH * scale)
    const left = Math.round((HEAD_SIZE - resizeW) / 2)
    const top = Math.round((HEAD_SIZE - resizeH) / 2)

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
      .composite([{ input: resizedBuf, left, top }])
      .webp({ quality: 85, effort: 6, alphaQuality: 100 })
      .toBuffer()

    fs.writeFileSync(outputWebp, webpBuf)

    const outStat = fs.statSync(outputWebp)
    totalOut += outStat.size

    console.log(
      `${key}: ${metadata.width}×${metadata.height} content → ${resizeW}×${resizeH} ` +
        `on ${HEAD_SIZE}×${HEAD_SIZE} canvas (${(outStat.size / 1024).toFixed(1)}KB)`,
    )
  }

  console.log(
    `\nTotal: ${MANIFEST.length} heads — ` +
      `${(totalIn / 1024).toFixed(0)}KB raw → ${(totalOut / 1024).toFixed(0)}KB webp`,
  )

  if (process.exitCode === 1) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
