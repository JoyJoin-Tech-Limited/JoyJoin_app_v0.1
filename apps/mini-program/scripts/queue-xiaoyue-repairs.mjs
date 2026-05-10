#!/usr/bin/env node
/**
 * Queue targeted repair jobs for failed Xiaoyue sprite frames.
 *
 * Scans extracted frames and flags suspicious frames for regeneration:
 * - Empty / near-empty frames (failed extraction)
 * - Frames with high variance from row median (identity drift)
 * - Frames with unexpected colors (chroma-key bleed)
 *
 * Generates a repair manifest with specific state/frame targets.
 *
 * Usage:
 *   node scripts/queue-xiaoyue-repairs.mjs
 *   node scripts/queue-xiaoyue-repairs.mjs --state nod --frame 2
 *
 * Output: assets-source/mascot/xiaoyue-strips/.repair/repair-manifest.json
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const INPUT_DIR = path.join(ROOT, 'assets-source/mascot/xiaoyue-animations')
const STRIP_DIR = path.join(ROOT, 'assets-source/mascot/xiaoyue-strips')
const REPAIR_DIR = path.join(ROOT, 'assets-source/mascot/xiaoyue-strips/.repair')

async function analyzeFrame(framePath) {
  const { default: sharp } = await import('sharp')
  const { stats } = await sharp(framePath).stats()

  // Check if frame is mostly empty (failed extraction)
  const isEmpty = stats.channels.every(ch => ch.max - ch.min < 10)

  // Get dominant color info for chroma-key detection
  const buffer = await sharp(framePath).raw().toBuffer()
  const pixelCount = buffer.length / 4

  // Simple transparency ratio check
  let transparentPixels = 0
  for (let i = 3; i < buffer.length; i += 4) {
    if (buffer[i] < 128) transparentPixels++
  }
  const transparencyRatio = transparentPixels / pixelCount

  return {
    path: framePath,
    isEmpty,
    transparencyRatio,
    meanBrightness: stats.channels.reduce((s, ch) => s + ch.mean, 0) / stats.channels.length,
  }
}

async function findRepairs() {
  const repairs = []

  const stateDirs = fs.readdirSync(INPUT_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name)
    .sort()

  for (const stateName of stateDirs) {
    const stateDir = path.join(INPUT_DIR, stateName)
    const frames = fs.readdirSync(stateDir)
      .filter(f => /^frame-\d+\.png$/i.test(f))
      .sort()

    if (frames.length === 0) {
      // Missing entire state
      repairs.push({ state: stateName, frame: null, reason: 'missing_entire_state' })
      continue
    }

    const frameAnalyses = []
    for (const frameFile of frames) {
      const framePath = path.join(stateDir, frameFile)
      const analysis = await analyzeFrame(framePath)
      frameAnalyses.push({ file: frameFile, ...analysis })
    }

    // Check for empty frames
    frameAnalyses.forEach((fa, idx) => {
      if (fa.isEmpty) {
        repairs.push({ state: stateName, frame: idx, reason: 'empty_frame', file: fa.file })
      }
    })

    // Check for transparency anomalies (possible chroma-key bleed or extraction failure)
    const medianTransparency = frameAnalyses.map(fa => fa.transparencyRatio).sort((a, b) => a - b)[Math.floor(frameAnalyses.length / 2)]
    frameAnalyses.forEach((fa, idx) => {
      if (Math.abs(fa.transparencyRatio - medianTransparency) > 0.3) {
        repairs.push({ state: stateName, frame: idx, reason: 'transparency_anomaly', file: fa.file, detail: `transparency=${(fa.transparencyRatio * 100).toFixed(1)}% vs median=${(medianTransparency * 100).toFixed(1)}%` })
      }
    })

    // Check for brightness outliers
    const medianBrightness = frameAnalyses.map(fa => fa.meanBrightness).sort((a, b) => a - b)[Math.floor(frameAnalyses.length / 2)]
    frameAnalyses.forEach((fa, idx) => {
      if (Math.abs(fa.meanBrightness - medianBrightness) > 40) {
        repairs.push({ state: stateName, frame: idx, reason: 'brightness_outlier', file: fa.file, detail: `brightness=${fa.meanBrightness.toFixed(1)} vs median=${medianBrightness.toFixed(1)}` })
      }
    })
  }

  return repairs
}

async function main() {
  const args = process.argv.slice(2)
  const targetState = args.includes('--state') ? args[args.indexOf('--state') + 1] : null
  const targetFrame = args.includes('--frame') ? parseInt(args[args.indexOf('--frame') + 1], 10) : null

  fs.mkdirSync(REPAIR_DIR, { recursive: true })

  let repairs = await findRepairs()

  // Manual override if specific state/frame provided
  if (targetState) {
    if (targetFrame !== null) {
      repairs = repairs.filter(r => r.state === targetState && r.frame === targetFrame)
      if (repairs.length === 0) {
        repairs.push({ state: targetState, frame: targetFrame, reason: 'manual_repair_request' })
      }
    } else {
      repairs = repairs.filter(r => r.state === targetState)
      if (repairs.length === 0) {
        repairs.push({ state: targetState, frame: null, reason: 'manual_repair_state' })
      }
    }
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalRepairs: repairs.length,
    repairs: repairs.map(r => ({
      state: r.state,
      frame: r.frame,
      reason: r.reason,
      file: r.file || null,
      detail: r.detail || null,
      stripSource: path.join(STRIP_DIR, `${r.state}.png`),
    })),
  }

  const manifestPath = path.join(REPAIR_DIR, 'repair-manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  console.log(`Repair analysis complete: ${repairs.length} issue(s) found`)

  if (repairs.length > 0) {
    console.log('\nRepairs needed:')
    const byState = {}
    repairs.forEach(r => {
      if (!byState[r.state]) byState[r.state] = []
      byState[r.state].push(r)
    })

    Object.entries(byState).forEach(([state, reps]) => {
      console.log(`\n  ${state}:`)
      reps.forEach(r => {
        const frameStr = r.frame !== null ? `frame-${String(r.frame).padStart(2, '0')}` : 'all frames'
        console.log(`    - ${frameStr}: ${r.reason}${r.detail ? ` (${r.detail})` : ''}`)
      })
    })

    console.log('\nTo repair:')
    console.log('  1. Replace the failed strip source in:')
    console.log('     assets-source/mascot/xiaoyue-strips/<state>.png')
    console.log('  2. Re-run extraction for that state:')
    console.log(`     node scripts/extract-xiaoyue-strip-frames.mjs --state <state> --force`)
    console.log('  3. Re-run contact sheet:')
    console.log('     node scripts/generate-xiaoyue-contact-sheet.mjs')
    console.log('  4. Re-run spritesheet build:')
    console.log('     node scripts/generate-xiaoyue-spritesheet.mjs')
  } else {
    console.log('\nNo repairs needed. All frames look healthy.')
  }

  console.log(`\nManifest saved: ${manifestPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
