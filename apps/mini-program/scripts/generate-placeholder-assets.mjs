#!/usr/bin/env node
/**
 * Generate placeholder images for missing assets tracked in
 * cdn-asset-manifest.json pendingAssets.
 *
 * Placeholders are solid-color images with the filename labeled,
 * sized appropriately per asset category. They make the app
 * functional while the design team creates real assets.
 *
 * Usage:
 *   node scripts/generate-placeholder-assets.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(ROOT, 'src')
const MANIFEST_PATH = path.join(__dirname, 'cdn-asset-manifest.json')

// Use sharp (already installed) to avoid ImageMagick font issues
let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('❌ sharp is required. Install it: npm install sharp --workspace=mini-program')
  process.exit(1)
}

function readManifest() {
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8')
  return JSON.parse(raw)
}

async function generatePlaceholder(outputPath, width, height, label, color) {
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Parse hex color to RGB
  const hex = color.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)

  // Create a solid color image with a subtle diagonal stripe pattern
  // so it's obviously a placeholder
  const stripeWidth = Math.max(4, Math.min(width, height) / 20)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${color}"/>
    <defs>
      <pattern id="stripe" width="${stripeWidth * 2}" height="${stripeWidth * 2}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="${stripeWidth}" height="${stripeWidth * 2}" fill="rgba(0,0,0,0.06)"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#stripe)"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
      font-family="sans-serif" font-size="${Math.max(10, Math.min(width, height) / 10)}"
      fill="rgba(0,0,0,0.25)">PLACEHOLDER</text>
  </svg>`

  const isWebp = outputPath.endsWith('.webp')
  const pipeline = sharp(Buffer.from(svg))
    .resize(width, height, { fit: 'fill' })

  if (isWebp) {
    await pipeline.webp({ quality: 80 }).toFile(outputPath)
  } else {
    await pipeline.png().toFile(outputPath)
  }
}

function resolveSize(assetPath) {
  const parts = assetPath.split('/')
  const dir = parts[1]
  const subDir = parts[2] || ''
  const file = parts[parts.length - 1]

  // Phase icons: 240x240px source (displayed at 40-120rpx)
  if (dir === 'icons' && file.startsWith('phase-')) return [240, 240]
  // Mood/status/chemistry/archetype head icons: 120x120px
  if (dir === 'icons') return [120, 120]
  // Celebration frames: 600x600px
  if (dir === 'lovart' && subDir === 'icebreaker' && file.includes('celebration')) return [600, 600]
  // Coin icons: 64x64px
  if (dir === 'lovart' && subDir === 'icebreaker' && file.includes('coin')) return [64, 64]
  // Personality emojis: 128x128px
  if (dir === 'lovart' && file.includes('personality')) return [128, 128]
  // Lovart generic illustrations (empty/error): 400x400px
  if (dir === 'lovart' && file.includes('generic')) return [400, 400]
  // Lovart rewards: 400x400px
  if (dir === 'lovart' && file.includes('rewards')) return [400, 400]
  // Matching heroes: 750x500px
  if (dir === 'matching') return [750, 500]
  // Promo banners: 750x300px
  if (dir === 'promo') return [750, 300]
  // Miniscript heroes: 750x400px
  if (dir === 'miniscript') return [750, 400]
  // QR code: 400x400px
  if (dir === 'qr') return [400, 400]
  // Empty state bg: 750x400px
  if (dir === 'empty-state' && file.includes('bg')) return [750, 400]
  // Empty state illustration: 400x400px
  if (dir === 'empty-state') return [400, 400]

  return [200, 200]
}

function resolveColor(assetPath) {
  const parts = assetPath.split('/')
  const dir = parts[1]
  const subDir = parts[2] || ''
  const file = parts[parts.length - 1]

  if (dir === 'icons' && file.startsWith('phase-')) return '#DDD6FE' // purple-200
  if (dir === 'icons' && file.includes('mood')) return '#CFFAFE' // cyan-100
  if (dir === 'icons' && file.includes('status')) return '#FEF3C7' // amber-100
  if (dir === 'icons' && file.includes('chemistry')) return '#FFEDD5' // orange-100
  if (dir === 'icons' && file.includes('archetype')) return '#EDE9FE' // violet-100
  if (dir === 'lovart' && subDir === 'icebreaker' && file.includes('celebration')) return '#E0E7FF' // indigo-100
  if (dir === 'lovart' && subDir === 'icebreaker' && file.includes('coin')) return '#FEF9C3' // yellow-100
  if (dir === 'lovart' && file.includes('personality')) return '#FCE7F3' // pink-100
  if (dir === 'lovart' && file.includes('generic')) return '#E5E7EB' // gray-200
  if (dir === 'lovart' && file.includes('rewards')) return '#D1FAE5' // green-100
  if (dir === 'lovart') return '#F3F4F6' // gray-100
  if (dir === 'matching') return '#DBEAFE' // blue-100
  if (dir === 'promo') return '#FCE7F3' // pink-100
  if (dir === 'miniscript') return '#FFEDD5' // orange-100
  if (dir === 'qr') return '#FFFFFF'
  if (dir === 'empty-state') return '#FAF5FF' // purple-50

  return '#F3F4F6'
}

async function main() {
  const manifest = readManifest()
  const pending = manifest.pendingAssets || []

  if (pending.length === 0) {
    console.log('✅ No pending assets to generate.')
    process.exit(0)
  }

  console.log(`Generating ${pending.length} placeholder assets...\n`)

  let created = 0
  let skipped = 0

  for (const assetPath of pending) {
    const outputPath = path.join(SRC_DIR, assetPath)

    // Skip font files — cannot generate meaningful font placeholders
    if (assetPath.endsWith('.woff2') || assetPath.endsWith('.ttf') || assetPath.endsWith('.woff')) {
      console.log(`  ⏭️  Skipped font: ${assetPath}`)
      skipped++
      continue
    }

    if (fs.existsSync(outputPath)) {
      console.log(`  ⏭️  Already exists: ${assetPath}`)
      skipped++
      continue
    }

    const [w, h] = resolveSize(assetPath)
    const color = resolveColor(assetPath)
    const label = path.basename(assetPath, path.extname(assetPath))

    await generatePlaceholder(outputPath, w, h, label, color)
    console.log(`  ✅ ${assetPath} (${w}x${h})`)
    created++
  }

  console.log(`\n────────────────────────────────────────`)
  console.log(`Created: ${created}  |  Skipped: ${skipped}  |  Total: ${pending.length}`)
  console.log('\nNext steps:')
  console.log('  1. Run npm run validate:assets to confirm all references resolve.')
  console.log('  2. Run npm run upload:cdn-assets:dry-run to preview CDN upload.')
  console.log('  3. Replace placeholders with real assets as design delivers them.')
}

main().catch((err) => {
  console.error('\n❌ Generation failed:', err.message)
  process.exit(1)
})
