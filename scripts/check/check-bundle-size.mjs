#!/usr/bin/env node
/**
 * check-bundle-size.mjs
 *
 * CI gate for WeChat mini-program bundle sizes.
 *
 * WeChat limits:
 * - Total package: 4MB (hard stop)
 * - Per sub-package: 2MB (hard stop)
 *
 * JoyJoin thresholds:
 * - Total: warn at 3.8MB
 * - Per page chunk: warn at 1.8MB
 */

import fs from 'node:fs';
import path from 'node:path';

const MINI_PROGRAM_DIST = 'apps/mini-program/dist';

const TOTAL_WARN_MB = 3.8;
const TOTAL_FAIL_MB = 4.0;
const CHUNK_WARN_MB = 1.8;
const CHUNK_FAIL_MB = 2.0;

const BYTES_PER_MB = 1024 * 1024;

function getDirectorySize(dirPath) {
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

function formatMB(bytes) {
  return (bytes / BYTES_PER_MB).toFixed(2);
}

const violations = [];
const warnings = [];

// Check total dist size
if (!fs.existsSync(MINI_PROGRAM_DIST)) {
  console.log(`Bundle size check skipped: ${MINI_PROGRAM_DIST} does not exist (run build first).`);
  process.exit(0);
}

const totalSize = getDirectorySize(MINI_PROGRAM_DIST);
const totalMB = totalSize / BYTES_PER_MB;

if (totalMB >= TOTAL_FAIL_MB) {
  violations.push(`Total bundle size ${formatMB(totalSize)}MB exceeds hard limit ${TOTAL_FAIL_MB}MB`);
} else if (totalMB >= TOTAL_WARN_MB) {
  warnings.push(`Total bundle size ${formatMB(totalSize)}MB exceeds warning threshold ${TOTAL_WARN_MB}MB`);
}

// Check page chunk sizes
const pagesDir = path.join(MINI_PROGRAM_DIST, 'pages');
if (fs.existsSync(pagesDir)) {
  const pageEntries = fs.readdirSync(pagesDir, { withFileTypes: true });
  for (const entry of pageEntries) {
    if (!entry.isDirectory()) continue;
    const chunkPath = path.join(pagesDir, entry.name);
    const chunkSize = getDirectorySize(chunkPath);
    const chunkMB = chunkSize / BYTES_PER_MB;

    if (chunkMB >= CHUNK_FAIL_MB) {
      violations.push(`Page chunk "${entry.name}" ${formatMB(chunkSize)}MB exceeds hard limit ${CHUNK_FAIL_MB}MB`);
    } else if (chunkMB >= CHUNK_WARN_MB) {
      warnings.push(`Page chunk "${entry.name}" ${formatMB(chunkSize)}MB exceeds warning threshold ${CHUNK_WARN_MB}MB`);
    }
  }
}

// Report
if (warnings.length > 0) {
  console.warn('Bundle size warnings:');
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

if (violations.length > 0) {
  console.error('Bundle size violations:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`Bundle size check passed: total ${formatMB(totalSize)}MB, all chunks under ${CHUNK_WARN_MB}MB.`);
