/**
 * Payment Ritual V2 — Analytics Events
 *
 * Tracks the full emotional journey for funnel analysis and A/B testing.
 */

import { discoverAnalytics } from '../../../lib/analytics/discoverAnalytics'

const EVENTS = {
  // Act I
  RITUAL_ENTER: 'ritual_enter',
  RITUAL_ACT1_COMPLETE: 'ritual_act1_complete',

  // Act II
  RITUAL_ACT2_REVEAL: 'ritual_act2_reveal',
  RITUAL_ARCHETYPE_SHOWN: 'ritual_archetype_shown',

  // Act III
  RITUAL_PLAN_HOVER: 'ritual_plan_hover',
  RITUAL_PLAN_SELECT: 'ritual_plan_select',
  RITUAL_PLAN_RESELECT: 'ritual_plan_reselect',

  // Act IV (Sprint 2)
  RITUAL_CTA_TAP: 'ritual_cta_tap',
  RITUAL_CTA_HESITATION: 'ritual_cta_hesitation',

  // Payment
  RITUAL_PAYMENT_START: 'ritual_payment_start',
  RITUAL_PAYMENT_SUCCESS: 'ritual_payment_success',
  RITUAL_PAYMENT_ERROR: 'ritual_payment_error',

  // Post-payment (Sprint 2)
  RITUAL_VERIFICATION_ENTER: 'ritual_verification_enter',
  RITUAL_ACHIEVEMENT_SHOWN: 'ritual_achievement_shown',

  // Qualitative
  RITUAL_EMOTIONAL_SCORE: 'ritual_emotional_score',
} as const

type EventName = (typeof EVENTS)[keyof typeof EVENTS]

export function trackRitualEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null>,
) {
  discoverAnalytics.track(event as any, undefined, properties)
}

export function trackRitualEnter(variant: 'control' | 'ritual_v2', hasArchetype: boolean) {
  trackRitualEvent(EVENTS.RITUAL_ENTER, { variant, hasArchetype: String(hasArchetype) })
}

export function trackAct1Complete() {
  trackRitualEvent(EVENTS.RITUAL_ACT1_COMPLETE)
}

export function trackAct2Reveal(archetypeFamily: string) {
  trackRitualEvent(EVENTS.RITUAL_ACT2_REVEAL, { archetypeFamily })
}

export function trackArchetypeShown(archetype: string | null) {
  trackRitualEvent(EVENTS.RITUAL_ARCHETYPE_SHOWN, { archetype: archetype ?? 'none' })
}

export function trackPlanHover(planId: string) {
  trackRitualEvent(EVENTS.RITUAL_PLAN_HOVER, { planId })
}

export function trackPlanSelect(planId: string, isRecommended: boolean) {
  trackRitualEvent(EVENTS.RITUAL_PLAN_SELECT, {
    planId,
    isRecommended: String(isRecommended),
  })
}

export function trackPlanReselect(fromPlanId: string, toPlanId: string) {
  trackRitualEvent(EVENTS.RITUAL_PLAN_RESELECT, { fromPlanId, toPlanId })
}

export function trackCtaTap(planId: string, amount: number) {
  trackRitualEvent(EVENTS.RITUAL_CTA_TAP, { planId, amount })
}

export function trackPaymentStart(planId: string) {
  trackRitualEvent(EVENTS.RITUAL_PAYMENT_START, { planId })
}

export function trackPaymentSuccess(planId: string, orderId: string) {
  trackRitualEvent(EVENTS.RITUAL_PAYMENT_SUCCESS, { planId, orderId })
}

export function trackPaymentError(planId: string, error: string) {
  trackRitualEvent(EVENTS.RITUAL_PAYMENT_ERROR, { planId, error: error.slice(0, 100) })
}

export function trackCtaHesitation(archetypeFamily: string) {
  trackRitualEvent(EVENTS.RITUAL_CTA_HESITATION, { archetypeFamily })
}

export function trackAchievementShown(achievementKey: string) {
  trackRitualEvent(EVENTS.RITUAL_ACHIEVEMENT_SHOWN, { achievementKey })
}

export function trackVerificationEnter(planId: string, orderId: string) {
  trackRitualEvent(EVENTS.RITUAL_VERIFICATION_ENTER, { planId, orderId })
}

export { EVENTS }
