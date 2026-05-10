#!/usr/bin/env node
/**
 * Generate a QA contact sheet showing all extracted frames per state.
 *
 * Useful for visual identity consistency checks before packaging.
 * Shows frames in sequence with state labels and frame numbers.
 *
 * Input: assets-source/mascot/xiaoyue-animations/<state>/frame-*.png
 * Output: tmp/xiaoyue-contact-sheet.webp + .png
 *
 * Usage:
 *   node scripts/generate-xiaoyue-contact-sheet.mjs
 *
 * Requires: sharp
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const INPUT_DIR = path.join(ROOT, 'assets-source/mascot/xiaoyue-animations')
const OUTPUT_DIR = path.resolve(ROOT, '../../tmp')

const FRAME_PREVIEW_SIZE = 160
const LABEL_HEIGHT = 40
const HEADER_HEIGHT = 60
const PADDING = 16

function makeHeaderSVG(text, width, height) {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#8B5CF6" rx="8"/>
  <text x="50%" y="${height / 2 + 6}" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="700" fill="#FFFFFF" text-anchor="middle">${text}</text>
</svg>
  `.trim()
  return Buffer.from(svg)
}

function makeStateLabelSVG(stateName, frameCount, width, height) {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#F5F1E8" rx="6"/>
  <text x="50%" y="${height / 2 + 2}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#374151" text-anchor="middle">${stateName} (${frameCount} frames)</text>
</svg>
  `.trim()
  return Buffer.from(svg)
}

function makeFrameLabelSVG(frameNum, width, height) {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <text x="50%" y="${height / 2 + 3}" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#9CA3AF" text-anchor="middle">f${String(frameNum).padStart(2, '0')}</text>
</svg>
  `.trim()
  return Buffer.from(svg)
}

async function main() {
  const { default: sharp } = await import('sharp')

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`Animation directory does not exist: ${INPUT_DIR}`)
    process.exit(1)
  }

  // Discover states
  const stateDirs = fs.readdirSync(INPUT_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name)
    .sort()

  if (stateDirs.length === 0) {
    console.error('No state directories found in', INPUT_DIR)
    process.exit(1)
  }

  // Collect state info
  const states = []
  let maxFrames = 0

  for (const stateName of stateDirs) {
    const stateDir = path.join(INPUT_DIR, stateName)
    const frames = fs.readdirSync(stateDir)
      .filter(f => /^frame-\d+\.png$/i.test(f))
      .sort()

    if (frames.length === 0) continue

    maxFrames = Math.max(maxFrames, frames.length)
    states.push({ name: stateName, frames: frames.map(f => path.join(stateDir, f)) })
  }

  if (states.length === 0) {
    console.error('No valid frames found')
    process.exit(1)
  }

  // Calculate grid dimensions
  const cols = maxFrames
  const sheetW = Math.max(800, cols * FRAME_PREVIEW_SIZE + (cols + 1) * PADDING)
  const sheetH = HEADER_HEIGHT + states.length * (FRAME_PREVIEW_SIZE + LABEL_HEIGHT + PADDING) + PADDING

  console.log(`Generating contact sheet: ${sheetW}×${sheetH}px`)
  console.log(`States: ${states.length}, Max frames: ${maxFrames}`)

  // Build composite
  let composite = sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })

  const overlays = []

  // Header
  const headerSVG = makeHeaderSVG('悦仔 (Xiaoyue) Sprite QA Contact Sheet', sheetW - PADDING * 2, HEADER_HEIGHT - PADDING)
  overlays.push({ input: headerSVG, left: PADDING, top: PADDING })

  let currentY = HEADER_HEIGHT

  for (const state of states) {
    const frameCount = state.frames.length
    const stateRowHeight = FRAME_PREVIEW_SIZE + LABEL_HEIGHT

    // State label
    const stateLabelSVG = makeStateLabelSVG(state.name, Math.min(240, sheetW - PADDING * 2), LABEL_HEIGHT)
    overlays.push({ input: stateLabelSVG, left: PADDING, top: currentY })
    currentY += LABEL_HEIGHT

    // Frames
    for (let i = 0; i < frameCount; i++) {
      const framePath = state.frames[i]
      const resized = await sharp(framePath)
        .resize(FRAME_PREVIEW_SIZE, FRAME_PREVIEW_SIZE, { fit: 'contain', position: 'center', background: { r: 245, g: 241, b: 232, alpha: 1 } })
        .toBuffer()

      const frameX = PADDING + i * (FRAME_PREVIEW_SIZE + PADDING)
      overlays.push({ input: resized, left: frameX, top: currentY })

      // Frame number label
      const frameLabelSVG = makeFrameLabelSVG(i, FRAME_PREVIEW_SIZE, 20)
      overlays.push({ input: frameLabelSVG, left: frameX, top: currentY + FRAME_PREVIEW_SIZE })
    }

    currentY += FRAME_PREVIEW_SIZE + PADDING + 20
  }

  composite = composite.composite(overlays)

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const webpPath = path.join(OUTPUT_DIR, 'xiaoyue-contact-sheet.webp')
  await composite.clone().webp({ quality: 90, effort: 6 }).toFile(webpPath)

  const pngPath = path.join(OUTPUT_DIR, 'xiaoyue-contact-sheet.png')
  await composite.clone().png({ compressionLevel: 9 }).toFile(pngPath)

  const webpStat = fs.statSync(webpPath)
  const pngStat = fs.statSync(pngPath)

  console.log(`  WebP: ${(webpStat.size / 1024).toFixed(1)}KB → ${webpPath}`)
  console.log(`  PNG:  ${(pngStat.size / 1024).toFixed(1)}KB → ${pngPath}`)
  console.log(`\nReview this contact sheet for identity consistency before running generate-xiaoyue-spritesheet.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
