import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(APP_ROOT, '..', '..')
const SOURCE_ROOT = process.env.PROFILE_PIXEL_SOURCE_ROOT
  ? path.resolve(process.env.PROFILE_PIXEL_SOURCE_ROOT)
  : path.join(REPO_ROOT, 'assets-source', 'profile-pixel-v2')
const OUTPUT_ROOT = path.join(SOURCE_ROOT, 'generated-starter-layers')
const PROOF_ROOT = process.env.PROFILE_PIXEL_PROOF_ROOT
  ? path.resolve(process.env.PROFILE_PIXEL_PROOF_ROOT)
  : path.join(REPO_ROOT, 'agent_tmp', 'profile-pixel-atlas-proofs')
let activeOutputRoot = OUTPUT_ROOT
let activeProofRoot = PROOF_ROOT

const WIDTH = 512
const HEIGHT = 768
const SLOT_ORDER = ['top', 'bottom', 'shoes', 'accessory']
const ARCHETYPE_IDS = [
  'corgi',
  'rooster',
  'hamster_praise',
  'fox',
  'dolphin_calm',
  'spider',
  'koala',
  'octopus',
  'owl',
  'elephant',
  'turtle',
  'cat',
]

// These anchors describe the body, not the artwork. They remain as a guarded legacy
// fallback for source atlases that have not yet been converted to isolated equipment.
const BODY_GEOMETRY = {
  corgi: { torsoTop: 254, torsoBottom: 454, shoulder: 208, waist: 154, hands: [126, 386], hipTop: 414, hipWidth: 178, bottomEnd: 536, feetTop: 590 },
  rooster: { torsoTop: 242, torsoBottom: 450, shoulder: 196, waist: 148, hands: [139, 373], hipTop: 414, hipWidth: 164, bottomEnd: 526, feetTop: 582 },
  hamster_praise: { torsoTop: 270, torsoBottom: 466, shoulder: 192, waist: 154, hands: [143, 369], hipTop: 424, hipWidth: 180, bottomEnd: 544, feetTop: 582 },
  fox: { torsoTop: 250, torsoBottom: 454, shoulder: 174, waist: 136, hands: [157, 355], hipTop: 414, hipWidth: 156, bottomEnd: 621, feetTop: 582 },
  dolphin_calm: { torsoTop: 238, torsoBottom: 452, shoulder: 194, waist: 148, hands: [139, 373], hipTop: 414, hipWidth: 166, bottomEnd: 536, feetTop: 582 },
  spider: { torsoTop: 252, torsoBottom: 438, shoulder: 158, waist: 116, hands: [169, 343], hipTop: 400, hipWidth: 136, bottomEnd: 512, feetTop: 535 },
  koala: { torsoTop: 252, torsoBottom: 454, shoulder: 202, waist: 154, hands: [134, 378], hipTop: 414, hipWidth: 174, bottomEnd: 614, feetTop: 580 },
  octopus: { torsoTop: 282, torsoBottom: 468, shoulder: 192, waist: 148, hands: [135, 377], hipTop: 424, hipWidth: 168, bottomEnd: 538, feetTop: 582 },
  owl: { torsoTop: 250, torsoBottom: 466, shoulder: 220, waist: 172, hands: [126, 386], hipTop: 426, hipWidth: 188, bottomEnd: 538, feetTop: 572 },
}

const ACCESSORY_ROIS = {
  corgi: { left: 184, top: 245, width: 150, height: 130 },
  rooster: { left: 190, top: 268, width: 185, height: 120 },
  hamster_praise: { left: 120, top: 235, width: 300, height: 320 },
  fox: { left: 165, top: 245, width: 240, height: 165 },
  dolphin_calm: { left: 180, top: 205, width: 160, height: 185 },
  spider: { left: 155, top: 255, width: 235, height: 250 },
  koala: { left: 105, top: 235, width: 325, height: 325 },
  octopus: { left: 115, top: 260, width: 310, height: 285 },
  owl: { left: 100, top: 225, width: 345, height: 340 },
}

const EXTERNAL_EQUIPMENT_SHEET_IDS = new Set([
  'corgi',
  'rooster',
  'hamster_praise',
  'fox',
  'dolphin_calm',
  'spider',
  'koala',
  'octopus',
  'owl',
])

