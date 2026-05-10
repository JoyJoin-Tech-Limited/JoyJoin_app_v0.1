#!/usr/bin/env node
/**
 * Remove grey checkerboard backgrounds from Xiaoyue frames.
 *
 * Lovart-generated strips often have a light grey background (~RGB 224)
 * instead of true transparency. This script chroma-keys the background
 * by detecting pixels close to the background color and setting alpha=0.
 *
 * Usage:
 *   node scripts/clean-xiaoyue-backgrounds.mjs
 *
 * Requires: sharp
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const ANIMATIONS_DIR = path.join(ROOT, 'assets-source/mascot/xiaoyue-animations')

/** Background color to remove (light grey from Lovart checkerboard) */
const BG_COLOR = { r: 224, g: 224, b: 224 }

/** Color distance threshold. Pixels within this distance of BG_COLOR become transparent.
 *  Higher = more aggressive removal, may cut into light fur.
 *  Lower = more conservative, may leave grey fringes.
 */
const COLOR_THRESHOLD = 35

/** Edge softness: pixels just outside the threshold get partial alpha */
const EDGE_SOFTNESS = 15

function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

async function cleanFrame(framePath) {
  const { default: sharp } = await import('sharp')

  const image = sharp(framePath)
  const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  const output = Buffer.from(data)

  for (let i = 0; i < output.length; i += channels) {
    const r = output[i]
    const g = output[i + 1]
    const b = output[i + 2]

    const dist = colorDistance(r, g, b, BG_COLOR.r, BG_COLOR.g, BG_COLOR.b)

    if (dist < COLOR_THRESHOLD) {
      // Fully transparent background
      output[i + 3] = 0
    } else if (dist < COLOR_THRESHOLD + EDGE_SOFTNESS) {
      // Edge anti-aliasing: partial alpha
      const alpha = Math.round(255 * (dist - COLOR_THRESHOLD) / EDGE_SOFTNESS)
      output[i + 3] = Math.max(0, Math.min(255, alpha))
    }
    // Otherwise keep original alpha
  }

  await sharp(output, { raw: { width, height, channels } })
    .png({ compressionLevel: 9 })
    .toFile(framePath)
}

async function main() {
  const stateDirs = fs.readdirSync(ANIMATIONS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name)
    .sort()

  let totalFrames = 0

  for (const stateName of stateDirs) {
    const stateDir = path.join(ANIMATIONS_DIR, stateName)
    const frames = fs.readdirSync(stateDir)
      .filter(f => /^frame-\d+\.png$/i.test(f))
      .sort()

    if (frames.length === 0) continue

    console.log(`${stateName}: cleaning ${frames.length} frames...`)

    for (const frameFile of frames) {
      const framePath = path.join(stateDir, frameFile)
      await cleanFrame(framePath)
      totalFrames++
    }
  }

  console.log(`\nCleaned ${totalFrames} frames.`)
  console.log('Next: regenerate spritesheets')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
