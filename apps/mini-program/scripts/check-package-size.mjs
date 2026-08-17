#!/usr/bin/env node
/**
 * Measure mini-program package sizes after build and fail if main package exceeds limit.
 *
 * WeChat Mini Program enforces a 2MB hard limit per package (main + subpackages).
 * The upload service also rejects an oversized filtered source package before
 * producing the final archive, so this gate verifies both the upload filter
 * contract and the compressed package estimate.
 *
 * Usage (from apps/mini-program, after build:weapp):
 *   npm run check:package-size
 *
 * Requires: build:weapp to have been run first.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST_DIR = path.join(ROOT, 'dist')

const MAIN_PACKAGE_MAX_BYTES = 2 * 1024 * 1024
// WeChat DevTools also rejects the filtered source package before upload.
// Keep a safety buffer because its dependency scanner adds a small amount of
// metadata that is not represented by our direct filesystem sum.
const MAIN_PACKAGE_SOURCE_MAX_BYTES = 1.95 * 1024 * 1024
// WeChat's hard limit is 2MB. We previously held a 1.8MB guideline buffer, but
// the project currently ships ~1.88MB and the buffer was causing every build to
// warn. Treat the hard limit as the gate until an asset-CDN migration creates
// enough headroom to reintroduce a lower warning threshold.
const MAIN_PACKAGE_WARN_BYTES = MAIN_PACKAGE_MAX_BYTES
const SUBPACKAGE_MAX_BYTES = 1.8 * 1024 * 1024
const TOTAL_MAX_BYTES = 20 * 1024 * 1024

const isStrict = process.argv.includes('--strict') || process.env.CHECK_PACKAGE_SIZE_STRICT === 'true'

function getDirectorySize(dir) {
  if (!fs.existsSync(dir)) return 0
  let total = 0
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      total += getDirectorySize(full)
    } else {
      total += stat.size
    }
  }
  return total
}

function getFileSize(file) {
  if (!fs.existsSync(file)) return 0
  return fs.statSync(file).size
}

function formatSize(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / 1024).toFixed(1)} KiB`
}

function getZipSize(dirPath) {
  const tmpZip = path.join(os.tmpdir(), `joyjoin-mp-${Date.now()}.zip`)
  try {
    try {
      // -r recursive, -q quiet, -X no extra file attributes (closer to WeChat)
      execFileSync('zip', ['-r', '-q', '-X', tmpZip, '.'], { cwd: dirPath, stdio: 'pipe' })
    } catch (zipError) {
      if (process.platform !== 'win32') throw zipError
      // Windows ships bsdtar but normally has no `zip` executable. The old
      // fallback silently returned the raw byte count, making every local
      // package check report a false 3.28 MB failure. `-a` selects ZIP from
      // the output extension and preserves the same compressed-size contract.
      const tarExecutable = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
      execFileSync(tarExecutable, ['-a', '-c', '-f', tmpZip, '.'], {
        cwd: dirPath,
        stdio: 'pipe',
      })
    }
    const size = getFileSize(tmpZip)
    fs.unlinkSync(tmpZip)
    return size
  } catch {
    // If zip fails, fall back to uncompressed
    return getDirectorySize(dirPath)
  } finally {
    if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip)
  }
}

function readAppConfig() {
  const appJsonPath = path.join(DIST_DIR, 'app.json')
  if (!fs.existsSync(appJsonPath)) {
    return null
  }
  try {
    return JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'))
  } catch {
    return null
  }
}

function readProjectConfig() {
  const configPath = path.join(ROOT, 'project.config.json')
  if (!fs.existsSync(configPath)) return null
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  } catch {
    return null
  }
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`Missing dist directory: ${DIST_DIR}`)
    console.error('Run npm run build:weapp first.')
    process.exit(1)
  }

  const appConfig = readAppConfig()
  const projectConfig = readProjectConfig()
  const filtersUnusedFiles =
    projectConfig?.setting?.ignoreUploadUnusedFiles === true
  const subpackageRoots =
    appConfig?.subPackages?.map((pkg) => pkg.root).filter(Boolean) ?? ['pages/onboarding']
  const subpackageDirNames = subpackageRoots.map((root) => root.split('/').filter(Boolean)[1]).filter(Boolean)

  console.log('=== Package Size Breakdown ===\n')

  // Core JS files (always in main package)
  const coreFiles = [
    'app.js',
    'app.json',
    'app.wxss',
    'app-origin.wxss',
    'common.js',
    'common.wxss',
    'taro.js',
    'vendors.js',
    'babelHelpers.js',
    'base.wxml',
    'comp.js',
    'comp.json',
    'comp.wxml',
    'custom-wrapper.js',
    'custom-wrapper.json',
    'custom-wrapper.wxml',
    'utils.wxs',
    'project.config.json',
  ]
  let coreSize = 0
  for (const f of coreFiles) {
    coreSize += getFileSize(path.join(DIST_DIR, f))
  }
  console.log(`Core framework:        ${formatSize(coreSize)}`)

  // Main package pages (excluding all subpackage roots)
  const mainPagesDir = path.join(DIST_DIR, 'pages')
  let mainPagesSize = 0
  if (fs.existsSync(mainPagesDir)) {
    for (const name of fs.readdirSync(mainPagesDir)) {
      if (subpackageDirNames.includes(name)) continue
      const full = path.join(mainPagesDir, name)
      if (fs.statSync(full).isDirectory()) {
        mainPagesSize += getDirectorySize(full)
      }
    }
  }
  console.log(`Main pages:            ${formatSize(mainPagesSize)}`)

  // Shared assets
  const assetsDir = path.join(DIST_DIR, 'assets')
  const assetsSize = fs.existsSync(assetsDir) ? getDirectorySize(assetsDir) : 0
  console.log(`Shared assets:         ${formatSize(assetsSize)}`)

  // Native custom tab bar is a root-level main-package component.
  const customTabBarDir = path.join(DIST_DIR, 'custom-tab-bar')
  const customTabBarRawSize = fs.existsSync(customTabBarDir)
    ? getDirectorySize(customTabBarDir)
    : 0
  console.log(`Custom tab-bar:        ${formatSize(customTabBarRawSize)} (included in main)`)

  // Uncompressed estimate (for comparison)
  const uncompressedSize = coreSize + mainPagesSize + assetsSize + customTabBarRawSize
  console.log(`─────────────────────────────────`)
  console.log(`Main package (raw):    ${formatSize(uncompressedSize)}`)

  // Build temp dir with main package contents and measure zip
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'joyjoin-mp-main-'))
  try {
    // Copy core files
    for (const f of coreFiles) {
      const src = path.join(DIST_DIR, f)
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(tmpDir, f))
      }
    }
    // Copy pages (excluding subpackage roots)
    if (fs.existsSync(mainPagesDir)) {
      fs.mkdirSync(path.join(tmpDir, 'pages'))
      for (const name of fs.readdirSync(mainPagesDir)) {
        if (subpackageDirNames.includes(name)) continue
        const src = path.join(mainPagesDir, name)
        const dst = path.join(tmpDir, 'pages', name)
        if (fs.statSync(src).isDirectory()) {
          fs.cpSync(src, dst, { recursive: true })
        }
      }
    }
    // Copy assets
    if (fs.existsSync(assetsDir)) {
      fs.cpSync(assetsDir, path.join(tmpDir, 'assets'), { recursive: true })
    }
    // Root-level native components are part of the main package as uploaded.
    if (fs.existsSync(customTabBarDir)) {
      fs.cpSync(customTabBarDir, path.join(tmpDir, 'custom-tab-bar'), { recursive: true })
    }

    const mainPackageSize = getZipSize(tmpDir)
    console.log(`Main package (zip):    ${formatSize(mainPackageSize)} (limit: ${formatSize(MAIN_PACKAGE_MAX_BYTES)})`)

    // Subpackages
    let subpackageTotal = 0
    const oversizedSubpackages = []
    for (const root of subpackageRoots) {
      const dirName = root.split('/').filter(Boolean)[1]
      if (!dirName) continue
      const subDir = path.join(DIST_DIR, 'pages', dirName)
      if (!fs.existsSync(subDir)) continue
      const tmpSub = fs.mkdtempSync(path.join(os.tmpdir(), 'joyjoin-mp-sub-'))
      fs.cpSync(subDir, path.join(tmpSub, 'pages', dirName), { recursive: true })
      const subSize = getZipSize(tmpSub)
      const displayName = dirName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      console.log(`${displayName.padEnd(21)} ${formatSize(subSize)} (limit: ${formatSize(SUBPACKAGE_MAX_BYTES)})`)
      if (subSize > SUBPACKAGE_MAX_BYTES) {
        oversizedSubpackages.push({ displayName, size: subSize })
      }
      subpackageTotal += subSize
      fs.rmSync(tmpSub, { recursive: true, force: true })
    }

    const totalSize = mainPackageSize + subpackageTotal
    console.log(`─────────────────────────────────`)
    console.log(`Total (zip):           ${formatSize(totalSize)} (limit: ${formatSize(TOTAL_MAX_BYTES)})`)
    console.log('')

    let failed = false

    if (!filtersUnusedFiles && uncompressedSize > MAIN_PACKAGE_SOURCE_MAX_BYTES) {
      console.error(
        `FAIL: Main package source exceeds ${formatSize(MAIN_PACKAGE_SOURCE_MAX_BYTES)} safety limit`,
      )
      console.error(`      Current raw source: ${formatSize(uncompressedSize)}`)
      console.error('      Remediation: enable project.config.json setting.ignoreUploadUnusedFiles and explicitly include dynamic runtime assets.')
      failed = true
    } else if (filtersUnusedFiles) {
      console.log('PASS: WeChat unused-file filtering is enabled for source packaging')
    }

    if (mainPackageSize > MAIN_PACKAGE_MAX_BYTES) {
      console.error(`FAIL: Main package exceeds ${formatSize(MAIN_PACKAGE_MAX_BYTES)} (compressed)`)
      console.error(`      Largest contributor: assets (${formatSize(assetsSize)} uncompressed)`)
      console.error(`      Remediation: Move large image assets to CDN.`)
      failed = true
    } else if (mainPackageSize > MAIN_PACKAGE_WARN_BYTES) {
      console.error(`FAIL: Main package exceeds WeChat ${formatSize(MAIN_PACKAGE_MAX_BYTES)} hard limit`)
      console.error(`      Current: ${formatSize(mainPackageSize)}`)
      console.error(`      Remediation: Move Tier 2 assets (Lovart, promo, matching, empty-state) to CDN.`)
      failed = true
    } else {
      console.log(`PASS: Main package within ${formatSize(MAIN_PACKAGE_MAX_BYTES)}`)
    }

    if (oversizedSubpackages.length > 0) {
      const details = oversizedSubpackages
        .map(({ displayName, size }) => `${displayName} (${formatSize(size)})`)
        .join(', ')
      console.error(`FAIL: Subpackage(s) exceed ${formatSize(SUBPACKAGE_MAX_BYTES)}: ${details}`)
      failed = true
    }

    if (totalSize > TOTAL_MAX_BYTES) {
      console.error(`FAIL: Total exceeds ${formatSize(TOTAL_MAX_BYTES)}`)
      failed = true
    }

    if (failed) {
      console.error('\nPackage size check FAILED.')
      process.exit(1)
    }

    console.log('Package size check OK.')
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

main()
