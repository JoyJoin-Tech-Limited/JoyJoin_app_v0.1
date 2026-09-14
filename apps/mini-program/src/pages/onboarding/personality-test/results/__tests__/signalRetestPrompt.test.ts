import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import Taro from '@tarojs/taro'

import {
  getSignalRetestDismissKey,
  isSignalRetestDismissed,
  markSignalRetestDismissed,
  shouldShowSignalRetestPrompt,
  SIGNAL_RETEST_DISMISS_STORAGE_PREFIX,
} from '../hooks/useSignalRetestPrompt'

vi.mock('@tarojs/taro', () => {
  const storage = new Map<string, unknown>()
  return {
    default: {
      getStorageSync: vi.fn((key: string) => storage.get(key)),
      setStorageSync: vi.fn((key: string, value: unknown) => {
        storage.set(key, value)
      }),
      removeStorageSync: vi.fn((key: string) => {
        storage.delete(key)
      }),
    },
  }
})

const getStorageSyncMock = Taro.getStorageSync as unknown as Mock
const setStorageSyncMock = Taro.setStorageSync as unknown as Mock

// Logic coverage lives on the pure helpers; the source contracts below lock
// the wiring (page → hook → FinalStage) and the restart URL the CTA lands on.
const pageSource = readFileSync(resolve(__dirname, '../index.tsx'), 'utf8')
const finalStageSource = readFileSync(resolve(__dirname, '../FinalStage.tsx'), 'utf8')
const revealHookSource = readFileSync(resolve(__dirname, '../hooks/useResultsRevealSequence.ts'), 'utf8')
const promptSource = readFileSync(resolve(__dirname, '../SignalRetestPrompt.tsx'), 'utf8')
const anonymousOnboardingSource = readFileSync(
  resolve(__dirname, '../../../../../lib/auth/anonymousOnboarding.ts'),
  'utf8',
)

describe('P5a signal-quality retest prompt — visibility rule', () => {
  it('shows only when quality is low with a session and no dismissal', () => {
    expect(shouldShowSignalRetestPrompt({ quality: 'low', sessionId: 'sess-1', dismissed: false })).toBe(true)
  })

  it('stays hidden when quality is ok', () => {
    expect(shouldShowSignalRetestPrompt({ quality: 'ok', sessionId: 'sess-1', dismissed: false })).toBe(false)
  })

  it('stays hidden when the verdict is absent (legacy snapshot / degraded compute)', () => {
    expect(shouldShowSignalRetestPrompt({ quality: undefined, sessionId: 'sess-1', dismissed: false })).toBe(false)
    expect(shouldShowSignalRetestPrompt({ quality: null, sessionId: 'sess-1', dismissed: false })).toBe(false)
  })

  it('stays hidden without a session id or after dismissal', () => {
    expect(shouldShowSignalRetestPrompt({ quality: 'low', sessionId: null, dismissed: false })).toBe(false)
    expect(shouldShowSignalRetestPrompt({ quality: 'low', sessionId: '', dismissed: false })).toBe(false)
    expect(shouldShowSignalRetestPrompt({ quality: 'low', sessionId: 'sess-1', dismissed: true })).toBe(false)
  })
})

describe('P5a signal-quality retest prompt — suppression persistence', () => {
  beforeEach(() => {
    // The mocked storage Map persists across tests in this file — clear the
    // keys the round-trip test writes so ordering never matters.
    Taro.removeStorageSync(getSignalRetestDismissKey('sess-1'))
    Taro.removeStorageSync(getSignalRetestDismissKey('sess-2'))
    getStorageSyncMock.mockClear()
    setStorageSyncMock.mockClear()
  })

  it('keys suppression by sessionId', () => {
    expect(getSignalRetestDismissKey('sess-1')).toBe(`${SIGNAL_RETEST_DISMISS_STORAGE_PREFIX}:sess-1`)
    expect(getSignalRetestDismissKey('sess-1')).toBe('joyjoin_signal_retest_dismissed:sess-1')
  })

  it('round-trips dismissal through Taro storage', () => {
    expect(isSignalRetestDismissed('sess-1')).toBe(false)
    markSignalRetestDismissed('sess-1')
    expect(isSignalRetestDismissed('sess-1')).toBe(true)
    // A different session (e.g. after a retake) is unaffected.
    expect(isSignalRetestDismissed('sess-2')).toBe(false)
  })

  it('fails open (prompt visible) when storage is unavailable', () => {
    getStorageSyncMock.mockImplementationOnce(() => {
      throw new Error('storage unavailable')
    })
    expect(isSignalRetestDismissed('sess-1')).toBe(false)
  })
})

describe('P5a signal-quality retest prompt — wiring contracts', () => {
  it('carries signalQuality on the anonymous snapshot result type', () => {
    expect(anonymousOnboardingSource).toContain('signalQuality?: SignalQualityVerdict')
  })

  it('pages the prompt through FinalStage as a gated optional prop', () => {
    expect(finalStageSource).toContain('signalRetestPrompt?: {')
    expect(finalStageSource).toContain('signalRetestPrompt?.visible')
    expect(finalStageSource).toContain('<SignalRetestPrompt')
  })

  it('wires the page hook to the reveal hook restart handler', () => {
    expect(pageSource).toContain('useSignalRetestPrompt({')
    expect(pageSource).toContain('onRestart: handleRestart')
  })

  it('lands the retest CTA on the restart-mode test URL', () => {
    // The prompt's CTA delegates to handleRestart, which owns this URL.
    expect(revealHookSource).toContain('${MINI_PROGRAM_ROUTES.personalityTest}?mode=restart')
  })

  it('renders the PM-approved copy and never leaks machine-only reasons', () => {
    expect(promptSource).toContain('悦仔有点拿不准你的风格，要不要再聊一轮？')
    expect(promptSource).toContain('重新测一次')
    expect(promptSource).not.toContain('reasons')
    expect(promptSource).not.toContain('score')
  })
})
