import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(APP_ROOT, '..', '..')
const SOURCE_ROOT = process.env.PROFILE_PIXEL_SOURCE_ROOT
  ? path.resolve(process.env.PROFILE_PIXEL_SOURCE_ROOT)
  : path.join(REPO_ROOT, 'assets-source', 'profile-pixel-v2')
const OUTPUT_ROOT = path.join(APP_ROOT, 'src', 'assets', 'profile-pixel', 'v2')
const EQUIPMENT_SOURCE_REGISTRY_PATH = path.join(SOURCE_ROOT, 'equipment-items.json')
const CDN_MANIFEST_PATH = path.join(APP_ROOT, 'scripts', 'cdn-asset-manifest.json')
let activeOutputRoot = OUTPUT_ROOT
const execFileAsync = promisify(execFile)

const WIDTH = 512
const HEIGHT = 768
const THUMBNAIL_SIZE = 256
// Transparent inset baked into every thumbnail so garments float inside their
// tile instead of touching the tile edge (256 - 2*16 = 224px art window).
const THUMBNAIL_PADDING = 16
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
const SLOT_ORDER = ['top', 'bottom', 'shoes', 'accessory']
const SLOT_DEPTH = { bottom: 0.35, shoes: 0.25, top: 0.55, accessory: 0.85 }
// Isolated garment art for thumbnails. Thumbs must be clean garment-only
// product shots — the worn layers intentionally re-paint body pixels at their
// seams (chin fur, belly, leg strands) so they composite seamlessly, which
// reads as dirty scribble inside a small inventory tile.
//
// Two source layouts exist:
// - Dressed-stage archetypes keep a 2x2 `equipment-sheet-source.png` chroma
//   sheet: [top, bottom] / [shoes, accessory]. The sheets are NOT fitted to
//   the body (that is exactly why layers come from the atlas diff), but as
//   flat product shots they are the approved garment renders.
// - ISOLATED_TARGETS archetypes (cat, elephant, turtle) have no sheet; their
//   canonical `atlas-source.png` is a 3x2 grid with isolated garment cells at
//   [top, bottom] on row 0 (cols 1-2) and [shoes, accessory] on row 1 (cols 0-1).
const ISOLATED_SHEET_CELL = {
  top: [0, 0],
  bottom: [1, 0],
  shoes: [0, 1],
  accessory: [1, 1],
}
const ISOLATED_ATLAS_IDS = new Set(['cat', 'elephant', 'turtle'])
const ISOLATED_ATLAS_CELL = {
  top: [1, 0],
  bottom: [2, 0],
  shoes: [0, 1],
  accessory: [1, 1],
}
const HASH_LENGTH = 12
const PORTABLE_RELATIVE_PATH_LENGTH = 200
const PORTABLE_SEGMENT_LENGTH = 64
const WINDOWS_RESERVED_SEGMENT = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/

