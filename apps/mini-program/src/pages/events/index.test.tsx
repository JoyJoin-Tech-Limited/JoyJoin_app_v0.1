import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JoinedEventSummary } from '@shared/api'
import EventsPage from './index'
import { eventsAnalytics } from '../../lib/analytics/eventsAnalytics'
import { navigateToEventCard } from '../../lib/utils/eventCardNavigation'
import { queryClient } from '../../lib/api/queryClient'
import { JOINED_EVENTS_QUERY_KEY } from '../../lib/prefetchEngine'
import { evictPersistedQuery } from '../../lib/api/persistentCache'

const mocks = vi.hoisted(() => ({
  queryState: {
    data: [] as unknown[],
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  },
  didShow: null as null | (() => void),
  pullDownRefresh: null as null | (() => void),
  switchTab: vi.fn(),
  stopPullDownRefresh: vi.fn(),
  track: vi.fn(),
  trackCardTap: vi.fn(),
  navigateToEventCard: vi.fn(),
  invalidateQueries: vi.fn(),
  evictPersistedQuery: vi.fn(),
  shouldRefreshOnShow: vi.fn(),
  apiRequest: vi.fn(),
  fetchEventsShell: vi.fn(),
  getJoinedEvents: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    switchTab: mocks.switchTab,
    stopPullDownRefresh: mocks.stopPullDownRefresh,
  },
  useDidShow: (callback: () => void) => { mocks.didShow = callback },
  usePullDownRefresh: (callback: () => void) => { mocks.pullDownRefresh = callback },
}))

