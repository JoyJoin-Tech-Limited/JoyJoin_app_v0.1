#!/usr/bin/env node
/**
 * Generate CDN manifest entries for bundled interest illustrations.
 *
 * Reads the interest asset files from src/assets/interests/ and adds
 * entries to cdn-asset-manifest.json mapping them to /images/interests/{id}.webp.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MANIFEST_PATH = path.join(__dirname, 'cdn-asset-manifest.json')
const INTERESTS_DIR = path.join(__dirname, '..', 'src', 'assets', 'interests')

function main() {
  if (!fs.existsSync(INTERESTS_DIR)) {
    console.error(`❌ Interest assets directory not found: ${INTERESTS_DIR}`)
    process.exit(1)
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))

  // Collect existing interest entries to avoid duplicates
  const existingCdnPaths = new Set(manifest.assets.map((a) => a.cdnPath))

  const files = fs.readdirSync(INTERESTS_DIR)
    .filter((f) => f.endsWith('.webp') && !f.includes('@'))
    .sort()

  let added = 0
  for (const file of files) {
    const id = file.replace('.webp', '')
    const cdnPath = `images/interests/${file}`
    if (existingCdnPaths.has(cdnPath)) {
      console.log(`   ✓ ${cdnPath} already in manifest`)
      continue
    }

    manifest.assets.push({
      localPath: `assets/interests/${file}`,
      cdnPath,
    })
    added++
    console.log(`   + ${cdnPath}`)
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 4) + '\n')
  console.log(`\n✅ Added ${added} interest asset entries. Total manifest assets: ${manifest.assets.length}`)
}

main()
