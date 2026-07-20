import { useCallback, useState } from 'react'
import type { AssessmentQuestion } from './types'

export interface BackReviewState {
  isBackReviewMode: boolean
  backReviewQuestion: AssessmentQuestion | null
  backReviewPreviousAnswer: string | null
  backReviewSelectedOption: string | null
  backReviewHistoryIndex: number
}

export interface BackReviewActions {
  enterBackReview: (question: AssessmentQuestion, previousAnswer: string, historyIndex?: number) => void
  selectOption: (optionValue: string) => void
  cancelBackReview: () => void
  getConfirmPayload: () => {
    changed: boolean
    question: AssessmentQuestion | null
    selectedOption: string | null
    previousAnswer: string | null
  }
  exitBackReview: () => void
  setHistoryIndex: (index: number) => void
}

/**
 * Encapsulates back-review state for the personality test multi-step back flow.
 * Back-review state is NOT persisted across sessions (AC-15).
 */
export function useBackReview(): BackReviewState & BackReviewActions {
  const [isBackReviewMode, setIsBackReviewMode] = useState(false)
  const [backReviewQuestion, setBackReviewQuestion] = useState<AssessmentQuestion | null>(null)
  const [backReviewPreviousAnswer, setBackReviewPreviousAnswer] = useState<string | null>(null)
  const [backReviewSelectedOption, setBackReviewSelectedOption] = useState<string | null>(null)
  const [backReviewHistoryIndex, setBackReviewHistoryIndex] = useState<number>(-1)

  const resetBackReviewState = useCallback(() => {
    setIsBackReviewMode(false)
    setBackReviewQuestion(null)
    setBackReviewPreviousAnswer(null)
    setBackReviewSelectedOption(null)
    setBackReviewHistoryIndex(-1)
  }, [])

  const enterBackReview = useCallback((question: AssessmentQuestion, previousAnswer: string, historyIndex?: number) => {
    setBackReviewQuestion(question)
    setBackReviewPreviousAnswer(previousAnswer)
    setBackReviewSelectedOption(previousAnswer)
    setBackReviewHistoryIndex(historyIndex ?? -1)
    setIsBackReviewMode(true)
  }, [])

  const selectOption = useCallback((optionValue: string) => {
    setBackReviewSelectedOption(optionValue)
  }, [])

  const cancelBackReview = resetBackReviewState

  const getConfirmPayload = () => ({
    changed: backReviewSelectedOption !== backReviewPreviousAnswer,
    question: backReviewQuestion,
    selectedOption: backReviewSelectedOption,
    previousAnswer: backReviewPreviousAnswer,
  })

  const exitBackReview = resetBackReviewState

  const setHistoryIndex = useCallback((index: number) => {
    setBackReviewHistoryIndex(index)
  }, [])

  return {
    isBackReviewMode,
    backReviewQuestion,
    backReviewPreviousAnswer,
    backReviewSelectedOption,
    backReviewHistoryIndex,
    enterBackReview,
    selectOption,
    cancelBackReview,
    getConfirmPayload,
    exitBackReview,
    setHistoryIndex,
  }
}
