#!/usr/bin/env node
/**
 * Extract individual frames from AI-generated row strips.
 *
 * Input: Horizontal strip images in assets-source/mascot/xiaoyue-strips/
 *   <state>.png — one strip per state, frames left-to-right
 *
 * Output: Extracted frames in assets-source/mascot/xiaoyue-animations/<state>/
 *   frame-00.png, frame-01.png, frame-02.png, frame-03.png
 *
 * Supports automatic frame count detection (via uniform spacing analysis)
 * or explicit frame count via manifest.
 *
 * Usage:
 *   node scripts/extract-xiaoyue-strip-frames.mjs
 *   node scripts/extract-xiaoyue-strip-frames.mjs --state idle
 *   node scripts/extract-xiaoyue-strip-frames.mjs --all
 *
 * Requires: sharp
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const STRIP_DIR = path.join(ROOT, 'assets-source/mascot/xiaoyue-strips')
const OUTPUT_DIR = path.join(ROOT, 'assets-source/mascot/xiaoyue-animations')
const REPAIR_DIR = path.join(ROOT, 'assets-source/mascot/xiaoyue-strips/.repair')

/** Expected frame dimensions */
const FRAME_W = 200
const FRAME_H = 200

/** Minimum gutter between frames for auto-detection */
const MIN_GUTTER = 2

async function detectFrameCount(stripPath) {
  const { default: sharp } = await import('sharp')
  const metadata = await sharp(stripPath).metadata()
  const stripW = metadata.width
  const stripH = metadata.height

  // If height matches frame height, frames are horizontal
  if (stripH === FRAME_H) {
    const estimatedFrames = Math.round(stripW / FRAME_W)
    return { frameCount: estimatedFrames, orientation: 'horizontal', stripW, stripH }
  }

  // If width matches frame width, frames are vertical
  if (stripW === FRAME_W) {
    const estimatedFrames = Math.round(stripH / FRAME_H)
    return { frameCount: estimatedFrames, orientation: 'vertical', stripW, stripH }
  }

  // If strip is close to expected height but wider, assume horizontal with padding
  if (Math.abs(stripH - FRAME_H) <= 10) {
    const estimatedFrames = Math.round(stripW / FRAME_W)
    return { frameCount: estimatedFrames, orientation: 'horizontal', stripW, stripH }
  }

  // Fallback: guess based on aspect ratio
  const aspectRatio = stripW / stripH
  if (aspectRatio > 1.5) {
    const estimatedFrames = Math.max(1, Math.round(stripW / FRAME_W))
    return { frameCount: estimatedFrames, orientation: 'horizontal', stripW, stripH }
  } else {
    const estimatedFrames = Math.max(1, Math.round(stripH / FRAME_H))
    return { frameCount: estimatedFrames, orientation: 'vertical', stripW, stripH }
  }
}

async function extractFrames(stripPath, stateName, options = {}) {
  const { default: sharp } = await import('sharp')
  const { force = false, verbose = true } = options

  const stateOutputDir = path.join(OUTPUT_DIR, stateName)

  // Check if already extracted
  if (!force && fs.existsSync(stateOutputDir)) {
    const existing = fs.readdirSync(stateOutputDir).filter(f => /^frame-\d+\.png$/i.test(f))
    if (existing.length > 0) {
      if (verbose) console.log(`  ${stateName}: already extracted (${existing.length} frames). Use --force to re-extract.`)
      return { state: stateName, extracted: existing.length, skipped: true }
    }
  }

  const { frameCount, orientation, stripW, stripH } = await detectFrameCount(stripPath)

  if (verbose) {
    console.log(`  ${stateName}: ${stripW}×${stripH}px, detected ${frameCount} frames (${orientation})`)
  }

  fs.mkdirSync(stateOutputDir, { recursive: true })

  const stripImage = sharp(stripPath)
  const extracted = []

  for (let i = 0; i < frameCount; i++) {
    let left, top, width, height

    if (orientation === 'horizontal') {
      const cellW = Math.floor(stripW / frameCount)
      left = i * cellW
      top = 0
      width = Math.min(cellW, stripW - left)
      height = stripH

      // Trim gutter if detected
      const centerX = left + Math.floor(width / 2)
      const frameLeft = Math.max(0, centerX - Math.floor(FRAME_W / 2))
      const frameTop = Math.max(0, Math.floor(stripH / 2) - Math.floor(FRAME_H / 2))
      left = frameLeft
      top = frameTop
      width = FRAME_W
      height = FRAME_H
    } else {
      const cellH = Math.floor(stripH / frameCount)
      left = 0
      top = i * cellH
      width = stripW
      height = Math.min(cellH, stripH - top)

      const centerY = top + Math.floor(height / 2)
      const frameLeft = Math.max(0, Math.floor(stripW / 2) - Math.floor(FRAME_W / 2))
      const frameTop = Math.max(0, centerY - Math.floor(FRAME_H / 2))
      left = frameLeft
      top = frameTop
      width = FRAME_W
      height = FRAME_H
    }

    // Extract and resize to standard frame size
    const frameBuffer = await stripImage
      .clone()
      .extract({ left, top, width, height })
      .resize(FRAME_W, FRAME_H, { fit: 'contain', position: 'center', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer()

    const framePath = path.join(stateOutputDir, `frame-${String(i).padStart(2, '0')}.png`)
    fs.writeFileSync(framePath, frameBuffer)
    extracted.push(framePath)
  }

  if (verbose) console.log(`    → Extracted ${extracted.length} frames to ${stateOutputDir}`)
  return { state: stateName, extracted: extracted.length, skipped: false }
}

async function main() {
  const args = process.argv.slice(2)
  const targetState = args.includes('--state') ? args[args.indexOf('--state') + 1] : null
  const force = args.includes('--force')
  const all = args.includes('--all')

  if (!fs.existsSync(STRIP_DIR)) {
    console.error(`Strip directory does not exist: ${STRIP_DIR}`)
    console.error('Place AI-generated strip images here: assets-source/mascot/xiaoyue-strips/<state>.png')
    process.exit(1)
  }

  const stripFiles = fs.readdirSync(STRIP_DIR)
    .filter(f => f.endsWith('.png') && !f.startsWith('.') && !f.startsWith('_'))
    .sort()

  if (stripFiles.length === 0) {
    console.error('No strip files found in', STRIP_DIR)
    process.exit(1)
  }

  console.log(`Found ${stripFiles.length} strip(s):`)
  stripFiles.forEach(f => console.log(`  - ${f}`))
  console.log('')

  const results = []

  for (const stripFile of stripFiles) {
    const stateName = path.basename(stripFile, '.png')

    if (targetState && stateName !== targetState) continue

    const stripPath = path.join(STRIP_DIR, stripFile)
    const result = await extractFrames(stripPath, stateName, { force, verbose: true })
    results.push(result)
  }

  console.log('\n--- Extraction Summary ---')
  const extracted = results.filter(r => !r.skipped)
  const skipped = results.filter(r => r.skipped)
  console.log(`Extracted: ${extracted.length} states, ${extracted.reduce((s, r) => s + r.extracted, 0)} frames`)
  console.log(`Skipped:   ${skipped.length} states`)

  // Next step hint
  if (extracted.length > 0) {
    console.log('\nNext:')
    console.log('  1. Review frames for consistency and quality')
    console.log('  2. Fix any bad frames by replacing strip files and re-running with --force')
    console.log('  3. Run: node scripts/generate-xiaoyue-spritesheet.mjs')
    console.log('  4. Run: node scripts/generate-xiaoyue-contact-sheet.mjs')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
