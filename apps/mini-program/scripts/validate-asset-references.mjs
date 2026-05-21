#!/usr/bin/env node
/**
 * Build-time asset reference validator for JoyJoin Mini Program.
 *
 * Guarantees that every asset referenced in source code is traceable to
 * either:
 *   (a) a file in src/assets/ (bundled or uploadable), OR
 *   (b) an entry in cdn-asset-manifest.json (declared CDN asset)
 *
 * Run automatically before build:
 *   npm run validate:assets
 *
 * Exit code 0 = all references valid
 * Exit code 1 = orphan references found (breaks build)
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(ROOT, 'src')
const MANIFEST_PATH = path.join(__dirname, 'cdn-asset-manifest.json')

const EXTENSIONS = ['.ts', '.tsx', '.js', '.wxml', '.wxss', '.scss', '.css']
const EXCLUDE_DIRS = ['node_modules', 'dist', '.git', 'assets-source']

// ─── Helpers ────────────────────────────────────────────────────

function formatPath(p) {
  return path.relative(ROOT, p)
}

function walkDir(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.includes(entry.name)) continue
      walkDir(fullPath, callback)
    } else if (entry.isFile() && EXTENSIONS.includes(path.extname(entry.name))) {
      callback(fullPath)
    }
  }
}

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { assets: [], pendingAssets: [] }
  }
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8')
  return JSON.parse(raw)
}

/**
 * Strip JS/TS comments from a line for cleaner scanning.
 * Handles // line comments. Block comments are trickier; we do a basic pass.
 */
function stripComments(line) {
  return line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
}

// ─── Scanners ───────────────────────────────────────────────────

/**
 * Find all asset references in source files.
 * Returns array of { file, line, col, path, type }
 */
