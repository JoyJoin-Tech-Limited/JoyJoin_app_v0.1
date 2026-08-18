import { useMemo } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Button from '../../../components/ui/Button'
import SegmentedProgress from '../../../components/ui/SegmentedProgress'
import TypewriterText from '../../../components/ui/TypewriterText'
import MascotQuestionHeader from './MascotQuestionHeader'
import PersonalityTestAnswerArea from './PersonalityTestAnswerArea'
import QuestionTransition from './QuestionTransition'
import { HalfwayMilestone } from './HalfwayMilestone'
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

/** Keep the original compact corgi pose stable across every question. */
export function getQuestionMascotPose(_questionId: string): typeof PERSONALITY_TEST_QUESTION_EXPRESSION.choice {
  return PERSONALITY_TEST_QUESTION_EXPRESSION.choice
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
  /** True once the user has dragged the slider on the current question. */
  sliderTouched: boolean
  isSubmitting: boolean
  isSkipping: boolean
  skipsRemaining: number
  error: string
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
  /**
   * Analytics-only: fires when the user taps 下一题 while the slider gate is
   * blocking (slider question, not yet touched). The disabled native Button
   * swallows its own tap, so the page wraps the button and observes the
   * bubbled tap instead.
   */
  onSliderAdvanceBlocked?: () => void
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
  sliderTouched,
  isSubmitting,
  isSkipping,
  skipsRemaining,
  error,
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
  onSliderAdvanceBlocked,
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

  // Xiaoyue speech bubble carries ONLY the per-option reaction commentary
  // (set instantly from pre-attached option data, or late from the server).
  // The question itself already renders in the banner above — typewriting it
  // here again duplicated the text and stacked extra latency on every question.
  const speechText = postAnswerCommentary ?? ''

  const isNavLocked = isSubmitting || isSkipping

  // Forces a remount (and typing restart) whenever the commentary changes.
  const speechKey = `commentary-${progress?.answered ?? 0}`

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

        {/* D3 — Quiz halfway cheer badge (Batch D) — appears at >=50% progress.
            Absolutely positioned under this row (see HalfwayMilestone.scss) so
            the transient card never shifts the quiz layout. */}
        <HalfwayMilestone
          progressPercent={progressPercent}
          phase={phase}
          answered={progress?.answered ?? 0}
          estimatedTotal={estimatedTotal}
          onMilestoneReached={onMilestoneReached}
        />
      </View>

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
            const pose = getQuestionMascotPose(currentQuestion.id)
            return (
              <View className='personality-test__mascot-row'>
                <View className='personality-test__mascot-avatar'>
                  <Image
                    src={getXiaoyueExpressionAsset(pose)}
                    mode='aspectFit'
                    className='personality-test__mascot-animator'
                    aria-hidden='true'
                  />
                </View>
                {speechText ? (
                  <View className='personality-test__speech-bubble'>
                    <TypewriterText
                      key={speechKey}
                      className='personality-test__speech-bubble-text'
                      text={speechText}
                      speed={40}
                      delay={120}
                      showCursor
                      numberOfLines={3}
                    />
                  </View>
                ) : null}
              </View>
            )
          })()
        ) : null}
      </View>

      {/* Zone D: Answers — explicit ScrollView scroll port inside the locked page shell.
          No QuestionTransition wrapper here: the option buttons carry their own
          staggered enter animation (keyed by option value), so wrapping the whole
          area in a second 360ms enter produced a nested double animation. */}
      <ScrollView className='personality-test__answer-zone' scrollY enhanced showScrollbar={false}>
        {currentQuestion ? (
          <PersonalityTestAnswerArea
            questionType={questionType}
            options={currentQuestion.options}
            sliderConfig={currentQuestion.sliderConfig}
            sliderValue={sliderValue}
            sliderTouched={sliderTouched}
            isSubmitting={isSubmitting}
            onAnswer={onAnswer}
            onSliderChange={onSliderChange}
            onSliderSubmit={onSliderSubmit}
            committedValue={currentSelection?.value ?? null}
            hideSliderSubmit={true}
          />
        ) : null}

        {/* Echo overlay — covers the answer zone during submission, but only
            when there is no instant per-option commentary (the bubble already
            delivers that feedback; showing both duplicated the beat). */}
        {(shouldShowEcho || isEchoExiting) && echoEnabled && !postAnswerCommentary && (
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
        {/* Wrapper observes taps that the disabled next Button swallows
            (slider-gated advance) — analytics only, no visual role. The flex
            styling mirrors the button's own flex-item rules so the layout is
            unchanged. */}
        <View
          className='personality-test__nav-next-wrap'
          onClick={() => {
            if (isNavLocked || canGoNext) return
            if (questionType === 'slider' && !sliderTouched) {
              onSliderAdvanceBlocked?.()
            }
          }}
        >
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
      </View>

      {/* Skip button */}
      <View className='personality-test__skip-row'>
        {skipsRemaining > 0 ? (
          <View
            className={`personality-test__skip-btn personality-test__skip-btn--enter${isSubmitting || isSkipping ? ' personality-test__skip-btn--busy' : ''}`}
            hoverClass='personality-test__skip-btn--active'
            hoverStartTime={0}
            hoverStayTime={100}
            onClick={() => {
              if (isSubmitting || isSkipping) return
              onSkip()
            }}
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
            <Text className='personality-test__skip-hint-subtext'>换题次数用完啦，凭直觉选也很准。</Text>
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
