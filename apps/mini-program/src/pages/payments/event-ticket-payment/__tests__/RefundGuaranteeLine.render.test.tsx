import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RefundGuaranteeLine from '../components/RefundGuaranteeLine'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))

describe('RefundGuaranteeLine (D3, flag preRevealRefundEnabled)', () => {
  it('renders the guarantee caption when the flag is on', () => {
    const { container } = render(<RefundGuaranteeLine visible />)

    expect(screen.getByText('排桌完成前取消，全额退款')).toBeInTheDocument()
    expect(container.querySelector('.ticket-refund-guarantee')).not.toBeNull()
  })

  it('renders NOTHING when the flag is off or absent (fail-closed)', () => {
    const { container, rerender } = render(<RefundGuaranteeLine visible={false} />)

    expect(container.firstChild).toBeNull()
    expect(screen.queryByText(/全额退款/)).not.toBeInTheDocument()

    rerender(<RefundGuaranteeLine visible={undefined as never} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText(/全额退款/)).not.toBeInTheDocument()
  })
})
