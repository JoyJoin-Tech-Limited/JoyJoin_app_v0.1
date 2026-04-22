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

export const SLOT_ANTICIPATION_MS = 900
export const SLOT_SPIN_MS = 2800
export const SLOT_NEAR_MISS_MS = 360
export const SLOT_REVEAL_PAUSE_MS = 280
export const SLOT_SPIN_INTERVAL_MS = 120
export const SLOT_HOLD_INTERVAL_MS = 180
export const SLOT_SLOW_STEP_DELAYS = [80, 130, 180, 230, 280, 330, 380, 430, 480, 530]
export const RESULT_SLOW_NETWORK_MS = 3200
export const FLOW_SAFETY_TIMEOUT_MS = 16000
export const REVEAL_SILHOUETTE_MS = 520
export const REVEAL_FILL_MS = 760
export const REVEAL_SPARKLE_MS = 820
export const RESULT_BRIDGE_MS = 1100
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
