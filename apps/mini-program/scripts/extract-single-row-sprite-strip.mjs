#!/usr/bin/env node
/**
 * Extract 7 individual 200x200 frames from a single-row sprite grid
 * with a SHARED content bounding box for maximum body overlap.
 *
 * Input:  assets-source/mascot/yuezai sprite grid/<state> sprite grid v2.png
 *         (2048x2048 square, content in horizontal band, 7 characters touching)
 * Output: assets-source/mascot/xiaoyue-animations/<state>/frame-00..06.png
 *
 * Algorithm:
 * 1. Find the file-wide content bbox (alpha > 10) to locate the character band.
 * 2. Split that bbox into 7 equal-width columns.
 * 3. For each column, compute its content bbox (where the character is).
 * 4. Compute SHARED crop dimensions = max(content.w) x max(content.h) across all 7 frames.
 * 5. Center the shared crop on each frame's content center.
 * 6. Resize to fit in 200x200 with FILL_RATIO=0.95, centered in the canvas.
 * 7. Post-crop OVERLAP TEST: compute alpha bbox of each output frame, report
 *    center jitter, size jitter, and average pairwise Jaccard index.
 *
 * Run from apps/mini-program:
 *   node scripts/extract-single-row-sprite-strip.mjs
 *   node scripts/extract-single-row-sprite-strip.mjs --state thinking
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const GRID_DIR = path.join(ROOT, 'assets-source/mascot/yuezai sprite grid')
const OUTPUT_DIR = path.join(ROOT, 'assets-source/mascot/xiaoyue-animations')

const TARGET_SIZE = 200
const FILL_RATIO = 0.95
const PADDING = 8 // px breathing room around the shared content bbox
const ALPHA_THRESHOLD = 10

const STATE_MAP = {
  'thinking sprite grid v2': 'thinking',
  'celebrate sprite grid v2': 'celebrate',
  'surprise sprite grid v2': 'surprised', // filename uses "surprise", state is "surprised"
}

const VERDICT_THRESHOLDS = { passJaccard: 0.85, warnJaccard: 0.70 }

function getContentBBox(buffer, w, h) {
  let minX = w, minY = h, maxX = 0, maxY = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = buffer[(y * w + x) * 4 + 3]
      if (alpha > ALPHA_THRESHOLD) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (minX > maxX) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

function stats(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length
  return {
    mean: mean.toFixed(1),
    stddev: Math.sqrt(variance).toFixed(2),
    min: Math.min(...arr),
    max: Math.max(...arr),
  }
}

function rectIntersectionArea(a, b) {
  const ix1 = Math.max(a.x, b.x)
  const iy1 = Math.max(a.y, b.y)
  const ix2 = Math.min(a.x + a.w, b.x + b.w)
  const iy2 = Math.min(a.y + a.h, b.y + b.h)
  return Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1)
}

function jaccard(a, b) {
  const inter = rectIntersectionArea(a, b)
  const union = a.w * a.h + b.w * b.h - inter
  return union > 0 ? inter / union : 0
}

async function processGrid(gridPath, stateName) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Processing: ${stateName}`)
  console.log('='.repeat(60))

  const { data, info } = await sharp(gridPath)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height

  // Step 1: find file-wide content bbox
  const fileBbox = getContentBBox(data, w, h)
  if (!fileBbox) {
    console.log(`  SKIP: no content found`)
    return null
  }
  console.log(`File bbox: x=[${fileBbox.x}, ${fileBbox.x + fileBbox.w - 1}] y=[${fileBbox.y}, ${fileBbox.y + fileBbox.h - 1}]`)
  console.log(`Content band: ${fileBbox.w} x ${fileBbox.h}`)

  // Step 2: split file bbox into 7 equal-width columns
  const numFrames = 7
  const exactColW = fileBbox.w / numFrames
  const columns = []
  let cursorX = fileBbox.x
  for (let i = 0; i < numFrames; i++) {
    const colW = i === numFrames - 1
      ? fileBbox.x + fileBbox.w - cursorX // last column takes the remainder
      : Math.round(exactColW)
    columns.push({ x: cursorX, w: colW, index: i })
    cursorX += colW
  }
  console.log(`Split into ${numFrames} columns: ${columns.map(c => c.w).join(', ')}`)

  // Step 3: for each column, extract + compute per-frame content bbox
  const frameData = []
  for (const col of columns) {
    const colBuffer = await sharp(gridPath)
      .extract({ left: col.x, top: fileBbox.y, width: col.w, height: fileBbox.h })
      .raw()
      .ensureAlpha()
      .toBuffer()
    const bbox = getContentBBox(colBuffer, col.w, fileBbox.h)
    if (!bbox) {
      console.warn(`  WARN: frame-${col.index} column has no content`)
      continue
    }
    frameData.push({ index: col.index, col, colBuffer, bbox })
  }

  if (frameData.length === 0) {
    console.log(`  SKIP: no per-frame content`)
    return null
  }

  // Step 4: shared crop dimensions
  const maxContentW = Math.max(...frameData.map(f => f.bbox.w))
  const maxContentH = Math.max(...frameData.map(f => f.bbox.h))
  const cropW = maxContentW + PADDING * 2
  const cropH = maxContentH + PADDING * 2
  const targetContentSize = Math.round(TARGET_SIZE * FILL_RATIO)
  const scale = Math.min(targetContentSize / cropW, targetContentSize / cropH)
  const finalW = Math.max(1, Math.round(cropW * scale))
  const finalH = Math.max(1, Math.round(cropH * scale))
  console.log(`Max content: ${maxContentW} x ${maxContentH}`)
  console.log(`Shared crop: ${cropW} x ${cropH} (with ${PADDING}px padding)`)
  console.log(`Output: ${finalW} x ${finalH} centered in ${TARGET_SIZE}x${TARGET_SIZE}`)

  // Step 5: per-frame crop + write
  const stateOutDir = path.join(OUTPUT_DIR, stateName)
  fs.mkdirSync(stateOutDir, { recursive: true })

  // Clean any old frame-NN.png files (v1 was 9 frames, v2 is 7 — drop stale frame-07/08)
  const existing = fs.readdirSync(stateOutDir).filter(f => f.startsWith('frame-'))
  for (const f of existing) fs.unlinkSync(path.join(stateOutDir, f))

  const outputBboxes = []

  for (const { index, col, colBuffer, bbox } of frameData) {
    const cx = bbox.x + bbox.w / 2
    const cy = bbox.y + bbox.h / 2

    let left = Math.round(cx - cropW / 2)
    let top = Math.round(cy - cropH / 2)
    let right = left + cropW
    let bottom = top + cropH

    let padLeft = 0, padTop = 0, padRight = 0, padBottom = 0
    if (left < 0) { padLeft = -left; left = 0 }
    if (top < 0) { padTop = -top; top = 0 }
    if (right > col.w) { padRight = right - col.w; right = col.w }
    if (bottom > fileBbox.h) { padBottom = bottom - fileBbox.h; bottom = fileBbox.h }

    const srcW = right - left
    const srcH = bottom - top
    const squareSize = Math.max(srcW + padLeft + padRight, srcH + padTop + padBottom)
    const squareBuffer = Buffer.alloc(squareSize * squareSize * 4, 0)

    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const srcIdx = ((top + y) * col.w + (left + x)) * 4
        const dstIdx = ((padTop + y) * squareSize + (padLeft + x)) * 4
        squareBuffer[dstIdx] = colBuffer[srcIdx]
        squareBuffer[dstIdx + 1] = colBuffer[srcIdx + 1]
        squareBuffer[dstIdx + 2] = colBuffer[srcIdx + 2]
        squareBuffer[dstIdx + 3] = colBuffer[srcIdx + 3]
      }
    }

    const outPath = path.join(stateOutDir, `frame-${String(index).padStart(2, '0')}.png`)
    const outBuffer = await sharp(squareBuffer, {
      raw: { width: squareSize, height: squareSize, channels: 4 },
    })
      .resize(finalW, finalH, {
        fit: 'contain',
        position: 'center',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .extend({
        top: Math.floor((TARGET_SIZE - finalH) / 2),
        bottom: Math.ceil((TARGET_SIZE - finalH) / 2),
        left: Math.floor((TARGET_SIZE - finalW) / 2),
        right: Math.ceil((TARGET_SIZE - finalW) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toBuffer()

    fs.writeFileSync(outPath, outBuffer)

    const { data: outData, info: outInfo } = await sharp(outBuffer)
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true })
    const outBbox = getContentBBox(outData, outInfo.width, outInfo.height)
    if (outBbox) {
      outputBboxes.push({
        frame: index,
        x: outBbox.x,
        y: outBbox.y,
        w: outBbox.w,
        h: outBbox.h,
        cx: outBbox.x + outBbox.w / 2,
        cy: outBbox.y + outBbox.h / 2,
      })
    }
  }

  // Step 6: post-crop overlap test
  console.log(`\n--- Overlap Test (output ${TARGET_SIZE}x${TARGET_SIZE} bboxes) ---`)
  for (const ob of outputBboxes) {
    console.log(
      `  frame-${String(ob.frame).padStart(2, '0')}: bbox=[${ob.x},${ob.y},${ob.w}x${ob.h}] center=(${ob.cx.toFixed(1)},${ob.cy.toFixed(1)})`
    )
  }

  const cxStat = stats(outputBboxes.map(b => b.cx))
  const cyStat = stats(outputBboxes.map(b => b.cy))
  const wStat = stats(outputBboxes.map(b => b.w))
  const hStat = stats(outputBboxes.map(b => b.h))

  console.log(`\nCenter jitter: cx mean=${cxStat.mean} stddev=${cxStat.stddev} range=[${cxStat.min},${cxStat.max}]`)
  console.log(`               cy mean=${cyStat.mean} stddev=${cyStat.stddev} range=[${cyStat.min},${cyStat.max}]`)
  console.log(`Size jitter:   w  mean=${wStat.mean} stddev=${wStat.stddev} range=[${wStat.min},${wStat.max}]`)
  console.log(`               h  mean=${hStat.mean} stddev=${hStat.stddev} range=[${hStat.min},${hStat.max}]`)

  let jaccardSum = 0
  let jaccardCount = 0
  let minJaccard = 1
  let worstPair = null
  for (let i = 0; i < outputBboxes.length; i++) {
    for (let j = i + 1; j < outputBboxes.length; j++) {
      const a = outputBboxes[i]
      const b = outputBboxes[j]
      const jv = jaccard(a, b)
      jaccardSum += jv
      jaccardCount++
      if (jv < minJaccard) {
        minJaccard = jv
        worstPair = [a.frame, b.frame]
      }
    }
  }
  const avgJaccard = jaccardCount > 0 ? jaccardSum / jaccardCount : 0
  console.log(`\nJaccard index (intersection / union of body bboxes):`)
  console.log(`  Average: ${avgJaccard.toFixed(3)} across ${jaccardCount} pairs`)
  console.log(`  Worst pair: frame-${worstPair?.[0]} vs frame-${worstPair?.[1]} = ${minJaccard.toFixed(3)}`)

  if (avgJaccard >= VERDICT_THRESHOLDS.passJaccard) {
    console.log(`\n  PASS — strong body overlap, safe to ship`)
  } else if (avgJaccard >= VERDICT_THRESHOLDS.warnJaccard) {
    console.log(`\n  WARN — moderate overlap, frames will look slightly different`)
  } else {
    console.log(`\n  FAIL — weak overlap, frames will look like different characters`)
  }

  return {
    state: stateName,
    framesWritten: outputBboxes.length,
    avgJaccard,
    minJaccard,
    centerJitterX: parseFloat(cxStat.stddev),
    centerJitterY: parseFloat(cyStat.stddev),
  }
}

async function main() {
  const args = process.argv.slice(2)
  const targetState = args.includes('--state') ? args[args.indexOf('--state') + 1] : null

  const gridFiles = fs.readdirSync(GRID_DIR)
    .filter(f => f.endsWith('.png'))
    .sort()

  if (gridFiles.length === 0) {
    console.error(`No grid files in ${GRID_DIR}`)
    process.exit(1)
  }

  const results = []
  for (const file of gridFiles) {
    const baseName = file.replace(/\.png$/, '')
    const stateName = STATE_MAP[baseName]
    if (!stateName) {
      console.log(`Skipping unknown grid: ${file}`)
      continue
    }
    if (targetState && stateName !== targetState) continue

    const gridPath = path.join(GRID_DIR, file)
    const result = await processGrid(gridPath, stateName)
    if (result) results.push(result)
  }

  // Final summary
  if (results.length > 0) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`SUMMARY`)
    console.log('='.repeat(60))
    for (const r of results) {
      const verdict = r.avgJaccard >= VERDICT_THRESHOLDS.passJaccard
        ? 'PASS'
        : r.avgJaccard >= VERDICT_THRESHOLDS.warnJaccard
          ? 'WARN'
          : 'FAIL'
      console.log(
        `  ${r.state.padEnd(10)} ${r.framesWritten} frames | Jaccard avg=${r.avgJaccard.toFixed(3)} min=${r.minJaccard.toFixed(3)} | jitter (${r.centerJitterX}, ${r.centerJitterY})px | ${verdict}`
      )
    }
  }

  console.log(`\nNext: node scripts/generate-xiaoyue-spritesheet.mjs`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
