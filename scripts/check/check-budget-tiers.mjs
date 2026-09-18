#!/usr/bin/env node
/**
 * Budget-tier vocabulary ratchet — hardcoded budget-tier literals must never
 * regrow outside the canonical registry (`packages/shared/src/budgetTiers.ts`).
 *
 * Why: budget-tier architecture spec (docs/design/budget-tier-architecture-spec-20260916.md)
 * §8.2, decision Q9 — the check is STRICT: it covers test fixtures and
 * demo/scripts, with the pre-existing occurrences grandfathered once into a
 * per-entry-reviewed baseline. Modelled on the `check-class-coverage.mjs`
 * ratchet (same-directory baseline JSON + `--write-baseline` + fail only on
 * NEW occurrences).
 *
 * Two literal families are detected:
 *   1. Canonical tier ids (`dining_*` / `drinks_*`, e.g. `dining_150_200`,
 *      `drinks_80_below`). These are unambiguous — always flagged.
 *   2. Legacy labels (`150以下`, `150-200`, `200-300`, `300-500`, `80以下`,
 *      `80-150`) plus the unmappable blind-box label `100-200` (decision B3
 *      pending — new uses must not silently regrow while unmappable).
 *
 * False-positive guard for legacy labels: a numeric range like `200-300` can
 * appear in non-budget contexts, so a legacy label is ONLY flagged when a
 * budget-context token appears near the occurrence. Context tokens: any
 * identifier containing `budget` (case-insensitive — covers budget,
 * budgetRange, barBudgetRange, budgetCategories, budgetTier,
 * budget_categories, ...) and `price_range` / `priceRange` (the legacy venue
 * column family). Chinese prose tokens (预算 / 价位) were considered and
 * deliberately EXCLUDED: they match marketing/copy prose far away from
 * code-level vocabulary and produced only noise in the trial scan. A bare
 * numeric range with no budget context is never flagged — a small,
 * documented miss is preferred over false positives.
 *
 * Proximity rule (context is file-type dependent, by design):
 *   - Code (.ts/.tsx/.js/...): a context token must appear within
 *     ±CONTEXT_WINDOW_LINES lines of the label. Line locality is real in
 *     code (multi-line option arrays, fixture blocks).
 *   - SQL (.sql): context is FILE-LEVEL — if the file references any budget
 *     token at all, every legacy label in it is flagged. A single INSERT
 *     statement spans dozens of lines (column list on line 11, value rows
 *     50+ lines later), so line-proximity is meaningless there; and any SQL
 *     file touching budget/price_range columns is definitionally in the
 *     budget domain.
 *
 * Scan scope: `apps/` and `packages/` source (ts/tsx/mts/cts/js/jsx/mjs/cjs/
 * sql). Excluded: node_modules, dist, coverage, dot-directories, and the
 * top-level `scripts/` + `docs/` trees (this guard's own home; prose docs may
 * discuss the vocabulary). `.json`/`.md` payloads (seed data, READMEs) are
 * data/prose, not code, and are out of scope.
 *
 * Baseline: `budget-tiers-baseline.json` (same directory). Keyed by
 * (file, literal) with an occurrence count. The gate FAILS when:
 *   - a (file, literal) pair appears that is not in the baseline, or
 *   - the occurrence count of a baseline pair INCREASES (regrowth at a
 *     grandfathered site), or
 *   - a baseline entry is missing a per-entry justification (baseline
 *     hygiene — every entry must be individually reviewed, per spec §8.2).
 * Shrinking counts / disappeared entries are reported as burn-down (never a
 * failure); regenerate with:
 *   node scripts/check/check-budget-tiers.mjs --write-baseline
 * `--write-baseline` preserves existing justifications for surviving keys and
 * inserts new keys with an empty justification, then exits 1 until every
 * entry is justified.
 *
 * Exit code: 0 = clean (no new occurrences, baseline fully justified),
 *            1 = new occurrences / regrowth / unjustified baseline entries.
 */

import { existsSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const BASELINE_PATH = join(SCRIPT_DIR, 'budget-tiers-baseline.json')
const WRITE_BASELINE = process.argv.includes('--write-baseline')

// fileURLToPath is required on Windows: URL.pathname returns `/D:/...`, which
// path.join interprets as a relative segment and produces `D:\D:\...`.
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SCAN_ROOTS = [join(REPO_ROOT, 'apps'), join(REPO_ROOT, 'packages')]

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.sql'])
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', 'build'])

/** Canonical tier-id family — unambiguous, always flagged. */
export const CANONICAL_TIER_ID_RE = /\b(?:dining|drinks)_(?:\d+_below|\d+_\d+)\b/g

/**
 * Legacy labels + the unmappable blind-box label. Dash variants (`-`, `–`,
 * `—`, optional surrounding spaces) are normalized back to the canonical
 * ASCII form so the baseline key stays stable.
 */
const LEGACY_LABELS = ['150以下', '150-200', '200-300', '300-500', '80以下', '80-150', '100-200']

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const LEGACY_LABEL_RES = LEGACY_LABELS.map((label) => {
  // (?<!\d) / (?!\d) guards stop substring matches inside larger numbers
  // (e.g. `1300-5000` must not match `300-500`).
  const body = escapeRegExp(label).replace(/-/g, '\\s*[-–—]\\s*')
  const suffix = /\d$/.test(label) ? '(?!\\d)' : ''
  return { label, re: new RegExp(`(?<!\\d)${body}${suffix}`, 'g') }
})

/**
 * Budget-context tokens: any `budget*` identifier (case-insensitive) or the
 * legacy venue `price_range` / `priceRange` column family. Bare `price` is
 * deliberately NOT a token — too generic (any priced entity near a numeric
 * range would false-positive).
 */
export const BUDGET_CONTEXT_RE = /budget|price_?range/i

/** A legacy label is flagged only when a context token is within this many lines. */
export const CONTEXT_WINDOW_LINES = 6

/**
 * Find budget-tier literal occurrences in one source file's text.
 * Returns [{ literal, kind: 'canonical-id' | 'legacy-label', line }].
 * Pure and exported for the heuristic tests in check-guardrails.test.mjs.
 *
 * `options.fileLevelContext` (SQL mode): one budget-context token anywhere in
 * the file puts every legacy label in context (see header for rationale).
 */
export function findBudgetTierLiteralOccurrences(sourceText, options = {}) {
  const { fileLevelContext = false } = options
  const lines = sourceText.split('\n')
  const contextLines = lines.map((line) => BUDGET_CONTEXT_RE.test(line))
  const fileHasContext = contextLines.some(Boolean)
  const occurrences = []

  lines.forEach((line, index) => {
    // matchAll internally clones the regex, so module-level /g regexes are
    // safe to reuse without lastIndex bookkeeping.
    for (const match of line.matchAll(CANONICAL_TIER_ID_RE)) {
      occurrences.push({ literal: match[0], kind: 'canonical-id', line: index + 1 })
    }
    for (const { label, re } of LEGACY_LABEL_RES) {
      let matched = false
      for (const _ of line.matchAll(re)) {
        matched = true
        break
      }
      if (matched && (fileLevelContext ? fileHasContext : hasNearbyContext(contextLines, index))) {
        occurrences.push({ literal: label, kind: 'legacy-label', line: index + 1 })
      }
    }
  })

  return occurrences
}

function hasNearbyContext(contextLines, index) {
  const from = Math.max(0, index - CONTEXT_WINDOW_LINES)
  const to = Math.min(contextLines.length - 1, index + CONTEXT_WINDOW_LINES)
  for (let i = from; i <= to; i++) {
    if (contextLines[i]) return true
  }
  return false
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue
      walk(full, out)
    } else if (SCAN_EXTENSIONS.has(extname(entry))) {
      out.push(full)
    }
  }
  return out
}

/** Aggregate occurrences into a Map keyed `${file}::${literal}` → { count, kind, lines }. */
function collectOccurrences() {
  const byKey = new Map()
  for (const root of SCAN_ROOTS) {
    if (!existsSync(root)) continue
    for (const file of walk(root)) {
      const rel = relative(REPO_ROOT, file)
      const sourceText = readFileSync(file, 'utf8')
      // SQL statements span dozens of lines — context is file-level there.
      const fileLevelContext = extname(file) === '.sql'
      for (const occ of findBudgetTierLiteralOccurrences(sourceText, { fileLevelContext })) {
        const key = `${rel}::${occ.literal}`
        const existing = byKey.get(key)
        if (existing) {
          existing.count += 1
          existing.lines.push(occ.line)
        } else {
          byKey.set(key, { count: 1, kind: occ.kind, lines: [occ.line] })
        }
      }
    }
  }
  return byKey
}

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Map()
  const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const entries = Array.isArray(parsed) ? parsed : parsed.entries ?? []
  const map = new Map()
  for (const entry of entries) {
    map.set(`${entry.file}::${entry.literal}`, entry)
  }
  return map
}

