/**
 * Session Glow copy — 高光值全部新增文案
 * (sprint wave4-sessionGlow, contract AC-11(a)/AC-17, spec D2/D3/D5).
 *
 * surface: 'social-icebreaker' recap phase 「今晚的高光」 block
 * toneMode: 'yuezai-voice' — warm, cozy, zero competitive framing.
 *
 * 🔴 Hard constraints (spec D2/D4 + psychological-safety canon):
 * - Numbers NEVER appear: no point totals, no per-source counts, no
 *   rankings. Tier words + medals only. The contract's static copy test
 *   asserts no glow-derived digits reach any rendered string.
 * - The floor tier 微光 must read as positive presence, never as a
 *   consolation prize ("静静发光也是光" direction).
 * - The all-zero-table empty state must be honest ("今晚这桌更像静静相处的
 *   一桌" direction) — never fabricate highlights.
 * - No comparison vocabulary between players (最/第一/赢/输/排名/领先 are
 *   banned in tier/table/breakdown copy; medal titles are the historical
 *   exception governed by medalCuration).
 *
 * ⚠️ ALL strings in this module are PENDING 🔴 Hard Rules human review
 * (contract AC-11(a)) before `sessionGlowEnabled=true` in any environment.
 * Machine values (tier enum 'ember'|'warm'|'blazing', table-line variant
 * keys 'hot'|'warm'|'quiet') live in code; ONLY display strings live here.
 */

import type { GlowTier } from '../socialIcebreaker';

// ─── 档位词 (spec D2 — machine values 'ember'|'warm'|'blazing') ───

/** Tier display words. 微光 is the positive floor: presence alone glows. */
export const GLOW_TIER_WORDS: Record<GlowTier, string> = {
  ember: '微光',
  warm: '暖心',
  blazing: '闪闪发光',
} as const;

/** Floor-tier reassurance line (spec D2: "静静发光也是光" direction). */
export const GLOW_FLOOR_TIER_LINE = '静静发光也是光';

// ─── 桌级行 (spec D3 — exactly 3 deterministic variants, verifier M3) ───

/** Table-line variant machine keys (selection logic lives in
 *  apps/server/src/lib/sessionGlow.ts; tests pin variant COUNT + selection
 *  determinism, never these strings). */
export type GlowTableLineVariant = 'hot' | 'warm' | 'quiet';

export const GLOW_TABLE_LINES: Record<GlowTableLineVariant, string> = {
  hot: '这桌今晚越走越热，高光一个接一个',
  warm: '这桌今晚慢慢热了起来，处处有小高光',
  quiet: '今晚这桌更像静静相处的一桌',
} as const;

/** Block title above the per-person cards (spec D3). */
export const GLOW_BLOCK_TITLE = '这桌今晚的高光时刻';

// ─── 空态 (spec D5 — all-zero table, honest, zero medals) ───

/** Honest empty-state line when the whole table has zero glow signals.
 *  Never fabricates highlights; pairs with the all-ember tier floor. */
export const GLOW_EMPTY_STATE_LINE = '今晚这桌更像静静相处的一桌，微光也是光';

// ─── 本人明细 (spec D4 — own breakdown only, collapsed by default) ───

/** Collapsed-self-breakdown toggle labels. */
export const GLOW_DETAIL_EXPAND_LABEL = '看看我的高光来自哪里';
export const GLOW_DETAIL_COLLAPSE_LABEL = '收起';

/** Per-source breakdown labels (own card only). Rendered WITHOUT counts —
 *  the client appends no numerals; source names stand alone as narrative. */
export const GLOW_SOURCE_LABELS = {
  quip: '接梗被点赞',
  mirror: '被同桌提名',
  auction: '拍下心仪的一件',
  miniscript: '破案双对',
  undercover: '卧底时刻',
  challenge: '完成了挑战',
  dice: '完成了骰子挑战',
  lie: '完成了侦探回合',
} as const;

/** 「看下一位」 manual advance affordance (spec D3). */
export const GLOW_NEXT_CARD_LABEL = '看下一位';

// ─── 新增数据奖章 (spec D2 — 奖章诚实铁律: 无底层数据永不颁发) ───

/** Copy for the four NEW data-derived medals (the three legacy medals
 *  最佳侦探/挑战先锋/话题王 keep their existing copy in medalCuration.ts —
 *  brand preserved, honesty reworked, contract AC-06). Server-side emoji in
 *  Medal objects is an established pattern (MedalIcon renders it). */
export const GLOW_MEDAL_COPY = {
  quipKing: {
    title: '接梗王',
    emoji: '🎤',
    description: '接住的每个梗都让这桌更热了一点',
  },
  warmRadar: {
    title: '暖心雷达',
    emoji: '💗',
    description: '总能看见同桌身上的闪光点',
  },
  bigSpender: {
    title: '豪气担当',
    emoji: '🔨',
    description: '出手果断，把喜欢的那件拍回家',
  },
  fullAttendance: {
    title: '全勤小可爱',
    emoji: '🌟',
    description: '每个环节都在场，全程在线',
  },
} as const;
