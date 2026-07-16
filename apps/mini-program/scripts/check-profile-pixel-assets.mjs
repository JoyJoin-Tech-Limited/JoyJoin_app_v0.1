import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, '..')
const MANIFEST_PATH = path.join(__dirname, 'cdn-asset-manifest.json')
const EXPECTED_WIDTH = 512
const EXPECTED_HEIGHT = 768
const MAX_BYTES = 64 * 1024
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

function expectedPath(archetypeId) {
  return `assets/profile-pixel/archetypes/${archetypeId}/base-v1.webp`
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'))
  if (!Array.isArray(manifest.assets)) {
    throw new Error('CDN manifest must contain an assets array')
  }

  const localPaths = new Set()
  const cdnPaths = new Set()
  for (const asset of manifest.assets) {
    if (!asset?.localPath || !asset?.cdnPath) {
      throw new Error('Every CDN manifest entry must include localPath and cdnPath')
    }
    if (localPaths.has(asset.localPath)) throw new Error(`Duplicate localPath: ${asset.localPath}`)
    if (cdnPaths.has(asset.cdnPath)) throw new Error(`Duplicate cdnPath: ${asset.cdnPath}`)
    localPaths.add(asset.localPath)
    cdnPaths.add(asset.cdnPath)
  }

  let totalBytes = 0
  for (const archetypeId of ARCHETYPE_IDS) {
    const relativePath = expectedPath(archetypeId)
    const matches = manifest.assets.filter(
      (asset) => asset.localPath === relativePath && asset.cdnPath === relativePath,
    )
    if (matches.length !== 1) {
      throw new Error(`${archetypeId} must have exactly one same-path CDN manifest entry`)
    }

    const absolutePath = path.join(APP_ROOT, 'src', relativePath)
    const stat = await fs.stat(absolutePath)
    if (stat.size > MAX_BYTES) {
      throw new Error(`${archetypeId} exceeds ${MAX_BYTES} bytes: ${stat.size}`)
    }

    const image = sharp(absolutePath)
    const [metadata, stats] = await Promise.all([image.metadata(), image.stats()])
    if (
      metadata.format !== 'webp'
      || metadata.width !== EXPECTED_WIDTH
      || metadata.height !== EXPECTED_HEIGHT
      || metadata.channels !== 4
      || metadata.hasAlpha !== true
    ) {
      throw new Error(
        `${archetypeId} must be transparent ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT} WebP; got ${metadata.width}x${metadata.height} ${metadata.format}/${metadata.channels}`,
      )
    }
    const alpha = stats.channels[3]
    if (!alpha || alpha.min > 16 || alpha.max < 240) {
      throw new Error(`${archetypeId} must contain both transparent and opaque pixels`)
    }
    totalBytes += stat.size
  }

  const unexpected = manifest.assets.filter(
    (asset) => asset.localPath.startsWith('assets/profile-pixel/')
      && !ARCHETYPE_IDS.some((id) => asset.localPath === expectedPath(id)),
  )
  if (unexpected.length > 0) {
    throw new Error(`Unexpected profile-pixel manifest entries: ${unexpected.map((asset) => asset.localPath).join(', ')}`)
  }

  console.log(`Profile pixel assets OK: ${ARCHETYPE_IDS.length} transparent WebP files, ${totalBytes} bytes total.`)
}

main().catch((error) => {
  console.error(`Profile pixel asset validation failed: ${error.message}`)
  process.exit(1)
})
