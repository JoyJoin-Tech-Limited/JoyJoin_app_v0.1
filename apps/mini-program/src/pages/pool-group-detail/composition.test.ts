// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8')
const scssSource = readFileSync(new URL('./index.scss', import.meta.url), 'utf8')

describe('pool-group-detail deck strip composition', () => {
  it('opens the member detail sheet on card tap instead of scrolling to a row', () => {
    expect(pageSource).toContain("import TablemateDetailSheet from '../../components/TablemateDetailSheet'")
    expect(pageSource).toContain('<TablemateDetailSheet')
    expect(pageSource).toContain('onTap={() => setSheetMemberId(member.userId)}')
    expect(pageSource).not.toContain('scrollToMemberId')
    expect(pageSource).not.toContain('handleDeckCardTap')
  })

  it('keeps the full member list collapsed behind an explicit toggle', () => {
    expect(pageSource).toContain('isMemberListExpanded')
    expect(pageSource).toContain('完整名单 (')
    expect(pageSource).toContain("aria-expanded={isMemberListExpanded}")
    expect(pageSource).toContain('{isMemberListExpanded ? (')
  })

  it('scopes the deal-once cache per group and member', () => {
    expect(pageSource).toContain('dealKey={`pgd-${groupId}-${member.userId}`}')
  })

  it('labels the deck as a horizontally scrollable region for screen readers', () => {
    expect(pageSource).toContain("aria-label='桌友卡片，左右滑动浏览'")
  })

  it('shows the scroll hint only while the deck may overflow and has not scrolled', () => {
    expect(pageSource).toContain('{!deckHasScrolled && deckMayOverflow ? (')
    expect(pageSource).toContain('左滑看更多')
    // Real overflow measurement replaces the length heuristic once mounted.
    expect(pageSource).toContain('createSelectorQuery')
    expect(pageSource).toContain('scroll.scrollWidth > rect.width + 8')
  })

  it('renders progress dots that track the active card', () => {
    expect(pageSource).toContain("'pool-group-detail__deck-dot'")
    expect(pageSource).toContain("'pool-group-detail__deck-dot--active'")
    expect(pageSource).toContain('clampedActiveDeckIndex')
    expect(scssSource).toContain('&__deck-dots {')
    expect(scssSource).toContain('transform: scale(1.25);')
  })

  it('marks the viewer row with an inset accent bar, not a border fight', () => {
    expect(scssSource).toContain('box-shadow: $shadow-sm, inset 6rpx 0 0 $color-primary;')
  })

  it('caps member-row interest tags at three plus a +N overflow chip', () => {
    expect(pageSource).toContain(".slice(0, 3)")
    expect(pageSource).toContain("'pool-group-detail__member-tag pool-group-detail__member-tag--more'")
    expect(scssSource).toContain('&--more {')
  })

  it('disables the hint pulse and dot transitions under reduced motion', () => {
    expect(scssSource).toContain('.pool-group-detail__deck-hint,')
    expect(scssSource).toContain('.pool-group-detail__deck-dot {')
    expect(scssSource).toContain('@keyframes pgd-deck-hint-pulse')
  })
})
