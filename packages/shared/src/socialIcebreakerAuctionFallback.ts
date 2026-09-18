/**
 * Auction V2 fallback lot bank — canonical 12-item curated library
 * (sprint wave2-auctionV2, contract AC-07, verifier M4).
 *
 * THE single source of curated auction lots. Consumed by:
 *   - apps/server/src/socialIcebreakerAuctionAI.ts (flag-ON fallback + M2
 *     shortfall padding), and
 *   - apps/server/src/jobs/preGenerationWorker.ts (delegation per verifier
 *     M4 — the worker's stale 3-item duplicate was retired in the same sprint).
 *
 * The flag-OFF path in socialIcebreakerAuctionAI.ts intentionally keeps its
 * own legacy 3-item constant (byte-for-byte behavior preservation, contract
 * AC-09) — do NOT "unify" that one.
 *
 * Content rules (spec D6/D7, contract AC-16): every lot is doable at the
 * table in 1–2 minutes, zero props, low pressure with a graceful skip, has
 * a suspense hook, and avoids privacy/alcohol/romance-history/politics/
 * religion. All 12 items pass the gambling-vocab blacklist
 * (赌/博彩/押注/下注/赔率/庄家/赢钱/输/本金/回报/梭哈) and require 🔴 human
 * copy review before `auctionV2Enabled` is set true anywhere (contract
 * AC-10(c)). Runtime is zero-LLM on this path.
 */

import type { AuctionLot } from './socialIcebreaker.js';

export type AuctionVibe = 'chat' | 'balanced' | 'game';

export type AuctionFallbackCategory = 'share' | 'perform' | 'co-create';

export interface AuctionFallbackLot extends AuctionLot {
  category: AuctionFallbackCategory;
  /** Vibes this lot suits (深聊 chat / 均衡 balanced / 暢玩 game). */
  vibes: readonly AuctionVibe[];
}

/**
 * 12 items — 分享型 ×5 / 表演型 ×4 / 共创型 ×3 (spec D6.2). The first three
 * keep the legacy fallback ids/titles for continuity; everything else is new.
 */
export const AUCTION_FALLBACK_BANK: readonly AuctionFallbackLot[] = [
  // ─── 分享型 (share) ───
  { id: 'lot_fb_1', title: '分享一个无伤大雅的社死瞬间', teaser: '越离谱越好，反正大家都不认识', emoji: '😅', category: 'share', vibes: ['chat', 'balanced', 'game'] },
  { id: 'lot_fb_2', title: '用三句话编一个离谱旅行故事', teaser: '现场即兴，瞎编也行', emoji: '✈️', category: 'share', vibes: ['chat', 'balanced', 'game'] },
  { id: 'lot_fb_3', title: '爆料一个今晚之前没人知道的小习惯', teaser: '说完就翻篇，不截图', emoji: '🤫', category: 'share', vibes: ['chat', 'balanced'] },
  { id: 'lot_fb_4', title: '说一个你坚持最久的奇怪仪式感', teaser: '越没用越值得讲', emoji: '🕯️', category: 'share', vibes: ['chat', 'balanced'] },
  { id: 'lot_fb_5', title: '讲一件小时候深信不疑、长大才发现是假的事', teaser: '谁的童年滤镜最厚', emoji: '🧒', category: 'share', vibes: ['chat', 'balanced'] },
  // ─── 表演型 (perform) ───
  { id: 'lot_fb_6', title: '用 30 秒即兴广告词推销桌上任意一件物品', teaser: '越一本正经越好笑', emoji: '📣', category: 'perform', vibes: ['game', 'balanced'] },
  { id: 'lot_fb_7', title: '模仿一种动物走进这家店的样子，让大家猜', teaser: '猜不出来也算你的', emoji: '🦩', category: 'perform', vibes: ['game'] },
  { id: 'lot_fb_8', title: '用播音腔播报今晚到目前为止的「现场集锦」', teaser: '语速越快越专业', emoji: '🎙️', category: 'perform', vibes: ['game', 'balanced'] },
  { id: 'lot_fb_9', title: '来一段 15 秒「获奖感言」，奖项自己编', teaser: '感谢名单越离谱越好', emoji: '🏆', category: 'perform', vibes: ['game', 'balanced'] },
  // ─── 共创型 (co-create) ───
  { id: 'lot_fb_10', title: '全桌接力，每人一句编「今晚之后我们去哪」的故事', teaser: '越接不上越有戏', emoji: '🚌', category: 'co-create', vibes: ['chat', 'balanced', 'game'] },
  { id: 'lot_fb_11', title: '和左手边的人用 1 分钟设计一家永远不会倒闭的小店', teaser: '卖点越怪越稳', emoji: '🏪', category: 'co-create', vibes: ['chat', 'balanced', 'game'] },
  { id: 'lot_fb_12', title: '全桌一起给今晚这桌起个群聊能用的名字', teaser: '起名废柴也有春天', emoji: '🏷️', category: 'co-create', vibes: ['chat', 'balanced', 'game'] },
] as const;

