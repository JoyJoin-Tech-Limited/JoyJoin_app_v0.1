import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(__dirname, '../src/assets/gathering-room/room-composite-v1.webp')
const OUT = path.join(__dirname, '../src/assets/gathering-room/room-composite-v2.webp')

// ── Window frame (measured on 5px grids) ────────────────────────────────────
// Inner quad the clipped night panel is allowed to occupy.
const INNER = [
  [128, 232],
  [232, 138],
  [232, 282],
  [128, 382],
]
// Outer quad — wood band lives between INNER and OUTER.
const OUTER = [
  [112, 225],
  [250, 118],
  [250, 300],
  [112, 395],
]
// Ghost panel source columns: skip the ragged top-left notch (232–240).
const GHOST_SX_MIN = 240
const GHOST_SX_MAX = 322
// Wall rebuild sample band above the ghost panel.
const WALL_Y = 103

const T = (x) => 225 - ((x - 125) * 95) / 113
const B = (x) => 385 - ((x - 125) * 98) / 113
const RAIL_TOP = (x) => 130 - ((x - 238) * 18) / 14
const RAIL_BOTTOM = (x) => 287 + ((x - 238) * 13) / 14
const BASEBOARD_TOP = (x) => 252 - 0.0667 * (x - 320)
const SUNBEAM_TOP = (x) => Math.min(282 + 0.25 * (x - 230), 292)

const PATCH = { left: 120, top: 100, width: 250, height: 215 }
const BBOX = { x0: 100, y0: 100, x1: 380, y1: 330 }

function pointInQuad(x, y, q) {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = q[i]
    const [x2, y2] = q[(i + 1) % 4]
    const c = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)
    if (c !== 0) {
      const s = Math.sign(c)
      if (sign === 0) sign = s
      else if (s !== sign) return false
    }
  }
  return true
}

