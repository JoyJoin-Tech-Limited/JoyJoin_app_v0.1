#!/usr/bin/env node
/**
 * CDN icon-coverage guard.
 *
 * Regression lock for the 2026-10-14 尝鲜体验 incident: the `🎯 →
 * intent-explore` mapping existed in emojiToIconMap.ts (added 2026-07-21) but
 * the bundled Lovart asset was not committed until 2026-08-05, and no CDN
 * manifest entry existed for ANY intent/category/status/info-label/mood icon.
 * On devices running a pre-2026-08-05 bundle, JoyJoinIcon fell through
 * local-404 → CDN-404 → native 🎯 emoji, so 尝鲜体验 rendered a generic dart
 * target while its six siblings showed Lovart iconography.
 *
 * Guarantees enforced here:
 *   1. Every (tier, assetKey) pair referenced by emojiToIconMap.ts has a
 *      committed bundle file under apps/mini-program/src/assets/icons/<folder>/
 *   2. Every such asset has a cdn-asset-manifest.json entry so the "Upload CDN
 *      Assets" workflow publishes the CDN fallback that JoyJoinIcon retries
 *      before falling back to emoji (JoyJoinIcon.tsx handleError).
 *
 * Add to the guardrails chain in the root package.json. Failing this gate
 * blocks any new icon mapping that ships without its asset or CDN registration.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const MAP_PATH = path.join(REPO_ROOT, 'packages/shared/src/iconSystem/emojiToIconMap.ts')
const MANIFEST_PATH = path.join(
  REPO_ROOT,
  'apps/mini-program/scripts/cdn-asset-manifest.json',
)
const ASSETS_DIR = path.join(REPO_ROOT, 'apps/mini-program/src/assets')

const ICON_FOLDER_MAP = {
  expression: 'rating-faces',
  semantic: 'info-labels',
  mood: 'mood-icons',
  chemistry: 'chemistry-badges',
  phase: 'phase-icons',
  status: 'status-icons',
  reaction: 'reaction-icons',
  category: 'category-icons',
  intent: 'intent-icons',
  reveal: 'reveal-icons',
  achievement: 'achievement-badges',
  ui: 'ui',
}

const TIER_SET = new Set(Object.keys(ICON_FOLDER_MAP))

const failures = []

function addFailure(message) {
  failures.push(message)
}

const source = fs.readFileSync(MAP_PATH, 'utf8')

const mappingRe = /'[^']*':\s*\{\s*assetKey:\s*'([^']+)',\s*tier:\s*'([^']+)'/g
const seen = new Set()
let matchCount = 0

for (const match of source.matchAll(mappingRe)) {
  const [, assetKey, tier] = match
  matchCount += 1
  if (seen.has(`${tier}::${assetKey}`)) continue
  seen.add(`${tier}::${assetKey}`)

  if (!TIER_SET.has(tier)) {
    addFailure(`Unknown icon tier '${tier}' (assetKey '${assetKey}') has no folder mapping`)
    continue
  }

  const folder = ICON_FOLDER_MAP[tier]
  const relativePath = `assets/icons/${folder}/${assetKey}.webp`
  const bundleFile = path.join(ASSETS_DIR, 'icons', folder, `${assetKey}.webp`)

  if (!fs.existsSync(bundleFile)) {
    addFailure(`Icon mapping '${assetKey}' (${tier}) has no committed bundle file: ${relativePath}`)
  }
}

// Tier fallback usage: some entries specify only tierless fallbacks; sanity
// check we actually parsed real mappings.
if (matchCount === 0) {
  addFailure('Parsed zero icon mappings from emojiToIconMap.ts — parser may be stale')
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
if (!Array.isArray(manifest.assets)) {
  addFailure('cdn-asset-manifest.json is missing its assets array')
}

const manifestPaths = new Set()
for (const asset of manifest.assets ?? []) {
  if (asset && typeof asset.localPath === 'string') manifestPaths.add(asset.localPath)
}

let missingCdnEntries = 0
for (const id of seen) {
  const [tier, assetKey] = id.split('::')
  if (!TIER_SET.has(tier)) continue
  const folder = ICON_FOLDER_MAP[tier]
  const relativePath = `assets/icons/${folder}/${assetKey}.webp`
  if (!manifestPaths.has(relativePath)) {
    missingCdnEntries += 1
    addFailure(
      `Icon '${assetKey}' (${tier}) is not registered in cdn-asset-manifest.json (${relativePath}); ` +
        'the CDN retry fallback in JoyJoinIcon would 404',
    )
  }
}

if (failures.length > 0) {
  console.error('❌ CDN icon coverage guard failed:')
  for (const failure of failures) console.error(`   - ${failure}`)
  console.error('')
  console.error('   Fix by committing the missing webp under apps/mini-program/src/assets')
  console.error('   and/or adding a { localPath, cdnPath } entry to')
  console.error('   apps/mini-program/scripts/cdn-asset-manifest.json, then running the')
  console.error('   "Upload CDN Assets" workflow.')
  process.exit(1)
}

console.log(
  `✅ CDN icon coverage guard passed: ${matchCount} mappings checked, ` +
    `${seen.size} unique (tier, assetKey) pairs all bundled + CDN-registered`,
)