/** djb2 — tiny deterministic hash for session-seeded rotation. */
export function hashAuctionSessionId(sessionId: string): number {
  let hash = 5381;
  for (let i = 0; i < sessionId.length; i += 1) {
    hash = ((hash << 5) + hash + sessionId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Deterministic vibe-filtered, session-rotated selection (spec D6.2):
 * same sessionId → same subset (re-entry stability); different sessionIds →
 * rotated subsets. Vibe filter narrows to lots tagged for the table's vibe;
 * if the filter leaves fewer than `count` items, the full bank is used so
 * the deterministic lot-count target (spec D5) is always satisfiable.
 */
export function selectAuctionFallbackLots(params: {
  count: number;
  vibe?: AuctionVibe;
  sessionId?: string;
  excludeIds?: readonly string[];
}): AuctionFallbackLot[] {
  const { count, vibe, sessionId = '', excludeIds = [] } = params;
  const excluded = new Set(excludeIds);
  const vibePool = vibe
    ? AUCTION_FALLBACK_BANK.filter((lot) => lot.vibes.includes(vibe))
    : AUCTION_FALLBACK_BANK;
  const pool = (vibePool.length >= count ? vibePool : AUCTION_FALLBACK_BANK).filter(
    (lot) => !excluded.has(lot.id),
  );
  if (pool.length === 0 || count <= 0) return [];
  const offset = sessionId ? hashAuctionSessionId(sessionId) % pool.length : 0;
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  return rotated.slice(0, Math.min(count, pool.length));
}

/**
 * Verifier M2 (contract AC-07(e)): pad an under-delivering LLM generation to
 * the deterministic target from this session's rotated subset. Bank items
 * whose id OR title already appears in the live lots are skipped. Returns
 * the original array reference (paddedCount 0) when the target is met.
 */
export function padAuctionLotsToTarget(
  lots: AuctionLot[],
  targetCount: number,
  params: { vibe?: AuctionVibe; sessionId?: string } = {},
): { lots: AuctionLot[]; paddedCount: number } {
  if (lots.length >= targetCount) return { lots, paddedCount: 0 };
  const existingIds = lots.map((lot) => lot.id);
  const existingTitles = new Set(lots.map((lot) => lot.title));
  const candidates = selectAuctionFallbackLots({
    count: AUCTION_FALLBACK_BANK.length,
    vibe: params.vibe,
    sessionId: params.sessionId,
    excludeIds: existingIds,
  }).filter((lot) => !existingTitles.has(lot.title));
  const needed = targetCount - lots.length;
  const padding = candidates.slice(0, needed);
  if (padding.length === 0) return { lots, paddedCount: 0 };
  return { lots: [...lots, ...padding], paddedCount: padding.length };
}
