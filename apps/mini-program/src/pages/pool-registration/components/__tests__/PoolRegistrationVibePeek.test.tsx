import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PoolRegistrationVibePeek from '../PoolRegistrationVibePeek'
import { haptics } from '../../../../lib/utils/haptics'

vi.mock('../../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: (props: Record<string, unknown>) => <img {...props} />,
}))

// Keep the test focused on the expander contract — the snapshot card / sheet
// have their own rendering and are covered by the persona snapshot surfaces.
vi.mock('../PersonaSnapshotCard', () => ({
  default: () => <div data-testid='persona-snapshot-card' />,
}))

vi.mock('../PersonaSnapshotSheet', () => ({
  default: () => <div data-testid='persona-snapshot-sheet' />,
}))

describe('PoolRegistrationVibePeek', () => {
  const baseProps = {
    poolId: 'pool-1',
    eventType: '饭局' as const,
    snapshot: null,
    isLoadingPersonaSnapshot: false,
    personaSnapshotError: false,
    onRetryPersonaSnapshot: vi.fn(),
    userArchetype: null,
    userId: null,
    visible: true,
    reduceMotion: false,
    personaSnapshotEnabled: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when the persona snapshot feature is disabled', () => {
    const { container } = render(
      <PoolRegistrationVibePeek {...baseProps} personaSnapshotEnabled={false} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('is collapsed by default with only the text-row toggle visible', () => {
    render(<PoolRegistrationVibePeek {...baseProps} />)

    expect(screen.getByText('看看这场局的氛围')).toBeInTheDocument()
    expect(screen.queryByTestId('persona-snapshot-card')).not.toBeInTheDocument()
  })

  it('expands inline on toggle tap and fires a light haptic', () => {
    render(<PoolRegistrationVibePeek {...baseProps} />)

    fireEvent.click(screen.getByText('看看这场局的氛围'))

    expect(haptics).toHaveBeenCalledWith('light')
    expect(screen.getByTestId('persona-snapshot-card')).toBeInTheDocument()
    expect(screen.getByText('收起氛围画像')).toBeInTheDocument()
  })

  it('collapses again on a second tap', () => {
    render(<PoolRegistrationVibePeek {...baseProps} />)

    fireEvent.click(screen.getByText('看看这场局的氛围'))
    fireEvent.click(screen.getByText('收起氛围画像'))

    expect(screen.queryByTestId('persona-snapshot-card')).not.toBeInTheDocument()
    expect(screen.getByText('看看这场局的氛围')).toBeInTheDocument()
  })
})
