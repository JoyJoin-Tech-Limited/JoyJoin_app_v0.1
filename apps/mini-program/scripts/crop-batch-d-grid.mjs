// apps/mini-program/scripts/crop-batch-d-grid.mjs
//
// Smart crop: detects each cell's content bounding box via alpha channel,
// then crops with a small fixed padding (~3% per side) for breathing room.
// Batch D = 3 cols × 3 rows of 800×800 cells → 9 badge tiles.
//
// Run: node apps/mini-program/scripts/crop-batch-d-grid.mjs

import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const SRC = 'apps/mini-program/assets-source/raw assets/lovart-master-batch-d-20260604-v1.png'
const OUT_DIR = 'apps/mini-program/src/assets/badges'
const CELL = 800
const PADDING = 24 // px of breathing room around content on each side
const ALPHA_THRESHOLD = 10 // pixels with alpha > this are "content"

// Cell coordinate table — MUST match docs/design/lovart-brief-achievement-milestone-batch-d-20260604.md
const CELLS = [
  { id: 'first-event-celebrate',            col: 0, row: 0 },
  { id: 'streak-3-events',                  col: 1, row: 0 },
  { id: 'quiz-halfway-cheer',               col: 2, row: 0 },
  { id: 'match-reason-same-relationship',   col: 0, row: 1 },
  { id: 'match-reason-same-archetype-band', col: 1, row: 1 },
  { id: 'match-reason-same-work-industry',  col: 2, row: 1 },
  { id: 'match-reason-exact-archetype',     col: 0, row: 2 },
  { id: 'match-reason-hometown-industry',   col: 1, row: 2 },
  { id: 'recap-stamp-of-you',               col: 2, row: 2 },
]

await mkdir(OUT_DIR, { recursive: true })

for (const c of CELLS) {
  // 1. Extract the 800×800 cell region
  const { data, info } = await sharp(SRC)
    .extract({
      left: c.col * CELL,
      top:  c.row * CELL,
      width: CELL,
      height: CELL,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  // 2. Scan alpha channel to find content bounds within the cell
  let minX = CELL, minY = CELL, maxX = -1, maxY = -1
  let contentPx = 0
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * 4
      if (data[idx + 3] > ALPHA_THRESHOLD) {
        contentPx++
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < 0) {
    console.warn(`[batch-d] ${c.id}: no content found, skipping`)
    continue
  }

  // 3. Add padding, clamped to cell bounds
  const left   = Math.max(0, minX - PADDING)
  const top    = Math.max(0, minY - PADDING)
  const right  = Math.min(CELL - 1, maxX + PADDING)
  const bottom = Math.min(CELL - 1, maxY + PADDING)
  const width  = right - left + 1
  const height = bottom - top + 1

  // 4. Crop & save
  const outPath = `${OUT_DIR}/${c.id}-20260604-v1.png`
  await sharp(SRC)
    .extract({
      left: c.col * CELL + left,
      top:  c.row * CELL + top,
      width,
      height,
    })
    .png()
    .toFile(outPath)

  const fillPct = (contentPx / (info.width * info.height) * 100).toFixed(1)
  const cropPct = (width * height / (info.width * info.height) * 100).toFixed(1)
  console.log(
    `[batch-d] ${c.id.padEnd(36)} ` +
    `content=${contentPx.toString().padStart(7)}px (${fillPct}%)  ` +
    `crop=${width}×${height} (${cropPct}% of cell)  ` +
    `→ ${outPath}`
  )
}

console.log(`\n[batch-d] done. ${CELLS.length} tiles written to ${OUT_DIR}`)
console.log(`[batch-d] next: npm run optimize:lovart  (to generate WebP variants)`)
