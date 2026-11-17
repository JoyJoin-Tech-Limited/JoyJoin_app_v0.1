import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EventStatusTabs from '../EventStatusTabs'

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: React.HTMLAttributes<HTMLDivElement> & { hoverClass?: string }) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}))

describe('EventStatusTabs', () => {
  it('shares one accessible track and only emits a real selection change', () => {
    const onChange = vi.fn()
    const { container, rerender } = render(<EventStatusTabs activeTab='upcoming' onChange={onChange} />)

    expect(screen.getByRole('tablist', { name: '活动记录状态' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getByRole('tab', { name: '待开始' })).toHaveAttribute('aria-selected', 'true')
    expect(container.querySelector('.event-status-tabs')).toHaveAttribute('data-active-tab', 'upcoming')
    expect(container.querySelector('.event-status-tabs')).not.toHaveClass('event-status-tabs--manual')

    fireEvent.click(screen.getByRole('tab', { name: '待开始' }))
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('tab', { name: '进行中' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('ongoing')
    expect(container.querySelector('.event-status-tabs')).toHaveClass('event-status-tabs--manual')

    rerender(<EventStatusTabs activeTab='ongoing' onChange={onChange} />)
    expect(screen.getByRole('tab', { name: '进行中' })).toHaveAttribute('aria-selected', 'true')
    expect(container.querySelector('.event-status-tabs')).toHaveAttribute('data-active-tab', 'ongoing')
  })
})
