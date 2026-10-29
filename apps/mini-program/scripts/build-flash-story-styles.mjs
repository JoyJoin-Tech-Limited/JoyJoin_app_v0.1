#!/usr/bin/env node
/**
 * Generate the per-page Flash story stylesheets.
 *
 * WHY THIS EXISTS
 * ---------------
 * Taro/Vite hoists a CSS *module file* into the root `common.wxss` (main
 * package) as soon as that file is reachable from **two or more page
 * entries**. `common.wxss` is charged against WeChat's 2 MB main-package
 * source limit, so anything subpackage-only that lands there is wasted
 * budget.
 *
 * Both live Flash dialogue routes render the same `FlashDialoguePage`:
 *   - pages/alang/dialogue/index        (alangDialogue)
 *   - pages/alang-story/dialogue/index  (alangLaterDialogue)
 *
 * So a single shared `flash-story.scss` + the nine `story-unit/*.scss`
 * partials are always reached by two page entries and always get hoisted.
 * Giving each page its own *file path* is not enough either — the shared
 * leaf partials still escalate.
 *
 * The only mechanism that keeps the rules page-local is physical duplication
 * of the rule text, which is what this script produces:
 *   src/pages/alang/dialogue/story.scss
 *   src/pages/alang-story/dialogue/story.scss
 *
 * Each output is a distinct module (different path) reachable from exactly one
 * page entry, so neither is hoisted.
 *
 * The source partials MUST stay on disk: several tests read them directly by
 * path (AtuanLaterActExperience.test.tsx, LaterActStoryExperience.test.tsx,
 * FlashFirstActContract.test.ts). They are simply no longer imported by the
 * build.
 *
 * USAGE
 *   node scripts/build-flash-story-styles.mjs          # (re)generate
 *   node scripts/build-flash-story-styles.mjs --check   # fail if out of date
 */

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

/** Ordered sources: the shared story split first, then the story-unit partials. */
const SOURCES = [
  'src/pages/alang/flash-story.scss',
  'src/components/alang/story-unit/AlangFirstActExperience.scss',
  'src/components/alang/story-unit/AtuanLaterActExperience.scss',
  'src/components/alang/story-unit/FirstActAtuanTemplateExperience.scss',
  'src/components/alang/story-unit/FirstActDialogueChrome.scss',
  'src/components/alang/story-unit/FirstActHighlightOverlay.scss',
  'src/components/alang/story-unit/LaterActStoryExperience.scss',
  'src/components/alang/story-unit/LiziFirstActExperience.scss',
  'src/components/alang/story-unit/MomoFirstActExperience.scss',
  'src/components/alang/story-unit/ShiqiFirstActExperience.scss',
]

/**
 * page stylesheet path -> relative prefix used to reach src/styles/variables.
 *
 * `routeId` feeds the page-identity marker at the end of each output. Without
 * it the two generated stylesheets are byte-identical, and the bundler emits a
 * single CSS asset for both: `pages/alang-story/dialogue/index.wxss` was
 * produced while `pages/alang/dialogue/index.wxss` was missing entirely, which
 * would render the first-act dialogue route unstyled on device (observed
 * 2026-10-29). A one-declaration marker keeps the two modules distinct.
 */
const TARGETS = [
  { file: 'src/pages/alang/dialogue/story.scss', stylesPrefix: '../../../styles', routeId: 'alang-dialogue' },
  { file: 'src/pages/alang-story/dialogue/story.scss', stylesPrefix: '../../../styles', routeId: 'alang-story-dialogue' },
]

const USE_VARIABLES = /^\s*@use\s+['"][^'"]*styles\/variables['"]\s+as\s+\*\s*;\s*$/

function stripVariablesUse(source, file) {
  const lines = source.split('\n')
  const index = lines.findIndex((line) => USE_VARIABLES.test(line))
  if (index === -1) {
    throw new Error(`${file}: expected a leading "@use '...styles/variables' as *;" line`)
  }
  const remaining = lines.slice(index + 1)
  // Guard against any other at-rule that would reintroduce a shared module.
  remaining.forEach((line, offset) => {
    if (/^\s*@(use|import|forward)\b/.test(line)) {
      throw new Error(
        `${file}:${index + offset + 2}: unexpected "${line.trim()}" — only one ` +
          `variables @use line is allowed in a Flash story source partial`,
      )
    }
  })
  return remaining.join('\n').trim()
}

function render({ stylesPrefix, routeId }) {
  const header = [
    '// GENERATED FILE — do not edit by hand.',
    '// Run `node scripts/build-flash-story-styles.mjs` to regenerate.',
    '//',
    '// The Flash story rules are duplicated into this page stylesheet on purpose:',
    '// Taro hoists any CSS module reached by two or more page entries into the root',
    '// common.wxss (main package, 2 MB WeChat budget). Both dialogue routes render',
    '// the same FlashDialoguePage, so sharing the partials always hoists them.',
    '// Each page owning a physically distinct copy keeps the rules in its subpackage.',
    '',
    `@use '${stylesPrefix}/variables' as *;`,
    '',
  ].join('\n')

  const bodies = SOURCES.map((relative) => {
    const absolute = path.join(ROOT, relative)
    const body = stripVariablesUse(readFileSync(absolute, 'utf8'), relative)
    return [
      `// ---------------------------------------------------------------------------`,
      `// from ${relative}`,
      `// ---------------------------------------------------------------------------`,
      body,
      '',
    ].join('\n')
  })

  const marker = [
    '',
    '// ---------------------------------------------------------------------------',
    '// Page-identity marker — intentional, do not remove.',
    '// ---------------------------------------------------------------------------',
    '// Both dialogue routes ship the same rule text. Two byte-identical',
    '// stylesheets collapse onto a single emitted CSS asset, which left',
    '// pages/alang/dialogue with no .wxss at all (2026-10-29). This inert token',
    '// keeps each copy unique. It styles nothing and is never applied.',
    `.flash-story-route--${routeId} {`,
    `  --flash-story-route: ${routeId};`,
    '}',
    '',
  ].join('\n')

  return header + bodies.join('\n') + marker
}

const checkOnly = process.argv.includes('--check')
let drifted = 0

for (const target of TARGETS) {
  const absolute = path.join(ROOT, target.file)
  const expected = render(target)

  if (checkOnly) {
    let actual = ''
    try {
      actual = readFileSync(absolute, 'utf8')
    } catch {
      actual = ''
    }
    if (actual !== expected) {
      drifted += 1
      console.error(`[flash-story-styles] STALE: ${target.file}`)
    }
    continue
  }

  writeFileSync(absolute, expected)
  console.log(`[flash-story-styles] wrote ${target.file} (${Buffer.byteLength(expected)} B)`)
}

if (checkOnly) {
  if (drifted > 0) {
    console.error(
      `[flash-story-styles] ${drifted} page stylesheet(s) are out of date with the source ` +
        `partials. Run: node scripts/build-flash-story-styles.mjs`,
    )
    process.exit(1)
  }
  console.log('[flash-story-styles] up to date')
}
