import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useUgcReport,
  UGC_REPORT_ACTION_LABEL,
  UGC_REPORT_FAILURE_TOAST,
  UGC_REPORT_MODAL_PLACEHOLDER,
  UGC_REPORT_MODAL_TITLE,
  UGC_REPORT_SUCCESS_TOAST,
} from '../hooks/useUgcReport'
import { apiRequest } from '../../../lib/api/api'
import { socialIcebreakerAnalytics } from '../../../lib/analytics/socialIcebreakerAnalytics'
import { haptics } from '../../../lib/utils/haptics'

/**
 * E9 UGC 举报闭环 (sprint e9-ugc-report, contract AC-07/REL-01/OBS-01) —
 * the long-press → ActionSheet → confirm-modal → POST → warm-toast flow.
 * Locks: single-entry sheet copy, optional note (trimmed + capped, absent
 * when empty), in-flight single-flight guard, success/failure toast pair,
 * and the analytics payload carrying {phase, kind} only (never the reported
 * text — the server snapshots evidence itself).
 */

const h = vi.hoisted(() => ({
  spies: {
    showToast: vi.fn(() => Promise.resolve({})),
    showModal: vi.fn(),
    showActionSheet: vi.fn(),
  },
}))

vi.mock('@tarojs/taro', () => {
  const taro = {
    showToast: h.spies.showToast,
    showModal: h.spies.showModal,
    showActionSheet: h.spies.showActionSheet,
  }
  return { default: taro, ...taro }
})

vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))
vi.mock('../../../lib/api/api', () => ({ apiRequest: vi.fn() }))
vi.mock('../../../lib/analytics/socialIcebreakerAnalytics', () => ({
  socialIcebreakerAnalytics: { track: vi.fn() },
}))
vi.mock('../../../lib/utils/logger', () => ({
  logWarn: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}))

const mockedApiRequest = vi.mocked(apiRequest)
const mockedTrack = vi.mocked(socialIcebreakerAnalytics.track)

