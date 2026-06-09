#!/usr/bin/env node
/**
 * Resize + WebP encode archetype PNGs for the mini-program.
 *
 * Export spec (keep in sync with visuals.ts):
 * - Max width 750px (preserves full source resolution, no upscale)
 * - WebP lossy, quality ~85, effort 6
 * - PNG fallback: full resolution for canvas drawImage fallback (CDN)
 *
 * Output goes to two locations:
 *   - CDN: src/assets/personality/archetypes/ (canvas drawImage, cache priming)
 *   - Local bundle: src/pages/onboarding/assets/archetypes/ (instant load during onboarding)
 *
 * Usage (from apps/mini-program):
 *   npm run optimize:archetypes
 *
 * Requires: sharp (devDependency). Place PNG masters in assets-source/personality/archetypes/
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
const INPUT_DIR = path.join(ROOT, 'assets-source/personality/archetypes')
const CDN_OUTPUT_DIR = path.join(ROOT, 'src/assets/personality/archetypes')
const LOCAL_OUTPUT_DIR = path.join(ROOT, 'src/pages/onboarding/assets/archetypes')

const MAX_WIDTH = 750
const WEBP_QUALITY = 85
const WEBP_EFFORT = 6
const PNG_QUALITY = 80
const PNG_EFFORT = 10

/** Basenames matching ARCHETYPE_ASSET_MAP keys in visuals.ts (input .png → output .webp + .png) */
const MANIFEST = [
  'archetype-corgi',
  'archetype-rooster',
  'archetype-hamster_praise',
  'archetype-fox',
  'archetype-dolphin_calm',
  'archetype-spider',
  'archetype-koala',
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
    const outputWebpCdn = path.join(CDN_OUTPUT_DIR, `${base}.webp`)
    const outputWebpLocal = path.join(LOCAL_OUTPUT_DIR, `${base}.webp`)
    const outputPng = path.join(CDN_OUTPUT_DIR, `${base}.png`)

    if (!fs.existsSync(inputPng)) {
      console.error(`Missing input: ${inputPng}`)
      process.exitCode = 1
      continue
    }

    const inputStat = fs.statSync(inputPng)
    totalIn += inputStat.size

    // 1. Generate optimized WebP (primary format for display) — CDN + local bundle
    const pipeline = sharp(inputPng).resize({
      width: MAX_WIDTH,
      withoutEnlargement: true,
      fit: 'inside',
    })

    const webpBuf = await pipeline
      .clone()
      .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT, alphaQuality: 100 })
      .toBuffer()

    fs.writeFileSync(outputWebpCdn, webpBuf)
    fs.writeFileSync(outputWebpLocal, webpBuf)

    const webpStat = fs.statSync(outputWebpCdn)
    totalWebp += webpStat.size

    // 2. Generate compressed PNG fallback (for canvas drawImage) — CDN only
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
