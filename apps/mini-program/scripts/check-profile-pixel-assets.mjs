import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(APP_ROOT, '..', '..')
const ASSET_ROOT = path.join(APP_ROOT, 'src')
const V2_ROOT = process.env.PROFILE_PIXEL_BUILD_V2_ROOT
  ? path.resolve(process.env.PROFILE_PIXEL_BUILD_V2_ROOT)
  : path.join(ASSET_ROOT, 'assets', 'profile-pixel', 'v2')
const CDN_MANIFEST_PATH = process.env.PROFILE_PIXEL_CDN_MANIFEST_PATH
  ? path.resolve(process.env.PROFILE_PIXEL_CDN_MANIFEST_PATH)
  : path.join(__dirname, 'cdn-asset-manifest.json')
const AVATAR_MANIFEST_PATH = path.join(V2_ROOT, 'avatar-assets-v2.json')
const SOURCE_REGISTRY_PATH = path.join(
  process.env.PROFILE_PIXEL_SOURCE_ROOT
    ? path.resolve(process.env.PROFILE_PIXEL_SOURCE_ROOT)
    : path.join(REPO_ROOT, 'assets-source', 'profile-pixel-v2'),
  'equipment-items.json',
)
const CANVAS_WIDTH = 512
const CANVAS_HEIGHT = 768
const LEGACY_MAX_BYTES = 64 * 1024
const HASH_LENGTH = 12
const PORTABLE_RELATIVE_PATH_LENGTH = 200
const PORTABLE_SEGMENT_LENGTH = 64
const ARCHETYPE_IDS = [
  'corgi', 'rooster', 'hamster_praise', 'fox', 'dolphin_calm', 'spider',
  'koala', 'octopus', 'owl', 'elephant', 'turtle', 'cat',
]
const EQUIPMENT_SLOTS = ['top', 'bottom', 'shoes', 'accessory']
const SAFE_ARCHETYPE_IDS = new Set(ARCHETYPE_IDS)
const SAFE_EQUIPMENT_SLOTS = new Set(EQUIPMENT_SLOTS)
const WINDOWS_RESERVED_SEGMENT = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/

const legacyPath = (id) => `assets/profile-pixel/archetypes/${id}/base-v1.webp`

