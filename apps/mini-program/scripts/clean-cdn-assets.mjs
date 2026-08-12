import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '..', 'dist')
const assetsDir = path.join(distDir, 'assets')
const alangAssetsDir = path.join(distDir, 'pages', 'alang', 'assets')

async function exists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function removePath(relativePath) {
  await fs.rm(path.join(assetsDir, relativePath), { force: true, recursive: true })
}

async function removeMatchingFrom(rootDir, relativeDir, predicate) {
  const dir = path.join(rootDir, relativeDir)
  if (!(await exists(dir))) return

  const entries = await fs.readdir(dir, { withFileTypes: true })
  await Promise.all(
    entries
      .filter((entry) => predicate(entry.name, entry))
      .map((entry) => fs.rm(path.join(dir, entry.name), { force: true, recursive: true })),
  )
}

async function removeMatching(relativeDir, predicate) {
  return removeMatchingFrom(assetsDir, relativeDir, predicate)
}

async function removeByName(rootDir, fileName) {
  if (!(await exists(rootDir))) return

  const entries = await fs.readdir(rootDir, { withFileTypes: true })
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(rootDir, entry.name)
      if (entry.name === fileName) {
        await fs.rm(entryPath, { force: true, recursive: true })
        return
      }
      if (entry.isDirectory()) {
        await removeByName(entryPath, fileName)
      }
    }),
  )
}

if (!(await exists(assetsDir))) {
  console.error('dist/assets does not exist. Run npm run build:weapp first.')
  process.exit(1)
}

await Promise.all(
  [
    'personality',
    'matching',
    'promo',
    'profile-pixel',
    'ceremony',
    'icons/phase-icons',
    'icons/phase-icons/reference-grid.png',
    'icons/rating-faces/Rating Faces.png',
    'icons/rating-faces/JoyJoin Expression System v2.png',
    'icons/mood-icons/Mood Icons grid.png',
    'icons/info-labels/Info Labels grid.png',
    'icons/chemistry-badges/Chemistry Badges Grid.png',
    'icons/status-icons/status icons grid.png',
    'icons/QUALITY_STANDARD.md',
  ].map(removePath),
)

const bundledAlangAssets = new Set([
  'alang-event-card-placeholder.webp',
  'alang-result-candidate.webp',
])

// These WebPs are direct runtime imports of the Atuan arrival scene. They must
// remain in the subpackage even though the rest of the source-quality UI WebPs
// are CDN-only alternates.
const bundledAlangUiWebps = new Set([
  'flash-atuan-park-clean-v2.webp',
  'flash-atuan-character-cutout-v2.webp',
  'flash-atuan-bag-cutout-v2.webp',
])

await removeMatching(
  'lovart',
  (name) => name !== 'puzzle' && name !== 'squad' && !bundledAlangAssets.has(name),
)
await Promise.all([
  removePath('lovart/puzzle'),
  removePath('auction-icons'),
  removePath('lovart/puzzle/_contact-sheet.png'),
  removeMatching('lovart/puzzle', (name) => name.endsWith('.png')),
  // Keep only the bundled composed-hero fallback; the CDN-primary hero and the
  // card-back pattern stay CDN-only.
  removeMatching('lovart/squad', (name) => name !== 'squad-host-xiaoyue-fallback.webp'),
  removeMatching('icons/archetype', (name) => name.includes('grid')),
  removeMatching('icons/archetype', (name) => /^archetype-.*-head(@2x)?\.png$/.test(name)),
  removeMatching('icons/archetype-glyphs', (name) => name.includes('grid')),
  removeMatching('icons/archetype-glyphs', (name) => /^archetype-.*-glyph(@2x)?\.png$/.test(name)),
  removeMatching('miniscript', (name) => name.endsWith('-hero.webp')),
  removeByName(assetsDir, '.DS_Store'),
  // Keep only Alang assets referenced by runtime code. Source-quality WebP
  // alternates remain under src/, but must not consume subpackage headroom.
  removeMatchingFrom(alangAssetsDir, 'npcs', (name) => name.endsWith('.webp') || name.endsWith('.png')),
  removeMatchingFrom(alangAssetsDir, 'candidates', (name) => name.endsWith('.png') || name.endsWith('.webp')),
  removeMatchingFrom(alangAssetsDir, '', (name) => name === 'flash-city-encounter.png' || name === 'flash-city-encounter.webp'),
  removeMatchingFrom(
    alangAssetsDir,
    'ui',
    (name) => ['flash-city-ambient-bg.webp', 'flash-empty-online.webp', 'flash-empty-tasks.webp'].includes(name),
  ),
  removeMatchingFrom(
    alangAssetsDir,
    'ui',
    (name) => name.endsWith('.webp') && !bundledAlangUiWebps.has(name),
  ),
])

console.log('Cleaned CDN-only assets from dist/assets.')
