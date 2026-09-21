import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuctionLotResult, SocialSessionState } from '@shared/socialIcebreaker'
import {
  AUCTION_BEAT_REFRESH_DEBOUNCE_MS,
  AUCTION_COLLECTION_HINT_THRESHOLD,
  AuctionAllInOneShot,
  AuctionV2BeatCoordinator,
  buildAllInEventKey,
  buildAuctionBill,
  buildOutbidEventKey,
  computeAuctionAwards,
  computeAuctionLadder,
  countLotsWonBy,
  isLiveAuctionV2Session,
  resolveAllInCeremonyEffects,
  resolveAuctionBidInputMode,
  roundUpTo5,
  wasLastHighBidMine,
} from '../viewModels/auctionV2Model'
import {
  AUCTION_GAMBLING_VOCAB_BLACKLIST,
  AUCTION_V2_ALL_IN_LABEL,
  AUCTION_V2_ALL_IN_LABEL_FALLBACK,
  AUCTION_V2_FINALE_SCREEN_COPY,
  AUCTION_V2_HERO_SCREEN_COPY,
  AUCTION_V2_LOW_BALANCE_HINT,
} from '../../../lib/copy/auctionV2'

// ─── 1. Ladder math (AC-11 / D1) ───────────────────────────────────────────

describe('auctionV2Model · bid ladder math (AC-11)', () => {
  it('roundUpTo5 rounds UP to the next multiple of 5', () => {
    expect(roundUpTo5(0)).toBe(0)
    expect(roundUpTo5(1)).toBe(5)
    expect(roundUpTo5(2)).toBe(5)
    expect(roundUpTo5(5)).toBe(5)
    expect(roundUpTo5(6)).toBe(10)
    expect(roundUpTo5(18)).toBe(20)
    expect(roundUpTo5(30)).toBe(30)
    expect(roundUpTo5(31)).toBe(35)
  })

  it('no-bid state (high=0) renders 5 / 15 / 全押', () => {
    const ladder = computeAuctionLadder({ high: 0, balance: 100, ownEscrowedBid: 0 })
    expect(ladder.tiers.map((t) => t.amount)).toEqual([5, 15, 100])
    expect(ladder.tiers.map((t) => t.label)).toEqual(['5', '15', '全力一击 100'])
    expect(ladder.tiers.every((t) => !t.disabled)).toBe(true)
    expect(ladder.allTiersDisabled).toBe(false)
  })

  it('applies the locked formula at high=20/60/100 with total-price labels', () => {
    // 稳一手 = high + max(5, round5(high × 0.10)); 加一点 = high + max(15, round5(high × 0.30))
    expect(
      computeAuctionLadder({ high: 20, balance: 100, ownEscrowedBid: 0 }).tiers.map((t) => t.amount),
    ).toEqual([25, 35, 100])
    expect(
      computeAuctionLadder({ high: 60, balance: 100, ownEscrowedBid: 0 }).tiers.map((t) => t.amount),
    ).toEqual([70, 80, 100])
    expect(
      computeAuctionLadder({ high: 100, balance: 130, ownEscrowedBid: 0 }).tiers.map((t) => t.amount),
    ).toEqual([110, 130, 130])
    // Labels show the post-bid TOTAL, never the increment.
    const ladder = computeAuctionLadder({ high: 15, balance: 80, ownEscrowedBid: 0 })
    expect(ladder.tiers[0].label).toBe('20')
    expect(ladder.tiers[1].label).toBe('30')
    expect(ladder.tiers[2].label).toBe('全力一击 80')
    // Contract example 「35」: 加一点 at high=20 → 20 + max(15, round5(6)) = 35.
    expect(
      computeAuctionLadder({ high: 20, balance: 80, ownEscrowedBid: 0 }).tiers[1].label,
    ).toBe('35')
  })

  it('spendable = balance + own escrowed high bid (leader can re-spend escrow)', () => {
    const ladder = computeAuctionLadder({ high: 60, balance: 10, ownEscrowedBid: 60 })
    expect(ladder.spendable).toBe(70)
    // 稳一手 70 ≤ 70 → enabled; 加一点 80 > 70 → disabled; 全押 70 > 60 → enabled.
    expect(ladder.tiers.map((t) => t.disabled)).toEqual([false, true, false])
  })

  it('insufficient balance disables 加一点/全押 correctly', () => {
    // Balance 10 at high=0: jump (15) disabled, 全押 (10) still a legal raise.
    const poor = computeAuctionLadder({ high: 0, balance: 10, ownEscrowedBid: 0 })
    expect(poor.tiers.map((t) => t.disabled)).toEqual([false, true, false])
    // Leader with zero free balance: nothing can beat the current high.
    const stuck = computeAuctionLadder({ high: 60, balance: 0, ownEscrowedBid: 60 })
    expect(stuck.tiers.every((t) => t.disabled)).toBe(true)
    expect(stuck.allTiersDisabled).toBe(true)
    // Never the high bidder and broke: everything above high is out of reach.
    const broke = computeAuctionLadder({ high: 60, balance: 50, ownEscrowedBid: 0 })
    expect(broke.tiers.map((t) => t.disabled)).toEqual([true, true, true])
    expect(broke.allTiersDisabled).toBe(true)
  })

  it('tier names come from the centralized copy module', () => {
    const ladder = computeAuctionLadder({ high: 0, balance: 100, ownEscrowedBid: 0 })
    expect(ladder.tiers.map((t) => t.name)).toEqual(['稳一手', '加一点', AUCTION_V2_ALL_IN_LABEL])
    expect(ladder.tiers.map((t) => t.tier)).toEqual(['steady', 'jump', 'all_in'])
  })
})

