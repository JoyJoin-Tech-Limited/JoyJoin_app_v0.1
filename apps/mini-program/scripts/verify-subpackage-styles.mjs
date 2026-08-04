#!/usr/bin/env node
/**
 * verify-subpackage-styles.mjs
 *
 * Subpackage style splitting (Taro/vite chunk graph) can silently move a
 * component's WXSS into a chunk the page never loads — WeChat applies only the
 * page's own WXSS plus the app.wxss chain. This regression blanked the
 * my-image stage for all 11 non-spider archetypes (2026-07-21): the V2
 * composite rules were chunked into the unreachable
 * `pages/profile-linked/three-avatar.wxss`.
 *
 * The fix is to `@use` the component SCSS inside the page SCSS so the rules
 * are compiled into the page WXSS itself. This script fails the build when a
 * required selector is missing from the page WXSS, so the regression cannot
 * come back silently.
 *
 * Run after `npm run build:weapp` (it reads dist/ output).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_ROOT = path.resolve(__dirname, '..', 'dist')

const AVATAR_STAGE_SELECTORS = [
  'pixel-avatar-3d',
  'pixel-avatar-composite',
  // The 3D boot failure / non-spider path renders the V2 composite inside
  // this wrapper; if its rules are chunked away the fallback stage blanks.
  'pixel-avatar-3d__fallback-stage',
  // PixelAvatarFallback.scss uses the `pixel-avatar` root class (not
  // `pixel-avatar-fallback`); `--pixel-fur` is its unique custom property.
  '--pixel-fur',
]

const REQUIREMENTS = [
  {
    page: 'pages/profile-linked/my-image/index.wxss',
    selectors: [...AVATAR_STAGE_SELECTORS, 'my-image__stage', 'identity-stage'],
  },
  {
    page: 'pages/profile-linked/my-image/qa3d/index.wxss',
    selectors: [...AVATAR_STAGE_SELECTORS],
  },
  {
    // Second blank-stage trap (2026-07-23): IdentityStageScene sizes itself
    // with `height: 100%`, which never resolves against a parent that only
    // declares `min-height` — the scene collapses to 0 height and its
    // overflow:hidden clips the entire identity card. The Profile stage must
    // keep an explicit `height` next to its `min-height`.
    page: 'pages/profile/index.wxss',
    selectors: ['profile-page__identity-stage{position:relative;height:728rpx'],
  },
  {
    // Zero-CSS regression (2026-07-26): SquadTableCard + the table-transition
    // line shipped with NO stylesheet at all (the "giant circles" incident) —
    // their classes now live in the page SCSS and must reach the page WXSS.
    page: 'pages/squad-unboxing/index.wxss',
    selectors: [
      'squad-unboxing__table-card-head{',
      'squad-unboxing__table-card-save{',
      'squad-unboxing__table-transition{',
    ],
  },
  {
    // Component-level defense for the same trap: the scene root inherits the
    // host's computed min-height so future min-height-only hosts stay open.
    page: 'common.wxss',
    selectors: ['.identity-stage{position:relative;width:100%;height:100%;min-height:inherit'],
  },
  {
    // Zero-CSS regression (2026-08-03): the JoyJoinIntroFlow overlay
    // (FlowShell / ExperienceEntryFlow / ExperienceDetail) was only styled in
    // the H5 preview harness — no real page @use'd flow-animation/index.scss,
    // so the entire intro flow rendered with default WeChat chrome on device.
    page: 'pages/onboarding/profile-review/index.wxss',
    selectors: [
      '.flow-shell{',
      'flow-shell__skip{',
      'experience-banner__title{',
      '.experience-detail{',
    ],
  },
]

let failed = false
for (const { page, selectors } of REQUIREMENTS) {
  const file = path.join(DIST_ROOT, page)
  if (!fs.existsSync(file)) {
    console.error(`✗ missing build output: ${page} — run \`npm run build:weapp -w mini-program\` first`)
    failed = true
    continue
  }
  const wxss = fs.readFileSync(file, 'utf8')
  const missing = selectors.filter((selector) => !wxss.includes(selector))
  if (missing.length > 0) {
    console.error(`✗ ${page} is missing required selectors: ${missing.join(', ')}`)
    console.error('  Subpackage style-splitting regression: `@use` the component SCSS in the page SCSS')
    console.error('  (see the header comment of apps/mini-program/src/pages/profile-linked/my-image/index.scss).')
    failed = true
  } else {
    console.log(`✓ ${page}: ${selectors.length} required selectors present`)
  }
}

process.exit(failed ? 1 : 0)
