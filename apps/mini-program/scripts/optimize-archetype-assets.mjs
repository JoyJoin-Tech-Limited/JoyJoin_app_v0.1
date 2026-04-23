#!/usr/bin/env node
/**
 * Resize + WebP encode onboarding archetype illustration PNGs for the mini-program.
 *
 * Usage (from apps/mini-program):
 *   npm run optimize:archetypes
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const ASSET_DIR = path.join(ROOT, 'src/assets/personality/archetypes')

const MAX_WIDTH = 720
const WEBP_QUALITY = 84
const WEBP_EFFORT = 6

async function main() {
  const { default: sharp } = await import('sharp')
  const entries = fs.readdirSync(ASSET_DIR).filter((name) => name.endsWith('.png')).sort()

  for (const name of entries) {
    const inputPng = path.join(ASSET_DIR, name)
    const outputWebp = inputPng.replace(/\.png$/i, '.webp')
    const inputStat = fs.statSync(inputPng)

    await sharp(inputPng)
      .resize({
        width: MAX_WIDTH,
        withoutEnlargement: true,
        fit: 'inside',
      })
      .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT, alphaQuality: 100 })
      .toFile(outputWebp)

    const outStat = fs.statSync(outputWebp)
    console.log(
      `${name.replace(/\.png$/i, '.webp')}  ${(inputStat.size / 1024).toFixed(0)}KB png → ${(outStat.size / 1024).toFixed(0)}KB webp`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
