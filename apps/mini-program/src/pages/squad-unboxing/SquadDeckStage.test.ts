// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEAL_ACTIVE_BUDGET_MS,
  DEAL_ANTICIPATION_MS,
  DEAL_CARD_ENTER_MS,
  DEAL_STAGGER_MAX_MS,
  computeDealActiveMs,
  computeDealStaggerMs,
  computeDealTotalMs,
} from './squadDealTiming'
import {
  FAN_CARD_SIZE_BY_COUNT,
  FAN_CONTENT_WIDTH_RPX,
  FAN_OVERLAP_RPX,
  FAN_ROTATIONS_BY_ROW_LENGTH,
  FAN_SAFE_INSET_RPX,
} from './computeFanLayout'

// "Cascading Hand Fan" revealed state. The deal must fit its ≤600ms active
// budget for every realistic member count, and the SCSS geometry maps must
// stay byte-aligned with computeFanLayout.ts (drift lock). Locked strategy:
// docs/deliberations/2026-07-13-squad-unboxing-fan-revamp-locked.md

const here = dirname(fileURLToPath(import.meta.url))

describe('squadDealTiming — deal budget', () => {
  it('compresses the stagger so the active deal never exceeds 600ms', () => {
    for (let count = 1; count <= 12; count += 1) {
      expect(computeDealActiveMs(count)).toBeLessThanOrEqual(DEAL_ACTIVE_BUDGET_MS)
    }
  })

  it('caps per-card stagger at 150ms and keeps the tactile floor in the product domain', () => {
    for (let count = 2; count <= 12; count += 1) {
      expect(computeDealStaggerMs(count)).toBeLessThanOrEqual(DEAL_STAGGER_MAX_MS)
    }
    // The budget is authoritative (no hard floor), but within the real
    // domain of ≤8-member tables the stagger stays above the ~40ms floor.
    for (let count = 2; count <= 8; count += 1) {
      expect(computeDealStaggerMs(count)).toBeGreaterThanOrEqual(40)
    }
  })

  it('gives a single card no stagger and a lone-card deal of one entrance', () => {
    expect(computeDealStaggerMs(1)).toBe(0)
    expect(computeDealActiveMs(1)).toBe(DEAL_CARD_ENTER_MS)
  })

  it('spreads two cards across the full budget', () => {
    // (600 - 260) / (2 - 1) = 340 → clamped to the 150ms max.
    expect(computeDealStaggerMs(2)).toBe(DEAL_STAGGER_MAX_MS)
  })

  it('total deal time is the anticipation beat plus the active deal', () => {
    for (let count = 1; count <= 8; count += 1) {
      expect(computeDealTotalMs(count)).toBe(
        DEAL_ANTICIPATION_MS + computeDealActiveMs(count),
      )
    }
  })

  it('monotonically compresses stagger as the table grows', () => {
    let previous = Number.POSITIVE_INFINITY
    for (let count = 2; count <= 8; count += 1) {
      const stagger = computeDealStaggerMs(count)
      expect(stagger).toBeLessThanOrEqual(previous)
      previous = stagger
    }
  })
})

