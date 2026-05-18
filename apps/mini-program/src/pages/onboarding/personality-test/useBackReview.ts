import { useCallback, useState } from 'react'
import type { AssessmentQuestion } from './index'

export interface BackReviewState {
  isBackReviewMode: boolean
  backReviewQuestion: AssessmentQuestion | null
  backReviewPreviousAnswer: string | null
  backReviewSelectedOption: string | null
}

export interface BackReviewActions {
  enterBackReview: (question: AssessmentQuestion, previousAnswer: string) => void
  selectOption: (optionValue: string) => void
  cancelBackReview: () => void
  getConfirmPayload: () => {
    changed: boolean
    question: AssessmentQuestion | null
    selectedOption: string | null
    previousAnswer: string | null
  }
  exitBackReview: () => void
}

/**
 * Encapsulates back-review state for the personality test one-step back flow.
 * Back-review state is NOT persisted across sessions (AC-15).
 */
export function useBackReview(): BackReviewState & BackReviewActions {
  const [isBackReviewMode, setIsBackReviewMode] = useState(false)
  const [backReviewQuestion, setBackReviewQuestion] = useState<AssessmentQuestion | null>(null)
  const [backReviewPreviousAnswer, setBackReviewPreviousAnswer] = useState<string | null>(null)
  const [backReviewSelectedOption, setBackReviewSelectedOption] = useState<string | null>(null)

  const enterBackReview = useCallback((question: AssessmentQuestion, previousAnswer: string) => {
    setBackReviewQuestion(question)
    setBackReviewPreviousAnswer(previousAnswer)
    setBackReviewSelectedOption(previousAnswer)
    setIsBackReviewMode(true)
  }, [])

  const selectOption = useCallback((optionValue: string) => {
    setBackReviewSelectedOption(optionValue)
  }, [])

  const cancelBackReview = useCallback(() => {
    setIsBackReviewMode(false)
    setBackReviewQuestion(null)
    setBackReviewPreviousAnswer(null)
    setBackReviewSelectedOption(null)
  }, [])

  const getConfirmPayload = useCallback(() => ({
    changed: backReviewSelectedOption !== backReviewPreviousAnswer,
    question: backReviewQuestion,
    selectedOption: backReviewSelectedOption,
    previousAnswer: backReviewPreviousAnswer,
  }), [backReviewQuestion, backReviewPreviousAnswer, backReviewSelectedOption])

  const exitBackReview = useCallback(() => {
    setIsBackReviewMode(false)
    setBackReviewQuestion(null)
    setBackReviewPreviousAnswer(null)
    setBackReviewSelectedOption(null)
  }, [])

  return {
    isBackReviewMode,
    backReviewQuestion,
    backReviewPreviousAnswer,
    backReviewSelectedOption,
    enterBackReview,
    selectOption,
    cancelBackReview,
    getConfirmPayload,
    exitBackReview,
  }
}
