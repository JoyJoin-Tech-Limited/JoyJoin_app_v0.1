#!/usr/bin/env node
/**
 * Generate a reference grid of all existing Xiaoyue expressions.
 *
 * Useful for Lovart / artists to see the full character range
 * and maintain consistency across new sprite animation frames.
 *
 * Output: tmp/xiaoyue-reference-grid.webp + .png
 *
 * Usage (from apps/mini-program):
 *   node scripts/generate-xiaoyue-reference-grid.mjs
 *
 * Requires: sharp
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const ASSET_DIR = path.join(ROOT, 'src/assets/personality/xiaoyue')
const OUTPUT_DIR = path.resolve(ROOT, '../../tmp')

const CELL_IMAGE_SIZE = 240
const LABEL_HEIGHT = 56
const CELL_W = CELL_IMAGE_SIZE
const CELL_H = CELL_IMAGE_SIZE + LABEL_HEIGHT
const PADDING = 16
const COLS = 4

// Ordered list: [filename, display label, sprite state]
const EXPRESSIONS = [
  ['xiaoyue-home-welcome.webp', 'homeWelcome', 'welcome / idle'],
  ['xiaoyue-test-curious.webp', 'testCurious', 'curious'],
  ['xiaoyue-test-listening.webp', 'testListening', 'listening'],
  ['xiaoyue-test-nod.webp', 'testNod', 'nod'],
  ['xiaoyue-test-surprised.webp', 'testSurprised', 'surprised'],
  ['xiaoyue-coach-guide.webp', 'coachGuide', 'coach'],
  ['xiaoyue-loading-system.webp', 'loadingSystem', 'loading / thinking'],
  ['xiaoyue-loading-reveal.webp', 'loadingReveal', 'reveal'],
  ['xiaoyue-match-waiting.webp', 'matchWaiting', 'waiting'],
  ['xiaoyue-match-success.webp', 'matchSuccess', 'celebrate'],
  ['xiaoyue-action-success.webp', 'actionSuccess', 'success'],
  ['xiaoyue-action-failure.webp', 'actionFailure', 'error'],
  ['xiaoyue-thanks-feedback.webp', 'thanksFeedback', 'thanks'],
  ['xiaoyue-neutral-information.webp', 'neutralInformation', 'neutral'],
  ['xiaoyue-opt-out-reassure.webp', 'optOutReassure', 'reassure'],
  ['xiaoyue-payment-trust.webp', 'paymentTrust', 'trust'],
  ['xiaoyue-connections-empty.webp', 'connectionsEmpty', 'empty'],
]

function makeLabelSVG(text, subtext, width, height) {
  const textY = 22
  const subY = 46
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#F5F1E8" rx="6"/>
  <text x="50%" y="${textY}" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="#374151" text-anchor="middle">${text}</text>
  <text x="50%" y="${subY}" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#8B5CF6" text-anchor="middle">→ ${subtext}</text>
</svg>
  `.trim()
  return Buffer.from(svg)
}

async function main() {
  const { default: sharp } = await import('sharp')

  const rows = Math.ceil(EXPRESSIONS.length / COLS)
  const gridW = COLS * CELL_W + (COLS + 1) * PADDING
  const gridH = rows * CELL_H + (rows + 1) * PADDING

  // Background
  let composite = sharp({
    create: {
      width: gridW,
      height: gridH,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })

  const overlays = []

  for (let i = 0; i < EXPRESSIONS.length; i++) {
    const [filename, label, spriteState] = EXPRESSIONS[i]
    const assetPath = path.join(ASSET_DIR, filename)

    if (!fs.existsSync(assetPath)) {
      console.warn(`Missing asset: ${assetPath}`)
      continue
    }

    const col = i % COLS
    const row = Math.floor(i / COLS)
    const cellX = PADDING + col * (CELL_W + PADDING)
    const cellY = PADDING + row * (CELL_H + PADDING)

    // Resize image to fit cell
    const resized = await sharp(assetPath)
      .resize(CELL_IMAGE_SIZE, CELL_IMAGE_SIZE, { fit: 'contain', position: 'center', background: { r: 245, g: 241, b: 232, alpha: 1 } })
      .toBuffer()

    overlays.push({ input: resized, left: cellX, top: cellY })

    // Label background + text
    const labelSVG = makeLabelSVG(label, spriteState, CELL_W, LABEL_HEIGHT)
    overlays.push({ input: labelSVG, left: cellX, top: cellY + CELL_IMAGE_SIZE })
  }

  composite = composite.composite(overlays)

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const webpPath = path.join(OUTPUT_DIR, 'xiaoyue-reference-grid.webp')
  await composite.clone().webp({ quality: 90, effort: 6 }).toFile(webpPath)

  const pngPath = path.join(OUTPUT_DIR, 'xiaoyue-reference-grid.png')
  await composite.clone().png({ compressionLevel: 9 }).toFile(pngPath)

  const webpStat = fs.statSync(webpPath)
  const pngStat = fs.statSync(pngPath)

  console.log(`Reference grid: ${gridW}×${gridH}px`)
  console.log(`  WebP: ${(webpStat.size / 1024).toFixed(1)}KB → ${webpPath}`)
  console.log(`  PNG:  ${(pngStat.size / 1024).toFixed(1)}KB → ${pngPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
