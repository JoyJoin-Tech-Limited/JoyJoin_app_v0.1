import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageStyles = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/index.scss'),
  'utf8',
)

const PHASE_STYLES = [
  './phases/AuctionHeroView',
  './phases/GroupMirrorHeroView',
  './phases/LieDetectiveHeroView',
  './phases/MicroChallengeHeroView',
  './phases/MiniScriptHeroView',
  './phases/PersonalityDiceHeroView',
  './phases/QuipBattleHeroView',
  './phases/RecapPhaseView',
  './phases/SpeedFriendingHeroView',
  './phases/UndercoverWordHeroView',
  './phases/WarmupPhaseView',
]

// 2026-08-17 sub-common stranding incident: these component styles were
// chunked into the page-invisible sub-common.wxss and rendered unstyled on
// device. They must stay @use'd in the page SCSS.
const COMPONENT_STYLES = [
  './components/IcebreakerTierSelector',
  './components/IcebreakerTierSheet',
  './components/PhaseHeroCard',
  './components/WarmupActionBar',
  './components/WarmupCardSlot',
  './components/WarmupCelebrationOverlay',
  './components/WarmupEmberRim',
  './components/WarmupPresenceStrip',
  './components/WarmupWelcomeBand',
]

// Shared gesture/reveal primitives used only inside this subpackage — same
// stranding guard. These use the `as *` form with explicit extension.
const SHARED_STYLES = [
  '../../components/gesture/SwipeCard.scss',
  '../../components/gesture/TapReaction.scss',
  '../../components/gesture/TapRhythm.scss',
  '../../components/reveal/CardFlip.scss',
  '../../components/reveal/IdentityReveal.scss',
]

describe('icebreaker phase style bundling', () => {
  it.each([...PHASE_STYLES, ...COMPONENT_STYLES])(
    'keeps %s in the page WXSS dependency graph',
    (stylePath) => {
      expect(pageStyles).toContain(`@use '${stylePath}';`)
    },
  )

  it.each(SHARED_STYLES)('keeps shared %s in the page WXSS dependency graph', (stylePath) => {
    expect(pageStyles).toContain(`@use '${stylePath}' as *;`)
  })
})