const TARGET = {
  phase: 'quip_battle' as const,
  targetUserId: 'u-target',
  contentRef: { kind: 'quipAnswer' as const, promptId: 'p1' },
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useUgcReport — E9 UGC 举报闭环', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.spies.showActionSheet.mockResolvedValue({ tapIndex: 0 })
    h.spies.showModal.mockResolvedValue({ confirm: true, cancel: false, content: '' })
    mockedApiRequest.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('happy path: sheet → confirm → POST locator body → warm toast → {phase, kind} analytics', async () => {
    h.spies.showModal.mockResolvedValue({ confirm: true, cancel: false, content: '  这句有点过分  ' })
    const { result } = renderHook(() => useUgcReport({ socialSessionId: 'social-1' }))

    await act(async () => {
      await result.current.presentReport(TARGET)
    })

    expect(haptics).toHaveBeenCalledWith('light')
    expect(h.spies.showActionSheet).toHaveBeenCalledWith({ itemList: [UGC_REPORT_ACTION_LABEL] })
    // Confirm modal: restrained copy + optional one-line note (editable).
    const modalOptions = h.spies.showModal.mock.calls[0][0]
    expect(modalOptions).toMatchObject({
      title: UGC_REPORT_MODAL_TITLE,
      confirmText: '提交',
      cancelText: '取消',
      editable: true,
      placeholderText: UGC_REPORT_MODAL_PLACEHOLDER,
    })

    expect(mockedApiRequest).toHaveBeenCalledTimes(1)
    const request = mockedApiRequest.mock.calls[0][0]
    expect(request.path).toBe('/api/social-icebreaker/social-1/report-content')
    expect(request.method).toBe('POST')
    // The body carries ONLY the locator + reporter note — never the reported
    // content text (server-side snapshot, contract AC-01).
    expect(request.data).toEqual({
      phase: 'quip_battle',
      targetUserId: 'u-target',
      contentRef: { kind: 'quipAnswer', promptId: 'p1' },
      note: '这句有点过分',
    })
    expect(JSON.stringify(request.data)).not.toContain('answerText')

    expect(mockedTrack).toHaveBeenCalledWith(
      'ugc_report_submitted',
      'social-1',
      undefined,
      'quip_battle',
      { kind: 'quipAnswer' },
    )
    expect(h.spies.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: UGC_REPORT_SUCCESS_TOAST, icon: 'success' }),
    )
    // No emoji anywhere in the user-facing copy (guardrails posture).
    expect(UGC_REPORT_SUCCESS_TOAST).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
    expect(result.current.isReporting).toBe(false)
  })

  it('empty / whitespace note is omitted from the body entirely', async () => {
    h.spies.showModal.mockResolvedValue({ confirm: true, cancel: false, content: '   ' })
    const { result } = renderHook(() => useUgcReport({ socialSessionId: 'social-1' }))

    await act(async () => {
      await result.current.presentReport(TARGET)
    })

    const data = mockedApiRequest.mock.calls[0][0].data as Record<string, unknown>
    expect('note' in data).toBe(false)
  })

  it('note is capped at 100 chars client-side (server allows 500)', async () => {
    h.spies.showModal.mockResolvedValue({ confirm: true, cancel: false, content: '长'.repeat(140) })
    const { result } = renderHook(() => useUgcReport({ socialSessionId: 'social-1' }))

    await act(async () => {
      await result.current.presentReport(TARGET)
    })

    const data = mockedApiRequest.mock.calls[0][0].data as { note: string }
    expect(data.note).toHaveLength(100)
  })

  it('ActionSheet dismissal is a silent cancel — no POST, no toast, no analytics', async () => {
    h.spies.showActionSheet.mockRejectedValue(new Error('cancel'))
    const { result } = renderHook(() => useUgcReport({ socialSessionId: 'social-1' }))

    await act(async () => {
      await result.current.presentReport(TARGET)
    })

    expect(mockedApiRequest).not.toHaveBeenCalled()
    expect(h.spies.showModal).not.toHaveBeenCalled()
    expect(h.spies.showToast).not.toHaveBeenCalled()
    expect(mockedTrack).not.toHaveBeenCalled()
  })

  it('modal cancel submits nothing', async () => {
    h.spies.showModal.mockResolvedValue({ confirm: false, cancel: true })
    const { result } = renderHook(() => useUgcReport({ socialSessionId: 'social-1' }))

    await act(async () => {
      await result.current.presentReport(TARGET)
    })

    expect(mockedApiRequest).not.toHaveBeenCalled()
    expect(mockedTrack).not.toHaveBeenCalled()
  })

  it('REL-01: a second long-press mid-flow is dropped — one POST per flow', async () => {
    const pendingPost = deferred<{ success: boolean }>()
    mockedApiRequest.mockReturnValue(pendingPost.promise)
    const { result } = renderHook(() => useUgcReport({ socialSessionId: 'social-1' }))

    let first!: Promise<void>
    await act(async () => {
      first = result.current.presentReport(TARGET)
      // Flush microtasks so the first flow reaches the POST leg (sheet →
      // modal → apiRequest) before the second long-press attempts entry.
      for (let i = 0; i < 5; i += 1) await Promise.resolve()
      await result.current.presentReport({
        phase: 'undercover_word',
        targetUserId: 'u-other',
        contentRef: { kind: 'undercoverDescription', round: 1 },
      })
    })

    // The second call never even opened the sheet.
    expect(h.spies.showActionSheet).toHaveBeenCalledTimes(1)

    await act(async () => {
      pendingPost.resolve({ success: true })
      await first
    })
    expect(mockedApiRequest).toHaveBeenCalledTimes(1)
    expect(mockedTrack).toHaveBeenCalledTimes(1)
  })

  it('POST failure shows the warm failure toast and skips analytics', async () => {
    mockedApiRequest.mockRejectedValue(new Error('API request failed with status 429'))
    const { result } = renderHook(() => useUgcReport({ socialSessionId: 'social-1' }))

    await act(async () => {
      await result.current.presentReport(TARGET)
    })

    expect(h.spies.showToast).toHaveBeenCalledTimes(1)
    expect(h.spies.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: UGC_REPORT_FAILURE_TOAST, icon: 'none' }),
    )
    expect(mockedTrack).not.toHaveBeenCalled()
    expect(result.current.isReporting).toBe(false)

    // The lock is released — a retry reaches the server.
    mockedApiRequest.mockResolvedValueOnce({ success: true })
    await act(async () => {
      await result.current.presentReport(TARGET)
    })
    expect(mockedApiRequest).toHaveBeenCalledTimes(2)
  })

  it('no socialSessionId (pre-poll frame) → total no-op', async () => {
    const { result } = renderHook(() => useUgcReport({ socialSessionId: undefined }))

    await act(async () => {
      await result.current.presentReport(TARGET)
    })

    expect(h.spies.showActionSheet).not.toHaveBeenCalled()
    expect(haptics).not.toHaveBeenCalled()
    expect(mockedApiRequest).not.toHaveBeenCalled()
  })

  it('shouldSkipClick: true inside the post-longpress window, false after it', async () => {
    const sheetGate = deferred<{ tapIndex: number }>()
    h.spies.showActionSheet.mockReturnValue(sheetGate.promise)
    const { result } = renderHook(() => useUgcReport({ socialSessionId: 'social-1' }))

    expect(result.current.shouldSkipClick()).toBe(false)

    let flow!: Promise<void>
    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValue(10_000)
    await act(async () => {
      flow = result.current.presentReport(TARGET)
      await Promise.resolve()
    })
    expect(result.current.shouldSkipClick()).toBe(true)

    // 600ms echo window elapsed → taps count again.
    nowSpy.mockReturnValue(10_700)
    expect(result.current.shouldSkipClick()).toBe(false)

    nowSpy.mockReturnValue(10_700)
    await act(async () => {
      sheetGate.resolve({ tapIndex: 0 })
      await flow
    })
  })
})
