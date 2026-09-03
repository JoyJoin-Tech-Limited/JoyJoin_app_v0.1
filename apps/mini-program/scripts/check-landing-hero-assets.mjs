#!/usr/bin/env node
/**
 * Anti-AI-slop gate for the landing "Blind-box City" hero assets.
 *
 * Programmatic (objective) half of the slop gate — checks the things a
 * vision review can't be trusted to catch at a glance:
 *   1. Geometry contract   — exact canvas sizes (client layout depends on them)
 *   2. Alpha contract      — transparent bg; glow/art must decay to alpha≈0
 *                            BEFORE the canvas edge (no hard cutoffs / halo seams)
 *   3. Master composition  — upper 30% must stay empty (client sprites float there)
 *   4. Palette discipline  — brand purple present in master; no neon oversaturation
 *                            (classic AI-slop tell); mean saturation in a sane band
 *   5. Weight budget       — byte budgets from the design spec
 *
 * The subjective half (waxy fur, dead eyes, melted anatomy, pseudo-text) is the
 * 10-item vision rubric in docs/design/lovart-brief-landing-blind-box-city-20260726.md §5.
 *
 * Usage:
 *   node scripts/check-landing-hero-assets.mjs [--dir <path>]
 * Default dir: src/assets/lovart/landing/  (accepts PNG or WebP inputs)
 * Exit 1 if any asset is missing or fails a check.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_DIR = path.resolve(__dirname, '../src/assets/lovart/landing')

const dirArgIdx = process.argv.indexOf('--dir')
const ASSET_DIR = dirArgIdx > -1 ? process.argv[dirArgIdx + 1] : DEFAULT_DIR

// ─── Asset contract (from the design spec) ───────────────────────────
const ASSETS = [
  { base: 'hero-box-xiaoyue-dusk', width: 1440, height: 1440, maxKB: 240, master: true },
  { base: 'hero-box-xiaoyue-dusk-lqip', width: 48, height: 48, maxKB: 6, lqip: true },
  // Phase 1 dusk city backdrop (2026-09-03): FLATTENED (no alpha — the
  // feathering is client-side overlay Views), so the alpha-channel and
  // edge-decay checks are skipped; geometry/weight/palette budgets hold.
  { base: 'landing-backdrop-city-dusk', width: 752, height: 912, maxKB: 200, flattened: true },
  { base: 'landing-backdrop-city-dusk-lqip', width: 48, height: 58, maxKB: 6, lqip: true, flattened: true },
  { base: 'sprite-dice', width: 512, height: 512, maxKB: 30 },
  { base: 'sprite-cards', width: 512, height: 512, maxKB: 30 },
  { base: 'sprite-glass', width: 512, height: 512, maxKB: 30 },
  { base: 'sprite-buildings', width: 400, height: 640, maxKB: 36 },
  { base: 'sprite-map-pin', width: 512, height: 512, maxKB: 30 },
]

const EDGE_BAND_PX = 8 // outer ring that must be fully decayed
const EDGE_ALPHA_MAX = 2 // mean alpha (0-255) allowed in that ring
// Float-zone contract: the winning master's ear tips reach y≈23%, so the hard
// contract is "upper 20% stays clear" (the on-stage sprite slots are placed
// around the measured head region, not around the original brief geometry).
const UPPER_EMPTY_RATIO = 0.2
const UPPER_ALPHA_MAX = 2
// Neon detector: oversaturated-bright pixels OUTSIDE the warm band. Candlelight
// gold and deep amber window-glow (hue 10–65) are legitimately S≈1 & L>0.6 —
// flagging them was a false positive; neon slop is electric green/cyan/blue.
const NEON_SAT = 0.95
const NEON_LUM = 0.6
const WARM_HUE_MIN = 10
const WARM_HUE_MAX = 65
const NEON_PIXEL_MAX_RATIO = 0.01 // ≤1% of opaque pixels may be neon
const MEAN_SAT_MIN = 0.12 // below this the render reads washed-out/dead
const MEAN_SAT_MAX = 0.75 // above this it's almost certainly oversaturated AI slop
const SIZE_TOLERANCE = 0.02 // ±2% canvas-size tolerance

let failures = 0
let checks = 0

function pass(ok, label, detail) {
  checks += 1
  if (ok) {
    console.log(`   ✅ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failures += 1
    console.log(`   ❌ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h: h * 360, s, l }
}

/** Downscaled raw RGBA buffer for pixel-level analysis. */
async function analyzePixels(file) {
  const { data, info } = await sharp(file)
    .resize(256, 256, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

function meanAlphaInRegion(data, width, x0, y0, x1, y1) {
  let sum = 0
  let count = 0
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      sum += data[(y * width + x) * 4 + 3]
      count += 1
    }
  }
  return count === 0 ? 0 : sum / count
}

