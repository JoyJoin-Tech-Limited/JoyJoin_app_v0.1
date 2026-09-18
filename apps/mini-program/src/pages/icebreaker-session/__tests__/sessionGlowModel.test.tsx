/**
 * Wave 4 Session Glow — client tests (locked contract wave4-sessionGlow,
 * AC-12…AC-17): view-model purity + anti-pressure proof, glow block render,
 * stagger + reduced-motion, self outline, collapsed expander, flag-off
 * identity, empty-state honesty, no-digit assertion, analytics emission.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import type { GlowPointBreakdown } from '@shared/socialIcebreaker'
import {
  GLOW_BLOCK_TITLE,
  GLOW_DETAIL_COLLAPSE_LABEL,
  GLOW_DETAIL_EXPAND_LABEL,
  GLOW_EMPTY_STATE_LINE,
  GLOW_FLOOR_TIER_LINE,
  GLOW_NEXT_CARD_LABEL,
  GLOW_SOURCE_LABELS,
  GLOW_TABLE_LINES,
  GLOW_TIER_WORDS,
} from '@shared/copy/sessionGlow'
import {
  GLOW_CARD_STAGGER_MS,
  buildGlowCards,
  isFloorOnlyTable,
  readOwnGlowBreakdown,
  readRecapGlow,
  resolveGlowCardRevealDelayMs,
  resolveGlowMedalSource,
  resolveRecapAwardsMode,
  type SessionGlowSnapshot,
} from '../viewModels/sessionGlowModel'
import { RecapGlowBlock } from '../phases/RecapGlowBlock'

// ─── Mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  shouldReduceMotion: { value: false },
  track: vi.fn(),
  socialHaptics: vi.fn(() => true),
  haptics: vi.fn(),
}))

vi.mock('@tarojs/components', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  View: (props: any) => <div {...props} />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Text: (props: any) => <span {...props} />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Image: (props: any) => <img {...props} />,
}))

vi.mock('../../../hooks/useMiniRevealMotion', () => ({
  useMiniRevealMotion: () => ({
    motionMode: mocks.shouldReduceMotion.value ? 'reduce' : 'full',
    shouldReduceMotion: mocks.shouldReduceMotion.value,
    source: 'default',
  }),
}))

vi.mock('../../../lib/analytics/socialIcebreakerAnalytics', () => ({
  socialIcebreakerAnalytics: { track: mocks.track },
}))

vi.mock('../../../lib/utils/haptics', () => ({
  socialHaptics: mocks.socialHaptics,
  haptics: mocks.haptics,
}))

vi.mock('../../../components/ui/JoyJoinIcon', () => ({
  default: () => null,
}))

vi.mock('../../../components/ui/Card', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (props: any) => <div className={props.className}>{props.children}</div>,
}))

// ─── Fixtures (deliberately digit-free — AC-17) ─────────────────────

const roster = [
  { userId: 'u-alpha', displayName: '阿澄' },
  { userId: 'u-beta', displayName: '栗子' },
  { userId: 'u-gamma', displayName: '默默' },
]

const glowSnapshot: SessionGlowSnapshot = {
  tiers: { 'u-alpha': 'blazing', 'u-beta': 'warm', 'u-gamma': 'ember' },
  medals: [
    { emoji: '', title: '接梗王', recipientDisplayName: '阿澄', description: '梗一个接一个，接得又稳又暖' },
    { emoji: '', title: '暖心雷达', recipientDisplayName: '栗子', description: '总能看见身边人的闪光点' },
  ],
  tableLine: '这桌今晚慢慢热了起来，处处有小高光',
}

const ownBreakdown: GlowPointBreakdown = {
  quip: 4,
  mirror: 2,
  auction: 0,
  miniscript: 0,
  undercover: 0,
  challenge: 2,
  dice: 0,
  lie: 1,
}

beforeEach(() => {
  mocks.shouldReduceMotion.value = false
  mocks.track.mockClear()
  mocks.socialHaptics.mockClear()
  mocks.haptics.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── View-model: card assembly (AC-12/AC-14) ────────────────────────

describe('sessionGlowModel — buildGlowCards', () => {
  it('passes cards through in ROSTER order, never glow order (AC-12/D3)', () => {
    const cards = buildGlowCards({
      glow: glowSnapshot,
      roster,
      currentUserId: 'u-alpha',
      ownBreakdown,
    })
    expect(cards.map((c) => c.userId)).toEqual(['u-alpha', 'u-beta', 'u-gamma'])
  })

  it('maps machine tiers to copy-module tier words', () => {
    const cards = buildGlowCards({ glow: glowSnapshot, roster, currentUserId: 'u-alpha' })
    expect(cards[0].tierWord).toBe(GLOW_TIER_WORDS.blazing)
    expect(cards[1].tierWord).toBe(GLOW_TIER_WORDS.warm)
    expect(cards[2].tierWord).toBe(GLOW_TIER_WORDS.ember)
  })

  it('defaults a roster member missing from tiers to the ember floor (presence glows)', () => {
    const cards = buildGlowCards({
      glow: { ...glowSnapshot, tiers: { 'u-alpha': 'warm' } },
      roster,
      currentUserId: 'u-alpha',
    })
    expect(cards[1].tier).toBe('ember')
    expect(cards[2].tier).toBe('ember')
  })

  it('flags only the viewer card as self and attaches count-free source labels to it alone (AC-14/D4)', () => {
    const cards = buildGlowCards({
      glow: glowSnapshot,
      roster,
      currentUserId: 'u-beta',
      ownBreakdown,
    })
    expect(cards.map((c) => c.isSelf)).toEqual([false, true, false])
    expect(cards[0].ownSourceLabels).toBeUndefined()
    expect(cards[2].ownSourceLabels).toBeUndefined()
    // quip/mirror/challenge/lie contributed; zero-sources are excluded.
    expect(cards[1].ownSourceLabels).toEqual([
      GLOW_SOURCE_LABELS.quip,
      GLOW_SOURCE_LABELS.mirror,
      GLOW_SOURCE_LABELS.challenge,
      GLOW_SOURCE_LABELS.lie,
    ])
    for (const label of cards[1].ownSourceLabels ?? []) {
      expect(label).not.toMatch(/[0-9０-９]/)
    }
  })

  it('omits source labels when the viewer has zero glow (honest floor, no fabrication)', () => {
    const zero: GlowPointBreakdown = {
      quip: 0, mirror: 0, auction: 0, miniscript: 0,
      undercover: 0, challenge: 0, dice: 0, lie: 0,
    }
    const cards = buildGlowCards({
      glow: glowSnapshot,
      roster,
      currentUserId: 'u-alpha',
      ownBreakdown: zero,
    })
    expect(cards[0].ownSourceLabels).toBeUndefined()
  })

  it('embeds each medal in the recipient card and consumes it once', () => {
    const duplicateRoster = [
      { userId: 'u-alpha', displayName: '阿澄' },
      { userId: 'u-delta', displayName: '阿澄' }, // same display name
    ]
    const cards = buildGlowCards({
      glow: glowSnapshot,
      roster: duplicateRoster,
      currentUserId: 'u-alpha',
    })
    expect(cards[0].medals.map((m) => m.title)).toEqual(['接梗王'])
    expect(cards[1].medals).toEqual([])
  })

  it('exposes no numeric fields on the public card shape (AC-14 anti-pressure)', () => {
    const cards = buildGlowCards({
      glow: glowSnapshot,
      roster,
      currentUserId: 'u-alpha',
      ownBreakdown,
    })
    for (const card of cards) {
      for (const key of Object.keys(card)) {
        expect(key).not.toMatch(/points|score|value|count|amount|level/i)
      }
      expect(typeof card.userId).toBe('string')
      expect(typeof card.displayName).toBe('string')
      expect(typeof card.tier).toBe('string')
      expect(typeof card.tierWord).toBe('string')
      expect(typeof card.isSelf).toBe('boolean')
      expect(Array.isArray(card.medals)).toBe(true)
      if (card.ownSourceLabels) {
        for (const label of card.ownSourceLabels) expect(typeof label).toBe('string')
      }
    }
  })
})

describe('sessionGlowModel — empty-state honesty (AC-12/spec D5)', () => {
  it('detects the all-zero table: every card ember floor with zero medals', () => {
    const zeroGlow: SessionGlowSnapshot = {
      tiers: { 'u-alpha': 'ember', 'u-beta': 'ember' },
      medals: [],
      tableLine: GLOW_TABLE_LINES.quiet,
    }
    const cards = buildGlowCards({ glow: zeroGlow, roster: roster.slice(0, 2) })
    expect(isFloorOnlyTable(cards)).toBe(true)
    expect(cards.every((c) => c.medals.length === 0)).toBe(true)
  })

  it('is not floor-only when any card rises above the floor or holds a medal', () => {
    const cards = buildGlowCards({ glow: glowSnapshot, roster })
    expect(isFloorOnlyTable(cards)).toBe(false)
  })
})

describe('sessionGlowModel — reveal rhythm (AC-13)', () => {
  it('staggers per card under full motion and goes static under reduced motion', () => {
    expect(resolveGlowCardRevealDelayMs(0, false)).toBe(0)
    expect(resolveGlowCardRevealDelayMs(3, false)).toBe(3 * GLOW_CARD_STAGGER_MS)
    expect(resolveGlowCardRevealDelayMs(3, true)).toBe(0)
  })
})

describe('sessionGlowModel — flag branch (AC-12/AC-08 byte identity)', () => {
  it('resolves glow mode only when a snapshot is present', () => {
    expect(resolveRecapAwardsMode(glowSnapshot)).toBe('glow')
    expect(resolveRecapAwardsMode(undefined)).toBe('legacy')
    expect(resolveRecapAwardsMode(null)).toBe('legacy')
  })
})

describe('sessionGlowModel — defensive readers (integration drift guard)', () => {
  it('reads a well-formed glow snapshot and rejects malformed shapes fail-open', () => {
    expect(readRecapGlow({ glow: glowSnapshot })).toEqual(glowSnapshot)
    expect(readRecapGlow(undefined)).toBeUndefined()
    expect(readRecapGlow({})).toBeUndefined()
    expect(readRecapGlow({ glow: { tiers: {}, medals: 'nope', tableLine: 1 } })).toBeUndefined()
  })

  it('reads only the viewer breakdown and validates all eight numeric sources', () => {
    const state = { glowPoints: { 'u-alpha': ownBreakdown } }
    expect(readOwnGlowBreakdown(state, 'u-alpha')).toEqual(ownBreakdown)
    // Server trims everyone else — another user's entry is simply absent.
    expect(readOwnGlowBreakdown(state, 'u-beta')).toBeUndefined()
    expect(readOwnGlowBreakdown(state, undefined)).toBeUndefined()
    expect(
      readOwnGlowBreakdown({ glowPoints: { 'u-alpha': { quip: 'many' } } }, 'u-alpha'),
    ).toBeUndefined()
    expect(readOwnGlowBreakdown(null, 'u-alpha')).toBeUndefined()
  })
})

describe('sessionGlowModel — medal analytics source mapping (AC-10/AC-15)', () => {
  it('maps the four data medals to their glow sources', () => {
    expect(resolveGlowMedalSource('接梗王')).toBe('quip')
    expect(resolveGlowMedalSource('暖心雷达')).toBe('mirror')
    expect(resolveGlowMedalSource('豪气担当')).toBe('auction')
    expect(resolveGlowMedalSource('全勤小可爱')).toBe('participation')
    expect(resolveGlowMedalSource('最佳侦探')).toBe('lie_detective')
    expect(resolveGlowMedalSource('未知奖章')).toBe('legacy')
  })
})

// ─── Anti-pressure grep proof (AC-14) ────────────────────────────────

describe('sessionGlowModel — anti-pressure static proof (AC-14)', () => {
  it('contains no numeric aggregation or comparison helpers', () => {
    const modelPath = resolve(
      process.cwd(),
      'src/pages/icebreaker-session/viewModels/sessionGlowModel.ts',
    )
    const source = readFileSync(modelPath, 'utf8')
    const forbidden = [
      /\.sort\(/,
      /\.reduce\(/,
      /Math\.max/,
      /Math\.min/,
      /sortBy/i,
      /rankBy/i,
      /compareGlow/i,
      /glowTotal/i,
      /totalGlow/i,
      /sumGlow/i,
      /aggregateGlow/i,
      /leaderboard/i,
    ]
    for (const pattern of forbidden) {
      expect(source, `view-model must not contain ${pattern}`).not.toMatch(pattern)
    }
  })
})

// ─── Copy compliance (AC-17): no digits in any glow string ──────────

describe('session glow copy — numbers never on screen (AC-17)', () => {
  it('every user-facing glow string is digit-free', () => {
    const strings: string[] = [
      ...Object.values(GLOW_TIER_WORDS),
      ...Object.values(GLOW_TABLE_LINES),
      ...Object.values(GLOW_SOURCE_LABELS),
      GLOW_BLOCK_TITLE,
      GLOW_FLOOR_TIER_LINE,
      GLOW_EMPTY_STATE_LINE,
      GLOW_DETAIL_EXPAND_LABEL,
      GLOW_DETAIL_COLLAPSE_LABEL,
      GLOW_NEXT_CARD_LABEL,
    ]
    for (const value of strings) {
      expect(value, `copy must stay digit-free: "${value}"`).not.toMatch(/[0-9０-９]/)
    }
  })
})

// ─── RecapGlowBlock render tests (AC-12/AC-13/AC-15/AC-17) ─────────

function renderBlock(overrides?: Partial<Parameters<typeof RecapGlowBlock>[0]>) {
  return render(
    <RecapGlowBlock
      glow={glowSnapshot}
      roster={roster}
      currentUserId='u-alpha'
      ownBreakdown={ownBreakdown}
      socialSessionId='social_test'
      hapticGrammarEnabled
      {...overrides}
    />,
  )
}

describe('RecapGlowBlock — block render (AC-12)', () => {
  it('renders the table line and one roster-ordered card per person', () => {
    const { container } = renderBlock()
    expect(container.textContent).toContain(GLOW_BLOCK_TITLE)
    expect(container.textContent).toContain(glowSnapshot.tableLine)
    const cards = container.querySelectorAll('.recap-glow__card')
    expect(cards).toHaveLength(roster.length)
    const names = Array.from(container.querySelectorAll('.recap-glow__card-name')).map(
      (node) => node.textContent,
    )
    expect(names[0]).toContain('阿澄')
    expect(names[1]).toContain('栗子')
    expect(names[2]).toContain('默默')
  })

  it('outlines the viewer card and shows the self badge', () => {
    const { container } = renderBlock()
    const selfCards = container.querySelectorAll('.recap-glow__card--self')
    expect(selfCards).toHaveLength(1)
    expect(selfCards[0].textContent).toContain('阿澄')
    expect(container.querySelectorAll('.recap-glow__self-badge')).toHaveLength(1)
  })

  it('embeds medals inside the recipient card with tier chips on every card', () => {
    const { container } = renderBlock()
    const cards = container.querySelectorAll('.recap-glow__card')
    expect(cards[0].querySelectorAll('.recap-glow__medal')).toHaveLength(1)
    expect(cards[0].textContent).toContain('接梗王')
    expect(cards[1].textContent).toContain('暖心雷达')
    expect(cards[2].querySelectorAll('.recap-glow__medal')).toHaveLength(0)
    expect(container.querySelector('.recap-glow__tier--blazing')?.textContent).toBe(
      GLOW_TIER_WORDS.blazing,
    )
    expect(container.querySelector('.recap-glow__tier--ember')?.textContent).toBe(
      GLOW_TIER_WORDS.ember,
    )
  })

  it('shows the positive floor framing on an all-zero table and never fabricates medals', () => {
    const zeroGlow: SessionGlowSnapshot = {
      tiers: { 'u-alpha': 'ember', 'u-beta': 'ember' },
      medals: [],
      tableLine: GLOW_TABLE_LINES.quiet,
    }
    const { container } = renderBlock({ glow: zeroGlow, roster: roster.slice(0, 2) })
    expect(container.textContent).toContain(GLOW_FLOOR_TIER_LINE)
    expect(container.querySelectorAll('.recap-glow__medal')).toHaveLength(0)
    expect(container.querySelectorAll('.recap-glow__tier--ember')).toHaveLength(2)
  })
})

describe('RecapGlowBlock — stagger + reduced motion (AC-13)', () => {
  it('staggers cards with per-index animation delays under full motion', () => {
    const { container } = renderBlock()
    const staggered = container.querySelectorAll('.recap-glow__card--stagger')
    expect(staggered).toHaveLength(roster.length)
    const delays = Array.from(staggered).map(
      (node) => (node as HTMLElement).style.animationDelay,
    )
    expect(delays).toEqual(['0ms', `${GLOW_CARD_STAGGER_MS}ms`, `${2 * GLOW_CARD_STAGGER_MS}ms`])
  })

  it('renders every card statically under prefers-reduced-motion', () => {
    mocks.shouldReduceMotion.value = true
    const { container } = renderBlock()
    expect(container.querySelectorAll('.recap-glow__card--stagger')).toHaveLength(0)
    const cards = container.querySelectorAll('.recap-glow__card')
    expect(cards).toHaveLength(roster.length)
    for (const card of Array.from(cards)) {
      expect((card as HTMLElement).style.animationDelay).toBe('')
    }
  })

  it('fires the one-shot celebration haptic on entrance only when the grammar flag is on', () => {
    renderBlock()
    expect(mocks.socialHaptics).toHaveBeenCalledTimes(1)
    expect(mocks.socialHaptics).toHaveBeenCalledWith('socialCelebration')

    mocks.socialHaptics.mockClear()
    renderBlock({ hapticGrammarEnabled: false })
    expect(mocks.socialHaptics).not.toHaveBeenCalled()
  })
})

describe('RecapGlowBlock — self breakdown expander (AC-12/AC-14)', () => {
  it('is collapsed by default, expands on tap, and stays self-only', () => {
    const { container } = renderBlock()
    const toggles = container.querySelectorAll('.recap-glow__detail-toggle')
    expect(toggles).toHaveLength(1)
    expect(container.querySelector('.recap-glow__detail-body')).toBeNull()
    expect(toggles[0].textContent).toContain(GLOW_DETAIL_EXPAND_LABEL)

    fireEvent.click(toggles[0])
    expect(container.querySelector('.recap-glow__detail-body')).toBeTruthy()
    expect(container.textContent).toContain(GLOW_SOURCE_LABELS.quip)
    expect(toggles[0].textContent).toContain(GLOW_DETAIL_COLLAPSE_LABEL)
    expect(mocks.haptics).toHaveBeenCalledWith('light')
  })

  it('renders no expander for a viewer with zero glow sources', () => {
    const zero: GlowPointBreakdown = {
      quip: 0, mirror: 0, auction: 0, miniscript: 0,
      undercover: 0, challenge: 0, dice: 0, lie: 0,
    }
    const { container } = renderBlock({ ownBreakdown: zero })
    expect(container.querySelectorAll('.recap-glow__detail-toggle')).toHaveLength(0)
  })
})

describe('RecapGlowBlock — no digits on the recap surface (AC-17)', () => {
  it('renders no digit characters anywhere in the block, even with the breakdown expanded', () => {
    const { container } = renderBlock()
    fireEvent.click(container.querySelector('.recap-glow__detail-toggle') as Element)
    expect(container.textContent ?? '').not.toMatch(/[0-9０-９]/)
  })
})

describe('RecapGlowBlock — analytics emission (AC-15)', () => {
  it('fires glow_recap_revealed once per view with the viewer tier', () => {
    renderBlock()
    const revealed = mocks.track.mock.calls.filter(([event]) => event === 'glow_recap_revealed')
    expect(revealed).toHaveLength(1)
    expect(revealed[0][1]).toBe('social_test')
    expect(revealed[0][4]).toEqual({ tier: 'blazing' })
  })

  it('fires glow_medal_awarded per medal as each card reveals (stagger-aligned)', () => {
    vi.useFakeTimers()
    renderBlock()
    expect(mocks.track.mock.calls.filter(([e]) => e === 'glow_medal_awarded')).toHaveLength(0)
    vi.advanceTimersByTime(GLOW_CARD_STAGGER_MS * roster.length + 50)
    const awarded = mocks.track.mock.calls.filter(([event]) => event === 'glow_medal_awarded')
    expect(awarded).toHaveLength(2)
    expect(awarded[0][4]).toEqual({ medal: '接梗王', dataDerived: true, source: 'quip' })
    expect(awarded[1][4]).toEqual({ medal: '暖心雷达', dataDerived: true, source: 'mirror' })
  })

  it('fires glow_detail_expanded on own-breakdown expand only', () => {
    const { container } = renderBlock()
    const toggle = container.querySelector('.recap-glow__detail-toggle') as Element
    fireEvent.click(toggle)
    const expanded = mocks.track.mock.calls.filter(([event]) => event === 'glow_detail_expanded')
    expect(expanded).toHaveLength(1)
    // Collapsing does not re-fire.
    fireEvent.click(container.querySelector('.recap-glow__detail-toggle') as Element)
    expect(
      mocks.track.mock.calls.filter(([event]) => event === 'glow_detail_expanded'),
    ).toHaveLength(1)
  })
})

// ─── Flag-off byte identity (AC-12/AC-08) ───────────────────────────

describe('RecapPhaseView — flag-off identity (AC-12/AC-08)', () => {
  it('keeps the legacy medal grid JSX intact behind the glow branch', () => {
    const viewPath = resolve(
      process.cwd(),
      'src/pages/icebreaker-session/phases/RecapPhaseView.tsx',
    )
    const source = readFileSync(viewPath, 'utf8')
    // The legacy grid block still exists verbatim…
    expect(source).toContain('icebreaker__recap-medals-grid')
    expect(source).toContain('今晚奖项')
    // …and the glow block mounts only on the `glow && participants` branch.
    expect(source).toContain('glow && participants')
    expect(source.indexOf('glow && participants')).toBeLessThan(
      source.indexOf('icebreaker__recap-medals-grid'),
    )
  })
})
