#!/usr/bin/env node
/**
 * Resize + WebP encode archetype PNGs for the mini-program.
 *
 * Export spec (keep in sync with visuals.ts):
 * - Max width 480px (height proportional, no upscale)
 * - WebP lossy, quality ~85, effort 6
 * - PNG fallback: quality 80, effort 10 — for canvas drawImage compatibility
 *
 * Usage (from apps/mini-program):
 *   npm run optimize:archetypes
 *
 * Requires: sharp (devDependency). Place PNG masters next to output (same names as MANIFEST)
 * before running; the repo ships `.webp` + `.png` fallback.
 *
 * Manual smoke (WeChat devtools): personality test results page, slot animation,
 * share poster generation — archetypes should render sharp with no broken image.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const INPUT_DIR = path.join(ROOT, 'raw-assets/personality/archetypes')
const WEBP_OUTPUT_DIR = path.join(ROOT, 'src/assets/personality/archetypes')
const PNG_OUTPUT_DIR = path.join(ROOT, 'src/pages/onboarding/assets/archetypes')

const MAX_WIDTH = 480
const WEBP_QUALITY = 85
const WEBP_EFFORT = 6
const PNG_QUALITY = 80
const PNG_EFFORT = 10

/** Basenames matching ARCHETYPE_ASSET_MAP keys in visuals.ts (input .png → output .webp + .png) */
const MANIFEST = [
  'archetype-corgi',
  'archetype-rooster',
  'archetype-praise-dolphin',
  'archetype-fox',
  'archetype-calm-dolphin',
  'archetype-spider',
  'archetype-bear',
  'archetype-octopus',
  'archetype-owl',
  'archetype-elephant',
  'archetype-turtle',
  'archetype-cat',
]

async function main() {
  const { default: sharp } = await import('sharp')

  let totalIn = 0
  let totalWebp = 0
  let totalPng = 0

  for (const base of MANIFEST) {
    const inputPng = path.join(INPUT_DIR, `${base}.png`)
    const outputWebp = path.join(WEBP_OUTPUT_DIR, `${base}.webp`)
    const outputPng = path.join(PNG_OUTPUT_DIR, `${base}.png`)

    if (!fs.existsSync(inputPng)) {
      console.error(`Missing input: ${inputPng}`)
      process.exitCode = 1
      continue
    }

    const inputStat = fs.statSync(inputPng)
    totalIn += inputStat.size

    // 1. Generate optimized WebP (primary format for display)
    const pipeline = sharp(inputPng).resize({
      width: MAX_WIDTH,
      withoutEnlargement: true,
      fit: 'inside',
    })

    await pipeline.webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT, alphaQuality: 100 }).toFile(outputWebp)

    const webpStat = fs.statSync(outputWebp)
    totalWebp += webpStat.size

    // 2. Generate compressed PNG fallback (for canvas drawImage)
    const pngBuf = await sharp(inputPng)
      .png({ compressionLevel: 9, quality: PNG_QUALITY, effort: PNG_EFFORT })
      .toBuffer()
    fs.writeFileSync(outputPng, pngBuf)

    const pngStat = fs.statSync(outputPng)
    totalPng += pngStat.size

    console.log(
      `${base}: ${(inputStat.size / 1024).toFixed(0)}KB raw → ` +
        `${(webpStat.size / 1024).toFixed(0)}KB webp + ${(pngStat.size / 1024).toFixed(0)}KB png ` +
        `(${(webpStat.size / inputStat.size * 100).toFixed(0)}% webp)`,
    )
  }

  console.log(
    `\nTotal: ${MANIFEST.length} files — ` +
      `${(totalIn / 1024).toFixed(0)}KB raw → ` +
      `${(totalWebp / 1024).toFixed(0)}KB webp + ${(totalPng / 1024).toFixed(0)}KB png ` +
      `(${(totalWebp / totalIn * 100).toFixed(0)}% webp compression)`,
  )

  if (process.exitCode === 1) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
