import React from 'react'
import { render, screen } from '@testing-library/react'
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

  it('discloses the venue on its own line in split layout only', () => {
    const split = renderCard({ layout: 'split', status: 'confirmed', displayStatus: 'confirmed', venueName: '老街大排档' })
    expect(split.container.querySelector('.footprint-oracle-card__venue')).toHaveTextContent('老街大排档')
    expect(split.container.querySelector('.footprint-oracle-card__location')).not.toHaveTextContent('老街大排档')
    split.unmount()

    const stacked = renderCard({ status: 'confirmed', displayStatus: 'confirmed', venueName: '老街大排档' })
    expect(stacked.container.querySelector('.footprint-oracle-card__venue')).toBeNull()
    expect(stacked.container.querySelector('.footprint-oracle-card__location')).toHaveTextContent('老街大排档')
  })

  it('hides the venue until the group has a confirmed venue', () => {
    renderCard({ status: 'matched', displayStatus: 'matched', venueName: '老街大排档' })

    expect(screen.getByText('场地安排中')).toBeInTheDocument()
    expect(screen.queryByText('老街大排档')).not.toBeInTheDocument()
  })
})
