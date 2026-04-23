#!/usr/bin/env node
/**
 * Encode large runtime PNGs to WebP for the WeChat mini-program package budget.
 *
 * Usage (from apps/mini-program):
 *   node scripts/optimize-runtime-raster-assets.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const WEBP_QUALITY = 84
const WEBP_EFFORT = 6

const MANIFEST = [
  { png: 'src/assets/promo/banner-ai-match-calculated.png', width: 960 },
  { png: 'src/assets/promo/banner-ai-match-same-frequency.png', width: 960 },
  { png: 'src/assets/promo/banner-ai-match-understands-you.png', width: 960 },
  { png: 'src/assets/empty-state/center-empty-bg.png', width: 900 },
  { png: 'src/assets/empty-state/center-empty-illustration.png', width: 900 },
  { png: 'src/assets/matching/matching-bg.png', width: 960 },
  { png: 'src/assets/matching/matching-waiting-hero.png', width: 860 },
  { png: 'src/assets/matching/matching-no-match-hero.png', width: 860 },
  { png: 'src/assets/qr/customer-service-support.png', width: 720 },
]

async function main() {
  const { default: sharp } = await import('sharp')

  for (const item of MANIFEST) {
    const inputPng = path.join(ROOT, item.png)
    const outputWebp = inputPng.replace(/\.png$/i, '.webp')

    if (!fs.existsSync(inputPng)) {
      console.error(`Missing input: ${inputPng}`)
      process.exitCode = 1
      continue
    }

    const inputStat = fs.statSync(inputPng)

    await sharp(inputPng)
      .resize({
        width: item.width,
        withoutEnlargement: true,
        fit: 'inside',
      })
      .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT, alphaQuality: 100 })
      .toFile(outputWebp)

    const outStat = fs.statSync(outputWebp)
    console.log(
      `${path.relative(ROOT, outputWebp)}  ${(inputStat.size / 1024).toFixed(0)}KB png → ${(outStat.size / 1024).toFixed(0)}KB webp`,
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
