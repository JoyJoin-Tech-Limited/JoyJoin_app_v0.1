/**
 * Canonical Xiaoyue expression ids and asset paths.
 *
 * Raster spec (see `npm run optimize:xiaoyue` in apps/mini-program):
 * - WebP only, max width 480px @ source (matches largest UI slot ~300rpx intro @ ~3x).
 * - Regenerate from PNG masters with `scripts/optimize-xiaoyue-assets.mjs`.
 * - Brand accent reference for art: #8B5CF6. WeChat `Image` supports WebP on current base libraries.
 *
 * Some expression ids share an asset where the emotion overlaps (e.g. match-waiting + reveal anticipation).
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

/** Semantic basenames — nine shipped poses (开心欢迎 … 提醒通知). */
const ART = {
  homeWelcome: `${BASE}/xiaoyue-home-welcome.webp`,
  matchWaiting: `${BASE}/xiaoyue-match-waiting.webp`,
  matchSuccess: `${BASE}/xiaoyue-match-success.webp`,
  thinking: `${BASE}/xiaoyue-thinking.webp`,
  actionSuccess: `${BASE}/xiaoyue-action-success.webp`,
  actionFailure: `${BASE}/xiaoyue-action-failure.webp`,
  thanksFeedback: `${BASE}/xiaoyue-thanks-feedback.webp`,
  cheerEncourage: `${BASE}/xiaoyue-cheer-encourage.webp`,
  reminderNotice: `${BASE}/xiaoyue-reminder-notice.webp`,
} as const

export const XIAOYUE_ASSET_BY_EXPRESSION: Record<XiaoyueExpressionId, string> = {
  homeWelcome: ART.homeWelcome,
  matchWaiting: ART.matchWaiting,
  matchSuccess: ART.matchSuccess,
  loadingSystem: ART.thinking,
  loadingReveal: ART.matchWaiting,
  actionSuccess: ART.actionSuccess,
  actionFailure: ART.actionFailure,
  thanksFeedback: ART.thanksFeedback,
  coachGuide: ART.cheerEncourage,
  paymentTrust: ART.reminderNotice,
  optOutReassure: ART.cheerEncourage,
  neutralInformation: ART.reminderNotice,
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