const STARTER_STYLES = {
  corgi: {
    geometry: { center: 256, torsoTop: 254, torsoBottom: 454, shoulder: 208, waist: 154, hands: [[126, 428], [386, 428]], hipTop: 414, hipWidth: 178, bottomEnd: 536, feet: [[105, 610, 142, 62], [268, 610, 142, 62]] },
    top: ['#31517d', '#203752', '#f7eee0'], bottom: ['#27364d', '#182334', '#d4a44f'], shoes: ['#f6ead9', '#ad744a', '#ffffff'], accessory: ['bag', '#6e4a2f', '#d9a854'],
  },
  rooster: {
    geometry: { center: 256, torsoTop: 242, torsoBottom: 450, shoulder: 196, waist: 148, hands: [[139, 427], [373, 427]], hipTop: 414, hipWidth: 164, bottomEnd: 526, feet: [[103, 600, 143, 64], [270, 600, 143, 64]] },
    top: ['#f0d4a8', '#bd6f35', '#fff3dd'], bottom: ['#b94e2b', '#71351f', '#f2aa3d'], shoes: ['#984c2f', '#542b27', '#f6d5a2'], accessory: ['necklace', '#d79c25', '#fff1a3'],
  },
  hamster_praise: {
    geometry: { center: 256, torsoTop: 270, torsoBottom: 466, shoulder: 192, waist: 154, hands: [[143, 430], [369, 430]], hipTop: 424, hipWidth: 180, bottomEnd: 544, feet: [[112, 603, 135, 61], [270, 603, 135, 61]] },
    top: ['#d9c1a2', '#9b7658', '#fff0d6'], bottom: ['#303644', '#1d222d', '#e3a14b'], shoes: ['#d0a170', '#80593e', '#f9e6c8'], accessory: ['bag', '#b35a32', '#f0a14a'],
  },
  fox: {
    geometry: { center: 256, torsoTop: 250, torsoBottom: 454, shoulder: 174, waist: 136, hands: [[157, 433], [355, 433]], hipTop: 414, hipWidth: 156, bottomEnd: 621, feet: [[116, 612, 132, 61], [269, 612, 132, 61]] },
    top: ['#6f7544', '#3f472a', '#d9b56a'], bottom: ['#26333a', '#152126', '#727c64'], shoes: ['#1f292d', '#0f171a', '#f1d2a6'], accessory: ['bag', '#55623b', '#d6aa55'],
  },
  dolphin_calm: {
    geometry: { center: 256, torsoTop: 238, torsoBottom: 452, shoulder: 194, waist: 148, hands: [[139, 428], [373, 428]], hipTop: 414, hipWidth: 166, bottomEnd: 536, feet: [[107, 610, 141, 61], [268, 610, 141, 61]] },
    top: ['#dfe8f1', '#3975a8', '#ffffff'], bottom: ['#2e6290', '#17466e', '#83b9d7'], shoes: ['#eff5f7', '#4e7793', '#ffffff'], accessory: ['necklace', '#2c8cae', '#a8eff5'],
  },
  spider: {
    geometry: { center: 256, torsoTop: 252, torsoBottom: 438, shoulder: 158, waist: 116, hands: [[169, 406], [343, 406]], hipTop: 400, hipWidth: 136, bottomEnd: 512, feet: [[130, 556, 120, 58], [263, 556, 120, 58]] },
    top: ['#322f45', '#191825', '#7f67a5'], bottom: ['#242331', '#111019', '#7e5d96'], shoes: ['#4b2f70', '#20162f', '#a78bcd'], accessory: ['belt', '#8e70bd', '#d8c7f0'],
  },
  koala: {
    geometry: { center: 256, torsoTop: 252, torsoBottom: 454, shoulder: 202, waist: 154, hands: [[134, 428], [378, 428]], hipTop: 414, hipWidth: 174, bottomEnd: 614, feet: [[105, 606, 144, 62], [268, 606, 144, 62]] },
    top: ['#9db7cf', '#557796', '#eef3f5'], bottom: ['#344963', '#1c2d43', '#b18a63'], shoes: ['#f0e6da', '#8e7663', '#ffffff'], accessory: ['bag', '#b28a61', '#f1d1a2'],
  },
  octopus: {
    geometry: { center: 256, torsoTop: 282, torsoBottom: 468, shoulder: 192, waist: 148, hands: [[135, 432], [377, 432]], hipTop: 424, hipWidth: 168, bottomEnd: 538, feet: [[103, 607, 144, 61], [270, 607, 144, 61]] },
    top: ['#e7d6bc', '#9c674c', '#fff4df'], bottom: ['#b49472', '#735b47', '#ebcba1'], shoes: ['#36434b', '#1e292f', '#d8b18a'], accessory: ['bag', '#ce7b2f', '#ffd078'],
  },
  owl: {
    geometry: { center: 256, torsoTop: 250, torsoBottom: 466, shoulder: 220, waist: 172, hands: [[126, 436], [386, 436]], hipTop: 426, hipWidth: 188, bottomEnd: 538, feet: [[101, 598, 147, 65], [267, 598, 147, 65]] },
    top: ['#c9ad8d', '#73563d', '#f6e5ca'], bottom: ['#8e775a', '#594a39', '#d5b98c'], shoes: ['#f2e4cf', '#8a6b50', '#ffffff'], accessory: ['bag', '#7c5437', '#d2a86d'],
  },
  elephant: {
    geometry: { center: 256, torsoTop: 250, torsoBottom: 454, shoulder: 222, waist: 168, hands: [[125, 426], [387, 426]], hipTop: 414, hipWidth: 184, bottomEnd: 616, feet: [[96, 607, 154, 65], [266, 607, 154, 65]] },
    top: ['#29445d', '#162b3d', '#d6b385'], bottom: ['#9c815f', '#67533d', '#e2c59a'], shoes: ['#263d52', '#122333', '#f3d9ac'], accessory: ['bag', '#704b2f', '#d6a15f'],
  },
  turtle: {
    geometry: { center: 256, torsoTop: 246, torsoBottom: 452, shoulder: 202, waist: 160, hands: [[135, 428], [377, 428]], hipTop: 414, hipWidth: 176, bottomEnd: 536, feet: [[104, 606, 146, 64], [268, 606, 146, 64]] },
    top: ['#314d2b', '#1d331d', '#6d8e45'], bottom: ['#d7c7a1', '#8b7755', '#f2e6c8'], shoes: ['#f0eee3', '#82917b', '#ffffff'], accessory: ['beanie', '#52673b', '#9aaa66'],
  },
  cat: {
    geometry: { center: 256, torsoTop: 244, torsoBottom: 454, shoulder: 184, waist: 142, hands: [[148, 428], [364, 428]], hipTop: 414, hipWidth: 160, bottomEnd: 614, feet: [[112, 606, 137, 62], [269, 606, 137, 62]] },
    top: ['#d8c2a6', '#8d6e54', '#f7e8d2'], bottom: ['#365675', '#1e3853', '#7fa0b7'], shoes: ['#252c33', '#11161b', '#e7d4bd'], accessory: ['bag', '#74508f', '#c99bdc'],
  },
}

async function loadSharp() {
  try {
    return (await import('sharp')).default
  } catch (error) {
    const dependencyRoot = process.env.JOYJOIN_DEPENDENCY_ROOT
    if (!dependencyRoot) throw error
    const requireFromWorkspace = createRequire(path.join(dependencyRoot, 'package.json'))
    return requireFromWorkspace('sharp')
  }
}

const sharp = await loadSharp()