// Every target is fitted against the permanent-underwear body. The first nine
// archetypes read a dedicated 2x2 isolated-equipment sheet; elephant, turtle and cat
// already have isolated equipment cells in their canonical 3x2 atlas.
const ISOLATED_TARGETS = {
  corgi: {
    top: { left: 85, top: 194, width: 296, height: 290 },
    bottom: { left: 145, top: 398, width: 230, height: 180 },
    shoes: { left: 135, top: 584, width: 260, height: 135 },
    accessory: { left: 184, top: 245, width: 150, height: 130 },
  },
  rooster: {
    top: { left: 106, top: 214, width: 300, height: 258 },
    bottom: { left: 150, top: 398, width: 214, height: 170 },
    shoes: { left: 136, top: 576, width: 260, height: 145 },
    accessory: { left: 298, top: 278, width: 62, height: 62 },
  },
  hamster_praise: {
    top: { left: 101, top: 236, width: 310, height: 260 },
    bottom: { left: 128, top: 408, width: 252, height: 178 },
    shoes: { left: 124, top: 582, width: 262, height: 150 },
    accessory: { left: 146, top: 262, width: 260, height: 282 },
  },
  fox: {
    top: { left: 111, top: 210, width: 284, height: 274 },
    bottom: { left: 142, top: 398, width: 228, height: 265 },
    shoes: { left: 136, top: 584, width: 270, height: 150 },
    accessory: { left: 278, top: 268, width: 96, height: 64 },
  },
  dolphin_calm: {
    top: { left: 114, top: 178, width: 313, height: 304 },
    bottom: { left: 145, top: 398, width: 226, height: 180 },
    shoes: { left: 139, top: 582, width: 276, height: 150 },
    accessory: { left: 180, top: 205, width: 160, height: 185 },
  },
  spider: {
    top: { left: 115, top: 192, width: 282, height: 276 },
    bottom: { left: 156, top: 384, width: 200, height: 170 },
    shoes: { left: 154, top: 509, width: 260, height: 143 },
    accessory: { left: 155, top: 255, width: 235, height: 250 },
  },
  koala: {
    top: { left: 107, top: 192, width: 308, height: 292 },
    bottom: { left: 142, top: 398, width: 238, height: 258 },
    shoes: { left: 134, top: 580, width: 240, height: 145 },
    accessory: { left: 105, top: 235, width: 325, height: 325 },
  },
  octopus: {
    top: { left: 81, top: 222, width: 350, height: 276 },
    bottom: { left: 140, top: 408, width: 236, height: 172 },
    shoes: { left: 119, top: 556, width: 277, height: 131 },
    accessory: { left: 115, top: 260, width: 310, height: 285 },
  },
  owl: {
    top: { left: 102, top: 190, width: 316, height: 306 },
    bottom: { left: 142, top: 410, width: 230, height: 170 },
    shoes: { left: 110, top: 546, width: 279, height: 96 },
    accessory: { left: 130, top: 246, width: 284, height: 300 },
  },
  elephant: {
    top: { left: 126, top: 238, width: 274, height: 252 },
    bottom: { left: 171, top: 406, width: 185, height: 239 },
    shoes: { left: 111, top: 614, width: 286, height: 88 },
    accessory: { left: 114, top: 236, width: 302, height: 331 },
  },
  turtle: {
    top: { left: 135, top: 246, width: 242, height: 224 },
    bottom: { left: 171, top: 421, width: 181, height: 139 },
    shoes: { left: 111, top: 612, width: 288, height: 91 },
    accessory: { left: 184, top: 31, width: 145, height: 91 },
  },
  cat: {
    top: { left: 137, top: 239, width: 240, height: 247 },
    bottom: { left: 169, top: 411, width: 178, height: 226 },
    shoes: { left: 111, top: 612, width: 287, height: 91 },
    accessory: { left: 128, top: 226, width: 286, height: 331 },
  },
}

// The cat pants cell sits immediately above the full-outfit guide in its source atlas;
// clip the lower gutter so the guide's ear tips can never enter the reusable pants layer.
const ISOLATED_SOURCE_CLIPS = {
  cat: {
    bottom: { left: 0, top: 0, width: WIDTH, height: 620 },
  },
}

async function loadSharp() {
  try {
    return (await import('sharp')).default
  } catch (error) {
    const dependencyRoot = process.env.JOYJOIN_DEPENDENCY_ROOT
    if (!dependencyRoot) throw error
    return createRequire(path.join(dependencyRoot, 'package.json'))('sharp')
  }
}

const sharp = await loadSharp()

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function detectChroma(data, width, height) {
  const samples = []
  const margin = Math.max(4, Math.floor(Math.min(width, height) * 0.025))
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 24))) {
    for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 24))) {
      if (x > margin && x < width - margin && y > margin && y < height - margin) continue
      const index = (y * width + x) * 4
      samples.push([data[index], data[index + 1], data[index + 2]])
    }
  }
  return [median(samples.map((sample) => sample[0])), median(samples.map((sample) => sample[1])), median(samples.map((sample) => sample[2]))]
}

function removeChroma(data, width, height) {
  const [backgroundR, backgroundG, backgroundB] = detectChroma(data, width, height)
  const greenScreen = backgroundG > backgroundR + 80 && backgroundG > backgroundB + 80
  const magentaScreen = backgroundR > backgroundG + 80 && backgroundB > backgroundG + 80
  const output = Buffer.from(data)
  for (let index = 0; index < output.length; index += 4) {
    const deltaR = output[index] - backgroundR
    const deltaG = output[index + 1] - backgroundG
    const deltaB = output[index + 2] - backgroundB
    const distance = Math.sqrt(deltaR * deltaR + deltaG * deltaG + deltaB * deltaB)
    const greenSpill = greenScreen
      && output[index + 1] > 105
      && output[index + 1] > output[index] + 45
      && output[index + 1] > output[index + 2] + 45
    const magentaSpill = magentaScreen
      && output[index] > 115
      && output[index + 2] > 95
      && output[index] > output[index + 1] + 55
      && output[index + 2] > output[index + 1] + 55
    if (distance <= 72 || greenSpill || magentaSpill) {
      output[index + 3] = 0
    } else if (distance < 118) {
      output[index + 3] = Math.round(output[index + 3] * ((distance - 72) / 46))
    }
  }
  return output
}

