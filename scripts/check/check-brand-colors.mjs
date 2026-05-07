#!/usr/bin/env node
/**
 * Brand Color Guardrail — scans mini-program SCSS files for ad-hoc hex colors.
 *
 * Purpose: enforce that all colors use brand tokens from _variables.scss.
 * Only approved hex values (brand palette + standard neutrals) are allowed.
 *
 * Usage:
 *   node scripts/check/check-brand-colors.mjs
 *
 * Exit code:
 *   0 = all clean
 *   1 = violations found
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const MINI_PROGRAM_SRC = 'apps/mini-program/src'

// Approved hex colors that may appear in SCSS files.
// All other hex colors must be expressed via SCSS variables.
const ALLOWED_HEX_COLORS = new Set([
  // Brand primary
  '#8B5CF6',
  '#7C3AED',
  '#EDE9FE',
  // Brand secondary
  '#FF6B9D',
  '#FF9B85',
  // Standard neutrals (also in _variables.scss)
  '#FAFAFA',
  '#FFFFFF',
  '#2D3142',
  '#6B7280',
  '#9CA3AF',
  '#A86BFF',
  '#E2E5ED',
  '#F3F4F6',
  // Semantic colors
  '#2ECC71',
  '#F0A030',
  '#EF4444',
  // Legacy WeChat green (for WeChat auth button)
  '#07c160',
  '#07C160',
  // WeChat Pay bright green variant
  '#15D16F',

  // ─── Intentional design-system extensions ────────────────────────
  // These are domain-specific color tokens that are intentionally hardcoded
  // because they represent unique design concepts not captured by brand variables.

  // Achievement tier colors (AchievementPopup)
  '#D1D5DB',   // silver/unranked
  '#EFF6FF',   // blue tier bg
  '#60A5FA',   // blue tier accent
  '#2563EB',   // blue tier strong
  '#F5F3FF',   // purple tier bg
  '#A78BFA',   // purple tier accent
  '#FFFBEB',   // gold tier bg
  '#FEF3C7',   // gold tier light
  '#F59E0B',   // gold tier accent
  '#D97706',   // gold tier strong

  // Icebreaker session phase theme colors
  '#92400E',   // amber-800 (warm phase text)
  '#FFFBEB',   // amber-50 (warm phase bg)
  '#FEF3C7',   // amber-100 (warm phase bg)
  '#FDE68A',   // amber-200 (warm phase accent)
  '#ECFEFF',   // cyan-50 (cool phase bg)
  '#CFFAFE',   // cyan-100 (cool phase bg)
  '#A5F3FC',   // cyan-200 (cool phase accent)
  '#1E1B4B',   // indigo-950 (dark phase bg)
  '#4C1D95',   // violet-900 (dark phase bg)
  '#2E1065',   // violet-950 (dark phase bg)
  '#DDD6FE',   // violet-200 (dark phase accent)

  // Personality test results — gold badge / achievement colors
  '#FFD55E',   // gold highlight
  '#23123D',   // deep purple text
  '#FFF7D6',   // gold tint bg
  '#7A5A09',   // dark gold text
  '#FBBF24',   // amber-400
  '#F97316',   // orange-500
  '#BF953F',   // metallic gold
  '#FCF6BA',   // light gold
  '#B38728',   // bronze gold
  '#FBF5B7',   // pale gold
  '#AA771C',   // antique gold
  '#4A2E00',   // deep brown gold

  // Discover category accent colors
  '#F59E0B',   // amber/warm accent
  '#06B6D4',   // cyan/cool accent

  // Landing page feature card colors
  '#B83A5E',   // rose feature
  '#1E7A4D',   // emerald feature
  '#7B6A96',   // muted purple
  '#8B7AAD',   // soft purple
  '#111111',   // near-black (checked state)
  '#6B5B8D',   // dusty purple
])

// Regex to find hex colors in SCSS
// Matches: #FFF, #fff, #FFFFFF, #ffffff, #ffffffff (with alpha)
const HEX_COLOR_REGEX = /#([0-9a-fA-F]{3,8})\b/g

// Files to skip (generated, vendor, etc.)
const SKIP_FILES = new Set([])

// Source-of-truth files that define the palette are exempt from checking
const EXEMPT_FILES = [
  '_variables.scss',   // Defines the canonical brand palette
]

function findScssFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      findScssFiles(fullPath, files)
    } else if (stat.isFile() && extname(entry) === '.scss') {
      files.push(fullPath)
    }
  }
  return files
}

function extractHexColors(content) {
  const colors = new Set()
  let match
  while ((match = HEX_COLOR_REGEX.exec(content)) !== null) {
    // Normalize to 6-char uppercase
    const hex = match[0].toUpperCase()
    colors.add(hex)
  }
  return colors
}

function main() {
  const scssFiles = findScssFiles(MINI_PROGRAM_SRC)
  let totalViolations = 0
  const violations = []

  for (const filePath of scssFiles) {
    const fileName = filePath.split('/').pop()
    if (EXEMPT_FILES.includes(fileName)) continue

    const content = readFileSync(filePath, 'utf-8')
    const colors = extractHexColors(content)
    const badColors = [...colors].filter((c) => !ALLOWED_HEX_COLORS.has(c))

    if (badColors.length > 0) {
      totalViolations += badColors.length
      violations.push({ file: filePath, colors: badColors })
    }
  }

  if (violations.length === 0) {
    console.log(`✅ Brand color guardrail passed: ${scssFiles.length} SCSS files scanned, no ad-hoc hex colors found.`)
    process.exit(0)
  }

  console.error(`❌ Brand color guardrail failed: ${totalViolations} violation(s) in ${violations.length} file(s).`)
  console.error('\nOnly these hex colors are allowed in SCSS:')
  console.error([...ALLOWED_HEX_COLORS].sort().join(', '))
  console.error('\nViolations:')
  for (const v of violations) {
    console.error(`  ${v.file}`)
    for (const c of v.colors) {
      console.error(`    → ${c}`)
    }
  }
  console.error('\nFix: replace ad-hoc hex colors with SCSS variables from _variables.scss.')
  process.exit(1)
}

main()