function scanAssetReferences() {
  const refs = []
  const cdnAssetRegex = /cdnAsset\s*\(\s*['"`](\/assets\/[^'"`$]+)['"`]/g
  const hardcodedRegex = /['"`](\/assets\/[^'"`$]+\.(?:webp|png|jpg|jpeg|gif|svg|woff2|ttf))['"`]/g
  const wxmlAssetRegex = /src=["']((?:\.\.\/)*assets\/[^"']+)["']/g

  walkDir(SRC_DIR, (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const ext = path.extname(filePath)
    const baseName = path.basename(filePath)

    // Track block comment state for JS/TS files
    let inBlockComment = false

    lines.forEach((line, idx) => {
      const lineNum = idx + 1
      const rawLine = line

      // Skip JSDoc / block comments roughly
      if (ext === '.ts' || ext === '.tsx' || ext === '.js') {
        if (rawLine.trim().startsWith('*') || rawLine.trim().startsWith('/*')) {
          // Heuristic: skip lines that look like comment lines
          if (
            rawLine.includes('/**') ||
            rawLine.includes('*/') ||
            rawLine.trim().startsWith('*')
          ) {
            // Still scan for cdnAsset calls inside comments? No, skip.
            return
          }
        }
      }

      const cleanLine = stripComments(rawLine)

      // cdnAsset('/assets/...') references
      if (ext !== '.wxml' && ext !== '.wxss' && ext !== '.css' && ext !== '.scss') {
        let m
        while ((m = cdnAssetRegex.exec(cleanLine)) !== null) {
          refs.push({
            file: formatPath(filePath),
            line: lineNum,
            col: m.index + 1,
            path: m[1],
            type: 'cdnAsset',
          })
        }
        cdnAssetRegex.lastIndex = 0
      }

      // Hardcoded /assets/... strings (not in cdnAsset)
      // Skip if line contains a helper that wraps cdnAsset (e.g., `p(...)`)
      if (
        ext !== '.wxml' &&
        ext !== '.wxss' &&
        ext !== '.css' &&
        ext !== '.scss' &&
        !cleanLine.includes('cdnAsset') &&
        !cleanLine.match(/\bp\s*\(/) // skip `p('/assets/...')` helper pattern
      ) {
        let m
        while ((m = hardcodedRegex.exec(cleanLine)) !== null) {
          refs.push({
            file: formatPath(filePath),
            line: lineNum,
            col: m.index + 1,
            path: m[1],
            type: 'hardcoded',
          })
        }
        hardcodedRegex.lastIndex = 0
      }

      // wxml relative asset references (native components)
      if (ext === '.wxml' || ext === '.wxss' || ext === '.css' || ext === '.scss') {
        let m
        while ((m = wxmlAssetRegex.exec(rawLine)) !== null) {
          const rawPath = m[1]
          const normalized = rawPath.startsWith('..')
            ? rawPath.replace(/^(\.\.\/)+/, '/')
            : '/' + rawPath
          refs.push({
            file: formatPath(filePath),
            line: lineNum,
            col: m.index + 1,
            path: normalized,
            type: 'wxml_relative',
          })
        }
        wxmlAssetRegex.lastIndex = 0
      }
    })
  })

  return refs
}

// ─── Validation ─────────────────────────────────────────────────

function validate() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║   JoyJoin Mini Program — Asset Reference Validator         ║')
  console.log('╚════════════════════════════════════════════════════════════\n')

  const manifest = readManifest()
  const manifestPaths = new Set(manifest.assets.map((a) => '/' + a.localPath))
  const pendingPaths = new Set((manifest.pendingAssets || []).map((p) => '/' + p))
  const refs = scanAssetReferences()

  let errors = 0
  let warnings = 0

  // ─── Check 1: Orphan references ─────────────────────────────
  const orphanRefs = []
  const hardcodedOrphans = []
  const pendingRefs = []

  for (const ref of refs) {
    const srcPath = path.join(SRC_DIR, ref.path)
    const inSrc = fs.existsSync(srcPath)
    const inManifest = manifestPaths.has(ref.path)
    const inPending = pendingPaths.has(ref.path)

    if (!inSrc && !inManifest) {
      if (inPending) {
        pendingRefs.push(ref)
      } else if (ref.type === 'hardcoded') {
        hardcodedOrphans.push(ref)
      } else {
        orphanRefs.push(ref)
      }
    }
  }

  if (hardcodedOrphans.length > 0) {
    console.log(`❌ HARDCODED ORPHAN PATHS (${hardcodedOrphans.length}) — not in src/assets/ or manifest:`)
    console.log('   These bypass cdnAsset() and will break in production if not bundled.')
    for (const ref of hardcodedOrphans) {
      console.log(`   ${ref.file}:${ref.line}:${ref.col}  →  ${ref.path}`)
    }
    errors += hardcodedOrphans.length
  }

  if (orphanRefs.length > 0) {
    console.log(`\n❌ CDN ORPHAN REFERENCES (${orphanRefs.length}) — not in src/assets/, manifest, or pending:`)
    for (const ref of orphanRefs) {
      console.log(`   ${ref.file}:${ref.line}:${ref.col}  →  ${ref.path}  [${ref.type}]`)
    }
    errors += orphanRefs.length
  }

  if (pendingRefs.length > 0) {
    console.log(`\n⚠️  PENDING ASSET REFERENCES (${pendingRefs.length}) — acknowledged but not yet available:`)
    console.log('   Remove from manifest.pendingAssets once assets are created.')
    for (const ref of pendingRefs.slice(0, 10)) {
      console.log(`   ${ref.file}:${ref.line}:${ref.col}  →  ${ref.path}  [${ref.type}]`)
    }
    if (pendingRefs.length > 10) {
      console.log(`   ... and ${pendingRefs.length - 10} more`)
    }
    warnings += pendingRefs.length
  }

  // ─── Check 2: Manifest entries missing from src/assets/ ─────
  const missingFromSrc = []
  for (const asset of manifest.assets) {
    const srcPath = path.join(SRC_DIR, asset.localPath)
    if (!fs.existsSync(srcPath)) {
      missingFromSrc.push(asset.localPath)
    }
  }

  if (missingFromSrc.length > 0) {
    console.log(`\n⚠️  MANIFEST ENTRIES MISSING FROM src/assets/ (${missingFromSrc.length}):`)
    console.log('   Upload will skip these. Add the files or remove from manifest.')
    for (const p of missingFromSrc) {
      console.log(`   ${p}`)
    }
    warnings += missingFromSrc.length
  }

  // ─── Check 3: cdnAsset refs in src/assets/ but NOT in manifest ─
  const notInManifest = []
  for (const ref of refs) {
    if (ref.type !== 'cdnAsset') continue
    // Skip directory-level base paths (e.g., cdnAsset('/assets/mascot'))
    // These are used as prefixes for runtime-constructed filenames.
    if (!path.extname(ref.path)) continue
    const srcPath = path.join(SRC_DIR, ref.path)
    const inSrc = fs.existsSync(srcPath)
    const inManifest = manifestPaths.has(ref.path)
    if (inSrc && !inManifest && !pendingPaths.has(ref.path)) {
      notInManifest.push(ref)
    }
  }

  if (notInManifest.length > 0) {
    console.log(`\n⚠️  CDN ASSETS NOT IN MANIFEST (${notInManifest.length}):`)
    console.log('   These exist in src/assets/ but are not declared for CDN upload.')
    console.log('   Add them to cdn-asset-manifest.json assets[] to ensure they reach the CDN.')
    for (const ref of notInManifest.slice(0, 10)) {
      console.log(`   ${ref.file}:${ref.line}  →  ${ref.path}`)
    }
    if (notInManifest.length > 10) {
      console.log(`   ... and ${notInManifest.length - 10} more`)
    }
    warnings += notInManifest.length
  }

  // ─── Check 3: Duplicate references ──────────────────────────
  const seen = new Map()
  for (const ref of refs) {
    const key = `${ref.file}:${ref.path}`
    seen.set(key, (seen.get(key) || 0) + 1)
  }
  const dups = Array.from(seen.entries()).filter(([, count]) => count > 1)
  if (dups.length > 0) {
    console.log(`\nℹ️  DUPLICATE REFERENCES (${dups.length} files have repeated paths):`)
    for (const [key] of dups.slice(0, 5)) {
      console.log(`   ${key}`)
    }
    if (dups.length > 5) console.log(`   ... and ${dups.length - 5} more`)
  }

  // ─── Summary ────────────────────────────────────────────────
  console.log('\n────────────────────────────────────────────────────────────')
  console.log(`Total references scanned: ${refs.length}`)
  console.log(`Manifest entries: ${manifest.assets.length}`)
  console.log(`Errors: ${errors}  |  Warnings: ${warnings}`)

  if (errors > 0) {
    console.log('\n❌ VALIDATION FAILED')
    console.log('   Fix the errors above before building.')
    console.log('   Add missing assets to src/assets/ or cdn-asset-manifest.json.')
    process.exit(1)
  }

  console.log('\n✅ ALL ASSET REFERENCES VALID')
  if (warnings > 0) {
    console.log('   (with warnings — review recommended)')
  }
  process.exit(0)
}

validate()
