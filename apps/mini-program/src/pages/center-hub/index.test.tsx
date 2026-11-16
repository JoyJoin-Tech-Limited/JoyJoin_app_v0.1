import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JoinedEventSummary } from '@shared/api'
import CenterHubPage from './index'
import { eventsAnalytics } from '../../lib/analytics/eventsAnalytics'
import { navigateToEventCard } from '../../lib/utils/eventCardNavigation'
import { haptics } from '../../lib/utils/haptics'

const mocks = vi.hoisted(() => ({
  queryState: {
    data: [] as unknown[],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  },
  didShow: null as null | (() => void),
  switchTab: vi.fn(),
  reLaunch: vi.fn(),
  navigateTo: vi.fn(),
  track: vi.fn(),
  trackCardTap: vi.fn(),
  navigateToEventCard: vi.fn(),
  markNotificationRead: vi.fn(),
  markNotificationsAsRead: vi.fn(),
  getJoinedEvents: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    switchTab: mocks.switchTab,
    reLaunch: mocks.reLaunch,
    navigateTo: mocks.navigateTo,
  },
  useDidShow: (callback: () => void) => { mocks.didShow = callback },
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: React.HTMLAttributes<HTMLDivElement> & { hoverClass?: string }) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  Image: ({ lazyLoad: _lazyLoad, mode: _mode, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { lazyLoad?: boolean; mode?: string }) => <img {...props} />,
  ScrollView: ({ children, scrollY: _scrollY, enableFlex: _enableFlex, scrollWithAnimation: _scrollWithAnimation, ...props }: React.HTMLAttributes<HTMLDivElement> & { scrollY?: boolean; enableFlex?: boolean; scrollWithAnimation?: boolean }) => <div {...props}>{children}</div>,
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mocks.queryState,
}))

vi.mock('@shared/api', () => ({
  getJoinedEvents: mocks.getJoinedEvents,
  markNotificationRead: mocks.markNotificationRead,
  markNotificationsAsRead: mocks.markNotificationsAsRead,
}))

vi.mock('../../lib/api/api', () => ({ apiRequest: vi.fn() }))
vi.mock('../../lib/utils/haptics', () => ({ haptics: vi.fn() }))
vi.mock('../../lib/utils/tabEntranceState', () => ({ consumeTabEntrance: () => false }))
vi.mock('../../lib/utils/routePreloadAssets', () => ({
  preloadRouteAssets: vi.fn(),
  preloadPredictiveAssets: vi.fn(),
}))
vi.mock('../../lib/utils/cdnAssets', () => ({ cdnAsset: (path: string) => path }))

vi.mock('../../hooks/navigation/useMiniPageGate', () => ({
  useMiniPageGate: () => ({
    authLoading: false,
    renderGate: (node: React.ReactNode) => node,
  }),
}))

vi.mock('../../hooks/navigation/useCustomTabBarSync', () => ({
  useCustomTabBarSync: vi.fn(),
}))

vi.mock('../../components/ui/Button', () => ({
  default: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}))

vi.mock('../../components/mascot/XiaoyueEmptyState', () => ({
  default: ({ title, subtitle, actionLabel, onAction, variant, emotion }: {
    title: string
    subtitle?: string
    actionLabel?: string
    onAction?: () => void
    variant?: string
    emotion?: string
  }) => (
    <div data-testid='center-hub-empty-state' data-variant={variant} data-emotion={emotion}>
      <span>{title}</span>
      {subtitle && <span>{subtitle}</span>}
      {actionLabel && onAction && <button type='button' onClick={onAction}>{actionLabel}</button>}
    </div>
  ),
}))

vi.mock('../../components/loading/LoadingScreen', () => ({
  default: ({ message }: { message: string }) => <div>{message}</div>,
}))

vi.mock('../../components/ui/PageMorphWrapper', () => ({
  default: ({ isLoading, loading, content }: { isLoading: boolean; loading: React.ReactNode; content: React.ReactNode }) => (
    <>{isLoading ? loading : content}</>
  ),
}))

vi.mock('../../components/events/FootprintOracleCard', () => ({
  default: ({ event, onClick, isHistorical = false }: { event: JoinedEventSummary; onClick: (event: JoinedEventSummary, entry: 'sealed' | 'revealed' | 'none') => void; isHistorical?: boolean }) => (
    <button
      type='button'
      data-testid={`event-card-${event.id}`}
      data-is-historical={isHistorical ? 'true' : 'false'}
      onClick={() => onClick(event, 'none')}
    >
      {event.title}
    </button>
  ),
}))

