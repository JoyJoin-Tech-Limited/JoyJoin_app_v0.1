import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import Taro from '@tarojs/taro'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { JoinedEventSummary } from '@shared/api'
import FootprintOracleCard from '../FootprintOracleCard'
import { trackFeedbackEvent } from '../../../lib/analytics/feedbackAnalytics'

const mocks = vi.hoisted(() => ({
  trackFeedbackEvent: vi.fn(),
  haptics: vi.fn(),
  prefetchQuery: vi.fn(() => Promise.resolve()),
  tableOpened: false,
  tableOpenedRecently: false,
  reduceMotion: true,
}))

// The sealed entry reads the device-local reveal flag; these mocks let a test
// state the flag directly instead of seeding Taro storage.
vi.mock('../../../lib/utils/tableRevealState', () => ({
  hasOpenedTable: () => mocks.tableOpened,
  hasOpenedTableRecently: () => mocks.tableOpenedRecently,
  markTableOpened: vi.fn(),
}))

// The card prefetches the group payload on tap so the ceremony's first frame
// is composed; the prefetch client is the only data surface it touches.
vi.mock('../../../lib/api/queryClient', () => ({
  queryClient: { prefetchQuery: mocks.prefetchQuery },
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, hoverStartTime: _hoverStartTime, hoverStayTime: _hoverStayTime, ...props }: React.HTMLAttributes<HTMLDivElement> & { hoverClass?: string; hoverStartTime?: number; hoverStayTime?: number }) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  Image: ({ lazyLoad = false, mode: _mode, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { lazyLoad?: boolean; mode?: string }) => <img data-lazy-load={String(lazyLoad)} {...props} />,
}))

vi.mock('../../ui/SegmentedCountdownClock', () => ({
  default: ({ clockId, enabled }: { clockId: string; enabled: boolean }) => enabled
    ? <div className='segmented-countdown-clock' data-testid='countdown-clock' id={clockId} />
    : null,
}))

vi.mock('../../../hooks/useDeviceTier', () => ({
  useDeviceTier: () => ({ isDegradation: false }),
}))

// The card owns its own feature-flag read so every surface that renders it
// (Events, Center Hub, the legacy wrapper) gets the same sealed/revealed
// decision without threading a prop through each page.
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: undefined, isLoading: false, isFetching: false, isAuthenticated: false }),
}))

vi.mock('../../../hooks/usePageVisibility', () => ({
  usePageVisibility: () => ({ isPageVisible: true }),
}))

vi.mock('../../../lib/utils/accessibility', () => ({
  getSystemReducedMotion: () => mocks.reduceMotion,
}))

vi.mock('../../discover/oracleCardAssets', () => ({
  getOracleCardCornerAsset: (eventType?: string) => eventType ? `https://cdn.test/${eventType}.webp` : undefined,
}))

vi.mock('../../../lib/analytics/feedbackAnalytics', () => ({
  trackFeedbackEvent: mocks.trackFeedbackEvent,
}))

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: mocks.haptics,
}))

function inDays(days: number): string {
  // Relative dates keep this fixture out of the past: a matched card whose date
  // has already passed is not a real state, and it silently flips the place
  // field into its urgent copy when the clock rolls over.
  return new Date(Date.now() + days * 86_400_000).toISOString()
}

function makeCardEvent(overrides: Partial<JoinedEventSummary> = {}): JoinedEventSummary {
  return {
    id: 'event-1',
    title: '周末饭局',
    // Deliberately in the past: a dated-but-formed table is the state where the
    // card is a RECORD (not a sealed box), which is what the facts/faces/hint
    // assertions below are about. Tests that need a live countdown override it.
    dateTime: inDays(-30),
    status: 'matched',
    displayStatus: 'matched',
    registrationId: 'registration-1',
    eventType: 'dining',
    ...overrides,
  }
}

