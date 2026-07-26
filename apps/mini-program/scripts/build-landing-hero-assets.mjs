#!/usr/bin/env node
/**
 * Build pipeline for the landing "Blind-box City" hero assets.
 *
 * Reads the Lovart source PNGs from assets-source/lovart/landing screen/ and
 * emits the production WebP set into src/assets/lovart/landing/:
 *
 *   hero-box-xiaoyue-dusk.webp      1440×1440, q80+alpha, purple corrected
 *   hero-box-xiaoyue-dusk-lqip.webp 48×48 blurred blur-up placeholder
 *   sprite-{dice,cards,glass,map-pin,buildings}.webp  trimmed, fitted, q80+alpha
 *
 * Processing rules (from the brief, docs/design/lovart-brief-landing-blind-box-city-20260726.md):
 * - Master keeps its full canvas (composition math — sprite stage positions and
 *   the hero-peek rim % are canvas-relative) and gets −15% saturation to pull
 *   the royal Lovart purple toward dusty brand #8B5CF6.
 * - Sprites are trimmed of transparent margins and re-centered on a fresh
 *   canvas (their on-stage size comes from SCSS, not the source canvas).
 * - map-pin gets the same purple correction as the master.
 * - Also measures the box-rim position (% of canvas height) on the corrected
 *   master and prints it — feed that number into `hero-peek`'s `from` inset in
 *   src/pages/index/index.scss.
 *
 * Usage: node scripts/build-landing-hero-assets.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC_DIR = path.resolve(__dirname, '../assets-source/lovart/landing screen')
const OUT_DIR = path.resolve(__dirname, '../src/assets/lovart/landing')

const PURPLE_SAT = 0.85 // −15% saturation: royal Lovart purple → dusty #8B5CF6 family

fs.mkdirSync(OUT_DIR, { recursive: true })

function kb(file) {
  return (fs.statSync(file).size / 1024).toFixed(1)
}

/** Trim transparent margins, fit content into a padded canvas. */
async function buildSprite({ src, out, canvasW, canvasH, pad = 24, saturate }) {
  let img = sharp(path.join(SRC_DIR, src)).trim({ threshold: 10 })
  if (saturate) img = img.modulate({ saturation: saturate })
  const trimmed = await img.png().toBuffer()
  const meta = await sharp(trimmed).metadata()
  const fitW = canvasW - pad * 2
  const fitH = canvasH - pad * 2
  const resized = await sharp(trimmed)
    .resize(fitW, fitH, { fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
    .png()
    .toBuffer()
  const rMeta = await sharp(resized).metadata()
  const left = Math.round((canvasW - (rMeta.width ?? fitW)) / 2)
  const top = Math.round((canvasH - (rMeta.height ?? fitH)) / 2)
  const outFile = path.join(OUT_DIR, out)
  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top }])
    .webp({ quality: 80, alphaQuality: 90 })
    .toFile(outFile)
  console.log(`✅ ${out}  ${meta.width}×${meta.height} → ${canvasW}×${canvasH}  ${kb(outFile)}KB`)
}

/** Measure the box-rim y% on the master: first row (from top) whose opaque
    coverage jumps to ≥85% and never drops below 80% afterwards = box body top. */
async function measureRim(masterBuffer) {
  const { data, info } = await sharp(masterBuffer)
    .resize(256, 256, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const rows = []
  for (let y = 0; y < info.height; y += 1) {
    let opaque = 0
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] >= 128) opaque += 1
    }
    rows.push(opaque / info.width)
  }
  for (let y = 0; y < rows.length; y += 1) {
    if (rows[y] < 0.85) continue
    let staysHigh = true
    for (let k = y; k < rows.length; k += 1) {
      if (rows[k] < 0.8) {
        staysHigh = false
        break
      }
    }
    if (staysHigh) return (y / rows.length) * 100
  }
  return null
}

// ─── Master ──────────────────────────────────────────────────────────
console.log('📦 master (mascot box.png)')
const masterSrc = path.join(SRC_DIR, 'mascot box.png')
const masterCorrected = await sharp(masterSrc)
  .resize(1440, 1440, { fit: 'fill', kernel: 'lanczos3' })
  .modulate({ saturation: PURPLE_SAT })
  .png()
  .toBuffer()

const heroOut = path.join(OUT_DIR, 'hero-box-xiaoyue-dusk.webp')
await sharp(masterCorrected).webp({ quality: 80, alphaQuality: 90 }).toFile(heroOut)
console.log(`✅ hero-box-xiaoyue-dusk.webp  1440×1440  ${kb(heroOut)}KB  (sat −15%)`)

const lqipOut = path.join(OUT_DIR, 'hero-box-xiaoyue-dusk-lqip.webp')
await sharp(masterCorrected)
  .resize(48, 48, { fit: 'fill' })
  .blur(8)
  .webp({ quality: 35 })
  .toFile(lqipOut)
console.log(`✅ hero-box-xiaoyue-dusk-lqip.webp  48×48  ${kb(lqipOut)}KB`)

const rimPct = await measureRim(masterCorrected)
console.log(`\n📐 box-rim position: ${rimPct === null ? 'NOT FOUND' : `${rimPct.toFixed(1)}% of canvas height`}`)
console.log('   → set hero-peek `from` inset in src/pages/index/index.scss to this value (round to nearest integer).')

// ─── Sprites ─────────────────────────────────────────────────────────
console.log('\n📦 sprites')
await buildSprite({ src: 'dice.png', out: 'sprite-dice.webp', canvasW: 512, canvasH: 512 })
await buildSprite({ src: 'card.png', out: 'sprite-cards.webp', canvasW: 512, canvasH: 512 })
await buildSprite({ src: 'glass.png', out: 'sprite-glass.webp', canvasW: 512, canvasH: 512 })
await buildSprite({ src: 'location.png', out: 'sprite-map-pin.webp', canvasW: 512, canvasH: 512, saturate: PURPLE_SAT })
// Buildings content is portrait (towers cluster) — emit a portrait canvas so
// the on-stage slot (128×208rpx) keeps the towers legible.
await buildSprite({ src: 'building.png', out: 'sprite-buildings.webp', canvasW: 400, canvasH: 640 })

console.log('\nNext: node scripts/check-landing-hero-assets.mjs')
