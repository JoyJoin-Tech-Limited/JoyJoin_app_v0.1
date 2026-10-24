import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDidShow } from '@tarojs/taro'

import { useDuoBindingNotice } from '../useDuoBindingNotice'

vi.mock('@tarojs/taro', () => ({ useDidShow: vi.fn() }))

const mockUseDidShow = vi.mocked(useDidShow)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useDuoBindingNotice — AC-7 本次响应与页面栈生命周期', () => {
  it('先被拒后换码/成功时，最新 bound 响应立即清除旧 notice', () => {
    const { result, rerender } = renderHook(
      ({ inviterDisplayName }) =>
        useDuoBindingNotice({ inviterDisplayName, duoInviteInvalid: false }),
      { initialProps: { inviterDisplayName: '阿明' } },
    )

    act(() => {
      result.current.applyDuoBindingResponse({
        id: 'registration-1',
        duoBinding: { state: 'unavailable', reason: 'partner_taken' },
      })
    })
    expect(result.current.duoBindingNotice).toBe('阿明 这局已经有同行了，这次就各排各的')

    rerender({ inviterDisplayName: '阿珍' })
    act(() => {
      result.current.applyDuoBindingResponse({
        id: 'registration-2',
        duoBinding: { state: 'bound' },
      })
    })
    expect(result.current.duoBindingNotice).toBeNull()
  })

  it('expired 仅在落地有效时显示；落地已 410 的会话不重复解释', () => {
    const { result, rerender } = renderHook(
      ({ duoInviteInvalid }) =>
        useDuoBindingNotice({ inviterDisplayName: '阿明', duoInviteInvalid }),
      { initialProps: { duoInviteInvalid: false } },
    )

    act(() => {
      result.current.applyDuoBindingResponse({
        id: 'registration-1',
        duoBinding: { state: 'unavailable', reason: 'expired' },
      })
    })
    expect(result.current.duoBindingNotice).toBe('这张邀请已经过期了，这次就按你一个人的报名排')

    rerender({ duoInviteInvalid: true })
    act(() => {
      result.current.applyDuoBindingResponse({
        id: 'registration-2',
        duoBinding: { state: 'unavailable', reason: 'expired' },
      })
    })
    expect(result.current.duoBindingNotice).toBeNull()
  })

  it('新提交清空；swipe-back 经 useResetOnShow 清空且不复活', () => {
    const { result } = renderHook(() =>
      useDuoBindingNotice({ inviterDisplayName: '阿明', duoInviteInvalid: false }),
    )
    act(() => {
      result.current.applyDuoBindingResponse({
        id: 'registration-1',
        duoBinding: { state: 'unavailable', reason: 'pool_mismatch' },
      })
    })
    expect(result.current.duoBindingNotice).not.toBeNull()

    act(() => result.current.clearDuoBindingNotice())
    expect(result.current.duoBindingNotice).toBeNull()

    act(() => {
      result.current.applyDuoBindingResponse({
        id: 'registration-2',
        duoBinding: { state: 'unavailable', reason: 'pool_mismatch' },
      })
    })
    expect(result.current.duoBindingNotice).not.toBeNull()
    const didShowCalls = mockUseDidShow.mock.calls
    const didShow = didShowCalls[didShowCalls.length - 1]?.[0]
    expect(didShow).toBeTypeOf('function')
    act(() => didShow?.())
    expect(result.current.duoBindingNotice).toBeNull()
  })
})
