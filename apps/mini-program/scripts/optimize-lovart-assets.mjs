#!/usr/bin/env node
/**
 * Optimize Lovart-generated PNG assets for the mini-program.
 *
 * Workflow:
 *   1. Download PNG masters from Lovart → assets-source/lovart/
 *   2. Run: npm run optimize:lovart
 *   3. Optimized WebP + compressed PNG are written to src/assets/lovart/
 *
 * Output spec:
 *   - WebP: resize to 800px max, quality 85, effort 6 — target ~30–100KB
 *   - PNG fallback: quality 80, effort 10 — target ~150–350KB
 *
 * Requires: sharp (devDependency).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const INPUT_DIR = path.join(ROOT, 'assets-source/lovart')
const OUTPUT_DIR = path.join(ROOT, 'src/assets/lovart')

const MAX_WIDTH = 800
const WEBP_QUALITY = 85
const WEBP_EFFORT = 6
const PNG_QUALITY = 80
const PNG_EFFORT = 10

async function main() {
  const { default: sharp } = await import('sharp')

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`Missing input directory: ${INPUT_DIR}`)
    console.error('Place Lovart PNG masters here before running.')
    process.exit(1)
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  const files = fs.readdirSync(INPUT_DIR).filter((f) => f.toLowerCase().endsWith('.png'))

  if (files.length === 0) {
    console.log('No PNG files found in', INPUT_DIR)
    return
  }

  let totalIn = 0
  let totalWebp = 0
  let totalPng = 0

  for (const file of files) {
    const inputPath = path.join(INPUT_DIR, file)
    const base = path.basename(file, '.png')
    const outputWebp = path.join(OUTPUT_DIR, `${base}.webp`)
    const outputPng = path.join(OUTPUT_DIR, `${base}.png`)

    const inputStat = fs.statSync(inputPath)
    totalIn += inputStat.size

    // 1. Generate optimized WebP (resized, primary format for mini-program)
    await sharp(inputPath)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true, fit: 'inside' })
      .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT, alphaQuality: 100 })
      .toFile(outputWebp)

    const webpStat = fs.statSync(outputWebp)
    totalWebp += webpStat.size

    // 2. Generate compressed PNG fallback
    const pngBuf = await sharp(inputPath)
      .png({ compressionLevel: 9, quality: PNG_QUALITY, effort: PNG_EFFORT })
      .toBuffer()
    fs.writeFileSync(outputPng, pngBuf)

    const pngStat = fs.statSync(outputPng)
    totalPng += pngStat.size

    console.log(
      `${base}:  ${(inputStat.size / 1024).toFixed(0)}KB raw → ` +
        `${(webpStat.size / 1024).toFixed(0)}KB webp + ${(pngStat.size / 1024).toFixed(0)}KB png ` +
        `(${((webpStat.size / inputStat.size) * 100).toFixed(0)}% webp)`,
    )
  }

  console.log(
    `\nTotal: ${files.length} file(s) — ` +
      `${(totalIn / 1024).toFixed(0)}KB raw → ` +
      `${(totalWebp / 1024).toFixed(0)}KB webp + ${(totalPng / 1024).toFixed(0)}KB png ` +
      `(${((totalWebp / totalIn) * 100).toFixed(0)}% webp compression)`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
