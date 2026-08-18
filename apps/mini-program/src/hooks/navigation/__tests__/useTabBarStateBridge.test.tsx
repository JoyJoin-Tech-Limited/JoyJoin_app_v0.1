import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { getMyPoolRegistrations, getJoinedEvents } from '@shared/api'
import { useTabBarStateBridge } from '../useTabBarStateBridge'
import { getTabBarState, setTabBarBadges, setTabBarCenterState, setTabBarSelected } from '../../../lib/navigation/tabBarState'
import { getMiniProgramCenterState } from '../../../lib/navigation/centerTabRouting'

import { useAuth } from '../../useAuth'
import { useNotificationCounts } from '../../useNotificationCounts'

vi.mock('../../useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../../useNotificationCounts', () => ({
  useNotificationCounts: vi.fn(),
}))

vi.mock('../../../lib/api/api', () => ({
  apiRequest: vi.fn(),
}))

vi.mock('@shared/api', async () => {
  const actual = await vi.importActual<typeof import('@shared/api')>('@shared/api')
  return {
    ...actual,
    getMyPoolRegistrations: vi.fn(),
    getJoinedEvents: vi.fn(),
  }
})

const mockUseAuth = vi.mocked(useAuth)
const mockUseNotificationCounts = vi.mocked(useNotificationCounts)
const mockGetMyPoolRegistrations = vi.mocked(getMyPoolRegistrations)
const mockGetJoinedEvents = vi.mocked(getJoinedEvents)

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function resetTabBarState() {
  setTabBarSelected(0)
  setTabBarCenterState(getMiniProgramCenterState([], []))
  setTabBarBadges({ discover: 0, activities: 0, chat: 0 })
}

describe('useTabBarStateBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetTabBarState()
    mockUseAuth.mockReturnValue({ isAuthenticated: true } as any)
    mockUseNotificationCounts.mockReturnValue({ data: { discover: 2, activities: 3, chat: 0 } } as any)
    mockGetMyPoolRegistrations.mockResolvedValue([])
    mockGetJoinedEvents.mockResolvedValue([])
  })

  it('publishes notification badges when authenticated', async () => {
    renderHook(() => useTabBarStateBridge(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(getTabBarState().badges).toEqual({ discover: 2, activities: 3, chat: 0 })
    })
  })

  it('computes center state from pool registrations and joined events', async () => {
    mockGetMyPoolRegistrations.mockResolvedValue([
      { id: 'reg-1', poolId: 'pool-1', matchStatus: 'pending' },
    ])
    mockGetJoinedEvents.mockResolvedValue([])

    renderHook(() => useTabBarStateBridge(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(getTabBarState().center.label).toBe('排桌中…')
      expect(getTabBarState().center.showBadge).toBe(true)
    })
  })

  it('does not enable data fetching when the user is not authenticated', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false } as any)
    mockUseNotificationCounts.mockReturnValue({ data: undefined } as any)
    mockGetMyPoolRegistrations.mockResolvedValue([
      { id: 'reg-1', poolId: 'pool-1', matchStatus: 'pending' },
    ])
    mockGetJoinedEvents.mockResolvedValue([{ id: 'event-1', status: 'open' }])

    renderHook(() => useTabBarStateBridge(), { wrapper: createWrapper() })

    // Give a beat to ensure no async query side-effects ran.
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(mockGetMyPoolRegistrations).not.toHaveBeenCalled()
    expect(mockGetJoinedEvents).not.toHaveBeenCalled()
    expect(getTabBarState().badges).toEqual({ discover: 0, activities: 0, chat: 0 })
    expect(getTabBarState().center.label).toBe('去发现')
  })
})
