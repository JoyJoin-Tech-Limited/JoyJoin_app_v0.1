#!/usr/bin/env node
/**
 * Generate a spritesheet of archetype thumbnails for the slot animation.
 *
 * Reduces GPU memory pressure by loading a single image instead of
 * 12 full-size textures cycling during the slot spin.
 *
 * Layout: 3×4 grid, 120×120px per thumbnail with 4px padding
 * Output: WebP primary + PNG fallback
 *   - CDN path: src/assets/personality/archetypes/ (for canvas fallback, cache priming)
 *   - Local bundle: src/pages/onboarding/assets/archetypes/ (slot animation, immune to CDN staleness)
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
const INPUT_DIR = path.join(ROOT, 'assets-source/personality/archetypes')
const CDN_OUTPUT_DIR = path.join(ROOT, 'src/assets/personality/archetypes')
const LOCAL_OUTPUT_DIR = path.join(ROOT, 'src/pages/onboarding/assets/archetypes')

const THUMB_SIZE = 120
/**
 * Art fill size inside the thumb. Source PNGs ship with ~14% transparent
 * padding on every side, so a plain cover-resize leaves the character
 * floating in ~42% empty space inside the circular slot-card mask.
 * Trimming to the alpha bbox and scaling it to THUMB_FILL (≈92% of the
 * cell) makes the icons read as intact full-bleed portraits. Verified
 * against all 12 archetypes: zero art is clipped by the 60px inscribed
 * circle at fills ≤112px.
 */
const THUMB_FILL = 110
const TRIM_ALPHA_THRESHOLD = 10
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

    // Trim transparent margins so the character fills the circular mask
    // instead of floating in empty space (source art ships with ~14%
    // padding on every side).
    const { data, info } = await sharp(inputPng)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    let minX = info.width
    let minY = info.height
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const alpha = data[(y * info.width + x) * 4 + 3]
        if (alpha > TRIM_ALPHA_THRESHOLD) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }

    const bboxW = maxX - minX + 1
    const bboxH = maxY - minY + 1
    const artScale = THUMB_FILL / Math.max(bboxW, bboxH)
    const artW = Math.max(1, Math.round(bboxW * artScale))
    const artH = Math.max(1, Math.round(bboxH * artScale))

    const trimmed = await sharp(inputPng)
      .extract({ left: minX, top: minY, width: bboxW, height: bboxH })
      .resize(artW, artH, { fit: 'fill' })
      .toBuffer()

    // Center the trimmed art on a transparent 120×120 thumb so the cell
    // grid (cellSize 128, thumbSize 120, padding 4) stays byte-identical
    // in shape — the manifest mapping and ArchetypeSpritesheet crop math
    // do not need to change.
    const resized = await sharp({
      create: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: trimmed,
          left: Math.floor((THUMB_SIZE - artW) / 2),
          top: Math.floor((THUMB_SIZE - artH) / 2),
        },
      ])
      .png()
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

  // Generate WebP — CDN + local bundle
  const webpPathCdn = path.join(CDN_OUTPUT_DIR, 'archetype-spritesheet.webp')
  const webpPathLocal = path.join(LOCAL_OUTPUT_DIR, 'archetype-spritesheet.webp')
  const webpBuf = await composite
    .clone()
    .webp({ quality: 85, effort: 6, alphaQuality: 100 })
    .toBuffer()
  fs.writeFileSync(webpPathCdn, webpBuf)
  fs.writeFileSync(webpPathLocal, webpBuf)

  // Generate PNG fallback — CDN only (local bundle ships WebP primary)
  const pngPath = path.join(CDN_OUTPUT_DIR, 'archetype-spritesheet.png')
  await composite
    .clone()
    .png({ compressionLevel: 9 })
    .toFile(pngPath)

  const webpStat = fs.statSync(webpPathCdn)
  const pngStat = fs.statSync(pngPath)

  console.log(`Spritesheet: ${sheetWidth}×${sheetHeight}px`)
  console.log(`  WebP CDN:  ${(webpStat.size / 1024).toFixed(1)}KB → ${webpPathCdn}`)
  console.log(`  WebP Local: ${(webpStat.size / 1024).toFixed(1)}KB → ${webpPathLocal}`)
  console.log(`  PNG:        ${(pngStat.size / 1024).toFixed(1)}KB → ${pngPath}`)

  // Write manifest JSON — local bundle is the source of truth for the slot animation
  const manifestPath = path.join(LOCAL_OUTPUT_DIR, 'archetype-spritesheet.json')
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        version: 2,
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
