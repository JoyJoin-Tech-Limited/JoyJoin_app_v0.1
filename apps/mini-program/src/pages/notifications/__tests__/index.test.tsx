import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PropsWithChildren } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { InfiniteData, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Taro from '@tarojs/taro'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotificationListItem, NotificationListResponse } from '@shared/api'
import NotificationsPage, { NOTIFICATIONS_LIST_QUERY_KEY } from '../index'
import { NOTIFICATION_COUNTS_KEY } from '../../../hooks/useNotificationCounts'
import { haptics } from '../../../lib/utils/haptics'

const {
  getNotificationsMock,
  getEventFeedbackStateMock,
  getPoolGroupDetailsMock,
  markNotificationReadMock,
  markNotificationsAsReadMock,
} = vi.hoisted(() => ({
  getNotificationsMock: vi.fn(),
  getEventFeedbackStateMock: vi.fn(),
  getPoolGroupDetailsMock: vi.fn(),
  markNotificationReadMock: vi.fn(),
  markNotificationsAsReadMock: vi.fn(),
}))

vi.mock('@shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/api')>()
  return {
    ...actual,
    getNotifications: getNotificationsMock,
    getEventFeedbackState: getEventFeedbackStateMock,
    getPoolGroupDetails: getPoolGroupDetailsMock,
    markNotificationRead: markNotificationReadMock,
    markNotificationsAsRead: markNotificationsAsReadMock,
  }
})

vi.mock('../../../lib/api/api', () => ({ apiRequest: vi.fn() }))
vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))
vi.mock('@tarojs/components', () => ({
  View: ({ hoverClass, ...props }: Record<string, unknown>) => (
    <div data-hover-class={hoverClass as string | undefined} {...props} />
  ),
  Text: (props: Record<string, unknown>) => <span {...props} />,
  ScrollView: ({ children }: PropsWithChildren) => <div>{children}</div>,
}))
vi.mock('../../../components/mascot/XiaoyueEmptyState', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}))
vi.mock('../../../components/ui/JoyJoinIcon', () => ({ default: () => null }))
vi.mock('../../../components/loading/LoadingScreen', () => ({
  default: ({ message }: { message: string }) => <div>{message}</div>,
}))

type NotificationListData = InfiniteData<NotificationListResponse>

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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function cachedItems(queryClient: QueryClient): NotificationListItem[] {
  const data = queryClient.getQueryData<NotificationListData>(NOTIFICATIONS_LIST_QUERY_KEY)
  return data?.pages.flatMap((page) => page.items) ?? []
}

function renderPage(items: NotificationListItem[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
  const initialData: NotificationListData = {
    pages: [{ items, nextCursor: null }],
    pageParams: [undefined],
  }
  queryClient.setQueryData(NOTIFICATIONS_LIST_QUERY_KEY, initialData)
  queryClient.setQueryData(NOTIFICATION_COUNTS_KEY, {
    activities: items.filter((item) => item.category === 'activities' && !item.isRead).length,
    discover: items.filter((item) => item.category === 'discover' && !item.isRead).length,
    chat: items.filter((item) => item.category === 'chat' && !item.isRead).length,
    total: items.filter((item) => !item.isRead).length,
  })
  getNotificationsMock.mockResolvedValue({ items, nextCursor: null })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(() => Promise.resolve())
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <NotificationsPage />
    </QueryClientProvider>,
  )
  return { ...rendered, queryClient, invalidateSpy }
}