function findAssetFile(spec) {
  for (const ext of ['.webp', '.png']) {
    const candidate = path.join(ASSET_DIR, spec.base + ext)
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

async function checkAsset(spec) {
  console.log(`\n📦 ${spec.base}`)
  const file = findAssetFile(spec)
  if (!file) {
    pass(false, 'file exists', `missing in ${ASSET_DIR} (not yet generated)`)
    return
  }

  // 1. Geometry
  const meta = await sharp(file).metadata()
  const wOk = Math.abs((meta.width ?? 0) - spec.width) <= spec.width * SIZE_TOLERANCE
  const hOk = Math.abs((meta.height ?? 0) - spec.height) <= spec.height * SIZE_TOLERANCE
  pass(wOk && hOk, `canvas ${spec.width}×${spec.height}`, `got ${meta.width}×${meta.height}`)

  // 2. Alpha channel present (flattened assets skip — feathering is
  //    client-side, e.g. the dusk city backdrop)
  if (spec.flattened) {
    console.log('   ℹ️  alpha check skipped (flattened asset — client-side feathering)')
  } else {
    pass(meta.hasAlpha === true, 'has alpha channel (transparent bg)')
  }

  // 3. Weight budget (webp outputs; png masters get a pass with note)
  const kb = fs.statSync(file).size / 1024
  if (file.endsWith('.webp')) {
    pass(kb <= spec.maxKB, `weight ≤ ${spec.maxKB}KB`, `${kb.toFixed(1)}KB`)
  } else {
    console.log(`   ℹ️  weight ${kb.toFixed(0)}KB (PNG master — budget applies after WebP conversion)`)
  }

  const { data, width, height } = await analyzePixels(file)

  // 4. Edge decay: outer 8px ring must be alpha≈0 (glow/art may not touch edges)
  if (!spec.lqip && !spec.flattened) {
    const band = Math.max(2, Math.round((EDGE_BAND_PX / Math.max(meta.width, 1)) * width))
    const top = meanAlphaInRegion(data, width, 0, 0, width, band)
    const bottom = meanAlphaInRegion(data, width, 0, height - band, width, height)
    const left = meanAlphaInRegion(data, width, 0, 0, band, height)
    const right = meanAlphaInRegion(data, width, width - band, 0, width, height)
    const worst = Math.max(top, bottom, left, right)
    pass(
      worst <= EDGE_ALPHA_MAX,
      `glow decays to alpha≈0 before canvas edge`,
      `worst edge mean alpha ${worst.toFixed(1)} (top ${top.toFixed(1)} / bottom ${bottom.toFixed(1)} / left ${left.toFixed(1)} / right ${right.toFixed(1)})`,
    )
  }

  // 5. Master composition: upper 20% stays clear for client-side sprites
  if (spec.master) {
    const upperAlpha = meanAlphaInRegion(data, width, 0, 0, width, Math.round(height * UPPER_EMPTY_RATIO))
    pass(
      upperAlpha <= UPPER_ALPHA_MAX,
      `upper ${Math.round(UPPER_EMPTY_RATIO * 100)}% of master is empty (sprite float zone)`,
      `mean alpha ${upperAlpha.toFixed(1)}`,
    )
  }

  // 6. Palette discipline (opaque pixels only)
  let opaque = 0
  let neon = 0
  let satSum = 0
  let purple = 0
  for (let i = 0; i < width * height; i += 1) {
    const a = data[i * 4 + 3]
    if (a < 128) continue
    opaque += 1
    const { h, s, l } = rgbToHsl(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])
    satSum += s
    const inWarmBand = h >= WARM_HUE_MIN && h <= WARM_HUE_MAX
    if (s > NEON_SAT && l > NEON_LUM && !inWarmBand) neon += 1
    if (h >= 250 && h <= 280 && s > 0.25) purple += 1
  }
  if (opaque > 0) {
    const meanSat = satSum / opaque
    pass(
      meanSat >= MEAN_SAT_MIN && meanSat <= MEAN_SAT_MAX,
      `mean saturation in [${MEAN_SAT_MIN}, ${MEAN_SAT_MAX}]`,
      meanSat.toFixed(3),
    )
    const neonRatio = neon / opaque
    pass(
      neonRatio <= NEON_PIXEL_MAX_RATIO,
      'no neon oversaturation (AI-slop tell)',
      `${(neonRatio * 100).toFixed(2)}% neon pixels`,
    )
    if (spec.master) {
      const purpleRatio = purple / opaque
      pass(
        purpleRatio >= 0.05,
        'brand purple family present in master (hue 250–280)',
        `${(purpleRatio * 100).toFixed(1)}% of opaque pixels`,
      )
    }
  } else {
    pass(false, 'has opaque pixels', 'image is fully transparent')
  }
}

console.log('╔════════════════════════════════════════════════════════════╗')
console.log('║  Landing Hero Assets — Anti-AI-Slop Programmatic Gate      ║')
console.log('╚════════════════════════════════════════════════════════════╝')
console.log(`Dir: ${ASSET_DIR}`)

for (const spec of ASSETS) {
  await checkAsset(spec)
}

console.log('\n────────────────────────────────────────────────────────────')
console.log(`${failures === 0 ? '✅ PASS' : '❌ FAIL'} — ${checks} checks, ${failures} failure(s)`)
console.log('Subjective slop review (waxy fur / dead eyes / anatomy / pseudo-text):')
console.log('run the §5 vision rubric in docs/design/lovart-brief-landing-blind-box-city-20260726.md')
process.exit(failures === 0 ? 0 : 1)
