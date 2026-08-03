/**
 * Pool Teaser copy — pool-registration Step 0 信末预告条文案
 *
 * surface: 'pool-registration'
 * toneMode: 'yuezai-voice'
 *
 * Sprint pool-reg-teaser-20260801 (AC-02). Copy owner sign-off: APPROVED
 * 2026-08-01 — faithful pre-registration mirror of the approved Flow 2
 * lifecycle copy (2026-07-29). 🔴 rules: zero emoji, no AI/算法/权重
 * self-explanation, canonical 桌 terminology, future-tense 悦仔 first person.
 */

export type PoolTeaserNodeIconId =
  | 'spot_locked'
  | 'yuezai_matching'
  | 'table_formed'
  | 'event_reveal'
  | 'offline_meet'
  | 'story_kept';

export interface PoolTeaserNodeCopy {
  /** Semantic icon id; the mini-program maps ids to CDN flow-icon assets. */
  iconId: PoolTeaserNodeIconId;
  /** Compact node label, ≤6 chars. */
  label: string;
}

export const POOL_TEASER_VOICE_LINE = '你入座之后，我会一步步帮你把这场局凑起来';

export const POOL_TEASER_NODES: readonly PoolTeaserNodeCopy[] = [
  { iconId: 'spot_locked', label: '锁定名额' },
  { iconId: 'yuezai_matching', label: '悦仔组局' },
  { iconId: 'table_formed', label: '这桌成形' },
  { iconId: 'event_reveal', label: '活动揭晓' },
  { iconId: 'offline_meet', label: '线下见面' },
  { iconId: 'story_kept', label: '收进故事' },
] as const;
