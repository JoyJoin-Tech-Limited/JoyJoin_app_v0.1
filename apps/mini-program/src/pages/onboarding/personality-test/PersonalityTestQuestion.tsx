import { useMemo } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Button from '../../../components/ui/Button'
import SegmentedProgress from '../../../components/ui/SegmentedProgress'
import TypewriterText from '../../../components/ui/TypewriterText'
import XiaoyueSpriteAnimator, { type XiaoyueSpriteState } from '../../../components/mascot/XiaoyueSpriteAnimator'
import MascotQuestionHeader from './MascotQuestionHeader'
import PersonalityTestAnswerArea, { getNearestSliderOption } from './PersonalityTestAnswerArea'
import QuestionTransition from './QuestionTransition'
import { HalfwayMilestone } from './HalfwayMilestone'
import { isMilestoneQuestion } from './personalityTestLogic'
import { ONBOARDING_MASCOT_SIZE } from '../../../lib/onboarding/onboardingRoutes'
import { getXiaoyueExpressionAsset, PERSONALITY_TEST_QUESTION_EXPRESSION } from './visuals'
import type {
  Phase,
  AssessmentQuestion,
  AssessmentOption,
  AssessmentQuestionType,
  AssessmentProgress,
  AssessmentMatch,
} from './types'

function getQuestionType(question: AssessmentQuestion | null): AssessmentQuestionType {
  if (!question?.questionType) {
    return 'choice'
  }
  return question.questionType
}

