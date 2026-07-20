/**
 * Ceremony & Belonging Heroes — Batch C (2026-06-04) + v0.1 registration gaps (2026-06-16).
 *
 * Full-bleed hero illustrations for high-emotion transition moments
 * (returning after absence, payment confirmation, inviting a friend,
 * post-event thanks, session end). These lift 仪式感 (Ritual)
 * and 归属感 (Belonging) — the two 情绪价值 dimensions that currently
 * score ~2.5/4 in the app.
 *
 * Source: `apps/mini-program/src/assets/ceremony/{name}-20260604-v1.webp`
 *         `apps/mini-program/src/assets/ceremony/{name}-20260616-v1.webp`
 * Brief:  `docs/design/lovart-brief-ceremony-belonging-batch-c-20260604.md`
 *         `docs/design/lovart-brief-event-ticket-payment-success-20260616.md`
 *         `docs/design/lovart-brief-pool-registration-success-20260616.md`
 *         `docs/design/lovart-brief-payment-verifying-20260616.md`
 *         `docs/design/lovart-brief-blind-box-reveal-ritual-20260616.md`
 *         `docs/design/lovart-brief-invite-header-hero-20260616.md`
 *
 * Raster spec:
 * - WebP primary (q=55, 600px max width) — CDN deployment
 * - Uploaded via `npm run upload:cdn-assets`; not bundled in the mini-program
 * - Batch C total: ~285KB across 8 files
 * - v0.1 gap fills: ~78KB across 6 files
 *
 * Usage:
 *   import { CEREMONY_HEROES } from '../lib/ceremonyHeroes'
 *   <Image src={CEREMONY_HEROES.welcomeBack} className='hero' mode='aspectFit' />
 */

import { cdnAsset } from './utils/cdnAssets'

const BASE = '/assets/ceremony'

export const CEREMONY_HEROES = {
  /** C1 — `/pages/onboarding/welcome-back` */
  welcomeBack: cdnAsset(`${BASE}/welcome-back-hero-20260604-v1.webp`),
  /** C2 — `/pages/payment-verification` success state */
  eventPaidConfirmed: cdnAsset(`${BASE}/event-paid-confirmed-20260604-v1.webp`),
  /** C4 — `/pages/invite` share-card section */
  inviteCoBranded: cdnAsset(`${BASE}/invite-co-branded-20260604-v1.webp`),
  /** C5 — `/pages/event-feedback` success state */
  eventFeedbackThanks: cdnAsset(`${BASE}/event-feedback-thanks-20260604-v1.webp`),
  /** C6 — `/pages/icebreaker-session/phases/RecapPhaseView` end overlay */
  seeYouNextTime: cdnAsset(`${BASE}/see-you-next-time-20260604-v1.webp`),

  /** v0.1 — `/pages/event-ticket-payment` ticket hero banner */
  eventTicketHero: cdnAsset(`${BASE}/lovart-event-ticket-payment-hero-20260617-v1.webp`),
  /** v0.1 — `/pages/event-ticket-payment` success state (legacy; use eventTicketSuccessV2) */
  eventTicketSuccess: cdnAsset(`${BASE}/event-ticket-success-20260616-v1.webp`),
  /**
   * v0.2 — `/pages/event-ticket-payment` success state (2026-07-01 rework).
   * Warmer full-bleed ceremony scene with Xiaoyue + 小太阳鸡 co-celebrating.
   * Primary WebP + PNG fallback for WeChat runtime compatibility.
   */
  eventTicketSuccessV2: {
    webp: cdnAsset(`${BASE}/event-ticket-success-20260701-v2.webp`),
    png: cdnAsset(`${BASE}/event-ticket-success-20260701-v2.png`),
  },
  /** v0.1 — `/pages/event-ticket-payment` verifying state */
  paymentVerifying: cdnAsset(`${BASE}/payment-verifying-20260616-v1.webp`),
  /** v0.1 — `/pages/pool-registration` free-registration success state */
  poolRegistrationSuccess: cdnAsset(`${BASE}/pool-registration-success-20260616-v1.webp`),
  /** v0.1 — `/pages/blind-box-payment` Ritual V2 revelation backdrop */
  blindBoxReveal: cdnAsset(`${BASE}/blind-box-reveal-20260616-v1.webp`),
  /** v0.1 — `/pages/invite` header hero */
  inviteHeader: cdnAsset(`${BASE}/invite-header-20260616-v1.webp`),
} as const

export type CeremonyHeroKey = keyof typeof CEREMONY_HEROES
