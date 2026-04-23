import {
  hasAnonymousAssessmentResult,
  type AnonymousAssessmentResult,
  type AnonymousAssessmentSessionSnapshot,
  type AnonymousAssessmentTopMatch,
} from '../../../../lib/anonymousOnboarding'

export type FlowStage = 'loading' | 'slot' | 'reveal' | 'bridge' | 'result' | 'error' | 'empty'
export type SlotPhase = 'anticipation' | 'spinning' | 'holding' | 'slowing' | 'nearMiss' | 'landed'
export type RevealPhase = 'silhouette' | 'fill' | 'sparkle'

export interface ResolvedResultState {
  sessionId: string
  completedAt?: string
  result: AnonymousAssessmentResult
  topMatches: AnonymousAssessmentTopMatch[]
}

export const ARCHETYPE_SEQUENCE = [
  '开心柯基',
  '太阳鸡',
  '夸夸豚',
  '机智狐',
  '淡定海豚',
  '织网蛛',
  '暖心熊',
  '灵感章鱼',
  '沉思猫头鹰',
  '定心大象',
  '稳如龟',
  '隐身猫',
]

export const TRAIT_LABELS: Array<{ key: string; label: string }> = [
  { key: 'A', label: '亲和力' },
  { key: 'O', label: '开放性' },
  { key: 'C', label: '责任心' },
  { key: 'E', label: '稳定感' },
  { key: 'X', label: '外向度' },
  { key: 'P', label: '快乐值' },
]

/**
 * Centralized animation timing profile.
 * All timing constants are consolidated here for easy tuning and A/B testing.
 * Override via env or query param: `?animationProfile=fast`
 */
export interface AnimationProfile {
  slotAnticipationMs: number
  slotSpinMs: number
  slotSpinIntervalMs: number
  slotHoldIntervalMs: number
  slotSlowStepDelays: number[]
  slotNearMissMs: number
  slotNearMissProbability: number
  slotRevealPauseMs: number
  revealSilhouetteMs: number
  revealFillMs: number
  revealGlowMs: number
  bridgeMs: number
  slowNetworkMs: number
  flowSafetyTimeoutMs: number
}

const DEFAULT_PROFILE: AnimationProfile = {
  slotAnticipationMs: 900,
  slotSpinMs: 2500,
  slotSpinIntervalMs: 120,
  slotHoldIntervalMs: 180,
  slotSlowStepDelays: [80, 130, 180, 230, 280, 330, 380, 430, 480, 530],
  slotNearMissMs: 360,
  slotNearMissProbability: 0.3,
  slotRevealPauseMs: 280,
  revealSilhouetteMs: 520,
  revealFillMs: 760,
  revealGlowMs: 500,
  bridgeMs: 300,
  slowNetworkMs: 3200,
  flowSafetyTimeoutMs: 16000,
}

const FAST_PROFILE: AnimationProfile = {
  ...DEFAULT_PROFILE,
  slotSpinMs: 1800,
  revealSilhouetteMs: 350,
  revealFillMs: 450,
  revealGlowMs: 300,
  bridgeMs: 150,
}

export function getAnimationProfile(): AnimationProfile {
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href)
    const profileName = url.searchParams.get('animationProfile')
    if (profileName === 'fast') return FAST_PROFILE
  }
  return DEFAULT_PROFILE
}

/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const SLOT_ANTICIPATION_MS = DEFAULT_PROFILE.slotAnticipationMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const SLOT_SPIN_MS = DEFAULT_PROFILE.slotSpinMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const SLOT_NEAR_MISS_MS = DEFAULT_PROFILE.slotNearMissMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const SLOT_REVEAL_PAUSE_MS = DEFAULT_PROFILE.slotRevealPauseMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const SLOT_SPIN_INTERVAL_MS = DEFAULT_PROFILE.slotSpinIntervalMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const SLOT_HOLD_INTERVAL_MS = DEFAULT_PROFILE.slotHoldIntervalMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const SLOT_SLOW_STEP_DELAYS = DEFAULT_PROFILE.slotSlowStepDelays
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const RESULT_SLOW_NETWORK_MS = DEFAULT_PROFILE.slowNetworkMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const FLOW_SAFETY_TIMEOUT_MS = DEFAULT_PROFILE.flowSafetyTimeoutMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const REVEAL_SILHOUETTE_MS = DEFAULT_PROFILE.revealSilhouetteMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const REVEAL_FILL_MS = DEFAULT_PROFILE.revealFillMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const REVEAL_SPARKLE_MS = DEFAULT_PROFILE.revealGlowMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const RESULT_BRIDGE_MS = DEFAULT_PROFILE.bridgeMs
export const GENERIC_API_ERROR_PREFIX = 'Request failed with status'

