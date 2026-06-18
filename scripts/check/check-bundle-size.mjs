#!/usr/bin/env node
/**
 * check-bundle-size.mjs
 *
 * CI gate for WeChat mini-program bundle sizes.
 *
 * WeChat Mini Program limits (per package, compressed):
 * - Main package: 2MB (hard stop)
 * - Per sub-package: 2MB (hard stop)
 * - Total upload: 20MB (hard stop)
 *
 * This script performs a fast uncompressed per-package check and a total-size
 * sanity check. The authoritative compressed-size gate lives in
 * apps/mini-program/scripts/check-package-size.mjs and is run via
 * `npm run check:package-size -w mini-program`.
 *
 * Why uncompressed? WeChat's real limit is on the compressed upload, but
 * uncompressed size is a useful early warning: if a package is already near
 * 2MB uncompressed, compression will not save it.
 */

import fs from 'node:fs';
import path from 'node:path';

const MINI_PROGRAM_DIST = 'apps/mini-program/dist';

const MAIN_PACKAGE_FAIL_MB = 5.0;
const MAIN_PACKAGE_WARN_MB = 4.0;
const SUBPACKAGE_FAIL_MB = 3.0;
const SUBPACKAGE_WARN_MB = 2.5;
const TOTAL_WARN_MB = 10.0;
const TOTAL_FAIL_MB = 12.0;

const BYTES_PER_MB = 1024 * 1024;

const CORE_FILES = [
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
];

function getDirectorySize(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += getDirectorySize(fullPath);
    } else {
      total += fs.statSync(fullPath).size;
    }
  }
  return total;
}

function getFileSize(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  return fs.statSync(filePath).size;
}

function formatMB(bytes) {
  return (bytes / BYTES_PER_MB).toFixed(2);
}

function readAppConfig() {
  const appJsonPath = path.join(MINI_PROGRAM_DIST, 'app.json');
  if (!fs.existsSync(appJsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
  } catch {
    return null;
  }
}

function main() {
  if (!fs.existsSync(MINI_PROGRAM_DIST)) {
    console.log(`Bundle size check skipped: ${MINI_PROGRAM_DIST} does not exist (run build first).`);
    process.exit(0);
  }

  const appConfig = readAppConfig();
  if (!appConfig) {
    console.error('Could not read app.json from dist');
    process.exit(1);
  }

  const mainPageSet = new Set(appConfig.pages ?? []);
  const subpackageRoots = appConfig.subPackages?.map((pkg) => pkg.root).filter(Boolean) ?? [];
  const subpackageDirNames = subpackageRoots
    .map((root) => root.split('/').filter(Boolean)[1])
    .filter(Boolean);

  const violations = [];
  const warnings = [];

  // Main package = core framework files + main-package pages + shared assets + custom-tab-bar
  let mainPackageSize = 0;
  for (const f of CORE_FILES) {
    mainPackageSize += getFileSize(path.join(MINI_PROGRAM_DIST, f));
  }

  const pagesDir = path.join(MINI_PROGRAM_DIST, 'pages');
  if (fs.existsSync(pagesDir)) {
    for (const entry of fs.readdirSync(pagesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (subpackageDirNames.includes(entry.name)) continue;
      const pagePath = `pages/${entry.name}/index`;
      // Only count directories that correspond to registered main-package pages
      const matchesMainPage = Array.from(mainPageSet).some((p) => p.startsWith(pagePath));
      if (matchesMainPage) {
        mainPackageSize += getDirectorySize(path.join(pagesDir, entry.name));
      }
    }
  }

  const assetsDir = path.join(MINI_PROGRAM_DIST, 'assets');
  if (fs.existsSync(assetsDir)) {
    mainPackageSize += getDirectorySize(assetsDir);
  }

  const customTabBarDir = path.join(MINI_PROGRAM_DIST, 'custom-tab-bar');
  if (fs.existsSync(customTabBarDir)) {
    mainPackageSize += getDirectorySize(customTabBarDir);
  }

  const mainPackageMB = mainPackageSize / BYTES_PER_MB;
  console.log(`Main package (uncompressed): ${formatMB(mainPackageSize)} MB`);

  if (mainPackageMB >= MAIN_PACKAGE_FAIL_MB) {
    violations.push(`Main package uncompressed ${formatMB(mainPackageSize)}MB exceeds ${MAIN_PACKAGE_FAIL_MB}MB (WeChat limit is 2MB compressed)`);
  } else if (mainPackageMB >= MAIN_PACKAGE_WARN_MB) {
    warnings.push(`Main package uncompressed ${formatMB(mainPackageSize)}MB exceeds ${MAIN_PACKAGE_WARN_MB}MB warning threshold`);
  }

  // Subpackages
  let totalSize = mainPackageSize;
  for (const root of subpackageRoots) {
    const dirName = root.split('/').filter(Boolean)[1];
    if (!dirName) continue;
    const subDir = path.join(MINI_PROGRAM_DIST, 'pages', dirName);
    if (!fs.existsSync(subDir)) continue;
    const subSize = getDirectorySize(subDir);
    const subMB = subSize / BYTES_PER_MB;
    totalSize += subSize;
    console.log(`Subpackage "${dirName}" (uncompressed): ${formatMB(subSize)} MB`);

    if (subMB >= SUBPACKAGE_FAIL_MB) {
      violations.push(`Subpackage "${dirName}" uncompressed ${formatMB(subSize)}MB exceeds ${SUBPACKAGE_FAIL_MB}MB (WeChat limit is 2MB compressed)`);
    } else if (subMB >= SUBPACKAGE_WARN_MB) {
      warnings.push(`Subpackage "${dirName}" uncompressed ${formatMB(subSize)}MB exceeds ${SUBPACKAGE_WARN_MB}MB warning threshold`);
    }
  }

  const totalMB = totalSize / BYTES_PER_MB;
  console.log(`Total uncompressed: ${formatMB(totalSize)} MB`);

  if (totalMB >= TOTAL_FAIL_MB) {
    violations.push(`Total uncompressed ${formatMB(totalSize)}MB exceeds ${TOTAL_FAIL_MB}MB`);
  } else if (totalMB >= TOTAL_WARN_MB) {
    warnings.push(`Total uncompressed ${formatMB(totalSize)}MB exceeds ${TOTAL_WARN_MB}MB warning threshold`);
  }

  if (warnings.length > 0) {
    console.warn('\nBundle size warnings:');
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  if (violations.length > 0) {
    console.error('\nBundle size violations:');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    console.error('\nFor the authoritative compressed-size gate, run:');
    console.error('  npm run check:package-size -w mini-program');
    process.exit(1);
  }

  console.log(`\nBundle size check passed: all packages under ${MAIN_PACKAGE_WARN_MB}MB uncompressed.`);
}

main();
