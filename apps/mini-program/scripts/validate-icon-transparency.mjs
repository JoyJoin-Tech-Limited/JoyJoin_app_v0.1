#!/usr/bin/env node
/**
 * Build-time validator for bundled icon transparency.
 *
 * Icons that float on variable backgrounds (category, intent, info labels, UI)
 * MUST have transparent backgrounds. Opaque icons look like stickers/emoji
 * when placed on cards, sheets, or coloured surfaces.
 *
 * Run automatically before build:
 *   npm run validate:icon-transparency
 *
 * Exit code 0 = all required icons are transparent
 * Exit code 1 = opaque icons found (breaks build)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const ICONS_DIR = path.join(ROOT, 'src', 'assets', 'icons')

// Tiers whose icons are placed on variable/coloured backgrounds and must be
// transparent. Keep in sync with JoyJoinIcon's local bundled tiers.
const TRANSPARENT_TIERS = new Set([
  'category-icons',
  'intent-icons',
  'info-labels',
  'ui',
  'chemistry-badges',
  'reaction-icons',
  'reveal-icons',
  'achievement-badges',
  'archetype',
  'phase-icons',
  'status-icons',
])

// Specific files that are allowed to be opaque within otherwise-transparent
// tiers (e.g. circular badge-style icons with solid coloured backgrounds).
const OPAQUE_EXCEPTIONS = new Set([
  'status-icons/status-crown.webp',
  'status-icons/status-waiting.webp',
])

async function isOpaque(filePath) {
  const { hasAlpha } = await sharp(filePath).metadata()
  if (!hasAlpha) return true

  // hasAlpha=true only means the format supports alpha; verify at least one
  // pixel is actually transparent (< 255) so a white matte doesn't slip through.
  const { data } = await sharp(filePath)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true })

  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return false
  }
  return true
}

async function findDensityViolations() {
  const violations = []

  // Scan ALL icon subdirectories, not just TRANSPARENT_TIERS.
  // Density violations can occur in any bundled icon tier (mood-icons, rating-faces, etc.).
  for (const dir of fs.readdirSync(ICONS_DIR)) {
    const dirPath = path.join(ICONS_DIR, dir)
    if (!fs.statSync(dirPath).isDirectory()) continue

    const files = fs.readdirSync(dirPath).filter((name) => name.endsWith('.webp'))

    for (const file of files) {
      if (file.includes('@')) {
        violations.push(path.posix.join(dir, file))
      }
    }
  }

  return violations
}

async function main() {
  const failures = []

  const densityViolations = await findDensityViolations()
  if (densityViolations.length > 0) {
    console.error('\n❌ Density-suffixed icon files found (bundled icons must use a single bare .webp):')
    for (const f of densityViolations) {
      console.error(`   - ${f}`)
    }
    console.error(
      '\nFix: remove @2x/@3x variants and ship one high-resolution bare .webp per asset.\n' +
        'WeChat auto-resolves density suffixes; mixed naming causes 404 fallbacks to emoji.\n',
    )
    process.exit(1)
  }

  for (const tier of TRANSPARENT_TIERS) {
    const tierDir = path.join(ICONS_DIR, tier)
    if (!fs.existsSync(tierDir)) continue

    const files = fs
      .readdirSync(tierDir)
      .filter((name) => name.endsWith('.webp'))
      .sort()

    for (const file of files) {
      const relative = path.posix.join(tier, file)
      if (OPAQUE_EXCEPTIONS.has(relative)) continue

      const filePath = path.join(tierDir, file)
      const opaque = await isOpaque(filePath)
      if (opaque) {
        failures.push(relative)
      }
    }
  }

  if (failures.length > 0) {
    console.error('\n❌ Opaque bundled icons found (must have transparent backgrounds):')
    for (const f of failures) {
      console.error(`   - ${f}`)
    }
    console.error(
      '\nFix: re-export the source asset with a transparent background, or add the\n' +
        'file to OPAQUE_EXCEPTIONS in scripts/validate-icon-transparency.mjs if it is\n' +
        'intentionally opaque.\n',
    )
    process.exit(1)
  }

  console.log('✅ All required bundled icons have transparent backgrounds.')
}

main().catch((err) => {
  console.error('Validation failed with error:', err)
  process.exit(1)
})
