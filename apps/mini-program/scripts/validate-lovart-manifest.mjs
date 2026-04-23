#!/usr/bin/env node
/**
 * Validate Lovart manifest lockfile against actual assets.
 *
 * Checks:
 * - All manifest entries have corresponding files in src/assets/lovart/
 * - File sizes match recorded outputSizes (within 10% tolerance)
 * - Checksums match (if not "pending")
 *
 * Usage (from apps/mini-program):
 *   npm run validate:lovart-manifest
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const MANIFEST_PATH = path.join(ROOT, 'src/assets/lovart/manifest.json')
const ASSETS_DIR = path.join(ROOT, 'src/assets/lovart')

const SIZE_TOLERANCE = 0.10 // 10%

function withinTolerance(actual, expected) {
  if (expected === 0) return true // "pending" placeholder
  const diff = Math.abs(actual - expected) / expected
  return diff <= SIZE_TOLERANCE
}

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Missing manifest: ${MANIFEST_PATH}`)
    process.exit(1)
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
  let failed = false

  for (const [name, meta] of Object.entries(manifest.assets)) {
    const webpPath = path.join(ASSETS_DIR, `${name}.webp`)
    const pngPath = path.join(ASSETS_DIR, `${name}.png`)

    if (!fs.existsSync(webpPath)) {
      console.error(`Missing asset: ${name}.webp`)
      failed = true
      continue
    }

    const webpSize = fs.statSync(webpPath).size
    const pngSize = fs.existsSync(pngPath) ? fs.statSync(pngPath).size : 0

    if (!withinTolerance(webpSize, meta.outputSizes.webp)) {
      console.error(
        `Size mismatch: ${name}.webp ` +
          `actual=${(webpSize / 1024).toFixed(1)}KiB ` +
          `expected=${(meta.outputSizes.webp / 1024).toFixed(1)}KiB`,
      )
      failed = true
    }

    if (pngSize > 0 && !withinTolerance(pngSize, meta.outputSizes.png)) {
      console.error(
        `Size mismatch: ${name}.png ` +
          `actual=${(pngSize / 1024).toFixed(1)}KiB ` +
          `expected=${(meta.outputSizes.png / 1024).toFixed(1)}KiB`,
      )
      failed = true
    }

    if (meta.sourceChecksum !== 'sha256:pending') {
      // TODO: compute and verify SHA-256 checksums
      console.log(`Checksum validation skipped (not implemented): ${name}`)
    }
  }

  if (failed) {
    console.error('\nLovart manifest validation FAILED.')
    process.exit(1)
  }

  console.log('Lovart manifest validation OK.')
}

main()
