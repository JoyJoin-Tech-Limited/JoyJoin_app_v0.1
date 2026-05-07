#!/usr/bin/env node
/**
 * Resize + WebP encode Xiaoyue mascot PNGs for the mini-program.
 *
 * Export spec (keep in sync with xiaoyueExpressions.ts comments):
 * - Max width 480px (height proportional, no upscale)
 * - WebP lossy, quality ~85, effort 6
 * - Targets ~50–250KB per file for UI display (largest slot ~300rpx intro)
 *
 * Usage (from apps/mini-program):
 *   npm run optimize:xiaoyue
 *
 * Requires: sharp (devDependency). Place PNG masters next to output (same names as MANIFEST)
 * before running; the repo ships `.webp` only — re-run after updating masters.
 *
 * Manual smoke (WeChat devtools): landing, personality intro, loading shell, matching pending,
 * payment verification — mascots should load sharp with no broken image.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const INPUT_DIR = path.join(ROOT, 'assets-source/personality/xiaoyue')
const OUTPUT_DIR = path.join(ROOT, 'src/assets/personality/xiaoyue')

const MAX_WIDTH = 480
const WEBP_QUALITY = 85
const WEBP_EFFORT = 6

/** Basenames matching ART keys in xiaoyueExpressions.ts (input .png → output .webp) */
const MANIFEST = [
  'xiaoyue-home-welcome',
  'xiaoyue-coach-guide',
  'xiaoyue-loading-system',
  'xiaoyue-loading-reveal',
  'xiaoyue-match-waiting',
  'xiaoyue-match-success',
  'xiaoyue-action-success',
  'xiaoyue-action-failure',
  'xiaoyue-thanks-feedback',
  'xiaoyue-neutral-information',
  'xiaoyue-test-curious',
  'xiaoyue-test-listening',
  'xiaoyue-test-nod',
  'xiaoyue-test-surprised',
  'xiaoyue-opt-out-reassure',
  'xiaoyue-payment-trust',
  'xiaoyue-connections-empty',
]

async function main() {
  const { default: sharp } = await import('sharp')

  for (const base of MANIFEST) {
    const inputPng = path.join(INPUT_DIR, `${base}.png`)
    const outputWebp = path.join(OUTPUT_DIR, `${base}.webp`)

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