async function readAtlasCells(sourcePath) {
  const metadata = await sharp(sourcePath).metadata()
  if (!metadata.width || !metadata.height) throw new Error(`Unreadable atlas: ${sourcePath}`)
  const cellWidth = Math.floor(metadata.width / 3)
  const cellHeight = Math.floor(metadata.height / 2)
  const cells = []
  for (let index = 0; index < 6; index += 1) {
    const column = index % 3
    const row = Math.floor(index / 3)
    const extracted = await sharp(sourcePath)
      .extract({
        left: column * cellWidth + 1,
        top: row * cellHeight + 1,
        width: cellWidth - 2,
        height: cellHeight - 2,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const keyed = removeChroma(extracted.data, extracted.info.width, extracted.info.height)
    const resized = await sharp(keyed, {
      raw: { width: extracted.info.width, height: extracted.info.height, channels: 4 },
    })
      .resize({
        width: WIDTH,
        height: HEIGHT,
        fit: 'contain',
        position: 'centre',
        kernel: sharp.kernel.nearest,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .raw()
      .toBuffer()
    cells.push(resized)
  }
  return cells
}

async function readEquipmentSheetCells(sourcePath) {
  const metadata = await sharp(sourcePath).metadata()
  if (!metadata.width || !metadata.height) {
    throw new Error(`Unreadable isolated equipment sheet: ${sourcePath}`)
  }
  const cellWidth = Math.floor(metadata.width / 2)
  const cellHeight = Math.floor(metadata.height / 2)
  if (cellWidth < 256 || cellHeight < 256) {
    throw new Error(`Isolated equipment sheet cells are too small: ${metadata.width}x${metadata.height}`)
  }

  const cells = []
  for (let index = 0; index < 4; index += 1) {
    const column = index % 2
    const row = Math.floor(index / 2)
    const extracted = await sharp(sourcePath)
      .extract({
        left: column * cellWidth + 2,
        top: row * cellHeight + 2,
        width: cellWidth - 4,
        height: cellHeight - 4,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const keyed = removeChroma(extracted.data, extracted.info.width, extracted.info.height)
    const resized = await sharp(keyed, {
      raw: { width: extracted.info.width, height: extracted.info.height, channels: 4 },
    })
      .resize({
        width: WIDTH,
        height: HEIGHT,
        fit: 'contain',
        position: 'centre',
        kernel: sharp.kernel.nearest,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .raw()
      .toBuffer()
    cells.push(resized)
  }
  return cells
}

function pixelOffset(x, y) {
  return (y * WIDTH + x) * 4
}

function clipRawToRoi(raw, roi) {
  if (!roi) return raw
  const output = Buffer.alloc(raw.length)
  const right = Math.min(WIDTH, roi.left + roi.width)
  const bottom = Math.min(HEIGHT, roi.top + roi.height)
  for (let y = Math.max(0, roi.top); y < bottom; y += 1) {
    for (let x = Math.max(0, roi.left); x < right; x += 1) {
      const offset = pixelOffset(x, y)
      raw.copy(output, offset, offset, offset + 4)
    }
  }
  return output
}

function scoreHeadAlignment(base, variant, dx, dy, maxY) {
  let score = 0
  let count = 0
  for (let y = 18; y < Math.min(maxY, HEIGHT); y += 6) {
    const sourceY = y - dy
    if (sourceY < 0 || sourceY >= HEIGHT) continue
    for (let x = 28; x < WIDTH - 28; x += 6) {
      const sourceX = x - dx
      if (sourceX < 0 || sourceX >= WIDTH) continue
      const baseOffset = pixelOffset(x, y)
      const variantOffset = pixelOffset(sourceX, sourceY)
      const baseAlpha = base[baseOffset + 3]
      const variantAlpha = variant[variantOffset + 3]
      if (baseAlpha < 32 && variantAlpha < 32) continue
      if (baseAlpha < 96 || variantAlpha < 96) {
        score += 160
        count += 1
        continue
      }
      score += Math.abs(base[baseOffset] - variant[variantOffset])
        + Math.abs(base[baseOffset + 1] - variant[variantOffset + 1])
        + Math.abs(base[baseOffset + 2] - variant[variantOffset + 2])
      count += 1
    }
  }
  return count > 0 ? score / count : Number.POSITIVE_INFINITY
}

function alignVariantToBase(base, variant, maxY) {
  let best = { dx: 0, dy: 0, score: Number.POSITIVE_INFINITY }
  for (let dy = -12; dy <= 12; dy += 1) {
    for (let dx = -12; dx <= 12; dx += 1) {
      const score = scoreHeadAlignment(base, variant, dx, dy, maxY)
      if (score < best.score) best = { dx, dy, score }
    }
  }
  const output = Buffer.alloc(WIDTH * HEIGHT * 4)
  for (let y = 0; y < HEIGHT; y += 1) {
    const sourceY = y - best.dy
    if (sourceY < 0 || sourceY >= HEIGHT) continue
    for (let x = 0; x < WIDTH; x += 1) {
      const sourceX = x - best.dx
      if (sourceX < 0 || sourceX >= WIDTH) continue
      const targetOffset = pixelOffset(x, y)
      const sourceOffset = pixelOffset(sourceX, sourceY)
      variant.copy(output, targetOffset, sourceOffset, sourceOffset + 4)
    }
  }
  return { raw: output, alignment: best }
}

function slotRoi(archetypeId, slot) {
  const geometry = BODY_GEOMETRY[archetypeId]
  if (slot === 'accessory') return ACCESSORY_ROIS[archetypeId]
  if (slot === 'top') {
    const left = Math.max(0, Math.min(geometry.hands[0] - 54, 256 - geometry.shoulder / 2 - 36))
    const right = Math.min(WIDTH, Math.max(geometry.hands[1] + 54, 256 + geometry.shoulder / 2 + 36))
    return { left, top: Math.max(0, geometry.torsoTop - 60), width: right - left, height: geometry.torsoBottom - geometry.torsoTop + 90 }
  }
  if (slot === 'bottom') {
    const top = Math.max(0, geometry.hipTop - 72)
    const left = Math.max(0, Math.floor(256 - geometry.hipWidth / 2 - 78))
    const right = Math.min(WIDTH, Math.ceil(256 + geometry.hipWidth / 2 + 78))
    return {
      left,
      top,
      width: right - left,
      height: Math.min(HEIGHT, geometry.bottomEnd + 68) - top,
    }
  }
  return { left: 55, top: geometry.feetTop - 26, width: WIDTH - 110, height: HEIGHT - geometry.feetTop + 26 }
}

function insideRoi(x, y, roi) {
  return x >= roi.left && x < roi.left + roi.width && y >= roi.top && y < roi.top + roi.height
}

function paletteIndex(red, green, blue) {
  return ((red >> 3) << 10) | ((green >> 3) << 5) | (blue >> 3)
}

// Build a coarse RGB distance field for the permanent base body. The character
// cells were rendered independently, so spatial subtraction alone mistakes a
// shifted arm or underwear edge for equipment. Colour-space subtraction removes
// those recurring body colours regardless of pose while retaining the garment's
// new palette.
function buildBasePaletteDistance(base) {
  const size = 32 * 32 * 32
  const distance = new Uint8Array(size)
  distance.fill(255)
  const queue = new Int32Array(size)
  let head = 0
  let tail = 0
  for (let offset = 0; offset < base.length; offset += 4) {
    if (base[offset + 3] < 96) continue
    const index = paletteIndex(base[offset], base[offset + 1], base[offset + 2])
    if (distance[index] === 0) continue
    distance[index] = 0
    queue[tail++] = index
  }
  while (head < tail) {
    const index = queue[head++]
    const red = index >> 10
    const green = (index >> 5) & 31
    const blue = index & 31
    const nextDistance = distance[index] + 1
    const neighbors = []
    if (red > 0) neighbors.push(index - 1024)
    if (red < 31) neighbors.push(index + 1024)
    if (green > 0) neighbors.push(index - 32)
    if (green < 31) neighbors.push(index + 32)
    if (blue > 0) neighbors.push(index - 1)
    if (blue < 31) neighbors.push(index + 1)
    for (const neighbor of neighbors) {
      if (distance[neighbor] <= nextDistance) continue
      distance[neighbor] = nextDistance
      queue[tail++] = neighbor
    }
  }
  return distance
}

function buildPaletteDistanceFromRoi(raw, roi) {
  const size = 32 * 32 * 32
  const distance = new Uint8Array(size)
  distance.fill(255)
  const queue = new Int32Array(size)
  let head = 0
  let tail = 0
  for (let y = Math.max(0, Math.floor(roi.top)); y < Math.min(HEIGHT, Math.ceil(roi.top + roi.height)); y += 1) {
    for (let x = Math.max(0, Math.floor(roi.left)); x < Math.min(WIDTH, Math.ceil(roi.left + roi.width)); x += 1) {
      const offset = pixelOffset(x, y)
      if (raw[offset + 3] < 96) continue
      const index = paletteIndex(raw[offset], raw[offset + 1], raw[offset + 2])
      if (distance[index] === 0) continue
      distance[index] = 0
      queue[tail++] = index
    }
  }
  while (head < tail) {
    const index = queue[head++]
    const red = index >> 10
    const green = (index >> 5) & 31
    const blue = index & 31
    const nextDistance = distance[index] + 1
    const neighbors = []
    if (red > 0) neighbors.push(index - 1024)
    if (red < 31) neighbors.push(index + 1024)
    if (green > 0) neighbors.push(index - 32)
    if (green < 31) neighbors.push(index + 32)
    if (blue > 0) neighbors.push(index - 1)
    if (blue < 31) neighbors.push(index + 1)
    for (const neighbor of neighbors) {
      if (distance[neighbor] <= nextDistance) continue
      distance[neighbor] = nextDistance
      queue[tail++] = neighbor
    }
  }
  return distance
}

function expandMaskWithin(seedMask, candidateMask, passes) {
  let current = seedMask
  for (let pass = 0; pass < passes; pass += 1) {
    const expanded = new Uint8Array(current)
    for (let y = 1; y < HEIGHT - 1; y += 1) {
      for (let x = 1; x < WIDTH - 1; x += 1) {
        const index = y * WIDTH + x
        if (!candidateMask[index] || current[index]) continue
        let touches = false
        for (let oy = -1; oy <= 1 && !touches; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if (current[(y + oy) * WIDTH + x + ox]) { touches = true; break }
          }
        }
        if (touches) expanded[index] = 1
      }
    }
    current = expanded
  }
  return current
}

function binaryClose(mask, radius = 1) {
  let current = mask
  for (let pass = 0; pass < radius; pass += 1) {
    const dilated = new Uint8Array(current.length)
    for (let y = 1; y < HEIGHT - 1; y += 1) {
      for (let x = 1; x < WIDTH - 1; x += 1) {
        let hit = false
        for (let oy = -1; oy <= 1 && !hit; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if (current[(y + oy) * WIDTH + x + ox]) { hit = true; break }
          }
        }
        if (hit) dilated[y * WIDTH + x] = 1
      }
    }
    const eroded = new Uint8Array(current.length)
    for (let y = 1; y < HEIGHT - 1; y += 1) {
      for (let x = 1; x < WIDTH - 1; x += 1) {
        let keep = true
        for (let oy = -1; oy <= 1 && keep; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if (!dilated[(y + oy) * WIDTH + x + ox]) { keep = false; break }
          }
        }
        if (keep) eroded[y * WIDTH + x] = 1
      }
    }
    current = eroded
  }
  return current
}

function removeTinyComponents(mask, minimumSize) {
  const visited = new Uint8Array(mask.length)
  const output = new Uint8Array(mask.length)
  const queue = new Int32Array(mask.length)
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue
    let head = 0
    let tail = 0
    queue[tail++] = start
    visited[start] = 1
    while (head < tail) {
      const current = queue[head++]
      const x = current % WIDTH
      const y = Math.floor(current / WIDTH)
      const neighbors = [current - 1, current + 1, current - WIDTH, current + WIDTH]
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= mask.length || visited[neighbor] || !mask[neighbor]) continue
        const neighborX = neighbor % WIDTH
        const neighborY = Math.floor(neighbor / WIDTH)
        if (Math.abs(neighborX - x) + Math.abs(neighborY - y) !== 1) continue
        visited[neighbor] = 1
        queue[tail++] = neighbor
      }
    }
    if (tail >= minimumSize) {
      for (let index = 0; index < tail; index += 1) output[queue[index]] = 1
    }
  }
  return output
}

function keepAnchoredComponents(mask, anchor, minimumSize) {
  const visited = new Uint8Array(mask.length)
  const output = new Uint8Array(mask.length)
  const queue = new Int32Array(mask.length)
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue
    let head = 0
    let tail = 0
    let touchesAnchor = false
    queue[tail++] = start
    visited[start] = 1
    while (head < tail) {
      const current = queue[head++]
      const x = current % WIDTH
      const y = Math.floor(current / WIDTH)
      if (insideRoi(x, y, anchor)) touchesAnchor = true
      const neighbors = [current - 1, current + 1, current - WIDTH, current + WIDTH]
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= mask.length || visited[neighbor] || !mask[neighbor]) continue
        const neighborX = neighbor % WIDTH
        const neighborY = Math.floor(neighbor / WIDTH)
        if (Math.abs(neighborX - x) + Math.abs(neighborY - y) !== 1) continue
        visited[neighbor] = 1
        queue[tail++] = neighbor
      }
    }
    if (touchesAnchor && tail >= minimumSize) {
      for (let index = 0; index < tail; index += 1) output[queue[index]] = 1
    }
  }
  return output
}