function resolveMascotState(args: {
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

function getSliderValueFromPreviousAnswer(previousAnswer: string | null, options: AssessmentOption[]): number {
  if (!previousAnswer) return 50
  const match = previousAnswer.match(/(\d+)/)
  const numericValue = match ? Number(match[1]) : 50
  const option = getNearestSliderOption(options, numericValue)
  return option ? numericValue : 50
}

interface PersonalityTestQuestionProps {
  isPageExiting: boolean
  isDegradation: boolean
  phase: Phase
  question: AssessmentQuestion | null
  progress: AssessmentProgress | null
  estimatedTotal: number
  progressPercent: number
  currentMatches: AssessmentMatch[]
  sliderValue: number
  isSubmitting: boolean
  isSkipping: boolean
  skipsRemaining: number
  error: string
  spriteState: XiaoyueSpriteState
  mascotAutoPlay: boolean
  postAnswerCommentary: string | null
  shouldShowEcho: boolean
  isEchoExiting: boolean
  echoEnabled: boolean
  currentSelection: AssessmentOption | null
  canGoNext: boolean
  canGoPrevious: boolean
  lastAttemptedOptionRef: React.MutableRefObject<AssessmentOption | null>
  onAnswer: (option: AssessmentOption) => void
  onSliderChange: (value: number) => void
  onSliderSubmit: () => void
  onNext: () => void
  onPrevious: () => void
  onSkip: () => void
  onRetry: () => void
  onMilestoneReached: (info: { answered: number; estimatedTotal: number }) => void
}

export default function PersonalityTestQuestion({
  isPageExiting,
  isDegradation,
  phase,
  question,
  progress,
  estimatedTotal,
  progressPercent,
  sliderValue,
  isSubmitting,
  isSkipping,
  skipsRemaining,
  error,
  spriteState,
  mascotAutoPlay,
  postAnswerCommentary,
  shouldShowEcho,
  isEchoExiting,
  echoEnabled,
  currentSelection,
  canGoNext,
  canGoPrevious,
  lastAttemptedOptionRef,
  onAnswer,
  onSliderChange,
  onSliderSubmit,
  onNext,
  onPrevious,
  onSkip,
  onRetry,
  onMilestoneReached,
}: PersonalityTestQuestionProps) {
  const currentQuestion = question
  const questionType = getQuestionType(currentQuestion)

  const questionStub = useMemo(
    () => ({ scenarioText: question?.scenarioText, questionText: question?.questionText ?? '' }),
    [question?.scenarioText, question?.questionText],
  )

  const pageClassName = [
    'personality-test',
    'personality-test--mascot-layout',
    isPageExiting ? 'personality-test--exiting' : '',
    isDegradation ? 'personality-test--low-end' : '',
  ]
    .filter(Boolean)
    .join(' ')

  // Xiaoyue speech bubble text. Commentary is set immediately from pre-attached
  // per-option data so the user sees tailored feedback without a network round-trip.
  const speechText = postAnswerCommentary
    ? postAnswerCommentary
    : progress && progress.answered === 4
      ? '已经一半了！你的命格轮廓越来越清晰，继续凭直觉选。'
      : progress && progress.answered === 8
        ? '太棒了！进入精准阶段，接下来的题目会更聚焦，帮你锁定最像自己的氛围命格。'
        : question?.questionText ?? ''

  const isLoadingSpeech = isSubmitting && !postAnswerCommentary
  const isNavLocked = isSubmitting || isSkipping

  // Forces a remount (and typing restart) whenever the speech source changes,
  // even if two consecutive questions happen to have identical text.
  const speechKey = postAnswerCommentary
    ? `commentary-${progress?.answered ?? 0}`
    : `question-${question?.id ?? 'none'}-${progress?.answered ?? 0}`

  return (
    <View className={pageClassName}>
      {/* Zone A: Segmented progress bar */}
      <View className='personality-test__progress-bar-shell'>
        <SegmentedProgress
          progress={progressPercent}
          totalSegments={10}
          variant='duolingo'
        />
      </View>
      <View className='personality-test__progress-meta-row'>
        <View className='personality-test__progress-label'>
          <Text className='personality-test__progress-text'>
            已答 {progress?.answered ?? 0} 题 · 还剩约 {progress?.estimatedRemaining ?? 0} 题
          </Text>
        </View>
      </View>

      {/* D3 — Quiz halfway cheer badge (Batch D) — appears at >=50% progress */}
      <HalfwayMilestone
        progressPercent={progressPercent}
        phase={phase}
        answered={progress?.answered ?? 0}
        estimatedTotal={estimatedTotal}
        onMilestoneReached={onMilestoneReached}
      />

      {/* Zone B: Full-width glassmium question banner */}
      <View className='personality-test__question-zone'>
        {currentQuestion ? (
          <QuestionTransition questionId={currentQuestion.id}>
            <MascotQuestionHeader
              question={questionStub}
              isLoading={isSubmitting}
            />
          </QuestionTransition>
        ) : null}
      </View>

      {/* Zone C: Mascot + speech bubble row */}
      <View className='personality-test__mascot-zone'>
        {currentQuestion ? (
          (() => {
            const isMilestoneNow = progress ? isMilestoneQuestion(progress.answered) : false
            const resolvedMascotState = resolveMascotState({
              isLoading: isSubmitting,
              isSubmitting,
              questionType,
              isMilestone: isMilestoneNow && !!postAnswerCommentary,
              isPostAnswerCommentary: !!postAnswerCommentary,
              isCelebration: false,
            })
            return (
              <View className='personality-test__mascot-row'>
                <View className='personality-test__mascot-avatar'>
                  <XiaoyueSpriteAnimator
                    state={resolvedMascotState}
                    size={ONBOARDING_MASCOT_SIZE}
                    isLoading={isSubmitting}
                    showGlow={false}
                    autoPlay={mascotAutoPlay || resolvedMascotState !== 'idle'}
                    transitionMs={0}
                    className='personality-test__mascot-animator'
                    // Freeze the mascot on passive question states so the user never
                    // sees an eyes-closed/blink frame. Let reaction states animate.
                    staticFrame={resolvedMascotState === 'idle' || resolvedMascotState === 'curious' ? 0 : undefined}
                  />
                </View>
                <View
                  className={`personality-test__speech-bubble${progress && (progress.answered === 4 || progress.answered === 8) ? ' personality-test__speech-bubble--milestone' : ''}`}
                >
                  {isLoadingSpeech ? (
                    <Text className='personality-test__speech-bubble-text'>{speechText}</Text>
                  ) : (
                    <TypewriterText
                      key={speechKey}
                      className='personality-test__speech-bubble-text'
                      text={speechText}
                      speed={40}
                      delay={120}
                      showCursor
                      numberOfLines={3}
                    />
                  )}
                </View>
              </View>
            )
          })()
        ) : null}
      </View>

      {/* Zone D: Answers — explicit ScrollView scroll port inside the locked page shell */}
      <ScrollView className='personality-test__answer-zone' scrollY enhanced showScrollbar={false}>
        {currentQuestion ? (
          <QuestionTransition questionId={currentQuestion.id}>
            <PersonalityTestAnswerArea
              questionType={questionType}
              options={currentQuestion.options}
              sliderConfig={currentQuestion.sliderConfig}
              sliderValue={sliderValue}
              isSubmitting={isSubmitting}
              onAnswer={onAnswer}
              onSliderChange={onSliderChange}
              onSliderSubmit={onSliderSubmit}
              committedValue={currentSelection?.value ?? null}
              hideSliderSubmit={true}
              onOptionTouchStart={undefined}
              onOptionTouchEnd={undefined}
              onOptionTouchMove={undefined}
            />
          </QuestionTransition>
        ) : null}

        {/* Echo overlay — renders on top of answer area during submission */}
        {(shouldShowEcho || isEchoExiting) && echoEnabled && (
          <View
            className={`personality-test__answer-echo-overlay${isEchoExiting ? ' personality-test__answer-echo-overlay--exiting' : ''}`}
            aria-live='polite'
            role='status'
            aria-label={`已选择：${lastAttemptedOptionRef.current?.text ?? ''}，正在提交`}
          >
            <View className='personality-test__answer-echo-card'>
              <Text className='personality-test__answer-echo-text' numberOfLines={2}>
                {lastAttemptedOptionRef.current?.text ?? '处理中…'}
              </Text>
            </View>
            <View className='personality-test__answer-echo-whisper'>
              <View className='personality-test__answer-echo-whisper-line' />
            </View>
            <View className='personality-test__answer-echo-brand-row'>
              <Image
                className='personality-test__answer-echo-mascot-icon'
                src={getXiaoyueExpressionAsset(PERSONALITY_TEST_QUESTION_EXPRESSION.loading)}
                mode='aspectFit'
                aria-hidden='true'
              />
              <Text className='personality-test__answer-echo-caption'>
                悦仔收到了，正在分析…
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Navigation row: 上一题 / 下一题 */}
      <View className='personality-test__nav-row'>
        <Button
          variant='secondary'
          className={[
            'personality-test__nav-btn',
            'personality-test__nav-btn--prev',
            !canGoPrevious || isNavLocked ? 'personality-test__nav-btn--disabled' : '',
          ].filter(Boolean).join(' ')}
          onClick={() => {
            if (isNavLocked || !canGoPrevious) return
            onPrevious()
          }}
          disabled={isNavLocked || !canGoPrevious}
          hoverClass='personality-test__nav-btn--active'
        >
          上一题
        </Button>
        <Button
          variant='brand'
          className={[
            'personality-test__nav-btn',
            'personality-test__nav-btn--next',
            !canGoNext || isNavLocked ? 'personality-test__nav-btn--disabled' : '',
          ].filter(Boolean).join(' ')}
          onClick={() => {
            if (isNavLocked || !canGoNext) return
            onNext()
          }}
          disabled={isNavLocked || !canGoNext}
          loading={isSubmitting}
          hoverClass='personality-test__nav-btn--active'
        >
          {isSubmitting ? '提交中…' : '下一题'}
        </Button>
      </View>

      {/* Skip button */}
      <View className='personality-test__skip-row'>
        {skipsRemaining > 0 ? (
          <View
            className='personality-test__skip-btn personality-test__skip-btn--enter'
            hoverClass='personality-test__skip-btn--active'
            hoverStartTime={0}
            hoverStayTime={100}
            onClick={() => {
              if (isSubmitting || isSkipping) return
              onSkip()
            }}
            style={{ opacity: isSubmitting || isSkipping ? 0.4 : 1 }}
          >
            {isSkipping ? (
              <View className='personality-test__skip-btn-dots'>
                <View className='personality-test__skip-btn-dot personality-test__skip-btn-dot--1' />
                <View className='personality-test__skip-btn-dot personality-test__skip-btn-dot--2' />
                <View className='personality-test__skip-btn-dot personality-test__skip-btn-dot--3' />
              </View>
            ) : (
              <>
                <Text className='personality-test__skip-btn-icon'>↻</Text>
                <Text className='personality-test__skip-btn-text'>换一题</Text>
                <Text className='personality-test__skip-btn-count'>还剩 {skipsRemaining} 次</Text>
              </>
            )}
          </View>
        ) : (
          <View className='personality-test__skip-hint personality-test__skip-hint--enter'>
            <Text className='personality-test__skip-hint-text'>这些题目都是为你挑选的，试试看～</Text>
            <Text className='personality-test__skip-hint-subtext'>直觉很准，一题都没跳。</Text>
          </View>
        )}
      </View>

      {error ? (
        <View className='personality-test__error-row'>
          <Text className='personality-test__error'>{error}</Text>
          {lastAttemptedOptionRef.current ? (
            <Button
              variant='secondary'
              className='personality-test__retry-btn'
              onClick={onRetry}
              disabled={isSubmitting}
            >
              重试
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
