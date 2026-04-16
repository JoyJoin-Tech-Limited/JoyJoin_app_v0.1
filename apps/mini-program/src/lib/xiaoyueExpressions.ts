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

export const XIAOYUE_ASSET_BY_EXPRESSION: Record<XiaoyueExpressionId, string> = {
  homeWelcome: LEGACY_PATH.excited,
  matchWaiting: LEGACY_PATH.excited,
  matchSuccess: LEGACY_PATH.excited,
  loadingSystem: LEGACY_PATH.pointing,
  loadingReveal: LEGACY_PATH.pointing,
  actionSuccess: LEGACY_PATH.excited,
  actionFailure: LEGACY_PATH.normal,
  thanksFeedback: LEGACY_PATH.excited,
  coachGuide: LEGACY_PATH.pointing,
  paymentTrust: LEGACY_PATH.normal,
  optOutReassure: LEGACY_PATH.normal,
  neutralInformation: LEGACY_PATH.normal,
}

export const LEGACY_MOOD_TO_EXPRESSION: Record<LegacyXiaoyueMood, XiaoyueExpressionId> = {
  normal: 'neutralInformation',
  excited: 'matchSuccess',
  pointing: 'coachGuide',
}

export const PERSONALITY_TEST_XIAOYUE_EXPRESSION = {
  introHero: 'neutralInformation',
  completing: 'loadingSystem',
  resultsCelebrate: 'matchSuccess',
  resultsCoach: 'coachGuide',
  resultsSlotFallback: 'neutralInformation',
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
