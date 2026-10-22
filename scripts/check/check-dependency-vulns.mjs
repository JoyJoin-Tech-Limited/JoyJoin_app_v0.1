#!/usr/bin/env node
/**
 * Dependency vulnerability ratchet.
 *
 * Why this exists
 * ---------------
 * Every CI job installs with `npm ci --no-audit`, and the repo has no
 * Dependabot config, so dependency advisories were only ever visible on the
 * GitHub security tab. That is a surface nobody looks at during review, which
 * is why the alert count grew monotonically. This guard makes the *reachable*
 * subset of those advisories a hard gate.
 *
 * Scope: PRODUCTION-DECLARED dependencies only.
 * --------------------------------------------
 * The full audit graph is noisy: on 2026-10-21 the root lockfile had 185
 * affected nodes / 197 unique advisories, but 174 of them were reachable only
 * through build tooling (babel-6 subtree pulled in by miniprogram-ci, glob
 * ReDoS via stylelint/eslint, esbuild/vite dev-server issues). Gating on the
 * full graph would mean baselining ~115 entries and never burning them down.
 *
 * So this guard BFS-walks the lockfile from each workspace's declared
 * `dependencies` (not devDependencies) and gates only what can ship:
 *   - critical/high findings whose affected node paths are on that runtime
 *     surface (a dev-only nested copy of a same-named package is NOT gated)
 *   - everything else is reported as context (`build-tool findings`), not gated
 *
 * Ratchet semantics
 * -----------------
 * `dependency-vuln-baseline.json` grandfathered the findings that existed when
 * the guard landed. A finding FAILS the gate only when it is NOT in the
 * baseline (key = `<severity>:<package>`). Baseline entries are expected to be
 * BURNED DOWN by the dependency-security batch, never grown. Regenerate with:
 *
 *   node scripts/check/check-dependency-vulns.mjs --write-baseline
 *
 * `--write-baseline` preserves the `reason` / `reviewBy` of surviving keys.
 *
 * Network failure policy
 * ----------------------
 * `npm audit` needs the registry. A registry outage must not block every PR,
 * so an unusable audit response prints a WARN and exits 0 unless `--strict`
 * is passed (CI passes `--strict`).
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '../..')
const LOCKFILE = path.join(REPO_ROOT, 'package-lock.json')
const BASELINE_FILE = path.join(HERE, 'dependency-vuln-baseline.json')

const WRITE_BASELINE = process.argv.includes('--write-baseline')
const STRICT = process.argv.includes('--strict') || process.env.CI === 'true'
const GATED_SEVERITIES = new Set(['critical', 'high'])

/** Workspaces whose declared runtime dependencies define the shipping surface. */
const RUNTIME_WORKSPACES = [
  'apps/server',
  'packages/shared',
  'apps/admin-client',
  'apps/mini-program',
]

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** Ancestor directories of a lockfile path, from itself up to the repo root. */
function ancestors(dir) {
  const out = [dir]
  let current = dir
  for (;;) {
    const idx = current.lastIndexOf('/')
    if (idx < 0) break
    current = current.slice(0, idx)
    out.push(current)
  }
  if (!out.includes('')) out.push('')
  return out
}

/** Node-resolve a dependency name from a directory, using the lockfile tree. */
function resolveDep(packages, fromDir, name) {
  for (const base of ancestors(fromDir)) {
    const candidate = `${base ? `${base}/` : ''}node_modules/${name}`
    if (packages[candidate]) return candidate
  }
  return null
}

function dirOf(lockPath) {
  const idx = lockPath.lastIndexOf('/node_modules/')
  if (idx >= 0) return lockPath.slice(0, idx)
  // A top-level `node_modules/<name>` entry lives at the repo root.
  if (lockPath.startsWith('node_modules/')) return ''
  // A workspace/link entry (`apps/server`) owns its own `node_modules`, so it is
  // its own lookup base. Returning '' here resolved every workspace dependency
  // from the repo root and hid the copies npm nested inside a workspace — e.g. a
  // second `drizzle-orm` copy under `apps/server/node_modules`, which made the
  // gate blind to a vulnerable nested runtime package (found by the AC3
  // negative test on 2026-10-22).
  return lockPath
}

/**
 * The shipping surface, by construction: every package path reachable from the
 * declared (non-dev) dependencies of a runtime workspace.
 *
 * Paths matter, not just names. A dev-only nested copy of a package whose name
 * also exists in the runtime tree (e.g. `miniprogram-ci/node_modules/lodash`)
 * is not shipping surface, and gating it by name would produce phantom
 * findings that no upgrade can ever clear.
 */
function collectRuntimeSurface(packages) {
  const starts = RUNTIME_WORKSPACES.map((ws) => ws).filter((ws) => packages[ws])
  const seen = new Set(starts)
  const queue = [...starts]
  const names = new Set()

  while (queue.length > 0) {
    const current = queue.shift()
    const node = packages[current]
    if (!node) continue
    names.add(current.split('node_modules/').pop())
    for (const dep of Object.keys(node.dependencies ?? {})) {
      const resolved = resolveDep(packages, dirOf(current), dep)
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved)
        queue.push(resolved)
      }
    }
  }

  return { names, paths: seen }
}

