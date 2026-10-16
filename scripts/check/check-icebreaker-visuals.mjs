#!/usr/bin/env node
/**
 * Icebreaker Visual-Language Guardrail (sprint icebreaker-uiux-wave1, AC-09)
 *
 * Freezes the unified material system from
 * docs/deliberations/2026-10-16-icebreaker-uiux-audit.md §1 into CI:
 *
 *   Rule 1 — SCRIM (hard fail, no baseline):
 *     Overlay scrims only come in two tiers: 0.45 (sheet) / 0.55 (ritual).
 *     Matched as `background(-color): rgba(0,0,0,a)` or
 *     `background(-color): rgba($color-text-primary, a)` in SCSS, and
 *     inline `backgroundColor: 'rgba(0,0,0,a)'` in TS/TSX.
 *     Alphas ≤ 0.16 are the documented hairline-fill zone (L2 borders,
 *     quiet fills) and are NOT scrims. `linear-gradient` image vignettes
 *     (text legibility on thumbnails) are intentionally out of scope.
 *
 *   Rule 2 — ACCENT ALPHA (baseline ratchet):
 *     Phase-accent rgba alphas must ride the four-tier discipline
 *     {0.08 fill, 0.12 shadow, 0.32 border} (+ solid/deep handled by hex).
 *     SCSS: rgba($…accent…/…primary…, a). TS/TSX: rgba() whose RGB triple
 *     is a known phase accent (PHASE_ACCENTS registry + brand primary).
 *     Existing inventory is grandfathered via
 *     check-icebreaker-visuals-baseline.json — regenerate with
 *       node scripts/check/check-icebreaker-visuals.mjs --write-baseline
 *     Any NEW out-of-whitelist alpha fails the gate.
 *
 *   Rule 3 — OFF-SCALE FONT SIZE (baseline ratchet, AC-17):
 *     `font-size: 18|26|30rpx` literals are off the type-* ladder. Existing
 *     hits live in the baseline; new hits fail.
 *
 * Scope: apps/mini-program/src/pages/icebreaker-session/** (.{scss,ts,tsx}),
 * __tests__ excluded. Exit 0 = clean / only-known debt, 1 = new violation.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const BASELINE_PATH = join(SCRIPT_DIR, 'check-icebreaker-visuals-baseline.json')
const WRITE_BASELINE = process.argv.includes('--write-baseline')
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SCAN_ROOT = join(REPO_ROOT, 'apps/mini-program/src/pages/icebreaker-session')

const SCRIM_WHITELIST = new Set(['0.45', '0.55'])
const ACCENT_ALPHA_WHITELIST = new Set(['0.08', '0.12', '0.32'])
/**
 * Alphas at or below this are NOT scrims: they are hairline fills (L2
 * borders, quiet tints ≤0.16) or small-chrome shading (sheet drag handles
 * at ~0.2). The 2026-10-16 audit's scrim inventory lived at ≥0.30 (plus
 * the GroupMirror 0.08 detail backdrop, 实修 to 0.45 in wave 1).
 */
const SCRIM_FILL_ZONE_FLOOR = 0.25
const OFF_SCALE_FONT_RE = /font-size:\s*(18|26|30)rpx/

/** Known accent RGB triples (phaseAccents.ts registry + brand primary/deep
 *  + depth-seal palette). Keep in sync when a new phase accent lands. */
const ACCENT_RGB_TRIPLES = [
  [139, 92, 246], // #8B5CF6 primary / warmup / recap
  [124, 58, 237], // #7C3AED primary-dark
  [242, 114, 127], // #F2727F micro_challenge
  [194, 62, 51], // #C23E33 micro deep
  [110, 91, 166], // #6E5BA6 lie_detective
  [88, 71, 140], // #58478C lie deep
  [255, 107, 157], // #FF6B9D dice
  [196, 46, 104], // #C42E68 dice deep
  [240, 160, 48], // #F0A030 quip
  [156, 95, 10], // #9C5F0A quip deep
  [230, 126, 34], // #E67E22 undercover
  [166, 78, 14], // #A64E0E undercover deep
  [95, 168, 143], // #5FA88F group_mirror
  [53, 117, 92], // #35755C mirror deep
  [201, 154, 60], // #C99A3C auction
  [138, 101, 26], // #8A651A auction deep
  [91, 141, 184], // #5B8DB8 speed_friending
  [61, 110, 156], // #3D6E9C speed deep
  [194, 106, 140], // #C26A8C mini_script
  [168, 72, 110], // #A8486E miniscript deep
]

