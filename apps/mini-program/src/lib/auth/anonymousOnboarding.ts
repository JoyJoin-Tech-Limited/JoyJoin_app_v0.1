import Taro from '@tarojs/taro'

export const ANONYMOUS_ASSESSMENT_SESSION_STORAGE_KEY = 'joyjoin_v4_assessment_session'
export const ANONYMOUS_ASSESSMENT_ANSWERS_STORAGE_KEY = 'joyjoin_v4_presignup_answers'

export interface AnonymousAssessmentTopMatch {
  archetype: string
  score: number
  confidence?: number
}

export interface AnonymousAssessmentResult {
  primaryArchetype?: string
  secondaryArchetype?: string
  traitScores?: Record<string, number>
  topMatches?: AnonymousAssessmentTopMatch[]
  totalQuestionsAnswered?: number
  archetypeConfidence?: number
  isDecisive?: boolean
}

export interface AnonymousAssessmentAnswer {
  questionId: string
  selectedOption: string
  traitScores?: Record<string, number>
  answeredAt: string
}

export interface AnonymousAssessmentSessionSnapshot {
  sessionId: string
  phase?: string
  timestamp: number
  completedAt?: string
  result?: AnonymousAssessmentResult | null
  topArchetypes?: AnonymousAssessmentTopMatch[] | null
  resultSequenceCompletedAt?: string
}

export interface AnonymousAssessmentImportGateState {
  hasAnonymousSessionId: boolean
  hasImportableAnswers: boolean
  canContinue: boolean
}

function readStorageValue<T>(key: string): T | null {
  try {
    const stored = Taro.getStorageSync(key)
    if (!stored) {
      return null
    }

    if (typeof stored === 'string') {
      return JSON.parse(stored) as T
    }

    return stored as T
  } catch {
    return null
  }
}

function writeStorageValue(key: string, value: unknown): void {
  Taro.setStorageSync(key, JSON.stringify(value))
}

export function readAnonymousAssessmentSession(): AnonymousAssessmentSessionSnapshot | null {
  return readStorageValue<AnonymousAssessmentSessionSnapshot>(ANONYMOUS_ASSESSMENT_SESSION_STORAGE_KEY)
}

export function saveAnonymousAssessmentSession(
  snapshot: AnonymousAssessmentSessionSnapshot,
): void {
  writeStorageValue(ANONYMOUS_ASSESSMENT_SESSION_STORAGE_KEY, snapshot)
}

export function readAnonymousAssessmentAnswers(): AnonymousAssessmentAnswer[] {
  const answers = readStorageValue<AnonymousAssessmentAnswer[]>(ANONYMOUS_ASSESSMENT_ANSWERS_STORAGE_KEY)
  if (!Array.isArray(answers)) {
    return []
  }

  const deduped = new Map<string, AnonymousAssessmentAnswer>()
  for (const answer of answers) {
    if (!answer || typeof answer.questionId !== 'string' || typeof answer.selectedOption !== 'string') {
      continue
    }

    deduped.set(answer.questionId, answer)
  }

  return Array.from(deduped.values())
}

export function upsertAnonymousAssessmentAnswer(answer: AnonymousAssessmentAnswer): void {
  const answers = readAnonymousAssessmentAnswers()
  const nextAnswers = answers.filter((existing) => existing.questionId !== answer.questionId)
  nextAnswers.push(answer)
  writeStorageValue(ANONYMOUS_ASSESSMENT_ANSWERS_STORAGE_KEY, nextAnswers)
}

export function clearAnonymousAssessmentStorage(): void {
  Taro.removeStorageSync(ANONYMOUS_ASSESSMENT_SESSION_STORAGE_KEY)
  Taro.removeStorageSync(ANONYMOUS_ASSESSMENT_ANSWERS_STORAGE_KEY)
}

export function getAnonymousAssessmentImportGateState(input: {
  sessionSnapshot: AnonymousAssessmentSessionSnapshot | null | undefined
  answers: readonly AnonymousAssessmentAnswer[] | null | undefined
}): AnonymousAssessmentImportGateState {
  const hasAnonymousSessionId =
    typeof input.sessionSnapshot?.sessionId === 'string' && input.sessionSnapshot.sessionId.trim() !== ''
  const hasImportableAnswers = Array.isArray(input.answers) && input.answers.length > 0

  return {
    hasAnonymousSessionId,
    hasImportableAnswers,
    canContinue: hasImportableAnswers,
  }
}

export function isAnonymousAssessmentSessionCompleted(
  snapshot: AnonymousAssessmentSessionSnapshot | null | undefined,
): boolean {
  return Boolean(
    snapshot?.sessionId && (
      snapshot.phase === 'completed' ||
      snapshot.completedAt ||
      hasAnonymousAssessmentResult(snapshot)
    ),
  )
}

export function hasAnonymousAssessmentResult(
  snapshot: AnonymousAssessmentSessionSnapshot | null | undefined,
): boolean {
  return Boolean(snapshot?.result && typeof snapshot.result.primaryArchetype === 'string')
}