vi.mock('../../hooks/useCountdownTick', () => ({
  CountdownTickProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

vi.mock('../../lib/mascot/xiaoyueExpressions', () => ({
  getXiaoyueExpressionAsset: () => '/xiaoyue.webp',
}))

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
  overrides: Partial<Pick<typeof mocks.queryState, 'isLoading' | 'isError'>> = {},
) {
  mocks.queryState.data = events
  mocks.queryState.isLoading = overrides.isLoading ?? false
  mocks.queryState.isError = overrides.isError ?? false
}

function renderCenterHub(events: JoinedEventSummary[]) {
  setQueryState(events)
  return render(<CenterHubPage />)
}

function getTab(label: string): HTMLElement {
  const tab = screen.getByText(label).closest('.event-status-tabs__tab')
  if (!tab) throw new Error(`Missing Center Hub tab: ${label}`)
  return tab as HTMLElement
}

function expectActiveTab(label: string) {
  expect(getTab(label).className).toContain('event-status-tabs__tab--active')
}

describe('CenterHubPage three-bucket IA', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-13T12:00:00+08:00'))
    mocks.didShow = null
    setQueryState([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fresh-mounts on ongoing and never auto-switches when that bucket is empty', () => {
    const { container } = renderCenterHub([
      makeEvent('upcoming', 'confirmed', '2026-04-14T19:30:00+08:00'),
    ])

    expect(container.querySelector('.event-status-tabs')?.textContent).toBe('进行中待开始已结束')
    expect(container.querySelector('.event-status-tabs')).toHaveAttribute('role', 'tablist')
    expect(getTab('进行中')).toHaveAttribute('role', 'tab')
    expect(getTab('进行中')).toHaveAttribute('aria-selected', 'true')
    expect(getTab('待开始')).toHaveAttribute('aria-selected', 'false')
    expectActiveTab('进行中')
    expect(screen.getByText('此刻，还没有进行中的活动')).toBeInTheDocument()
    expect(screen.getByTestId('center-hub-empty-state')).toHaveAttribute('data-variant', 'editorial')
    expect(screen.getByTestId('center-hub-empty-state')).toHaveAttribute('data-emotion', 'events')
    expect(container.querySelector('.center-hub__empty-hero')).toBeNull()
    expect(screen.queryByTestId('event-card-upcoming')).not.toBeInTheDocument()
    expect(mocks.reLaunch).not.toHaveBeenCalled()
  })

  it('preserves manual selection across explicit useDidShow re-show and center-tab re-tap', () => {
    renderCenterHub([
      makeEvent('ongoing', 'matched', '2026-04-14T19:30:00+08:00'),
      makeEvent('upcoming', 'confirmed', '2026-04-14T19:30:00+08:00'),
      makeEvent('completed', 'cancelled', '2026-04-14T19:30:00+08:00'),
    ])

    fireEvent.click(getTab('已结束'))
    expectActiveTab('已结束')
    expect(screen.getByTestId('event-card-completed')).toBeInTheDocument()

    act(() => { mocks.didShow?.() })
    expectActiveTab('已结束')
    act(() => { mocks.didShow?.() })
    expectActiveTab('已结束')
    expect(mocks.markNotificationRead).not.toHaveBeenCalled()
    expect(mocks.markNotificationsAsRead).not.toHaveBeenCalled()
  })

  it('preserves manual selection across query updates instead of falling back to populated buckets', () => {
    const view = renderCenterHub([
      makeEvent('ongoing', 'matched', '2026-04-14T19:30:00+08:00'),
      makeEvent('completed', 'cancelled', '2026-04-14T19:30:00+08:00'),
    ])

    fireEvent.click(getTab('已结束'))
    setQueryState([
      makeEvent('ongoing-new', 'matched', '2026-04-15T19:30:00+08:00'),
      makeEvent('upcoming-new', 'confirmed', '2026-04-15T19:30:00+08:00'),
    ])
    view.rerender(<CenterHubPage />)

    expectActiveTab('已结束')
    expect(screen.getByText('第一段回忆，等你写下')).toBeInTheDocument()
    expect(screen.queryByTestId('event-card-ongoing-new')).not.toBeInTheDocument()
  })

  it('uses distinct truthful empty copy for every bucket', () => {
    const { container } = renderCenterHub([])
    const copies: string[] = []

    for (const [tab, title, subtitle] of [
      ['进行中', '此刻，还没有进行中的活动', '活动有进展时，会在这里告诉你。'],
      ['待开始', '还没有待开始的活动', '有新的安排时，会在这里告诉你。'],
      ['已结束', '第一段回忆，等你写下', '活动结束后，可以在这里回看足迹。'],
    ]) {
      fireEvent.click(getTab(tab))
      expect(screen.getByText(title)).toBeInTheDocument()
      expect(screen.getByText(subtitle)).toBeInTheDocument()
      const copy = container.querySelector('.center-hub__state--empty')?.textContent ?? ''
      copies.push(copy)
      expect(copy).not.toMatch(/出席|到场|在场|支付|付款|退款|待处理|待完成|需要去|请完成|已完成评价|已评价/)
    }

    expect(new Set(copies).size).toBe(3)
  })

  it('keeps the empty CTA haptic and Discover navigation in the page handler', () => {
    renderCenterHub([])

    fireEvent.click(screen.getByRole('button', { name: '去探索活动' }))
    expect(haptics).toHaveBeenCalledTimes(1)
    expect(haptics).toHaveBeenCalledWith('light')
    expect(mocks.switchTab).toHaveBeenCalledTimes(1)
    expect(mocks.switchTab).toHaveBeenCalledWith({ url: '/pages/discover/index' })
  })

  it('retains loading and error states and retries through the existing query', () => {
    setQueryState([], { isLoading: true })
    const view = render(<CenterHubPage />)
    expect(screen.getByText('正在加载你的活动…')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.queryByTestId('center-hub-empty-state')).not.toBeInTheDocument()
    expectActiveTab('进行中')

    setQueryState([], { isError: true })
    view.rerender(<CenterHubPage />)
    expect(screen.getByRole('alert')).toHaveTextContent('暂时没拿到活动状态')
    expect(screen.queryByTestId('center-hub-empty-state')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }))
    expect(mocks.queryState.refetch).toHaveBeenCalledTimes(1)
    expect(mocks.reLaunch).not.toHaveBeenCalled()
  })

  it('renders ongoing cards without a first-event hero and uses shared card navigation', () => {
    const event = makeEvent('ongoing', 'matched', '2026-04-14T19:30:00+08:00', {
      registrationId: 'registration-1',
    })
    const { container } = renderCenterHub([event])

    expect(container.querySelector('.center-hub__list > .center-hub__list-content')).toBeInTheDocument()
    expect(screen.getByTestId('event-card-ongoing')).toBeInTheDocument()
    expect(container.querySelector('[class*="first-event"]')).toBeNull()
    expect(screen.queryByText('第一次活动，期待与你相遇！')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('event-card-ongoing'))
    expect(eventsAnalytics.trackCardTap).toHaveBeenCalledWith(event, 'ongoing', 'none')
    expect(navigateToEventCard).toHaveBeenCalledWith(event, { isHistorical: false, tableEntryState: 'none' })
    expect(mocks.navigateTo).not.toHaveBeenCalled()
    expect(mocks.markNotificationRead).not.toHaveBeenCalled()
    expect(mocks.markNotificationsAsRead).not.toHaveBeenCalled()
  })

  it('passes historical context for a past-day nonterminal completed card', () => {
    const event = makeEvent('past-matched', 'matched', '2026-04-12T19:30:00+08:00', {
      registrationId: 'registration-past',
    })
    const originalEvent = { ...event }
    renderCenterHub([event])

    fireEvent.click(getTab('已结束'))
    const card = screen.getByTestId('event-card-past-matched')
    expect(card).toHaveAttribute('data-is-historical', 'true')
    fireEvent.click(card)

    expect(eventsAnalytics.trackCardTap).toHaveBeenCalledWith(event, 'completed', 'none')
    expect(navigateToEventCard).toHaveBeenCalledWith(event, { isHistorical: true, tableEntryState: 'none' })
    expect(event).toEqual(originalEvent)
  })

  it('emits existing tab analytics but no-ops same-tab re-press haptics and analytics', () => {
    renderCenterHub([
      makeEvent('upcoming', 'confirmed', '2026-04-14T19:30:00+08:00'),
    ])

    fireEvent.click(getTab('进行中'))
    expect(eventsAnalytics.track).not.toHaveBeenCalled()
    expect(haptics).not.toHaveBeenCalled()

    fireEvent.click(getTab('待开始'))
    fireEvent.click(getTab('进行中'))
    fireEvent.click(getTab('进行中'))

    expect(eventsAnalytics.track).toHaveBeenCalledTimes(2)
    expect(haptics).toHaveBeenCalledTimes(2)
    expect(eventsAnalytics.track).toHaveBeenCalledWith('events_tab_switch', { tab: 'ongoing' })
    expect(eventsAnalytics.track).toHaveBeenCalledWith('events_tab_switch', { tab: 'upcoming' })
  })
})