describe('FootprintOracleCard historical presentation integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preserves active status, waiting copy, countdown, and live indicator by default', () => {
    const event = makeCardEvent({ dateTime: inDays(2) })
    const { container } = render(<FootprintOracleCard event={event} />)

    expect(screen.getByText('排桌完成')).toBeInTheDocument()
    expect(screen.getByText('场地安排中')).toBeInTheDocument()
    expect(screen.queryByText('排桌完成，场地安排中')).not.toBeInTheDocument()
    expect(screen.getByTestId('countdown-clock')).toBeInTheDocument()
    expect(container.querySelector('.footprint-oracle-card__pulse-dot--live')).toBeInTheDocument()
    expect(container.querySelector('.footprint-oracle-card')).not.toHaveClass('footprint-oracle-card--terminal')
  })

  it('keeps the Discover dining scene visible without repeating the upcoming status as waiting copy', () => {
    const event = makeCardEvent({ status: 'upcoming', displayStatus: 'upcoming' })
    const { container } = render(<FootprintOracleCard event={event} />)

    expect(container.querySelector('.footprint-oracle-card__type-corner')).toHaveAttribute(
      'src',
      'https://cdn.test/dining.webp',
    )
    expect(container.querySelector('.footprint-oracle-card__type-corner')).toHaveAttribute('data-lazy-load', 'false')
    expect(screen.getByText('即将开始')).toBeInTheDocument()
    expect(container.querySelector('.footprint-oracle-card__waiting-hint')).toBeNull()
  })

  it('retains quieter event-type recognition for terminal cards without reviving the countdown', () => {
    const event = makeCardEvent({ status: 'completed', displayStatus: 'completed' })
    const { container } = render(<FootprintOracleCard event={event} isHistorical />)

    expect(container.querySelector('.footprint-oracle-card')).toHaveClass('footprint-oracle-card--terminal')
    expect(container.querySelector('.footprint-oracle-card__type-corner')).toHaveAttribute(
      'src',
      'https://cdn.test/dining.webp',
    )
    expect(screen.queryByTestId('countdown-clock')).not.toBeInTheDocument()
  })

  it('integrates party facts and one navigation cue into the main card body', () => {
    const event = makeCardEvent({ groupId: 'group-1', groupSize: 6, price: 88, location: '深圳 · 南山区' })
    const { container } = render(<FootprintOracleCard event={event} />)
    const meta = container.querySelector('.footprint-oracle-card__meta')
    const side = container.querySelector('.footprint-oracle-card__side')

    expect(container.querySelector('.footprint-oracle-card')).toHaveClass('footprint-oracle-card--split')
    expect(meta?.querySelector('.footprint-oracle-card__date-time')).toBeNull()
    expect(side?.querySelector('.footprint-oracle-card__side-month-day')).toHaveTextContent(/\d{1,2}月\d{1,2}日/)
    expect(side?.querySelector('.footprint-oracle-card__side-weekday')).toHaveTextContent(/周[一二三四五六日]/)
    expect(side?.querySelector('.footprint-oracle-card__side-time')).toHaveTextContent(/\d{2}:\d{2}/)
    // Phase 1 (2026-11-10): the countdown left the side column and joined the
    // status rail, so lifecycle + time read as one header line.
    expect(side?.querySelector('.segmented-countdown-clock')).toBeNull()
    expect(meta?.querySelector('.footprint-oracle-card__location')).toHaveTextContent('深圳 · 南山区')
    expect(meta?.contains(screen.getByText('已排进 6 人桌'))).toBe(false)
    expect(container.querySelector('.footprint-oracle-card--rail')).toBeNull()
    expect(container.querySelector('.footprint-oracle-card__rail')).toBeNull()
    expect(screen.getByText('已排进 6 人桌').closest('.footprint-oracle-card__facts-footer')).toBeInTheDocument()
    expect(screen.getByText('¥88').closest('.footprint-oracle-card__facts-footer')).toBeInTheDocument()
    expect(container.querySelectorAll('.footprint-oracle-card__title-cue')).toHaveLength(1)
    const topline = container.querySelector('.footprint-oracle-card__topline')
    expect(topline?.querySelector('.footprint-oracle-card__pulse-pill')).toBeInTheDocument()
    expect(
      topline?.querySelector('.footprint-oracle-card__countdown-chip .segmented-countdown-clock'),
    ).toBeInTheDocument()
  })

  it('splits the region suffix into the right-hand when column', () => {
    const event = makeCardEvent({
      title: '微醺夜话 · 福田',
      eventType: '酒局',
      city: '深圳',
      district: '福田',
    })
    const { container } = render(<FootprintOracleCard event={event} />)

    expect(container.querySelector('.footprint-oracle-card__title')).toHaveTextContent('微醺夜话')
    expect(container.querySelector('.footprint-oracle-card__title')).not.toHaveTextContent('福田')
    expect(container.querySelector('.footprint-oracle-card__side-district')).toHaveTextContent('福田')
    // The district already lives in the right column — repeating it in the
    // geography run reads as two different locations.
    expect(container.querySelector('.footprint-oracle-card__location')).toHaveTextContent('酒局 · 深圳')
    expect(container.querySelector('.footprint-oracle-card__location')).not.toHaveTextContent('福田')
  })

  it('gives a disclosed venue its own line without duplicating it in the location run', () => {
    const event = makeCardEvent({
      title: '今晚即兴饭局 · 罗湖',
      status: 'confirmed',
      displayStatus: 'confirmed',
      eventType: '饭局',
      city: '深圳',
      district: '罗湖',
      venueName: '老街大排档',
      groupId: 'group-urgent-001',
      groupSize: 6,
    })
    const { container } = render(<FootprintOracleCard event={event} />)
    const location = container.querySelector('.footprint-oracle-card__location')
    const venue = container.querySelector('.footprint-oracle-card__place-primary')

    expect(location).toHaveTextContent('饭局 · 深圳')
    expect(location).not.toHaveTextContent('老街大排档')
    expect(venue).toHaveTextContent('老街大排档')
    expect(screen.getByText('已确认')).toBeInTheDocument()
    expect(screen.getByText('已排进 6 人桌')).toBeInTheDocument()
  })

  it('keeps assigned-table size distinct from registration count across terminal and missing-group states', () => {
    const confirmed = render(
      <FootprintOracleCard event={makeCardEvent({
        status: 'confirmed',
        displayStatus: 'confirmed',
        groupId: 'group-1',
        groupSize: 6,
      })} />,
    )
    expect(confirmed.getByText('已排进 6 人桌')).toBeInTheDocument()
    confirmed.unmount()

    const completed = render(
      <FootprintOracleCard event={makeCardEvent({
        status: 'completed',
        displayStatus: 'completed',
        groupId: 'group-1',
        groupSize: 6,
      })} />,
    )
    expect(completed.getByText('6 人桌')).toBeInTheDocument()
    expect(completed.queryByText('已报名 6 人')).not.toBeInTheDocument()
    expect(completed.container.querySelector('[aria-label]')?.getAttribute('aria-label')).toContain('6 人桌')
    completed.unmount()

    const cancelled = render(
      <FootprintOracleCard event={makeCardEvent({
        status: 'cancelled',
        displayStatus: 'cancelled',
        groupId: 'group-1',
        groupSize: 6,
      })} />,
    )
    expect(cancelled.queryByText(/人桌|已报名/)).not.toBeInTheDocument()
    cancelled.unmount()

    const missingGroup = render(
      <FootprintOracleCard event={makeCardEvent({ groupSize: 6 })} />,
    )
    expect(missingGroup.queryByText(/人桌|已报名/)).not.toBeInTheDocument()
  })

  it('renders a historical nonterminal as neutral ended without changing the DTO', () => {
    const event = makeCardEvent()
    const originalEvent = { ...event }
    const { container } = render(<FootprintOracleCard event={event} isHistorical />)
    const card = container.querySelector('.footprint-oracle-card')

    expect(screen.getByText('已结束')).toBeInTheDocument()
    expect(screen.queryByText('排桌完成')).not.toBeInTheDocument()
    expect(screen.queryByText('排桌完成，场地安排中')).not.toBeInTheDocument()
    expect(screen.queryByText('待公布')).not.toBeInTheDocument()
    expect(screen.queryByTestId('countdown-clock')).not.toBeInTheDocument()
    expect(container.querySelector('.footprint-oracle-card__pulse-dot--live')).toBeNull()
    expect(card).toHaveClass('footprint-oracle-card--terminal')
    expect(card).not.toHaveClass('footprint-oracle-card--matched')
    expect(card?.getAttribute('aria-label')).toContain('已结束')
    expect(card?.getAttribute('aria-label')).not.toContain('已排桌')
    expect(event).toEqual(originalEvent)
    expect(event.status).toBe('matched')
    expect(event.displayStatus).toBe('matched')
  })

  it('does not give a historical nonterminal the terminal-only feedback pill', () => {
    const event = makeCardEvent({
      status: 'pending',
      displayStatus: 'pending',
      feedbackPending: true,
    })
    render(<FootprintOracleCard event={event} isHistorical />)

    expect(screen.getByText('已结束')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '去评价这场活动' })).not.toBeInTheDocument()
    expect(trackFeedbackEvent).not.toHaveBeenCalled()
  })

  it('keeps genuine terminal feedback behavior when historical context is supplied', () => {
    const event = makeCardEvent({
      id: 'terminal-feedback',
      status: 'completed',
      displayStatus: 'completed',
      feedbackPending: true,
    })
    const originalEvent = { ...event }
    const onClick = vi.fn()
    const { container } = render(
      <FootprintOracleCard event={event} isHistorical onClick={onClick} />,
    )

    expect(screen.getByText('圆满结束')).toBeInTheDocument()
    expect(container.querySelector('.footprint-oracle-card')).toHaveClass('footprint-oracle-card--terminal')
    expect(screen.queryByTestId('countdown-clock')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '去评价这场活动' }).closest('.footprint-oracle-card__footer')).toBeInTheDocument()
    expect(container.querySelectorAll('.footprint-oracle-card__title-cue')).toHaveLength(1)
    expect(container.querySelector('.footprint-oracle-card__rail-cue')).toBeNull()
    expect(trackFeedbackEvent).toHaveBeenCalledWith('feedback_entry_shown', {
      eventId: 'terminal-feedback',
      state: 'open',
      surface: 'events_tab',
    })

    fireEvent.click(screen.getByRole('button', { name: '去评价这场活动' }))

    expect(Taro.navigateTo).toHaveBeenCalledWith({
      url: '/pages/event-feedback/index?id=terminal-feedback&from=events_tab',
    })
    expect(trackFeedbackEvent).toHaveBeenCalledWith('feedback_reminder_tap', {
      eventId: 'terminal-feedback',
      from: 'events_tab',
    })
    expect(onClick).not.toHaveBeenCalled()
    expect(event).toEqual(originalEvent)
  })
})

