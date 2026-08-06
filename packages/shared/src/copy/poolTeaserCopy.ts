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
 *
 * 2026-08-05 (Phase 4): voice line now names the 自研 matching engine as
 * **AURA** — copy-owner sign-off recorded; this single line overrides the 🔴
 * no-AI/算法/权重 self-explanation rule (brand name, not mechanism
 * explanation). AURA = "Attraction Unites, Resonance Aligns." — the sentence-
 * derived codename of 磁场引擎 (Magnetism Engine, canonical internal name per
 * docs/systems/MAGNETISM_ENGINE.md §1). User-facing mentions use 「AURA 引擎」,
 * never 磁力引擎 (Kuaishou ad platform) or 磁场引擎 (internal-only).
 * 2026-08-05 (voice-line revision, copy owner): dropped the process promise
 * 「会一步步帮你把这场局凑起来」as too vague (the nodes below already carry the
 * how) — voice line now carries the value proposition instead, reusing the
 * approved one-liner vocabulary 「磁场对路的人」.
 * 2026-08-05 (node-label softening, copy owner): 悦仔组局→等待同频 (teaser; 4-char limit per audit B1 — the Flow 2 overlay keeps the 6-char 等待同频桌友)
 * (removes machinery framing — AURA already named in the voice line) and
 * 这桌成形→桌友到齐 (conditional-friendly, no over-promise).
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

export const POOL_TEASER_VOICE_LINE = '我背后是自研 AURA 引擎，会帮你找到磁场对路的人';

export const POOL_TEASER_NODES: readonly PoolTeaserNodeCopy[] = [
  { iconId: 'spot_locked', label: '锁定名额' },
  // ≤4 chars required — 6 chars truncate to 「等待同频…」 at ~98rpx/node
  // (2026-08-05 pre-ship audit B1).
  { iconId: 'yuezai_matching', label: '等待同频' },
  { iconId: 'table_formed', label: '桌友到齐' },
  { iconId: 'event_reveal', label: '活动揭晓' },
  { iconId: 'offline_meet', label: '线下见面' },
  { iconId: 'story_kept', label: '收进故事' },
] as const;
