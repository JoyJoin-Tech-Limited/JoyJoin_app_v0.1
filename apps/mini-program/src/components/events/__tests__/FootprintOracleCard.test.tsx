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
  Image: ({ lazyLoad: _lazyLoad, mode: _mode, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { lazyLoad?: boolean; mode?: string }) => <img {...props} />,
}))

vi.mock('../../ui/SegmentedCountdownClock', () => ({
  default: ({ clockId }: { clockId: string }) => <div data-testid='countdown-clock' id={clockId} />,
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
  getOracleCardCornerAsset: () => undefined,
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
    expect(screen.getByText('排桌完成，场地安排中')).toBeInTheDocument()
    expect(screen.getByTestId('countdown-clock')).toBeInTheDocument()
    expect(container.querySelector('.footprint-oracle-card__pulse-dot--live')).toBeInTheDocument()
    expect(container.querySelector('.footprint-oracle-card')).not.toHaveClass('footprint-oracle-card--terminal')
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
