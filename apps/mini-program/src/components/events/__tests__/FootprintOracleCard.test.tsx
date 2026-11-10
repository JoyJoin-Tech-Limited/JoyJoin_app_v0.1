import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import Taro from '@tarojs/taro'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JoinedEventSummary } from '@shared/api'
import FootprintOracleCard from '../FootprintOracleCard'
import { trackFeedbackEvent } from '../../../lib/analytics/feedbackAnalytics'

const mocks = vi.hoisted(() => ({
  trackFeedbackEvent: vi.fn(),
  haptics: vi.fn(),
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

vi.mock('../../../hooks/usePageVisibility', () => ({
  usePageVisibility: () => ({ isPageVisible: true }),
}))

vi.mock('../../../lib/utils/accessibility', () => ({
  getSystemReducedMotion: () => true,
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

function makeCardEvent(overrides: Partial<JoinedEventSummary> = {}): JoinedEventSummary {
  return {
    id: 'event-1',
    title: '周末饭局',
    dateTime: '2026-04-12T19:30:00+08:00',
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
    const event = makeCardEvent({ dateTime: '2026-04-14T19:30:00+08:00' })
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
    expect(side?.querySelector('.segmented-countdown-clock')).toBeInTheDocument()
    expect(meta?.querySelector('.footprint-oracle-card__location')).toHaveTextContent('深圳 · 南山区')
    expect(meta?.contains(screen.getByText('已排进 6 人桌'))).toBe(false)
    expect(container.querySelector('.footprint-oracle-card--rail')).toBeNull()
    expect(container.querySelector('.footprint-oracle-card__rail')).toBeNull()
    expect(screen.getByText('已排进 6 人桌').closest('.footprint-oracle-card__facts-footer')).toBeInTheDocument()
    expect(screen.getByText('¥88').closest('.footprint-oracle-card__facts-footer')).toBeInTheDocument()
    expect(container.querySelectorAll('.footprint-oracle-card__title-cue')).toHaveLength(1)
    expect(container.querySelector('.footprint-oracle-card__topline .segmented-countdown-clock')).toBeNull()
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
    const venue = container.querySelector('.footprint-oracle-card__venue')

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
