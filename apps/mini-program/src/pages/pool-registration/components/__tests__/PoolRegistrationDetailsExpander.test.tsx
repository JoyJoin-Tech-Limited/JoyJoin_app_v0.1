import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PoolRegistrationDetailsExpander from '../PoolRegistrationDetailsExpander'
import { haptics } from '../../../../lib/utils/haptics'

vi.mock('../../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))

describe('PoolRegistrationDetailsExpander', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is collapsed by default with only the 补充细节（可选） toggle visible', () => {
    render(
      <PoolRegistrationDetailsExpander>
        <span data-testid='details-fields' />
      </PoolRegistrationDetailsExpander>,
    )

    expect(screen.getByText('补充细节（可选）')).toBeInTheDocument()
    expect(screen.queryByTestId('details-fields')).not.toBeInTheDocument()
  })

  it('expands inline on toggle tap and fires a light haptic', () => {
    render(
      <PoolRegistrationDetailsExpander>
        <span data-testid='details-fields' />
      </PoolRegistrationDetailsExpander>,
    )

    fireEvent.click(screen.getByText('补充细节（可选）'))

    expect(haptics).toHaveBeenCalledWith('light')
    expect(screen.getByTestId('details-fields')).toBeInTheDocument()
    expect(screen.getByText('收起细节')).toBeInTheDocument()
  })

  it('collapses again on a second tap', () => {
    render(
      <PoolRegistrationDetailsExpander>
        <span data-testid='details-fields' />
      </PoolRegistrationDetailsExpander>,
    )

    fireEvent.click(screen.getByText('补充细节（可选）'))
    fireEvent.click(screen.getByText('收起细节'))

    expect(screen.queryByTestId('details-fields')).not.toBeInTheDocument()
    expect(screen.getByText('补充细节（可选）')).toBeInTheDocument()
  })

  it('starts expanded when defaultOpen is set (resumed draft with details)', () => {
    render(
      <PoolRegistrationDetailsExpander defaultOpen>
        <span data-testid='details-fields' />
      </PoolRegistrationDetailsExpander>,
    )

    expect(screen.getByTestId('details-fields')).toBeInTheDocument()
    expect(screen.getByText('收起细节')).toBeInTheDocument()
  })

  it('marks the expanded content for instant swap under reduceMotion', () => {
    const { container } = render(
      <PoolRegistrationDetailsExpander reduceMotion defaultOpen>
        <span data-testid='details-fields' />
      </PoolRegistrationDetailsExpander>,
    )

    expect(
      container.querySelector('.pool-reg-details-expander__content--reduce-motion'),
    ).not.toBeNull()
  })
})
