// Wave 2 Auction V2 copy — CLIENT-SURFACE extension of the shared module.
//
// The canonical auction copy lives at `packages/shared/src/copy/auctionV2.ts`
// (contract AC-16 — incl. the hot-swappable 「全力一击」 fallback, the
// gambling-vocab blacklist, and every string the SERVER also renders). This
// local module:
//   1. re-exports the shared symbols the client renders, so there is exactly
//      ONE source of truth for overlapping copy (the WeChat-review hot-swap
//      edits shared only), and
//   2. carries the CLIENT-ONLY surface strings the shared module does not
//      cover today (bid-ladder tier names, award-CARD detail lines, finale
//      surface copy) — upstream candidates if another surface ever needs
//      them.
//
// Hard rules (verified by __tests__/auctionV2Model.test.ts):
// - The shared gambling-vocab blacklist must never appear in any string.
// - 「全押」 never co-appears with 赌/赢 in the same screen's copy set.
// - Coins never analogize to real-world value; no raw emoji; no
//   「系统为你生成」; award copy is positively framed only.

import {
  AUCTION_AWARD_NAMES,
  AUCTION_GAMBLING_VOCAB_BLACKLIST,
  AUCTION_ALL_IN_BADGE,
  AUCTION_ALL_IN_FALLBACK_LABEL,
  AUCTION_LOW_BALANCE_HINT,
  getAuctionCollectionHint,
  getAuctionHostAllInHint,
  getAuctionOutbidToast,
} from '@shared/copy/auctionV2'

// ── Re-exports: single source of truth for overlapping copy ───────────────

export { AUCTION_GAMBLING_VOCAB_BLACKLIST }

/** Live label for the all-in tier / badge / history tag. */
export const AUCTION_V2_ALL_IN_LABEL = AUCTION_ALL_IN_BADGE

/** Documented WeChat-review fallback (spec R-D 预案, hot-swap, no flag). */
export const AUCTION_V2_ALL_IN_LABEL_FALLBACK = AUCTION_ALL_IN_FALLBACK_LABEL

/** Low-balance prompt — NEVER 「你没钱了」 (spec D7.4). */
export const AUCTION_V2_LOW_BALANCE_HINT = AUCTION_LOW_BALANCE_HINT

export const auctionV2OutbidToast = getAuctionOutbidToast
export const auctionV2HostAllInHint = getAuctionHostAllInHint
export const auctionV2CollectionHint = getAuctionCollectionHint

// ── Client-only: bid ladder tier names (D1) ────────────────────────────────

export const AUCTION_V2_TIER_STEADY_NAME = '稳一手'
export const AUCTION_V2_TIER_JUMP_NAME = '加一点'

// ── Client-only: award-card copy (D4 act 1) ────────────────────────────────
// Award NAMES ride the shared registry (keyed here by the client award kind).
// The card detail lines below are client-surface splits (headline ≠ detail);
// the shared module's `getAuction*Line` variants are server recap lines.

export const AUCTION_V2_AWARD_TITLES = {
  biggest_spend: AUCTION_AWARD_NAMES.biggestSpender,
  bargain: AUCTION_AWARD_NAMES.bargainHunter,
  hottest: AUCTION_AWARD_NAMES.hottestLot,
  steadiest: AUCTION_AWARD_NAMES.steadiestHand,
} as const

export function auctionV2BiggestSpendDetail(amount: number, lotTitle: string): string {
  return `${amount} 币拿下《${lotTitle}》`
}

export function auctionV2BargainDetail(amount: number, lotTitle: string): string {
  return `${amount} 币带走《${lotTitle}》，太会挑了`
}

/** 捡漏王 when only one lot sold all night — praise-the-taste framing. */
export function auctionV2BargainSoloDetail(lotTitle: string): string {
  return `全场唯一成交，《${lotTitle}》的眼光独一份`
}

export function auctionV2HottestDetail(bidCount: number): string {
  return `${bidCount} 次出价，人气最高`
}

/** Praises restraint ONLY — never contrasts or mocks the bidders (spec R-E). */
export function auctionV2SteadiestDetail(remainingCoins: number): string {
  return `一件没拍也精彩，${remainingCoins} 币握得稳稳的`
}

// ── Client-only: finale surface (D4) ───────────────────────────────────────

export const AUCTION_V2_FINALE_TITLE = '拍卖结算'
export const AUCTION_V2_FINALE_SUBTITLE = '全部竞拍已完成，看看今晚的高光'
export const AUCTION_V2_FINALE_TAP_TO_REVEAL = '点按揭晓'
export const AUCTION_V2_FINALE_REVEAL_ALL = '全部揭晓'
export const AUCTION_V2_FINALE_BILL_TITLE = '全桌账单'
export const AUCTION_V2_FINALE_NO_WINS = '本轮没有拍到藏品'
export const AUCTION_V2_FINALE_ME_SUFFIX = '（我）'
export const AUCTION_V2_FINALE_APPLAUSE_HINT = '为今晚的高光鼓鼓掌'

export function auctionV2FinaleRemainingCoins(coins: number): string {
  return `剩余 ${coins} 币`
}

// ── Screen copy sets (co-occurrence contract) ──────────────────────────────
//
// AC-16: 「全押」 never co-appears with 赌/赢 on the same screen. These sets
// enumerate every user-visible string per screen (dynamic templates resolved
// with representative sample values) so the copy-scan test can assert the
// rule per screen rather than per module.

export const AUCTION_V2_HERO_SCREEN_COPY: readonly string[] = [
  AUCTION_V2_TIER_STEADY_NAME,
  AUCTION_V2_TIER_JUMP_NAME,
  AUCTION_V2_ALL_IN_LABEL,
  auctionV2OutbidToast('阿杰', 35),
  auctionV2HostAllInHint('阿杰'),
  AUCTION_V2_LOW_BALANCE_HINT,
  auctionV2CollectionHint(2),
]

export const AUCTION_V2_FINALE_SCREEN_COPY: readonly string[] = [
  AUCTION_V2_AWARD_TITLES.biggest_spend,
  AUCTION_V2_AWARD_TITLES.bargain,
  AUCTION_V2_AWARD_TITLES.hottest,
  AUCTION_V2_AWARD_TITLES.steadiest,
  auctionV2BiggestSpendDetail(80, '唱一首跑调的歌'),
  auctionV2BargainDetail(5, '唱一首跑调的歌'),
  auctionV2BargainSoloDetail('唱一首跑调的歌'),
  auctionV2HottestDetail(7),
  auctionV2SteadiestDetail(100),
  AUCTION_V2_FINALE_TITLE,
  AUCTION_V2_FINALE_SUBTITLE,
  AUCTION_V2_FINALE_TAP_TO_REVEAL,
  AUCTION_V2_FINALE_REVEAL_ALL,
  AUCTION_V2_FINALE_BILL_TITLE,
  AUCTION_V2_FINALE_NO_WINS,
  AUCTION_V2_FINALE_ME_SUFFIX,
  AUCTION_V2_FINALE_APPLAUSE_HINT,
  auctionV2FinaleRemainingCoins(60),
]
