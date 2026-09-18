// Wave 2 Auction V2 — pure client view-model.
//
// Locked-contract scope (`.git/.orchestration/sprints/sprint-contract.wave2-auctionV2.md`
// AC-11…AC-14, spec D1–D5): bid-ladder math, outbid/all-in beat coordination,
// one-shot ceremony markers, finale award computation, and the bill model.
// Everything here is deterministic and unit-tested — zero LLM, zero DOM/Taro
// APIs, zero server assumptions beyond the additive V2 state fields.

import type { AuctionLotResult, SocialSessionState } from '@shared/socialIcebreaker'
import {
  AUCTION_V2_ALL_IN_LABEL,
  AUCTION_V2_AWARD_TITLES,
  AUCTION_V2_TIER_JUMP_NAME,
  AUCTION_V2_TIER_STEADY_NAME,
  auctionV2BargainDetail,
  auctionV2BargainSoloDetail,
  auctionV2BiggestSpendDetail,
  auctionV2HottestDetail,
  auctionV2SteadiestDetail,
} from '../../../lib/copy/auctionV2'

// ── D1: bid ladder ─────────────────────────────────────────────────────────

export type AuctionBidTier = 'steady' | 'jump' | 'all_in'

/** Metadata the ladder hands to the bid action for analytics (AC-14). */
export interface AuctionBidClientMeta {
  tier: AuctionBidTier
  lotIndex: number
  isAllIn: boolean
}

/** Round UP to the nearest multiple of 5 (spec D1 `round5`). */
export function roundUpTo5(n: number): number {
  if (n <= 0) return 0
  return Math.ceil(n / 5) * 5
}

export interface AuctionLadderInput {
  /** Current high-bid amount (0 when the lot has no bids yet). */
  high: number
  /** Current user's remaining (un-escrowed) balance. */
  balance: number
  /** Current user's own escrowed high bid — `high` when the current user is
   *  the leader, else 0. Spendable = balance + ownEscrowedBid. */
  ownEscrowedBid: number
}

export interface AuctionLadderTierState {
  tier: AuctionBidTier
  /** Tier display name (稳一手 / 加一点 / 全押). */
  name: string
  /** Post-bid TOTAL price — never the increment (spec D1). */
  amount: number
  /** Total-price label, e.g. '20' or '全押 80'. */
  label: string
  /** Disabled when the tier costs more than spendable, or cannot beat the
   *  current high (all-in with zero free balance while leading). */
  disabled: boolean
}

export interface AuctionLadderState {
  /** balance + ownEscrowedBid — the full amount the user can commit. */
  spendable: number
  tiers: [AuctionLadderTierState, AuctionLadderTierState, AuctionLadderTierState]
  /** True when every tier is disabled → show the low-balance prompt. */
  allTiersDisabled: boolean
}

/**
 * Locked formula (contract AC-11, spec D1):
 * - 稳一手: high + max(5, round5(high × 0.10))
 * - 加一点: high + max(15, round5(high × 0.30))
 * - 全押:  full spendable (balance + own escrowed high bid)
 * No-bid state (high = 0) renders 5 / 15 / 全押.
 */
export function computeAuctionLadder(input: AuctionLadderInput): AuctionLadderState {
  const { high, balance, ownEscrowedBid } = input
  const spendable = balance + ownEscrowedBid

  const steadyAmount = high + Math.max(5, roundUpTo5(high * 0.1))
  const jumpAmount = high + Math.max(15, roundUpTo5(high * 0.3))
  const allInAmount = spendable

  const isDisabled = (amount: number) => amount > spendable || amount <= high

  const tiers: AuctionLadderState['tiers'] = [
    {
      tier: 'steady',
      name: AUCTION_V2_TIER_STEADY_NAME,
      amount: steadyAmount,
      label: `${steadyAmount}`,
      disabled: isDisabled(steadyAmount),
    },
    {
      tier: 'jump',
      name: AUCTION_V2_TIER_JUMP_NAME,
      amount: jumpAmount,
      label: `${jumpAmount}`,
      disabled: isDisabled(jumpAmount),
    },
    {
      tier: 'all_in',
      name: AUCTION_V2_ALL_IN_LABEL,
      amount: allInAmount,
      label: `${AUCTION_V2_ALL_IN_LABEL} ${allInAmount}`,
      disabled: isDisabled(allInAmount),
    },
  ]

  return { spendable, tiers, allTiersDisabled: tiers.every((t) => t.disabled) }
}