describe('FootprintOracleCard table identity (Phase 2 + 3)', () => {
  it('renders one face per matched tablemate without masking', () => {
    const event = makeCardEvent({
      groupId: 'group-1',
      groupSize: 4,
      memberArchetypes: ['corgi', 'fox', 'owl', 'koala'],
    })
    const { container } = render(<FootprintOracleCard event={event} />)

    expect(container.querySelectorAll('.footprint-oracle-card__table-face')).toHaveLength(4)
    // Faces are decorative on top of the text label, never the only signal.
    expect(container.querySelector('.footprint-oracle-card__table-faces')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('已排进 4 人桌')).toBeInTheDocument()
  })

  it('caps the face row at a six-seat table', () => {
    const event = makeCardEvent({
      groupId: 'group-1',
      groupSize: 8,
      memberArchetypes: ['corgi', 'fox', 'owl', 'koala', 'octopus', 'spider', 'turtle', 'cat'],
    })
    const { container } = render(<FootprintOracleCard event={event} />)

    expect(container.querySelectorAll('.footprint-oracle-card__table-face')).toHaveLength(6)
  })

  it('renders the match-time theme as a pill under the title', () => {
    const event = makeCardEvent({ theme: '高能充电站·周日晚风' })
    const { container } = render(<FootprintOracleCard event={event} />)

    expect(container.querySelector('.footprint-oracle-card__theme-row')).toHaveTextContent('高能充电站·周日晚风')
  })

  it('points at the next step from the footer, and flips it for a finished table', () => {
    const upcoming = render(<FootprintOracleCard event={makeCardEvent({ groupId: 'group-1', groupSize: 4 })} />)
    expect(upcoming.container.querySelector('.footprint-oracle-card__footer-hint')).toHaveTextContent('看看这桌的合拍度')
    upcoming.unmount()

    const finished = render(
      <FootprintOracleCard
        event={makeCardEvent({ groupId: 'group-2', groupSize: 4, displayStatus: 'completed', status: 'completed' })}
      />,
    )
    expect(finished.container.querySelector('.footprint-oracle-card__footer-hint')).toHaveTextContent('翻翻这场回顾')
  })
})