// ─── 2. Snapshot-gated branching (AC-11 / AC-09) ──────────────────────────

describe('auctionV2Model · snapshot-gated branching', () => {
  const baseState = { socialSessionId: 's1' } as SocialSessionState

  it('auctionV2Enabled === true → ladder mode; false/undefined → V1 free-input', () => {
    expect(resolveAuctionBidInputMode({ ...baseState, auctionV2Enabled: true } as SocialSessionState)).toBe('ladder')
    expect(resolveAuctionBidInputMode({ ...baseState, auctionV2Enabled: false } as SocialSessionState)).toBe('free-input')
    expect(resolveAuctionBidInputMode(baseState)).toBe('free-input')
    expect(resolveAuctionBidInputMode(null)).toBe('free-input')
    expect(resolveAuctionBidInputMode(undefined)).toBe('free-input')
  })

  it('isLiveAuctionV2Session gates the beat reroute window', () => {
    const live = {
      ...baseState,
      auctionV2Enabled: true,
      auctionLots: [{ id: 'l1', title: 't' }],
      auctionAllLotsClosed: false,
    } as unknown as SocialSessionState
    expect(isLiveAuctionV2Session(live)).toBe(true)
    // Finale (allClosed) is outside the window — phase_advanced beats land there.
    expect(isLiveAuctionV2Session({ ...live, auctionAllLotsClosed: true } as SocialSessionState)).toBe(false)
    // Lots not generated yet.
    expect(isLiveAuctionV2Session({ ...live, auctionLots: [] } as unknown as SocialSessionState)).toBe(false)
    // Snapshot off → V1, never rerouted.
    expect(isLiveAuctionV2Session({ ...live, auctionV2Enabled: false } as SocialSessionState)).toBe(false)
    expect(isLiveAuctionV2Session(baseState)).toBe(false)
  })

  it('component source contract: V2 branches on the selector; V1 free input is retained', () => {
    const source = readFileSync(
      resolve(__dirname, '../phases/AuctionHeroView.tsx'),
      'utf-8',
    )
    // Snapshot-gated branch lives inside AuctionHeroView.
    expect(source).toContain('resolveAuctionBidInputMode')
    // V1 free number input path is still present (flag-OFF = byte-for-byte V1).
    expect(source).toContain("<Input")
    expect(source).toContain("type='number'")
    // V1 outbid copy retained on the flag-OFF branch.
    expect(source).toContain('币超价！')
  })
})

// ─── 3. Beat dispatch: debounce, self-check, channel attribution (AC-12) ──

