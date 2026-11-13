import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EventSummaryCard from '../EventSummaryCard'

vi.mock('@tarojs/components', () => ({
  View: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  Image: ({ lazyLoad = false, mode: _mode, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { lazyLoad?: boolean; mode?: string }) => <img data-lazy-load={String(lazyLoad)} {...props} />,
}))

vi.mock('../../ui/SegmentedCountdownClock', () => ({
  default: ({ clockId, enabled }: { clockId: string; enabled: boolean }) => (
    enabled ? <div className='segmented-countdown-clock' data-testid='countdown-clock' id={clockId} /> : null
  ),
}))

vi.mock('../../../hooks/useDeviceTier', () => ({ useDeviceTier: () => ({ isDegradation: false }) }))
vi.mock('../../../hooks/usePageVisibility', () => ({ usePageVisibility: () => ({ isPageVisible: true }) }))
vi.mock('../../../lib/utils/accessibility', () => ({ getSystemReducedMotion: () => true }))
vi.mock('../../discover/oracleCardAssets', () => ({
  getOracleCardCornerAsset: (eventType?: string) => (eventType ? `https://cdn.test/${eventType}.webp` : undefined),
}))

function renderCard(props: Partial<React.ComponentProps<typeof EventSummaryCard>> = {}) {
  return render(
    <EventSummaryCard
      title='微醺夜话 · 福田'
      eventType='酒局'
      dateTime='2026-11-14T17:13:00+08:00'
      city='深圳'
      district='福田'
      status='matched'
      displayStatus='matched'
      {...props}
    />,
  )
}

describe('EventSummaryCard area de-duplication', () => {
  it('keeps the full stacked title but never repeats the area in the geography run', () => {
    const { container } = renderCard()

    expect(container.querySelector('.footprint-oracle-card__title')).toHaveTextContent('微醺夜话 · 福田')
    expect(container.querySelector('.footprint-oracle-card__location')).toHaveTextContent('酒局 · 深圳')
    expect(container.querySelector('.footprint-oracle-card__location')).not.toHaveTextContent('福田')
  })

  it('moves the area into the side column in split layout', () => {
    const { container } = renderCard({ layout: 'split' })

    expect(container.querySelector('.footprint-oracle-card__title')).toHaveTextContent('微醺夜话')
    expect(container.querySelector('.footprint-oracle-card__title')).not.toHaveTextContent('福田')
    expect(container.querySelector('.footprint-oracle-card__side-district')).toHaveTextContent('福田')
    expect(container.querySelector('.footprint-oracle-card__location')).toHaveTextContent('酒局 · 深圳')
  })

  it('still prints the district when the title carries no area suffix', () => {
    const { container } = renderCard({ title: '微醺夜话' })

    expect(container.querySelector('.footprint-oracle-card__location')).toHaveTextContent('酒局 · 深圳 · 福田')
  })

  it('discloses the venue inside the place field in every layout', () => {
    const split = renderCard({ layout: 'split', status: 'confirmed', displayStatus: 'confirmed', venueName: '老街大排档' })
    expect(split.container.querySelector('.footprint-oracle-card__place-primary')).toHaveTextContent('老街大排档')
    expect(split.container.querySelector('.footprint-oracle-card__location')).not.toHaveTextContent('老街大排档')
    split.unmount()

    const stacked = renderCard({ status: 'confirmed', displayStatus: 'confirmed', venueName: '老街大排档' })
    expect(stacked.container.querySelector('.footprint-oracle-card__place-primary')).toHaveTextContent('老街大排档')
    expect(stacked.container.querySelector('.footprint-oracle-card__location')).not.toHaveTextContent('老街大排档')
  })

  it('hides the venue until the group has a confirmed venue', () => {
    renderCard({ status: 'matched', displayStatus: 'matched', venueName: '老街大排档' })

    expect(screen.getByText('场地安排中')).toBeInTheDocument()
    expect(screen.queryByText('老街大排档')).not.toBeInTheDocument()
  })
})

describe('EventSummaryCard theme pill', () => {
  it('renders the match-time table theme under the title', () => {
    const { container } = renderCard({ themePill: '高能充电站·周日晚风' })

    expect(container.querySelector('.footprint-oracle-card__theme-row')).toHaveTextContent('高能充电站·周日晚风')
  })

  it('renders no pill when the table has no theme yet', () => {
    const { container } = renderCard()

    expect(container.querySelector('.footprint-oracle-card__theme-row')).toBeNull()
  })
})

describe('EventSummaryCard place field', () => {
  const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString()

  it('states the pending face with the bounded promise outside the 24h window', () => {
    const { container } = renderCard({ dateTime: inHours(72) })

    expect(container.querySelector('.footprint-oracle-card__place--pending')).not.toBeNull()
    expect(container.querySelector('.footprint-oracle-card__place-primary')).toHaveTextContent('场地安排中')
    expect(container.querySelector('.footprint-oracle-card__place-secondary'))
      .toHaveTextContent('最晚活动前一天告诉你具体地点')
  })

  it('drops the spent promise inside 24h instead of repeating it', () => {
    const { container } = renderCard({ dateTime: inHours(3) })

    expect(container.querySelector('.footprint-oracle-card__place-primary')).toHaveTextContent('场地最后确认中')
    expect(container.querySelector('.footprint-oracle-card__place-secondary')).toBeNull()
  })

  it('renders the address and the affordance once a venue is assigned', () => {
    const { container } = renderCard({
      status: 'confirmed',
      displayStatus: 'confirmed',
      venueName: '老街大排档',
      venueAddress: '深圳市福田区某路 1 号',
      venueActionLabel: '复制地址',
      onVenueAction: vi.fn(),
    })

    expect(container.querySelector('.footprint-oracle-card__place--pending')).toBeNull()
    expect(container.querySelector('.footprint-oracle-card__place-primary')).toHaveTextContent('老街大排档')
    expect(container.querySelector('.footprint-oracle-card__place-secondary')).toHaveTextContent('深圳市福田区某路 1 号')
    expect(screen.getByText('复制地址')).toBeInTheDocument()
  })

  it('keeps the record but removes the affordance on a finished table', () => {
    const { container } = renderCard({
      status: 'completed',
      displayStatus: 'completed',
      venueName: '老街大排档',
      venueAddress: '深圳市福田区某路 1 号',
      venueActionLabel: '复制地址',
      onVenueAction: vi.fn(),
    })

    expect(container.querySelector('.footprint-oracle-card__place-primary')).toHaveTextContent('老街大排档')
    expect(screen.queryByText('复制地址')).toBeNull()
  })

  it('runs the action without bubbling the tap to the card', () => {
    const onVenueAction = vi.fn()
    const onCardClick = vi.fn()
    renderCard({
      status: 'confirmed',
      displayStatus: 'confirmed',
      venueName: '老街大排档',
      venueActionLabel: '导航',
      onVenueAction,
      onClick: onCardClick,
      interactive: true,
      role: 'button',
    })

    fireEvent.click(screen.getByText('导航'))

    expect(onVenueAction).toHaveBeenCalledTimes(1)
    expect(onCardClick).not.toHaveBeenCalled()
  })

  it('makes the whole place field the tap target, not just the verb', () => {
    const { container } = renderCard({
      status: 'confirmed',
      displayStatus: 'confirmed',
      venueName: '老街大排档',
      venueAddress: '深圳市福田区某路 1 号',
      venueActionLabel: '导航',
      onVenueAction: vi.fn(),
    })

    // The verb itself measured ~15pt tall. The field is 88rpx, so the field is
    // the target (44pt) and the verb is its visual label — otherwise the only
    // route out of the house is a sub-44pt tap box inside a tappable card.
    const field = container.querySelector('.footprint-oracle-card__place')
    expect(field?.getAttribute('role')).toBe('button')
    expect(field?.getAttribute('aria-label')).toBe('导航')
    expect(container.querySelector('.footprint-oracle-card__place-action')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('gives the pending plate a family tint instead of a neutral wash', () => {
    const { container } = renderCard()

    // The first cut used a 0.55 white wash that vanished on the warm gradient,
    // so "not arranged yet" still scanned as body text. The tint is the element
    // that makes the pending face a field; if the inline colour ever fails to
    // parse (8-digit hex), the plate silently goes back to being invisible.
    const place = container.querySelector('.footprint-oracle-card__place--pending') as HTMLElement
    expect(place.getAttribute('style')).toMatch(/background-color/)
    expect(place.getAttribute('style')).toMatch(/border-color/)
  })

  it('leaves the resolved face untinted and free of the reveal class', () => {
    const { container } = renderCard({
      status: 'confirmed',
      displayStatus: 'confirmed',
      venueName: '老街大排档',
      reduceMotion: false,
    })

    const place = container.querySelector('.footprint-oracle-card__place') as HTMLElement
    expect(place.className).not.toContain('--pending')
    expect(place.className).not.toContain('--revealed')
    expect(place.getAttribute('style')).toBeNull()
  })

  it('applies the reveal beat only when the owner reports the venue landed', () => {
    const quiet = renderCard({
      status: 'confirmed',
      displayStatus: 'confirmed',
      venueName: '老街大排档',
      reduceMotion: false,
    })
    expect(quiet.container.querySelector('.footprint-oracle-card__place--revealed')).toBeNull()
    quiet.unmount()

    const revealed = renderCard({
      status: 'confirmed',
      displayStatus: 'confirmed',
      venueName: '老街大排档',
      placeRevealed: true,
      reduceMotion: false,
    })
    expect(revealed.container.querySelector('.footprint-oracle-card__place--revealed')).not.toBeNull()
  })
})

describe('EventSummaryCard theme rationale', () => {
  it('prefers the tagline', () => {
    const { container } = renderCard({ themePill: '微醺夜话', themeSubtitle: '深夜频道 · 说到做到' })

    expect(container.querySelector('.footprint-oracle-card__theme-why-text'))
      .toHaveTextContent('深夜频道 · 说到做到')
  })

  it('falls back to at most three group traits', () => {
    const { container } = renderCard({
      themePill: '微醺夜话',
      themeHighlights: ['咖啡脑暴', '城市夜游', '破冰快', '第四个不该出现'],
    })

    expect(container.querySelector('.footprint-oracle-card__theme-why-text'))
      .toHaveTextContent('咖啡脑暴 · 城市夜游 · 破冰快')
  })

  it('renders no rationale row when there is nothing true to say', () => {
    const { container } = renderCard({ themePill: '微醺夜话', themeHighlights: [] })

    expect(container.querySelector('.footprint-oracle-card__theme-why')).toBeNull()
  })
})
