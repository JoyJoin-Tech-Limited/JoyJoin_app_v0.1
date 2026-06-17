import { describe, it, expect, vi } from 'vitest'
import {
  getTabBarState,
  subscribeTabBarState,
  setTabBarSelected,
  setTabBarCenterState,
  setTabBarBadges,
  publishTabBarState,
  type TabBarState,
} from '../tabBarState'

const DEFAULT_CENTER = getTabBarState().center

function nextState(current: TabBarState, patch: Partial<TabBarState>): TabBarState {
  return {
    selected: patch.selected ?? current.selected,
    center: patch.center ?? current.center,
    badges: patch.badges ?? current.badges,
  }
}

describe('tabBarState singleton', () => {
  it('returns the default state', () => {
    const s = getTabBarState()
    expect(s.selected).toBe(0)
    expect(s.center.label).toBe('进行中')
    expect(s.badges).toEqual({ discover: 0, activities: 0, chat: 0 })
  })

  it('emits current state immediately on subscription', () => {
    const listener = vi.fn()
    subscribeTabBarState(listener)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(getTabBarState())
  })

  it('notifies subscribers when selected changes', () => {
    const listener = vi.fn()
    subscribeTabBarState(listener)
    listener.mockClear()

    setTabBarSelected(2)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ selected: 2 })
    )
  })

  it('does not notify when selected is set to the same value', () => {
    const listener = vi.fn()
    subscribeTabBarState(listener)
    listener.mockClear()

    setTabBarSelected(getTabBarState().selected)

    expect(listener).not.toHaveBeenCalled()
  })

  it('notifies subscribers when center state changes', () => {
    const listener = vi.fn()
    subscribeTabBarState(listener)
    listener.mockClear()

    const newCenter = nextState(getTabBarState(), {
      center: { label: '匹配中', showBadge: true, action: DEFAULT_CENTER.action },
    }).center

    setTabBarCenterState(newCenter)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ center: newCenter })
    )
  })

  it('ignores center updates that are shallow-equal', () => {
    const listener = vi.fn()
    subscribeTabBarState(listener)
    listener.mockClear()

    setTabBarCenterState(getTabBarState().center)

    expect(listener).not.toHaveBeenCalled()
  })

  it('notifies subscribers when badges change', () => {
    const listener = vi.fn()
    subscribeTabBarState(listener)
    listener.mockClear()

    setTabBarBadges({ discover: 3, activities: 1, chat: 7 })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        badges: { discover: 3, activities: 1, chat: 7 },
      })
    )
  })

  it('ignores badge updates with identical counts', () => {
    const listener = vi.fn()
    subscribeTabBarState(listener)
    listener.mockClear()

    setTabBarBadges(getTabBarState().badges)

    expect(listener).not.toHaveBeenCalled()
  })

  it('unsubscribe stops notifications', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeTabBarState(listener)
    unsubscribe()
    listener.mockClear()

    setTabBarSelected(3)

    expect(listener).not.toHaveBeenCalled()
  })

  it('publishTabBarState updates multiple fields in one emit', () => {
    const listener = vi.fn()
    subscribeTabBarState(listener)
    listener.mockClear()

    publishTabBarState({
      selected: 1,
      badges: { discover: 2, activities: 0, chat: 0 },
    })

    expect(listener).toHaveBeenCalledTimes(1)
    const emitted = listener.mock.calls[0][0] as TabBarState
    expect(emitted.selected).toBe(1)
    expect(emitted.badges).toEqual({ discover: 2, activities: 0, chat: 0 })
    expect(emitted.center).toEqual(getTabBarState().center)
  })

  it('publishTabBarState is a no-op when nothing changed', () => {
    const listener = vi.fn()
    subscribeTabBarState(listener)
    listener.mockClear()

    publishTabBarState({})

    expect(listener).not.toHaveBeenCalled()
  })
})
