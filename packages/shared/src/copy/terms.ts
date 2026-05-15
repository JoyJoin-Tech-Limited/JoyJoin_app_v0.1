/**
 * Core Terminology — 🔴 Hard Rule
 *
 * Canonical term mapping and validation.
 * AI Agent and human editors MUST use Canonical terms in all user-facing copy.
 */

export type CanonicalTermId =
  | 'ju' | 'poBingJu' | 'changLiaoJu' | 'kuangHuanJu'
  | 'zhuo' | 'zhuoYou'
  | 'quanYi'
  | 'lianJie'
  | 'yueZai'
  | 'faXian';

/** Single entry in the terminology table */
export interface TermEntry {
  canonical: string;
  alternate: string | null;
  legacy: string[];
  note?: string;
}

export const TERMINOLOGY_TABLE: Record<string, TermEntry> = {
  ju: {
    canonical: '局',
    alternate: '活动 (admin nav only)',
    legacy: [],
    note: 'Universal event suffix: 饭局/酒局/破冰局/畅聊局/狂欢局',
  },
  poBingJu: {
    canonical: '破冰局',
    alternate: null,
    legacy: ['标准局', '标准'],
    note: 'breeze tier display name',
  },
  changLiaoJu: {
    canonical: '畅聊局',
    alternate: null,
    legacy: ['Premium局', 'Premium'],
    note: 'glow tier display name',
  },
  kuangHuanJu: {
    canonical: '狂欢局',
    alternate: null,
    legacy: ['酒吧局', '酒吧'],
    note: 'blaze tier display name',
  },
  zhuo: {
    canonical: '桌',
    alternate: '小队 (squad-unboxing transition only)',
    legacy: ['小组', '群组'],
    note: 'Group/table metaphor: 这桌/成桌/满员成桌',
  },
  zhuoYou: {
    canonical: '桌友',
    alternate: null,
    legacy: ['组员', '群友'],
    note: 'Table-mates in a gathering',
  },
  quanYi: {
    canonical: '权益',
    alternate: null,
    legacy: ['会员', 'VIP', '会员/VIP会员'],
    note: 'Subscription/entitlement label',
  },
  lianJie: {
    canonical: '连接',
    alternate: null,
    legacy: ['圈子'],
    note: 'Social connections tab name',
  },
  yueZai: {
    canonical: '悦仔',
    alternate: null,
    legacy: ['小悦', 'Mia', 'AI助手'],
    note: 'Mascot display name — use with verb+particle: 悦仔正在…/悦仔偷偷看了眼',
  },
  faXian: {
    canonical: '发现',
    alternate: null,
    legacy: [],
    note: 'Discovery/explore tab name',
  },
};

/** Banned words that must NEVER appear in user-facing copy */
export const BANNED_WORDS: string[] = [
  'LLM',
  '算法',
  '权重',
  '评分',
  '数据',
];

/**
 * Check if copy contains any 🔴 banned words. Returns the first match or null.
 * NOT a build-time gate yet — used by AI Agent for self-validation.
 */
export function findBannedWord(text: string): string | null {
  const lower = text.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      return word;
    }
  }
  return null;
}

/**
 * Check if copy uses legacy identifiers instead of canonical terms.
 * Returns list of violations.
 */
export function findLegacyTerms(text: string): string[] {
  const found: string[] = [];
  for (const entry of Object.values(TERMINOLOGY_TABLE)) {
    for (const legacy of entry.legacy) {
      if (text.includes(legacy)) {
        found.push(legacy);
      }
    }
  }
  return found;
}
