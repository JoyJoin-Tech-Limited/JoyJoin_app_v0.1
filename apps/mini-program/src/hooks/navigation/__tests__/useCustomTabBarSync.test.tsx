import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import Taro from '@tarojs/taro'
import { useCustomTabBarSync } from '../useCustomTabBarSync'
import { useNotificationCounts } from '../../useNotificationCounts'
import {
  getTabBarState,
  setTabBarBadges,
  setTabBarCenterState,
  setTabBarSelected,
} from '../../../lib/navigation/tabBarState'
import { getMiniProgramCenterState } from '../../../lib/navigation/centerTabRouting'

const mockSyncState = vi.fn()
const mockSetSelected = vi.fn()
const mockGetTabBar = vi.fn(() => ({ setSelected: mockSetSelected, syncState: mockSyncState }))

let didShowCallback: (() => void) | undefined
let didHideCallback: (() => void) | undefined

vi.mock('@tarojs/taro', async () => {
  const actual = await vi.importActual<typeof import('@tarojs/taro')>('@tarojs/taro')
  return {
    ...actual,
    useDidShow: vi.fn((cb: () => void) => { didShowCallback = cb }),
    useDidHide: vi.fn((cb: () => void) => { didHideCallback = cb }),
  }
})

vi.mock('../../useNotificationCounts', () => ({
  useNotificationCounts: vi.fn(),
}))

const mockUseNotificationCounts = vi.mocked(useNotificationCounts)

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function resetState() {
  setTabBarSelected(0)
  setTabBarCenterState(getMiniProgramCenterState([], []))
  setTabBarBadges({ discover: 0, activities: 0, chat: 0 })
}