function extractChangedLayer(base, variant, roi, slot) {
  const mask = new Uint8Array(WIDTH * HEIGHT)
  const threshold = slot === 'accessory' ? 90 : 76
  for (let y = Math.max(0, Math.floor(roi.top)); y < Math.min(HEIGHT, Math.ceil(roi.top + roi.height)); y += 1) {
    for (let x = Math.max(0, Math.floor(roi.left)); x < Math.min(WIDTH, Math.ceil(roi.left + roi.width)); x += 1) {
      if (!insideRoi(x, y, roi)) continue
      const offset = pixelOffset(x, y)
      const variantAlpha = variant[offset + 3]
      if (variantAlpha < 24) continue
      const baseAlpha = base[offset + 3]
      const colorDelta = Math.abs(variant[offset] - base[offset])
        + Math.abs(variant[offset + 1] - base[offset + 1])
        + Math.abs(variant[offset + 2] - base[offset + 2])
      if (baseAlpha < 32 || colorDelta >= threshold) mask[y * WIDTH + x] = 1
    }
  }
  const cleaned = removeTinyComponents(binaryClose(mask, 1), slot === 'accessory' ? 7 : 32)
  const output = Buffer.alloc(WIDTH * HEIGHT * 4)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (!cleaned[y * WIDTH + x]) continue
      const offset = pixelOffset(x, y)
      variant.copy(output, offset, offset, offset + 4)
    }
  }
  return output
}

