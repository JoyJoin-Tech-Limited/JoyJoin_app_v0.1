/**
 * Ceremony & Belonging Heroes — Batch C (2026-06-04).
 *
 * Eight full-bleed hero illustrations for high-emotion transition moments
 * (returning after absence, payment confirmation, tier selection, inviting
 * a friend, post-event thanks, session end). These lift 仪式感 (Ritual)
 * and 归属感 (Belonging) — the two 情绪价值 dimensions that currently
 * score ~2.5/4 in the app.
 *
 * Source: `apps/mini-program/src/assets/ceremony/{name}-20260604-v1.webp`
 * Brief:  `docs/design/lovart-brief-ceremony-belonging-batch-c-20260604.md`
 *
 * Raster spec:
 * - WebP primary (q=55, 600px max width) — Path B local-bundle deployment
 * - Bundled locally via Taro `copy.patterns` in `config/index.ts`
 * - Total: ~285KB across 8 files (main package zip ~1.98MB)
 *
 * Usage:
 *   import { CEREMONY_HEROES } from '../lib/ceremonyHeroes'
 *   <Image src={CEREMONY_HEROES.welcomeBack} className='hero' mode='aspectFit' />
 */

import { localAsset } from './utils/cdnAssets'

const BASE = '/assets/ceremony'

export const CEREMONY_HEROES = {
  /** C1 — `/pages/onboarding/welcome-back` */
  welcomeBack: localAsset(`${BASE}/welcome-back-hero-20260604-v1.webp`),
  /** C2 — `/pages/payment-verification` success state */
  eventPaidConfirmed: localAsset(`${BASE}/event-paid-confirmed-20260604-v1.webp`),
  /** C3a — `/pages/icebreaker-session/tier-selector` 破冰局 (40 min) backdrop */
  tierVibeBreeze: localAsset(`${BASE}/tier-vibe-breeze-20260604-v1.webp`),
  /** C3b — `/pages/icebreaker-session/tier-selector` 畅聊局 (60 min) backdrop */
  tierVibeGlow: localAsset(`${BASE}/tier-vibe-glow-20260604-v1.webp`),
  /** C3c — `/pages/icebreaker-session/tier-selector` 狂欢局 (90 min) backdrop */
  tierVibeBlaze: localAsset(`${BASE}/tier-vibe-blaze-20260604-v1.webp`),
  /** C4 — `/pages/invite` share-card section */
  inviteCoBranded: localAsset(`${BASE}/invite-co-branded-20260604-v1.webp`),
  /** C5 — `/pages/event-feedback` success state */
  eventFeedbackThanks: localAsset(`${BASE}/event-feedback-thanks-20260604-v1.webp`),
  /** C6 — `/pages/icebreaker-session/phases/RecapPhaseView` end overlay */
  seeYouNextTime: localAsset(`${BASE}/see-you-next-time-20260604-v1.webp`),
} as const

export type CeremonyHeroKey = keyof typeof CEREMONY_HEROES

/**
 * Tier-selector convenience map. Use this in `tier-selector/index.tsx`
 * to pick the right backdrop per selected tier.
 */
export const TIER_VIBE_BACKDROPS: Record<'breeze' | 'glow' | 'blaze' | 'custom', string> = {
  breeze: CEREMONY_HEROES.tierVibeBreeze,
  glow: CEREMONY_HEROES.tierVibeGlow,
  blaze: CEREMONY_HEROES.tierVibeBlaze,
  // v0.1: reuse glow backdrop for custom mode until a dedicated hero is designed.
  custom: CEREMONY_HEROES.tierVibeGlow,
}
