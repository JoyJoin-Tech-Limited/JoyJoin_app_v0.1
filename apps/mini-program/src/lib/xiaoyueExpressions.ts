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
  // Personality test phase expressions (unique assets shipped)
  | 'testCurious'
  | 'testListening'
  | 'testNod'
  | 'testSurprised'

/** Legacy three-state API (maps into {@link XiaoyueExpressionId}). */
export type LegacyXiaoyueMood = 'normal' | 'excited' | 'pointing'

const BASE = '/assets/personality/xiaoyue'

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
