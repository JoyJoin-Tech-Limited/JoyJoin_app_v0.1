import { describe, it, expect, vi, beforeEach } from 'vitest'
import Taro from '@tarojs/taro'
import {
  buildPoolGroupDetailUrl,
  buildSquadUnboxingUrl,
  openPoolGroupDetail,
  openSquadUnboxing,
  replaceWithPoolGroupDetail,
  replaceWithSquadUnboxing,
  switchToEventsTab,
  switchToDiscoverTab,
  navigateBackOrEventsTab,
} from '../matchingNavigation'

const mockGroupId = 'group-123'

function mockFail(fn: ReturnType<typeof vi.fn>) {
  fn.mockImplementation(({ fail }: { fail?: (err: unknown) => void }) => {
    if (fail) {
      fail({ errMsg: 'mock fail' })
    }
    return Promise.resolve({})
  })
}

function mockSuccess(fn: ReturnType<typeof vi.fn>) {
  fn.mockImplementation(({ success }: { success?: () => void }) => {
    if (success) {
      success()
    }
    return Promise.resolve({})
  })
}

describe('matchingNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('URL builders', () => {
    it('builds pool group detail URL with encoded groupId', () => {
      expect(buildPoolGroupDetailUrl(mockGroupId)).toBe(
        `/pages/pool-group-detail/index?groupId=${encodeURIComponent(mockGroupId)}`,
      )
    })

    it('builds squad unboxing URL with encoded groupId', () => {
      expect(buildSquadUnboxingUrl(mockGroupId)).toBe(
        `/subpackages/squad-unboxing/index?groupId=${encodeURIComponent(mockGroupId)}`,
      )
    })
  })

  describe('openPoolGroupDetail', () => {
    it('navigates to pool-group-detail via navigateTo', () => {
      openPoolGroupDetail(mockGroupId)
      expect(Taro.navigateTo).toHaveBeenCalledTimes(1)
      expect(Taro.navigateTo).toHaveBeenCalledWith(
        expect.objectContaining({ url: buildPoolGroupDetailUrl(mockGroupId) }),
      )
    })

    it('shows toast when navigateTo fails', () => {
      mockFail(Taro.navigateTo as unknown as ReturnType<typeof vi.fn>)
      openPoolGroupDetail(mockGroupId)
      expect(Taro.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '跳转失败，请重试' }),
      )
    })
  })

  describe('replaceWithPoolGroupDetail', () => {
    it('redirects to pool-group-detail via redirectTo', () => {
      replaceWithPoolGroupDetail(mockGroupId)
      expect(Taro.redirectTo).toHaveBeenCalledTimes(1)
      expect(Taro.redirectTo).toHaveBeenCalledWith(
        expect.objectContaining({ url: buildPoolGroupDetailUrl(mockGroupId) }),
      )
    })

    it('falls back to navigateTo when redirectTo fails', () => {
      mockFail(Taro.redirectTo as unknown as ReturnType<typeof vi.fn>)
      replaceWithPoolGroupDetail(mockGroupId)
      expect(Taro.navigateTo).toHaveBeenCalledTimes(1)
      expect(Taro.navigateTo).toHaveBeenCalledWith(
        expect.objectContaining({ url: buildPoolGroupDetailUrl(mockGroupId) }),
      )
    })

    it('shows toast when both redirectTo and navigateTo fail', () => {
      mockFail(Taro.redirectTo as unknown as ReturnType<typeof vi.fn>)
      mockFail(Taro.navigateTo as unknown as ReturnType<typeof vi.fn>)
      replaceWithPoolGroupDetail(mockGroupId)
      expect(Taro.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '跳转失败，请重试' }),
      )
    })
  })

  describe('openSquadUnboxing', () => {
    it('navigates to squad-unboxing via navigateTo', () => {
      openSquadUnboxing(mockGroupId)
      expect(Taro.navigateTo).toHaveBeenCalledTimes(1)
      expect(Taro.navigateTo).toHaveBeenCalledWith(
        expect.objectContaining({ url: buildSquadUnboxingUrl(mockGroupId) }),
      )
    })

    it('shows toast when navigateTo fails', () => {
      mockFail(Taro.navigateTo as unknown as ReturnType<typeof vi.fn>)
      openSquadUnboxing(mockGroupId)
      expect(Taro.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '跳转失败，请重试' }),
      )
    })
  })

  describe('replaceWithSquadUnboxing', () => {
    it('redirects to squad-unboxing via redirectTo', () => {
      replaceWithSquadUnboxing(mockGroupId)
      expect(Taro.redirectTo).toHaveBeenCalledTimes(1)
      expect(Taro.redirectTo).toHaveBeenCalledWith(
        expect.objectContaining({ url: buildSquadUnboxingUrl(mockGroupId) }),
      )
    })

    it('falls back to navigateTo when redirectTo fails', () => {
      mockFail(Taro.redirectTo as unknown as ReturnType<typeof vi.fn>)
      replaceWithSquadUnboxing(mockGroupId)
      expect(Taro.navigateTo).toHaveBeenCalledTimes(1)
      expect(Taro.navigateTo).toHaveBeenCalledWith(
        expect.objectContaining({ url: buildSquadUnboxingUrl(mockGroupId) }),
      )
    })

    it('shows toast when both redirectTo and navigateTo fail', () => {
      mockFail(Taro.redirectTo as unknown as ReturnType<typeof vi.fn>)
      mockFail(Taro.navigateTo as unknown as ReturnType<typeof vi.fn>)
      replaceWithSquadUnboxing(mockGroupId)
      expect(Taro.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '跳转失败，请重试' }),
      )
    })
  })

  describe('tab switching', () => {
    it('switchToEventsTab switches to events tab', () => {
      switchToEventsTab()
      expect(Taro.switchTab).toHaveBeenCalledWith({ url: '/pages/events/index' })
    })

    it('switchToDiscoverTab switches to discover tab', () => {
      switchToDiscoverTab()
      expect(Taro.switchTab).toHaveBeenCalledWith({ url: '/pages/discover/index' })
    })
  })

  describe('navigateBackOrEventsTab', () => {
    it('navigates back', () => {
      navigateBackOrEventsTab()
      expect(Taro.navigateBack).toHaveBeenCalledTimes(1)
    })

    it('falls back to events tab when navigateBack fails', () => {
      ;(Taro.navigateBack as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        ({ fail }: { fail?: () => void }) => {
          if (fail) fail()
          return Promise.resolve({})
        },
      )
      navigateBackOrEventsTab()
      expect(Taro.switchTab).toHaveBeenCalledWith({ url: '/pages/events/index' })
    })
  })
})
