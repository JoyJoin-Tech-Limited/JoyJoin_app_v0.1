#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const WECHAT_MAIN_PACKAGE_LIMIT_BYTES = 2 * 1024 * 1024

/**
 * BASIS LIMITATION — read before trusting any number below (2026-10-15).
 *
 * `get-compiled-result` returns the *compiler's* emitted tree, not the uploaded
 * `dist/`. The compiler only emits what it can reach statically, so an asset
 * referenced solely from a JS string constant — `localAsset('/pages/…/art.webp')`
 * bound as `src={…}` — is never emitted. Measured the day the two gathering-room
 * composites (174.8 KiB) moved into their own subpackage:
 *
 *   dist/     pages/gathering-room   235.2 KiB
 *   compiled  pages/gathering-room    61.6 KiB   (code only — art absent)
 *   compiled  main package          1909.5 KiB   (byte-identical to the pre-move run)
 *
 * So this tree can under-count a package by an unknown amount, and a ceiling
 * verdict here is authoritative in neither direction:
 *   - unadjusted it under-reports (1909.1 KiB printed "138.9 KiB headroom" for a
 *     package WeChat refused as "main package source size 2063KB exceed max limit");
 *   - adjusted by a fixed offset it over-reports whenever the omitted bytes
 *     exceed that offset — exactly what happens now (175 KiB omitted vs 160 KiB
 *     offset), so it fails a package that may well fit.
 * WeChat computes the real number server-side from the uploaded package, and
 * `upload-weapp` runs that check immediately after this script. Therefore the
 * size verdicts below are loud WARNINGS, never gates; structural assertions
 * (cross-package requires) stay fatal. Recalibrate from a real 80200 message.
 */
export const WECHAT_SOURCE_SIZE_OVERHEAD_BYTES = 160 * 1024

/** Deliberate slack kept below WeChat's real ceiling after the correction. */
export const JOYJOIN_MAIN_PACKAGE_HEADROOM_MARGIN_BYTES = 32 * 1024

/**
 * Warning threshold, not a gate (see the basis limitation above): exceeding it
 * prints a GitHub warning annotation and the script still exits 0, so the real
 * upload verdict is never pre-empted by an estimate computed on an incomplete
 * tree. Kept non-zero for the case where the tree *is* complete (an upload that
 * failed on a number this script already reported would need real slack).
 */
export const JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES =
  WECHAT_MAIN_PACKAGE_LIMIT_BYTES -
  WECHAT_SOURCE_SIZE_OVERHEAD_BYTES -
  JOYJOIN_MAIN_PACKAGE_HEADROOM_MARGIN_BYTES

/**
 * Subpackages carry the same 2 MB ceiling as the main package, so they get the
 * same arithmetic. The 160 KiB overhead was measured on the main package; it is
 * carried over here deliberately (worst case: the warning is stricter than
 * WeChat is). A subpackage warning that coexists with a successful upload means
 * the offset is wrong for that package — re-measure it from a real 80200 message
 * instead of raising the threshold.
 */
export const JOYJOIN_SUBPACKAGE_SAFETY_LIMIT_BYTES = JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES

function normalizePackageRoot(root) {
  return root.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath]
  })
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findSubpackageRoot(relativePath, subpackageRoots) {
  let owner = null
  for (const root of subpackageRoots) {
    if (relativePath !== root && !relativePath.startsWith(`${root}/`)) continue
    // Longest match wins, so a nested root never leaks into its parent.
    if (!owner || root.length > owner.length) owner = root
  }
  return owner
}

export function calculateCompiledPackageSourceSize(compiledDirectory) {
  const appJsonPath = path.join(compiledDirectory, 'app.json')
  if (!fs.existsSync(appJsonPath)) {
    throw new Error(`Compiled app.json is missing: ${appJsonPath}`)
  }

  const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'))
  const subpackageRoots = (appConfig.subPackages ?? appConfig.subpackages ?? [])
    .map((subpackage) => normalizePackageRoot(subpackage.root ?? ''))
    .filter(Boolean)

  let mainPackageBytes = 0
  let totalBytes = 0
  const subpackageBytes = new Map(subpackageRoots.map((root) => [root, 0]))
  const crossPackageRequires = []
  const subpackageRequirePattern = subpackageRoots.length > 0
    ? new RegExp(
        `require\\(\\s*['"](?:\\./)?(${subpackageRoots.map(escapeRegExp).join('|')})(?:/|['"])`,
        'g',
      )
    : null
  for (const filePath of listFiles(compiledDirectory)) {
    const relativePath = path.relative(compiledDirectory, filePath).replace(/\\/g, '/')
    const bytes = fs.statSync(filePath).size
    totalBytes += bytes

    const owner = findSubpackageRoot(relativePath, subpackageRoots)
    if (owner) {
      subpackageBytes.set(owner, subpackageBytes.get(owner) + bytes)
      continue
    }

    mainPackageBytes += bytes
    if (subpackageRequirePattern && relativePath.endsWith('.js')) {
      const source = fs.readFileSync(filePath, 'utf8')
      for (const match of source.matchAll(subpackageRequirePattern)) {
        crossPackageRequires.push({ file: relativePath, packageRoot: match[1] })
      }
    }
  }

  return {
    mainPackageBytes,
    totalBytes,
    subpackageRoots,
    // Every declared root is reported, even when empty, so the CLI shows the
    // full ceiling picture instead of only what happens to be non-trivial.
    subpackages: subpackageRoots.map((root) => ({
      root,
      bytes: subpackageBytes.get(root) ?? 0,
    })),
    crossPackageRequires,
  }
}

export function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