function main() {
  const occurrences = collectOccurrences()
  const baseline = readBaseline()

  console.log(
    `budget-tiers: ${occurrences.size} (file, literal) occurrence group(s) across apps/ + packages/, ` +
      `${baseline.size} grandfathered baseline entr${baseline.size === 1 ? 'y' : 'ies'}`,
  )

  if (WRITE_BASELINE) {
    const merged = [...occurrences.keys()]
      .sort()
      .map((key) => {
        const [file, literal] = key.split('::')
        const prior = baseline.get(key)
        return {
          file,
          literal,
          count: occurrences.get(key).count,
          justification: prior?.justification ?? '',
        }
      })
    writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify(
        {
          $comment:
            'Grandfathered budget-tier literal occurrences (spec §8.2, decision Q9). Every entry was reviewed per-entry; entries are expected to be BURNED DOWN, not grown. Regenerate counts with: node scripts/check/check-budget-tiers.mjs --write-baseline (preserves justifications).',
          entries: merged,
        },
        null,
        2,
      )}\n`,
    )
    const unjustified = merged.filter((entry) => !entry.justification || !entry.justification.trim())
    console.log(
      `budget-tiers: baseline written — ${merged.length} entr${merged.length === 1 ? 'y' : 'ies'} → ${relative(REPO_ROOT, BASELINE_PATH)}`,
    )
    if (unjustified.length > 0) {
      console.error(
        `\n✗ budget-tiers: ${unjustified.length} baseline entr${unjustified.length === 1 ? 'y has' : 'ies have'} NO justification.\n` +
          '  Per spec §8.2 every baseline entry must be reviewed per-entry — fill in the\n' +
          '  `justification` field for each entry before this gate can pass.',
      )
      for (const entry of unjustified) console.error(`  ${entry.file} :: ${entry.literal}`)
      process.exitCode = 1
    }
    return
  }

  // Baseline hygiene: every entry must carry a per-entry justification.
  const unjustified = [...baseline.values()].filter(
    (entry) => !entry.justification || !entry.justification.trim(),
  )

  const newOccurrences = []
  for (const [key, occ] of occurrences) {
    const prior = baseline.get(key)
    if (!prior) {
      newOccurrences.push({ key, ...occ, reason: 'new occurrence outside the baseline' })
    } else if (occ.count > prior.count) {
      newOccurrences.push({
        key,
        ...occ,
        reason: `count grew ${prior.count} → ${occ.count} (regrowth at a grandfathered site)`,
      })
    }
  }

  const burnedDown = [...baseline.keys()].filter((key) => {
    const occ = occurrences.get(key)
    return !occ || occ.count < baseline.get(key).count
  })
  if (burnedDown.length > 0) {
    console.log(
      `budget-tiers: ${burnedDown.length} baseline entr${burnedDown.length === 1 ? 'y' : 'ies'} shrank or disappeared — ` +
        'shrink the baseline: node scripts/check/check-budget-tiers.mjs --write-baseline',
    )
  }

  if (unjustified.length === 0 && newOccurrences.length === 0) {
    const fixed = baseline.size - occurrences.size
    console.log(
      `✓ budget-tiers: no new hardcoded budget-tier literals ` +
        `(${occurrences.size} known in baseline, ${Math.max(fixed, 0)} burned down so far)`,
    )
    return
  }

  if (unjustified.length > 0) {
    console.error(
      `\n✗ budget-tiers: ${unjustified.length} baseline entr${unjustified.length === 1 ? 'y is' : 'ies are'} missing a per-entry justification ` +
        `(see ${relative(REPO_ROOT, BASELINE_PATH)}).`,
    )
    for (const entry of unjustified) console.error(`  ${entry.file} :: ${entry.literal}`)
  }

  if (newOccurrences.length > 0) {
    console.error(
      `\n✗ budget-tiers: ${newOccurrences.length} NEW hardcoded budget-tier literal occurrence group(s) outside the registry:\n`,
    )
    for (const finding of newOccurrences) {
      const [file, literal] = finding.key.split('::')
      console.error(`  ${file} :: ${literal}  (${finding.kind}; ${finding.reason})`)
      console.error(`    line(s): ${finding.lines.join(', ')}`)
    }
    console.error(
      '\nBudget vocabulary must come from the canonical registry (packages/shared/src/budgetTiers.ts).\n' +
        'Do NOT bulk-baseline: if an occurrence is truly legitimate legacy, add a per-entry\n' +
        'justified baseline entry via --write-baseline and review it (spec §8.2, decision Q9).',
    )
  }
  process.exitCode = 1
}

// Run main only when executed directly (the heuristic tests import the pure
// finders above without triggering a repo scan).
const invokedAsScript =
  process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedAsScript) {
  try {
    main()
  } catch (error) {
    console.error('budget-tiers: guard failed to run:', error)
    process.exitCode = 1
  }
}