describe('NotificationsPage row navigation and read semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(Taro.navigateTo).mockResolvedValue({ errMsg: 'ok' })
    vi.mocked(Taro.switchTab).mockResolvedValue({ errMsg: 'ok' })
    getEventFeedbackStateMock.mockResolvedValue({ state: 'open' })
    getPoolGroupDetailsMock.mockResolvedValue({ groupId: 'group-real-42' })
    markNotificationReadMock.mockResolvedValue({ success: true })
    markNotificationsAsReadMock.mockResolvedValue({ success: true })
  })

  it('gives mapped rows whole-row affordances while unknown and missing-id rows stay inert', () => {
    const mapped = makeItem()
    const unknown = makeItem({ id: 'notification-2', type: 'system_notice', title: '系统通知' })
    const missing = makeItem({ id: 'notification-3', title: '缺少资源', relatedResourceId: null })
    const { container } = renderPage([mapped, unknown, missing])
    const rows = container.querySelectorAll('.notifications-page__row')

    expect(rows[0].getAttribute('role')).toBe('button')
    expect(rows[0].getAttribute('aria-label')).toContain(mapped.title)
    expect(rows[0].getAttribute('data-hover-class')).toBe('notifications-page__row--pressed')
    expect(rows[0].querySelector('.notifications-page__row-chevron')).not.toBeNull()

    for (const row of [rows[1], rows[2]]) {
      expect(row.getAttribute('role')).toBeNull()
      expect(row.getAttribute('data-hover-class')).toBeNull()
      expect(row.querySelector('.notifications-page__row-chevron')).toBeNull()
      fireEvent.click(row)
    }
    expect(haptics).not.toHaveBeenCalled()
    expect(Taro.navigateTo).not.toHaveBeenCalled()
    expect(Taro.showToast).not.toHaveBeenCalled()
    expect(markNotificationReadMock).not.toHaveBeenCalled()
  })

  it('marks only the opened row after accepted navigation and server-confirmed read', async () => {
    const first = makeItem()
    const other = makeItem({ id: 'notification-2', title: '保留未读' })
    const navigation = deferred<{ errMsg: string }>()
    const read = deferred<{ success: boolean }>()
    vi.mocked(Taro.navigateTo).mockImplementationOnce(() => navigation.promise)
    markNotificationReadMock.mockImplementationOnce(() => read.promise)
    const { container, queryClient, invalidateSpy } = renderPage([first, other])
    const row = container.querySelector('.notifications-page__row')!

    fireEvent.click(row)
    expect(haptics).toHaveBeenCalledWith('light')
    expect(markNotificationReadMock).not.toHaveBeenCalled()

    await act(async () => {
      navigation.resolve({ errMsg: 'ok' })
      await Promise.resolve()
    })
    await waitFor(() => expect(markNotificationReadMock).toHaveBeenCalledWith(expect.anything(), first.id))
    expect(cachedItems(queryClient).every((item) => !item.isRead)).toBe(true)
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: NOTIFICATION_COUNTS_KEY })

    await act(async () => {
      read.resolve({ success: true })
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(cachedItems(queryClient).find((item) => item.id === first.id)?.isRead).toBe(true)
    })
    expect(cachedItems(queryClient).find((item) => item.id === other.id)?.isRead).toBe(false)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: NOTIFICATION_COUNTS_KEY })
  })

  it('keeps a persisted venue_tbd poolId unread when group-details fails with a non-404 error', async () => {
    getPoolGroupDetailsMock.mockRejectedValueOnce(
      Object.assign(new Error('private upstream detail'), { statusCode: 500 }),
    )
    const item = makeItem({ type: 'venue_tbd', relatedResourceId: 'pool-legacy-2026' })
    const { container, queryClient, invalidateSpy } = renderPage([item])

    fireEvent.click(container.querySelector('.notifications-page__row')!)
    await waitFor(() => {
      expect(Taro.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '暂时无法打开，请稍后重试', icon: 'none' }),
      )
    })
    expect(Taro.navigateTo).not.toHaveBeenCalled()
    expect(markNotificationReadMock).not.toHaveBeenCalled()
    expect(cachedItems(queryClient)[0].isRead).toBe(false)
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: NOTIFICATION_COUNTS_KEY })
  })

  it('marks a persisted venue_tbd poolId read only after the 404 fallback navigation is accepted', async () => {
    getPoolGroupDetailsMock.mockRejectedValueOnce(
      Object.assign(new Error('Request failed with status 404'), { statusCode: 404 }),
    )
    const navigation = deferred<{ errMsg: string }>()
    vi.mocked(Taro.navigateTo).mockImplementationOnce(() => navigation.promise)
    const item = makeItem({ type: 'venue_tbd', relatedResourceId: 'pool-legacy-2026' })
    const { container, queryClient } = renderPage([item])

    fireEvent.click(container.querySelector('.notifications-page__row')!)
    await waitFor(() => expect(getPoolGroupDetailsMock).toHaveBeenCalledWith(expect.anything(), item.relatedResourceId))
    expect(markNotificationReadMock).not.toHaveBeenCalled()
    expect(cachedItems(queryClient)[0].isRead).toBe(false)

    await act(async () => {
      navigation.resolve({ errMsg: 'ok' })
      await Promise.resolve()
    })
    await waitFor(() => expect(markNotificationReadMock).toHaveBeenCalledWith(expect.anything(), item.id))
    expect(Taro.navigateTo).toHaveBeenCalledWith({
      url: '/pages/event-detail/index?id=pool-legacy-2026',
    })
    await waitFor(() => expect(cachedItems(queryClient)[0].isRead).toBe(true))
  })

  it('leaves the row unread and shows safe feedback when navigation fails', async () => {
    vi.mocked(Taro.navigateTo).mockRejectedValueOnce(new Error('navigateTo:fail'))
    const { container, queryClient, invalidateSpy } = renderPage([makeItem()])

    fireEvent.click(container.querySelector('.notifications-page__row')!)
    await waitFor(() => {
      expect(Taro.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '跳转失败，请重试', icon: 'none' }),
      )
    })
    expect(markNotificationReadMock).not.toHaveBeenCalled()
    expect(cachedItems(queryClient)[0].isRead).toBe(false)
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: NOTIFICATION_COUNTS_KEY })
  })

  it('retains unread cache and badges when per-item read is not confirmed after navigation', async () => {
    markNotificationReadMock.mockResolvedValueOnce({ success: false })
    const { container, queryClient, invalidateSpy } = renderPage([makeItem()])

    fireEvent.click(container.querySelector('.notifications-page__row')!)
    await waitFor(() => {
      expect(Taro.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '已打开，暂未标为已读', icon: 'none' }),
      )
    })
    expect(cachedItems(queryClient)[0].isRead).toBe(false)
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: NOTIFICATION_COUNTS_KEY })
  })

  it('clears only the successful category, preserves other rows, and disables mark-all while pending', async () => {
    const pendingRead = deferred<{ success: boolean }>()
    markNotificationsAsReadMock.mockImplementationOnce(() => pendingRead.promise)
    const activity = makeItem()
    const secondActivity = makeItem({ id: 'notification-2', title: '第二条活动' })
    const discover = makeItem({ id: 'notification-3', category: 'discover', title: '发现消息' })
    const { queryClient, invalidateSpy } = renderPage([activity, secondActivity, discover])

    const button = screen.getByRole('button', { name: '活动全部已读' })
    fireEvent.click(button)
    await waitFor(() => expect(markNotificationsAsReadMock).toHaveBeenCalledWith(expect.anything(), 'activities'))
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(cachedItems(queryClient).every((item) => !item.isRead)).toBe(true)
    expect(queryClient.getQueryData(NOTIFICATION_COUNTS_KEY)).toEqual({
      activities: 2,
      discover: 1,
      chat: 0,
      total: 3,
    })

    fireEvent.click(button)
    expect(markNotificationsAsReadMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      pendingRead.resolve({ success: true })
      await Promise.resolve()
    })
    await waitFor(() => {
      expect(
        cachedItems(queryClient)
          .filter((item) => item.category === 'activities')
          .every((item) => item.isRead),
      ).toBe(true)
    })
    expect(cachedItems(queryClient).find((item) => item.id === discover.id)?.isRead).toBe(false)
    expect(queryClient.getQueryData(NOTIFICATION_COUNTS_KEY)).toEqual({
      activities: 0,
      discover: 1,
      chat: 0,
      total: 1,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: NOTIFICATIONS_LIST_QUERY_KEY })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: NOTIFICATION_COUNTS_KEY })
  })

  it('keeps list and badge state unchanged when category mark-all fails', async () => {
    markNotificationsAsReadMock.mockRejectedValueOnce(new Error('category read failed'))
    const { queryClient, invalidateSpy } = renderPage([makeItem()])

    fireEvent.click(screen.getByRole('button', { name: '活动全部已读' }))
    await waitFor(() => {
      expect(Taro.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '暂时无法标记，请重试', icon: 'none' }),
      )
    })
    expect(cachedItems(queryClient)[0].isRead).toBe(false)
    expect(queryClient.getQueryData(NOTIFICATION_COUNTS_KEY)).toEqual({
      activities: 1,
      discover: 0,
      chat: 0,
      total: 1,
    })
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: NOTIFICATIONS_LIST_QUERY_KEY })
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: NOTIFICATION_COUNTS_KEY })
  })

  it('does not auto-mark any category on unmount', () => {
    const { unmount } = renderPage([makeItem()])
    unmount()
    expect(markNotificationReadMock).not.toHaveBeenCalled()
    expect(markNotificationsAsReadMock).not.toHaveBeenCalled()
  })
})

describe('tab entry auto-read removal', () => {
  it.each(['events', 'discover', 'connections'])('%s has no entry-surface notification mutation', (page) => {
    const source = readFileSync(resolve(__dirname, `../../${page}/index.tsx`), 'utf8')
    expect(source).not.toContain('useMarkNotificationsAsRead')
    expect(source).not.toContain('hasMarkedRef')
    expect(source).not.toContain('markAsRead')
  })
})