function extractPaletteLayer(base, variant, roi, slot, paletteDistance) {
  const candidateMask = new Uint8Array(WIDTH * HEIGHT)
  const seedMask = new Uint8Array(WIDTH * HEIGHT)
  const noveltyThreshold = slot === 'accessory' ? 2 : 1
  const differenceThreshold = slot === 'accessory' ? 54 : 40
  for (let y = Math.max(0, Math.floor(roi.top)); y < Math.min(HEIGHT, Math.ceil(roi.top + roi.height)); y += 1) {
    for (let x = Math.max(0, Math.floor(roi.left)); x < Math.min(WIDTH, Math.ceil(roi.left + roi.width)); x += 1) {
      const offset = pixelOffset(x, y)
      const variantAlpha = variant[offset + 3]
      if (variantAlpha < 24) continue
      const baseAlpha = base[offset + 3]
      const colorDelta = Math.abs(variant[offset] - base[offset])
        + Math.abs(variant[offset + 1] - base[offset + 1])
        + Math.abs(variant[offset + 2] - base[offset + 2])
      const index = y * WIDTH + x
      if (baseAlpha < 24 || colorDelta >= 24) candidateMask[index] = 1
      const novelty = paletteDistance[paletteIndex(variant[offset], variant[offset + 1], variant[offset + 2])]
      if (novelty >= noveltyThreshold && (baseAlpha < 24 || colorDelta >= differenceThreshold)) {
        seedMask[index] = 1
      }
    }
  }
  const expanded = expandMaskWithin(seedMask, candidateMask, slot === 'accessory' ? 2 : 3)
  const cleaned = removeTinyComponents(binaryClose(expanded, 1), slot === 'accessory' ? 6 : 28)
  const output = Buffer.alloc(WIDTH * HEIGHT * 4)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (!cleaned[y * WIDTH + x]) continue
      const offset = pixelOffset(x, y)
      variant.copy(output, offset, offset, offset + 4)
    }
  }
  return output
}

function extractLocalDifferenceLayer(base, variant, roi) {
  const candidateMask = new Uint8Array(WIDTH * HEIGHT)
  const seedMask = new Uint8Array(WIDTH * HEIGHT)
  const radius = 15
  const step = 3
  for (let y = Math.max(0, Math.floor(roi.top)); y < Math.min(HEIGHT, Math.ceil(roi.top + roi.height)); y += 1) {
    for (let x = Math.max(0, Math.floor(roi.left)); x < Math.min(WIDTH, Math.ceil(roi.left + roi.width)); x += 1) {
      const offset = pixelOffset(x, y)
      if (variant[offset + 3] < 24) continue
      const samePointDelta = Math.abs(variant[offset] - base[offset])
        + Math.abs(variant[offset + 1] - base[offset + 1])
        + Math.abs(variant[offset + 2] - base[offset + 2])
      const index = y * WIDTH + x
      if (base[offset + 3] < 24 || samePointDelta >= 20) candidateMask[index] = 1
      let nearestDelta = 766
      for (let baseY = Math.max(0, y - radius); baseY <= Math.min(HEIGHT - 1, y + radius); baseY += step) {
        for (let baseX = Math.max(0, x - radius); baseX <= Math.min(WIDTH - 1, x + radius); baseX += step) {
          const baseOffset = pixelOffset(baseX, baseY)
          if (base[baseOffset + 3] < 64) continue
          const delta = Math.abs(variant[offset] - base[baseOffset])
            + Math.abs(variant[offset + 1] - base[baseOffset + 1])
            + Math.abs(variant[offset + 2] - base[baseOffset + 2])
          if (delta < nearestDelta) nearestDelta = delta
          if (nearestDelta < 38) break
        }
        if (nearestDelta < 38) break
      }
      if (nearestDelta >= 54) seedMask[index] = 1
    }
  }
  const expanded = expandMaskWithin(seedMask, candidateMask, 4)
  const cleaned = removeTinyComponents(binaryClose(expanded, 1), 24)
  const output = Buffer.alloc(WIDTH * HEIGHT * 4)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (!cleaned[y * WIDTH + x]) continue
      const offset = pixelOffset(x, y)
      variant.copy(output, offset, offset, offset + 4)
    }
  }
  return output
}

