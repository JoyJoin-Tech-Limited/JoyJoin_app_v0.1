#!/usr/bin/env node
/**
 * check-sd-avatar-assets.mjs
 *
 * Validates the SD pixel avatar sprite family:
 *   - sd-avatar-assets-v1.json manifest shape (version 1, renderer sd-sprite,
 *     sizes exactly [128, 96, 64, 48, 32])
 *   - every sprite file exists, is an RGBA WebP of exactly its tier size,
 *     has transparent background + visible pixels, and its 12-char sha256
 *     content-hash filename matches the file bytes
 *   - the on-disk tree exactly matches the manifest (no missing/extra files)
 *   - every sprite path has exactly one same-path entry in the CDN manifest,
 *     and no unexpected assets/sd-avatar/ entries exist
 *   - reports per-archetype provenance: real (pre-scaled), real (auto-scaled,
 *     needs hand cleanup), placeholder, or missing
 *
 * Placeholder sprites are valid output while the Lovart art is pending, but
 * the art-complete gate can pass --require-real-art to fail when any
 * archetype is still a placeholder, auto-scaled, or missing.
 *
 * Env overrides (used by the staged build):
 *   SD_AVATAR_BUILD_ROOT         — asset root containing sd-avatar-assets-v1.json
 *   SD_AVATAR_CDN_MANIFEST_PATH  — CDN manifest to validate against
 */
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, '..')
const ASSET_ROOT = path.join(APP_ROOT, 'src')
const BUILD_ROOT = process.env.SD_AVATAR_BUILD_ROOT
  ? path.resolve(process.env.SD_AVATAR_BUILD_ROOT)
  : path.join(ASSET_ROOT, 'assets', 'sd-avatar', 'v1')
const CDN_MANIFEST_PATH = process.env.SD_AVATAR_CDN_MANIFEST_PATH
  ? path.resolve(process.env.SD_AVATAR_CDN_MANIFEST_PATH)
  : path.join(__dirname, 'cdn-asset-manifest.json')
const MANIFEST_PATH = path.join(BUILD_ROOT, 'sd-avatar-assets-v1.json')
const REQUIRE_REAL_ART = process.argv.includes('--require-real-art')

const SIZES = [128, 96, 64, 48, 32]
const HASH_LENGTH = 12
const PATH_PREFIX = 'assets/sd-avatar/v1/'
const ARCHETYPE_IDS = [
  'corgi', 'rooster', 'hamster_praise', 'fox', 'dolphin_calm', 'spider',
  'koala', 'octopus', 'owl', 'elephant', 'turtle', 'cat',
]
const SAFE_ARCHETYPE_IDS = new Set(ARCHETYPE_IDS)

function assertSafeSdPath(relativePath, label) {
  if (
    typeof relativePath !== 'string'
    || !relativePath.startsWith(PATH_PREFIX)
    || relativePath.includes('..')
    || relativePath.includes('\\')
  ) {
    throw new Error(`${label} must be a safe path under ${PATH_PREFIX}`)
  }
}

function resolveAssetPath(relativePath) {
  return path.join(BUILD_ROOT, relativePath.slice(PATH_PREFIX.length))
}

function assertContentHash(relativePath, buffer, label) {
  const match = path.basename(relativePath).match(/\.([a-f0-9]{12})\.webp$/)
  if (!match) throw new Error(`${label} must use a .<12-char-sha256>.webp immutable filename`)
  const actualHash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, HASH_LENGTH)
  if (match[1] !== actualHash) {
    throw new Error(`${label} filename hash ${match[1]} does not match file content ${actualHash}`)
  }
}

