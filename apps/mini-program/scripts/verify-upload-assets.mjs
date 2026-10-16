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
 * 2026-10-15 hardening — the CRITICAL_ASSETS list below only covers assets
 * somebody remembered to list, which is how a new asset directory can ship
 * unverified. The gate now also classifies EVERY asset the build produced: each
 * dist asset must be either include-covered (ships on purpose) or
 * ignore-matched (excluded on purpose, and only if it is in
 * INTENTIONALLY_EXCLUDED). That closes the hand-maintained-list gap without
 * guessing at WeChat's internal packaging, which matters because the two
 * available readings disagree: miniprogram-ci@2.1.31 computes
 * `isIgnoredByRules = !isFileIncluded && isFileIgnored` (include overrides
 * ignore, not an allow-list), while the runbook has treated include as the
 * upload allow-list since the 2026-08-04 and 2026-08-17 incidents. Requiring an
 * explicit decision per asset is correct under either reading, and the fix for
 * a failure is one line in project.config.json.
 *
 * Run AFTER `taro build` + `clean:cdn-assets` (wired into build:weapp).
 * Exit 1 if any critical asset is missing from dist or any dist asset is
 * unclassified.
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
  // Gathering-room scene (2026-08-17 incident). Subpackage-local since
  // 2026-10-15: the composites moved out of the main package after WeChat
  // rejected the upload (errcode 80200, main package source size 2064KB).
  'pages/gathering-room/assets/room-composite-v2.webp',
  // Personality-test intro tease icons + slot spritesheet (2026-09-07 incident:
  // the 12-icon tease row rendered as empty circles on device)
  'pages/onboarding/assets/archetypes/archetype-spritesheet.webp',
  'pages/onboarding/assets/archetypes/archetype-corgi.webp',
  'pages/onboarding/assets/archetypes/archetype-rooster.webp',
  'pages/onboarding/assets/archetypes/archetype-hamster_praise.webp',
  'pages/onboarding/assets/archetypes/archetype-fox.webp',
  'pages/onboarding/assets/archetypes/archetype-dolphin_calm.webp',
  'pages/onboarding/assets/archetypes/archetype-spider.webp',
  'pages/onboarding/assets/archetypes/archetype-koala.webp',
  'pages/onboarding/assets/archetypes/archetype-octopus.webp',
  'pages/onboarding/assets/archetypes/archetype-owl.webp',
  'pages/onboarding/assets/archetypes/archetype-elephant.webp',
  'pages/onboarding/assets/archetypes/archetype-turtle.webp',
  'pages/onboarding/assets/archetypes/archetype-cat.webp',
  // Profile-review first-run surfaces (2026-09-07): useCdnFirstSrc local
  // fallbacks for the welcome gift card + invite-teaser banner.
  'assets/lovart/gift-card/coupon.webp',
  'assets/lovart/profile-review/invite-teaser.webp',
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
const includeRules = projectConfig.packOptions?.include ?? []

/**
 * Dist assets the upload deliberately does not carry. Keep this list tiny and
 * justified: each entry is a file the build produced that no surface needs in
 * the package. The two PNG masters below are superseded by their .webp twins
 * and are dropped by ignore rule `pages/pool-registration/assets/ceremony/.*\.png$`.
 */
const INTENTIONALLY_EXCLUDED = new Set([
  'pages/pool-registration/assets/ceremony/lovart-pool-registration-hero-dining-20260702-v2.png',
  'pages/pool-registration/assets/ceremony/lovart-pool-registration-hero-drinks-20260702-v2.png',
  // Phase-icons PNG fallbacks (AC-12): webp ships inside the icebreaker
  // subpackage; the 6 PNG twins + the reference grid stay src-only for the
  // CDN upload pipeline, dropped here by ignore rule
  // `pages/icebreaker-session/assets/phase-icons/.*\.png$`.
  'pages/icebreaker-session/assets/phase-icons/phase-auction.png',
  'pages/icebreaker-session/assets/phase-icons/phase-lie-detective.png',
  'pages/icebreaker-session/assets/phase-icons/phase-mini-script.png',
  'pages/icebreaker-session/assets/phase-icons/phase-personality-dice.png',
  'pages/icebreaker-session/assets/phase-icons/phase-quip-battle.png',
  'pages/icebreaker-session/assets/phase-icons/phase-topic-card.png',
  'pages/icebreaker-session/assets/phase-icons/reference-grid.png',
])

/** Asset kinds that ride the upload, and therefore need an explicit decision. */
const PACKAGE_ASSET_PATTERN = /\.(?:webp|png|jpe?g|gif|svg|woff2?|mp3|wav)$/i

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath]
  })
}

if (!fs.existsSync(DIST)) {
  console.error('FAIL: dist/ does not exist — run taro build first.')
  process.exit(1)
}

let failed = false

// 1) Known-critical assets. This is the only check that can see a file MISSING
//    from dist, i.e. the copy-rule / clean-cdn-assets class that caused every
//    documented "blank on device" incident.
for (const asset of CRITICAL_ASSETS) {
  if (!fs.existsSync(path.join(DIST, asset))) {
    console.error(`FAIL missing from dist: ${asset}`)
    console.error('  → check the copy rule in config/index.ts and clean-cdn-assets.mjs exemptions')
    failed = true
  }
}

// 2) Catch-all classification of everything the build actually produced.
const distAssets = listFiles(DIST)
  .map((filePath) => path.relative(DIST, filePath).replace(/\\/g, '/'))
  .filter((relativePath) => PACKAGE_ASSET_PATTERN.test(relativePath))

for (const asset of distAssets) {
  const lowered = asset.toLowerCase()
  const ignoreHit = ignoreRules.find((rule) => doRule(lowered, rule))
  if (ignoreHit) {
    if (!INTENTIONALLY_EXCLUDED.has(asset)) {
      console.error(`FAIL ignore-matched: ${asset} (rule: ${ignoreHit.type} ${ignoreHit.value})`)
      console.error('  → the uploaded package would not carry this asset;')
      console.error('    narrow the ignore rule, or add the asset to INTENTIONALLY_EXCLUDED')
      failed = true
    }
    continue
  }

  const includeHit = includeRules.some((rule) => doRule(lowered, rule))
  if (!includeHit) {
    console.error(`FAIL not include-covered: ${asset}`)
    console.error(
      '  → add a packOptions.include pattern for it in project.config.json ' +
        '(runbook: mini-program-asset-delivery.md §4.1)',
    )
    failed = true
  }
}

if (failed) {
  console.error('\nUpload-asset gate FAILED — the listed assets would be blank on device.')
  process.exit(1)
}
console.log(
  `PASS: ${CRITICAL_ASSETS.length} critical bundled assets present in dist, ` +
    `${distAssets.length} dist assets classified upload-safe.`,
)
