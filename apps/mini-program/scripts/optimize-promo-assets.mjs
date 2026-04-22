#!/usr/bin/env node
/**
 * Generate WebP fallbacks for promo banner PNGs.
 *
 * Usage (from apps/mini-program):
 *   npm run optimize:promo
 *
 * Requires: sharp (devDependency).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const ASSET_DIR = path.join(ROOT, 'src/assets/promo')

const MAX_WIDTH = 750
const WEBP_QUALITY = 85
const WEBP_EFFORT = 6

const MANIFEST = [
  'banner-ai-match-calculated',
  'banner-ai-match-same-frequency',
  'banner-ai-match-understands-you',
]

async function main() {
  const { default: sharp } = await import('sharp')

  for (const base of MANIFEST) {
    const inputPng = path.join(ASSET_DIR, `${base}.png`)
    const outputWebp = path.join(ASSET_DIR, `${base}.webp`)

    if (!fs.existsSync(inputPng)) {
      console.error(`Missing input: ${inputPng}`)
      process.exitCode = 1
      continue
    }

    const inputStat = fs.statSync(inputPng)
    const pipeline = sharp(inputPng).resize({
      width: MAX_WIDTH,
      withoutEnlargement: true,
      fit: 'inside',
    })

    await pipeline.webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT, alphaQuality: 100 }).toFile(outputWebp)

    const outStat = fs.statSync(outputWebp)
    console.log(
      `${base}.webp  ${(inputStat.size / 1024).toFixed(0)}KB png → ${(outStat.size / 1024).toFixed(0)}KB webp`,
    )
  }

  if (process.exitCode === 1) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