describe('useCustomTabBarSync', () => {
  beforeEach(() => {
    resetState()
    didShowCallback = undefined
    didHideCallback = undefined
    mockSyncState.mockClear()
    mockSetSelected.mockClear()
    mockGetTabBar.mockClear()
    mockUseNotificationCounts.mockReturnValue({ data: { discover: 0, activities: 0, chat: 0 } } as any)
    ;(Taro as any).getCurrentInstance.mockReturnValue({ page: { route: 'pages/discover/index', getTabBar: mockGetTabBar } })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('syncs center + badges to the native tab bar on show when enabled', async () => {
    const poolRegistrations = [{ id: 'reg-1', poolId: 'pool-1', matchStatus: 'pending' as const }]
    const events: any[] = []
    const center = getMiniProgramCenterState(poolRegistrations, events)
    mockUseNotificationCounts.mockReturnValue({ data: { discover: 5, activities: 0, chat: 2 } } as any)

    renderHook(
      () => useCustomTabBarSync({ enabled: true, poolRegistrations, events }),
      { wrapper: createWrapper() },
    )

    act(() => didShowCallback?.())

    await waitFor(() => {
      expect(mockSyncState).toHaveBeenCalledWith({ center, badges: { discover: 5, activities: 0, chat: 2, profile: 0 } })
    })
  })

  it('P0-5: passes a live profileBadgeCount through to the 我的 tab badge', async () => {
    const poolRegistrations = [{ id: 'reg-1', poolId: 'pool-1', matchStatus: 'pending' as const }]
    const events: any[] = []
    const center = getMiniProgramCenterState(poolRegistrations, events)
    mockUseNotificationCounts.mockReturnValue({ data: { discover: 0, activities: 0, chat: 0 } } as any)

    renderHook(
      () => useCustomTabBarSync({ enabled: true, poolRegistrations, events, profileBadgeCount: 2 }),
      { wrapper: createWrapper() },
    )

    act(() => didShowCallback?.())

    await waitFor(() => {
      expect(mockSyncState).toHaveBeenCalledWith({ center, badges: { discover: 0, activities: 0, chat: 0, profile: 2 } })
    })
  })

  it('syncs selected tab from the current page route on show', async () => {
    ;(Taro as any).getCurrentInstance.mockReturnValue({ page: { route: 'pages/events/index', getTabBar: mockGetTabBar } })

    renderHook(
      () => useCustomTabBarSync({ enabled: true, poolRegistrations: [], events: [] }),
      { wrapper: createWrapper() },
    )

    act(() => didShowCallback?.())

    expect(mockSetSelected).toHaveBeenCalledWith(1)
  })

  it('highlights Discover for the pool-registration page', async () => {
    ;(Taro as any).getCurrentInstance.mockReturnValue({
      page: { route: 'pages/pool-registration/index', getTabBar: mockGetTabBar },
    })

    renderHook(
      () => useCustomTabBarSync({ enabled: true, poolRegistrations: [], events: [] }),
      { wrapper: createWrapper() },
    )

    act(() => didShowCallback?.())

    expect(mockSetSelected).toHaveBeenCalledWith(0)
  })

  it('publishes the tab selection even when data sync is disabled', () => {
    renderHook(() => useCustomTabBarSync({ enabled: false, poolRegistrations: [], events: [] }), { wrapper: createWrapper() })

    act(() => didShowCallback?.())

    // Selection is route truth, not data: it must be correct on the first frame
    // even while auth/queries are still loading.
    expect(mockSetSelected).toHaveBeenCalledWith(0)
    expect(mockSyncState).not.toHaveBeenCalled()
  })

  it('retries the selection push when the native instance is not ready yet', () => {
    vi.useFakeTimers()
    let resolveCount = 0
    const lateGetTabBar = vi.fn(() => {
      resolveCount += 1
      return resolveCount >= 3 ? { setSelected: mockSetSelected, syncState: mockSyncState } : undefined
    })
    ;(Taro as any).getCurrentInstance.mockReturnValue({
      page: { route: 'pages/events/index', getTabBar: lateGetTabBar },
    })

    renderHook(() => useCustomTabBarSync({ enabled: true, poolRegistrations: [], events: [] }), {
      wrapper: createWrapper(),
    })

    act(() => didShowCallback?.())
    expect(mockSetSelected).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(mockSetSelected).toHaveBeenCalledTimes(1)
    expect(mockSetSelected).toHaveBeenCalledWith(1)
    vi.useRealTimers()
  })

  it('cancels a pending selection retry when the page hides', () => {
    vi.useFakeTimers()
    const neverReady = vi.fn(() => undefined)
    ;(Taro as any).getCurrentInstance.mockReturnValue({
      page: { route: 'pages/events/index', getTabBar: neverReady },
    })

    renderHook(() => useCustomTabBarSync({ enabled: true, poolRegistrations: [], events: [] }), {
      wrapper: createWrapper(),
    })

    act(() => didShowCallback?.())
    act(() => didHideCallback?.())
    const callsAfterHide = neverReady.mock.calls.length

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // No late write for a page the user already left.
    expect(neverReady.mock.calls.length).toBe(callsAfterHide)
    vi.useRealTimers()
  })

  it('records route truth in the tab bar singleton', () => {
    ;(Taro as any).getCurrentInstance.mockReturnValue({
      page: { route: 'pages/connections/index', getTabBar: mockGetTabBar },
    })

    renderHook(() => useCustomTabBarSync({ enabled: true, poolRegistrations: [], events: [] }), {
      wrapper: createWrapper(),
    })

    act(() => didShowCallback?.())

    expect(getTabBarState().selected).toBe(2)
  })

  it('does not set selected for non-tab routes such as event-detail and event-ticket-payment', async () => {
    for (const route of ['pages/event-detail/index', 'pages/payments/event-ticket-payment/index']) {
      mockSetSelected.mockClear()
      mockSyncState.mockClear()
      ;(Taro as any).getCurrentInstance.mockReturnValue({ page: { route, getTabBar: mockGetTabBar } })

      renderHook(
        () => useCustomTabBarSync({ enabled: true, poolRegistrations: [], events: [] }),
        { wrapper: createWrapper() },
      )

      act(() => didShowCallback?.())

      expect(mockSetSelected).not.toHaveBeenCalled()
      expect(mockSyncState).toHaveBeenCalledTimes(1)
    }
  })

  it('pushes badge updates to the native tab bar while visible and enabled', async () => {
    mockUseNotificationCounts.mockReturnValue({ data: { discover: 0, activities: 0, chat: 0 } } as any)

    const { rerender } = renderHook(
      () => useCustomTabBarSync({ enabled: true, poolRegistrations: [], events: [] }),
      { wrapper: createWrapper() },
    )

    act(() => didShowCallback?.())
    mockSyncState.mockClear()

    mockUseNotificationCounts.mockReturnValue({ data: { discover: 1, activities: 0, chat: 0 } } as any)
    rerender({})

    await waitFor(() => {
      expect(mockSyncState).toHaveBeenCalledTimes(1)
    })
  })

  it('ignores updates while hidden', async () => {
    mockUseNotificationCounts.mockReturnValue({ data: { discover: 0, activities: 0, chat: 0 } } as any)

    const { rerender } = renderHook(
      () => useCustomTabBarSync({ enabled: true, poolRegistrations: [], events: [] }),
      { wrapper: createWrapper() },
    )

    act(() => didShowCallback?.())
    mockSyncState.mockClear()

    act(() => didHideCallback?.())

    mockUseNotificationCounts.mockReturnValue({ data: { discover: 9, activities: 0, chat: 0 } } as any)
    rerender({})

    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(mockSyncState).not.toHaveBeenCalled()
  })
})
