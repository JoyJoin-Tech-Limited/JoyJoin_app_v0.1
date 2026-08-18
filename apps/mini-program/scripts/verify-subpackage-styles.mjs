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
    // 桌友 card-deck reskin (2026-08-15): TablemateCard styles are @use'd by
    // the matching-status page SCSS so the 桌友卡 carousel rules compile into
    // the subpackage page WXSS — the shared component's own chunk may never
    // load there (same style-splitting trap as the incidents above).
    page: 'pages/matching-status/index.wxss',
    selectors: [
      'tablemate-card__art{',
      'tablemate-card__temp-chip{',
      'matching-status__overlay-member-carousel',
      // 成员详情浮层 (2026-08-16): the reveal overlay + squad card open
      // TablemateDetailSheet; its rules are @use'd by the page SCSS and must
      // reach this subpackage page WXSS.
      'tablemate-sheet__surface{',
      // ConnectionPointPill styles are co-compiled through TablemateCard's own
      // @use; guard the pill tiers so a chunking regression can't blank them.
      'pill--common',
      'pill--rare',
      'pill--epic',
    ],
  },
  {
    // 桌友 card-deck reskin: pool-group-detail moved into its own subpackage
    // (2026-08-16, main package 2048KB source-size budget), so its page WXSS
    // needs the card + pill rules co-compiled from the deck strip — the shared
    // component chunk may never load inside the subpackage.
    page: 'pages/pool-group-detail/index.wxss',
    selectors: [
      'tablemate-card__art{',
      'tablemate-card__temp-chip{',
      'pool-group-detail__deck-track',
      // 成员详情浮层 (2026-08-16): deck card taps open TablemateDetailSheet.
      'tablemate-sheet__surface{',
      'pill--common',
      'pill--rare',
      'pill--epic',
    ],
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
      // 2026-08-17 sub-common stranding incident: the per-subpackage chunking
      // (config/miniProgramChunks.ts) moved every component-level SCSS import
      // of this page into pages/icebreaker-session/sub-common.wxss, which no
      // page ever loads — all game views rendered unstyled on device. These
      // selectors anchor the @use'd legacy PhaseHeroCard frame, the warmup
      // component family, and the recap view in the page WXSS.
      'phase-hero-card__header-rail{',
      'phase-hero-card__emblem{',
      'warmup-card-slot__content',
      'warmup-ember-rim',
      'warmup-celebration',
      'warmup-action',
      'warmup-presence__',
      'warmup-welcome__',
      'icebreaker__recap-hero{',
      'icebreaker__recap-connect-btn{',
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

// Generic stranding gate (2026-08-17): the per-subpackage manualChunks rule
// emits a sub-common.wxss per subpackage, but no page WXSS ever references it
// — WeChat applies only the page's own WXSS plus the app.wxss chain. Any rule
// that lands there is invisible on device (the icebreaker-session incident:
// every phase hero + warmup component rendered unstyled). A non-empty
// sub-common.wxss therefore fails the build; the fix is to `@use` the
// component SCSS in the consuming page's SCSS and drop the TSX-side import.
function collectSubCommonWxss(dir) {
  const found = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...collectSubCommonWxss(full))
    } else if (entry.name === 'sub-common.wxss') {
      found.push(full)
    }
  }
  return found
}
for (const file of collectSubCommonWxss(DIST_ROOT)) {
  const content = fs.readFileSync(file, 'utf8').replace('@charset "UTF-8";', '').trim()
  if (content.length > 0) {
    console.error(`✗ ${path.relative(DIST_ROOT, file)} contains ${content.length} bytes of unreachable styles`)
    console.error('  No page loads sub-common.wxss — `@use` the stranded component SCSS in the consuming')
    console.error('  page SCSS and remove the matching `import \'./X.scss\'` from the component TSX.')
    failed = true
  } else {
    console.log(`✓ ${path.relative(DIST_ROOT, file)}: empty (no stranded styles)`)
  }
}

process.exit(failed ? 1 : 0)
