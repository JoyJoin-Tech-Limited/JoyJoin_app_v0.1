import { beforeEach, describe, expect, it, vi } from 'vitest'
import Taro from '@tarojs/taro'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { NotificationListItem } from '@shared/api'
import {
  canNavigateNotification,
  navigateFromNotification,
  resolveNotificationDestination,
} from '../notificationNavigation'

const { getEventFeedbackStateMock, getPoolGroupDetailsMock, logWarnMock } = vi.hoisted(() => ({
  getEventFeedbackStateMock: vi.fn(),
  getPoolGroupDetailsMock: vi.fn(),
  logWarnMock: vi.fn(),
}))

vi.mock('@shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/api')>()
  return {
    ...actual,
    getEventFeedbackState: getEventFeedbackStateMock,
    getPoolGroupDetails: getPoolGroupDetailsMock,
  }
})

vi.mock('../../api/api', () => ({ apiRequest: vi.fn() }))
vi.mock('../../utils/logger', () => ({ logWarn: logWarnMock }))

function makeItem(overrides: Partial<NotificationListItem> = {}): NotificationListItem {
  return {
    id: 'notification-1',
    category: 'activities',
    type: 'match_success',
    title: '排桌完成',
    message: null,
    relatedResourceId: 'group-1',
    isRead: false,
    createdAt: '2026-11-06T08:00:00.000Z',
    ...overrides,
  }
}

describe('notificationNavigation destination matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getEventFeedbackStateMock.mockResolvedValue({ state: 'open' })
    getPoolGroupDetailsMock.mockResolvedValue({ groupId: 'group-real-42' })
    vi.mocked(Taro.navigateTo).mockResolvedValue({ errMsg: 'ok' })
    vi.mocked(Taro.switchTab).mockResolvedValue({ errMsg: 'ok' })
  })

  it('match_success routes its group id to pool-group-detail', async () => {
    const item = makeItem({ type: 'match_success', relatedResourceId: 'group / 同桌' })
    await expect(resolveNotificationDestination(item)).resolves.toEqual({
      method: 'navigateTo',
      url: `/pages/pool-group-detail/index?groupId=${encodeURIComponent('group / 同桌')}`,
    })
  })

  it('venue_tbd resolves a real groupId through room-state before opening pool-group-detail', async () => {
    const item = makeItem({ type: 'venue_tbd', relatedResourceId: 'group-real-42' })
    await expect(resolveNotificationDestination(item)).resolves.toEqual({
      method: 'navigateTo',
      url: '/pages/pool-group-detail/index?groupId=group-real-42',
    })
    expect(getPoolGroupDetailsMock).toHaveBeenCalledWith(expect.anything(), 'group-real-42')
  })

  it('persisted venue_tbd poolId falls back to event-detail only for an ApiError 404', async () => {
    getPoolGroupDetailsMock.mockRejectedValueOnce(
      Object.assign(new Error('Request failed with status 404'), { statusCode: 404 }),
    )
    const item = makeItem({ type: 'venue_tbd', relatedResourceId: 'pool-legacy-2026' })
    await expect(resolveNotificationDestination(item)).resolves.toEqual({
      method: 'navigateTo',
      url: '/pages/event-detail/index?id=pool-legacy-2026',
    })
    expect(getPoolGroupDetailsMock).toHaveBeenCalledWith(expect.anything(), 'pool-legacy-2026')
  })

  it('feedback_invite routes to event-feedback only when the server state is open', async () => {
    const item = makeItem({ type: 'feedback_invite', relatedResourceId: 'pool / 1' })
    await expect(resolveNotificationDestination(item)).resolves.toEqual({
      method: 'navigateTo',
      url: `/pages/event-feedback/index?id=${encodeURIComponent('pool / 1')}`,
    })
    expect(getEventFeedbackStateMock).toHaveBeenCalledWith(expect.anything(), 'pool / 1')
  })

  it.each(['locked', 'submitted', 'ineligible', 'closed'])(
    'feedback_invite falls back to event-detail for state %s',
    async (state) => {
      getEventFeedbackStateMock.mockResolvedValue({ state })
      const item = makeItem({ type: 'feedback_invite', relatedResourceId: 'pool-1' })
      await expect(resolveNotificationDestination(item)).resolves.toEqual({
        method: 'navigateTo',
        url: '/pages/event-detail/index?id=pool-1',
      })
    },
  )

  it('feedback_invite resolver failure falls back to event-detail without opening the form', async () => {
    getEventFeedbackStateMock.mockRejectedValue(new Error('resolver unavailable'))
    const item = makeItem({ type: 'feedback_invite', relatedResourceId: 'pool-1' })
    await expect(resolveNotificationDestination(item)).resolves.toEqual({
      method: 'navigateTo',
      url: '/pages/event-detail/index?id=pool-1',
    })
  })

  it('mutual_match targets the Connections tab', async () => {
    const item = makeItem({ type: 'mutual_match', relatedResourceId: 'event-1' })
    await expect(resolveNotificationDestination(item)).resolves.toEqual({
      method: 'switchTab',
      url: '/pages/connections/index',
    })
  })

  it.each(['event_reminder', 'pool_full'])('%s routes its resource id to event-detail', async (type) => {
    const item = makeItem({ type, relatedResourceId: 'event / 1' })
    await expect(resolveNotificationDestination(item)).resolves.toEqual({
      method: 'navigateTo',
      url: `/pages/event-detail/index?id=${encodeURIComponent('event / 1')}`,
    })
  })

  it.each(['subscription_activated', 'subscription_expiring', 'subscription_expired'])(
    '%s requires a subscription id and routes to Rewards',
    async (type) => {
      const item = makeItem({ type, relatedResourceId: 'subscription-1' })
      await expect(resolveNotificationDestination(item)).resolves.toEqual({
        method: 'navigateTo',
        url: '/pages/profile-linked/rewards/index',
      })
    },
  )

  it('unknown and missing-resource rows are read-only', async () => {
    const unknown = makeItem({ type: 'system_notice', relatedResourceId: 'resource-1' })
    const missing = makeItem({ relatedResourceId: null })
    const blank = makeItem({ relatedResourceId: '   ' })

    expect(canNavigateNotification(unknown)).toBe(false)
    expect(canNavigateNotification(missing)).toBe(false)
    expect(canNavigateNotification(blank)).toBe(false)
    await expect(resolveNotificationDestination(unknown)).resolves.toBeNull()
    await expect(resolveNotificationDestination(missing)).resolves.toBeNull()
    await expect(resolveNotificationDestination(blank)).resolves.toBeNull()
  })
})

