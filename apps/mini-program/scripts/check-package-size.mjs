#!/usr/bin/env node
/**
 * Measure mini-program package sizes after build and fail if main package exceeds limit.
 *
 * WeChat Mini Program enforces a 2MB hard limit per package (main + subpackages).
 * The limit applies to the COMPRESSED upload package, not uncompressed files.
 * This script measures the actual zip-compressed size to be accurate.
 *
 * Usage (from apps/mini-program, after build:weapp):
 *   npm run check:package-size
 *
 * Requires: build:weapp to have been run first.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST_DIR = path.join(ROOT, 'dist')

const MAIN_PACKAGE_MAX_BYTES = 2 * 1024 * 1024
const MAIN_PACKAGE_WARN_BYTES = 1.8 * 1024 * 1024
const SUBPACKAGE_MAX_BYTES = 1.8 * 1024 * 1024
const TOTAL_MAX_BYTES = 20 * 1024 * 1024

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
    // -r recursive, -q quiet, -X no extra file attributes (closer to WeChat)
    execSync(`zip -r -q -X "${tmpZip}" .`, { cwd: dirPath, stdio: 'pipe' })
    const size = getFileSize(tmpZip)
    fs.unlinkSync(tmpZip)
    return size
  } catch (e) {
    // If zip fails, fall back to uncompressed
    return getDirectorySize(dirPath)
  }
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`Missing dist directory: ${DIST_DIR}`)
    console.error('Run npm run build:weapp first.')
    process.exit(1)
  }

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
    'utils.wxs',
    'project.config.json',
  ]
  let coreSize = 0
  for (const f of coreFiles) {
    coreSize += getFileSize(path.join(DIST_DIR, f))
  }
  console.log(`Core framework:        ${formatSize(coreSize)}`)

  // Main package pages (excluding onboarding subpackage)
  const mainPagesDir = path.join(DIST_DIR, 'pages')
  let mainPagesSize = 0
  if (fs.existsSync(mainPagesDir)) {
    for (const name of fs.readdirSync(mainPagesDir)) {
      if (name === 'onboarding') continue // subpackage
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

  // Uncompressed estimate (for comparison)
  const uncompressedSize = coreSize + mainPagesSize + assetsSize
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
    // Copy pages (excluding onboarding)
    if (fs.existsSync(mainPagesDir)) {
      fs.mkdirSync(path.join(tmpDir, 'pages'))
      for (const name of fs.readdirSync(mainPagesDir)) {
        if (name === 'onboarding') continue
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

    const mainPackageSize = getZipSize(tmpDir)
    console.log(`Main package (zip):    ${formatSize(mainPackageSize)} (limit: ${formatSize(MAIN_PACKAGE_MAX_BYTES)})`)

    // Subpackages
    let subpackageTotal = 0
    const onboardingDir = path.join(DIST_DIR, 'pages', 'onboarding')
    if (fs.existsSync(onboardingDir)) {
      const tmpOnboarding = fs.mkdtempSync(path.join(os.tmpdir(), 'joyjoin-mp-sub-'))
      fs.cpSync(onboardingDir, path.join(tmpOnboarding, 'pages', 'onboarding'), { recursive: true })
      const onboardingSize = getZipSize(tmpOnboarding)
      console.log(`Onboarding subpkg:     ${formatSize(onboardingSize)} (limit: ${formatSize(SUBPACKAGE_MAX_BYTES)})`)
      subpackageTotal += onboardingSize
      fs.rmSync(tmpOnboarding, { recursive: true, force: true })
    }

    const customTabBarDir = path.join(DIST_DIR, 'custom-tab-bar')
    if (fs.existsSync(customTabBarDir)) {
      const tmpTabBar = fs.mkdtempSync(path.join(os.tmpdir(), 'joyjoin-mp-tab-'))
      fs.cpSync(customTabBarDir, path.join(tmpTabBar, 'custom-tab-bar'), { recursive: true })
      const tabBarSize = getZipSize(tmpTabBar)
      console.log(`Custom tab-bar:        ${formatSize(tabBarSize)}`)
      subpackageTotal += tabBarSize
      fs.rmSync(tmpTabBar, { recursive: true, force: true })
    }

    const totalSize = mainPackageSize + subpackageTotal
    console.log(`─────────────────────────────────`)
    console.log(`Total (zip):           ${formatSize(totalSize)} (limit: ${formatSize(TOTAL_MAX_BYTES)})`)
    console.log('')

    let failed = false

    if (mainPackageSize > MAIN_PACKAGE_MAX_BYTES) {
      console.error(`FAIL: Main package exceeds ${formatSize(MAIN_PACKAGE_MAX_BYTES)} (compressed)`)
      console.error(`      Largest contributor: assets (${formatSize(assetsSize)} uncompressed)`)
      console.error(`      Remediation: Move large image assets to CDN.`)
      failed = true
    } else if (mainPackageSize > MAIN_PACKAGE_WARN_BYTES) {
      console.warn(`WARN: Main package exceeds WeChat 2MB guideline (${formatSize(MAIN_PACKAGE_WARN_BYTES)})`)
      console.warn(`      Current: ${formatSize(mainPackageSize)}`)
      console.warn(`      To reach 1.8MB: move Tier 2 assets (Lovart, promo, matching, empty-state) to CDN.`)
    } else {
      console.log(`PASS: Main package within ${formatSize(MAIN_PACKAGE_WARN_BYTES)}`)
    }

    if (subpackageTotal > SUBPACKAGE_MAX_BYTES) {
      console.error(`FAIL: Subpackage(s) exceed ${formatSize(SUBPACKAGE_MAX_BYTES)}`)
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
