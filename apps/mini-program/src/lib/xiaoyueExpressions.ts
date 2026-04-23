import Taro from '@tarojs/taro'

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

const ROOT_BASE = '/assets/personality/xiaoyue'
const ONBOARDING_BASE = '/pages/onboarding/assets/personality/xiaoyue'
const EXTRAS_BASE = '/pages/extras/assets/personality/xiaoyue'
const EXPERIENCE_BASE = '/pages/experience/assets/personality/xiaoyue'

const ONBOARDING_EXPRESSION_IDS = new Set<XiaoyueExpressionId>([
  'homeWelcome',
  'matchWaiting',
  'matchSuccess',
  'loadingSystem',
  'loadingReveal',
  'coachGuide',
])

const EXTRAS_EXPRESSION_IDS = new Set<XiaoyueExpressionId>([
  'thanksFeedback',
])

const EXPERIENCE_EXPRESSION_IDS = new Set<XiaoyueExpressionId>([
  'matchWaiting',
  'loadingReveal',
  'optOutReassure',
])

/** Semantic basenames — nine shipped poses (开心欢迎 … 提醒通知). */
const ART_BASENAME_BY_EXPRESSION: Record<XiaoyueExpressionId, string> = {
  homeWelcome: 'xiaoyue-home-welcome.webp',
  matchWaiting: 'xiaoyue-match-waiting.webp',
  matchSuccess: 'xiaoyue-match-success.webp',
  loadingSystem: 'xiaoyue-thinking.webp',
  loadingReveal: 'xiaoyue-match-waiting.webp',
  actionSuccess: 'xiaoyue-action-success.webp',
  actionFailure: 'xiaoyue-action-failure.webp',
  thanksFeedback: 'xiaoyue-thanks-feedback.webp',
  coachGuide: 'xiaoyue-cheer-encourage.webp',
  paymentTrust: 'xiaoyue-reminder-notice.webp',
  optOutReassure: 'xiaoyue-cheer-encourage.webp',
  neutralInformation: 'xiaoyue-reminder-notice.webp',
}

export const XIAOYUE_ASSET_BY_EXPRESSION: Record<XiaoyueExpressionId, string> = Object.fromEntries(
  Object.entries(ART_BASENAME_BY_EXPRESSION).map(([id, basename]) => [id, `${ROOT_BASE}/${basename}`]),
) as Record<XiaoyueExpressionId, string>

function resolveCurrentRoute(): string {
  const pages = Taro.getCurrentPages()
  return pages[pages.length - 1]?.route ?? ''
}

function resolveBasePath(id: XiaoyueExpressionId): string {
  const route = resolveCurrentRoute()

  if (route.startsWith('pages/onboarding/') && ONBOARDING_EXPRESSION_IDS.has(id)) {
    return ONBOARDING_BASE
  }

  if (route.startsWith('pages/extras/') && EXTRAS_EXPRESSION_IDS.has(id)) {
    return EXTRAS_BASE
  }

  if (route.startsWith('pages/experience/') && EXPERIENCE_EXPRESSION_IDS.has(id)) {
    return EXPERIENCE_BASE
  }

  return ROOT_BASE
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
  return `${resolveBasePath(id)}/${ART_BASENAME_BY_EXPRESSION[id]}`
}

export type XiaoyueMood = LegacyXiaoyueMood | XiaoyueExpressionId

export function getXiaoyueAsset(mood: XiaoyueMood): string {
  if (mood === 'normal' || mood === 'excited' || mood === 'pointing') {
    return getXiaoyueExpressionAsset(LEGACY_MOOD_TO_EXPRESSION[mood])
  }
  return getXiaoyueExpressionAsset(mood)
}
