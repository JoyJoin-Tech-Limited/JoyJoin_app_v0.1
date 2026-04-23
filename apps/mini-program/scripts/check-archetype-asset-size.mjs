#!/usr/bin/env node
/**
 * Guardrail: fail if any archetype raster under src/assets/personality/archetypes exceeds max bytes.
 *
 * Budget: 100 KiB for WebP (primary display format), 250 KiB for PNG (canvas fallback).
 * Run in CI or pre-commit to catch oversized assets before merge.
 *
 * Usage (from apps/mini-program):
 *   npm run check:archetype-assets
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const WEBP_DIR = path.join(ROOT, 'src/assets/personality/archetypes')
const PNG_DIR = path.join(ROOT, 'src/pages/onboarding/assets/archetypes')

const MAX_WEBP_BYTES = 100 * 1024
const MAX_PNG_BYTES = 250 * 1024

function checkDir(dir, extFilter, maxBytes, badList) {
  if (!fs.existsSync(dir)) {
    console.error(`Missing directory: ${dir}`)
    process.exit(1)
  }

  for (const name of fs.readdirSync(dir)) {
    const ext = path.extname(name).toLowerCase()
    const full = path.join(dir, name)
    if (!fs.statSync(full).isFile()) continue
    if (ext !== extFilter) continue

    const size = fs.statSync(full).size
    if (size > maxBytes) {
      badList.push({ name, size })
    }
  }
}

function main() {
  const webpBad = []
  const pngBad = []

  checkDir(WEBP_DIR, '.webp', MAX_WEBP_BYTES, webpBad)
  checkDir(PNG_DIR, '.png', MAX_PNG_BYTES, pngBad)

  let failed = false

  if (webpBad.length > 0) {
    console.error(`Archetype WebP assets exceed size budget (${MAX_WEBP_BYTES / 1024} KiB):`)
    for (const { name, size } of webpBad) {
      console.error(`  ${name}  ${(size / 1024).toFixed(1)} KiB`)
    }
    console.error(`Run 'npm run optimize:archetypes' to compress.\n`)
    failed = true
  }

  if (pngBad.length > 0) {
    console.error(`Archetype PNG assets exceed size budget (${MAX_PNG_BYTES / 1024} KiB):`)
    for (const { name, size } of pngBad) {
      console.error(`  ${name}  ${(size / 1024).toFixed(1)} KiB`)
    }
    console.error(`Run 'npm run optimize:archetypes' to compress.\n`)
    failed = true
  }

  if (failed) {
    process.exit(1)
  }

  console.log(
    'Archetype asset size check OK (webp max %d KiB, png max %d KiB).',
    MAX_WEBP_BYTES / 1024,
    MAX_PNG_BYTES / 1024,
  )
}

main()