function runAudit() {
  const raw = execFileSync('npm', ['audit', '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 600_000,
    maxBuffer: 64 * 1024 * 1024,
    // npm exits 1 whenever findings exist; the JSON body is still printed.
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(raw)
}

function auditWithTolerance() {
  try {
    return runAudit()
  } catch (error) {
    const stdout = typeof error.stdout === 'string' ? error.stdout : ''
    if (stdout.trim().startsWith('{')) {
      try {
        return JSON.parse(stdout)
      } catch {
        /* fall through */
      }
    }
    const detail = (error.stderr || error.message || '').toString().split('\n')[0]
    console.warn(`⚠ dependency-vulns: npm audit unavailable (${detail || 'unknown error'})`)
    if (STRICT) {
      console.error('✗ dependency-vulns: --strict/CI mode requires a usable audit response.')
      process.exitCode = 1
    }
    return null
  }
}

function advisoryUrls(node) {
  const urls = (node.via ?? [])
    .filter((via) => typeof via === 'object' && via.url)
    .map((via) => via.url)
  return [...new Set(urls)]
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return { packages: {} }
  const parsed = readJson(BASELINE_FILE)
  return { packages: parsed.packages ?? {} }
}

function writeBaseline(packages, findings) {
  const next = {}
  for (const finding of findings) {
    const previous = packages[finding.key]
    next[finding.key] = {
      package: finding.name,
      severity: finding.severity,
      reason: previous?.reason ?? 'Grandfathered when the guard landed — burn down in the dependency-security batch.',
      reviewBy: previous?.reviewBy ?? '2026-12-31',
      advisoryUrls: finding.advisoryUrls,
    }
  }
  const document = {
    $comment:
      'Ratchet baseline for scripts/check/check-dependency-vulns.mjs. Keys are `<severity>:<package>` for findings reachable from a workspace runtime dependency set. Entries must be burned down, never added without a reason + reviewBy.',
    generatedAt: new Date().toISOString().slice(0, 10),
    packages: next,
  }
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(document, null, 2)}\n`)
}

function main() {
  if (process.env.DEP_VULN_CHECK_SKIP === '1') {
    console.warn('⚠ dependency-vulns: skipped via DEP_VULN_CHECK_SKIP=1')
    return
  }

  if (!fs.existsSync(LOCKFILE)) {
    console.error('✗ dependency-vulns: package-lock.json not found at the repo root.')
    process.exitCode = 1
    return
  }

  const audit = auditWithTolerance()
  if (!audit) return

  const lock = readJson(LOCKFILE)
  const runtime = collectRuntimeSurface(lock.packages ?? {})
  const vulnerabilities = audit.vulnerabilities ?? {}

  const gated = []
  const buildTool = []
  for (const [name, node] of Object.entries(vulnerabilities)) {
    const severity = node.severity
    if (!GATED_SEVERITIES.has(severity)) continue
    const record = {
      name,
      severity,
      key: `${severity}:${name}`,
      range: node.range,
      direct: Boolean(node.isDirect),
      advisoryUrls: advisoryUrls(node),
    }
    // Prefer the concrete affected node paths: an advisory can name a package
    // that is vulnerable only in a dev-only nested copy. Fall back to the name
    // when the audit entry carries no node list.
    const affectedPaths = Array.isArray(node.nodes) ? node.nodes : []
    const reachable =
      affectedPaths.length > 0
        ? affectedPaths.some((path) => runtime.paths.has(path))
        : runtime.names.has(name)
    if (reachable) gated.push(record)
    else buildTool.push(record)
  }

  const baseline = loadBaseline()

  if (WRITE_BASELINE) {
    writeBaseline(baseline.packages, gated)
    console.log(
      `✓ dependency-vulns: baseline rewritten with ${gated.length} runtime finding(s). ` +
        `(${buildTool.length} build-tool finding(s) are reported, not gated.)`,
    )
    return
  }

  const newFindings = gated.filter((finding) => !baseline.packages[finding.key])
  const burnedDown = Object.keys(baseline.packages).filter(
    (key) => !gated.some((finding) => finding.key === key),
  )

  console.log(
    `dependency-vulns: ${gated.length} runtime critical/high finding(s), ` +
      `${Object.keys(baseline.packages).length} baselined, ${buildTool.length} build-tool finding(s) (not gated).`,
  )

  if (burnedDown.length > 0) {
    console.log(
      `\n✨ ${burnedDown.length} baseline entr${burnedDown.length === 1 ? 'y is' : 'ies are'} no longer present — ` +
        'shrink the ratchet: node scripts/check/check-dependency-vulns.mjs --write-baseline',
    )
    for (const key of burnedDown) console.log(`   - ${key}`)
  }

  if (newFindings.length === 0) {
    console.log('\n✓ dependency-vulns: no new runtime critical/high advisories.')
    return
  }

  console.error(
    `\n✗ dependency-vulns: ${newFindings.length} NEW runtime critical/high advisory finding(s):\n`,
  )
  for (const finding of newFindings) {
    console.error(`  [${finding.severity}] ${finding.name}${finding.direct ? ' (direct)' : ''} ${finding.range ?? ''}`)
    for (const url of finding.advisoryUrls) console.error(`      ${url}`)
  }
  console.error(
    '\nThese packages are reachable from a workspace runtime dependency set.\n' +
      'Upgrade the package (no `npm audit fix --force` on this repo — it downgrades @tarojs/*),\n' +
      'or baseline with a written reason if the exposure is genuinely not exploitable:\n' +
      '  node scripts/check/check-dependency-vulns.mjs --write-baseline\n' +
      'then review the new entry (reason + reviewBy) in the same PR.',
  )
  process.exitCode = 1
}

const invokedDirectly =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  try {
    main()
  } catch (error) {
    console.error('dependency-vulns: guard failed to run:', error)
    process.exitCode = 1
  }
}

export { ancestors, resolveDep, dirOf, collectRuntimeSurface }
