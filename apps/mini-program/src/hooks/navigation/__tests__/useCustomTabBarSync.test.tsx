import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import Taro from '@tarojs/taro'
import { useCustomTabBarSync } from '../useCustomTabBarSync'
import {
  getTabBarState,
  setTabBarSelected,
  setTabBarBadges,
  setTabBarCenterState,
} from '../../../lib/navigation/tabBarState'
import { getMiniProgramCenterState } from '../../../lib/navigation/centerTabRouting'
import type { MiniProgramCenterState } from '../../../lib/navigation/centerTabRouting'

const mockSetSelected = vi.fn()
const mockSyncState = vi.fn()
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
    mockSetSelected.mockClear()
    mockSyncState.mockClear()
    mockGetTabBar.mockClear()
    ;(Taro as any).getCurrentInstance.mockReturnValue({ page: { getTabBar: mockGetTabBar } })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('always sets the selected index on show, even when disabled', () => {
    renderHook(() => useCustomTabBarSync({ enabled: false, tabKey: 'events' }))

    act(() => didShowCallback?.())

    expect(mockSetSelected).toHaveBeenCalledWith(1)
    expect(getTabBarState().selected).toBe(1)
  })

  it('syncs chrome state only when enabled', () => {
    const center: MiniProgramCenterState = {
      label: '匹配中…',
      showBadge: true,
      action: { kind: 'pending-registration', navigation: 'switchTab', url: '/pages/center-hub/index' },
    }
    setTabBarCenterState(center)
    setTabBarBadges({ discover: 5, activities: 0, chat: 2 })

    renderHook(() => useCustomTabBarSync({ enabled: true, tabKey: 'discover' }))

    act(() => didShowCallback?.())

    expect(mockSyncState).toHaveBeenCalledWith({ center, badges: { discover: 5, activities: 0, chat: 2 } })
  })

  it('does not sync chrome state when disabled', () => {
    renderHook(() => useCustomTabBarSync({ enabled: false, tabKey: 'connections' }))

    act(() => didShowCallback?.())

    expect(mockSetSelected).toHaveBeenCalled()
    expect(mockSyncState).not.toHaveBeenCalled()
  })

  it('pushes singleton updates to the native tab bar while visible and enabled', () => {
    renderHook(() => useCustomTabBarSync({ enabled: true, tabKey: 'profile' }))

    act(() => didShowCallback?.())
    mockSyncState.mockClear()

    act(() => setTabBarBadges({ discover: 1, activities: 0, chat: 0 }))
    expect(mockSyncState).toHaveBeenCalledTimes(1)
  })

  it('ignores singleton updates while hidden', () => {
    renderHook(() => useCustomTabBarSync({ enabled: true, tabKey: 'profile' }))

    act(() => didShowCallback?.())
    mockSyncState.mockClear()

    act(() => didHideCallback?.())

    act(() => setTabBarBadges({ discover: 9, activities: 0, chat: 0 }))
    expect(mockSyncState).not.toHaveBeenCalled()
  })
})
