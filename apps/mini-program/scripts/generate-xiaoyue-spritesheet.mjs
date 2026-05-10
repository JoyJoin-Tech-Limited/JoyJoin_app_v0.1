#!/usr/bin/env node
/**
 * Generate per-state Xiaoyue sprite animation sheets.
 *
 * Each state becomes its own horizontal-strip spritesheet:
 *   src/assets/mascot/xiaoyue-<state>.webp
 *   src/assets/mascot/xiaoyue-<state>.png
 *
 * A master manifest indexes all states:
 *   src/assets/mascot/xiaoyue-spritesheet-manifest.json
 *
 * CSS animation uses background-size + steps() for GPU-efficient playback.
 *
 * Input structure (assets-source/mascot/xiaoyue-animations/):
 *   <state-name>/frame-00.png
 *   <state-name>/frame-01.png
 *   ...
 *
 * Usage (from apps/mini-program):
 *   npm run generate:xiaoyue-spritesheet
 *
 * Requires: sharp (devDependency)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const INPUT_DIR = path.join(ROOT, 'assets-source/mascot/xiaoyue-animations')
const OUTPUT_DIR = path.join(ROOT, 'src/assets/mascot')

/** Frame render size in px (source images are resized to this). */
const FRAME_W = 200
const FRAME_H = 200
const PADDING = 2

/** Default timing config per state (overrideable via state-meta.json). */
const DEFAULT_DURATION_MS = 1200
const DEFAULT_LOOP = true

/** State metadata overrides: filename → { duration, loop, oneShot } */
const STATE_META_FILENAME = 'state-meta.json'

async function main() {
  const { default: sharp } = await import('sharp')

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`Input directory does not exist: ${INPUT_DIR}`)
    console.error('Create it and add subdirectories per state with frame-*.png files.')
    process.exit(1)
  }

  // Discover states
  const entries = fs.readdirSync(INPUT_DIR, { withFileTypes: true })
  const stateDirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort()

  if (stateDirs.length === 0) {
    console.error('No state directories found in', INPUT_DIR)
    process.exit(1)
  }

  // Load optional state metadata overrides
  const metaPath = path.join(INPUT_DIR, STATE_META_FILENAME)
  const stateMeta = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    : {}

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const manifestStates = {}
  let totalSize = 0

  for (const stateName of stateDirs) {
    const stateDir = path.join(INPUT_DIR, stateName)
    const frames = fs
      .readdirSync(stateDir)
      .filter((f) => /^frame-\d+\.(png|webp|jpg|jpeg)$/i.test(f))
      .sort((a, b) => {
        const an = parseInt(a.match(/\d+/)[0], 10)
        const bn = parseInt(b.match(/\d+/)[0], 10)
        return an - bn
      })

    if (frames.length === 0) {
      console.warn(`Skipping empty state directory: ${stateName}`)
      continue
    }

    const meta = stateMeta[stateName] || {}
    const frameCount = frames.length
    const duration = meta.duration ?? DEFAULT_DURATION_MS
    const loop = meta.loop ?? DEFAULT_LOOP
    const oneShot = meta.oneShot ?? false

    // Build sheet for this state
    const cellW = FRAME_W + PADDING * 2
    const sheetWidth = frameCount * cellW
    const sheetHeight = FRAME_H + PADDING * 2

    let composite = sharp({
      create: {
        width: sheetWidth,
        height: sheetHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })

    const overlays = []
    for (let col = 0; col < frames.length; col++) {
      const framePath = path.join(stateDir, frames[col])
      const resized = await sharp(framePath)
        .resize(FRAME_W, FRAME_H, { fit: 'contain', position: 'center', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toBuffer()

      const left = col * cellW + PADDING
      const top = PADDING
      overlays.push({ input: resized, left, top })
    }

    composite = composite.composite(overlays)

    // Generate WebP
    const webpPath = path.join(OUTPUT_DIR, `xiaoyue-${stateName}.webp`)
    await composite
      .clone()
      .webp({ quality: 85, effort: 6, alphaQuality: 100 })
      .toFile(webpPath)

    // Generate PNG fallback
    const pngPath = path.join(OUTPUT_DIR, `xiaoyue-${stateName}.png`)
    await composite
      .clone()
      .png({ compressionLevel: 9 })
      .toFile(pngPath)

    const webpStat = fs.statSync(webpPath)
    const pngStat = fs.statSync(pngPath)
    totalSize += webpStat.size

    console.log(
      `${stateName}: ${frameCount} frames, ` +
      `WebP ${(webpStat.size / 1024).toFixed(1)}KB, ` +
      `PNG ${(pngStat.size / 1024).toFixed(1)}KB`
    )

    manifestStates[stateName] = {
      sheet: `xiaoyue-${stateName}.webp`,
      frameCount,
      frameWidth: FRAME_W,
      frameHeight: FRAME_H,
      duration,
      loop,
      oneShot,
    }
  }

  // Write master manifest
  const manifest = {
    version: 1,
    frame: { width: FRAME_W, height: FRAME_H, padding: PADDING },
    states: manifestStates,
  }

  const manifestPath = path.join(OUTPUT_DIR, 'xiaoyue-spritesheet-manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  console.log(`\nTotal WebP size: ${(totalSize / 1024).toFixed(1)}KB`)
  console.log(`States: ${Object.keys(manifestStates).length}`)
  console.log(`Manifest: ${manifestPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