function extractSeededGarmentLayer(variant, geometry) {
  const seedRoi = {
    left: Math.floor(256 - geometry.hipWidth * 0.27),
    top: geometry.hipTop + 6,
    width: Math.ceil(geometry.hipWidth * 0.54),
    height: Math.min(58, Math.max(34, geometry.bottomEnd - geometry.hipTop - 22)),
  }
  const garmentRoi = {
    left: Math.max(0, Math.floor(256 - geometry.hipWidth / 2 - 46)),
    top: Math.max(0, geometry.hipTop - 16),
    width: Math.min(WIDTH, Math.ceil(geometry.hipWidth + 92)),
    height: Math.min(HEIGHT, geometry.bottomEnd + 42) - Math.max(0, geometry.hipTop - 16),
  }
  const paletteDistance = buildPaletteDistanceFromRoi(variant, seedRoi)
  const mask = new Uint8Array(WIDTH * HEIGHT)
  for (let y = garmentRoi.top; y < garmentRoi.top + garmentRoi.height; y += 1) {
    for (let x = garmentRoi.left; x < garmentRoi.left + garmentRoi.width; x += 1) {
      const offset = pixelOffset(x, y)
      if (variant[offset + 3] < 24) continue
      const distance = paletteDistance[paletteIndex(variant[offset], variant[offset + 1], variant[offset + 2])]
      if (distance <= 1) mask[y * WIDTH + x] = 1
    }
  }
  const cleaned = keepAnchoredComponents(binaryClose(mask, 2), seedRoi, 36)
  const output = Buffer.alloc(WIDTH * HEIGHT * 4)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (!cleaned[y * WIDTH + x]) continue
      const offset = pixelOffset(x, y)
      variant.copy(output, offset, offset, offset + 4)
    }
  }
  return { raw: output, seedRoi, garmentRoi }
}

function extractBottomLayer(base, variant, roi, geometry) {
  const mask = new Uint8Array(WIDTH * HEIGHT)
  for (let y = Math.max(0, Math.floor(roi.top)); y < Math.min(HEIGHT, Math.ceil(roi.top + roi.height)); y += 1) {
    for (let x = Math.max(0, Math.floor(roi.left)); x < Math.min(WIDTH, Math.ceil(roi.left + roi.width)); x += 1) {
      const offset = pixelOffset(x, y)
      if (variant[offset + 3] < 24) continue
      const colorDelta = Math.abs(variant[offset] - base[offset])
        + Math.abs(variant[offset + 1] - base[offset + 1])
        + Math.abs(variant[offset + 2] - base[offset + 2])
      if (base[offset + 3] < 32 || colorDelta >= 50) mask[y * WIDTH + x] = 1
    }
  }
  const anchor = {
    left: 256 - geometry.hipWidth / 2 + 8,
    top: geometry.hipTop - 12,
    width: geometry.hipWidth - 16,
    height: 92,
  }
  const cleaned = keepAnchoredComponents(binaryClose(mask, 2), anchor, 96)
  const output = Buffer.alloc(WIDTH * HEIGHT * 4)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const offset = pixelOffset(x, y)
      if (!cleaned[y * WIDTH + x]) continue
      variant.copy(output, offset, offset, offset + 4)
    }
  }
  return output
}

function alphaBounds(raw) {
  let minX = WIDTH
  let minY = HEIGHT
  let maxX = -1
  let maxY = -1
  let count = 0
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (raw[pixelOffset(x, y) + 3] < 16) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      count += 1
    }
  }
  return maxX >= minX ? { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1, count } : null
}