// ── File collection ─────────────────────────────────────────────────────────
function collectFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules') continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      collectFiles(full, out)
    } else if (/\.(scss|ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

// ── Rule matchers ───────────────────────────────────────────────────────────
const SCSS_SCRIM_RE =
  /background(?:-color)?:\s*rgba\(\s*(?:0\s*,\s*0\s*,\s*0|\$color-text-primary)\s*,\s*(0?\.\d+|1)\s*\)/g
const TSX_SCRIM_RE =
  /backgroundColor:\s*['"]rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*(0?\.\d+|1)\s*\)['"]/g
// Accent discipline covers phase-accent vars ($…accent…, incl. $flow-accent-*)
// and the brand $color-primary / $color-primary-dark. Neutral text/border
// colours ($color-text-primary, $color-border…) are NOT accent territory.
const SCSS_ACCENT_RE =
  /rgba\(\s*\$(?:[a-z0-9-]*accent[a-z0-9-]*|color-primary(?:-dark)?)\s*,\s*(0?\.\d+|1)\s*\)/g
const TSX_ACCENT_RES = ACCENT_RGB_TRIPLES.map(
  ([r, g, b]) =>
    new RegExp(`rgba\\(\\s*${r}\\s*,\\s*${g}\\s*,\\s*${b}\\s*,\\s*(0?\\.\\d+|1)\\s*\\)`, 'g'),
)

function scanFile(filePath) {
  const source = readFileSync(filePath, 'utf8')
  const rel = relative(REPO_ROOT, filePath)
  const isScss = filePath.endsWith('.scss')
  const scrimHits = []
  const accentHits = []
  const fontHits = []

  const scrimRe = isScss ? SCSS_SCRIM_RE : TSX_SCRIM_RE
  for (const match of source.matchAll(scrimRe)) {
    const alpha = match[1]
    if (Number(alpha) <= SCRIM_FILL_ZONE_FLOOR) continue
    if (!SCRIM_WHITELIST.has(alpha)) {
      scrimHits.push(`${rel}::${match[0]}`)
    }
  }

  if (isScss) {
    for (const match of source.matchAll(SCSS_ACCENT_RE)) {
      if (!ACCENT_ALPHA_WHITELIST.has(match[1])) {
        accentHits.push(`${rel}::${match[0]}`)
      }
    }
  } else {
    for (const re of TSX_ACCENT_RES) {
      for (const match of source.matchAll(re)) {
        if (!ACCENT_ALPHA_WHITELIST.has(match[1])) {
          accentHits.push(`${rel}::${match[0]}`)
        }
      }
    }
  }

  for (const match of source.matchAll(new RegExp(OFF_SCALE_FONT_RE.source, 'g'))) {
    fontHits.push(`${rel}::${match[0]}`)
  }

  return { scrimHits, accentHits, fontHits }
}

// ── Main ────────────────────────────────────────────────────────────────────
const files = collectFiles(SCAN_ROOT)
const allScrim = []
const allAccent = []
const allFonts = []
for (const file of files) {
  const { scrimHits, accentHits, fontHits } = scanFile(file)
  allScrim.push(...scrimHits)
  allAccent.push(...accentHits)
  allFonts.push(...fontHits)
}

if (WRITE_BASELINE) {
  const baseline = {
    $comment:
      'Grandfathered inventory for check-icebreaker-visuals.mjs (ratchet). ' +
      'Scrim violations are never baselined — fix them. Regenerate: ' +
      'node scripts/check/check-icebreaker-visuals.mjs --write-baseline',
    accentAlpha: [...new Set(allAccent)].sort(),
    offScaleFontSize: [...new Set(allFonts)].sort(),
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n')
  console.log(
    `icebreaker-visuals: baseline written — ${baseline.accentAlpha.length} accent-alpha + ` +
      `${baseline.offScaleFontSize.length} off-scale-font entr(ies) → ${relative(REPO_ROOT, BASELINE_PATH)}`,
  )
  process.exit(0)
}

const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : { accentAlpha: [], offScaleFontSize: [] }
const accentBaseline = new Set(baseline.accentAlpha ?? [])
const fontBaseline = new Set(baseline.offScaleFontSize ?? [])

let failed = false

if (allScrim.length > 0) {
  failed = true
  console.error(
    `✗ icebreaker-visuals: ${allScrim.length} scrim violation(s) outside {0.45, 0.55} ` +
      '(实修归并 — scrim debt is never baselined):',
  )
  for (const hit of allScrim) console.error(`    ${hit}`)
}

const newAccent = allAccent.filter((hit) => !accentBaseline.has(hit))
if (newAccent.length > 0) {
  failed = true
  console.error(
    `✗ icebreaker-visuals: ${newAccent.length} NEW accent-alpha violation(s) outside ` +
      '{0.08, 0.12, 0.32} (existing inventory rides the baseline ratchet):',
  )
  for (const hit of newAccent) console.error(`    ${hit}`)
}

const newFonts = allFonts.filter((hit) => !fontBaseline.has(hit))
if (newFonts.length > 0) {
  failed = true
  console.error(
    `✗ icebreaker-visuals: ${newFonts.length} NEW off-scale font-size hit(s) ` +
      '(18/26/30rpx — return to the type-* ladder, AC-17):',
  )
  for (const hit of newFonts) console.error(`    ${hit}`)
}

const burnedAccent = [...accentBaseline].filter((hit) => !allAccent.includes(hit))
const burnedFonts = [...fontBaseline].filter((hit) => !allFonts.includes(hit))
if (burnedAccent.length > 0 || burnedFonts.length > 0) {
  console.warn(
    `icebreaker-visuals: ${burnedAccent.length + burnedFonts.length} baseline entr(ies) fixed — ` +
      'shrink the baseline: node scripts/check/check-icebreaker-visuals.mjs --write-baseline',
  )
}

if (!failed) {
  console.log(
    `✓ icebreaker-visuals: scrim clean (2 tiers), ${allAccent.length} accent-alpha + ` +
      `${allFonts.length} off-scale-font hit(s) within baseline ` +
      `(${accentBaseline.size + fontBaseline.size} known)`,
  )
}

process.exit(failed ? 1 : 0)
