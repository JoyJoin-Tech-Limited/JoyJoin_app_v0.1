import Taro from '@tarojs/taro'

/**
 * Canonical URL for the matched pool-group detail page (post-match journey).
 * Kept in `lib/` so navigation side effects stay separate from view-model pure helpers.
 */
export function buildPoolGroupDetailUrl(groupId: string): string {
  return `/pages/pool-group-detail/index?groupId=${encodeURIComponent(groupId)}`
}

export function openPoolGroupDetail(groupId: string): void {
  Taro.navigateTo({ url: buildPoolGroupDetailUrl(groupId) })
}

/** Prefer after live-reveal so the user does not return to matching-status via back. */
export function replaceWithPoolGroupDetail(groupId: string): void {
  const url = buildPoolGroupDetailUrl(groupId)
  Taro.redirectTo({
    url,
    fail: () => {
      Taro.navigateTo({ url })
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
