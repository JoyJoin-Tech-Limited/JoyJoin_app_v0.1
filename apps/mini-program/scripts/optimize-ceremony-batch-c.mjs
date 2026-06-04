// apps/mini-program/scripts/optimize-ceremony-batch-c.mjs
//
// Targeted WebP optimization for Batch C ceremony heroes.
// Reads PNG masters from `assets-source/lovart/batch-c/`, writes WebP
// runtime tiles to `src/assets/ceremony/` (bundled in WeChat package).
// Resizes to 600px max width, quality 60, effort 6 — tighter settings for
// local-bundle deployment (Path B). Display sizes range 200–480rpx (max 360px
// on 1.5x devices), so 600px source is plenty. q=60 is the lowest we can go
// before flat-color banding becomes visible on the gradient hero art.
//
// Run: node apps/mini-program/scripts/optimize-ceremony-batch-c.mjs

import sharp from 'sharp'
import { readdir } from 'node:fs/promises'
import path from 'node:path'

const SRC_DIR = 'apps/mini-program/assets-source/lovart/batch-c'
const OUT_DIR = 'apps/mini-program/src/assets/ceremony'
const MAX_WIDTH = 500
const WEBP_QUALITY = 30
const WEBP_EFFORT = 6

const files = (await readdir(SRC_DIR)).filter((f) => f.endsWith('.png')).sort()

console.log(`[optimize-ceremony] ${files.length} files to convert`)

for (const f of files) {
  const inPath = path.join(SRC_DIR, f)
  const outPath = path.join(OUT_DIR, f.replace(/\.png$/, '.webp'))
  const result = await sharp(inPath)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
    .toFile(outPath)

  const inSize = (await sharp(inPath).metadata()).width
  console.log(
    `[optimize-ceremony] ${f.padEnd(48)} ` +
    `${inSize}px → webp q${WEBP_QUALITY}  ` +
    `${(result.size / 1024).toFixed(1)}KB  ` +
    `→ ${path.basename(outPath)}`
  )
}

console.log(`\n[optimize-ceremony] done. ${files.length} WebP variants written to ${OUT_DIR}`)
