/**
 * Auction V2 copy — 拍卖重设计全部新增文案
 * (sprint wave2-auctionV2, contract AC-16, spec D7).
 *
 * surface: 'social-icebreaker' auction phase (blaze tier)
 * toneMode: 'yuezai-voice' — warm, factual, zero gambling framing.
 *
 * 🔴 Hard constraints (spec D7):
 * - Gambling-vocab blacklist is enforced by the contract test
 *   (auctionV2.test.ts copy scan): 赌/博彩/押注/下注/赔率/庄家/赢钱/输/本金/
 *   回报/梭哈 must NEVER appear in any string produced here.
 * - 「全押」 never co-appears with 赌/赢 in the same string or screen copy
 *   set. Its documented降级预案 is AUCTION_ALL_IN_FALLBACK_LABEL
 *   (「全力一击」) — a hot-swap target if WeChat review objects (spec R-D).
 *   It is NOT rendered anywhere today; switching = one-line change here.
 * - Coins are session-ephemeral virtual integers: never analogize to real
 *   money or physical value, never 充值/购买/兑换/提现/奖金/现金/价值.
 * - Low balances are framed forward-looking, never shaming.
 */

// ─── 赌博词汇黑名单 (auction domain, spec D7.2) ───
// This array DEFINES the ban list for the contract's copy scan; it is the
// only export in this module allowed to contain these words.
export const AUCTION_GAMBLING_VOCAB_BLACKLIST = [
  '赌',
  '博彩',
  '押注',
  '下注',
  '赔率',
  '庄家',
  '赢钱',
  '输',
  '本金',
  '回报',
  '梭哈',
] as const;

// ─── 反超提醒 (D2) ───

/** Outbid toast (3s auto-dismiss). Factual + warm, no 对抗感. */
export function getAuctionOutbidToast(displayName: string, amount: number): string {
  return `${displayName} 出到 ${amount} 币，你被反超啦`;
}

// ─── 全押时刻 (D3) ───

/** Seal badge on the leader row + bid-history tag. 扑克语境 but virtual-coin,
 *  zero-stakes framing; NEVER co-renders with 赌/赢 copy on the same screen. */
export const AUCTION_ALL_IN_BADGE = '全押';

/** Documented WeChat-review fallback for AUCTION_ALL_IN_BADGE (spec R-D预案).
 *  Hot-swap only — not rendered unless review rejects 「全押」. */
export const AUCTION_ALL_IN_FALLBACK_LABEL = '全力一击';

/** Host panel light hint (decision aid, never a force). */
export function getAuctionHostAllInHint(displayName: string): string {
  return `${displayName} 全押了，可以落槌`;
}

// ─── 经济与余额 (D5/D7.4) ───

/** Low-balance prompt — forward-looking, never 「你没钱了」. */
export const AUCTION_LOW_BALANCE_HINT = '攒着币等下一件喜欢的';

/** Endgame protection nudge under the bid buttons of a 2+-lot winner. */
export function getAuctionCollectionHint(wonCount: number): string {
  return `你已经有 ${wonCount} 件藏品啦`;
}

// ─── 落槌与流拍 (AC-06) ───

/** Unsold lot recap line — lighter than the legacy 「流拍（无人出价）」. */
export function getAuctionUnsoldLotLine(title: string): string {
  return `${title}这条先跳过`;
}

// ─── 奖项 (D4) ───
// Award names are 🔴-flagged for human copy review before flag-on
// (contract AC-10(d)); 最稳的手 must read as praise of 定力, never mockery.

export const AUCTION_AWARD_NAMES = {
  biggestSpender: '今晚最敢花',
  bargainHunter: '捡漏王',
  hottestLot: '全场最热',
  steadiestHand: '最稳的手',
} as const;

/** Recap award lines (≤3, deterministic — NO LLM, spec D4 recap v2). */
export function getAuctionBiggestSpenderLine(displayName: string, amount: number, title: string): string {
  return `今晚最敢花：${displayName}，${amount} 币拿下《${title}》`;
}

export function getAuctionBargainHunterLine(
  displayName: string,
  amount: number,
  title: string,
  onlyWinner: boolean,
): string {
  return onlyWinner
    ? `捡漏王：${displayName} 眼光独到，${amount} 币拿下《${title}》`
    : `捡漏王：${displayName} 仅用 ${amount} 币拿下《${title}》`;
}

export function getAuctionHottestLotLine(title: string, bidCount: number): string {
  return `全场最热：《${title}》共 ${bidCount} 次出价`;
}
