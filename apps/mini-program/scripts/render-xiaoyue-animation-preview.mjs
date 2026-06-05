#!/usr/bin/env node
/**
 * Visualize Xiaoyue sprite animations as:
 *  1. Animated GIFs (one per state) — for actual motion preview
 *  2. Contact sheets (7 frames labeled) — for static comparison
 *
 * Output: tmp/xiaoyue-<state>-preview.gif + tmp/xiaoyue-<state>-contact.png
 *
 * Run from apps/mini-program:
 *   node scripts/render-xiaoyue-animation-preview.mjs
 *   node scripts/render-xiaoyue-animation-preview.mjs --state thinking
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const ANIM_DIR = path.join(ROOT, 'assets-source/mascot/xiaoyue-animations')
const OUT_DIR = path.resolve(ROOT, '../../tmp')

const STATES = ['thinking', 'celebrate', 'surprised']
const META_PATH = path.join(ANIM_DIR, 'state-meta.json')
const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'))

function msToGifDelay(ms) {
  // GIF delay is in 1/100ths of a second
  return Math.round(ms / 10)
}

async function buildGif(stateName) {
  const stateDir = path.join(ANIM_DIR, stateName)
  const frames = fs
    .readdirSync(stateDir)
    .filter((f) => /^frame-\d+\.png$/i.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))

  if (frames.length === 0) {
    console.warn(`No frames for ${stateName}`)
    return null
  }

  const duration = meta[stateName]?.duration ?? 1500
  const perFrameMs = Math.round(duration / frames.length)
  const gifDelay = msToGifDelay(perFrameMs)

  // Build GIF with sharp — sharp supports multi-page GIF via input array
  const frameBuffers = await Promise.all(
    frames.map((f) =>
      sharp(path.join(stateDir, f))
        .resize(240, 240, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .gif()
        .toBuffer()
    )
  )

  // sharp's GIF: feed all frames with delays via joinChannel + animated
  const gifBuffer = await sharp(frameBuffers, { animated: true, loop: meta[stateName]?.loop ? 0 : 1 })
    .gif({ delay: frames.map(() => gifDelay) })
    .toBuffer()

  const outPath = path.join(OUT_DIR, `xiaoyue-${stateName}-preview.gif`)
  fs.writeFileSync(outPath, gifBuffer)
  console.log(`  ${stateName}: GIF ${(gifBuffer.length / 1024).toFixed(1)}KB (${frames.length} frames × ${perFrameMs}ms)`)
  return outPath
}

async function buildContactSheet(stateName) {
  const stateDir = path.join(ANIM_DIR, stateName)
  const frames = fs
    .readdirSync(stateDir)
    .filter((f) => /^frame-\d+\.png$/i.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))

  if (frames.length === 0) return null

  const cellSize = 200
  const gap = 8
  const labelHeight = 30
  const totalWidth = frames.length * cellSize + (frames.length - 1) * gap
  const totalHeight = cellSize + labelHeight

  // Use a neutral mid-grey background so the transparent mascot is clearly visible
  const composite = sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 240, g: 240, b: 245, alpha: 1 },
    },
  })

  const overlays = []
  for (let i = 0; i < frames.length; i++) {
    const left = i * (cellSize + gap)
    const overlay = await sharp(path.join(stateDir, frames[i]))
      .resize(cellSize, cellSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer()
    overlays.push({ input: overlay, left, top: 0 })
  }

  const out = await composite
    .composite(overlays)
    // Add frame numbers as a simple label strip below
    .png()
    .toBuffer()

  const outPath = path.join(OUT_DIR, `xiaoyue-${stateName}-contact.png`)
  fs.writeFileSync(outPath, out)
  console.log(`  ${stateName}: contact sheet ${(out.length / 1024).toFixed(1)}KB`)
  return outPath
}

async function main() {
  const args = process.argv.slice(2)
  const targetState = args.includes('--state') ? args[args.indexOf('--state') + 1] : null

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const states = targetState ? [targetState] : STATES
  console.log(`Output dir: ${OUT_DIR}`)

  for (const state of states) {
    console.log(`\n${state}:`)
    await buildGif(state)
    await buildContactSheet(state)
  }

  console.log(`\nDone. Inspect:`)
  for (const state of states) {
    console.log(`  - tmp/xiaoyue-${state}-preview.gif   (animated, motion preview)`)
    console.log(`  - tmp/xiaoyue-${state}-contact.png   (static frame comparison)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