/** Snapshot gate — `true` only when the server snapshotted the
 *  `auctionV2Enabled` DB flag ON at auction phase entry. `undefined` ≡
 *  flag-off ≡ V1 (default-false flag, nothing to backfill). Every V2 render
 *  branch keys off this so the flag-OFF path stays byte-for-byte V1. */
export function isAuctionV2SnapshotOn(
  state: SocialSessionState | null | undefined,
): boolean {
  return state?.auctionV2Enabled === true
}

/** Snapshot-gated bid-input selector (AC-11 / behavior-preservation): the V2
 *  ladder renders only when the server snapshotted the flag ON; otherwise the
 *  V1 free-input UI renders byte-for-byte unchanged. */
export function resolveAuctionBidInputMode(
  state: SocialSessionState | null | undefined,
): 'ladder' | 'free-input' {
  return isAuctionV2SnapshotOn(state) ? 'ladder' : 'free-input'
}

// ── D2: outbid beat coordination ───────────────────────────────────────────

/** Beat-triggered early refresh debounce (spec D8.4 — no poll storm). */
export const AUCTION_BEAT_REFRESH_DEBOUNCE_MS = 1000

/** State-free self-check (AC-12): beats carry no targetUserId, so the only
 *  question a client may ask is "was the last-known high bid mine?". */
export function wasLastHighBidMine(
  highBid: { userId: string } | null | undefined,
  currentUserId: string,
): boolean {
  return !!highBid && highBid.userId === currentUserId
}

export function buildOutbidEventKey(input: {
  lotIndex: number
  userId: string
  amount: number
}): string {
  return `outbid:${input.lotIndex}:${input.userId}:${input.amount}`
}

/**
 * Coordinates the two outbid/all-in channels (WS beat = acceleration, 3s poll
 * = sole state truth) so each moment announces exactly once:
 * - `nudge` beat → 1s-debounced early refresh (multiple beats inside the
 *   window schedule ONE refresh); buzz only when the self-check passed.
 * - `reveal` beat → same debounced refresh; the all-in buzz is table-wide.
 * - When the poll later delivers the transition, `consumeOutbidChannel` /
 *   `consumeAllInBeatBuzzed` tell the detector whether the beat already
 *   handled the haptic — no double-buzz, "late, never missing".
 */
export class AuctionV2BeatCoordinator {
  private refreshTimer: ReturnType<typeof setTimeout> | null = null
  private outbidBeatPending = false
  private allInBeatBuzzed = false
  private readonly debounceMs: number
  private readonly onRefresh: () => void

  constructor(options: { onRefresh: () => void; debounceMs?: number }) {
    this.onRefresh = options.onRefresh
    this.debounceMs = options.debounceMs ?? AUCTION_BEAT_REFRESH_DEBOUNCE_MS
  }

  /** nudge-pattern beat during live V2 bidding. Returns true when the client
   *  should buzz NOW — only when the last-known high bid was the local
   *  user's (state-free self-check). */
  handleOutbidBeat(lastHighBidWasMine: boolean): boolean {
    this.scheduleRefresh()
    if (!lastHighBidWasMine) return false
    this.outbidBeatPending = true
    return true
  }

  /** reveal-pattern beat during live V2 bidding (all-in). Always buzzes —
   *  the all-in moment is a table-wide reveal (spec D3). */
  handleAllInBeat(): boolean {
    this.scheduleRefresh()
    this.allInBeatBuzzed = true
    return true
  }

  /** Attribution channel for a freshly-detected outbid toast. Consumes the
   *  pending marker so each transition announces exactly once. */
  consumeOutbidChannel(): 'beat' | 'poll' {
    const channel = this.outbidBeatPending ? 'beat' : 'poll'
    this.outbidBeatPending = false
    return channel
  }

  /** True (consumed once) when an all-in beat already buzzed this moment —
   *  the poll-delivered all-in state must not fire a second haptic. */
  consumeAllInBeatBuzzed(): boolean {
    const buzzed = this.allInBeatBuzzed
    this.allInBeatBuzzed = false
    return buzzed
  }

  /** Clear pending markers + timers (lot change / session rebind). */
  reset(): void {
    this.cancelRefresh()
    this.outbidBeatPending = false
    this.allInBeatBuzzed = false
  }

  dispose(): void {
    this.cancelRefresh()
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) return
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null
      this.onRefresh()
    }, this.debounceMs)
  }

  private cancelRefresh(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
  }
}

// ── D3: all-in ceremony one-shot ───────────────────────────────────────────

export function buildAllInEventKey(input: {
  lotIndex: number
  userId: string
  amount: number
}): string {
  return `allin:${input.lotIndex}:${input.userId}:${input.amount}`
}

