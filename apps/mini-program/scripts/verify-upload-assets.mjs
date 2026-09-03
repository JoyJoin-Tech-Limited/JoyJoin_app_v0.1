#!/usr/bin/env node
/**
 * Upload-package asset presence gate (2026-09-01, landing-hero saga).
 *
 * Root-cause finding from reading miniprogram-ci@2.1.31 source:
 * `setting.ignoreUploadUnusedFiles` only ever filters CODE files
 * (json/wxml/wxss/js/wxs/ts/less/sass/scss — see
 * node_modules/miniprogram-ci/dist/utils/packOptionsHelper.js, `isCodeFile`).
 * Static images/fonts are NEVER dropped by the unused-file filter, and
 * packOptions.include merely overrides packOptions.ignore. Therefore:
 *
 *   an asset is in the uploaded package  <=>  it exists in dist/
 *   AND is not matched by packOptions.ignore.
 *
 * Every past "asset blank on device" incident (2026-08-04 Flash artwork,
 * 2026-08-17 gathering-room art, 2026-09-01 landing hero) traced to the
 * file missing from dist/ (copy rule or clean:cdn-assets), not the upload
 * filter. This gate asserts the contract directly, locally, before upload.
 *
 * Run AFTER `taro build` + `clean:cdn-assets` (wired into build:weapp).
 * Exit 1 if any critical asset is missing from dist or ignore-matched.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')

/** Assets whose absence blanks a shipped surface (each = a past incident). */
const CRITICAL_ASSETS = [
  // Landing hero chain (2026-09-01)
  'assets/lovart/landing/hero-box-xiaoyue-dusk.webp',
  'assets/lovart/landing/hero-box-xiaoyue-dusk-lqip.webp',
  'assets/xiaoyue-expressions/xiaoyue-home-welcome.webp',
  // Landing dusk city backdrop LQIP (2026-09-03) — the bundled placeholder
  // under the CDN-only backdrop master (the master itself must NOT be in
  // the package; clean-cdn-assets strips it).
  'assets/lovart/landing/landing-backdrop-city-dusk-lqip.webp',
  // Landing mechanism strip heads (bundled, rendered on the same stage)
  'assets/icons/archetype-grid/archetype-corgi-grid.webp',
  'assets/icons/archetype-grid/archetype-fox-grid.webp',
  'assets/icons/archetype-grid/archetype-rooster-grid.webp',
  'assets/icons/archetype-grid/archetype-koala-grid.webp',
  'assets/icons/archetype-grid/archetype-cat-grid.webp',
  'assets/icons/archetype-grid/archetype-dolphin_calm-grid.webp',
  // Landing bubble constellation heads (variant B, 2026-09-03) — bundled
  // grid heads reused on the landing stage.
  'assets/icons/archetype-grid/archetype-owl-grid.webp',
  'assets/icons/archetype-grid/archetype-elephant-grid.webp',
  'assets/icons/archetype-grid/archetype-octopus-grid.webp',
  'assets/icons/archetype-grid/archetype-turtle-grid.webp',
  'assets/icons/archetype-grid/archetype-hamster_praise-grid.webp',
  // Gathering-room scene (2026-08-17 incident)
  'assets/gathering-room/room-composite-v2.webp',
  // Tab bar (upload rejects missing iconPath with 800059)
  'assets/joyjoin-logo-tab.png',
]

/** Subset of miniprogram-ci filerules.js doRule — enough for our ignore list. */
function doRule(relPath, rule) {
  if (!rule) return false
  const value = String(rule.value ?? '').toLowerCase()
  const name = relPath.slice(relPath.lastIndexOf('/') + 1)
  const noLead = relPath.startsWith('/') ? relPath.slice(1) : relPath
  switch (rule.type) {
    case 'prefix':
      return name.startsWith(value)
    case 'suffix':
      return name.endsWith(value)
    case 'folder': {
      const folder = (value.startsWith('/') ? value.slice(1) : value).replace(/\/$/, '')
      return noLead.startsWith(folder)
    }
    case 'file':
      return noLead === (value.startsWith('/') ? value.slice(1) : value)
    case 'regexp':
      try {
        return new RegExp(value, 'igm').test(relPath) || new RegExp(value, 'igm').test(noLead)
      } catch {
        return false
      }
    default:
      return false
  }
}

const projectConfig = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'project.config.json'), 'utf8'),
)
const ignoreRules = projectConfig.packOptions?.ignore ?? []

if (!fs.existsSync(DIST)) {
  console.error('FAIL: dist/ does not exist — run taro build first.')
  process.exit(1)
}

let failed = false
for (const asset of CRITICAL_ASSETS) {
  const distPath = path.join(DIST, asset)
  if (!fs.existsSync(distPath)) {
    console.error(`FAIL missing from dist: ${asset}`)
    console.error('  → check the copy rule in config/index.ts and clean-cdn-assets.mjs exemptions')
    failed = true
    continue
  }
  const rel = asset.toLowerCase()
  const hit = ignoreRules.find((rule) => doRule(rel, rule))
  if (hit) {
    console.error(`FAIL ignore-matched: ${asset} (rule: ${hit.type} ${hit.value})`)
    failed = true
  }
}

if (failed) {
  console.error('\nUpload-asset gate FAILED — the listed assets would be blank on device.')
  process.exit(1)
}
console.log(`PASS: ${CRITICAL_ASSETS.length} critical bundled assets present in dist and upload-safe.`)
