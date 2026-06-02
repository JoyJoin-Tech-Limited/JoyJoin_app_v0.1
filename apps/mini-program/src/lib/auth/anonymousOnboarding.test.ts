import Taro from '@tarojs/taro'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('@tarojs/taro', () => {
  const storage = new Map<string, string>()

  return {
    default: {
      getStorageSync: vi.fn((key: string) => storage.get(key)),
      setStorageSync: vi.fn((key: string, value: string) => {
        storage.set(key, value)
      }),
      removeStorageSync: vi.fn((key: string) => {
        storage.delete(key)
      }),
    },
  }
})

import {
  ANONYMOUS_ASSESSMENT_ANSWERS_STORAGE_KEY,
  ANONYMOUS_ASSESSMENT_SESSION_STORAGE_KEY,
  clearAnonymousAssessmentStorage,
  getAnonymousAssessmentImportGateState,
  readAnonymousAssessmentAnswers,
  readAnonymousAssessmentSession,
  saveAnonymousAssessmentSession,
  upsertAnonymousAssessmentAnswer,
} from './anonymousOnboarding'

const getStorageSyncMock = Taro.getStorageSync as unknown as Mock
const setStorageSyncMock = Taro.setStorageSync as unknown as Mock
const removeStorageSyncMock = Taro.removeStorageSync as unknown as Mock

describe('anonymous onboarding auth-gate and reset boundaries', () => {
  beforeEach(() => {
    clearAnonymousAssessmentStorage()
    getStorageSyncMock.mockClear()
    setStorageSyncMock.mockClear()
    removeStorageSyncMock.mockClear()
  })

  // Guards against regression: auth-gate import must stay answer-driven even
  // when the anonymous session id is absent from the stored snapshot.
  it('keeps auth-gate import answer-driven rather than sessionId-driven', () => {
    expect(
      getAnonymousAssessmentImportGateState({
        sessionSnapshot: {
          sessionId: '',
          timestamp: 1,
        },
        answers: [
          {
            questionId: 'q-1',
            selectedOption: 'a-1',
            answeredAt: '2026-04-14T00:00:00.000Z',
          },
        ],
      }),
    ).toEqual({
      hasAnonymousSessionId: false,
      hasImportableAnswers: true,
      canContinue: true,
    })

    expect(
      getAnonymousAssessmentImportGateState({
        sessionSnapshot: {
          sessionId: 'anon-session-1',
          timestamp: 1,
        },
        answers: [],
      }),
    ).toEqual({
      hasAnonymousSessionId: true,
      hasImportableAnswers: false,
      canContinue: false,
    })
  })

  it('clears both anonymous assessment storage keys for restart flows', () => {
    saveAnonymousAssessmentSession({
      sessionId: 'anon-session-1',
      timestamp: 1,
    })
    upsertAnonymousAssessmentAnswer({
      questionId: 'q-1',
      selectedOption: 'a-1',
      answeredAt: '2026-04-14T00:00:00.000Z',
    })

    expect(readAnonymousAssessmentSession()).toMatchObject({ sessionId: 'anon-session-1' })
    expect(readAnonymousAssessmentAnswers()).toHaveLength(1)

    clearAnonymousAssessmentStorage()

    expect(readAnonymousAssessmentSession()).toBeNull()
    expect(readAnonymousAssessmentAnswers()).toEqual([])
    expect(removeStorageSyncMock).toHaveBeenCalledWith(ANONYMOUS_ASSESSMENT_SESSION_STORAGE_KEY)
    expect(removeStorageSyncMock).toHaveBeenCalledWith(ANONYMOUS_ASSESSMENT_ANSWERS_STORAGE_KEY)
  })

  // Regression guard: completeAnonymousAssessment must preserve the server
  // finalResult so the results page does not need to re-fetch.
  it('preserves server finalResult in anonymous session snapshot', () => {
    const serverResult = {
      primaryArchetype: 'fox',
      secondaryArchetype: 'owl',
      traitScores: { A: 55, C: 60, E: 70, O: 45, X: 80, P: 65 },
    }

    saveAnonymousAssessmentSession({
      sessionId: 'anon-session-2',
      phase: 'completed',
      timestamp: Date.now(),
      completedAt: new Date().toISOString(),
      result: serverResult,
      topArchetypes: [{ archetype: 'fox', score: 92, confidence: 0.88 }],
    })

    const snapshot = readAnonymousAssessmentSession()
    expect(snapshot).toMatchObject({
      sessionId: 'anon-session-2',
      phase: 'completed',
      result: serverResult,
    })
    expect(snapshot?.result?.primaryArchetype).toBe('fox')
  })
})