describe('auctionV2Model · AuctionV2BeatCoordinator (AC-12)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('schedules ONE debounced refresh across multiple beats inside the 1s window', () => {
    const onRefresh = vi.fn()
    const coordinator = new AuctionV2BeatCoordinator({ onRefresh })
    coordinator.handleOutbidBeat(false)
    coordinator.handleOutbidBeat(false)
    coordinator.handleAllInBeat()
    vi.advanceTimersByTime(AUCTION_BEAT_REFRESH_DEBOUNCE_MS - 1)
    expect(onRefresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onRefresh).toHaveBeenCalledTimes(1)
    coordinator.dispose()
  })

  it('outbid beat buzzes ONLY when the last-known high bid was self (state-free self-check)', () => {
    const coordinator = new AuctionV2BeatCoordinator({ onRefresh: () => {} })
    expect(coordinator.handleOutbidBeat(false)).toBe(false)
    expect(coordinator.handleOutbidBeat(true)).toBe(true)
    coordinator.dispose()
  })

  it('wasLastHighBidMine implements the self-check without any targetUserId', () => {
    expect(wasLastHighBidMine({ userId: 'me' }, 'me')).toBe(true)
    expect(wasLastHighBidMine({ userId: 'other' }, 'me')).toBe(false)
    expect(wasLastHighBidMine(null, 'me')).toBe(false)
    expect(wasLastHighBidMine(undefined, 'me')).toBe(false)
  })

  it('poll-path detection reports channel poll; beat path reports channel beat (consumed once)', () => {
    const coordinator = new AuctionV2BeatCoordinator({ onRefresh: () => {} })
    // No beat seen → poll path.
    expect(coordinator.consumeOutbidChannel()).toBe('poll')
    // Beat (self) seen → next detection attributes to the beat, exactly once.
    coordinator.handleOutbidBeat(true)
    expect(coordinator.consumeOutbidChannel()).toBe('beat')
    expect(coordinator.consumeOutbidChannel()).toBe('poll')
    // A beat where the high bid was NOT mine does not claim the channel.
    coordinator.handleOutbidBeat(false)
    expect(coordinator.consumeOutbidChannel()).toBe('poll')
    coordinator.dispose()
  })

  it('outbid event keys dedupe one announcement per transition', () => {
    const a = buildOutbidEventKey({ lotIndex: 0, userId: 'u1', amount: 35 })
    const b = buildOutbidEventKey({ lotIndex: 0, userId: 'u1', amount: 35 })
    const c = buildOutbidEventKey({ lotIndex: 0, userId: 'u1', amount: 40 })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})

// ─── 4. All-in one-shot ceremony (AC-12 / D3 / D8) ────────────────────────

describe('auctionV2Model · all-in one-shot ceremony', () => {
  it('burst/haptic/analytics fire exactly once across repeated polls of the same all-in', () => {
    const marker = new AuctionAllInOneShot()
    const key = buildAllInEventKey({ lotIndex: 0, userId: 'u1', amount: 100 })
    expect(marker.consume(key)).toBe(true)
    // Same all-in arriving on every subsequent poll → never re-fires.
    expect(marker.consume(key)).toBe(false)
    expect(marker.consume(key)).toBe(false)
    // A different all-in (another bidder, another lot) IS a new event.
    expect(marker.consume(buildAllInEventKey({ lotIndex: 0, userId: 'u2', amount: 90 }))).toBe(true)
    expect(marker.consume(buildAllInEventKey({ lotIndex: 1, userId: 'u1', amount: 100 }))).toBe(true)
    marker.reset()
    expect(marker.consume(key)).toBe(true)
  })

  it('reduced-motion → static badge only, zero particle invocation', () => {
    const fx = resolveAllInCeremonyEffects({
      reducedMotion: true,
      hapticGrammarEnabled: true,
      beatAlreadyBuzzed: false,
    })
    expect(fx.fireBurst).toBe(false)
    expect(fx.fireHaptic).toBe(true) // RM gates motion, not haptics
  })

  it('beat-buzzed all-in does not double-fire the haptic; flag-off stays silent', () => {
    expect(
      resolveAllInCeremonyEffects({
        reducedMotion: false,
        hapticGrammarEnabled: true,
        beatAlreadyBuzzed: true,
      }).fireHaptic,
    ).toBe(false)
    expect(
      resolveAllInCeremonyEffects({
        reducedMotion: false,
        hapticGrammarEnabled: false,
        beatAlreadyBuzzed: false,
      }),
    ).toEqual({ fireBurst: true, fireHaptic: false })
  })

  it('all-in beat buzz marker is consumed once (no poll double-buzz)', () => {
    const coordinator = new AuctionV2BeatCoordinator({ onRefresh: () => {} })
    expect(coordinator.consumeAllInBeatBuzzed()).toBe(false)
    expect(coordinator.handleAllInBeat()).toBe(true)
    expect(coordinator.consumeAllInBeatBuzzed()).toBe(true)
    expect(coordinator.consumeAllInBeatBuzzed()).toBe(false)
    coordinator.dispose()
  })
})

// ─── 5. Award computation + bill (AC-13 / D4) ─────────────────────────────

const BIDDERS = [
  { userId: 'u1', displayName: '阿杰' },
  { userId: 'u2', displayName: '小敏' },
  { userId: 'u3', displayName: '老周' },
]

function lot(partial: Partial<AuctionLotResult> & { lotIndex: number }): AuctionLotResult {
  return {
    lotId: `lot-${partial.lotIndex}`,
    title: `拍品${partial.lotIndex}`,
    winnerUserId: null,
    winningAmount: null,
    bidCount: 0,
    wasAllIn: false,
    ...partial,
  }
}