export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function trimSentence(text: string | undefined): string {
  return (text ?? '').replace(/[。！!？?]+$/g, '').trim()
}

export function buildShareLine(archetype: string, tagline: string, summary: string): string {
  const detail = trimSentence(tagline) || trimSentence(summary)
  if (!detail) {
    return `我是${archetype}型，来 JoyJoin 看看我会点亮哪张卡。`
  }

  return `我是${archetype}型，${detail}。`
}

export function buildShareTitle(archetype: string, tagline: string): string {
  const detail = trimSentence(tagline)
  if (!detail) {
    return `我在 JoyJoin 解锁了 ${archetype}`
  }

  return `${archetype}已解锁：${detail}`
}

export function resolveResultErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message && !error.message.startsWith(GENERIC_API_ERROR_PREFIX)) {
    return error.message
  }

  return '结果同步失败，请稍后重试。'
}

export function getTraitEntries(
  result: AnonymousAssessmentResult | null | undefined,
): Array<{ key: string; label: string; value: number }> {
  const traitScores = result?.traitScores ?? {}

  return TRAIT_LABELS.map(({ key, label }) => {
    const rawValue = Number(traitScores[key] ?? 50)
    return {
      key,
      label,
      value: Math.max(0, Math.min(Math.round(rawValue), 100)),
    }
  })
}

export function getTopMatches(
  result: AnonymousAssessmentResult | null | undefined,
  storedMatches: AnonymousAssessmentTopMatch[] | null | undefined,
): AnonymousAssessmentTopMatch[] {
  if (Array.isArray(storedMatches) && storedMatches.length > 0) {
    return storedMatches
  }

  return Array.isArray(result?.topMatches) ? result.topMatches : []
}

export function getVisibleReelItems(currentIndex: number): string[] {
  const length = ARCHETYPE_SEQUENCE.length
  const previousIndex = (currentIndex - 1 + length) % length
  const nextIndex = (currentIndex + 1) % length
  return [
    ARCHETYPE_SEQUENCE[previousIndex] ?? ARCHETYPE_SEQUENCE[0],
    ARCHETYPE_SEQUENCE[currentIndex] ?? ARCHETYPE_SEQUENCE[0],
    ARCHETYPE_SEQUENCE[nextIndex] ?? ARCHETYPE_SEQUENCE[0],
  ]
}

export function getConfidenceLabel(
  result: AnonymousAssessmentResult | null | undefined,
  topMatches: AnonymousAssessmentTopMatch[],
): string | undefined {
  const topScore = Number(topMatches[0]?.score)
  if (Number.isFinite(topScore) && topScore > 0) {
    return `匹配 ${Math.round(topScore)}%`
  }

  const rawConfidence = Number(result?.archetypeConfidence)
  if (!Number.isFinite(rawConfidence) || rawConfidence <= 0) {
    return undefined
  }

  const normalized = rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence
  return `匹配 ${Math.round(normalized)}%`
}

/**
 * Deterministic near-miss based on sessionId hash.
 * Replaces Math.random() for reproducibility and analytics.
 * Probability capped at 30% to reduce casino-feel manipulation.
 */
export function shouldNearMiss(sessionId: string | undefined, probability = 0.3): boolean {
  if (!sessionId) return false
  let hash = 0
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0
  }
  return (Math.abs(hash) % 100) < Math.round(probability * 100)
}

export function buildResolvedResultState(
  snapshot: AnonymousAssessmentSessionSnapshot | null,
): ResolvedResultState | null {
  if (!snapshot?.sessionId || !snapshot.result || !hasAnonymousAssessmentResult(snapshot)) {
    return null
  }

  return {
    sessionId: snapshot.sessionId,
    completedAt: snapshot.completedAt,
    result: snapshot.result,
    topMatches: getTopMatches(snapshot.result, snapshot.topArchetypes),
  }
}
