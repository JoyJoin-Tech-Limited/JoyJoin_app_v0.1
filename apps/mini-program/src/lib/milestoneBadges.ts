/**
 * Achievement & Milestone Badges — Batch D (2026-06-04).
 *
 * Nine collectible badge/medallion illustrations for ongoing post-onboarding
 * milestones (first event, 3-event streak, quiz halfway, five flavors of
 * match-chemistry, end-of-season "stamp of you"). Lifts 成就感 (Achievement)
 * and 仪式感 (Ritual) — the two 情绪价值 dimensions that currently score
 * ~2.5/4 in the app.
 *
 * The 5 D4 match-reason badges pair with the Batch B REVEAL_MAP icons
 * (same-relationship, same-archetype-band, same-work-industry, exact-archetype,
 * hometown-industry) — they are the magnified shared-chemistry hero.
 *
 * Source: `apps/mini-program/src/assets/badges/{name}-20260604-v1.webp`
 * Brief:  `docs/design/lovart-brief-achievement-milestone-batch-d-20260604.md`
 *
 * Raster spec:
 * - WebP primary (q=55, 600px max width) — Path B local-bundle deployment
 * - Bundled locally via Taro `copy.patterns` in `config/index.ts`
 * - Total: ~300KB across 9 files (main package zip ~1.98MB)
 *
 * Usage:
 *   import { MILESTONE_BADGES } from '../lib/milestoneBadges'
 *   <Image src={MILESTONE_BADGES.firstEvent} className='badge' />
 */

import { localAsset } from './utils/cdnAssets'

const BASE = '/assets/badges'

export const MILESTONE_BADGES = {
  /** D1 — `my-events` empty → first join transition, or "first event" profile badge */
  firstEvent: localAsset(`${BASE}/first-event-celebrate-20260604-v1.webp`),
  /** D2 — Profile / rewards — "你已参加 3 场活动" */
  streak3: localAsset(`${BASE}/streak-3-events-20260604-v1.webp`),
  /** D3 — `personality-test` at Q30 trigger */
  quizHalfway: localAsset(`${BASE}/quiz-halfway-cheer-20260604-v1.webp`),
  /** D4a — `matching-status` shared-chemistry card, paired with Batch B `reveal-same-relationship` */
  matchReasonSameRelationship: localAsset(`${BASE}/match-reason-same-relationship-20260604-v1.webp`),
  /** D4b — Paired with Batch B `reveal-same-archetype-band` */
  matchReasonSameArchetypeBand: localAsset(`${BASE}/match-reason-same-archetype-band-20260604-v1.webp`),
  /** D4c — Paired with Batch B `reveal-same-work-industry` */
  matchReasonSameWorkIndustry: localAsset(`${BASE}/match-reason-same-work-industry-20260604-v1.webp`),
  /** D4d — Paired with Batch B `reveal-exact-archetype` */
  matchReasonExactArchetype: localAsset(`${BASE}/match-reason-exact-archetype-20260604-v1.webp`),
  /** D4e — Paired with Batch B `reveal-hometown-industry` */
  matchReasonHometownIndustry: localAsset(`${BASE}/match-reason-hometown-industry-20260604-v1.webp`),
  /** D5 — `RecapPhaseView` end stamp overlay */
  recapStamp: localAsset(`${BASE}/recap-stamp-of-you-20260604-v1.webp`),
} as const

export type MilestoneBadgeKey = keyof typeof MILESTONE_BADGES

/**
 * Match-reason key mapping — pairs the 5 Batch D shared-chemistry heroes
 * with the 5 Batch B REVEAL_MAP icons. Use this in `UnifiedRevealCard.tsx`
 * to pick the right hero for each chemistry type.
 *
 * The emoji keys match the existing `REVEAL_MAP` in `emojiToIconMap.ts`.
 */
export const MATCH_REASON_BADGE_MAP: Record<string, MilestoneBadgeKey> = {
  '💫': 'matchReasonSameRelationship',     // Batch B: reveal-same-relationship
  '🎵': 'matchReasonSameArchetypeBand',    // Batch B: reveal-same-archetype-band
  '🤝': 'matchReasonSameWorkIndustry',     // Batch B: reveal-same-work-industry
  '✨': 'matchReasonExactArchetype',       // Batch B: reveal-exact-archetype
  '🔥': 'matchReasonHometownIndustry',     // Batch B: reveal-hometown-industry
}