async function fitIsolatedItem(raw, target) {
  const alphaMask = new Uint8Array(WIDTH * HEIGHT)
  for (let index = 0; index < alphaMask.length; index += 1) {
    if (raw[index * 4 + 3] >= 16) alphaMask[index] = 1
  }
  const significantMask = removeTinyComponents(alphaMask, 80)
  const cleanedRaw = Buffer.alloc(raw.length)
  for (let index = 0; index < significantMask.length; index += 1) {
    if (!significantMask[index]) continue
    const offset = index * 4
    raw.copy(cleanedRaw, offset, offset, offset + 4)
  }
  const bounds = alphaBounds(cleanedRaw)
  if (!bounds) throw new Error('Isolated equipment cell is empty')
  const cropped = await sharp(cleanedRaw, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
    .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
    .resize({ width: target.width, height: target.height, fit: 'contain', kernel: sharp.kernel.nearest, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const output = Buffer.alloc(WIDTH * HEIGHT * 4)
  for (let y = 0; y < cropped.info.height; y += 1) {
    for (let x = 0; x < cropped.info.width; x += 1) {
      const sourceOffset = (y * cropped.info.width + x) * 4
      const targetX = target.left + x
      const targetY = target.top + y
      if (targetX < 0 || targetX >= WIDTH || targetY < 0 || targetY >= HEIGHT) continue
      cropped.data.copy(output, pixelOffset(targetX, targetY), sourceOffset, sourceOffset + 4)
    }
  }
  return output
}

async function writeRawPng(filePath, raw) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await sharp(raw, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(filePath)
}

async function buildArchetype(archetypeId) {
  const atlasPath = path.join(SOURCE_ROOT, archetypeId, 'atlas-source.png')
  const cells = await readAtlasCells(atlasPath)
  const base = cells[0]
  const usesExternalEquipmentSheet = EXTERNAL_EQUIPMENT_SHEET_IDS.has(archetypeId)
  const equipmentCells = usesExternalEquipmentSheet
    ? await readEquipmentSheetCells(path.join(SOURCE_ROOT, archetypeId, 'equipment-sheet-source.png'))
    : cells.slice(1, 5)
  const paletteDistance = ISOLATED_TARGETS[archetypeId] ? null : buildBasePaletteDistance(base)
  const layers = {}
  const diagnostics = {}
  for (let slotIndex = 0; slotIndex < SLOT_ORDER.length; slotIndex += 1) {
    const slot = SLOT_ORDER[slotIndex]
    const itemCell = clipRawToRoi(
      equipmentCells[slotIndex],
      ISOLATED_SOURCE_CLIPS[archetypeId]?.[slot],
    )
    if (ISOLATED_TARGETS[archetypeId]) {
      layers[slot] = await fitIsolatedItem(itemCell, ISOLATED_TARGETS[archetypeId][slot])
      diagnostics[slot] = {
        mode: usesExternalEquipmentSheet ? 'external-isolated-sheet' : 'atlas-isolated-cell',
        target: ISOLATED_TARGETS[archetypeId][slot],
      }
    } else {
      const geometry = BODY_GEOMETRY[archetypeId]
      const { raw: aligned, alignment } = alignVariantToBase(base, itemCell, geometry.torsoTop - 28)
      const roi = slotRoi(archetypeId, slot)
      if (slot === 'bottom') {
        if (process.env.PROFILE_PIXEL_DEBUG_CELLS === '1') {
          await writeRawPng(path.join(activeProofRoot, `debug-${archetypeId}-bottom-cell.png`), aligned)
        }
        const extraction = extractSeededGarmentLayer(aligned, geometry)
        layers[slot] = extraction.raw
        diagnostics[slot] = {
          mode: 'character-seeded-garment-palette',
          alignment,
          roi,
          seedRoi: extraction.seedRoi,
          garmentRoi: extraction.garmentRoi,
        }
      } else {
        layers[slot] = extractChangedLayer(base, aligned, roi, slot)
        diagnostics[slot] = { mode: 'character-difference', alignment, roi }
      }
    }
    const bounds = alphaBounds(layers[slot])
    if (!bounds || bounds.count < 24) throw new Error(`${archetypeId}/${slot} extraction is empty`)
    diagnostics[slot].bounds = bounds
    await writeRawPng(path.join(activeOutputRoot, archetypeId, `${slot}.png`), layers[slot])
  }
  return { archetypeId, base, layers, fullGuide: cells[5], diagnostics }
}

async function makeProofSheet(results, sheetIndex) {
  const cellWidth = 170
  const cellHeight = 255
  const columns = 7
  const rows = results.length
  const canvas = sharp({
    create: {
      width: cellWidth * columns,
      height: cellHeight * rows,
      channels: 4,
      background: { r: 248, g: 246, b: 250, alpha: 1 },
    },
  })
  const composites = []
  for (let row = 0; row < results.length; row += 1) {
    const { base, layers, fullGuide } = results[row]
    const states = [
      base,
      await sharp(base, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } }).composite([{ input: layers.top, raw: { width: WIDTH, height: HEIGHT, channels: 4 } }]).raw().toBuffer(),
      await sharp(base, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } }).composite([{ input: layers.bottom, raw: { width: WIDTH, height: HEIGHT, channels: 4 } }]).raw().toBuffer(),
      await sharp(base, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } }).composite([{ input: layers.shoes, raw: { width: WIDTH, height: HEIGHT, channels: 4 } }]).raw().toBuffer(),
      await sharp(base, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } }).composite([{ input: layers.accessory, raw: { width: WIDTH, height: HEIGHT, channels: 4 } }]).raw().toBuffer(),
      await sharp(base, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } }).composite([
        { input: layers.bottom, raw: { width: WIDTH, height: HEIGHT, channels: 4 } },
        { input: layers.shoes, raw: { width: WIDTH, height: HEIGHT, channels: 4 } },
        { input: layers.top, raw: { width: WIDTH, height: HEIGHT, channels: 4 } },
        { input: layers.accessory, raw: { width: WIDTH, height: HEIGHT, channels: 4 } },
      ]).raw().toBuffer(),
      fullGuide,
    ]
    for (let column = 0; column < states.length; column += 1) {
      const thumbnail = await sharp(states[column], { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
        .resize({ width: cellWidth, height: cellHeight, fit: 'contain', kernel: sharp.kernel.nearest })
        .png()
        .toBuffer()
      composites.push({ input: thumbnail, left: column * cellWidth, top: row * cellHeight })
    }
  }
  await fs.mkdir(activeProofRoot, { recursive: true })
  await canvas.composite(composites).png({ compressionLevel: 9 }).toFile(
    path.join(activeProofRoot, `atlas-proof-${sheetIndex}.png`),
  )
}