// Structure: the stage renders the fan (two-row, rotated, overlapping) with a
// face-up deal, per-card haptic, one-shot peek, best-partner stamp, and a
// swipe-back reset — and must NOT reintroduce selector-query measurement or the
// flat-row / chip-strip layout.
describe('SquadDeckStage structure (Cascading Hand Fan)', () => {
  const source = readFileSync(resolve(here, 'SquadDeckStage.tsx'), 'utf8')

  it('computes the fan layout from the pure module', () => {
    expect(source).toContain("from './computeFanLayout'")
    expect(source).toContain('computeFanLayout(displayMembers.length)')
  })

  it('deals every card face-up (flip derived from dealt, not focus)', () => {
    expect(source).toContain('isRevealed={dealt}')
    // Per-card stagger is handed down as a transition delay in roster order.
    expect(source).toContain('emergeDelayMs={reduceMotion ? 0 : rosterIndex * staggerMs}')
  })

  it('renders the fan rows with per-row-length classes', () => {
    expect(source).toContain('squad-unboxing__deck-fan')
    expect(source).toContain('squad-unboxing__deck-fan-row--len-')
    expect(source).toContain('squad-unboxing__deck-fan--count-')
    expect(source).toContain('memberRows')
  })

  it('fires a per-card landing haptic during the deal', () => {
    expect(source).toContain("haptics('light')")
    expect(source).toContain('hapticTimersRef')
  })

  it('runs a one-shot auto-peek after the deal settles', () => {
    expect(source).toContain('PEEK_DELAY_MS')
    expect(source).toContain('PEEK_HOLD_MS')
    expect(source).toContain('setPeekActive')
  })

  it('computes the best partner by highest chemistryScore (roster tie-break)', () => {
    expect(source).toContain('computeBestPartnerUserId')
    expect(source).toContain('chemistryScore')
    expect(source).toContain('score > bestScore')
  })

  it('resets transient deal/focus/peek state on the resetSignal bump', () => {
    expect(source).toContain('resetSignal')
    expect(source).toContain('prevResetSignalRef')
    expect(source).toContain('clearAllTimers')
  })

  it('clears all timers on unmount', () => {
    expect(source).toContain('hapticTimersRef.current.forEach(clearTimeout)')
    expect(source).toContain('() => clearAllTimers()')
  })

  it('contains no selector-query measurement or flat-row geometry', () => {
    expect(source).not.toContain('createSelectorQuery')
    expect(source).not.toContain('computeCardLayout')
    expect(source).not.toContain('computeCardsPerRow')
    expect(source).not.toContain('ArchetypeHead')
    expect(source).not.toContain('deck-chips')
    expect(source).not.toContain('isDeckCollapsed')
    expect(source).not.toContain('collapsed')
  })
})

// The page orchestrates the fan: revealed title bar inside the fixed stage, an
// on-demand (max-height) detail panel, and a resetSignal driven deck — with no
// leftover selector-query scroll math or collapse flag.
describe('SquadUnboxingPage fan orchestration', () => {
  const source = readFileSync(resolve(here, 'index.tsx'), 'utf8')

  it('has no selector-query scroll placement or flat-row collapse state', () => {
    expect(source).not.toContain('createSelectorQuery')
    expect(source).not.toContain('programmaticScrollTop')
    expect(source).not.toContain('inline-detail-anchor')
    expect(source).not.toContain('isDeckCollapsed')
    expect(source).not.toContain('DECK_COLLAPSE_SCROLL_THRESHOLD_RPX')
    expect(source).not.toContain('collapsed=')
  })

  it('renders the slim revealed title bar inside the fixed stage', () => {
    expect(source).toContain('revealedTitleBar')
    expect(source).toContain('squad-unboxing__title-bar')
    expect(source).toContain('squad-unboxing__title-bar-chem-text')
  })

  it('keeps focused member copy in the Xiaoyue dock without a blank inline panel', () => {
    expect(source).toContain('focusedMemberBubbleText')
    expect(source).not.toContain('squad-unboxing__detail-panel')
  })

  it('drives the deck stage with resetSignal (not a collapse flag)', () => {
    expect(source).toContain('resetSignal={resetSignal}')
    expect(source).not.toContain('collapsed={')
  })

  it('folds group dynamics into the squad-soul bubble', () => {
    expect(source).toContain('groupAnalysis?.groupDynamics')
  })
})

// ── Drift lock ──────────────────────────────────────────────────────────────
// SCSS owns the runtime geometry (inline rpx/deg is H5-unsafe); computeFanLayout
// owns the source of truth. These tests keep the two byte-aligned so they can
// never silently diverge.

/** Extract the body of a `$name: ( ... );` SCSS map (one nesting level). */
function extractScssMapBlock(scss: string, varName: string): string {
  const start = scss.indexOf(`$${varName}: (`)
  if (start === -1) return ''
  const rest = scss.slice(start)
  const end = rest.indexOf(');')
  return end === -1 ? '' : rest.slice(0, end)
}