/** One-shot marker: the all-in burst/haptic/analytics fire once per all-in
 *  event (lotIndex + bidder + amount), never on every poll re-render. */
export class AuctionAllInOneShot {
  private consumedKeys: string[] = []

  /** Returns true the first time a key is seen, false on every repeat. */
  consume(key: string): boolean {
    if (this.consumedKeys.includes(key)) return false
    this.consumedKeys.push(key)
    // Bounded memory: a phase sees at most a handful of all-ins.
    if (this.consumedKeys.length > 32) {
      this.consumedKeys.splice(0, this.consumedKeys.length - 32)
    }
    return true
  }

  reset(): void {
    this.consumedKeys = []
  }
}

/** Effect decision for a freshly-detected all-in (AC-12/D8): reduced-motion
 *  renders the static badge only (zero particles); the haptic is flag-gated
 *  and skipped when the beat already buzzed this moment. */
export function resolveAllInCeremonyEffects(input: {
  reducedMotion: boolean
  hapticGrammarEnabled: boolean
  beatAlreadyBuzzed: boolean
}): { fireBurst: boolean; fireHaptic: boolean } {
  return {
    fireBurst: !input.reducedMotion,
    fireHaptic: input.hapticGrammarEnabled && !input.beatAlreadyBuzzed,
  }
}

// ── D5: endgame hint ───────────────────────────────────────────────────────

/** Show the soft collection hint once the user has won this many lots. */
export const AUCTION_COLLECTION_HINT_THRESHOLD = 2

export function countLotsWonBy(
  results: AuctionLotResult[] | undefined,
  userId: string,
): number {
  if (!results) return 0
  return results.filter((r) => r.winnerUserId === userId).length
}

// ── D4: finale awards (deterministic, NO LLM) ──────────────────────────────

export interface AuctionAwardRosterEntry {
  userId: string
  displayName: string
}

export type AuctionAwardKind = 'biggest_spend' | 'bargain' | 'hottest' | 'steadiest'

export interface AuctionAward {
  kind: AuctionAwardKind
  /** 奖项名 (今晚最敢花 / 捡漏王 / 全场最热 / 最稳的手). */
  title: string
  /** Winner display name — or the lot title for 全场最热 (never names an
   *  individual there, spec D4). */
  headline: string
  /** Positively-framed detail line. */
  detail: string
}

export interface ComputeAuctionAwardsInput {
  results: AuctionLotResult[]
  /** Bidders only — the caller excludes the host (hosts never bid). */
  bidders: AuctionAwardRosterEntry[]
  balances: Record<string, number>
}

/**
 * Locked 判定规则 + 空态规则 (contract AC-13, spec D4):
 * - 今晚最敢花: highest single winningAmount; 全场流拍 → skip.
 * - 捡漏王: lowest winningAmount ≥ 1; only 1 winner overall → still awarded
 *   with praise-the-taste framing.
 * - 全场最热: lot with the highest bidCount (title + count, never a person);
 *   tie → first-occurring lot; no bids at all → skip.
 * - 最稳的手: won nothing + most remaining coins; everyone won → skip.
 */
