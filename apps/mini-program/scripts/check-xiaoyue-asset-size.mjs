#!/usr/bin/env node
/**
 * Fail if any Xiaoyue raster under src/assets/personality/xiaoyue exceeds max bytes.
 * Default max: 400 KiB (plan guardrail).
 *
 * Usage (from apps/mini-program):
 *   npm run check:xiaoyue-assets
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIR = path.join(ROOT, 'src/assets/personality/xiaoyue')

const MAX_BYTES = 400 * 1024
const EXT = new Set(['.webp', '.png'])

function main() {
  if (!fs.existsSync(DIR)) {
    console.error(`Missing directory: ${DIR}`)
    process.exit(1)
  }

  const bad = []
  for (const name of fs.readdirSync(DIR)) {
    const ext = path.extname(name).toLowerCase()
    if (!EXT.has(ext)) continue
    const full = path.join(DIR, name)
    if (!fs.statSync(full).isFile()) continue
    const size = fs.statSync(full).size
    if (size > MAX_BYTES) {
      bad.push({ name, size })
    }
  }

  if (bad.length > 0) {
    console.error('Xiaoyue assets exceed size budget (%d KiB):', MAX_BYTES / 1024)
    for (const { name, size } of bad) {
      console.error(`  ${name}  ${(size / 1024).toFixed(1)} KiB`)
    }
    process.exit(1)
  }

  console.log('Xiaoyue asset size check OK (max %d KiB).', MAX_BYTES / 1024)
}

main()