async function inspectSprite(relativePath, size, label) {
  assertSafeSdPath(relativePath, label)
  const expectedPrefix = `${PATH_PREFIX}archetypes/`
  if (!relativePath.startsWith(expectedPrefix)) {
    throw new Error(`${label} must live under ${expectedPrefix}`)
  }
  if (!relativePath.includes(`/sprite-${size}-v1.`)) {
    throw new Error(`${label} must use the sprite-${size}-v1.<hash>.webp naming`)
  }
  const buffer = await fs.readFile(resolveAssetPath(relativePath))
  if (buffer.length === 0) throw new Error(`${relativePath} is empty`)
  assertContentHash(relativePath, buffer, label)
  const image = sharp(buffer)
  const [metadata, stats] = await Promise.all([image.metadata(), image.stats()])
  if (metadata.format !== 'webp' || metadata.channels !== 4 || metadata.hasAlpha !== true) {
    throw new Error(`${relativePath} must be an RGBA WebP`)
  }
  if (metadata.width !== size || metadata.height !== size) {
    throw new Error(`${relativePath} must be ${size}x${size}; got ${metadata.width}x${metadata.height}`)
  }
  const alpha = stats.channels[3]
  if (!alpha || alpha.min > 16 || alpha.max < 128) {
    throw new Error(`${relativePath} must contain transparent background and visible pixels`)
  }
  return buffer.length
}

async function listWebpFiles(directory) {
  const result = []
  let entries
  try {
    entries = await fs.readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return result
    throw error
  }
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await listWebpFiles(absolutePath))
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.webp')) result.push(absolutePath)
  }
  return result
}

