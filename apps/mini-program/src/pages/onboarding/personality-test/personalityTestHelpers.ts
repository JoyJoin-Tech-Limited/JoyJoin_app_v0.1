import { apiRequest } from '../../../lib/api/api'
import type { XiaoyueExpressionId } from '../../../lib/mascot/xiaoyueExpressions'
import { logInfo, logError } from '../../../lib/utils/logger'
import type { XiaoyueSpriteState } from '../../../components/mascot/XiaoyueSpriteAnimator'
import type {
  AnonymousAssessmentResult,
  AnonymousAssessmentTopMatch,
} from '../../../lib/auth/anonymousOnboarding'
import { getNearestSliderOption } from './PersonalityTestAnswerArea'
import { PERSONALITY_TEST_QUESTION_EXPRESSION } from './visuals'
import type {
  AssessmentOption,
  AssessmentQuestion,
  AssessmentQuestionType,
} from './index'

/**
 * Map the testing-phase state to a Xiaoyue sprite state. Read by the
 * mascot avatar in the testing zone; the result is rendered via
 * `<XiaoyueSpriteAnimator state={spriteState} ... />`.
 */
export function resolveMascotState(args: {
  isLoading: boolean
  isSubmitting: boolean
  questionType: AssessmentQuestionType
  isMilestone: boolean
  isPostAnswerCommentary: boolean
  isCelebration: boolean
}): XiaoyueSpriteState {
  if (args.isCelebration) return 'celebrate'
  if (args.isPostAnswerCommentary) return 'nod'
  if (args.isLoading || args.isSubmitting) return 'listening'
  if (args.isMilestone) return 'surprised'
  if (args.questionType === 'emoji_tap') return 'curious'
  return 'idle'
}

/**
 * Fire-and-forget prefetch of the Xiaoyue AI analysis. Triggered when
 * the test completes — the slot animation's 3-5s duration gives the
 * LLM enough time to populate the cache so the result page lands
 * on a populated analysis instead of a 400ms skeleton.
 *
 * The server endpoint at /api/xiaoyue/prefetch short-circuits with
 * `{ prefetched: false, reason: 'Not ready yet' }` when `confidence < 0.7`.
 * It is safe to call speculatively; failure is logged and swallowed.
 */
export function triggerXiaoyueAnalysisPrefetch(
  result: AnonymousAssessmentResult,
  topMatches: AnonymousAssessmentTopMatch[],
): void {
  const archetype = result.primaryArchetype
  if (!archetype) return

  const traitScores = result.traitScores ?? {}
  const confidence =
    result.archetypeConfidence ??
    topMatches[0]?.confidence ??
    0

  void apiRequest<{ prefetched: boolean; reason?: string }>({
    path: '/api/xiaoyue/prefetch',
    method: 'POST',
    data: {
      archetype,
      secondaryArchetype: result.secondaryArchetype ?? null,
      topArchetypes: topMatches,
      traitScores: {
        affinity: traitScores.A ?? traitScores.affinity ?? 0.5,
        openness: traitScores.O ?? traitScores.openness ?? 0.5,
        conscientiousness: traitScores.C ?? traitScores.conscientiousness ?? 0.5,
        emotionalStability: traitScores.E ?? traitScores.emotionalStability ?? 0.5,
        extraversion: traitScores.X ?? traitScores.extraversion ?? 0.5,
        positivity: traitScores.P ?? traitScores.positivity ?? 0.5,
      },
      confidence,
    },
  })
    .then((res) => {
      logInfo('[PersonalityTest] Xiaoyue prefetch', {
        archetype,
        prefetched: res.prefetched,
        reason: res.reason,
      })
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      logError('[PersonalityTest] Xiaoyue prefetch failed', { message })
    })
}

export const INTRO_ARCHETYPE_TEASERS: { archetype: string; vibeLine: string }[] = [
  { archetype: 'corgi', vibeLine: '一进场，就把气氛带热。' },
  { archetype: 'fox', vibeLine: '普通话题，也能聊出火花。' },
  { archetype: 'koala', vibeLine: '会让人慢慢放松下来。' },
]

export const INTRO_TRUST_POINTS = [
  {
    prefix: '1.',
    title: '约 3-5 分钟完成',
    description: '轻量做完，不会把你困在一串冗长题目里。',
  },
  {
    prefix: '2.',
    title: '题目会跟着你变',
    description: '越答越准，帮你找到最像自己的氛围命格。',
  },
  {
    prefix: '3.',
    title: '未登录也能先完成',
    description: '结果会先保存在这台设备里，准备好时再继续登录。',
  },
] as const

export const PRELOAD_EXPRESSIONS: XiaoyueExpressionId[] = [
  PERSONALITY_TEST_QUESTION_EXPRESSION.choice,
  PERSONALITY_TEST_QUESTION_EXPRESSION.slider,
  PERSONALITY_TEST_QUESTION_EXPRESSION.emoji_tap,
  PERSONALITY_TEST_QUESTION_EXPRESSION.loading,
]

export function getQuestionType(question: AssessmentQuestion | null): AssessmentQuestionType {
  if (!question?.questionType) {
    return 'choice'
  }
  return question.questionType
}

export function getSliderValueFromPreviousAnswer(
  previousAnswer: string | null,
  options: AssessmentOption[],
): number {
  if (!previousAnswer) return 50
  const match = previousAnswer.match(/(\d+)/)
  const numericValue = match ? Number(match[1]) : 50
  const option = getNearestSliderOption(options, numericValue)
  return option ? numericValue : 50
}
