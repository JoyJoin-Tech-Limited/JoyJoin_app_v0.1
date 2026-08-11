#!/usr/bin/env node
/**
 * Avatar3D import-cone guard (2026-08-11).
 *
 * `config/index.ts` routes the whole three.js + avatar3d import cone
 * (`AVATAR_3D_CHUNK_NAME = 'pages/profile-linked/three-avatar'`) into the
 * profile-linked subpackage. WeChat forbids cross-subpackage file access,
 * so ANY module outside that cone that statically imports three /
 * avatar3d / PixelAvatar3D drags the chunk into its own package and blanks
 * the page at runtime ("Component is not found in path wx://not-found").
 *
 * Regression: the K3 WebGL spike (2026-08-01) imported three from the
 * results page (onboarding subpackage), blanking 原型揭晓 on device.
 *
 * This guard fails the build when a non-allowed file imports the cone.
 * Allowed importers:
 *   - cone internals:   src/lib/profile/avatar3d/*, src/components/profile/PixelAvatar3D.tsx
 *   - consumer pages:   src/pages/profile-linked/** (my-image, qa3d)
 * Test files are excluded (never bundled).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC_ROOT = resolve(fileURLToPath(new URL('../src', import.meta.url)))

const CONE_TARGET_PATTERNS = [
  // `from 'three'` / `from 'three/examples/jsm/...'` / `require('three...')`
  /(?:from\s+|require\(\s*)['"](?:three(?:\/[^'"]*)?)['"]/,
  // any specifier containing the avatar3d lib path or the PixelAvatar3D component
  /(?:from\s+|require\(\s*)['"][^'"]*(?:avatar3d|PixelAvatar3D)[^'"]*['"]/,
]

const ALLOWED_PATH_PREFIXES = [
  join('lib', 'profile', 'avatar3d'),
  join('components', 'profile', 'PixelAvatar3D'),
  join('pages', 'profile-linked'),
]

const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx|js|jsx)$/
const SCAN_FILE_RE = /\.(ts|tsx)$/

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '__tests__') continue
      walk(full, out)
    } else if (SCAN_FILE_RE.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const violations = []

for (const file of walk(SRC_ROOT)) {
  const rel = relative(resolve(SRC_ROOT, '..'), file)
  if (TEST_FILE_RE.test(file)) continue
  const relFromSrc = relative(SRC_ROOT, file).split('\\').join('/')
  if (ALLOWED_PATH_PREFIXES.some(
    (prefix) => relFromSrc === prefix || relFromSrc.startsWith(`${prefix}/`) || relFromSrc.startsWith(`${prefix}.`),
  )) {
    continue
  }

  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (line.trim().startsWith('//')) continue
    for (const pattern of CONE_TARGET_PATTERNS) {
      if (pattern.test(line)) {
        violations.push(`${rel}:${i + 1}: ${line.trim().slice(0, 140)}`)
      }
    }
  }
}

if (violations.length > 0) {
  console.error('[check:avatar3d-import-cone] FAIL — imports into the avatar3d/three cone found outside profile-linked:')
  for (const v of violations) console.error(`  ${v}`)
  console.error(
    '\nWeChat forbids cross-subpackage requires; the chunk lands in pages/profile-linked/three-avatar.js',
    '(config/index.ts AVATAR_3D_CHUNK_NAME). Move the importer into pages/profile-linked/ or',
    'quarantine the feature. Test files are exempt.',
  )
  process.exit(1)
}

console.log('[check:avatar3d-import-cone] PASS — avatar3d/three cone confined to profile-linked')