async function main() {
  const [cdnManifest, sdManifest] = await Promise.all([
    fs.readFile(CDN_MANIFEST_PATH, 'utf8').then(JSON.parse),
    fs.readFile(MANIFEST_PATH, 'utf8').then(JSON.parse),
  ])
  if (!Array.isArray(cdnManifest.assets)) throw new Error('CDN manifest must contain an assets array')

  if (sdManifest.version !== 1) throw new Error('SD avatar manifest version must be 1')
  if (sdManifest.renderer !== 'sd-sprite') {
    throw new Error('SD avatar manifest renderer must be sd-sprite')
  }
  if (
    !Array.isArray(sdManifest.sizes)
    || sdManifest.sizes.length !== SIZES.length
    || sdManifest.sizes.some((size, index) => size !== SIZES[index])
  ) {
    throw new Error(`SD avatar manifest sizes must be exactly ${SIZES.join(', ')}`)
  }
  if (!sdManifest.archetypes || typeof sdManifest.archetypes !== 'object' || Array.isArray(sdManifest.archetypes)) {
    throw new Error('SD avatar manifest must include an archetypes map')
  }

  const manifestIds = Object.keys(sdManifest.archetypes)
  for (const archetypeId of manifestIds) {
    if (!SAFE_ARCHETYPE_IDS.has(archetypeId)) {
      throw new Error(`SD avatar manifest has unknown archetype: ${archetypeId}`)
    }
  }
  if (manifestIds.length === 0) {
    throw new Error('SD avatar manifest contains no archetypes')
  }

  const localPaths = new Set()
  const cdnPaths = new Set()
  for (const asset of cdnManifest.assets) {
    if (!asset?.localPath || !asset?.cdnPath) {
      throw new Error('Every CDN manifest entry must include localPath and cdnPath')
    }
    if (localPaths.has(asset.localPath)) throw new Error(`Duplicate localPath: ${asset.localPath}`)
    if (cdnPaths.has(asset.cdnPath)) throw new Error(`Duplicate cdnPath: ${asset.cdnPath}`)
    localPaths.add(asset.localPath)
    cdnPaths.add(asset.cdnPath)
  }

  const expectedPaths = new Set()
  const report = []
  let totalBytes = 0
  for (const archetypeId of ARCHETYPE_IDS) {
    const entry = sdManifest.archetypes[archetypeId]
    if (!entry) {
      report.push(`${archetypeId}: MISSING`)
      continue
    }
    if (typeof entry.placeholder !== 'boolean') {
      throw new Error(`${archetypeId} must declare placeholder as a boolean`)
    }
    if (entry.needsHandCleanup !== undefined && typeof entry.needsHandCleanup !== 'boolean') {
      throw new Error(`${archetypeId} needsHandCleanup must be a boolean when present`)
    }
    if (entry.placeholder && entry.needsHandCleanup) {
      throw new Error(`${archetypeId} cannot be both placeholder and needsHandCleanup`)
    }
    for (const size of SIZES) {
      const relativePath = entry[String(size)]
      const label = `${archetypeId} sprite-${size}`
      if (typeof relativePath !== 'string') {
        throw new Error(`${label} must declare a path for every size tier`)
      }
      const tierPrefix = `${PATH_PREFIX}archetypes/${archetypeId}/sprite-${size}-v1.`
      if (!relativePath.startsWith(tierPrefix)) {
        throw new Error(`${label} must use a content-hashed path under ${tierPrefix}`)
      }
      expectedPaths.add(relativePath)
      totalBytes += await inspectSprite(relativePath, size, label)
    }
    report.push(
      `${archetypeId}: ${entry.placeholder
        ? 'PLACEHOLDER'
        : entry.needsHandCleanup
          ? 'REAL (auto-scaled from master, needs hand cleanup)'
          : 'REAL (hand-cleaned pre-scaled exports)'}`,
    )
  }

  if (sdManifest.sourceAssetCount !== expectedPaths.size) {
    throw new Error(`sourceAssetCount must equal the ${expectedPaths.size} generated sprite files`)
  }

  const actualPaths = new Set(
    (await listWebpFiles(BUILD_ROOT)).map((absolutePath) => (
      `${PATH_PREFIX}${path.relative(BUILD_ROOT, absolutePath).replaceAll('\\', '/')}`
    )),
  )
  const missingFiles = [...expectedPaths].filter((relativePath) => !actualPaths.has(relativePath))
  const extraFiles = [...actualPaths].filter((relativePath) => !expectedPaths.has(relativePath))
  if (missingFiles.length > 0 || extraFiles.length > 0) {
    throw new Error(
      `SD avatar tree must exactly match its runtime manifest; missing: ${missingFiles.join(', ') || 'none'}; extra: ${extraFiles.join(', ') || 'none'}`,
    )
  }

  for (const relativePath of expectedPaths) {
    const matches = cdnManifest.assets.filter((asset) => (
      asset.localPath === relativePath && asset.cdnPath === relativePath
    ))
    if (matches.length !== 1) {
      throw new Error(`${relativePath} must have exactly one same-path CDN manifest entry`)
    }
  }
  const unexpectedManifestPaths = cdnManifest.assets
    .filter((asset) => (
      asset.localPath.startsWith(PATH_PREFIX) && !expectedPaths.has(asset.localPath)
    ))
    .map((asset) => asset.localPath)
  if (unexpectedManifestPaths.length > 0) {
    throw new Error(`Unexpected sd-avatar manifest entries: ${unexpectedManifestPaths.join(', ')}`)
  }

  console.log('SD avatar provenance report:')
  for (const line of report) console.log(`  ${line}`)
  const placeholderCount = report.filter((line) => line.endsWith('PLACEHOLDER')).length
  const cleanupCount = report.filter((line) => line.includes('needs hand cleanup')).length
  const missingCount = report.filter((line) => line.endsWith('MISSING')).length

  if (REQUIRE_REAL_ART && (placeholderCount > 0 || cleanupCount > 0 || missingCount > 0)) {
    throw new Error(
      `--require-real-art: ${placeholderCount} placeholder, ${cleanupCount} auto-scaled, ${missingCount} missing archetype(s) remain`,
    )
  }

  console.log(
    `SD avatar assets OK: ${manifestIds.length} archetypes, ${expectedPaths.size} sprites (${totalBytes} bytes), `
    + `${placeholderCount} placeholder / ${cleanupCount} auto-scaled / ${missingCount} missing — all content-hashed and CDN-mapped.`,
  )
}

main().catch((error) => {
  console.error(`SD avatar asset validation failed: ${error.message}`)
  process.exit(1)
})
