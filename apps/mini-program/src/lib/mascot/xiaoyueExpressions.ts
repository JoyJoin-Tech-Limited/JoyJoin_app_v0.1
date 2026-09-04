/**
 * Canonical Xiaoyue expression ids and asset paths.
 *
 * Raster spec (see `npm run optimize:xiaoyue` in apps/mini-program):
 * - WebP only, max width 480px @ source (matches largest UI slot ~300rpx intro @ ~3x).
 * - Regenerate from PNG masters with `scripts/optimize-xiaoyue-assets.mjs`.
 * - Brand accent reference for art: #8B5CF6. WeChat `Image` supports WebP on current base libraries.
 *
 * All 16 expression ids now have unique assets. Previously some shared assets (e.g. match-waiting + reveal).
 */

import { cdnAsset } from '../utils/cdnAssets'

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
  | 'connectionsEmpty'
  // Personality test phase expressions (unique assets shipped)
  | 'testCurious'
  | 'testListening'
  | 'testNod'
  | 'testSurprised'
  // Match Compass expressions (mapped to existing assets until commissioned)
  | 'compassScan'
  | 'compassInsight'
  | 'compassCelebrate'
  // City unlock expression
  | 'cityUnlock'

/** Legacy three-state API (maps into {@link XiaoyueExpressionId}). */
export type LegacyXiaoyueMood = 'normal' | 'excited' | 'pointing'

const BASE = cdnAsset('/assets/personality/xiaoyue')

/** Semantic basenames — all 16 expressions, unique assets. */
const ART = {
  homeWelcome: `${BASE}/xiaoyue-home-welcome.webp`,
  coachGuide: `${BASE}/xiaoyue-coach-guide.webp`,
  loadingSystem: `${BASE}/xiaoyue-loading-system.webp`,
  loadingReveal: `${BASE}/xiaoyue-loading-reveal.webp`,
  matchWaiting: `${BASE}/xiaoyue-match-waiting.webp`,
  matchSuccess: `${BASE}/xiaoyue-match-success.webp`,
  actionSuccess: `${BASE}/xiaoyue-action-success.webp`,
  actionFailure: `${BASE}/xiaoyue-action-failure.webp`,
  thanksFeedback: `${BASE}/xiaoyue-thanks-feedback.webp`,
  neutralInformation: `${BASE}/xiaoyue-neutral-information.webp`,
  // Grid 2 — test-phase + utility expressions (all have unique assets)
  testCurious: `${BASE}/xiaoyue-test-curious.webp`,
  testListening: `${BASE}/xiaoyue-test-listening.webp`,
  testNod: `${BASE}/xiaoyue-test-nod.webp`,
  testSurprised: `${BASE}/xiaoyue-test-surprised.webp`,
  optOutReassure: `${BASE}/xiaoyue-opt-out-reassure.webp`,
  paymentTrust: `${BASE}/xiaoyue-payment-trust.webp`,
  connectionsEmpty: `${BASE}/xiaoyue-connections-empty.webp`,
  // City unlock — city explorer with paper airplane
  cityUnlock: `${BASE}/xiaoyue-city-unlock.webp`,
  // Match Compass — mapped to existing assets until dedicated ones are commissioned
  compassScan: `${BASE}/xiaoyue-test-curious.webp`,
  compassInsight: `${BASE}/xiaoyue-coach-guide.webp`,
  compassCelebrate: `${BASE}/xiaoyue-match-success.webp`,
} as const

export const XIAOYUE_ASSET_BY_EXPRESSION: Record<XiaoyueExpressionId, string> = {
  homeWelcome: ART.homeWelcome,
  coachGuide: ART.coachGuide,
  loadingSystem: ART.loadingSystem,
  loadingReveal: ART.loadingReveal,
  matchWaiting: ART.matchWaiting,
  matchSuccess: ART.matchSuccess,
  actionSuccess: ART.actionSuccess,
  actionFailure: ART.actionFailure,
  thanksFeedback: ART.thanksFeedback,
  neutralInformation: ART.neutralInformation,
  testCurious: ART.testCurious,
  testListening: ART.testListening,
  testNod: ART.testNod,
  testSurprised: ART.testSurprised,
  optOutReassure: ART.optOutReassure,
  paymentTrust: ART.paymentTrust,
  connectionsEmpty: ART.connectionsEmpty,
  cityUnlock: ART.cityUnlock,
  compassScan: ART.compassScan,
  compassInsight: ART.compassInsight,
  compassCelebrate: ART.compassCelebrate,
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
  resultsCoach: 'coachGuide',
  resultsSlotFallback: 'matchWaiting',
  networkHolding: 'loadingReveal',
  errorState: 'actionFailure',
} as const satisfies Record<string, XiaoyueExpressionId>

/** Expression mapping for the testing-phase mascot questioner. */
export const PERSONALITY_TEST_QUESTION_EXPRESSION = {
  loading: 'loadingSystem',
  choice: 'testCurious',
  slider: 'testListening',
  emoji_tap: 'homeWelcome',
  acknowledged: 'testNod',
  milestone: 'testSurprised',
  error: 'actionFailure',
} as const satisfies Record<string, XiaoyueExpressionId>

/** Expression mapping for the social icebreaker session host shell.
 *  These reuse existing assets until dedicated icebreaker expressions are commissioned. */
export const ICEBREAKER_XIAOYUE_EXPRESSION = {
  waiting: 'homeWelcome',
  warmup: 'coachGuide',
  micro_challenge: 'matchSuccess',
  lie_detective: 'testCurious',
  auction: 'matchSuccess',
  personality_dice: 'testSurprised',
  speed_friending: 'coachGuide',
  mini_script: 'coachGuide',
  quip_battle: 'testSurprised',
  undercover_word: 'testCurious',
  group_mirror: 'matchSuccess',
  recap: 'thanksFeedback',
  ended: 'thanksFeedback',
  phase_selection: 'coachGuide',
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
