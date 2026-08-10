#!/usr/bin/env node
/**
 * build-sd-avatar-assets.mjs
 *
 * Builds the SD pixel avatar sprite family (集结房间 / small-avatar slots):
 * finished front-view chibi sprites per archetype, exported at the five
 * frozen integer sizes 128 / 96 / 64 / 48 / 32 px (style guide T6 —
 * docs/design/sd-pixel-avatar-style-guide.md).
 *
 * Inputs (per archetype, under assets-source/sd-pixel-avatars/<id>/):
 *   - Preferred: hand-cleaned pre-scaled exports
 *       sd-avatar-<id>-{128,96,64,48,32}-v1.png (used verbatim, PNG -> WebP only)
 *   - Fallback:  sd-avatar-<id>-master-v1.png (128x128) downscaled/upscaled with
 *     nearest-neighbour (pixel art — never lanczos) and flagged
 *     needsHandCleanup: true in the manifest.
 *   - Placeholder mode (SD_AVATAR_ALLOW_PLACEHOLDER=1): when an archetype has
 *     no source art at all, a simple geometric creature blob is synthesized
 *     in the canonical archetype colour (no text, T2 coloured outline) so the
 *     runtime wiring is testable end-to-end before the Lovart art lands.
 *
 * Outputs (staged build + atomic swap, mirroring build-profile-pixel-v2):
 *   - src/assets/sd-avatar/v1/archetypes/<id>/sprite-<size>-v1.<hash>.webp
 *   - src/assets/sd-avatar/v1/sd-avatar-assets-v1.json
 *   - generated entries synced into scripts/cdn-asset-manifest.json
 *
 * TODO(art-drop-in): once the Lovart SD art lands and placeholders are gone,
 * wire `check:sd-avatar-assets` into `build:weapp` and the CDN upload
 * workflow validation step.
 */
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
const SOURCE_ROOT = process.env.SD_AVATAR_SOURCE_ROOT
  ? path.resolve(process.env.SD_AVATAR_SOURCE_ROOT)
  : path.join(REPO_ROOT, 'assets-source', 'sd-pixel-avatars')
const OUTPUT_ROOT = path.join(APP_ROOT, 'src', 'assets', 'sd-avatar', 'v1')
const CDN_MANIFEST_PATH = path.join(APP_ROOT, 'scripts', 'cdn-asset-manifest.json')
let activeOutputRoot = OUTPUT_ROOT
const execFileAsync = promisify(execFile)

const MASTER_SIZE = 128
const SIZES = [128, 96, 64, 48, 32]
const HASH_LENGTH = 12
const ALLOW_PLACEHOLDER = process.env.SD_AVATAR_ALLOW_PLACEHOLDER === '1'

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

/**
 * Canonical archetype base colours (style guide §3 table, sampled from
 * packages/shared/src/archetypeColors.ts). Duplicated here because this
 * script is plain ESM without a TS toolchain.
 */