describe('FootprintOracleCard sealed table entry', () => {
  // Keep this relative. A hardcoded date silently ages out of the sealed state
  // the moment it passes, and every assertion below then tests a revealed card.
  const FUTURE_DATE = inDays(5)
  const FUTURE_WEEKDAY_LABEL = (() => {
    const future = new Date(FUTURE_DATE)
    return `${future.getMonth() + 1}月${future.getDate()}日`
  })()

  function sealedEvent(overrides: Partial<JoinedEventSummary> = {}): JoinedEventSummary {
    return makeCardEvent({
      groupId: 'group-1',
      groupSize: 6,
      dateTime: FUTURE_DATE,
      matchScore: 87,
      memberArchetypes: ['corgi', 'fox', 'owl', 'koala', 'octopus', 'spider'],
      ...overrides,
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.tableOpened = false
    mocks.tableOpenedRecently = false
  })

  it('replaces the spoiler face row with a sealed deck while the table is unopened', () => {
    const { container } = render(<FootprintOracleCard event={sealedEvent()} />)

    expect(container.querySelectorAll('.footprint-oracle-card__seal-disc')).toHaveLength(3)
    // The six people are the ceremony's payoff; the card must not pre-spend it.
    expect(container.querySelectorAll('.footprint-oracle-card__table-face')).toHaveLength(0)
    expect(container.querySelector('.footprint-oracle-card')).toHaveClass('footprint-oracle-card--sealed')
  })

  it('offers one filled capsule as the card affordance', () => {
    const { container } = render(<FootprintOracleCard event={sealedEvent()} />)

    const capsule = container.querySelector('.footprint-oracle-card__capsule')
    expect(capsule).toHaveTextContent('开箱看桌友')
    expect(container.querySelector('.footprint-oracle-card__footer-hint')).toBeNull()
    // Copy promises the table, not the score: the score is the reward inside.
    expect(capsule).not.toHaveTextContent('合拍度')
  })

  it('withholds the score until the table has been opened', () => {
    const { container, unmount } = render(<FootprintOracleCard event={sealedEvent()} />)

    // 合拍度 is part of what the box holds; printing it above 「开箱看桌友」
    // would hand the gift over before it is opened (designer anti-pattern #7).
    expect(container.querySelector('.footprint-oracle-card__fact')).toHaveTextContent('已排进 6 人桌')
    expect(container.textContent).not.toContain('合拍度')
    unmount()

    mocks.tableOpened = true
    const revealed = render(<FootprintOracleCard event={sealedEvent()} />)
    expect(revealed.getByText('已排进 6 人桌 · 合拍度 87')).toBeInTheDocument()
  })

  it('drops the countdown chip so the rail states one thing: the table arrived', () => {
    const { container } = render(<FootprintOracleCard event={sealedEvent()} />)

    expect(screen.getByText('排桌完成')).toBeInTheDocument()
    expect(screen.queryByTestId('countdown-clock')).not.toBeInTheDocument()
    expect(container.querySelector('.footprint-oracle-card__countdown-chip')).toBeNull()
  })

  it('names the action in the accessibility label without dropping the facts', () => {
    render(<FootprintOracleCard event={sealedEvent({ title: '微醺夜话' })} />)

    // The action is appended, not substituted: a sealed card still owes the
    // reader the date and the table it reveals.
    const button = screen.getByRole('button', { name: /开箱看看这桌的 6 位桌友$/ })
    expect(button).toHaveAccessibleName(/微醺夜话/)
    expect(button).toHaveAccessibleName(new RegExp(FUTURE_WEEKDAY_LABEL))
    expect(button).toHaveAccessibleName(/已排进 6 人桌/)
    // The countdown chip is suppressed, so the label must not promise one.
    expect(button).not.toHaveAccessibleName(/倒计时/)
  })

  it('prefetches the group payload and reports the sealed entry on tap', () => {
    const onClick = vi.fn()
    const event = sealedEvent()

    render(<FootprintOracleCard event={event} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: /开箱看看这桌的 6 位桌友/ }))

    expect(mocks.prefetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['mini-program', 'pool-group', 'group-1'] }),
    )
    expect(mocks.haptics).toHaveBeenCalledWith('light')
    expect(onClick).toHaveBeenCalledWith(event, 'sealed')
  })

  it('goes quiet once the table has been opened', () => {
    mocks.tableOpened = true
    const { container } = render(<FootprintOracleCard event={sealedEvent()} />)

    expect(container.querySelectorAll('.footprint-oracle-card__table-face')).toHaveLength(6)
    expect(container.querySelector('.footprint-oracle-card__seal')).toBeNull()
    expect(container.querySelector('.footprint-oracle-card__capsule')).toBeNull()
    expect(container.querySelector('.footprint-oracle-card__footer-hint')).toHaveTextContent('看看这桌的合拍度')
    // A spent reveal must not keep pulsing "something new here".
    expect(container.querySelector('.footprint-oracle-card__pulse-dot--live')).toBeNull()
    expect(screen.getByTestId('countdown-clock')).toBeInTheDocument()
    expect(screen.getByText(FUTURE_WEEKDAY_LABEL)).toBeInTheDocument()
  })

  it('reports the revealed entry so the tap lands on the group detail', () => {
    mocks.tableOpened = true
    const onClick = vi.fn()
    const event = sealedEvent()

    render(<FootprintOracleCard event={event} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledWith(event, 'revealed')
    expect(mocks.prefetchQuery).not.toHaveBeenCalled()
  })

  it('plays the receipt frames once when the user returns from the ceremony', () => {
    mocks.tableOpened = true
    mocks.tableOpenedRecently = true
    const { container } = render(<FootprintOracleCard event={sealedEvent()} />)

    expect(container.querySelector('.footprint-oracle-card')).toHaveClass('footprint-oracle-card--receipt')
  })

  it('keeps the receipt off for a table opened long ago', () => {
    mocks.tableOpened = true
    mocks.tableOpenedRecently = false
    const { container } = render(<FootprintOracleCard event={sealedEvent()} />)

    expect(container.querySelector('.footprint-oracle-card')).not.toHaveClass('footprint-oracle-card--receipt')
  })

  it('leaves a matched table with no assigned group completely unsealed', () => {
    const { container } = render(
      <FootprintOracleCard event={makeCardEvent({ dateTime: FUTURE_DATE, groupId: undefined, groupSize: undefined })} />,
    )

    expect(container.querySelector('.footprint-oracle-card__seal')).toBeNull()
    expect(container.querySelector('.footprint-oracle-card__capsule')).toBeNull()
    // Nothing can be promised without a table, so there is no affordance at all.
    expect(container.querySelector('.footprint-oracle-card__footer-hint')).toBeNull()
  })
})