function svgDocument(content) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <g shape-rendering="geometricPrecision" stroke-linejoin="round" stroke-linecap="round">${content}</g>
  </svg>`)
}

function buildTopSvg(style) {
  const { center, torsoTop, torsoBottom, shoulder, waist, hands } = style.geometry
  const [primary, shadow, accent] = style.top
  const leftShoulder = center - shoulder / 2
  const rightShoulder = center + shoulder / 2
  const leftWaist = center - waist / 2
  const rightWaist = center + waist / 2
  const sleeveTopY = torsoTop + 24
  const sleeveEndY = Math.min(torsoBottom - 12, hands[0][1] - 6)
  return svgDocument(`
    <path d="M ${leftShoulder} ${torsoTop + 22} L ${center - 45} ${torsoTop} L ${center + 45} ${torsoTop} L ${rightShoulder} ${torsoTop + 22} L ${rightWaist} ${torsoBottom} L ${leftWaist} ${torsoBottom} Z" fill="${primary}" stroke="#24212b" stroke-width="7"/>
    <path d="M ${leftShoulder + 4} ${sleeveTopY} L ${hands[0][0] + 25} ${sleeveEndY} L ${hands[0][0] - 8} ${sleeveEndY + 14} L ${leftShoulder - 10} ${torsoTop + 58} Z" fill="${primary}" stroke="#24212b" stroke-width="7"/>
    <path d="M ${rightShoulder - 4} ${sleeveTopY} L ${hands[1][0] - 25} ${sleeveEndY} L ${hands[1][0] + 8} ${sleeveEndY + 14} L ${rightShoulder + 10} ${torsoTop + 58} Z" fill="${shadow}" stroke="#24212b" stroke-width="7"/>
    <path d="M ${center} ${torsoTop + 12} L ${center} ${torsoBottom - 9}" stroke="${accent}" stroke-width="8"/>
    <path d="M ${leftWaist + 8} ${torsoBottom - 16} L ${rightWaist - 8} ${torsoBottom - 16}" stroke="${shadow}" stroke-width="8"/>
    <path d="M ${leftWaist + 18} ${torsoBottom - 72} L ${center - 18} ${torsoBottom - 58} L ${center - 25} ${torsoBottom - 30}" fill="none" stroke="${accent}" stroke-width="6"/>
    <rect x="${rightWaist - 36}" y="${torsoTop + 58}" width="18" height="18" rx="3" fill="${accent}" opacity=".9"/>
  `)
}

function buildBottomSvg(style) {
  const { center, hipTop, hipWidth, bottomEnd } = style.geometry
  const [primary, shadow, accent] = style.bottom
  const left = center - hipWidth / 2
  const right = center + hipWidth / 2
  const crotch = center
  const legGap = 12
  return svgDocument(`
    <path d="M ${left} ${hipTop} L ${right} ${hipTop} L ${right - 5} ${bottomEnd} L ${crotch + legGap} ${bottomEnd} L ${crotch} ${hipTop + 68} L ${crotch - legGap} ${bottomEnd} L ${left + 5} ${bottomEnd} Z" fill="${primary}" stroke="#24212b" stroke-width="7"/>
    <path d="M ${center} ${hipTop + 8} L ${center} ${bottomEnd - 5}" stroke="${shadow}" stroke-width="7"/>
    <path d="M ${left + 5} ${hipTop + 14} L ${right - 5} ${hipTop + 14}" stroke="${accent}" stroke-width="8"/>
    <path d="M ${left + 18} ${hipTop + 43} L ${left + 51} ${hipTop + 57}" stroke="${shadow}" stroke-width="6"/>
    <path d="M ${right - 18} ${hipTop + 43} L ${right - 51} ${hipTop + 57}" stroke="${shadow}" stroke-width="6"/>
  `)
}

function buildShoesSvg(style) {
  const [primary, shadow, accent] = style.shoes
  return svgDocument(style.geometry.feet.map(([x, y, width, height], index) => `
    <path d="M ${x + 10} ${y + 8} L ${x + width - 28} ${y} L ${x + width - 5} ${y + height - 22} L ${x + width - 10} ${y + height} L ${x + 6} ${y + height} L ${x} ${y + height - 22} Z" fill="${index ? shadow : primary}" stroke="#24212b" stroke-width="7"/>
    <path d="M ${x + 10} ${y + height - 15} L ${x + width - 12} ${y + height - 15}" stroke="${accent}" stroke-width="10"/>
    <path d="M ${x + 34} ${y + 18} L ${x + width - 37} ${y + 30}" stroke="${accent}" stroke-width="6" stroke-dasharray="9 8"/>
  `).join(''))
}

function buildAccessorySvg(style) {
  const { center, torsoTop, torsoBottom, shoulder, waist } = style.geometry
  const [type, primary, accent] = style.accessory
  if (type === 'necklace') {
    return svgDocument(`
      <path d="M ${center - 44} ${torsoTop + 16} L ${center} ${torsoTop + 88} L ${center + 44} ${torsoTop + 16}" fill="none" stroke="${primary}" stroke-width="8"/>
      <circle cx="${center}" cy="${torsoTop + 91}" r="18" fill="${accent}" stroke="#24212b" stroke-width="6"/>
    `)
  }
  if (type === 'belt') {
    return svgDocument(`
      <path d="M ${center - waist / 2 - 12} ${torsoBottom - 20} L ${center + waist / 2 + 12} ${torsoBottom - 20}" stroke="${primary}" stroke-width="18"/>
      <rect x="${center - 18}" y="${torsoBottom - 36}" width="36" height="30" rx="4" fill="${accent}" stroke="#24212b" stroke-width="6"/>
      <path d="M ${center + 36} ${torsoBottom - 12} Q ${center + 76} ${torsoBottom + 16} ${center + 57} ${torsoBottom + 58}" fill="none" stroke="${accent}" stroke-width="7"/>
    `)
  }
  if (type === 'beanie') {
    return svgDocument(`
      <path d="M ${center - 82} 154 Q ${center - 72} 82 ${center} 72 Q ${center + 72} 82 ${center + 82} 154 Z" fill="${primary}" stroke="#24212b" stroke-width="7"/>
      <rect x="${center - 88}" y="139" width="176" height="34" rx="12" fill="${accent}" stroke="#24212b" stroke-width="7"/>
      <circle cx="${center}" cy="66" r="17" fill="${accent}" stroke="#24212b" stroke-width="6"/>
    `)
  }
  const bagX = center + waist / 2 - 18
  const bagY = torsoBottom - 68
  return svgDocument(`
    <path d="M ${center - shoulder / 2 + 24} ${torsoTop + 16} L ${bagX + 42} ${bagY + 20}" fill="none" stroke="${primary}" stroke-width="14"/>
    <rect x="${bagX}" y="${bagY}" width="88" height="78" rx="15" fill="${primary}" stroke="#24212b" stroke-width="7"/>
    <path d="M ${bagX + 10} ${bagY + 27} L ${bagX + 78} ${bagY + 27}" stroke="${accent}" stroke-width="8"/>
    <rect x="${bagX + 36}" y="${bagY + 20}" width="18" height="18" rx="4" fill="${accent}"/>
  `)
}

async function buildProceduralLayer(archetypeId, slot) {
  const style = STARTER_STYLES[archetypeId]
  if (!style) throw new Error(`Missing starter style for ${archetypeId}`)
  const svg = slot === 'top'
    ? buildTopSvg(style)
    : slot === 'bottom'
      ? buildBottomSvg(style)
      : slot === 'shoes'
        ? buildShoesSvg(style)
        : buildAccessorySvg(style)
  return sharp(svg).ensureAlpha().raw().toBuffer()
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function sampleCornerKey(data, width, height) {
  const points = [
    [4, 4],
    [width - 5, 4],
    [4, height - 5],
    [width - 5, height - 5],
  ]
  const total = points.reduce((sum, [x, y]) => {
    const offset = (y * width + x) * 4
    return [sum[0] + data[offset], sum[1] + data[offset + 1], sum[2] + data[offset + 2]]
  }, [0, 0, 0])
  const key = total.map((value) => Math.round(value / points.length))
  const greenDominance = key[1] - Math.max(key[0], key[2])
  const magentaDominance = ((key[0] + key[2]) / 2) - key[1]
  if (greenDominance > 70) return { mode: 'green', rgb: key }
  if (magentaDominance > 70) return { mode: 'magenta', rgb: key }
  throw new Error(`Unsupported chroma key sampled at ${key.join(',')}`)
}

function removeChroma(data, width, height) {
  const output = Buffer.from(data)
  const key = sampleCornerKey(output, width, height)

  for (let offset = 0; offset < output.length; offset += 4) {
    const r = output[offset]
    const g = output[offset + 1]
    const b = output[offset + 2]
    const sourceAlpha = output[offset + 3]
    const dominance = key.mode === 'green'
      ? g - Math.max(r, b)
      : ((r + b) / 2) - g
    const keyChannel = key.mode === 'green' ? g : (r + b) / 2
    const dominanceFactor = clamp((dominance - 42) / 128, 0, 1)
    const luminanceFactor = clamp((keyChannel - 72) / 142, 0, 1)
    const transparency = dominanceFactor * luminanceFactor
    const alpha = Math.round(sourceAlpha * (1 - transparency))

    output[offset + 3] = alpha < 10 ? 0 : alpha
    if (alpha > 0 && alpha < 250) {
      if (key.mode === 'green') output[offset + 1] = Math.min(g, Math.max(r, b) + 22)
      else {
        const neutral = Math.max(g, Math.min(r, b)) + 18
        output[offset] = Math.min(r, neutral)
        output[offset + 2] = Math.min(b, neutral)
      }
    }
  }
  return output
}

function hasUsefulTransparency(data) {
  for (let offset = 3; offset < data.length; offset += 4) {
    if (data[offset] < 245) return true
  }
  return false
}

function alphaBounds(data, width, height, alphaThreshold = 18) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  let count = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha <= alphaThreshold) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      count += 1
    }
  }
  if (maxX < minX || maxY < minY) return null
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    count,
  }
}

async function readBody(sourcePath) {
  const metadata = await sharp(sourcePath).metadata()
  if (!metadata.width || !metadata.height) throw new Error(`Unreadable atlas: ${sourcePath}`)
  const cellWidth = Math.floor(metadata.width / 3)
  const cellHeight = Math.floor(metadata.height / 2)
  if (cellWidth < 300 || cellHeight < 300) {
    throw new Error(`Atlas cells are too small: ${metadata.width}x${metadata.height}`)
  }

  const extracted = await sharp(sourcePath)
    .extract({ left: 1, top: 1, width: cellWidth - 2, height: cellHeight - 2 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const keyed = hasUsefulTransparency(extracted.data)
    ? extracted.data
    : removeChroma(extracted.data, extracted.info.width, extracted.info.height)
  return sharp(keyed, {
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
}

async function encodeBody(raw) {
  return sharp(raw, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
    .webp({ quality: 84, alphaQuality: 100, nearLossless: true, smartSubsample: true })
    .toBuffer()
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, HASH_LENGTH)
}

async function writeHashedFile(relativeDirectory, stem, buffer) {
  const fileName = `${stem}.${hashBuffer(buffer)}.webp`
  const relativePath = path.join(relativeDirectory, fileName)
  const absolutePath = path.join(activeOutputRoot, relativePath)
  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, buffer)
  return `assets/profile-pixel/v2/${relativePath.replaceAll('\\', '/')}`
}

async function encodeSquareThumbnail(raw, width, height, kernel = sharp.kernel.nearest) {
  const { data, info } = await sharp(raw, { raw: { width, height, channels: 4 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const bounds = alphaBounds(data, info.width, info.height)
  if (!bounds || bounds.count < 120) {
    throw new Error(`Thumbnail source is visually empty (${bounds?.count ?? 0} opaque pixels)`)
  }
  const artWindow = THUMBNAIL_SIZE - THUMBNAIL_PADDING * 2
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
    .resize({
      width: artWindow,
      height: artWindow,
      fit: 'contain',
      position: 'centre',
      kernel,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: THUMBNAIL_PADDING,
      bottom: THUMBNAIL_PADDING,
      left: THUMBNAIL_PADDING,
      right: THUMBNAIL_PADDING,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 88, alphaQuality: 100, nearLossless: true, smartSubsample: true })
    .toBuffer()
}

/**
 * Isolated garment-only art for thumbnails (see the ISOLATED_* notes above).
 * Returns null when the archetype has no isolated source so callers can fall
 * back to the worn-layer crop.
 */
async function readIsolatedGarmentRaw(archetypeId, slot) {
  const usesAtlas = ISOLATED_ATLAS_IDS.has(archetypeId)
  const sourcePath = path.join(
    SOURCE_ROOT,
    archetypeId,
    usesAtlas ? 'atlas-source.png' : 'equipment-sheet-source.png',
  )
  const [col, row] = (usesAtlas ? ISOLATED_ATLAS_CELL : ISOLATED_SHEET_CELL)[slot]
  let metadata
  try {
    metadata = await sharp(sourcePath).metadata()
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
  if (!metadata.width || !metadata.height) {
    throw new Error(`Unreadable isolated garment source: ${sourcePath}`)
  }
  const cols = usesAtlas ? 3 : 2
  const cellWidth = Math.floor(metadata.width / cols)
  const cellHeight = Math.floor(metadata.height / 2)
  // Inset the cell so a neighbouring cell's garment can never bleed in.
  const inset = 6
  const extracted = await sharp(sourcePath)
    .extract({
      left: col * cellWidth + inset,
      top: row * cellHeight + inset,
      width: cellWidth - inset * 2,
      height: cellHeight - inset * 2,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const keyed = hasUsefulTransparency(extracted.data)
    ? extracted.data
    : removeChroma(extracted.data, extracted.info.width, extracted.info.height)
  return { data: keyed, width: extracted.info.width, height: extracted.info.height }
}

async function writeCroppedLayer(relativeDirectory, raw) {
  const bounds = alphaBounds(raw, WIDTH, HEIGHT)
  if (!bounds || bounds.count < 120) throw new Error(`${relativeDirectory} is visually empty`)
  const layerBuffer = await sharp(raw, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } })
    .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
    .webp({ quality: 88, alphaQuality: 100, nearLossless: true, smartSubsample: true })
    .toBuffer()
  return {
    layer: await writeHashedFile(relativeDirectory, 'layer-v2', layerBuffer),
    placement: {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    },
  }
}

/**
 * Starter thumbnails come from the isolated garment sheet/atlas cell (clean
 * product shots). Large chroma-sheet cells (~600px) downscale to the 224px
 * art window with lanczos3 — nearest-neighbour decimation at a non-integer
 * ratio shreds the pixel-art outlines. Falls back to the worn-layer crop
 * (also lanczos3) if an archetype ever ships without isolated art.
 */
async function writeStarterThumb(relativeDirectory, archetypeId, slot, layerRaw) {
  const isolated = await readIsolatedGarmentRaw(archetypeId, slot)
  const thumbBuffer = isolated
    ? await encodeSquareThumbnail(isolated.data, isolated.width, isolated.height, sharp.kernel.lanczos3)
    : await encodeSquareThumbnail(layerRaw, WIDTH, HEIGHT, sharp.kernel.lanczos3)
  return writeHashedFile(relativeDirectory, 'thumb-v2', thumbBuffer)
}

async function readStarterLayerRaw(archetypeId, slot) {
  const extractedSourcePath = path.join(
    SOURCE_ROOT,
    'generated-starter-layers',
    archetypeId,
    `${slot}.png`,
  )
  try {
    const metadata = await sharp(extractedSourcePath).metadata()
    if (metadata.width !== WIDTH || metadata.height !== HEIGHT || metadata.hasAlpha !== true) {
      throw new Error(
        `Extracted starter layer ${extractedSourcePath} must be a ${WIDTH}x${HEIGHT} transparent image`,
      )
    }
    return sharp(extractedSourcePath).ensureAlpha().raw().toBuffer()
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    if (process.env.PROFILE_PIXEL_ALLOW_PROCEDURAL_FALLBACK === '1') {
      return buildProceduralLayer(archetypeId, slot)
    }
    throw new Error(
      `Missing extracted starter layer ${extractedSourcePath}; run npm run extract:profile-pixel-layers -w mini-program`,
    )
  }
}

async function readFullStarterRaw(archetypeId) {
  const extractedSourcePath = path.join(
    SOURCE_ROOT,
    'generated-starter-layers',
    archetypeId,
    'full-starter.png',
  )
  try {
    const metadata = await sharp(extractedSourcePath).metadata()
    if (metadata.width !== WIDTH || metadata.height !== HEIGHT || metadata.hasAlpha !== true) {
      throw new Error(
        `Extracted full-starter look ${extractedSourcePath} must be a ${WIDTH}x${HEIGHT} transparent image`,
      )
    }
    return sharp(extractedSourcePath).ensureAlpha().raw().toBuffer()
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    throw new Error(
      `Missing extracted full-starter look ${extractedSourcePath}; run npm run extract:profile-pixel-layers -w mini-program`,
    )
  }
}

async function buildArchetype(archetypeId) {
  const sourcePath = path.join(SOURCE_ROOT, archetypeId, 'atlas-source.png')
  const body = await readBody(sourcePath)
  const encodedBody = await encodeBody(body)
  const manifest = {
    body: await writeHashedFile(
      `archetypes/${archetypeId}`,
      'body-front-v2',
      encodedBody,
    ),
    starter: {},
  }
  for (const slot of SLOT_ORDER) {
    const relativeDirectory = `equipment/starter/${archetypeId}/${slot}`
    const layerRaw = await readStarterLayerRaw(archetypeId, slot)
    const asset = await writeCroppedLayer(relativeDirectory, layerRaw)
    asset.thumb = await writeStarterThumb(relativeDirectory, archetypeId, slot, layerRaw)
    manifest.starter[slot] = { ...asset, depth: SLOT_DEPTH[slot] }
  }
  // Approved fully dressed look (single illustration of the complete starter
  // set). The runtime swaps to it when all four starter items are equipped, so
  // the default look is pixel-perfect even where per-slot layers interact.
  manifest.fullStarter = await writeHashedFile(
    `archetypes/${archetypeId}`,
    'full-starter-v2',
    await encodeBody(await readFullStarterRaw(archetypeId)),
  )
  return manifest
}

function validatePlacement(placement, label) {
  if (!placement || typeof placement !== 'object' || Array.isArray(placement)) {
    throw new Error(`${label} must be an object`)
  }
  const { left, top, width, height } = placement
  for (const [field, value] of Object.entries({ left, top, width, height })) {
    if (!Number.isInteger(value)) throw new Error(`${label}.${field} must be an integer`)
  }
  if (left < 0 || top < 0 || width <= 0 || height <= 0) {
    throw new Error(`${label} must have a non-negative origin and positive size`)
  }
  if (left + width > WIDTH || top + height > HEIGHT) {
    throw new Error(`${label} must stay inside the ${WIDTH}x${HEIGHT} avatar canvas`)
  }
  return { left, top, width, height }
}

function validateEquipmentAssetKey(assetKey) {
  if (typeof assetKey !== 'string' || assetKey.length === 0 || assetKey.length > 120) {
    throw new Error('Future equipment assetKey must be a non-empty string of at most 120 characters')
  }
  const segments = assetKey.split('/')
  if (
    segments.length < 3
    || segments[0] !== 'equipment'
    || segments.some((segment) => (
      !/^[a-z0-9_-]+$/.test(segment)
      || WINDOWS_RESERVED_SEGMENT.test(segment)
    ))
  ) {
    throw new Error(`Future equipment assetKey must use portable lowercase path segments: ${assetKey}`)
  }
  if (segments[1] === 'starter') {
    throw new Error(`${assetKey} uses the reserved equipment/starter namespace`)
  }
  const candidatePath = [
    'assets/profile-pixel/v2/equipment/catalog',
    ...segments.slice(1),
    `layer-v2.${'0'.repeat(HASH_LENGTH)}.webp`,
  ].join('/')
  if (
    candidatePath.length > PORTABLE_RELATIVE_PATH_LENGTH
    || segments.some((segment) => segment.length > PORTABLE_SEGMENT_LENGTH)
  ) {
    throw new Error(`${assetKey} generates a non-portable repository path`)
  }
  return segments
}

async function validateEquipmentSourcePath(source, assetKey) {
  if (
    typeof source !== 'string'
    || source.length > 160
    || !/^equipment\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:png|webp)$/.test(source)
  ) {
    throw new Error(`${assetKey} source must be a lowercase equipment/**/*.png or .webp path`)
  }
  const sourceSegments = source.split('/').slice(1)
  const portableSegments = sourceSegments.map((segment, index) => (
    index === sourceSegments.length - 1 ? path.posix.parse(segment).name : segment
  ))
  if (
    sourceSegments.some((segment) => segment.length > PORTABLE_SEGMENT_LENGTH)
    || portableSegments.some((segment) => WINDOWS_RESERVED_SEGMENT.test(segment))
  ) {
    throw new Error(`${assetKey} source contains a non-portable path segment`)
  }
  const sourceRoot = path.resolve(SOURCE_ROOT, 'equipment')
  const sourcePath = path.resolve(SOURCE_ROOT, ...source.split('/'))
  const lexicalRelative = path.relative(sourceRoot, sourcePath)
  if (!lexicalRelative || lexicalRelative.startsWith('..') || path.isAbsolute(lexicalRelative)) {
    throw new Error(`${assetKey} source escapes the equipment source directory`)
  }
  const [realSourceRoot, realSourcePath, stat] = await Promise.all([
    fs.realpath(sourceRoot),
    fs.realpath(sourcePath),
    fs.stat(sourcePath),
  ])
  const realRelative = path.relative(realSourceRoot, realSourcePath)
  if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative) || !stat.isFile()) {
    throw new Error(`${assetKey} source must resolve to a file inside the equipment source directory`)
  }
  return sourcePath
}

async function readEquipmentSourceRegistry() {
  const registry = JSON.parse(await fs.readFile(EQUIPMENT_SOURCE_REGISTRY_PATH, 'utf8'))
  if (registry?.version !== 1 || !Array.isArray(registry.items)) {
    throw new Error('equipment-items.json must contain { version: 1, items: [] }')
  }
  return registry.items
}

async function encodeFutureEquipmentSource(sourcePath, assetKey) {
  const metadata = await sharp(sourcePath).metadata()
  if (!metadata.width || !metadata.height || metadata.hasAlpha !== true) {
    throw new Error(`${assetKey} source must be a readable image with an alpha channel: ${sourcePath}`)
  }
  const image = sharp(sourcePath).ensureAlpha().trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  const { data, info } = await image
    .resize({
      width: WIDTH,
      height: HEIGHT,
      fit: 'inside',
      withoutEnlargement: true,
      kernel: sharp.kernel.nearest,
    })
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (!hasUsefulTransparency(data)) {
    throw new Error(`${assetKey} source must contain transparent background pixels`)
  }
  const bounds = alphaBounds(data, info.width, info.height)
  if (!bounds || bounds.count < 120) throw new Error(`${assetKey} source is visually empty`)
  const layerBuffer = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 88, alphaQuality: 100, nearLossless: true, smartSubsample: true })
    .toBuffer()
  const thumbBuffer = await encodeSquareThumbnail(data, info.width, info.height)
  return { layer: layerBuffer, thumb: thumbBuffer }
}

async function buildFutureEquipmentItem(rawItem, existingKeys) {
  if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
    throw new Error('Every equipment-items.json item must be an object')
  }
  const segments = validateEquipmentAssetKey(rawItem.assetKey)
  if (existingKeys.has(rawItem.assetKey)) throw new Error(`Duplicate equipment assetKey: ${rawItem.assetKey}`)
  if (!SLOT_ORDER.includes(rawItem.slot)) throw new Error(`${rawItem.assetKey} has invalid slot: ${rawItem.slot}`)
  if (!Number.isFinite(rawItem.depth) || rawItem.depth < 0 || rawItem.depth > 1) {
    throw new Error(`${rawItem.assetKey} depth must be between 0 and 1`)
  }
  if (!rawItem.placements || typeof rawItem.placements !== 'object' || Array.isArray(rawItem.placements)) {
    throw new Error(`${rawItem.assetKey} placements must be an archetype-keyed object`)
  }
  const placementEntries = Object.entries(rawItem.placements)
  if (placementEntries.length === 0) throw new Error(`${rawItem.assetKey} must support at least one archetype`)
  const placements = {}
  for (const [archetypeId, placement] of placementEntries) {
    if (!ARCHETYPE_IDS.includes(archetypeId)) {
      throw new Error(`${rawItem.assetKey} has unknown placement archetype: ${archetypeId}`)
    }
    placements[archetypeId] = validatePlacement(placement, `${rawItem.assetKey}.placements.${archetypeId}`)
  }

  const sourcePath = await validateEquipmentSourcePath(rawItem.source, rawItem.assetKey)
  const encoded = await encodeFutureEquipmentSource(sourcePath, rawItem.assetKey)
  const relativeDirectory = path.join('equipment', 'catalog', ...segments.slice(1))
  return {
    slot: rawItem.slot,
    layer: await writeHashedFile(relativeDirectory, 'layer-v2', encoded.layer),
    thumb: await writeHashedFile(relativeDirectory, 'thumb-v2', encoded.thumb),
    depth: rawItem.depth,
    placements,
  }
}

function collectGeneratedAssetPaths(manifest) {
  return [...new Set([
    ...Object.values(manifest.archetypes).flatMap((archetype) => [archetype.body, archetype.fullStarter]),
    ...Object.values(manifest.items).flatMap((item) => [item.layer, item.thumb]),
  ])].sort()
}

async function buildCdnManifest(generatedPaths) {
  const cdnManifest = JSON.parse(await fs.readFile(CDN_MANIFEST_PATH, 'utf8'))
  if (!Array.isArray(cdnManifest.assets)) throw new Error('CDN manifest must contain an assets array')
  // Only the generated subtrees are refreshed; independently governed v2
  // assets (stage art, future hand-managed files) keep their manifest entries.
  const generatedPrefixes = [
    'assets/profile-pixel/v2/archetypes/',
    'assets/profile-pixel/v2/equipment/',
  ]
  const retained = cdnManifest.assets.filter((asset) => (
    typeof asset?.localPath !== 'string'
    || !generatedPrefixes.some((prefix) => asset.localPath.startsWith(prefix))
  ))
  const generatedEntries = generatedPaths.map((assetPath) => ({
    localPath: assetPath,
    cdnPath: assetPath,
  }))
  cdnManifest.assets = [...retained, ...generatedEntries]
  return `${JSON.stringify(cdnManifest, null, 2)}\n`
}

async function replaceArtifacts(artifacts) {
  const states = artifacts.map(({ stagedPath, targetPath }) => ({
    stagedPath,
    targetPath,
    backupPath: `${targetPath}.backup-${process.pid}`,
    hadTarget: false,
    installed: false,
  }))
  for (const state of states) {
    await fs.rm(state.backupPath, { recursive: true, force: true })
  }
  try {
    for (const state of states) {
      try {
        await fs.rename(state.targetPath, state.backupPath)
        state.hadTarget = true
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error
      }
    }
    for (const state of states) {
      await fs.rename(state.stagedPath, state.targetPath)
      state.installed = true
    }
  } catch (error) {
    for (const state of [...states].reverse()) {
      if (state.installed) await fs.rm(state.targetPath, { recursive: true, force: true })
      if (state.hadTarget) await fs.rename(state.backupPath, state.targetPath)
    }
    throw error
  }
  for (const state of states) {
    if (!state.hadTarget) continue
    try {
      await fs.rm(state.backupPath, { recursive: true, force: true })
    } catch (error) {
      console.warn(`Built assets are valid, but stale backup cleanup failed: ${error.message}`)
    }
  }
}

async function validateStagedBuild(stagedRoot, stagedCdnManifestPath) {
  const checkerPath = path.join(__dirname, 'check-profile-pixel-assets.mjs')
  const { stdout } = await execFileAsync(process.execPath, [checkerPath], {
    env: {
      ...process.env,
      PROFILE_PIXEL_BUILD_V2_ROOT: stagedRoot,
      PROFILE_PIXEL_CDN_MANIFEST_PATH: stagedCdnManifestPath,
      PROFILE_PIXEL_SOURCE_ROOT: SOURCE_ROOT,
      // Stage art is independently governed and lives in the real output
      // root, not the staged generated tree.
      PROFILE_PIXEL_STAGE_MANIFEST_PATH: path.join(OUTPUT_ROOT, 'stage-assets-v1.json'),
      PROFILE_PIXEL_STAGE_V2_ROOT: OUTPUT_ROOT,
    },
    maxBuffer: 1024 * 1024,
  })
  if (stdout.trim()) console.log(stdout.trim())
}

async function main() {
  const sourceItems = await readEquipmentSourceRegistry()
  const stagedRoot = `${OUTPUT_ROOT}.build-${process.pid}`
  const stagedCdnManifestPath = `${CDN_MANIFEST_PATH}.build-${process.pid}`
  await fs.rm(stagedRoot, { recursive: true, force: true })
  await fs.rm(stagedCdnManifestPath, { force: true })
  activeOutputRoot = stagedRoot
  const manifest = {
    version: 2,
    renderer: 'layered-paper-doll',
    permanentBaseUnderwear: true,
    width: WIDTH,
    height: HEIGHT,
    bodyAssetCount: ARCHETYPE_IDS.length,
    itemAssetCount: 0,
    sourceAssetCount: 0,
    equipmentLayersDoubleAsThumbnails: false,
    archetypes: {},
    items: {},
  }
  try {
    for (const archetypeId of ARCHETYPE_IDS) {
      const archetype = await buildArchetype(archetypeId)
      manifest.archetypes[archetypeId] = archetype
      for (const slot of SLOT_ORDER) {
        const starter = archetype.starter[slot]
        manifest.items[`equipment/starter/${archetypeId}/${slot}/v1`] = {
          slot,
          layer: starter.layer,
          thumb: starter.thumb,
          depth: starter.depth,
          placements: { [archetypeId]: starter.placement },
        }
      }
      console.log(`Built reusable paper-doll assets: ${archetypeId}`)
    }
    for (const sourceItem of sourceItems) {
      manifest.items[sourceItem.assetKey] = await buildFutureEquipmentItem(
        sourceItem,
        new Set(Object.keys(manifest.items)),
      )
      console.log(`Built future reusable equipment layer: ${sourceItem.assetKey}`)
    }
    const generatedPaths = collectGeneratedAssetPaths(manifest)
    manifest.itemAssetCount = new Set(Object.values(manifest.items).map((item) => item.layer)).size
    manifest.sourceAssetCount = generatedPaths.length
    await fs.mkdir(stagedRoot, { recursive: true })
    await fs.writeFile(
      path.join(stagedRoot, 'avatar-assets-v2.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    )
    await fs.writeFile(stagedCdnManifestPath, await buildCdnManifest(generatedPaths))
    await validateStagedBuild(stagedRoot, stagedCdnManifestPath)
    // Replace only the generated subtrees. The v2 directory also contains
    // independently governed assets (e.g. stage-assets-v1.json + stage/*.webp
    // for IdentityStageScene) which a whole-directory swap would silently wipe
    // (regression hit on 2026-07-21).
    await replaceArtifacts([
      { stagedPath: path.join(stagedRoot, 'archetypes'), targetPath: path.join(OUTPUT_ROOT, 'archetypes') },
      { stagedPath: path.join(stagedRoot, 'equipment'), targetPath: path.join(OUTPUT_ROOT, 'equipment') },
      { stagedPath: path.join(stagedRoot, 'avatar-assets-v2.json'), targetPath: path.join(OUTPUT_ROOT, 'avatar-assets-v2.json') },
      { stagedPath: stagedCdnManifestPath, targetPath: CDN_MANIFEST_PATH },
    ])
    activeOutputRoot = OUTPUT_ROOT
    console.log(`Profile pixel V2 assets built: ${manifest.bodyAssetCount} bodies + ${manifest.itemAssetCount} reusable equipment layers.`)
    console.log(`Synced ${generatedPaths.length} immutable profile-pixel V2 paths into the CDN manifest.`)
  } catch (error) {
    await fs.rm(stagedRoot, { recursive: true, force: true })
    await fs.rm(stagedCdnManifestPath, { force: true })
    activeOutputRoot = OUTPUT_ROOT
    throw error
  }
}

main().catch((error) => {
  console.error(`Profile pixel V2 build failed: ${error.message}`)
  process.exit(1)
})