vi.mock('@tarojs/components', () => ({
  CustomWrapper: ({ children }: React.PropsWithChildren) => <>{children}</>,
  View: ({ children, hoverClass: _hoverClass, ...props }: React.HTMLAttributes<HTMLDivElement> & { hoverClass?: string }) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  ScrollView: ({ children, scrollY: _scrollY, enhanced: _enhanced, showScrollbar: _showScrollbar, ...props }: React.HTMLAttributes<HTMLDivElement> & { scrollY?: boolean; enhanced?: boolean; showScrollbar?: boolean }) => <div {...props}>{children}</div>,
  Image: ({ lazyLoad: _lazyLoad, mode: _mode, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { lazyLoad?: boolean; mode?: string }) => <img {...props} />,
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mocks.queryState,
}))

vi.mock('@shared/api', () => ({
  getJoinedEvents: mocks.getJoinedEvents,
}))

vi.mock('../../lib/api/api', () => ({
  apiRequest: mocks.apiRequest,
  fetchEventsShell: mocks.fetchEventsShell,
}))

vi.mock('../../lib/prefetchEngine', () => ({
  injectEventsShellIntoCache: vi.fn(),
  JOINED_EVENTS_QUERY_KEY: ['mini-program', 'joined-events'],
}))

vi.mock('../../lib/api/persistentCache', () => ({
  evictPersistedQuery: mocks.evictPersistedQuery,
}))

vi.mock('../../lib/api/queryClient', () => ({
  queryClient: { invalidateQueries: mocks.invalidateQueries },
}))

vi.mock('../../hooks/navigation/useMiniPageGate', () => ({
  useMiniPageGate: () => ({
    authLoading: false,
    renderGate: (node: React.ReactNode) => node,
  }),
}))

vi.mock('../../hooks/navigation/useCustomTabBarSync', () => ({
  useCustomTabBarSync: vi.fn(),
}))

vi.mock('../../lib/utils/tabEntranceState', () => ({
  consumeTabEntrance: () => false,
}))

vi.mock('../../lib/utils/showRefreshGate', () => ({
  shouldRefreshOnShow: mocks.shouldRefreshOnShow,
}))

vi.mock('../../lib/utils/routePreloadAssets', () => ({
  preloadRouteAssets: vi.fn(),
  preloadPredictiveAssets: vi.fn(),
}))

vi.mock('../../hooks/useCountdownTick', () => ({
  CountdownTickProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

vi.mock('../../lib/utils/cdnAssets', () => ({
  cdnAsset: (path: string) => path,
}))

vi.mock('../../components/ui/Card', () => ({
  default: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock('../../components/ui/StatusCard', () => ({
  default: ({ title, description, action, ...props }: React.HTMLAttributes<HTMLDivElement> & {
    title: string
    description: string
    action?: { label: string; onClick: () => void; variant?: string }
  }) => (
    <div {...props}>
      <span>{title}</span>
      <span>{description}</span>
      {action && <button type='button' onClick={action.onClick}>{action.label}</button>}
    </div>
  ),
}))

vi.mock('../../components/events/FootprintOracleCard', () => ({
  default: ({ event, onClick, isHistorical = false }: { event: JoinedEventSummary; onClick: (event: JoinedEventSummary) => void; isHistorical?: boolean }) => (
    <button
      type='button'
      data-testid={`event-card-${event.id}`}
      data-is-historical={isHistorical ? 'true' : 'false'}
      onClick={() => onClick(event)}
    >
      {event.title}
    </button>
  ),
}))

vi.mock('../../lib/milestoneBadges', () => ({
  MILESTONE_BADGES: { firstEvent: '/first-event.webp' },
}))

vi.mock('../../lib/utils/longListThreshold', () => ({
  isLongListRowCount: () => false,
  MINI_PROGRAM_LONG_LIST_ROW_THRESHOLD: 50,
}))

vi.mock('../../lib/utils/logger', () => ({ logWarn: vi.fn() }))
vi.mock('../../lib/utils/haptics', () => ({ haptics: vi.fn() }))
vi.mock('../../hooks/useDeviceTier', () => ({ useDeviceTier: () => ({ isDegradation: false }) }))
vi.mock('../../lib/analytics/eventsAnalytics', () => ({
  eventsAnalytics: { track: mocks.track, trackCardTap: mocks.trackCardTap },
}))
vi.mock('../../lib/utils/eventCardNavigation', () => ({
  navigateToEventCard: mocks.navigateToEventCard,
}))

function makeEvent(
  id: string,
  status: string,
  dateTime?: string,
  overrides: Partial<JoinedEventSummary> = {},
): JoinedEventSummary {
  return { id, title: id, status, dateTime, ...overrides }
}

function setQueryState(
  events: JoinedEventSummary[],
  overrides: Partial<Pick<typeof mocks.queryState, 'isLoading' | 'isFetching' | 'isError'>> = {},
) {
  mocks.queryState.data = events
  mocks.queryState.isLoading = overrides.isLoading ?? false
  mocks.queryState.isFetching = overrides.isFetching ?? false
  mocks.queryState.isError = overrides.isError ?? false
}

function renderEvents(events: JoinedEventSummary[]) {
  setQueryState(events)
  return render(<EventsPage />)
}

function getTab(label: string): HTMLElement {
  const tab = screen.getByText(label).closest('.events-page__tab')
  if (!tab) throw new Error(`Missing Events tab: ${label}`)
  return tab as HTMLElement
}

function expectActiveTab(label: string) {
  expect(getTab(label).className).toContain('events-page__tab--active')
}

describe('EventsPage three-bucket IA', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-13T12:00:00+08:00'))
    mocks.didShow = null
    mocks.pullDownRefresh = null
    mocks.shouldRefreshOnShow.mockReturnValue(true)
    mocks.apiRequest.mockResolvedValue({ success: true })
    setQueryState([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders exact labels and defaults to upcoming when it is populated', () => {
    const { container } = renderEvents([
      makeEvent('upcoming', 'confirmed', '2026-04-14T19:30:00+08:00'),
      makeEvent('ongoing', 'matched', '2026-04-14T19:30:00+08:00'),
    ])

    expect(container.querySelector('.events-page__tabs')?.textContent).toBe('进行中待开始已结束')
    expect(container.querySelector('.events-page__tabs')).toHaveAttribute('role', 'tablist')
    expect(getTab('待开始')).toHaveAttribute('role', 'tab')
    expect(getTab('待开始')).toHaveAttribute('aria-selected', 'true')
    expect(getTab('进行中')).toHaveAttribute('aria-selected', 'false')
    expectActiveTab('待开始')
    expect(screen.getByTestId('event-card-upcoming')).toBeInTheDocument()
    expect(screen.queryByTestId('event-card-ongoing')).not.toBeInTheDocument()
  })

  it('falls back to ongoing when upcoming is empty and preserves the first-event hero', () => {
    const { container } = renderEvents([
      makeEvent('ongoing', 'matched', '2026-04-14T19:30:00+08:00'),
    ])

    expectActiveTab('进行中')
    expect(screen.getByTestId('event-card-ongoing')).toBeInTheDocument()
    expect(container.querySelector('.events-page__first-event-hero')).toBeInTheDocument()
    expect(screen.getByText('第一次活动，期待与你相遇！')).toBeInTheDocument()
  })

  it('shows the first-event hero only while its bucket is visible', () => {
    const { container } = renderEvents([
      makeEvent('upcoming', 'confirmed', '2026-04-14T19:30:00+08:00'),
    ])

    expect(container.querySelector('.events-page__first-event-hero')).toBeInTheDocument()
    fireEvent.click(getTab('进行中'))
    expect(container.querySelector('.events-page__first-event-hero')).not.toBeInTheDocument()
    fireEvent.click(getTab('已结束'))
    expect(container.querySelector('.events-page__first-event-hero')).not.toBeInTheDocument()
    fireEvent.click(getTab('待开始'))
    expect(container.querySelector('.events-page__first-event-hero')).toBeInTheDocument()
  })

  it('never shows the anticipation hero for raw matched with derived cancelled status', () => {
    const { container } = renderEvents([
      makeEvent('derived-cancelled', 'matched', '2026-04-14T19:30:00+08:00', {
        displayStatus: 'cancelled',
      }),
    ])

    expectActiveTab('已结束')
    expect(container.querySelector('.events-page__first-event-hero')).not.toBeInTheDocument()
    expect(screen.queryByText('第一次活动，期待与你相遇！')).not.toBeInTheDocument()
  })

  it('falls back to completed when it is the only populated bucket', () => {
    renderEvents([
      makeEvent('completed', 'cancelled', '2026-04-14T19:30:00+08:00'),
    ])

    expectActiveTab('已结束')
    expect(screen.getByTestId('event-card-completed')).toBeInTheDocument()
  })

  it('remains on upcoming when every bucket is empty', () => {
    renderEvents([])

    expectActiveTab('待开始')
    expect(screen.getByText('暂无待开始的活动')).toBeInTheDocument()
  })

  it('never applies fallback after manual selection, including query updates and refresh', () => {
    const view = renderEvents([
      makeEvent('upcoming', 'confirmed', '2026-04-14T19:30:00+08:00'),
      makeEvent('ongoing', 'matched', '2026-04-14T19:30:00+08:00'),
    ])

    fireEvent.click(getTab('已结束'))
    expectActiveTab('已结束')
    expect(screen.getByText('暂无已结束的活动')).toBeInTheDocument()

    setQueryState([makeEvent('upcoming-new', 'confirmed', '2026-04-15T19:30:00+08:00')])
    view.rerender(<EventsPage />)
    expectActiveTab('已结束')

    fireEvent.click(getTab('进行中'))
    expectActiveTab('进行中')
    expect(screen.getByText('暂无进行中的活动')).toBeInTheDocument()

    act(() => { mocks.pullDownRefresh?.() })
    expectActiveTab('进行中')
    expect(eventsAnalytics.track).toHaveBeenCalledWith('events_pull_refresh')
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['mini-program', 'joined-events'] })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['mini-program', 'shell/events'] })
    expect(evictPersistedQuery).toHaveBeenCalledWith(JOINED_EVENTS_QUERY_KEY)

    act(() => { vi.advanceTimersByTime(800) })
    expect(mocks.stopPullDownRefresh).toHaveBeenCalledTimes(1)
    expectActiveTab('进行中')
  })

  it('uses distinct truthful empty copy for every bucket', () => {
    const { container } = renderEvents([])
    const copies: string[] = []

    for (const [tab, title, description] of [
      ['待开始', '暂无待开始的活动', '这里会列出待开始的活动安排。'],
      ['进行中', '暂无进行中的活动', '这里会列出今天的活动和正在推进的报名。'],
      ['已结束', '暂无已结束的活动', '这里会保留已经结束的活动记录。'],
    ]) {
      fireEvent.click(getTab(tab))
      expect(screen.getByText(title)).toBeInTheDocument()
      expect(screen.getByText(description)).toBeInTheDocument()
      const copy = container.querySelector('.events-page__empty-state')?.textContent ?? ''
      copies.push(copy)
      expect(copy).not.toMatch(/出席|到场|在场|支付|付款|退款|待处理|待完成|需要去|请完成|已完成评价|已评价/)
    }

    expect(new Set(copies).size).toBe(3)
  })

  it('retains loading and error states with a working retry', () => {
    setQueryState([], { isLoading: true })
    const view = render(<EventsPage />)
    expect(view.container.querySelector('.events-page__list > .events-page__list-content')).toBeInTheDocument()
    expect(view.container.querySelectorAll('.events-page__card--skeleton')).toHaveLength(3)

    setQueryState([], { isError: true })
    view.rerender(<EventsPage />)
    expect(screen.getByText('加载失败')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(mocks.queryState.refetch).toHaveBeenCalledTimes(1)
  })

  it('tracks and navigates an ongoing card through the existing helpers', () => {
    const event = makeEvent('ongoing', 'matched', '2026-04-14T19:30:00+08:00', {
      registrationId: 'registration-1',
    })
    renderEvents([event])

    fireEvent.click(screen.getByTestId('event-card-ongoing'))

    expect(eventsAnalytics.trackCardTap).toHaveBeenCalledWith(event, 'ongoing')
    expect(navigateToEventCard).toHaveBeenCalledWith(event, { isHistorical: false })
  })

  it('passes historical context for a past-day nonterminal completed card', () => {
    const event = makeEvent('past-pending', 'pending', '2026-04-12T19:30:00+08:00', {
      registrationId: 'registration-past',
    })
    const originalEvent = { ...event }
    const { container } = renderEvents([event])
    const card = screen.getByTestId('event-card-past-pending')

    expectActiveTab('已结束')
    expect(card).toHaveAttribute('data-is-historical', 'true')
    expect(container.querySelector('.events-page__first-event-hero')).not.toBeInTheDocument()
    fireEvent.click(card)

    expect(eventsAnalytics.trackCardTap).toHaveBeenCalledWith(event, 'completed')
    expect(navigateToEventCard).toHaveBeenCalledWith(event, { isHistorical: true })
    expect(event).toEqual(originalEvent)
  })

  it('serializes ongoing tab analytics without changing existing event metadata', async () => {
    const actual = await vi.importActual<typeof import('../../lib/analytics/eventsAnalytics')>(
      '../../lib/analytics/eventsAnalytics',
    )
    const event = makeEvent('analytics-event', 'confirmed', '2026-04-14T19:30:00+08:00', {
      eventType: 'dining',
    })

    actual.eventsAnalytics.track('events_tab_switch', { tab: 'ongoing' })
    actual.eventsAnalytics.trackCardTap(event, 'ongoing')

    expect(mocks.apiRequest).toHaveBeenCalledTimes(2)
    const firstPayload = mocks.apiRequest.mock.calls[0][0] as Record<string, unknown>
    const secondPayload = mocks.apiRequest.mock.calls[1][0] as Record<string, unknown>
    expect(firstPayload).toMatchObject({
      path: '/api/analytics/events',
      method: 'POST',
      handleUnauthorized: false,
      data: {
        eventType: 'events_tab_switch',
        metadata: { tab: 'ongoing' },
        timestamp: expect.any(Number),
      },
    })
    expect(secondPayload).toMatchObject({
      path: '/api/analytics/events',
      method: 'POST',
      handleUnauthorized: false,
      data: {
        eventType: 'events_card_tap',
        metadata: {
          eventId: event.id,
          tab: 'ongoing',
          status: event.status,
          eventType: event.eventType,
          cardVersion: 'footprint_oracle_v1',
        },
        timestamp: expect.any(Number),
      },
    })
  })
})
