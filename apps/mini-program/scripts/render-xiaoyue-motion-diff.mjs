#!/usr/bin/env node
/**
 * Visualize sprite animation SMOOTHNESS by computing pixel-difference between
 * consecutive frames and rendering three rows per state:
 *
 *   Row 1: All 7 frames in a row (contact sheet)
 *   Row 2: 6 diff overlays (frame N vs frame N+1, red = changed pixels)
 *   Row 3: Smoothness profile (bar chart of per-pair diff magnitude)
 *
 * Output: tmp/xiaoyue-<state>-motion.png
 *
 * Run from apps/mini-program:
 *   node scripts/render-xiaoyue-motion-diff.mjs
 *   node scripts/render-xiaoyue-motion-diff.mjs --state thinking
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
const CELL = 200
const GAP = 6
const LABEL_H = 24
const DIFF_INTENSITY = 3.0

async function readFrameRgba(stateName, index) {
  const file = path.join(ANIM_DIR, stateName, `frame-${String(index).padStart(2, '0')}.png`)
  const { data, info } = await sharp(file).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, file }
}

function computeDiff(a, b) {
  // Pixel-difference map: per-pixel "changed" magnitude
  // Returns Uint8 buffer with single channel (0-255)
  const out = Buffer.alloc(a.width * a.height)
  for (let i = 0; i < out.length; i++) {
    const aOff = i * 4
    const dr = Math.abs(a.data[aOff] - b.data[aOff])
    const dg = Math.abs(a.data[aOff + 1] - b.data[aOff + 1])
    const db = Math.abs(a.data[aOff + 2] - b.data[aOff + 2])
    // Weighted luma distance, scaled
    const d = (dr * 0.299 + dg * 0.587 + db * 0.114) * DIFF_INTENSITY
    out[i] = Math.min(255, Math.round(d))
  }
  return out
}

function diffStats(diff) {
  let totalChange = 0
  let changedPixels = 0
  let maxChange = 0
  for (let i = 0; i < diff.length; i++) {
    if (diff[i] > 8) {
      totalChange += diff[i]
      changedPixels++
      if (diff[i] > maxChange) maxChange = diff[i]
    }
  }
  return {
    mean: totalChange / Math.max(1, changedPixels),
    changedPixels,
    changeRatio: changedPixels / diff.length,
    maxChange,
  }
}

async function buildStateVisualization(stateName) {
  const frames = []
  for (let i = 0; i < 7; i++) {
    frames.push(await readFrameRgba(stateName, i))
  }

  // Compute diffs between consecutive frames
  const diffs = []
  for (let i = 0; i < frames.length - 1; i++) {
    diffs.push({
      from: i,
      to: i + 1,
      diff: computeDiff(frames[i], frames[i + 1]),
      stats: null,
    })
  }
  for (const d of diffs) d.stats = diffStats(d.diff)

  // Layout
  const numFrames = frames.length
  const numDiffs = diffs.length
  const rowWidth = numFrames * CELL + (numFrames - 1) * GAP
  const diffRowWidth = numDiffs * CELL + (numDiffs - 1) * GAP
  const totalWidth = Math.max(rowWidth, diffRowWidth)
  const rowHeight = CELL
  const headerH = 36
  const barH = 64
  const statsH = 70
  const totalHeight = headerH + rowHeight + GAP + rowHeight + GAP + barH + GAP + statsH

  // Header background
  const composite = sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 250, g: 250, b: 252, alpha: 1 },
    },
  })

  const overlays = []
  let yCursor = headerH

  // Row 1: 7 original frames
  for (let i = 0; i < numFrames; i++) {
    const frame = frames[i]
    const resized = await sharp(frame.file)
      .resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer()
    overlays.push({ input: resized, left: i * (CELL + GAP), top: yCursor })
  }
  yCursor += rowHeight + GAP

  // Row 2: 6 diff overlays (red-tinted on light bg)
  for (let i = 0; i < numDiffs; i++) {
    const d = diffs[i]
    // Render diff as red channel: alpha = diff magnitude, R = 255, G/B = 0
    const rgba = Buffer.alloc(d.diff.length * 4)
    for (let p = 0; p < d.diff.length; p++) {
      rgba[p * 4] = 255
      rgba[p * 4 + 1] = Math.round(d.diff[p] * 0.3)
      rgba[p * 4 + 2] = Math.round(d.diff[p] * 0.3)
      rgba[p * 4 + 3] = d.diff[p]
    }
    const diffImg = await sharp(rgba, { raw: { width: d.diff.length === frames[0].width * frames[0].height ? frames[0].width : CELL, height: CELL, channels: 4 } })
      .png()
      .toBuffer()
    // Just composite the original frame underneath for context
    const baseFrame = await sharp(frames[d.from].file)
      .resize(CELL, CELL, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer()
    overlays.push({ input: baseFrame, left: i * (CELL + GAP), top: yCursor })
    // Resize the diff to match cell
    const { data: dResized, info: dInfo } = await sharp(d.diff, { raw: { width: frames[d.from].width, height: frames[d.from].height, channels: 1 } })
      .resize(CELL, CELL, { fit: 'contain' })
      .raw()
      .toBuffer({ resolveWithObject: true })
    const diffRgba = Buffer.alloc(dResized.length * 4)
    for (let p = 0; p < dResized.length; p++) {
      diffRgba[p * 4] = 255
      diffRgba[p * 4 + 1] = 0
      diffRgba[p * 4 + 2] = 0
      diffRgba[p * 4 + 3] = dResized[p]
    }
    const diffPng = await sharp(diffRgba, { raw: { width: dInfo.width, height: dInfo.height, channels: 4 } })
      .png()
      .toBuffer()
    overlays.push({ input: diffPng, left: i * (CELL + GAP), top: yCursor })
  }
  yCursor += rowHeight + GAP

  // Row 3: smoothness profile (bar chart)
  const maxMean = Math.max(...diffs.map(d => d.stats.mean))
  const barMargin = 4
  const barAreaW = totalWidth - 2 * barMargin
  const barSlotW = barAreaW / numDiffs
  const barW = barSlotW - 8

  for (let i = 0; i < numDiffs; i++) {
    const d = diffs[i]
    const ratio = d.stats.mean / Math.max(1, maxMean)
    const h = Math.max(2, Math.round(barH * ratio))
    const x = barMargin + i * barSlotW + 4
    const y = yCursor + (barH - h)
    // Draw bar as a colored rectangle
    const barBuf = Buffer.alloc(barW * h * 4)
    // Color: green if consistent, amber if spike
    const spike = d.stats.mean > maxMean * 1.4
    const r = spike ? 255 : 50
    const g = spike ? 152 : 180
    const b = spike ? 0 : 100
    for (let p = 0; p < barBuf.length / 4; p++) {
      barBuf[p * 4] = r
      barBuf[p * 4 + 1] = g
      barBuf[p * 4 + 2] = b
      barBuf[p * 4 + 3] = 220
    }
    const barImg = await sharp(barBuf, { raw: { width: barW, height: h, channels: 4 } })
      .png()
      .toBuffer()
    overlays.push({ input: barImg, left: x, top: y })
  }
  yCursor += barH + GAP

  // Row 4: stats summary (per-pair table)
  const statsOverlay = await sharp({
    create: {
      width: totalWidth,
      height: statsH,
      channels: 4,
      background: { r: 250, g: 250, b: 252, alpha: 0 },
    },
  })
    .png()
    .toBuffer()
  overlays.push({ input: statsOverlay, left: 0, top: yCursor })

  const result = await composite.composite(overlays).png().toBuffer()

  // Now overlay text labels using a second pass
  // sharp doesn't have text rendering built in, so we'll skip text and rely on context
  const outPath = path.join(OUT_DIR, `xiaoyue-${stateName}-motion.png`)
  fs.writeFileSync(outPath, result)

  // Print summary
  const totalMean = diffs.reduce((s, d) => s + d.stats.mean, 0) / diffs.length
  const stddev = Math.sqrt(
    diffs.reduce((s, d) => s + (d.stats.mean - totalMean) ** 2, 0) / diffs.length
  )
  const coefficientOfVariation = stddev / Math.max(1, totalMean) // lower = more uniform = smoother
  const smoothnessVerdict = coefficientOfVariation < 0.35
    ? 'SMOOTH'
    : coefficientOfVariation < 0.60
      ? 'OK (slight unevenness)'
      : 'JARRING (large jumps)'

  console.log(`\n${stateName}:`)
  console.log(`  Per-pair mean diff: ${diffs.map(d => d.stats.mean.toFixed(0)).join(', ')}`)
  console.log(`  Overall mean: ${totalMean.toFixed(1)}, stddev: ${stddev.toFixed(1)}, CoV: ${coefficientOfVariation.toFixed(2)}`)
  console.log(`  Verdict: ${smoothnessVerdict}`)
  console.log(`  → ${outPath}`)

  return { state: stateName, totalMean, stddev, coefficientOfVariation, smoothnessVerdict, diffs }
}

async function main() {
  const args = process.argv.slice(2)
  const targetState = args.includes('--state') ? args[args.indexOf('--state') + 1] : null

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const states = targetState ? [targetState] : STATES
  const results = []

  for (const state of states) {
    const r = await buildStateVisualization(state)
    if (r) results.push(r)
  }

  if (results.length > 1) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`SMOOTHNESS SUMMARY`)
    console.log('='.repeat(60))
    for (const r of results) {
      console.log(`  ${r.state.padEnd(10)} CoV=${r.coefficientOfVariation.toFixed(2)} → ${r.smoothnessVerdict}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
