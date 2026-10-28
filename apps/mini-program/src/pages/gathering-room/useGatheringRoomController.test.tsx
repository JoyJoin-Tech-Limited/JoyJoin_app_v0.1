import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { GatheringRoomStateResponse } from '@shared/api'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useGatheringRoomController } from './useGatheringRoomController'
import { haptics } from '../../lib/utils/haptics'

const wsState = vi.hoisted(() => ({
  options: null as null | {
    onMessage: (message: { eventId: string; type: string; data?: unknown }) => void
  },
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    showToast: vi.fn(),
    showActionSheet: vi.fn(),
    getStorageSync: vi.fn(() => undefined),
    setStorageSync: vi.fn(),
  },
  useDidShow: vi.fn(),
  useDidHide: vi.fn(),
}))

vi.mock('@shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/api')>()
  return {
    ...actual,
    getPoolGroupRoomState: vi.fn(),
    getPoolGroupAnalysis: vi.fn(async () => null),
  }
})

vi.mock('../../hooks/useAuthGuard', () => ({
  useAuthGuard: () => ({
    user: { id: 'user-self', features: { gatheringRoomEnabled: true } },
    isLoading: false,
  }),
}))

vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: (options: typeof wsState.options) => {
    wsState.options = options
    return { send: vi.fn(), state: 'connected' }
  },
}))

vi.mock('../../hooks/useResetOnShow', () => ({ useResetOnShow: vi.fn() }))
vi.mock('../../lib/utils/systemReducedMotion', () => ({ getSystemReducedMotion: () => false }))
vi.mock('../../lib/utils/haptics', () => ({ haptics: vi.fn() }))
vi.mock('../../lib/utils/logger', () => ({ logInfo: vi.fn(), logWarn: vi.fn() }))
vi.mock('../../lib/api/api', () => ({ apiRequest: vi.fn(async () => ({ success: true })) }))
vi.mock('../../lib/analytics/gatheringRoomAnalytics', () => ({
  gatheringRoomAnalytics: { track: vi.fn() },
}))

import { getPoolGroupRoomState } from '@shared/api'

function roomState(overrides: Partial<GatheringRoomStateResponse> = {}): GatheringRoomStateResponse {
  return {
    groupId: 'group-1',
    poolId: 'pool-1',
    blindBoxEventId: 'event-1',
    totalParticipants: 6,
    confirmedCount: 5,
    arrivingLateCount: 1,
    eventPhase: 'upcoming',
    eventDateTime: '2026-10-29T19:00:00.000Z',
    venue: null,
    members: Array.from({ length: 6 }, (_, index) => ({
      userId: index === 5 ? 'user-last' : `user-${index}`,
      displayName: `成员${index}`,
      attendanceStatus: index === 5 ? 'pending' : index === 2 ? 'late' : 'confirmed',
      archetype: 'corgi',
      avatarUrl: null,
      equippedItems: [],
    })),
    ...overrides,
  } as GatheringRoomStateResponse
}

function setup(state: GatheringRoomStateResponse) {
  let persistedState = state
  vi.mocked(getPoolGroupRoomState).mockImplementation(async () => persistedState)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const view = renderHook(() => useGatheringRoomController({ groupId: 'group-1' }), { wrapper })
  const persistLastConfirmed = () => {
    const members = persistedState.members.map((member, index) =>
      index === persistedState.members.length - 1
        ? { ...member, attendanceStatus: 'confirmed' as const }
        : member)
    persistedState = {
      ...persistedState,
      confirmedCount: 6,
      arrivingLateCount: members.filter((member) => member.attendanceStatus === 'late').length,
      members,
    }
  }
  return { queryClient, view, persistLastConfirmed }
}

async function emitUserConfirmed() {
  await act(async () => {
    wsState.options?.onMessage({
      eventId: 'event-1',
      type: 'USER_CONFIRMED',
      data: {
        eventId: 'event-1',
        userId: 'user-last',
        displayName: '最后成员',
        confirmedCount: 6,
        totalParticipants: 6,
      },
    })
  })
}

describe('useGatheringRoomController USER_CONFIRMED behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    wsState.options = null
  })

  it('persists cache and celebrates once for a valid live all-confirmed transition', async () => {
    const { queryClient, view, persistLastConfirmed } = setup(roomState())
    await waitFor(() => expect(view.result.current.roomState).toBeTruthy())
    persistLastConfirmed()

    await emitUserConfirmed()

    await waitFor(() => {
      expect(view.result.current.celebrationText).toBe('这桌齐了')
      expect(view.result.current.celebrationStatic).toBe(false)
    })
    const cached = queryClient.getQueryData<GatheringRoomStateResponse>([
      'mini-program',
      'gathering-room-state',
      'group-1',
    ])
    expect(cached?.confirmedCount).toBe(6)
    expect(cached?.members.find((member) => member.userId === 'user-last')?.attendanceStatus)
      .toBe('confirmed')
    expect(haptics).toHaveBeenCalledTimes(1)

    await emitUserConfirmed()
    expect(haptics).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('does not celebrate when any member is absent', async () => {
    const state = roomState({
      members: roomState().members.map((member, index) => ({
        ...member,
        attendanceStatus: index === 0 ? 'absent' : index === 5 ? 'pending' : 'confirmed',
      })),
    })
    const { view } = setup(state)
    await waitFor(() => expect(view.result.current.roomState).toBeTruthy())

    await emitUserConfirmed()

    expect(view.result.current.celebrationText).toBeNull()
    expect(haptics).not.toHaveBeenCalled()
    view.unmount()
  })

  it('does not celebrate after the event has ended', async () => {
    const { view } = setup(roomState({ eventPhase: 'ended' }))
    await waitFor(() => expect(view.result.current.roomState).toBeTruthy())

    await emitUserConfirmed()

    expect(view.result.current.celebrationText).toBeNull()
    expect(haptics).not.toHaveBeenCalled()
    view.unmount()
  })
})