const ARCHETYPE_BASE_HEX = {
  corgi: '#CB9268',
  rooster: '#C49538',
  hamster_praise: '#D8C6B7',
  fox: '#C68E61',
  dolphin_calm: '#B8DFEF',
  spider: '#62526A',
  koala: '#ADABBC',
  octopus: '#CB8783',
  owl: '#714C42',
  elephant: '#BCCADE',
  turtle: '#4D613A',
  cat: '#D8D6C7',
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

// ─── Colour helpers (T2 coloured-outline rule) ──────────────────────────────

function hexToHsl(hex) {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslCss({ h, s, l }) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  return `hsl(${Math.round(h)}, ${Math.round(clamp(s, 0, 100))}%, ${Math.round(clamp(l, 0, 100))}%)`
}

/** T2: outline = same hue as the fill, lightness pressed to 30%. Never black. */
function outlineColor(base) {
  return hslCss({ h: base.h, s: Math.max(base.s, 20), l: 30 })
}

/** Lit-side tint: base lightness shifted (T2 highlight rule, never pure white). */
function tintColor(base, deltaL) {
  return hslCss({ h: base.h, s: base.s, l: base.l + deltaL })
}

// ─── Placeholder synthesis ──────────────────────────────────────────────────
// Simple geometric creature blobs, one signature silhouette feature per
// archetype (style guide §2 species-translation table), canonical archetype
// colour, T2 coloured outline, shared pixel-eye style. No text anywhere.
// These exist ONLY so runtime wiring is testable before the Lovart art lands.

const EYE_DARK = '#3A2E2A'
const EYE_SPARK = '#FFF6EA'

function baseCreature(base, featureBack = '', featureFront = '') {
  const fill = hslCss(base)
  const outline = outlineColor(base)
  return `
    ${featureBack}
    <ellipse cx="64" cy="118" rx="28" ry="6" fill="${outline}" opacity="0.18"/>
    <rect x="36" y="72" width="56" height="44" rx="18" fill="${fill}" stroke="${outline}" stroke-width="3"/>
    <circle cx="64" cy="48" r="30" fill="${fill}" stroke="${outline}" stroke-width="3"/>
    ${featureFront}
    <circle cx="53" cy="46" r="5.5" fill="${EYE_DARK}"/>
    <circle cx="75" cy="46" r="5.5" fill="${EYE_DARK}"/>
    <circle cx="51.5" cy="44" r="1.8" fill="${EYE_SPARK}"/>
    <circle cx="73.5" cy="44" r="1.8" fill="${EYE_SPARK}"/>
  `
}

function buildPlaceholderContent(archetypeId) {
  const base = hexToHsl(ARCHETYPE_BASE_HEX[archetypeId])
  const fill = hslCss(base)
  const outline = outlineColor(base)
  const light = tintColor(base, 18)
  const dark = tintColor(base, -18)
  const ear = (points) => `<polygon points="${points}" fill="${fill}" stroke="${outline}" stroke-width="3" stroke-linejoin="round"/>`

  switch (archetypeId) {
    // Signature: small triangle ears + round head.
    case 'cat':
      return baseCreature(base, `${ear('42,36 50,12 60,34')}${ear('68,34 78,12 86,36')}`)
    // Signature: big upright ears + white muzzle bib.
    case 'corgi':
      return baseCreature(
        base,
        `<rect x="40" y="10" width="12" height="28" rx="6" fill="${fill}" stroke="${outline}" stroke-width="3"/>
         <rect x="76" y="10" width="12" height="28" rx="6" fill="${fill}" stroke="${outline}" stroke-width="3"/>`,
        `<circle cx="64" cy="58" r="9" fill="${light}" stroke="${outline}" stroke-width="2"/>`,
      )
    // Signature: long pointed snout + big pointed ears, white muzzle tip.
    case 'fox':
      return baseCreature(
        base,
        `${ear('40,38 46,6 58,34')}${ear('70,34 82,6 88,38')}`,
        `<circle cx="64" cy="60" r="7" fill="${light}"/>`,
      )
    // Signature: oversized fluffy round ears (two head-widths).
    case 'koala':
      return baseCreature(
        base,
        `<circle cx="34" cy="36" r="15" fill="${fill}" stroke="${outline}" stroke-width="3"/>
         <circle cx="94" cy="36" r="15" fill="${fill}" stroke="${outline}" stroke-width="3"/>
         <circle cx="34" cy="36" r="7" fill="${light}"/>
         <circle cx="94" cy="36" r="7" fill="${light}"/>`,
        `<ellipse cx="64" cy="58" rx="6" ry="8" fill="${dark}"/>`,
      )
    // Signature: round facial disc + head feather tufts.
    case 'owl':
      return baseCreature(
        base,
        `${ear('46,26 52,10 60,26')}${ear('68,26 76,10 82,26')}`,
        `<circle cx="64" cy="50" r="21" fill="${light}"/>
         <polygon points="64,54 60,61 68,61" fill="${dark}"/>`,
      )
    // Signature: exactly 4 symbolic tentacles + dome spots.
    case 'octopus':
      return baseCreature(
        base,
        `<rect x="38" y="108" width="9" height="16" rx="4.5" fill="${fill}" stroke="${outline}" stroke-width="3"/>
         <rect x="53" y="110" width="9" height="16" rx="4.5" fill="${fill}" stroke="${outline}" stroke-width="3"/>
         <rect x="67" y="110" width="9" height="16" rx="4.5" fill="${fill}" stroke="${outline}" stroke-width="3"/>
         <rect x="82" y="108" width="9" height="16" rx="4.5" fill="${fill}" stroke="${outline}" stroke-width="3"/>`,
        `<circle cx="56" cy="28" r="3" fill="${dark}"/>
         <circle cx="70" cy="24" r="2.5" fill="${dark}"/>
         <circle cx="76" cy="33" r="2" fill="${dark}"/>`,
      )
    // Signature: 4 simplified legs from the shoulders + tiny forehead eye dots.
    case 'spider':
      return baseCreature(
        base,
        `<path d="M 38 82 L 20 68" stroke="${outline}" stroke-width="5" stroke-linecap="round"/>
         <path d="M 38 96 L 18 96" stroke="${outline}" stroke-width="5" stroke-linecap="round"/>
         <path d="M 90 82 L 108 68" stroke="${outline}" stroke-width="5" stroke-linecap="round"/>
         <path d="M 90 96 L 110 96" stroke="${outline}" stroke-width="5" stroke-linecap="round"/>`,
        `<circle cx="58" cy="33" r="2" fill="${EYE_DARK}"/>
         <circle cx="70" cy="33" r="2" fill="${EYE_DARK}"/>`,
      )
    // Signature: dome shell rim peeking from behind + light head speckle.
    case 'turtle':
      return baseCreature(
        base,
        `<circle cx="64" cy="88" r="36" fill="${dark}" stroke="${outline}" stroke-width="3"/>`,
        `<circle cx="54" cy="30" r="2.5" fill="${light}"/>
         <circle cx="72" cy="27" r="2" fill="${light}"/>`,
      )
    // Signature: short up-curved trunk + big fan ears.
    case 'elephant':
      return baseCreature(
        base,
        `<circle cx="34" cy="44" r="14" fill="${fill}" stroke="${outline}" stroke-width="3"/>
         <circle cx="94" cy="44" r="14" fill="${fill}" stroke="${outline}" stroke-width="3"/>`,
        `<path d="M 61 54 L 61 70 Q 61 77 69 73" fill="none" stroke="${outline}" stroke-width="9" stroke-linecap="round"/>
         <path d="M 61 54 L 61 70 Q 61 77 69 73" fill="none" stroke="${fill}" stroke-width="5" stroke-linecap="round"/>`,
      )
    // Signature: melon forehead + beak snout + dorsal fin.
    case 'dolphin_calm':
      return baseCreature(
        base,
        `<polygon points="88,72 100,50 98,78" fill="${fill}" stroke="${outline}" stroke-width="3" stroke-linejoin="round"/>`,
        `<circle cx="64" cy="22" r="10" fill="${fill}" stroke="${outline}" stroke-width="3"/>
         <rect x="56" y="54" width="16" height="9" rx="4.5" fill="${light}" stroke="${outline}" stroke-width="2"/>`,
      )
    // Signature: puffed cheek pouches + small round ears.
    case 'hamster_praise':
      return baseCreature(
        base,
        `<circle cx="44" cy="22" r="7" fill="${fill}" stroke="${outline}" stroke-width="3"/>
         <circle cx="84" cy="22" r="7" fill="${fill}" stroke="${outline}" stroke-width="3"/>`,
        `<circle cx="47" cy="62" r="9" fill="${light}" stroke="${outline}" stroke-width="2"/>
         <circle cx="81" cy="62" r="9" fill="${light}" stroke="${outline}" stroke-width="2"/>`,
      )
    // Signature: flame comb through the crown + simplified tail fan.
    case 'rooster':
      return baseCreature(
        base,
        `<polygon points="92,66 106,44 104,72" fill="${dark}" stroke="${outline}" stroke-width="3" stroke-linejoin="round"/>
         <polygon points="96,78 114,62 106,86" fill="${fill}" stroke="${outline}" stroke-width="3" stroke-linejoin="round"/>`,
        `<circle cx="54" cy="18" r="5" fill="${dark}"/>
         <circle cx="64" cy="13" r="6" fill="${dark}"/>
         <circle cx="74" cy="18" r="5" fill="${dark}"/>`,
      )
    default:
      throw new Error(`No placeholder feature set for archetype: ${archetypeId}`)
  }
}

function buildPlaceholderSvg(archetypeId) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${MASTER_SIZE}" height="${MASTER_SIZE}" viewBox="0 0 ${MASTER_SIZE} ${MASTER_SIZE}">
    <g shape-rendering="geometricPrecision">${buildPlaceholderContent(archetypeId)}</g>
  </svg>`)
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, HASH_LENGTH)
}

async function writeHashedFile(relativeDirectory, stem, buffer) {
  const fileName = `${stem}.${hashBuffer(buffer)}.webp`
  const relativePath = path.join(relativeDirectory, fileName)
  const absolutePath = path.join(activeOutputRoot, relativePath)
  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, buffer)
  return `assets/sd-avatar/v1/${relativePath.replaceAll('\\', '/')}`
}

async function encodeSprite(rgba, width, height) {
  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .webp({ quality: 88, alphaQuality: 100, nearLossless: true, smartSubsample: true })
    .toBuffer()
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

/**
 * Resolve the raw RGBA sprite for one size tier:
 *  - hand-cleaned pre-scaled export (verbatim), or
 *  - nearest-neighbour downscale of the 128px master (needsHandCleanup), or
 *  - synthesized placeholder.
 * Returns { data, info, provenance } where provenance is
 * 'pre-scaled' | 'master-downscale' | 'placeholder'.
 */
async function readSpriteRaw(archetypeId, size, masterRaw) {
  const preScaledPath = path.join(SOURCE_ROOT, archetypeId, `sd-avatar-${archetypeId}-${size}-v1.png`)
  if (await fileExists(preScaledPath)) {
    const image = sharp(preScaledPath).ensureAlpha()
    const metadata = await image.metadata()
    if (metadata.width !== size || metadata.height !== size) {
      throw new Error(
        `Pre-scaled export ${preScaledPath} must be exactly ${size}x${size}; got ${metadata.width}x${metadata.height}`,
      )
    }
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
    return { data, info, provenance: 'pre-scaled' }
  }
  if (masterRaw) {
    const { data, info } = await sharp(masterRaw.data, {
      raw: { width: masterRaw.info.width, height: masterRaw.info.height, channels: 4 },
    })
      .resize({
        width: size,
        height: size,
        fit: 'fill',
        // Pixel art: nearest-neighbour only — lanczos would blur the 1px
        // coloured outlines (style guide T6).
        kernel: sharp.kernel.nearest,
      })
      .raw()
      .toBuffer({ resolveWithObject: true })
    return { data, info, provenance: 'master-downscale' }
  }
  if (!ALLOW_PLACEHOLDER) return null
  const { data, info } = await sharp(buildPlaceholderSvg(archetypeId))
    .ensureAlpha()
    .resize({
      width: size,
      height: size,
      fit: 'fill',
      kernel: sharp.kernel.nearest,
    })
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, info, provenance: 'placeholder' }
}

async function readMasterRaw(archetypeId) {
  const masterPath = path.join(SOURCE_ROOT, archetypeId, `sd-avatar-${archetypeId}-master-v1.png`)
  if (!(await fileExists(masterPath))) return null
  const image = sharp(masterPath).ensureAlpha()
  const metadata = await image.metadata()
  if (metadata.width !== MASTER_SIZE || metadata.height !== MASTER_SIZE) {
    throw new Error(
      `Master ${masterPath} must be exactly ${MASTER_SIZE}x${MASTER_SIZE}; got ${metadata.width}x${metadata.height}`,
    )
  }
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  return { data, info }
}

async function buildArchetype(archetypeId) {
  const masterRaw = await readMasterRaw(archetypeId)
  const entry = { placeholder: false }
  let sawMasterDownscale = false
  let sawPlaceholder = false
  let builtAny = false
  for (const size of SIZES) {
    const raw = await readSpriteRaw(archetypeId, size, masterRaw)
    if (!raw) continue
    builtAny = true
    if (raw.provenance === 'master-downscale') sawMasterDownscale = true
    if (raw.provenance === 'placeholder') sawPlaceholder = true
    entry[size] = await writeHashedFile(
      `archetypes/${archetypeId}`,
      `sprite-${size}-v1`,
      await encodeSprite(raw.data, raw.info.width, raw.info.height),
    )
  }
  if (!builtAny) return null
  if (sawPlaceholder) {
    entry.placeholder = true
  } else if (sawMasterDownscale) {
    entry.needsHandCleanup = true
  }
  return entry
}

async function buildCdnManifest(generatedPaths) {
  const cdnManifest = JSON.parse(await fs.readFile(CDN_MANIFEST_PATH, 'utf8'))
  if (!Array.isArray(cdnManifest.assets)) throw new Error('CDN manifest must contain an assets array')
  // Only the generated sd-avatar subtree is refreshed; every other family
  // (profile-pixel V2, stage art, icons, ...) keeps its manifest entries.
  const generatedPrefixes = ['assets/sd-avatar/v1/']
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
  const checkerPath = path.join(__dirname, 'check-sd-avatar-assets.mjs')
  const { stdout } = await execFileAsync(process.execPath, [checkerPath], {
    env: {
      ...process.env,
      SD_AVATAR_BUILD_ROOT: stagedRoot,
      SD_AVATAR_CDN_MANIFEST_PATH: stagedCdnManifestPath,
    },
    maxBuffer: 1024 * 1024,
  })
  if (stdout.trim()) console.log(stdout.trim())
}

async function main() {
  if (!(await fileExists(SOURCE_ROOT))) {
    console.warn(`SD avatar source root ${SOURCE_ROOT} does not exist yet (Lovart art pending).`)
  }
  if (!ALLOW_PLACEHOLDER) {
    console.warn('SD_AVATAR_ALLOW_PLACEHOLDER is not set — archetypes without source art will be skipped.')
  }
  const stagedRoot = `${OUTPUT_ROOT}.build-${process.pid}`
  const stagedCdnManifestPath = `${CDN_MANIFEST_PATH}.build-${process.pid}`
  await fs.rm(stagedRoot, { recursive: true, force: true })
  await fs.rm(stagedCdnManifestPath, { force: true })
  activeOutputRoot = stagedRoot
  const manifest = {
    version: 1,
    renderer: 'sd-sprite',
    sizes: SIZES,
    sourceAssetCount: 0,
    archetypes: {},
  }
  try {
    for (const archetypeId of ARCHETYPE_IDS) {
      const entry = await buildArchetype(archetypeId)
      if (!entry) {
        console.log(`Skipped ${archetypeId}: no source art and placeholder mode is off.`)
        continue
      }
      manifest.archetypes[archetypeId] = entry
      const provenance = entry.placeholder
        ? 'placeholder'
        : entry.needsHandCleanup
          ? 'real (auto-scaled from master, needs hand cleanup)'
          : 'real (hand-cleaned pre-scaled exports)'
      console.log(`Built SD avatar sprites: ${archetypeId} [${provenance}]`)
    }
    const generatedPaths = [...new Set(
      Object.values(manifest.archetypes).flatMap((entry) => (
        SIZES.map((size) => entry[size]).filter(Boolean)
      )),
    )].sort()
    manifest.sourceAssetCount = generatedPaths.length
    if (generatedPaths.length === 0) {
      throw new Error(
        'No SD avatar art found and placeholder mode is off; '
        + 'drop art into assets-source/sd-pixel-avatars/ or run with SD_AVATAR_ALLOW_PLACEHOLDER=1.',
      )
    }
    await fs.mkdir(stagedRoot, { recursive: true })
    await fs.writeFile(
      path.join(stagedRoot, 'sd-avatar-assets-v1.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    )
    await fs.writeFile(stagedCdnManifestPath, await buildCdnManifest(generatedPaths))
    await validateStagedBuild(stagedRoot, stagedCdnManifestPath)
    // rename() does not create parents — the first-ever build has no
    // src/assets/sd-avatar/v1 directory yet.
    await fs.mkdir(OUTPUT_ROOT, { recursive: true })
    await replaceArtifacts([
      { stagedPath: path.join(stagedRoot, 'archetypes'), targetPath: path.join(OUTPUT_ROOT, 'archetypes') },
      { stagedPath: path.join(stagedRoot, 'sd-avatar-assets-v1.json'), targetPath: path.join(OUTPUT_ROOT, 'sd-avatar-assets-v1.json') },
      { stagedPath: stagedCdnManifestPath, targetPath: CDN_MANIFEST_PATH },
    ])
    activeOutputRoot = OUTPUT_ROOT
    const placeholderCount = Object.values(manifest.archetypes).filter((entry) => entry.placeholder).length
    const cleanupCount = Object.values(manifest.archetypes).filter((entry) => entry.needsHandCleanup).length
    console.log(
      `SD avatar assets built: ${Object.keys(manifest.archetypes).length} archetypes `
      + `(${placeholderCount} placeholder, ${cleanupCount} awaiting hand cleanup), `
      + `${generatedPaths.length} sprites.`,
    )
    console.log(`Synced ${generatedPaths.length} immutable sd-avatar paths into the CDN manifest.`)
  } catch (error) {
    await fs.rm(stagedRoot, { recursive: true, force: true })
    await fs.rm(stagedCdnManifestPath, { force: true })
    activeOutputRoot = OUTPUT_ROOT
    throw error
  }
}

main().catch((error) => {
  console.error(`SD avatar build failed: ${error.message}`)
  process.exit(1)
})
