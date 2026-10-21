import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RefundGuaranteeLine from '../components/RefundGuaranteeLine'

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))

const FACT_TEXT = '排桌完成前取消，全额退款'
const NARRATIVE_TEXT = '这一桌已经写上你的名字'

describe('RefundGuaranteeLine (D3, flag preRevealRefundEnabled)', () => {
  it('renders the guarantee caption when the flag is on', () => {
    const { container } = render(<RefundGuaranteeLine visible />)

    expect(screen.getByText(FACT_TEXT)).toBeInTheDocument()
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

describe('RefundGuaranteeLine (T46 P0d two-line caption stack, AC-06)', () => {
  it('flag on + bucket 1 (narrative) renders the two-line stack, narrative row FIRST, fact row below', () => {
    const { container } = render(<RefundGuaranteeLine visible narrative />)

    // Both rows present…
    expect(screen.getByText(NARRATIVE_TEXT)).toBeInTheDocument()
    expect(screen.getByText(FACT_TEXT)).toBeInTheDocument()

    // …in a column stack container…
    expect(container.querySelector('.ticket-refund-guarantee')).not.toBeNull()

    // …with exactly two caption rows, narrative carrying the treatment
    // modifier, fact row carrying the base class — and narrative FIRST.
    const rows = container.querySelectorAll('.ticket-refund-guarantee__text')
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toBe(NARRATIVE_TEXT)
    expect(rows[0].classList.contains('ticket-refund-guarantee__text--narrative')).toBe(true)
    expect(rows[1].textContent).toBe(FACT_TEXT)
    expect(rows[1].classList.contains('ticket-refund-guarantee__text--narrative')).toBe(false)
    expect(
      rows[0].compareDocumentPosition(rows[1]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('flag on + bucket 0 renders the legacy single fact line (control arm, no narrative row)', () => {
    const { container } = render(<RefundGuaranteeLine visible narrative={false} />)

    expect(screen.getByText(FACT_TEXT)).toBeInTheDocument()
    expect(screen.queryByText(NARRATIVE_TEXT)).not.toBeInTheDocument()
    const rows = container.querySelectorAll('.ticket-refund-guarantee__text')
    expect(rows).toHaveLength(1)
    expect(rows[0].classList.contains('ticket-refund-guarantee__text--narrative')).toBe(false)
  })

  it('flag on + narrative absent / undefined renders the single fact line (field-absence fallback)', () => {
    const { container, rerender } = render(<RefundGuaranteeLine visible />)

    expect(screen.getByText(FACT_TEXT)).toBeInTheDocument()
    expect(screen.queryByText(NARRATIVE_TEXT)).not.toBeInTheDocument()
    expect(container.querySelectorAll('.ticket-refund-guarantee__text')).toHaveLength(1)

    rerender(<RefundGuaranteeLine visible narrative={undefined} />)
    expect(screen.getByText(FACT_TEXT)).toBeInTheDocument()
    expect(screen.queryByText(NARRATIVE_TEXT)).not.toBeInTheDocument()
  })
})