/**
 * Size verdicts on this basis are warnings (the tree omits assets referenced
 * only from JS string constants — see the basis limitation above); only
 * basis-independent structural defects are fatal. Extracted from the CLI so the
 * policy is unit-testable.
 */
export function evaluateCompiledPackageSizes(result) {
  const warnings = []
  const failures = []
  const wechatEquivalentBytes = result.mainPackageBytes + WECHAT_SOURCE_SIZE_OVERHEAD_BYTES

  if (result.mainPackageBytes > JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES) {
    warnings.push(
      `[compiled-package-size] WARNING: main source ${formatBytes(result.mainPackageBytes)} ` +
        `exceeds JoyJoin's ${formatBytes(JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES)} estimate ` +
        `(WeChat estimate ${formatBytes(wechatEquivalentBytes)} vs hard limit ` +
        `${formatBytes(WECHAT_MAIN_PACKAGE_LIMIT_BYTES)}). This tree omits assets ` +
        `referenced only from JS string literals, so the number is not authoritative — ` +
        `the upload job decides.`,
    )
  }

  for (const subpackage of result.subpackages) {
    if (subpackage.bytes <= JOYJOIN_SUBPACKAGE_SAFETY_LIMIT_BYTES) continue
    warnings.push(
      `[compiled-package-size] WARNING: subpackage ${subpackage.root} source ` +
        `${formatBytes(subpackage.bytes)} exceeds JoyJoin's ` +
        `${formatBytes(JOYJOIN_SUBPACKAGE_SAFETY_LIMIT_BYTES)} estimate ` +
        `(WeChat estimate ` +
        `${formatBytes(subpackage.bytes + WECHAT_SOURCE_SIZE_OVERHEAD_BYTES)}; hard limit ` +
        `${formatBytes(WECHAT_MAIN_PACKAGE_LIMIT_BYTES)} per package). Serve that ` +
        `subpackage's heaviest art from the CDN if the upload agrees.`,
    )
  }

  for (const reference of result.crossPackageRequires) {
    failures.push(
      '[compiled-package-size] FAIL: main package requires a subpackage chunk: ' +
        `${reference.file} -> ${reference.packageRoot}`,
    )
  }

  return { warnings, failures, wechatEquivalentBytes }
}

function runCli() {
  const compiledDirectory = path.resolve(process.argv[2] ?? 'compiled-check')
  const result = calculateCompiledPackageSourceSize(compiledDirectory)
  const wechatEquivalentBytes = result.mainPackageBytes + WECHAT_SOURCE_SIZE_OVERHEAD_BYTES
  const headroom = WECHAT_MAIN_PACKAGE_LIMIT_BYTES - wechatEquivalentBytes

  console.log(
    `[compiled-package-size] basis: miniprogram-ci compiled bundle ` +
      `(CI: compiled-check). A raw Taro dist/ is a much larger tree — its ` +
      `numbers are not comparable to WeChat's accounting, and this tree in turn ` +
      `omits assets referenced only from JS string literals. Estimates below; the ` +
      `WeChat upload decides.`,
  )
  console.log(
    `[compiled-package-size] main source ${formatBytes(result.mainPackageBytes)} ` +
      `(WeChat-equivalent ${formatBytes(wechatEquivalentBytes)} incl. ` +
      `${formatBytes(WECHAT_SOURCE_SIZE_OVERHEAD_BYTES)} accounting overhead); ` +
      `WeChat headroom ${formatBytes(headroom)}`,
  )

  // WeChat enforces the 2 MB ceiling per package, so a subpackage can fail the
  // upload on its own. Print every root every run: the point is to see a
  // subpackage approach the ceiling long before an upload refuses it.
  const rankedSubpackages = [...result.subpackages].sort((a, b) => b.bytes - a.bytes)
  for (const subpackage of rankedSubpackages) {
    const subpackageWechatBytes = subpackage.bytes + WECHAT_SOURCE_SIZE_OVERHEAD_BYTES
    console.log(
      `[compiled-package-size] subpackage ${subpackage.root.padEnd(26)} ` +
        `${formatBytes(subpackage.bytes)} ` +
        `(WeChat-equivalent ${formatBytes(subpackageWechatBytes)}); ` +
        `headroom ${formatBytes(WECHAT_MAIN_PACKAGE_LIMIT_BYTES - subpackageWechatBytes)}`,
    )
  }

  const { warnings, failures } = evaluateCompiledPackageSizes(result)

  // GitHub annotations (::warning::) so a size estimate that has drifted shows
  // up in the Actions UI even though it cannot gate the build.
  for (const warning of warnings) console.error(`::warning::${warning}`)
  for (const failure of failures) console.error(failure)

  if (failures.length > 0) {
    process.exitCode = 1
    return
  }

  if (warnings.length > 0) {
    console.log(
      '[compiled-package-size] ADVISORY: the size warning(s) above are estimates on an ' +
        'incomplete tree; the authoritative verdict comes from the WeChat upload that ' +
        'runs after this step.',
    )
    return
  }

  const tightestSubpackage = rankedSubpackages[0]
  console.log(
    `[compiled-package-size] PASS: ${formatBytes(
      JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES - result.mainPackageBytes,
    )} below the main safety limit` +
      (tightestSubpackage
        ? `; tightest subpackage ${tightestSubpackage.root} keeps ` +
          `${formatBytes(
            WECHAT_MAIN_PACKAGE_LIMIT_BYTES -
              (tightestSubpackage.bytes + WECHAT_SOURCE_SIZE_OVERHEAD_BYTES),
          )} of WeChat headroom.`
        : '.'),
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCli()
}
