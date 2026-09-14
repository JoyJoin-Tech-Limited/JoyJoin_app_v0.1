import { z } from 'zod'
import type { ApiTransport } from './core.js'
import type { SignalQualityVerdict } from '../personality/responseSignalQuality.js'

/**
 * Assessment V4 request-shape contracts (server-enforced, fail-closed).
 *
 * Shared so the server validates `req.body` / `req.params` against the exact
 * shape the clients send. These schemas intentionally DO NOT use `.strict()`:
 * unknown extra keys are stripped, not rejected, so any legacy caller that
 * sends extra metadata keeps working unchanged. Only missing/mistyped required
 * fields fail validation — the server answers 400 + a machine-readable code.
 */
const assessmentV4PreSignupAnswerSchema = z.object({
  questionId: z.string().min(1),
  selectedOption: z.string().min(1),
})

/** POST /api/assessment/v4/start request body. */
export const assessmentV4StartBodySchema = z.object({
  /** Resume an anonymous (pre-signup) session by id. */
  sessionId: z.string().min(1).optional(),
  /** Explicit restart request. */
  forceNew: z.boolean().optional(),
  /** Answers captured before login; replayed into a fresh session. */
  preSignupAnswers: z.array(assessmentV4PreSignupAnswerSchema).optional(),
})

/** POST|PUT /api/assessment/v4/:sessionId/answer request body. */
export const assessmentV4AnswerBodySchema = z.object({
  questionId: z.string().min(1),
  selectedOption: z.string().min(1),
})

/** POST /api/assessment/v4/:sessionId/skip request body. */
export const assessmentV4SkipBodySchema = z.object({
  questionId: z.string().min(1),
})

/** POST /api/assessment/v4/presignup-sync request body. */
export const assessmentV4PreSignupSyncBodySchema = z.object({
  preSignupAnswers: z.array(assessmentV4PreSignupAnswerSchema).min(1),
})

/** Path params for every /api/assessment/v4/:sessionId/* route. */
export const assessmentV4SessionParamsSchema = z.object({
  sessionId: z.string().min(1),
})

export type AssessmentV4StartBody = z.infer<typeof assessmentV4StartBodySchema>
export type AssessmentV4AnswerBody = z.infer<typeof assessmentV4AnswerBodySchema>
export type AssessmentV4SkipBody = z.infer<typeof assessmentV4SkipBodySchema>
export type AssessmentV4PreSignupSyncBody = z.infer<typeof assessmentV4PreSignupSyncBodySchema>
export type AssessmentV4SessionParams = z.infer<typeof assessmentV4SessionParamsSchema>

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

/**
 * V4 final-result object as carried on `result` in
 * `POST/PUT /api/assessment/v4/:sessionId/answer` (isComplete:true) and
 * `GET /api/assessment/v4/:sessionId/result`.
 *
 * P5a signal-quality gate: `signalQuality` is an advisory verdict computed
 * from the session's answer pattern. `quality === 'low'` → the client may
 * show the approved retest prompt (「悦仔有点拿不准你的风格，要不要再聊一轮？」)
 * as a once-per-result, secondary, never-blocking CTA. Absent (pre-P5a
 * persisted sessions, or a degraded compute) → treat as 'ok' and render
 * nothing.
 */
export interface AssessmentV4FinalResult {
  primaryArchetype: string
  secondaryArchetype?: string
  traitScores?: Record<string, number>
  confidences?: Record<string, number>
  validityScore?: number
  algorithmVersion?: string
  signalQuality?: SignalQualityVerdict
  [key: string]: unknown
}

export interface AssessmentV4ResultResponse {
  sessionId: string
  completedAt?: string | Date | null
  result?: AssessmentV4FinalResult
  traitConfidences?: unknown
  topArchetypes?: unknown
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
