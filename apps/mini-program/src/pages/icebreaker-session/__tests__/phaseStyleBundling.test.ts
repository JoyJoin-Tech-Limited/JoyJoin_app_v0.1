import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageStyles = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/index.scss'),
  'utf8',
)

const PHASE_HERO_STYLES = [
  'AuctionHeroView',
  'GroupMirrorHeroView',
  'LieDetectiveHeroView',
  'MicroChallengeHeroView',
  'MiniScriptHeroView',
  'PersonalityDiceHeroView',
  'QuipBattleHeroView',
  'SpeedFriendingHeroView',
  'UndercoverWordHeroView',
]

describe('icebreaker phase style bundling', () => {
  it.each(PHASE_HERO_STYLES)('keeps %s in the page WXSS dependency graph', (phaseStyle) => {
    expect(pageStyles).toContain(`@use './phases/${phaseStyle}';`)
  })
})