describe('FootprintOracleCard venue navigation', () => {
  it('offers navigation only when the venue carries coordinates', () => {
    const withCoords = render(
      <FootprintOracleCard event={makeCardEvent({
        status: 'confirmed',
        displayStatus: 'confirmed',
        venueName: '老街大排档',
        venueAddress: '深圳市罗湖区某路 1 号',
        venueLatitude: 22.5431,
        venueLongitude: 114.0579,
      })} />,
    )
    expect(screen.getByText('导航')).toBeInTheDocument()
    withCoords.unmount()

    const withoutCoords = render(
      <FootprintOracleCard event={makeCardEvent({
        status: 'confirmed',
        displayStatus: 'confirmed',
        venueName: '老街大排档',
        venueAddress: '深圳市罗湖区某路 1 号',
      })} />,
    )
    // A chevron next to a clipboard would promise a map the app cannot open.
    expect(screen.getByText('复制地址')).toBeInTheDocument()
    expect(screen.queryByText('导航')).toBeNull()
  })
})

describe('FootprintOracleCard venue-lands beat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.tableOpened = true
    mocks.reduceMotion = false
  })

  afterEach(() => {
    mocks.reduceMotion = true
  })

  it('does not celebrate a card that mounts already resolved', () => {
    const { container } = render(
      <FootprintOracleCard event={makeCardEvent({
        dateTime: inDays(2),
        status: 'confirmed',
        displayStatus: 'confirmed',
        venueName: '老街大排档',
      })} />,
    )

    // A card opened after the venue landed states the fact; it must not fire a
    // celebration haptic on first paint.
    expect(container.querySelector('.footprint-oracle-card__place--revealed')).toBeNull()
    expect(mocks.haptics).not.toHaveBeenCalledWith('success')
  })

  it('announces the venue once when it lands while the card is mounted', () => {
    const { container, rerender } = render(
      <FootprintOracleCard event={makeCardEvent({
        dateTime: inDays(2),
        status: 'matched',
        displayStatus: 'matched',
      })} />,
    )
    expect(container.querySelector('.footprint-oracle-card__place--pending')).not.toBeNull()

    // The events tab refreshes my-registrations; the venue can arrive on a card
    // the user is already looking at.
    rerender(
      <FootprintOracleCard event={makeCardEvent({
        dateTime: inDays(2),
        status: 'confirmed',
        displayStatus: 'confirmed',
        venueName: '老街大排档',
        venueAddress: '深圳市罗湖区某路 1 号',
      })} />,
    )

    expect(container.querySelector('.footprint-oracle-card__place--revealed')).not.toBeNull()
    expect(mocks.haptics).toHaveBeenCalledWith('success')
  })

  it('still acknowledges the venue when the user prefers reduced motion', () => {
    // Ahead of the previous test's write so the shared cooldown cannot swallow
    // this one (a mocked epoch BEHIND the real clock yields a negative delta and
    // would silently suppress the haptic).
    const base = Date.now()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(base + 10_000)
    mocks.reduceMotion = true

    const { container, rerender } = render(
      <FootprintOracleCard event={makeCardEvent({
        dateTime: inDays(2),
        status: 'matched',
        displayStatus: 'matched',
      })} />,
    )

    rerender(
      <FootprintOracleCard event={makeCardEvent({
        dateTime: inDays(2),
        status: 'confirmed',
        displayStatus: 'confirmed',
        venueName: '老街大排档',
      })} />,
    )

    // Reduced motion is a visual preference, not an acknowledgement preference:
    // these users still get the one haptic, just no animation.
    expect(mocks.haptics).toHaveBeenCalledWith('success')
    expect(container.querySelector('.footprint-oracle-card__place--revealed')).toBeNull()
    nowSpy.mockRestore()
  })

  it('coalesces a burst into one haptic when several venues land at once', () => {
    const base = Date.now()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(base + 60_000)
    const matched = (groupId: string) => makeCardEvent({
      dateTime: inDays(2),
      status: 'matched',
      displayStatus: 'matched',
      groupId,
    })
    const resolved = (groupId: string) => makeCardEvent({
      dateTime: inDays(2),
      status: 'confirmed',
      displayStatus: 'confirmed',
      venueName: '老街大排档',
      groupId,
    })

    const first = render(<FootprintOracleCard event={matched('group-a')} />)
    const second = render(<FootprintOracleCard event={matched('group-b')} />)

    // Venue assignment resolves a whole pool's groups in one run, and one poll
    // can flip several cards the user is looking at. Three haptics in a burst is
    // a buzzing phone, not a celebration.
    first.rerender(<FootprintOracleCard event={resolved('group-a')} />)
    second.rerender(<FootprintOracleCard event={resolved('group-b')} />)

    expect(mocks.haptics.mock.calls.filter((call) => call[0] === 'success')).toHaveLength(1)
    nowSpy.mockRestore()
  })
})

describe('FootprintOracleCard theme rationale', () => {
  it('withholds the rationale while the table is still sealed', () => {
    mocks.tableOpened = false
    const { container } = render(
      <FootprintOracleCard event={makeCardEvent({
        dateTime: inDays(3),
        groupId: 'group-sealed-001',
        groupSize: 6,
        theme: '微醺夜话',
        themeSubtitle: '深夜频道 · 说到做到',
      })} />,
    )

    expect(container.querySelector('.footprint-oracle-card--sealed')).not.toBeNull()
    expect(container.querySelector('.footprint-oracle-card__theme-why')).toBeNull()
  })

  it('shows the rationale once the table has been opened', () => {
    mocks.tableOpened = true
    const { container } = render(
      <FootprintOracleCard event={makeCardEvent({
        dateTime: inDays(3),
        groupId: 'group-opened-001',
        groupSize: 6,
        theme: '微醺夜话',
        themeSubtitle: '深夜频道 · 说到做到',
      })} />,
    )

    expect(container.querySelector('.footprint-oracle-card__theme-why-text'))
      .toHaveTextContent('深夜频道 · 说到做到')
  })
})
