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
  | 'yueJuKa' | 'lianJuBao' | 'danChangJuPiao'
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
  yueJuKa: {
    canonical: '悦聚卡',
    alternate: null,
    legacy: ['活动礼包', '月度活动礼包', '季度活动礼包'],
    note: 'Entitlement pass family display name: 悦聚月卡/悦聚季卡 (see docs/copy/brand-copy-strategy.md §3.1)',
  },
  lianJuBao: {
    canonical: '连局包',
    alternate: null,
    legacy: ['活动包', '3次活动包', '6次活动包'],
    note: 'Event pack display name: 三连局包/六连局包',
  },
  danChangJuPiao: {
    canonical: '单场局票',
    alternate: null,
    legacy: ['单次票', '单次体验'],
    note: 'Single-event ticket display name',
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
 * Review-blocked vocabulary (🔴 Hard Rule) — WeChat review posture.
 *
 * These terms must never appear in user-visible copy on the launch-primary
 * mini-program. Event-booking vocabulary replaces them:
 *   匹配 → 排桌/合拍度 · 社交 → 活动/同桌 · 灵魂 → 同频 · 撮合 → 排桌
 * Machine identifiers and internal code are exempt; this list gates
 * user-facing strings only.
 *
 * Kept separate from `BANNED_WORDS` (which governs internal-commentary style)
 * so each gate can evolve without changing the other's contract.
 */
export const REVIEW_BLOCKED_VOCAB: string[] = [
  '匹配',
  '社交',
  '灵魂',
  '撮合',
  'AI',
];

/**
 * Check if user-visible copy contains any review-blocked vocabulary.
 * Case-insensitive for the ASCII token (`AI`/`ai`) and exact-substring for CJK.
 * Returns the first match or null.
 */
export function findReviewBlockedVocab(text: string): string | null {
  const lower = text.toLowerCase();
  for (const word of REVIEW_BLOCKED_VOCAB) {
    if (/^[\x00-\x7F]+$/.test(word)) {
      // ASCII token (e.g. `AI`): require a word boundary so English words such
      // as "email" / "detail" are not false-positives. CJK neighbours still
      // satisfy `\b` because they are non-word characters.
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(lower)) return word;
    } else if (lower.includes(word.toLowerCase())) {
      return word;
    }
  }
  return null;
}

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