describe('auctionV2Model · computeAuctionAwards (AC-13)', () => {
  it('computes all four awards on a mixed table', () => {
    const awards = computeAuctionAwards({
      results: [
        lot({ lotIndex: 0, title: '唱一首跑调的歌', winnerUserId: 'u1', winningAmount: 80, bidCount: 5, wasAllIn: true }),
        lot({ lotIndex: 1, title: '讲一个社死瞬间', winnerUserId: 'u2', winningAmount: 15, bidCount: 7 }),
        lot({ lotIndex: 2, title: '模仿一种动物' }),
      ],
      bidders: BIDDERS,
      balances: { u1: 20, u2: 85, u3: 100 },
    })
    expect(awards.map((a) => a.kind)).toEqual(['biggest_spend', 'bargain', 'hottest', 'steadiest'])
    const [biggest, bargain, hottest, steadiest] = awards
    expect(biggest.headline).toBe('阿杰')
    expect(biggest.detail).toContain('80 币')
    expect(bargain.headline).toBe('小敏')
    expect(bargain.detail).toContain('15 币')
    // 全场最热 names the lot, never a person.
    expect(hottest.headline).toBe('《讲一个社死瞬间》')
    expect(hottest.detail).toContain('7 次出价')
    // 最稳的手: won nothing + most remaining coins; praise-only copy.
    expect(steadiest.headline).toBe('老周')
    expect(steadiest.detail).toContain('100 币')
  })

  it('全场流拍 → skips 今晚最敢花 (and 捡漏王), keeps 最稳的手', () => {
    const awards = computeAuctionAwards({
      results: [lot({ lotIndex: 0 }), lot({ lotIndex: 1 })],
      bidders: BIDDERS,
      balances: { u1: 100, u2: 100, u3: 100 },
    })
    const kinds = awards.map((a) => a.kind)
    expect(kinds).not.toContain('biggest_spend')
    expect(kinds).not.toContain('bargain')
    expect(kinds).not.toContain('hottest') // zero bids anywhere
    expect(kinds).toContain('steadiest')
  })

  it('single winner → 捡漏王 still awarded with praise-the-taste framing', () => {
    const awards = computeAuctionAwards({
      results: [
        lot({ lotIndex: 0, title: '唱一首跑调的歌', winnerUserId: 'u1', winningAmount: 25, bidCount: 3 }),
        lot({ lotIndex: 1 }),
      ],
      bidders: BIDDERS,
      balances: { u1: 75, u2: 100, u3: 100 },
    })
    const bargain = awards.find((a) => a.kind === 'bargain')
    expect(bargain).toBeDefined()
    expect(bargain?.headline).toBe('阿杰')
    expect(bargain?.detail).toContain('独一份')
  })

  it('tie on 全场最热 → first-occurring lot', () => {
    const awards = computeAuctionAwards({
      results: [
        lot({ lotIndex: 0, title: '先出现的标', winnerUserId: 'u1', winningAmount: 30, bidCount: 5 }),
        lot({ lotIndex: 1, title: '后出现的标', winnerUserId: 'u2', winningAmount: 30, bidCount: 5 }),
      ],
      bidders: BIDDERS,
      balances: { u1: 70, u2: 70, u3: 100 },
    })
    expect(awards.find((a) => a.kind === 'hottest')?.headline).toBe('《先出现的标》')
  })

  it('everyone won something → skips 最稳的手', () => {
    const awards = computeAuctionAwards({
      results: [
        lot({ lotIndex: 0, winnerUserId: 'u1', winningAmount: 30, bidCount: 2 }),
        lot({ lotIndex: 1, winnerUserId: 'u2', winningAmount: 30, bidCount: 2 }),
        lot({ lotIndex: 2, winnerUserId: 'u3', winningAmount: 30, bidCount: 2 }),
      ],
      bidders: BIDDERS,
      balances: { u1: 70, u2: 70, u3: 70 },
    })
    expect(awards.map((a) => a.kind)).not.toContain('steadiest')
  })

  it('award copy never names an individual for 全场最热 and stays praise-only', () => {
    const awards = computeAuctionAwards({
      results: [lot({ lotIndex: 0, title: '讲一个社死瞬间', winnerUserId: 'u1', winningAmount: 40, bidCount: 6 })],
      bidders: BIDDERS,
      balances: { u1: 60, u2: 100, u3: 100 },
    })
    const hottest = awards.find((a) => a.kind === 'hottest')
    expect(hottest?.headline).not.toContain('阿杰')
    const steadiest = awards.find((a) => a.kind === 'steadiest')
    // 最稳的手 praises restraint — never contrasts with bidders.
    expect(steadiest?.detail).not.toContain('别人')
    expect(steadiest?.detail).not.toContain('没敢')
  })
})

