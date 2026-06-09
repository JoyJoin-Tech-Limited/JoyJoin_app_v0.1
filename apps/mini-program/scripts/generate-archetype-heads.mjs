#!/usr/bin/env node
/**
 * Generate archetype head icons (240×240px) from full-body PNG masters.
 *
 * Extraction strategy:
 *   - Crop the upper ~45% of each full-body illustration (head region)
 *   - Center-crop horizontally, then resize to 240×240 with cover fit
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
const CROP_TOP_RATIO = 0.45 // upper 45% of the illustration

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

    const metadata = await sharp(inputPng).metadata()
    const w = metadata.width
    const h = metadata.height

    // Crop the head region: top 45%, centered horizontally, square-ish region
    // Use the smaller of width/height*0.45 for crop height to avoid over-cropping
    const cropH = Math.round(h * CROP_TOP_RATIO)
    const cropW = Math.min(w, cropH)
    const left = Math.round((w - cropW) / 2)
    const top = 0

    const webpBuf = await sharp(inputPng)
      .extract({ left, top, width: cropW, height: cropH })
      .resize(HEAD_SIZE, HEAD_SIZE, { fit: 'cover', position: 'center' })
      .webp({ quality: 85, effort: 6, alphaQuality: 100 })
      .toBuffer()

    fs.writeFileSync(outputWebp, webpBuf)

    const outStat = fs.statSync(outputWebp)
    totalOut += outStat.size

    console.log(
      `${key}: ${w}×${h} raw → crop ${cropW}×${cropH} → ${HEAD_SIZE}×${HEAD_SIZE} webp ` +
        `(${(outStat.size / 1024).toFixed(1)}KB)`,
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