describe('navigateFromNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getEventFeedbackStateMock.mockResolvedValue({ state: 'open' })
    getPoolGroupDetailsMock.mockResolvedValue({ groupId: 'group-real-42' })
    vi.mocked(Taro.navigateTo).mockResolvedValue({ errMsg: 'ok' })
    vi.mocked(Taro.switchTab).mockResolvedValue({ errMsg: 'ok' })
  })

  it('returns true only after navigateTo accepts the destination', async () => {
    await expect(navigateFromNotification(makeItem())).resolves.toBe(true)
    expect(Taro.navigateTo).toHaveBeenCalledWith({
      url: '/pages/pool-group-detail/index?groupId=group-1',
    })
    expect(Taro.showToast).not.toHaveBeenCalled()
  })

  it('uses switchTab for Connections and waits for acceptance', async () => {
    const item = makeItem({ type: 'mutual_match', relatedResourceId: 'event-1' })
    await expect(navigateFromNotification(item)).resolves.toBe(true)
    expect(Taro.switchTab).toHaveBeenCalledWith({ url: '/pages/connections/index' })
    expect(Taro.navigateTo).not.toHaveBeenCalled()
  })

  it.each([401, 403, 500])(
    'venue_tbd room-state %i error returns false without navigation or legacy fallback',
    async (statusCode) => {
      getPoolGroupDetailsMock.mockRejectedValueOnce(
        Object.assign(new Error('private upstream detail'), { statusCode }),
      )
      const item = makeItem({ type: 'venue_tbd', relatedResourceId: 'pool-legacy-2026' })

      await expect(navigateFromNotification(item)).resolves.toBe(false)
      expect(Taro.navigateTo).not.toHaveBeenCalled()
      expect(Taro.switchTab).not.toHaveBeenCalled()
      expect(Taro.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '暂时无法打开，请稍后重试', icon: 'none' }),
      )
      expect(logWarnMock).toHaveBeenCalledWith(
        '[Navigation] notification destination resolution failed',
        { notificationType: 'venue_tbd', statusCode },
      )
    },
  )

  it('venue_tbd network failure returns false without navigation and logs no sensitive detail', async () => {
    getPoolGroupDetailsMock.mockRejectedValueOnce(new Error('network down with private detail'))
    const item = makeItem({ type: 'venue_tbd', relatedResourceId: 'pool-legacy-2026' })

    await expect(navigateFromNotification(item)).resolves.toBe(false)
    expect(Taro.navigateTo).not.toHaveBeenCalled()
    expect(Taro.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '暂时无法打开，请稍后重试', icon: 'none' }),
    )
    expect(logWarnMock).toHaveBeenCalledWith(
      '[Navigation] notification destination resolution failed',
      { notificationType: 'venue_tbd', statusCode: undefined },
    )
  })

  it('returns false and shows safe feedback when navigation fails', async () => {
    vi.mocked(Taro.navigateTo).mockRejectedValueOnce(new Error('navigateTo:fail'))
    await expect(navigateFromNotification(makeItem())).resolves.toBe(false)
    expect(Taro.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '跳转失败，请重试', icon: 'none' }),
    )
  })

  it('uses unflagged group-details for venue_tbd disambiguation', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/navigation/notificationNavigation.ts'), 'utf8')
    expect(source).toContain('getPoolGroupDetails')
    expect(source).not.toContain('getPoolGroupRoomState')

    const sharedSource = readFileSync(resolve(process.cwd(), '../../packages/shared/src/api/eventPools.ts'), 'utf8')
    expect(sharedSource).toContain('`/api/pool-groups/${encodeURIComponent(groupId)}`')
  })

  it('fails closed without navigation or toast for a missing id', async () => {
    const item = makeItem({ relatedResourceId: null })
    await expect(navigateFromNotification(item)).resolves.toBe(false)
    expect(Taro.navigateTo).not.toHaveBeenCalled()
    expect(Taro.switchTab).not.toHaveBeenCalled()
    expect(Taro.showToast).not.toHaveBeenCalled()
  })
})
