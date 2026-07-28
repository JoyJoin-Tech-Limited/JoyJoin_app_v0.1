#!/usr/bin/env node
/**
 * Class Coverage Guardrail — every BEM-style CSS class referenced in
 * mini-program TS/TSX must be backed by some stylesheet under src.
 *
 * Why: 2026-07-26 SquadTableCard shipped with ~15 class names and ZERO CSS
 * (the "giant circles" squad-unboxing regression). Type-checks and logic
 * tests can't see missing stylesheets; this guard can. It fails `npm run
 * guardrails` when a referenced class is defined nowhere.
 *
 * Scope (documented limitations):
 * - Only static BEM tokens containing `__` (the repo house style) are
 *   enforced. Dynamic template-literal classes (`foo--${state}`) are skipped
 *   — their SCSS counterparts are usually map-generated.
 * - The defined-set is built from the COMPILED CSS of every non-partial
 *   `.scss` under `apps/mini-program/src` (so SCSS nesting/interpolation is
 *   fully expanded), plus raw class extraction from `.wxss` sources.
 * - SCSS files that fail standalone compilation fall back to raw `.class`
 *   text extraction and are listed as warnings (never a pass-blocker).
 *
 * Ratchet: `class-coverage-baseline.json` (same directory) holds the legacy
 * orphans known at introduction time. The gate FAILS on any NEW orphan not
 * in the baseline, so the bug class can never come back while the backlog is
 * burned down. When you fix a baseline entry, regenerate with:
 *   node scripts/check/check-class-coverage.mjs --write-baseline
 *
 * Exit code: 0 = clean (no new orphans), 1 = new orphans found.
 */

import { execFile } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const BASELINE_PATH = join(SCRIPT_DIR, 'class-coverage-baseline.json')
const WRITE_BASELINE = process.argv.includes('--write-baseline')

// fileURLToPath is required on Windows: URL.pathname returns `/D:/...`, which
// path.join interprets as a relative segment and produces `D:\D:\...`.
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SRC_ROOT = join(REPO_ROOT, 'apps/mini-program/src')
const SASS_ENTRY = join(REPO_ROOT, 'node_modules/sass/sass.js')
const COMPILE_CONCURRENCY = 8
/** One SCSS compile can take a few hundred ms; bound hangs. */
const COMPILE_TIMEOUT_MS = 30_000

/**
 * Static BEM token: lowercase hyphenated block, optional __element and
 * --modifier suffixes. Only tokens containing `__` are enforced (house
 * style); non-BEM utility/runtime classes are out of scope by design.
 */
const BEM_CLASS_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*__[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$/

/**
 * Intentional exceptions — classes referenced in TSX but defined outside the
 * scanned stylesheet sources (runtime-injected by Taro/WeChat, or defined by
 * generated artifacts). Each entry must carry a justification comment.
 */
const ALLOWED_ORPHANS = new Set([
  // Example: 'some-runtime__class', // injected by <runtime> at run time
])

/** Directories/files never scanned for references. */
function isSkippableSource(relPath) {
  return (
    relPath.includes('__tests__') ||
    relPath.includes('.test.') ||
    relPath.includes('.spec.') ||
    relPath.endsWith('.d.ts')
  )
}

function walk(dir, predicate, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue
      walk(full, predicate, out)
    } else if (predicate(full)) {
      out.push(full)
    }
  }
  return out
}

/** Extract referenced class tokens from string/template literals in TS/TSX. */
function extractReferencedClasses(sourceText) {
  const found = new Set()
  const LITERAL_RE = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g
  let match
  while ((match = LITERAL_RE.exec(sourceText)) !== null) {
    const raw = match[1] ?? match[2] ?? match[3] ?? ''
    // Dynamic template segments (`foo--${state}`) can't be checked statically;
    // only fully-static fragments are candidates.
    const fragments = raw.includes('${') ? raw.split(/\$\{[^}]*\}/) : [raw]
    for (const fragment of fragments) {
      for (const token of fragment.split(/\s+/)) {
        if (token.includes('__') && BEM_CLASS_RE.test(token)) found.add(token)
      }
    }
  }
  return found
}

/** Extract defined class names from (compiled) CSS text. */
function extractDefinedClasses(cssText, into) {
  const CLASS_DEF_RE = /\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g
  let match
  while ((match = CLASS_DEF_RE.exec(cssText)) !== null) into.add(match[1])
}

