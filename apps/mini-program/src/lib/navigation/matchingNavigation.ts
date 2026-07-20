import Taro from '@tarojs/taro'
import { logInfo, logWarn } from '../utils/logger'

/**
 * Canonical URL for the matched pool-group detail page (post-match journey).
 * Kept in `lib/` so navigation side effects stay separate from view-model pure helpers.
 */
export function buildPoolGroupDetailUrl(groupId: string): string {
  return `/pages/pool-group-detail/index?groupId=${encodeURIComponent(groupId)}`
}

export function openPoolGroupDetail(groupId: string): void {
  const url = buildPoolGroupDetailUrl(groupId)
  logInfo('[Navigation] openPoolGroupDetail', { groupId, url })
  Taro.navigateTo({
    url,
    fail: (err) => {
      logWarn('[Navigation] navigateTo pool-group-detail failed', { error: err })
      Taro.showToast({ title: '跳转失败，请重试', icon: 'none', duration: 2000 })
    },
  })
}

/** Prefer after live-reveal so the user does not return to matching-status via back. */
export function replaceWithPoolGroupDetail(groupId: string): void {
  const url = buildPoolGroupDetailUrl(groupId)
  logInfo('[Navigation] replaceWithPoolGroupDetail', { groupId, url })
  Taro.redirectTo({
    url,
    fail: (err) => {
      logWarn('[Navigation] redirectTo pool-group-detail failed, falling back to navigateTo', { error: err })
      Taro.navigateTo({
        url,
        fail: (navErr) => {
          logWarn('[Navigation] navigateTo fallback for pool-group-detail failed', { error: navErr })
          Taro.showToast({ title: '跳转失败，请重试', icon: 'none', duration: 2000 })
        },
      })
    },
  })
}

/** Canonical URL for the squad unboxing (blind-box reveal) page. */
export function buildSquadUnboxingUrl(groupId: string): string {
  return `/subpackages/squad-unboxing/index?groupId=${encodeURIComponent(groupId)}`
}

export function openSquadUnboxing(groupId: string): void {
  const url = buildSquadUnboxingUrl(groupId)
  logInfo('[Navigation] openSquadUnboxing', { groupId, url })
  Taro.navigateTo({
    url,
    fail: (err) => {
      logWarn('[Navigation] navigateTo squad-unboxing failed', { error: err })
      Taro.showToast({ title: '跳转失败，请重试', icon: 'none', duration: 2000 })
    },
  })
}

/**
 * Prefer after live-reveal so the user does not return to matching-status via back.
 * Squad unboxing is a one-shot reveal; redirectTo keeps the stack clean.
 */
export function replaceWithSquadUnboxing(groupId: string): void {
  const url = buildSquadUnboxingUrl(groupId)
  logInfo('[Navigation] replaceWithSquadUnboxing', { groupId, url })
  Taro.redirectTo({
    url,
    fail: (err) => {
      logWarn('[Navigation] redirectTo squad-unboxing failed, falling back to navigateTo', { error: err })
      Taro.navigateTo({
        url,
        fail: (navErr) => {
          logWarn('[Navigation] navigateTo fallback for squad-unboxing failed', { error: navErr })
          Taro.showToast({ title: '跳转失败，请重试', icon: 'none', duration: 2000 })
        },
      })
    },
  })
}

export function switchToEventsTab(): void {
  Taro.switchTab({ url: '/pages/events/index' })
}

/** Prefer stack back; fall back to Events tab when there is no history (e.g. cold open). */
export function navigateBackOrEventsTab(): void {
  Taro.navigateBack({ fail: () => switchToEventsTab() })
}

export function switchToDiscoverTab(): void {
  Taro.switchTab({ url: '/pages/discover/index' })
}