describe('SCSS fan geometry maps (drift lock with computeFanLayout)', () => {
  const scss = readFileSync(resolve(here, 'index.scss'), 'utf8')

  it('$fan-overlap matches FAN_OVERLAP_RPX', () => {
    const match = scss.match(/\$fan-overlap:\s*(\d+)rpx;/)
    expect(match, 'missing $fan-overlap').not.toBeNull()
    expect(Number(match![1])).toBe(FAN_OVERLAP_RPX)
  })

  it('$fan-safe-inset matches FAN_SAFE_INSET_RPX (locked at 48)', () => {
    const match = scss.match(/\$fan-safe-inset:\s*(\d+)rpx;/)
    expect(match, 'missing $fan-safe-inset').not.toBeNull()
    expect(Number(match![1])).toBe(FAN_SAFE_INSET_RPX)
    expect(FAN_SAFE_INSET_RPX).toBe(48)
  })

  it('$fan-card-sizes matches FAN_CARD_SIZE_BY_COUNT for every count', () => {
    const block = extractScssMapBlock(scss, 'fan-card-sizes')
    expect(block, 'missing $fan-card-sizes map').not.toBe('')
    const re = /(\d+):\s*\((\d+),\s*(\d+)\)/g
    const scssSizes: Record<number, { width: number; height: number }> = {}
    let m: RegExpExecArray | null
    while ((m = re.exec(block))) {
      scssSizes[Number(m[1])] = { width: Number(m[2]), height: Number(m[3]) }
    }
    for (let count = 1; count <= 8; count += 1) {
      expect(scssSizes[count], `missing SCSS size for count ${count}`).toBeDefined()
      expect(scssSizes[count].width, `count ${count} width`).toBe(FAN_CARD_SIZE_BY_COUNT[count].width)
      expect(scssSizes[count].height, `count ${count} height`).toBe(FAN_CARD_SIZE_BY_COUNT[count].height)
    }
  })

  it('$fan-rotations matches FAN_ROTATIONS_BY_ROW_LENGTH for every row shape', () => {
    const block = extractScssMapBlock(scss, 'fan-rotations')
    expect(block, 'missing $fan-rotations map').not.toBe('')
    const re = /(\d+):\s*\(([^)]*)\)/g
    const scssRotations: Record<number, number[]> = {}
    let m: RegExpExecArray | null
    while ((m = re.exec(block))) {
      scssRotations[Number(m[1])] = m[2].split(',').map((value) => Number(value.trim()))
    }
    for (const len of [1, 2, 3, 4]) {
      expect(scssRotations[len], `missing SCSS rotations for row length ${len}`).toBeDefined()
      expect(scssRotations[len], `row length ${len} rotations`).toEqual(FAN_ROTATIONS_BY_ROW_LENGTH[len])
    }
  })

  it('the fan is bounded to the content width', () => {
    expect(scss).toContain(`max-width: ${FAN_CONTENT_WIDTH_RPX}rpx`)
  })
})

