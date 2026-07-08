import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const assetsDir = path.resolve(__dirname, '..', 'dist', 'assets')

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

async function removeMatching(relativeDir, predicate) {
  const dir = path.join(assetsDir, relativeDir)
  if (!(await exists(dir))) return

  const entries = await fs.readdir(dir, { withFileTypes: true })
  await Promise.all(
    entries
      .filter((entry) => predicate(entry.name, entry))
      .map((entry) => fs.rm(path.join(dir, entry.name), { force: true, recursive: true })),
  )
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

await removeMatching('lovart', (name) => name !== 'puzzle')
await Promise.all([
  removePath('lovart/puzzle/_contact-sheet.png'),
  removeMatching('lovart/puzzle', (name) => name.endsWith('.png')),
  removeMatching('icons/archetype', (name) => name.includes('grid')),
  removeMatching('icons/archetype', (name) => /^archetype-.*-head(@2x)?\.png$/.test(name)),
  removeMatching('icons/archetype-glyphs', (name) => name.includes('grid')),
  removeMatching('icons/archetype-glyphs', (name) => /^archetype-.*-glyph(@2x)?\.png$/.test(name)),
  removeMatching('miniscript', (name) => name.endsWith('-hero.webp')),
  removeByName(assetsDir, '.DS_Store'),
])

console.log('Cleaned CDN-only assets from dist/assets.')
