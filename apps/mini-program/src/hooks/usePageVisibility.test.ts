import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { usePageVisibility } from './usePageVisibility'

const { taroMocks } = vi.hoisted(() => ({
  taroMocks: {
    useDidShow: vi.fn(),
    useDidHide: vi.fn(),
  },
}))

vi.mock('@tarojs/taro', async () => {
  const actual = await vi.importActual<typeof import('@tarojs/taro')>('@tarojs/taro')
  return {
    ...actual,
    useDidShow: taroMocks.useDidShow,
    useDidHide: taroMocks.useDidHide,
  }
})

function fireShow() {
  const calls = taroMocks.useDidShow.mock.calls
  const cb = calls[calls.length - 1][0] as () => void
  act(() => cb())
}

function fireHide() {
  const calls = taroMocks.useDidHide.mock.calls
  const cb = calls[calls.length - 1][0] as () => void
  act(() => cb())
}

describe('usePageVisibility', () => {
  beforeEach(() => {
    taroMocks.useDidShow.mockClear()
    taroMocks.useDidHide.mockClear()
  })

  it('starts visible on mount', () => {
    const { result } = renderHook(() => usePageVisibility())
    expect(result.current.isPageVisible).toBe(true)
  })

  it('flips to hidden when useDidHide fires (navigation-away or app-background)', () => {
    const { result } = renderHook(() => usePageVisibility())
    fireHide()
    expect(result.current.isPageVisible).toBe(false)
  })

  it('flips back to visible when useDidShow fires', () => {
    const { result } = renderHook(() => usePageVisibility())
    fireHide()
    fireShow()
    expect(result.current.isPageVisible).toBe(true)
  })

  it('handles repeated hide/show cycles', () => {
    const { result } = renderHook(() => usePageVisibility())
    fireHide()
    fireShow()
    fireHide()
    expect(result.current.isPageVisible).toBe(false)
    fireShow()
    expect(result.current.isPageVisible).toBe(true)
  })

  it('re-firing the same lifecycle event is idempotent', () => {
    const { result } = renderHook(() => usePageVisibility())
    fireHide()
    fireHide()
    expect(result.current.isPageVisible).toBe(false)
    fireShow()
    fireShow()
    expect(result.current.isPageVisible).toBe(true)
  })

  it('registers one didShow and one didHide handler on mount', () => {
    renderHook(() => usePageVisibility())
    expect(taroMocks.useDidShow).toHaveBeenCalledTimes(1)
    expect(taroMocks.useDidHide).toHaveBeenCalledTimes(1)
  })
})
