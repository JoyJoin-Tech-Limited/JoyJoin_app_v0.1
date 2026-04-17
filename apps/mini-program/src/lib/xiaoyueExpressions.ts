/**
 * Canonical Xiaoyue expression ids, asset paths, legacy mood mapping, and personality-test wiring.
 * Multiple ids may share the same PNG until design ships dedicated poses.
 */

export type XiaoyueExpressionId =
  | 'homeWelcome'
  | 'matchWaiting'
  | 'matchSuccess'
  | 'loadingSystem'
  | 'loadingReveal'
  | 'actionSuccess'
  | 'actionFailure'
  | 'thanksFeedback'
  | 'coachGuide'
  | 'paymentTrust'
  | 'optOutReassure'
  | 'neutralInformation'

/** Legacy three-state API (maps into {@link XiaoyueExpressionId}). */
export type LegacyXiaoyueMood = 'normal' | 'excited' | 'pointing'

const BASE = '/assets/personality/xiaoyue'

const LEGACY_PATH = {
  normal: `${BASE}/xiaoyue-normal.png`,
  excited: `${BASE}/xiaoyue-excited.png`,
  pointing: `${BASE}/xiaoyue-pointing.png`,
} as const

const SEMANTIC_PATH = {
  homeWelcome: `${BASE}/xiaoyue-home-welcome.png`,
  matchWaiting: `${BASE}/xiaoyue-match-waiting.png`,
  matchSuccess: `${BASE}/xiaoyue-match-success.png`,
  loading: `${BASE}/xiaoyue-loading.png`,
  actionSuccess: `${BASE}/xiaoyue-action-success.png`,
  actionFailure: `${BASE}/xiaoyue-action-failure.png`,
  thanksFeedback: `${BASE}/xiaoyue-thanks-feedback.png`,
} as const

const SUPPLEMENTARY_PATH = {
  coachGuide: LEGACY_PATH.pointing,
  paymentTrust: LEGACY_PATH.normal,
  optOutReassure: LEGACY_PATH.normal,
  neutralInformation: LEGACY_PATH.normal,
} as const

export const XIAOYUE_ASSET_BY_EXPRESSION: Record<XiaoyueExpressionId, string> = {
  homeWelcome: SEMANTIC_PATH.homeWelcome,
  matchWaiting: SEMANTIC_PATH.matchWaiting,
  matchSuccess: SEMANTIC_PATH.matchSuccess,
  loadingSystem: SEMANTIC_PATH.loading,
  loadingReveal: SEMANTIC_PATH.loading,
  actionSuccess: SEMANTIC_PATH.actionSuccess,
  actionFailure: SEMANTIC_PATH.actionFailure,
  thanksFeedback: SEMANTIC_PATH.thanksFeedback,
  coachGuide: SUPPLEMENTARY_PATH.coachGuide,
  paymentTrust: SUPPLEMENTARY_PATH.paymentTrust,
  optOutReassure: SUPPLEMENTARY_PATH.optOutReassure,
  neutralInformation: SUPPLEMENTARY_PATH.neutralInformation,
}

export const LEGACY_MOOD_TO_EXPRESSION: Record<LegacyXiaoyueMood, XiaoyueExpressionId> = {
  normal: 'neutralInformation',
  excited: 'matchSuccess',
  pointing: 'coachGuide',
}

export const PERSONALITY_TEST_XIAOYUE_EXPRESSION = {
  introHero: 'homeWelcome',
  completing: 'loadingSystem',
  resultsCelebrate: 'matchSuccess',
  resultsCoach: 'thanksFeedback',
  resultsSlotFallback: 'matchWaiting',
} as const satisfies Record<string, XiaoyueExpressionId>

export function getXiaoyueExpressionAsset(id: XiaoyueExpressionId): string {
  return XIAOYUE_ASSET_BY_EXPRESSION[id]
}

export type XiaoyueMood = LegacyXiaoyueMood | XiaoyueExpressionId

export function getXiaoyueAsset(mood: XiaoyueMood): string {
  if (mood === 'normal' || mood === 'excited' || mood === 'pointing') {
    return getXiaoyueExpressionAsset(LEGACY_MOOD_TO_EXPRESSION[mood])
  }
  return getXiaoyueExpressionAsset(mood)
}