async function makeLayerProofSheet(results, sheetIndex) {
  const cellWidth = 210
  const cellHeight = 190
  const columns = SLOT_ORDER.length
  const rows = results.length
  const canvas = sharp({
    create: {
      width: cellWidth * columns,
      height: cellHeight * rows,
      channels: 4,
      background: { r: 242, g: 239, b: 247, alpha: 1 },
    },
  })
  const composites = []
  for (let row = 0; row < results.length; row += 1) {
    const { layers } = results[row]
    for (let column = 0; column < SLOT_ORDER.length; column += 1) {
      const slot = SLOT_ORDER[column]
      const layer = layers[slot]
      const bounds = alphaBounds(layer)
      if (!bounds) throw new Error(`Layer proof cannot crop empty ${slot} layer`)
      const thumbnail = await sharp(layer, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
        .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
        .resize({
          width: cellWidth - 32,
          height: cellHeight - 24,
          fit: 'contain',
          kernel: sharp.kernel.nearest,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer()
      composites.push({
        input: thumbnail,
        left: column * cellWidth + 16,
        top: row * cellHeight + 12,
      })
    }
  }
  await canvas.composite(composites).png({ compressionLevel: 9 }).toFile(
    path.join(activeProofRoot, `layer-proof-${sheetIndex}.png`),
  )
}

function assertStrictDescendant(candidate, parent, label) {
  const resolvedCandidate = path.resolve(candidate)
  const resolvedParent = path.resolve(parent)
  const relative = path.relative(resolvedParent, resolvedCandidate)
  if (
    !relative
    || relative === '..'
    || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative)
  ) {
    throw new Error(`${label} must be a strict child of ${resolvedParent}`)
  }
}

async function projectedRealPath(candidate) {
  let cursor = path.resolve(candidate)
  const missingSegments = []

  while (true) {
    try {
      const realAncestor = await fs.realpath(cursor)
      return path.resolve(realAncestor, ...missingSegments.reverse())
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      const parent = path.dirname(cursor)
      if (parent === cursor) {
        throw new Error(`Cannot resolve an existing ancestor for ${candidate}`)
      }
      missingSegments.push(path.basename(cursor))
      cursor = parent
    }
  }
}

async function assertSafeDescendant(candidate, parent, label) {
  assertStrictDescendant(candidate, parent, label)

  const [realRepoRoot, projectedParent, projectedCandidate] = await Promise.all([
    fs.realpath(REPO_ROOT),
    projectedRealPath(parent),
    projectedRealPath(candidate),
  ])
  assertStrictDescendant(projectedParent, realRepoRoot, `${label} boundary`)
  assertStrictDescendant(projectedCandidate, projectedParent, `${label} real path`)
}

async function removeManagedDirectory(candidate, parent, label) {
  await assertSafeDescendant(candidate, parent, label)
  await fs.rm(candidate, { recursive: true, force: true })
}

async function replaceDirectories(pairs) {
  const states = pairs.map(({ stagedPath, targetPath, allowedRoot }) => ({
    stagedPath,
    targetPath,
    allowedRoot,
    backupPath: `${targetPath}.backup-${process.pid}`,
    hadTarget: false,
    installed: false,
  }))
  for (const state of states) {
    await assertSafeDescendant(state.stagedPath, state.allowedRoot, 'staged extraction directory')
    await assertSafeDescendant(state.targetPath, state.allowedRoot, 'extraction target directory')
    await removeManagedDirectory(state.backupPath, state.allowedRoot, 'stale extraction backup')
  }
  try {
    for (const state of states) {
      try {
        await assertSafeDescendant(state.targetPath, state.allowedRoot, 'extraction target directory')
        await assertSafeDescendant(state.backupPath, state.allowedRoot, 'extraction backup directory')
        await fs.rename(state.targetPath, state.backupPath)
        state.hadTarget = true
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error
      }
    }
    for (const state of states) {
      await assertSafeDescendant(state.stagedPath, state.allowedRoot, 'staged extraction directory')
      await assertSafeDescendant(state.targetPath, state.allowedRoot, 'extraction target directory')
      await fs.rename(state.stagedPath, state.targetPath)
      state.installed = true
    }
  } catch (error) {
    for (const state of [...states].reverse()) {
      if (state.installed) {
        await removeManagedDirectory(state.targetPath, state.allowedRoot, 'failed extraction target')
      }
      if (state.hadTarget) {
        await assertSafeDescendant(state.backupPath, state.allowedRoot, 'extraction rollback backup')
        await assertSafeDescendant(state.targetPath, state.allowedRoot, 'extraction rollback target')
        await fs.rename(state.backupPath, state.targetPath)
      }
    }
    throw error
  }
  for (const state of states) {
    if (!state.hadTarget) continue
    try {
      await removeManagedDirectory(state.backupPath, state.allowedRoot, 'installed extraction backup')
    } catch (error) {
      console.warn(`Extracted assets are valid, but stale backup cleanup failed: ${error.message}`)
    }
  }
}

async function main() {
  const assetsSourceRoot = path.join(REPO_ROOT, 'assets-source')
  const proofParentRoot = path.join(REPO_ROOT, 'agent_tmp')
  await assertSafeDescendant(SOURCE_ROOT, assetsSourceRoot, 'PROFILE_PIXEL_SOURCE_ROOT')
  await assertSafeDescendant(PROOF_ROOT, proofParentRoot, 'PROFILE_PIXEL_PROOF_ROOT')
  await assertSafeDescendant(OUTPUT_ROOT, SOURCE_ROOT, 'generated starter layers')
  const stagedOutputRoot = `${OUTPUT_ROOT}.build-${process.pid}`
  const stagedProofRoot = `${PROOF_ROOT}.build-${process.pid}`
  await removeManagedDirectory(stagedOutputRoot, SOURCE_ROOT, 'stale staged starter layers')
  await removeManagedDirectory(stagedProofRoot, proofParentRoot, 'stale staged proof sheets')
  activeOutputRoot = stagedOutputRoot
  activeProofRoot = stagedProofRoot
  const results = []
  const diagnosticManifest = { version: 1, canvas: { width: WIDTH, height: HEIGHT }, items: {} }
  try {
    for (const archetypeId of ARCHETYPE_IDS) {
      const result = await buildArchetype(archetypeId)
      results.push(result)
      diagnosticManifest.items[archetypeId] = result.diagnostics
      console.log(`Extracted reusable equipment: ${archetypeId}`)
    }
    await fs.writeFile(
      path.join(stagedOutputRoot, 'extraction-manifest.json'),
      `${JSON.stringify(diagnosticManifest, null, 2)}\n`,
    )
    for (let index = 0; index < results.length; index += 4) {
      const sheetResults = results.slice(index, index + 4)
      const sheetIndex = Math.floor(index / 4) + 1
      await makeProofSheet(sheetResults, sheetIndex)
      await makeLayerProofSheet(sheetResults, sheetIndex)
    }
    await replaceDirectories([
      { stagedPath: stagedOutputRoot, targetPath: OUTPUT_ROOT, allowedRoot: SOURCE_ROOT },
      { stagedPath: stagedProofRoot, targetPath: PROOF_ROOT, allowedRoot: proofParentRoot },
    ])
  } catch (error) {
    await removeManagedDirectory(stagedOutputRoot, SOURCE_ROOT, 'failed staged starter layers')
    await removeManagedDirectory(stagedProofRoot, proofParentRoot, 'failed staged proof sheets')
    throw error
  } finally {
    activeOutputRoot = OUTPUT_ROOT
    activeProofRoot = PROOF_ROOT
  }
  console.log(`Wrote 48 full-canvas PNG layers to ${OUTPUT_ROOT}`)
  console.log(`Wrote proof sheets to ${PROOF_ROOT}`)
}

await main()
