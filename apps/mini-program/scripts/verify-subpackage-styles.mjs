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
  {
    // Pool-registration mascot section (2026-08-05): the dedicated 悦仔 row
    // for Steps 1–3 lives in the pool-registration subpackage page — its SCSS
    // is @use'd by the page SCSS and must reach the page WXSS, or the mascot
    // row renders unstyled on device (same subpackage style-splitting trap as
    // the my-image stage and squad-unboxing incidents). The PoolTeaserStrip
    // light-up sweep (Phase 3, 2026-08-05) is guarded here too.
    page: 'pages/pool-registration/index.wxss',
    selectors: [
      'pool-reg-mascot{',
      'pool-reg-mascot__mascot-wrap{',
      'pool-reg-mascot__bubble{',
      'pool-reg-mascot__bubble-text{',
      'pool-teaser__track{',
      'pool-teaser-node-light',
      // 双人成行 (2026-08-07): duo card / info sheet / invitee banner SCSS is
      // @use'd by the page SCSS and must reach the page WXSS.
      'pool-reg-duo{',
      'pool-reg-duo__segmented{',
      'pool-reg-duo__segmented-thumb{',
      'pool-reg-duo-banner{',
      'duo-info-sheet__surface{',
    ],
  },
  {
    // Gathering room (集结房间, 2026-08-09): the room page is its own subpackage;
    // the scene SCSS is @use'd by the page SCSS and must reach the page WXSS
    // or the pixel room renders unstyled on device (same style-splitting trap
    // as the my-image stage and squad-unboxing incidents).
    page: 'pages/gathering-room/index.wxss',
    selectors: [
      'gathering-room-scene{',
      'gathering-room-scene__seat-shadow{',
      'gathering-room-scene__seat{',
      'gathering-room__action-bar{',
      'gathering-room__sheet{',
    ],
  },
  {
    // S10 gyro-parallax spike (2026-08-11): the wrapper rules are @use'd by
    // the page SCSS and must reach the page WXSS even though the runtime flag
    // defaults off — CSS presence is independent of the module-local gate.
    // S2 mood field (2026-08-11): same guard for the ambient-field layers and
    // the hairline fragment — flag (icebreakerMoodFieldEnabled) defaults off,
    // but the rules must exist in the page WXSS for flag-on to work on device.
    page: 'pages/icebreaker-session/index.wxss',
    selectors: [
      'gyro-parallax{',
      'gyro-parallax--tracking{',
      'icebreaker__field{',
      'icebreaker__field-layer--cool{',
      'icebreaker__field-layer--warm{',
      'icebreaker__field-fragment{',
      // S2 RM paint-order fix (2026-08-11): under reduced-motion the phase
      // shell loses its entrance transform (its only stacking context), so
      // the field's opaque base layer would paint over the phase UI. This
      // scoped stacking rule is the fix — it must reach the page WXSS.
      '.icebreaker--mood-field .icebreaker__phase-shell{position:relative',
      // S3 glance-stack pilot + S8 handshake ritual (2026-08-11): same guard —
      // the L1/L2/L3 card zones, the hold-to-peek, and the ritual surface are
      // @use'd via styles/_glance-stack.scss and must reach the page WXSS.
      'phase-hero-card__l1{',
      'glance-peek__trigger{',
      'handshake-ritual{',
      'handshake-beat{',
      'icebreaker__waiting-l1-word{',
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
