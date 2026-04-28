#!/usr/bin/env node
/**
 * Generate a spritesheet of archetype thumbnails for the slot animation.
 *
 * Reduces GPU memory pressure by loading a single ~30KB image instead of
 * 12 full-size textures cycling during the slot spin.
 *
 * Layout: 3×4 grid, 60×60px per thumbnail with 4px padding
 * Output: WebP primary + PNG fallback
 *
 * Usage (from apps/mini-program):
 *   npm run generate:spritesheet
 *
 * Requires: sharp (devDependency)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const INPUT_DIR = path.join(ROOT, 'raw-assets/personality/archetypes')
const OUTPUT_DIR = path.join(ROOT, 'src/assets/personality/archetypes')

const THUMB_SIZE = 60
const PADDING = 4
const COLS = 3
const ROWS = 4

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

const ARCHETYPE_ORDER = [
  'corgi',
  'rooster',
  'hamster_praise',
  'fox',
  'dolphin_calm',
  'spider',
  'koala',
  'octopus',
  'owl',
  'elephant',
  'turtle',
  'cat',
]

async function main() {
  const { default: sharp } = await import('sharp')

  const cellSize = THUMB_SIZE + PADDING * 2
  const sheetWidth = COLS * cellSize
  const sheetHeight = ROWS * cellSize

  // Create transparent canvas
  let composite = sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })

  const overlays = []
  const mapping = {}

  for (let i = 0; i < MANIFEST.length; i++) {
    const base = MANIFEST[i]
    const inputPng = path.join(INPUT_DIR, `${base}.png`)

    if (!fs.existsSync(inputPng)) {
      console.error(`Missing input: ${inputPng}`)
      process.exitCode = 1
      continue
    }

    const resized = await sharp(inputPng)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover', position: 'center' })
      .toBuffer()

    const col = i % COLS
    const row = Math.floor(i / COLS)
    const left = col * cellSize + PADDING
    const top = row * cellSize + PADDING

    overlays.push({ input: resized, left, top })

    // Build mapping: archetype name → { x, y, width, height }
    mapping[ARCHETYPE_ORDER[i]] = {
      x: left,
      y: top,
      width: THUMB_SIZE,
      height: THUMB_SIZE,
    }
  }

  if (process.exitCode === 1) {
    process.exit(1)
  }

  composite = composite.composite(overlays)

  // Generate WebP
  const webpPath = path.join(OUTPUT_DIR, 'archetype-spritesheet.webp')
  await composite
    .clone()
    .webp({ quality: 85, effort: 6, alphaQuality: 100 })
    .toFile(webpPath)

  // Generate PNG fallback
  const pngPath = path.join(OUTPUT_DIR, 'archetype-spritesheet.png')
  await composite
    .clone()
    .png({ compressionLevel: 9 })
    .toFile(pngPath)

  const webpStat = fs.statSync(webpPath)
  const pngStat = fs.statSync(pngPath)

  console.log(`Spritesheet: ${sheetWidth}×${sheetHeight}px`)
  console.log(`  WebP: ${(webpStat.size / 1024).toFixed(1)}KB → ${webpPath}`)
  console.log(`  PNG:  ${(pngStat.size / 1024).toFixed(1)}KB → ${pngPath}`)

  // Write manifest JSON for SlotStage consumption
  const manifestPath = path.join(OUTPUT_DIR, 'archetype-spritesheet.json')
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        version: 1,
        grid: { cols: COLS, rows: ROWS, cellSize, thumbSize: THUMB_SIZE, padding: PADDING },
        sheet: { width: sheetWidth, height: sheetHeight },
        mapping,
      },
      null,
      2,
    ),
  )
  console.log(`  Manifest: ${manifestPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