describe('SCSS fan poses + anti-collision (Direction: Cascading Hand Fan)', () => {
  const scss = readFileSync(resolve(here, 'index.scss'), 'utf8')

  it('applies the overlap as a negative margin on non-first cards', () => {
    expect(scss).toContain('margin-left: -$fan-overlap')
    expect(scss).toContain('&:first-child')
  })

  it('applies the safe inset to non-rightmost cards (text never in covered band)', () => {
    expect(scss).toContain('&:not(:last-child) .squad-unboxing__deck-card-info')
    expect(scss).toContain('padding-right: $fan-safe-inset')
  })

  it('pivots every card at the bottom-centre (hand-fan splay)', () => {
    expect(scss).toContain('transform-origin: 50% 100%')
  })

  it('every translate+rotate transform uses translate → rotate → scale order', () => {
    const re = /transform:\s*([^;]+);/g
    const offenders: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(scss))) {
      const value = m[1]
      if (!value.includes('translate') || !value.includes('rotate')) continue
      const tIdx = value.indexOf('translate')
      const rIdx = value.indexOf('rotate')
      const sIdx = value.indexOf('scale')
      const ordered = tIdx < rIdx && (sIdx === -1 || rIdx < sIdx)
      if (!ordered) offenders.push(value.trim())
    }
    expect(offenders, `transforms out of order: ${offenders.join(' | ')}`).toEqual([])
  })

  it('has no flat-row SCSS remnants', () => {
    expect(scss).not.toContain('&__deck-cards')
    expect(scss).not.toContain('deck-cards--count')
    expect(scss).not.toContain('&__deck-chips')
    expect(scss).not.toContain('&__deck-chip')
    expect(scss).not.toContain('&__inline-detail')
    expect(scss).not.toContain('blind-box-interior-img')
  })

  it('emits the fan pose + state transforms from per-(row-length,index) classes', () => {
    // The dealt fan pose, dim, peek, and both lift variants are generated by the
    // @each/@for loops (so no inline rpx/deg reaches the H5 build).
    expect(scss).toContain('&__deck-fan--dealt')
    expect(scss).toContain('squad-unboxing__deck-card--focused-lift')
    expect(scss).toContain('squad-unboxing__deck-card--focused-lift-deg')
    expect(scss).toContain('squad-unboxing__deck-card--peek')
    expect(scss).not.toContain('squad-unboxing__deck-card--dimmed')
  })

  it('keeps the 最佳拍档 stamp out of the covered band on non-rightmost cards', () => {
    // z-index ascends left→right: a neighbour paints over a stamp inside the
    // 48rpx covered band, so the stamp gets the same safe inset as text.
    expect(scss).toContain('&:not(:last-child) .squad-unboxing__deck-card-stamp')
    expect(scss).toContain('right: $fan-safe-inset')
  })

  it('never holds permanent GPU layers (no will-change on cards)', () => {
    // Up to 8 cards × will-change held 8 GPU layers for the page lifetime;
    // animations promote transiently on their own.
    const cardBlock = scss.split('&__deck-card {')[1]?.split('// Overlap')[0] ?? ''
    expect(cardBlock).not.toContain('will-change')
  })

  it('sweeps the holo sheen with transform only (no background-position paint)', () => {
    const holoKeyframes = scss.split('@keyframes squad-unboxing-holo-sweep')[1]?.split('@keyframes')[0] ?? ''
    expect(holoKeyframes).toContain('transform: translateX')
    expect(holoKeyframes).not.toContain('background-position')
  })

  it('collapses overflow rosters into a +N badge instead of dropping members', () => {
    const tsx = readFileSync(resolve(here, 'SquadDeckStage.tsx'), 'utf8')
    expect(tsx).toContain('MAX_FAN_CARDS')
    expect(tsx).toContain('overflowBadge')
    expect(tsx).toContain('members.slice(0, MAX_FAN_CARDS)')
  })

  it('cancels the auto-peek on a deliberate focus tap', () => {
    const tsx = readFileSync(resolve(here, 'SquadDeckStage.tsx'), 'utf8')
    expect(tsx).toContain('setPeekActive(false)')
    // handleFocus clears the peek timers before delegating to the parent.
    const focusBody = tsx.split('const handleFocus')[1]?.split('}, [onFocusChange])')[0] ?? ''
    expect(focusBody).toContain('peekTimersRef.current.forEach(clearTimeout)')
    expect(focusBody).toContain('setPeekActive(false)')
  })

  it('keys the deal effect on a stable roster id sequence, not array identity', () => {
    const tsx = readFileSync(resolve(here, 'SquadDeckStage.tsx'), 'utf8')
    expect(tsx).toContain('memberKey')
    expect(tsx).not.toContain('[instant, dealTotalMs, staggerMs, members]')
  })
})
