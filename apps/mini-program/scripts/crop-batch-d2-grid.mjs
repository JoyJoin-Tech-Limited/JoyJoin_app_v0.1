// Batch D2 milestone medallions — crop 2400×800 master grid → 3 CDN tiles.
// Master: assets-source/lovart/achievement/joyjoin achievement medallions.png
// Tiles:  src/assets/badges/badge-{5,10,20}-events-20261022-v1.webp (400×400, q=55)
// Mirrors Batch D conventions (400px webp, ~13-18KB per tile).
// Run: node apps/mini-program/scripts/crop-batch-d2-grid.mjs

import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const SRC = 'apps/mini-program/assets-source/lovart/achievement/joyjoin achievement medallions.png'
const OUT_DIR = 'apps/mini-program/src/assets/badges'
const CELL = 800
const OUT_SIZE = 400
const QUALITY = 55

const CELLS = [
  { id: 'badge-5-events', col: 0 },
  { id: 'badge-10-events', col: 1 },
  { id: 'badge-20-events', col: 2 },
]

await mkdir(OUT_DIR, { recursive: true })

for (const c of CELLS) {
  const out = `${OUT_DIR}/${c.id}-20261022-v1.webp`
  await sharp(SRC)
    .extract({ left: c.col * CELL, top: 0, width: CELL, height: CELL })
    .resize(OUT_SIZE, OUT_SIZE)
    .webp({ quality: QUALITY })
    .toFile(out)

  // Acceptance: corners must be transparent (no white fringe / baked background)
  const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true })
  const corners = [
    [0, 0],
    [info.width - 1, 0],
    [0, info.height - 1],
    [info.width - 1, info.height - 1],
  ]
  const alphas = corners.map(([x, y]) => data[(y * info.width + x) * info.channels + 3])
  const { size } = await import('node:fs/promises').then((fs) => fs.stat(out))
  console.log(`[batch-d2] ${c.id} → ${OUT_SIZE}×${OUT_SIZE} webp, ${(size / 1024).toFixed(1)}KB, corner alpha=[${alphas.join(',')}]`)
  if (alphas.some((a) => a > 8)) {
    console.warn(`  ⚠️  corner not transparent — check for baked background`)
  }
}
console.log('[batch-d2] done')
