import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  usePageTTI,
  __resetPageTTITestState,
  __setAppLaunchTimestampForTests,
} from './usePageTTI'

const mockLogInfo = vi.fn()
const mockReportAnalytics = vi.fn()

vi.mock('../lib/utils/logger', () => ({
  logInfo: (...args: unknown[]) => mockLogInfo(...args),
  logWarn: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@tarojs/taro', async () => {
  const actual = await vi.importActual<typeof import('@tarojs/taro')>('@tarojs/taro')
  return {
    ...actual,
    useLoad: vi.fn((cb: () => void) => cb()),
    useDidShow: vi.fn(() => {}),
  }
})

describe('usePageTTI', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockLogInfo.mockClear()
    mockReportAnalytics.mockClear()
    __resetPageTTITestState()
    ;(global as unknown as Record<string, unknown>).wx = {
      reportAnalytics: mockReportAnalytics,
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports TTI on mount when no ready flag is provided', () => {
    const pageLoadTime = Date.now()
    __setAppLaunchTimestampForTests(pageLoadTime - 10_000)

    renderHook(() => usePageTTI({ pageName: 'terms' }))
    act(() => vi.advanceTimersByTime(0))

    expect(mockLogInfo).toHaveBeenCalledTimes(1)
    const context = mockLogInfo.mock.calls[0][1] as Record<string, unknown>
    expect(context.page).toBe('terms')
    expect(context.isCold).toBe(false)
    expect(context.budgetMs).toBe(800)
  })

  it('waits for ready flag before reporting TTI', () => {
    __setAppLaunchTimestampForTests(Date.now() - 10_000)

    const { rerender } = renderHook(
      ({ ready }: { ready: boolean }) => usePageTTI({ pageName: 'rewards', ready }),
      { initialProps: { ready: false } },
    )

    act(() => vi.advanceTimersByTime(100))
    expect(mockLogInfo).not.toHaveBeenCalled()

    rerender({ ready: true })
    act(() => vi.advanceTimersByTime(0))

    expect(mockLogInfo).toHaveBeenCalledTimes(1)
    const context = mockLogInfo.mock.calls[0][1] as Record<string, unknown>
    expect(context.page).toBe('rewards')
  })

  it('reports within cold budget when page loads shortly after app launch', () => {
    const pageLoadTime = Date.now()
    __setAppLaunchTimestampForTests(pageLoadTime - 100)

    renderHook(() => usePageTTI({ pageName: 'edit-profile' }))
    act(() => vi.advanceTimersByTime(0))

    const context = mockLogInfo.mock.calls[0][1] as Record<string, unknown>
    expect(context.isCold).toBe(true)
    expect(context.budgetMs).toBe(2000)
  })

  it('does not report when disabled', () => {
    renderHook(() => usePageTTI({ pageName: 'invite', disabled: true }))
    act(() => vi.advanceTimersByTime(100))

    expect(mockLogInfo).not.toHaveBeenCalled()
    expect(mockReportAnalytics).not.toHaveBeenCalled()
  })

  it('falls back to wx.reportAnalytics', () => {
    __setAppLaunchTimestampForTests(Date.now() - 10_000)

    renderHook(() => usePageTTI({ pageName: 'terms' }))
    act(() => vi.advanceTimersByTime(0))

    expect(mockReportAnalytics).toHaveBeenCalledWith(
      'page_tti',
      expect.objectContaining({
        page: 'terms',
        isCold: expect.any(String),
        withinBudget: expect.any(String),
      }),
    )
  })

  it('reports only once across re-renders', () => {
    __setAppLaunchTimestampForTests(Date.now() - 10_000)

    const { rerender } = renderHook(() => usePageTTI({ pageName: 'terms' }))
    act(() => vi.advanceTimersByTime(0))

    rerender()
    rerender()
    act(() => vi.advanceTimersByTime(100))

    expect(mockLogInfo).toHaveBeenCalledTimes(1)
    expect(mockReportAnalytics).toHaveBeenCalledTimes(1)
  })
})