async function compileScss(file) {
  const { stdout } = await execFileAsync(
    process.execPath,
    [SASS_ENTRY, '--no-source-map', '--quiet', file],
    { timeout: COMPILE_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 },
  )
  return stdout
}

async function main() {
  const tsSources = walk(SRC_ROOT, (f) => (f.endsWith('.tsx') || f.endsWith('.ts')) && !isSkippableSource(relative(SRC_ROOT, f)))
  const scssEntries = walk(SRC_ROOT, (f) => f.endsWith('.scss') && !f.split('/').pop().startsWith('_'))
  const wxssEntries = walk(SRC_ROOT, (f) => f.endsWith('.wxss'))

  // 1. Referenced classes (token → referencing files, for actionable output).
  const references = new Map()
  for (const file of tsSources) {
    const rel = relative(REPO_ROOT, file)
    for (const token of extractReferencedClasses(readFileSync(file, 'utf8'))) {
      if (!references.has(token)) references.set(token, new Set())
      references.get(token).add(rel)
    }
  }

  // 2. Defined classes from compiled SCSS + raw WXSS.
  const defined = new Set()
  const compileFallbacks = []
  let cursor = 0
  async function worker() {
    while (cursor < scssEntries.length) {
      const file = scssEntries[cursor++]
      try {
        extractDefinedClasses(await compileScss(file), defined)
      } catch {
        // Standalone compilation failed (e.g. partial-like entry) — fall back
        // to raw `.class` extraction so the file still contributes its rules.
        compileFallbacks.push(relative(REPO_ROOT, file))
        extractDefinedClasses(readFileSync(file, 'utf8'), defined)
      }
    }
  }
  await Promise.all(Array.from({ length: COMPILE_CONCURRENCY }, worker))
  for (const file of wxssEntries) extractDefinedClasses(readFileSync(file, 'utf8'), defined)

  // 3. Orphans = referenced − defined − allowlisted.
  const orphans = new Map()
  for (const [token, files] of references) {
    if (!defined.has(token) && !ALLOWED_ORPHANS.has(token)) orphans.set(token, files)
  }

  console.log(
    `class-coverage: ${references.size} referenced BEM classes, ` +
      `${defined.size} defined (${scssEntries.length} scss compiled, ${wxssEntries.length} wxss scanned)`,
  )
  if (compileFallbacks.length > 0) {
    console.log(`class-coverage: ${compileFallbacks.length} scss file(s) needed raw-extraction fallback:`)
    for (const f of compileFallbacks) console.log(`  · ${f}`)
  }

  if (WRITE_BASELINE) {
    const sorted = [...orphans.keys()].sort()
    writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 2)}\n`)
    console.log(`class-coverage: baseline written — ${sorted.length} known orphan(s) → ${relative(REPO_ROOT, BASELINE_PATH)}`)
    return
  }

  const baseline = new Set(
    existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : [],
  )
  const newOrphans = new Map([...orphans].filter(([token]) => !baseline.has(token)))
  const burnedDown = [...baseline].filter((token) => !orphans.has(token))

  if (burnedDown.length > 0) {
    console.log(
      `class-coverage: ${burnedDown.length} baseline entr${burnedDown.length === 1 ? 'y' : 'ies'} fixed — ` +
        'shrink the baseline: node scripts/check/check-class-coverage.mjs --write-baseline',
    )
  }

  if (newOrphans.size === 0) {
    console.log(
      `✓ class-coverage: no new orphans (${orphans.size} known in baseline, ` +
        `${baseline.size - orphans.size} fixed so far)`,
    )
    return
  }

  console.error(`\n✗ class-coverage: ${newOrphans.size} NEW class(es) referenced in TS/TSX but defined in NO stylesheet:\n`)
  for (const [token, files] of [...newOrphans].sort()) {
    console.error(`  ${token}`)
    for (const f of files) console.error(`    referenced by ${f}`)
  }
  console.error(
    '\nAdd the missing styles, or — for runtime-injected/third-party classes —\n' +
      'add a justified entry to ALLOWED_ORPHANS in scripts/check/check-class-coverage.mjs.\n' +
      '(Regression guard for the 2026-07-26 SquadTableCard zero-CSS incident.)',
  )
  process.exitCode = 1
}

main().catch((error) => {
  console.error('class-coverage: guard failed to run:', error)
  process.exitCode = 1
})
