import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import Taro from '@tarojs/taro'
import { useCustomTabBarSync } from '../useCustomTabBarSync'
import { useNotificationCounts } from '../../useNotificationCounts'
import {
  setTabBarBadges,
  setTabBarCenterState,
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
      expect(mockSyncState).toHaveBeenCalledWith({ center, badges: { discover: 5, activities: 0, chat: 2 } })
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
      page: { route: 'subpackages/pool-registration/index', getTabBar: mockGetTabBar },
    })

    renderHook(
      () => useCustomTabBarSync({ enabled: true, poolRegistrations: [], events: [] }),
      { wrapper: createWrapper() },
    )

    act(() => didShowCallback?.())

    expect(mockSetSelected).toHaveBeenCalledWith(0)
  })

  it('does not sync when disabled', () => {
    renderHook(() => useCustomTabBarSync({ enabled: false, poolRegistrations: [], events: [] }), { wrapper: createWrapper() })

    act(() => didShowCallback?.())

    expect(mockSyncState).not.toHaveBeenCalled()
    expect(mockSetSelected).not.toHaveBeenCalled()
  })

  it('does not set selected for non-tab routes such as event-detail and event-ticket-payment', async () => {
    for (const route of ['pages/event-detail/index', 'pages/event-ticket-payment/index']) {
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