async function main() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const src = Buffer.from(data)
  const out = Buffer.from(data)
  const px = (x, y) => (y * width + x) * channels
  const copy = (d, s) => {
    out[d] = src[s]
    out[d + 1] = src[s + 1]
    out[d + 2] = src[s + 2]
    out[d + 3] = 255
  }
  const sample = (x, y) => px(
    Math.min(Math.max(Math.round(x), 0), width - 1),
    Math.min(Math.max(Math.round(y), 0), height - 1),
  )

  // Pass 1 — ghost panel mask: blue + 3px rim (catches anti-aliasing / stars).
  // Thresholds are loose enough to catch the dark wedge (5,27,63) without
  // touching the black pane (15,15,25), cream wall, or wood.
  const blue = new Uint8Array(width * height)
  for (let y = BBOX.y0; y < BBOX.y1; y++) {
    for (let x = BBOX.x0; x < BBOX.x1; x++) {
      const i = px(x, y)
      const r = src[i], g = src[i + 1], b = src[i + 2]
      if (b > 55 && b > r + 8 && b > g + 4) blue[y * width + x] = 1
    }
  }
  const isPanel = (x, y) => {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= BBOX.x0 && nx < BBOX.x1 && ny >= BBOX.y0 && ny < BBOX.y1 && blue[ny * width + nx]) return true
      }
    }
    return false
  }

  // Pass 2 — rebuild the frame band: any panel pixel between INNER and OUTER
  // gets wood. Right rail (x≥233): proportional column-copy from the rail's
  // own clean top rows (y 118–150) — same column, smooth gradient, no
  // striping. Top rail band: mirror from the left section of the top rail.
  let railN = 0
  const mirror = (x, y) => {
    if (x >= 233) {
      const bandTop = RAIL_TOP(x)
      const bandBottom = RAIL_BOTTOM(x)
      // Sample each column's own clean top (bandTop+6 … bandTop+30) — the
      // band below bandTop is wall, not wood, so absolute rows would paint
      // cream into the rail head.
      return [x, bandTop + 6 + ((y - bandTop) / (bandBottom - bandTop)) * 24]
    }
    return [x - 160, y + 88]
  }
  for (let y = BBOX.y0; y < BBOX.y1; y++) {
    for (let x = BBOX.x0; x < BBOX.x1; x++) {
      if (!isPanel(x, y)) continue
      if (pointInQuad(x, y, INNER)) continue
      if (!pointInQuad(x, y, OUTER)) continue
      const [sx, sy] = mirror(x, y)
      copy(px(x, y), sample(sx, sy))
      railN++
    }
  }

  // Pass 3 — clip the panel: panel pixels INSIDE the frame get re-sampled
  // from the ghost's clean columns so the ragged notch edge disappears.
  let clipN = 0
  for (let y = BBOX.y0; y < BBOX.y1; y++) {
    for (let x = BBOX.x0; x < BBOX.x1; x++) {
      if (!blue[y * width + x]) continue
      if (!pointInQuad(x, y, INNER)) continue
      copy(px(x, y), sample(Math.max(x, GHOST_SX_MIN), y))
      clipN++
    }
  }

  // Pass 4 — wall / baseboard rebuild right of the frame (panel + remaining
  // spill), stopping at the sunbeam patch on the floor.
  let wallN = 0
  for (let x = 251; x <= 352; x++) {
    const bbTop = BASEBOARD_TOP(x)
    const yEnd = Math.floor(SUNBEAM_TOP(x))
    for (let y = 148; y <= yEnd; y++) {
      if (y >= bbTop) continue // baseboard / floor was never covered — keep
      copy(px(x, y), sample(x, WALL_Y + (x % 5)))
      wallN++
    }
  }
  // The panel's bottom edge + wedge covered the baseboard down to y≈292 for
  // x 251–320: rebuild that strip from the clean baseboard continuation.
  // Sample distance must clear the ghost panel (ends x≈322): x≤265 jumps
  // +100 (lands 351–365), wider x jumps +58 (lands 324–378) — both clean,
  // and both stay left of the door frame (x≈410).
  let bbN = 0
  for (let x = 251; x <= 320; x++) {
    const bbTop = BASEBOARD_TOP(x)
    // yEnd 298: the wedge's bottom rim reaches y≈297 over the sunbeam —
    // rebuilding to 292 left a visible blue strip at the wall base.
    const yEnd = 298
    const jump = x <= 275 ? 100 : 58
    const slope = x <= 275 ? 7 : 4
    for (let y = Math.ceil(bbTop); y <= yEnd; y++) {
      copy(px(x, y), sample(x + jump, y - slope))
      bbN++
    }
  }

  // Pass 5 — soften seams.
  const repaired = await sharp(out, { raw: { width, height, channels } }).png().toBuffer()
  const patch = await sharp(repaired).extract(PATCH).blur(0.6).png().toBuffer()
  await sharp(repaired)
    .composite([{ input: patch, top: PATCH.top, left: PATCH.left }])
    .webp({ quality: 92 })
    .toFile(OUT)

  // Guard: no panel blue may remain outside the inner quad. Guard bbox stops
  // at x=355 — the purple lamp (x≈360+) is legitimately blue-dominant.
  const check = await sharp(OUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let leftover = 0
  for (let y = BBOX.y0; y < BBOX.y1; y++) {
    for (let x = BBOX.x0; x < 355; x++) {
      if (pointInQuad(x, y, INNER)) continue
      const i = (y * check.info.width + x) * check.info.channels
      const r = check.data[i], g = check.data[i + 1], b = check.data[i + 2]
      if (b > r + 20 && b > g + 12 && b > 80) leftover++
    }
  }
  console.log(`rail=${railN} clip=${clipN} wall=${wallN} baseboard=${bbN} leftover=${leftover}`)
  if (leftover > 40) {
    console.error('FAIL: blue spill remains outside the window frame')
    process.exit(1)
  }
  console.log(`wrote ${path.relative(process.cwd(), OUT)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