describe('auctionV2Model · buildAuctionBill + endgame hint (D4/D5)', () => {
  const results = [
    lot({ lotIndex: 0, title: '唱一首跑调的歌', winnerUserId: 'u1', winningAmount: 40, bidCount: 4 }),
    lot({ lotIndex: 1, title: '讲一个社死瞬间', winnerUserId: 'u1', winningAmount: 20, bidCount: 2 }),
    lot({ lotIndex: 2, title: '模仿一种动物', winnerUserId: 'u2', winningAmount: 30, bidCount: 3 }),
  ]

  it('builds per-player rows sorted by wins then remaining coins', () => {
    const bill = buildAuctionBill({
      results,
      bidders: BIDDERS,
      balances: { u1: 40, u2: 70, u3: 100 },
    })
    expect(bill.map((r) => r.userId)).toEqual(['u1', 'u2', 'u3'])
    expect(bill[0].wonTitles).toEqual(['唱一首跑调的歌', '讲一个社死瞬间'])
    expect(bill[0].wonCount).toBe(2)
    expect(bill[2].wonTitles).toEqual([])
    expect(bill[2].remainingCoins).toBe(100)
  })

  it('countLotsWonBy drives the soft endgame hint threshold (≥2)', () => {
    expect(countLotsWonBy(results, 'u1')).toBe(2)
    expect(countLotsWonBy(results, 'u1')).toBeGreaterThanOrEqual(AUCTION_COLLECTION_HINT_THRESHOLD)
    expect(countLotsWonBy(results, 'u2')).toBe(1)
    expect(countLotsWonBy(results, 'u3')).toBe(0)
    expect(countLotsWonBy(undefined, 'u1')).toBe(0)
  })
})

// ─── 6. Copy compliance scan (AC-16 / D7) ─────────────────────────────────

/** Locked gambling-vocab blacklist (spec D7, contract AC-16) — the canonical
 *  list lives in the shared copy module and is re-exported by the client
 *  module; scanning against IT (not a local copy) proves the modules agree. */
const GAMBLING_BLACKLIST: readonly string[] = AUCTION_GAMBLING_VOCAB_BLACKLIST

function collectAllNewCopyStrings(): string[] {
  return [...AUCTION_V2_HERO_SCREEN_COPY, ...AUCTION_V2_FINALE_SCREEN_COPY, AUCTION_V2_ALL_IN_LABEL_FALLBACK]
}

describe('auctionV2 copy · compliance scan (AC-16)', () => {
  it('gambling-vocab blacklist is absent from every new string', () => {
    const violations: Array<{ word: string; copy: string }> = []
    for (const copy of collectAllNewCopyStrings()) {
      for (const word of GAMBLING_BLACKLIST) {
        if (copy.includes(word)) violations.push({ word, copy })
      }
    }
    expect(violations).toEqual([])
  })

  it('「全押」 never co-appears with 赌/赢 on the same screen copy set', () => {
    for (const set of [AUCTION_V2_HERO_SCREEN_COPY, AUCTION_V2_FINALE_SCREEN_COPY]) {
      const hasAllIn = set.some((s) => s.includes(AUCTION_V2_ALL_IN_LABEL))
      const hasGambleOrWin = set.some((s) => s.includes('赌') || s.includes('赢'))
      expect(hasAllIn && hasGambleOrWin).toBe(false)
    }
  })

  it('「全押」 rollback label lives in the centralized copy module (hot-swappable)', () => {
    expect(AUCTION_V2_ALL_IN_LABEL_FALLBACK).toBe('全押')
    // The rollback label itself passes the blacklist.
    for (const word of GAMBLING_BLACKLIST) {
      expect(AUCTION_V2_ALL_IN_LABEL_FALLBACK).not.toContain(word)
    }
  })

  it('low-balance prompt is the locked copy (never 「你没钱了」)', () => {
    expect(AUCTION_V2_LOW_BALANCE_HINT).toBe('攒着币等下一件喜欢的')
    expect(collectAllNewCopyStrings().some((s) => s.includes('你没钱了'))).toBe(false)
  })

  it('no machine-explaining copy and no real-world value analogy', () => {
    for (const copy of collectAllNewCopyStrings()) {
      expect(copy).not.toContain('系统为你生成')
      expect(copy).not.toContain('充值')
      expect(copy).not.toContain('购买')
      expect(copy).not.toContain('现金')
      expect(copy).not.toContain('人民币')
      expect(copy).not.toContain('相当于')
    }
  })
})
