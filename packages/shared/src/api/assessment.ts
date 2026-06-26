import type { ApiTransport } from './core.js'

export interface AssessmentQuestion {
  id: string
  text: string
  options: { id: string; text: string; traitScores?: Record<string, number>; commentary?: string }[]
  traitKey?: string
  phaseLabel?: string
}

export interface AssessmentStartResponse {
  sessionId: string
  question: AssessmentQuestion
  totalQuestions: number
  currentQuestionIndex: number
  phase?: string
}

export interface AssessmentAnswerResponse {
  question?: AssessmentQuestion | null
  totalQuestions: number
  currentQuestionIndex: number
  isComplete: boolean
  phase?: string
  /** Xiaoyue commentary for the selected option, shown in the mascot speech bubble */
  commentary?: string
}

export interface AssessmentResultResponse {
  archetype?: string
  archetypeLabel?: string
  confidence?: number
  traitScores?: Record<string, number>
  summary?: string
  [key: string]: unknown
}

export function startAssessment(
  api: ApiTransport,
  data?: { preSignupAnswers?: Record<string, string> }
): Promise<AssessmentStartResponse> {
  return api<AssessmentStartResponse>({
    path: '/api/assessment/v4/start',
    method: 'POST',
    data: data ?? {},
  })
}

export function submitAssessmentAnswer(
  api: ApiTransport,
  sessionId: string,
  data: { questionId: string; optionId: string }
): Promise<AssessmentAnswerResponse> {
  return api<AssessmentAnswerResponse>({
    path: `/api/assessment/v4/${encodeURIComponent(sessionId)}/answer`,
    method: 'POST',
    data,
  })
}

export function skipAssessmentQuestion(
  api: ApiTransport,
  sessionId: string,
  data: { questionId: string }
): Promise<AssessmentAnswerResponse> {
  return api<AssessmentAnswerResponse>({
    path: `/api/assessment/v4/${encodeURIComponent(sessionId)}/skip`,
    method: 'POST',
    data,
  })
}

export function getAssessmentResult(
  api: ApiTransport,
  sessionId: string
): Promise<AssessmentResultResponse> {
  return api<AssessmentResultResponse>({
    path: `/api/assessment/v4/${encodeURIComponent(sessionId)}/result`,
  })
}
