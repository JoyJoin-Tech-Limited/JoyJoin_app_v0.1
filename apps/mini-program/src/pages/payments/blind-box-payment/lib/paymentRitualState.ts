/**
 * Payment Ritual V2 — State Machine & Types
 *
 * 5-act ritual architecture for 24/24 emotional value.
 * Sprint 1: Foundation (Acts I-III)
 */

import type { MiniProgramPaymentPlanKey } from '../../../lib/payment/paymentPageModel'

// ─── Ritual Acts ───

export type RitualAct =
  | 'entering'        // Dark screen, Xiaoyue only
  | 'anticipating'    // Title reveal, community pulse
  | 'revealing'       // Archetype hero, identity moment
  | 'choosing'        // Plan selection active
  | 'committing'      // CTA focused (Sprint 2)
  | 'processing'      // Payment in progress (Sprint 2)
  | 'celebrating'     // Handoff to verification (Sprint 2)

export type RitualAction =
  | { type: 'REVEAL' }
  | { type: 'SELECT_PLAN'; planId: MiniProgramPaymentPlanKey }
  | { type: 'COMMIT' }
  | { type: 'PAYMENT_START' }
  | { type: 'PAYMENT_SUCCESS' }
  | { type: 'PAYMENT_ERROR'; error: string }
  | { type: 'RESET' }

// ─── Archetype Theming ───

export type ArchetypeFamily = 'warm' | 'cool' | 'fire' | 'calm'

export interface ArchetypeTheme {
  family: ArchetypeFamily
  primaryColor: string
  accentSoft: string
  accentBold: string
  accentText: string
}

// ─── Social Proof ───

export interface CommunityPulse {
  city: string
  totalMembers: number
  weeklyNewMembers: number
  monthlyEvents: number
}

export interface PlanSocialProof {
  recentChoosers: number
  testimonial?: string
  isRecommended: boolean
}

// ─── Value Anchoring ───

export interface ValueAnchor {
  perSessionPrice: string
  dailyPrice?: string
  savingsAmount: string
  savingsPercent: string
}

// ─── Ritual Context (from API) ───

export interface RitualContext {
  userArchetype: string | null
  archetypeDisplayName: string | null
  archetypeFamily: ArchetypeFamily
  community: CommunityPulse
  contextActivity: string | null
  plans: RitualPlan[]
  scarcity: {
    remainingSpots: number
    offerExpiry: string | null
  }
  coupons: RitualCoupon[]
  variant: 'control' | 'ritual_v2'
}

export interface RitualPlan {
  id: MiniProgramPaymentPlanKey
  displayName: string
  description: string
  price: number
  originalPrice?: number
  valueAnchor: ValueAnchor
  socialProof: PlanSocialProof
  badge: string
  supportCopy: string
}

export interface RitualCoupon {
  id: string
  code: string
  title: string
  description: string
}

// ─── State Machine ───

export interface RitualState {
  act: RitualAct
  selectedPlan: MiniProgramPaymentPlanKey | null
  previousPayments: number
  isFastPath: boolean
}

export const RITUAL_MACHINE: Record<RitualAct, Partial<Record<RitualAction['type'], RitualAct>>> = {
  entering: { REVEAL: 'anticipating' },
  anticipating: { REVEAL: 'revealing' },
  revealing: { SELECT_PLAN: 'choosing' },
  choosing: { SELECT_PLAN: 'choosing', COMMIT: 'committing' },
  committing: { PAYMENT_START: 'processing' },
  processing: { PAYMENT_SUCCESS: 'celebrating', PAYMENT_ERROR: 'choosing' },
  celebrating: { RESET: 'entering' },
}

export function transitionRitual(state: RitualState, action: RitualAction): RitualState {
  const transitions = RITUAL_MACHINE[state.act]
  const nextAct = transitions?.[action.type]

  if (!nextAct) return state

  return {
    ...state,
    act: nextAct,
    selectedPlan: action.type === 'SELECT_PLAN' ? action.planId : state.selectedPlan,
  }
}

// ─── Fast Path Detection ───

export function shouldUseFastPath(previousPayments: number): boolean {
  return previousPayments >= 2
}

// ─── A/B Variant Assignment ───

export function assignRitualVariant(userId: string): 'control' | 'ritual_v2' {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 2 === 0 ? 'control' : 'ritual_v2'
}
