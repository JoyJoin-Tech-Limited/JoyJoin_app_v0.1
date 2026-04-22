#!/usr/bin/env node
/**
 * Guardrail: fail if any Lovart asset under src/assets/lovart exceeds max bytes.
 *
 * Default max: 400 KiB for PNG masters, 200 KiB for optimized outputs.
 * Run in CI or pre-commit to catch oversized assets before merge.
 *
 * Usage (from apps/mini-program):
 *   npm run check:lovart-assets
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const RAW_DIR = path.join(ROOT, 'raw-assets/lovart')
const OUT_DIRS = [
  path.join(ROOT, 'src/assets/lovart'),
  path.join(ROOT, 'src/assets/empty-state'),
  path.join(ROOT, 'src/assets/matching'),
]

const MAX_RAW_BYTES = 400 * 1024
const MAX_OUT_BYTES = 250 * 1024

function checkDir(dir, maxBytes, label) {
  if (!fs.existsSync(dir)) {
    return []
  }

  const bad = []
  for (const name of fs.readdirSync(dir)) {
    const ext = path.extname(name).toLowerCase()
    if (!['.png', '.webp', '.jpg', '.jpeg'].includes(ext)) continue
    const full = path.join(dir, name)
    if (!fs.statSync(full).isFile()) continue
    const size = fs.statSync(full).size
    if (size > maxBytes) {
      bad.push({ name: `${path.basename(dir)}/${name}`, size, max: maxBytes })
    }
  }
  return bad
}

function main() {
  const rawBad = checkDir(RAW_DIR, MAX_RAW_BYTES, 'raw')
  const outBad = OUT_DIRS.flatMap((dir) => checkDir(dir, MAX_OUT_BYTES, 'optimized'))

  let failed = false

  if (rawBad.length > 0) {
    console.error(`Lovart raw assets exceed size budget (${MAX_RAW_BYTES / 1024} KiB):`)
    for (const { name, size } of rawBad) {
      console.error(`  ${name}  ${(size / 1024).toFixed(1)} KiB`)
    }
    console.error(`Run 'npm run optimize:lovart' to compress.\n`)
    failed = true
  }

  if (outBad.length > 0) {
    console.error(`Optimized assets exceed size budget (${MAX_OUT_BYTES / 1024} KiB):`)
    for (const { name, size } of outBad) {
      console.error(`  ${name}  ${(size / 1024).toFixed(1)} KiB`)
    }
    console.error(`Re-run 'npm run optimize:lovart' or lower quality settings.\n`)
    failed = true
  }

  if (failed) {
    process.exit(1)
  }

  console.log(
    'Asset size check OK (raw max %d KiB, optimized max %d KiB).',
    MAX_RAW_BYTES / 1024,
    MAX_OUT_BYTES / 1024,
  )
}

main()