function assertExactKeys(record, expected, label) {
  const actual = Object.keys(record ?? {}).sort()
  const wanted = [...expected].sort()
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} keys must be exactly ${wanted.join(', ')}; got ${actual.join(', ')}`)
  }
}

function assertSafeV2Path(relativePath, label) {
  if (
    typeof relativePath !== 'string'
    || !relativePath.startsWith('assets/profile-pixel/v2/')
    || relativePath.includes('..')
    || relativePath.includes('\\')
  ) {
    throw new Error(`${label} must be a safe path under assets/profile-pixel/v2/`)
  }
}

function assertSafeAssetKey(assetKey) {
  if (typeof assetKey !== 'string' || assetKey.length === 0 || assetKey.length > 120) {
    throw new Error('Equipment asset keys must be non-empty strings of at most 120 characters')
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
    throw new Error(`Equipment asset keys must use portable lowercase path segments: ${assetKey}`)
  }
  if (segments.some((segment) => segment.length > PORTABLE_SEGMENT_LENGTH)) {
    throw new Error(`Equipment asset key contains an overlong path segment: ${assetKey}`)
  }
}

function resolveV2AssetPath(relativePath) {
  const prefix = 'assets/profile-pixel/v2/'
  return path.join(V2_ROOT, relativePath.slice(prefix.length))
}

function placementsEqual(actual, expected) {
  if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object') return false
  const actualKeys = Object.keys(actual).sort()
  const expectedKeys = Object.keys(expected).sort()
  if (
    actualKeys.length !== expectedKeys.length
    || actualKeys.some((key, index) => key !== expectedKeys[index])
  ) return false
  return actualKeys.every((archetypeId) => {
    const actualPlacement = actual[archetypeId]
    const expectedPlacement = expected[archetypeId]
    return ['left', 'top', 'width', 'height'].every((field) => (
      actualPlacement?.[field] === expectedPlacement?.[field]
    ))
  })
}

function validatePlacement(placement, metadata, label) {
  if (!placement || typeof placement !== 'object' || Array.isArray(placement)) {
    throw new Error(`${label} must include placement`)
  }
  const { left, top, width, height } = placement
  for (const [key, value] of Object.entries({ left, top, width, height })) {
    if (!Number.isInteger(value)) throw new Error(`${label} placement.${key} must be an integer`)
  }
  if (left < 0 || top < 0 || width <= 0 || height <= 0) {
    throw new Error(`${label} placement must have a non-negative origin and positive size`)
  }
  if (left + width > CANVAS_WIDTH || top + height > CANVAS_HEIGHT) {
    throw new Error(`${label} placement exceeds the ${CANVAS_WIDTH}x${CANVAS_HEIGHT} avatar canvas`)
  }
  const imageRatio = metadata.width / metadata.height
  const placementRatio = width / height
  if (Math.abs((placementRatio / imageRatio) - 1) > 0.03) {
    throw new Error(
      `${label} placement aspect ${width}x${height} distorts its ${metadata.width}x${metadata.height} source`,
    )
  }
}

function assertContentHash(relativePath, buffer, label) {
  const match = path.basename(relativePath).match(/\.([a-f0-9]{12})\.webp$/)
  if (!match) throw new Error(`${label} must use a .<12-char-sha256>.webp immutable filename`)
  const actualHash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, HASH_LENGTH)
  if (match[1] !== actualHash) {
    throw new Error(`${label} filename hash ${match[1]} does not match file content ${actualHash}`)
  }
}

async function inspectTransparentWebp(relativePath, { width, height, maxWidth, maxHeight, label = relativePath } = {}) {
  assertSafeV2Path(relativePath, label)
  if (
    relativePath.length > PORTABLE_RELATIVE_PATH_LENGTH
    || relativePath.split('/').some((segment) => segment.length > PORTABLE_SEGMENT_LENGTH)
  ) {
    throw new Error(`${label} exceeds the portable repository path limit`)
  }
  const absolutePath = resolveV2AssetPath(relativePath)
  const buffer = await fs.readFile(absolutePath)
  if (buffer.length === 0) throw new Error(`${relativePath} is empty`)
  assertContentHash(relativePath, buffer, label)
  const image = sharp(buffer)
  const [metadata, stats] = await Promise.all([image.metadata(), image.stats()])
  if (metadata.format !== 'webp' || metadata.channels !== 4 || metadata.hasAlpha !== true) {
    throw new Error(`${relativePath} must be an RGBA WebP`)
  }
  if (width !== undefined && (metadata.width !== width || metadata.height !== height)) {
    throw new Error(`${relativePath} must be ${width}x${height}; got ${metadata.width}x${metadata.height}`)
  }
  if (maxWidth !== undefined && (metadata.width > maxWidth || metadata.height > maxHeight)) {
    throw new Error(`${relativePath} must fit within ${maxWidth}x${maxHeight}; got ${metadata.width}x${metadata.height}`)
  }
  const alpha = stats.channels[3]
  if (!alpha || alpha.min > 16 || alpha.max < 128) {
    throw new Error(`${relativePath} must contain transparent background and visible pixels`)
  }
  return { metadata, bytes: buffer.length }
}

async function inspectLegacyWebp(relativePath) {
  const absolutePath = path.join(ASSET_ROOT, relativePath)
  const stat = await fs.stat(absolutePath)
  if (stat.size > LEGACY_MAX_BYTES) {
    throw new Error(`${relativePath} exceeds ${LEGACY_MAX_BYTES} bytes: ${stat.size}`)
  }
  const image = sharp(absolutePath)
  const [metadata, stats] = await Promise.all([image.metadata(), image.stats()])
  if (
    metadata.format !== 'webp'
    || metadata.width !== CANVAS_WIDTH
    || metadata.height !== CANVAS_HEIGHT
    || metadata.hasAlpha !== true
  ) {
    throw new Error(`${relativePath} must remain a ${CANVAS_WIDTH}x${CANVAS_HEIGHT} transparent WebP`)
  }
  const alpha = stats.channels[3]
  if (!alpha || alpha.min > 16 || alpha.max < 128) {
    throw new Error(`${relativePath} must contain transparent background and visible pixels`)
  }
}

async function listWebpFiles(directory) {
  const result = []
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await listWebpFiles(absolutePath))
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.webp')) result.push(absolutePath)
  }
  return result
}

async function main() {
  const [cdnManifest, avatarManifest, sourceRegistry] = await Promise.all([
    fs.readFile(CDN_MANIFEST_PATH, 'utf8').then(JSON.parse),
    fs.readFile(AVATAR_MANIFEST_PATH, 'utf8').then(JSON.parse),
    fs.readFile(SOURCE_REGISTRY_PATH, 'utf8').then(JSON.parse),
  ])
  if (!Array.isArray(cdnManifest.assets)) throw new Error('CDN manifest must contain an assets array')
  if (avatarManifest.version !== 2) throw new Error('Avatar manifest version must be 2')
  if (avatarManifest.renderer !== 'layered-paper-doll-parallax') {
    throw new Error('Avatar manifest renderer must be layered-paper-doll-parallax')
  }
  if (avatarManifest.permanentBaseUnderwear !== true) {
    throw new Error('Avatar manifest must declare permanentBaseUnderwear=true')
  }
  if (avatarManifest.width !== CANVAS_WIDTH || avatarManifest.height !== CANVAS_HEIGHT) {
    throw new Error(`Avatar manifest canvas must be ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`)
  }
  if (avatarManifest.equipmentLayersDoubleAsThumbnails !== true) {
    throw new Error('Avatar manifest must declare equipmentLayersDoubleAsThumbnails=true')
  }
  if (!avatarManifest.items || typeof avatarManifest.items !== 'object' || Array.isArray(avatarManifest.items)) {
    throw new Error('Avatar manifest must include an item registry')
  }
  if (sourceRegistry?.version !== 1 || !Array.isArray(sourceRegistry.items)) {
    throw new Error('equipment-items.json must contain { version: 1, items: [] }')
  }
  assertExactKeys(avatarManifest.archetypes, ARCHETYPE_IDS, 'Avatar manifest archetypes')

  const requiredStarterKeys = new Set(
    ARCHETYPE_IDS.flatMap((archetypeId) => (
      EQUIPMENT_SLOTS.map((slot) => `equipment/starter/${archetypeId}/${slot}/v1`)
    )),
  )
  const actualStarterKeys = Object.keys(avatarManifest.items)
    .filter((assetKey) => assetKey.startsWith('equipment/starter/'))
  if (
    actualStarterKeys.length !== requiredStarterKeys.size
    || actualStarterKeys.some((assetKey) => !requiredStarterKeys.has(assetKey))
  ) {
    throw new Error(`Avatar manifest must contain exactly ${requiredStarterKeys.size} canonical starter items`)
  }

  const registeredFutureKeys = sourceRegistry.items.map((item) => item?.assetKey)
  if (registeredFutureKeys.some((assetKey) => typeof assetKey !== 'string')) {
    throw new Error('Every equipment-items.json item must include an assetKey')
  }
  if (new Set(registeredFutureKeys).size !== registeredFutureKeys.length) {
    throw new Error('equipment-items.json contains duplicate asset keys')
  }
  for (const assetKey of registeredFutureKeys) {
    assertSafeAssetKey(assetKey)
    if (assetKey.startsWith('equipment/starter/')) {
      throw new Error(`${assetKey} uses the reserved equipment/starter namespace`)
    }
  }
  const sourceItemsByKey = new Map(
    sourceRegistry.items.map((item) => [item.assetKey, item]),
  )
  const actualFutureKeys = Object.keys(avatarManifest.items)
    .filter((assetKey) => !assetKey.startsWith('equipment/starter/'))
    .sort()
  assertExactKeys(
    Object.fromEntries(actualFutureKeys.map((assetKey) => [assetKey, true])),
    registeredFutureKeys,
    'Generated future equipment',
  )

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

  const expectedV2Paths = new Set()
  const inspectedLayers = new Map()
  let totalBytes = 0
  for (const archetypeId of ARCHETYPE_IDS) {
    await inspectLegacyWebp(legacyPath(archetypeId))
    const archetype = avatarManifest.archetypes[archetypeId]
    const bodyPrefix = `assets/profile-pixel/v2/archetypes/${archetypeId}/body-front-v2.`
    if (typeof archetype.body !== 'string' || !archetype.body.startsWith(bodyPrefix)) {
      throw new Error(`${archetypeId} body must use a content-hashed body-front-v2 path`)
    }
    expectedV2Paths.add(archetype.body)
    const body = await inspectTransparentWebp(archetype.body, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      label: `${archetypeId} body`,
    })
    totalBytes += body.bytes

    assertExactKeys(archetype.starter, EQUIPMENT_SLOTS, `${archetypeId} starter slots`)
    for (const slot of EQUIPMENT_SLOTS) {
      const assetKey = `equipment/starter/${archetypeId}/${slot}/v1`
      const nestedItem = archetype.starter[slot]
      const registryItem = avatarManifest.items[assetKey]
      if (!registryItem) throw new Error(`Missing required starter registry entry: ${assetKey}`)
      if (
        registryItem.slot !== slot
        || registryItem.layer !== nestedItem.layer
        || registryItem.depth !== nestedItem.depth
      ) {
        throw new Error(`${assetKey} registry entry must match its archetype starter entry`)
      }
      assertExactKeys(registryItem.placements, [archetypeId], `${assetKey} registry placements`)
      if (JSON.stringify(registryItem.placements[archetypeId]) !== JSON.stringify(nestedItem.placement)) {
        throw new Error(`${assetKey} registry placement must match its starter placement`)
      }
    }
  }

  for (const [assetKey, item] of Object.entries(avatarManifest.items)) {
    assertSafeAssetKey(assetKey)
    if (!SAFE_EQUIPMENT_SLOTS.has(item?.slot)) throw new Error(`${assetKey} has invalid slot`)
    if (!Number.isFinite(item.depth) || item.depth < 0 || item.depth > 1) {
      throw new Error(`${assetKey} depth must be between 0 and 1`)
    }
    if (!item.placements || typeof item.placements !== 'object' || Array.isArray(item.placements)) {
      throw new Error(`${assetKey} must include archetype placements`)
    }
    const placementEntries = Object.entries(item.placements)
    if (placementEntries.length === 0) throw new Error(`${assetKey} must support at least one archetype`)
    const layerPrefix = assetKey.startsWith('equipment/starter/')
      ? 'assets/profile-pixel/v2/equipment/starter/'
      : `assets/profile-pixel/v2/equipment/catalog/${assetKey.split('/').slice(1).join('/')}/layer-v2.`
    if (typeof item.layer !== 'string' || !item.layer.startsWith(layerPrefix)) {
      throw new Error(`${assetKey} layer must live under ${layerPrefix}`)
    }
    if (!assetKey.startsWith('equipment/starter/')) {
      const sourceItem = sourceItemsByKey.get(assetKey)
      if (
        !sourceItem
        || item.slot !== sourceItem.slot
        || item.depth !== sourceItem.depth
        || !placementsEqual(item.placements, sourceItem.placements)
      ) {
        throw new Error(`${assetKey} runtime metadata must match equipment-items.json`)
      }
    }
    expectedV2Paths.add(item.layer)
    let layer = inspectedLayers.get(item.layer)
    if (!layer) {
      layer = await inspectTransparentWebp(item.layer, {
        maxWidth: CANVAS_WIDTH,
        maxHeight: CANVAS_HEIGHT,
        label: `${assetKey} layer`,
      })
      inspectedLayers.set(item.layer, layer)
      totalBytes += layer.bytes
    }
    for (const [archetypeId, placement] of placementEntries) {
      if (!SAFE_ARCHETYPE_IDS.has(archetypeId)) {
        throw new Error(`${assetKey} has unknown placement archetype: ${archetypeId}`)
      }
      validatePlacement(placement, layer.metadata, `${assetKey}/${archetypeId}`)
    }
  }

  const uniqueItemLayerCount = inspectedLayers.size
  if (avatarManifest.bodyAssetCount !== ARCHETYPE_IDS.length) {
    throw new Error(`bodyAssetCount must be ${ARCHETYPE_IDS.length}`)
  }
  if (avatarManifest.itemAssetCount !== uniqueItemLayerCount) {
    throw new Error(`itemAssetCount must equal the ${uniqueItemLayerCount} unique registered layers`)
  }
  if (avatarManifest.sourceAssetCount !== expectedV2Paths.size) {
    throw new Error(`sourceAssetCount must equal the ${expectedV2Paths.size} generated V2 files`)
  }

  const actualV2Paths = new Set(
    (await listWebpFiles(V2_ROOT)).map((absolutePath) => (
      `assets/profile-pixel/v2/${path.relative(V2_ROOT, absolutePath).replaceAll('\\', '/')}`
    )),
  )
  const missingFiles = [...expectedV2Paths].filter((relativePath) => !actualV2Paths.has(relativePath))
  const extraFiles = [...actualV2Paths].filter((relativePath) => !expectedV2Paths.has(relativePath))
  if (missingFiles.length > 0 || extraFiles.length > 0) {
    throw new Error(
      `V2 tree must exactly match its runtime manifest; missing: ${missingFiles.join(', ') || 'none'}; extra: ${extraFiles.join(', ') || 'none'}`,
    )
  }

  const expectedProfilePaths = new Set([...ARCHETYPE_IDS.map(legacyPath), ...expectedV2Paths])
  for (const relativePath of expectedProfilePaths) {
    const matches = cdnManifest.assets.filter((asset) => (
      asset.localPath === relativePath && asset.cdnPath === relativePath
    ))
    if (matches.length !== 1) {
      throw new Error(`${relativePath} must have exactly one same-path CDN manifest entry`)
    }
  }
  const unexpectedManifestPaths = cdnManifest.assets
    .filter((asset) => (
      asset.localPath.startsWith('assets/profile-pixel/')
      && !expectedProfilePaths.has(asset.localPath)
    ))
    .map((asset) => asset.localPath)
  if (unexpectedManifestPaths.length > 0) {
    throw new Error(`Unexpected profile-pixel manifest entries: ${unexpectedManifestPaths.join(', ')}`)
  }

  console.log(
    `Profile pixel assets OK: ${ARCHETYPE_IDS.length} permanent-base bodies + ${uniqueItemLayerCount} reusable layers (${totalBytes} V2 bytes), all content-hashed and CDN-mapped.`,
  )
}

main().catch((error) => {
  console.error(`Profile pixel asset validation failed: ${error.message}`)
  process.exit(1)
})