export function computeAuctionAwards(input: ComputeAuctionAwardsInput): AuctionAward[] {
  const { results, bidders, balances } = input
  const sold = results.filter(
    (r): r is AuctionLotResult & { winnerUserId: string; winningAmount: number } =>
      r.winnerUserId !== null && r.winningAmount !== null,
  )
  const nameOf = (userId: string) =>
    bidders.find((b) => b.userId === userId)?.displayName ?? '匿名'

  const awards: AuctionAward[] = []

  // 今晚最敢花 — highest single winning amount (first-occurring on ties).
  if (sold.length > 0) {
    const top = sold.reduce((best, r) => (r.winningAmount > best.winningAmount ? r : best))
    awards.push({
      kind: 'biggest_spend',
      title: AUCTION_V2_AWARD_TITLES.biggest_spend,
      headline: nameOf(top.winnerUserId),
      detail: auctionV2BiggestSpendDetail(top.winningAmount, top.title),
    })

    // 捡漏王 — lowest winning amount ≥ 1 (first-occurring on ties). Still
    // awarded with a single winner; copy switches to praise-the-taste.
    const bargain = sold.reduce((best, r) => (r.winningAmount < best.winningAmount ? r : best))
    awards.push({
      kind: 'bargain',
      title: AUCTION_V2_AWARD_TITLES.bargain,
      headline: nameOf(bargain.winnerUserId),
      detail:
        sold.length === 1
          ? auctionV2BargainSoloDetail(bargain.title)
          : auctionV2BargainDetail(bargain.winningAmount, bargain.title),
    })
  }

  // 全场最热 — highest bidCount across all lots (tie → first-occurring).
  // Skipped only when nobody bid at all (a 0-bid "hottest" reads as broken).
  const hottest = results.reduce<AuctionLotResult | null>(
    (best, r) => (best === null || r.bidCount > best.bidCount ? r : best),
    null,
  )
  if (hottest && hottest.bidCount > 0) {
    awards.push({
      kind: 'hottest',
      title: AUCTION_V2_AWARD_TITLES.hottest,
      headline: `《${hottest.title}》`,
      detail: auctionV2HottestDetail(hottest.bidCount),
    })
  }

  // 最稳的手 — won nothing and holds the most remaining coins (roster order
  // on ties). Skipped when everyone won something.
  const winnerIds = new Set(sold.map((r) => r.winnerUserId))
  const steadiest = bidders
    .filter((b) => !winnerIds.has(b.userId))
    .reduce<AuctionAwardRosterEntry | null>(
      (best, b) =>
        best === null || (balances[b.userId] ?? 0) > (balances[best.userId] ?? 0) ? b : best,
      null,
    )
  if (steadiest) {
    awards.push({
      kind: 'steadiest',
      title: AUCTION_V2_AWARD_TITLES.steadiest,
      headline: steadiest.displayName,
      detail: auctionV2SteadiestDetail(balances[steadiest.userId] ?? 0),
    })
  }

  return awards
}

// ── D4 act 2: per-player bill (session-ephemeral, never persisted) ─────────

export interface AuctionBillRow {
  userId: string
  displayName: string
  wonTitles: string[]
  wonCount: number
  remainingCoins: number
}

/** In-room leaderboard: most wins first, then most remaining coins, roster
 *  order beyond that (stable). Sorting is allowed (spec D4 — in-session
 *  feedback, never a cross-session profile). */
export function buildAuctionBill(input: ComputeAuctionAwardsInput): AuctionBillRow[] {
  const { results, bidders, balances } = input
  return bidders
    .map((b) => {
      const wonTitles = results
        .filter((r) => r.winnerUserId === b.userId)
        .map((r) => r.title)
      return {
        userId: b.userId,
        displayName: b.displayName,
        wonTitles,
        wonCount: wonTitles.length,
        remainingCoins: balances[b.userId] ?? 0,
      }
    })
    .sort((a, b) => b.wonCount - a.wonCount || b.remainingCoins - a.remainingCoins)
}

// ── Beat reaction bus (page → auction view) ────────────────────────────────
//
// The page owns the single WS socket and the GroupBeatTracker (nonce dedupe +
// 6500ms suppression, reused unchanged). During a live V2 auction it reroutes
// nudge/reveal beats here instead of firing the generic haptic dispatch, so
// the auction view owns the reaction (self-checked outbid buzz, all-in table
// buzz) and the two channels can never double-fire. `groupBeatModel.ts`
// itself is untouched — the parser dispatches by pattern only.

export type AuctionV2BeatPattern = 'nudge' | 'reveal'
export type AuctionV2BeatListener = (pattern: AuctionV2BeatPattern) => void

const auctionBeatListeners = new Set<AuctionV2BeatListener>()

export function subscribeAuctionV2Beats(listener: AuctionV2BeatListener): () => void {
  auctionBeatListeners.add(listener)
  return () => {
    auctionBeatListeners.delete(listener)
  }
}

/** Called by the icebreaker-session page's beat dispatch only. */
export function publishAuctionV2Beat(pattern: AuctionV2BeatPattern): void {
  for (const listener of auctionBeatListeners) {
    listener(pattern)
  }
}

/** True while the session is in a live V2 auction — the only window in which
 *  incoming nudge/reveal beats are auction beats (host cannot advance before
 *  `auctionAllLotsClosed`, so no phase_advanced beat can collide here). */
export function isLiveAuctionV2Session(state: SocialSessionState | null | undefined): boolean {
  if (!state || !isAuctionV2SnapshotOn(state)) return false
  if ((state.auctionLots?.length ?? 0) === 0) return false
  return !(state.auctionAllLotsClosed ?? false)
}

/** Accessor for the V2 lot results on a plain session state (additive
 *  optional shared field — undefined on legacy V1 sessions). */
export function readAuctionLotResults(
  state: SocialSessionState | null | undefined,
): AuctionLotResult[] {
  return state?.auctionLotResults ?? []
}
