#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const WECHAT_MAIN_PACKAGE_LIMIT_BYTES = 2 * 1024 * 1024
export const JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES = Math.floor(1.9 * 1024 * 1024)

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

    const belongsToSubpackage = subpackageRoots.some(
      (root) => relativePath === root || relativePath.startsWith(`${root}/`),
    )
    if (!belongsToSubpackage) {
      mainPackageBytes += bytes
      if (subpackageRequirePattern && relativePath.endsWith('.js')) {
        const source = fs.readFileSync(filePath, 'utf8')
        for (const match of source.matchAll(subpackageRequirePattern)) {
          crossPackageRequires.push({ file: relativePath, packageRoot: match[1] })
        }
      }
    }
  }

  return { mainPackageBytes, totalBytes, subpackageRoots, crossPackageRequires }
}

export function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

function runCli() {
  const compiledDirectory = path.resolve(process.argv[2] ?? 'compiled-check')
  const result = calculateCompiledPackageSourceSize(compiledDirectory)
  const headroom = WECHAT_MAIN_PACKAGE_LIMIT_BYTES - result.mainPackageBytes

  console.log(
    `[compiled-package-size] main source ${formatBytes(result.mainPackageBytes)}; ` +
      `WeChat headroom ${formatBytes(headroom)}`,
  )

  let failed = false
  if (result.mainPackageBytes > JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES) {
    console.error(
      `[compiled-package-size] FAIL: main source exceeds JoyJoin's ` +
        `${formatBytes(JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES)} safety limit ` +
        `(WeChat hard limit ${formatBytes(WECHAT_MAIN_PACKAGE_LIMIT_BYTES)}).`,
    )
    failed = true
  }

  if (result.crossPackageRequires.length > 0) {
    console.error('[compiled-package-size] FAIL: main package requires a subpackage chunk:')
    for (const reference of result.crossPackageRequires) {
      console.error(`  ${reference.file} -> ${reference.packageRoot}`)
    }
    failed = true
  }

  if (failed) {
    process.exitCode = 1
    return
  }

  console.log(
    `[compiled-package-size] PASS: ${formatBytes(
      JOYJOIN_MAIN_PACKAGE_SAFETY_LIMIT_BYTES - result.mainPackageBytes,
    )} below the safety limit.`,
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCli()
}
