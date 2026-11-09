import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import XiaoyueEmptyState from './index'

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, hoverStayTime: _hoverStayTime, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ lazyLoad: _lazyLoad, mode: _mode, ...props }: any) => <img {...props} />,
}))

vi.mock('@/lib/utils/cdnAssets', () => ({
  cdnAsset: (path: string) => path,
  useCdnFirstSrc: (path: string) => ({ src: path, onError: vi.fn() }),
}))

vi.mock('@/lib/utils/systemInfo', () => ({
  getWindowInfoCompat: () => ({ windowWidth: 375 }),
}))

vi.mock('../ArchetypeHead', () => ({
  default: () => <div data-testid='archetype-head' />,
}))

describe('XiaoyueEmptyState editorial variant', () => {
  it('keeps the default variant isolated from existing consumers', () => {
    const { container } = render(<XiaoyueEmptyState emotion='waiting' title='正在加载' />)

    expect(container.querySelector('.xiaoyue-empty-state--editorial')).toBeNull()
    expect(container.querySelector('.xiaoyue-empty-state__mascot')).toBeInTheDocument()
  })

  it('renders the events artwork, subtitle, and one working CTA', () => {
    const onAction = vi.fn()
    const { container } = render(
      <XiaoyueEmptyState
        variant='editorial'
        emotion='events'
        title='还没有待开始的活动'
        subtitle='有新的安排时，会在这里告诉你。'
        actionLabel='去发现'
        onAction={onAction}
      />,
    )

    expect(container.querySelector('.xiaoyue-empty-state--editorial')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '悦仔' })).toHaveAttribute(
      'src',
      '/assets/personality/xiaoyue/xiaoyue-events-empty.webp',
    )
    expect(screen.getByText('有新的安排时，会在这里告诉你。')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '去发现' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('uses the connections artwork and supports an optional CTA and subtitle', () => {
    const { container, rerender } = render(
      <XiaoyueEmptyState
        variant='editorial'
        emotion='curious'
        title='新的连接，从一场活动开始'
        subtitle={'参加活动并完成互动后，\n双向选择的连接会出现在这里。'}
      />,
    )

    expect(screen.getByRole('img', { name: '悦仔' })).toHaveAttribute(
      'src',
      '/assets/personality/xiaoyue/xiaoyue-connections-empty.webp',
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    rerender(<XiaoyueEmptyState variant='editorial' emotion='curious' title='新的连接，从一场活动开始' />)
    expect(container.querySelector('.xiaoyue-empty-state__subtitle')).toBeNull()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('preserves the branded image fallback without removing the CTA', () => {
    const onAction = vi.fn()
    const { container } = render(
      <XiaoyueEmptyState
        variant='editorial'
        emotion='events'
        title='还没有待开始的活动'
        actionLabel='去发现'
        onAction={onAction}
      />,
    )

    fireEvent.error(screen.getByRole('img', { name: '悦仔' }))
    expect(container.querySelector('.xiaoyue-empty-state__mascot-fallback')).toHaveTextContent('悦')
    fireEvent.click(screen.getByRole('button', { name: '去发现' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('blocks disabled and loading CTAs while retaining the loading label', () => {
    const onAction = vi.fn()
    const { container, rerender } = render(
      <XiaoyueEmptyState
        variant='editorial'
        emotion='events'
        title='还没有待开始的活动'
        actionLabel='去发现'
        onAction={onAction}
        disabled
      />,
    )

    const disabledCta = screen.getByRole('button', { name: '去发现' })
    expect(disabledCta).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(disabledCta)
    expect(onAction).not.toHaveBeenCalled()

    rerender(
      <XiaoyueEmptyState
        variant='editorial'
        emotion='events'
        title='还没有待开始的活动'
        actionLabel='去发现'
        onAction={onAction}
        loading
        loadingLabel='正在跳转'
      />,
    )
    const loadingCta = screen.getByRole('button', { name: '正在跳转' })
    expect(loadingCta).toHaveAttribute('aria-disabled', 'true')
    expect(container.querySelector('.xiaoyue-empty-state__action-spinner')).toBeInTheDocument()
    fireEvent.click(loadingCta)
    expect(onAction).not.toHaveBeenCalled()
  })

  it('marks explicit reduced motion and locks all editorial animation safeguards in SCSS', () => {
    const { container } = render(
      <XiaoyueEmptyState variant='editorial' emotion='events' title='还没有待开始的活动' motionReduced />,
    )
    expect(container.querySelector('.xiaoyue-empty-state--motion-reduced')).toBeInTheDocument()

    const styles = readFileSync(resolve(process.cwd(), 'src/components/mascot/XiaoyueEmptyState/index.scss'), 'utf8')
    expect(styles).toContain('.xiaoyue-empty-state--editorial.xiaoyue-empty-state--motion-reduced')
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.xiaoyue-empty-state__action-spinner/)
    expect(styles).toMatch(/&--editorial[\s\S]*min-height: \$button-height/)
    expect(styles).not.toContain('overflow-wrap: anywhere')
  })
})
