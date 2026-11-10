import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ConnectionsStep, { type ConnectionsStepProps } from '../steps/ConnectionsStep'

// G0 selection-edit surface (2026-11-10): the edit mode re-enters the EXISTING
// connections step, so the only things this render test must lock are the
// prefilled grid (the submitted IDs come back as pressed tiles) and the CTA
// label swap. No new screen, no new roster component.

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Button: ({ children, ariaLabel, ...props }: any) => (
    <button type='button' aria-label={ariaLabel} {...props}>
      {children}
    </button>
  ),
  ScrollView: ({ children, scrollY: _scrollY, enhanced: _enhanced, showScrollbar: _showScrollbar, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
}))

vi.mock('../../../components/ui/JoyJoinIcon', () => ({ default: () => null }))
vi.mock('../steps/ParticipantAvatar', () => ({
  default: ({ name }: { name: string }) => <div data-testid='participant-avatar'>{name}</div>,
}))

const participants = [
  { id: 'p1', displayName: '阿团' },
  { id: 'p2', displayName: '阿岚' },
] as unknown as ConnectionsStepProps['participants']

function renderStep(overrides: Partial<ConnectionsStepProps> = {}) {
  return render(
    <ConnectionsStep
      progressDots={null}
      participants={participants}
      participantsError={false}
      selectedConnections={[]}
      onToggleConnection={vi.fn()}
      onRetryParticipants={vi.fn()}
      onNext={vi.fn()}
      {...overrides}
    />,
  )
}

describe('connections step — selection edit mode', () => {
  it('keeps the first-submit CTA when no edit label is supplied', () => {
    renderStep({ selectedConnections: ['p1'] })
    expect(screen.getByRole('button', { name: '已选 1 人，进入下一步' })).toHaveTextContent(
      '已选 1 人，下一步',
    )
  })

  it('prefills the previously selected peers as pressed tiles', () => {
    renderStep({ selectedConnections: ['p1'], submitLabel: '保存修改' })

    expect(screen.getByRole('button', { name: '选择阿团' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '选择阿岚' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('已选 1 位 · 最多 5 位')).toBeInTheDocument()
  })

  it('swaps the primary CTA to 保存修改 in edit mode', () => {
    renderStep({ selectedConnections: ['p1'], submitLabel: '保存修改' })

    expect(screen.getByRole('button', { name: '保存修改，已选 1 人' })).toHaveTextContent('保存修改')
    expect(screen.queryByText('下一步')).not.toBeInTheDocument()
  })

  it('shows the coded server error above the CTA and keeps the grid interactive', () => {
    renderStep({
      selectedConnections: ['p1'],
      submitLabel: '保存修改',
      errorMessage: '最多只能选 5 位同桌',
      onCancelEdit: vi.fn(),
    })

    expect(screen.getByRole('alert')).toHaveTextContent('最多只能选 5 位同桌')
    expect(screen.getByRole('button', { name: '选择阿岚' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('offers a cancel path back to the read-only state', () => {
    const onCancelEdit = vi.fn()
    renderStep({ selectedConnections: ['p1'], submitLabel: '保存修改', onCancelEdit })

    fireEvent.click(screen.getByRole('button', { name: '取消修改' }))
    expect(onCancelEdit).toHaveBeenCalledTimes(1)
  })

  it('is a no-op entry without an edit label (first-submit step unchanged)', () => {
    renderStep({ selectedConnections: ['p1'] })
    expect(screen.queryByRole('button', { name: '取消修改' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders replace mode (re-entry) from an empty grid with the overwrite caution', () => {
    renderStep({
      selectedConnections: [],
      submitLabel: '重新选择',
      submitDisabled: true,
      noticeMessage: '你已选 3 位。重新选择会替换原来的选择，未重新选择的同桌会被移除。',
      onCancelEdit: vi.fn(),
    })

    // Nothing is prefilled — the server never sent the old peer IDs.
    expect(screen.getByRole('button', { name: '选择阿团' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(/你已选 3 位/)).toBeInTheDocument()
    // An empty replace would wipe the old set, so the CTA starts blocked.
    expect(screen.getByRole('button', { name: '重新选择，请先选择同桌' })).toBeDisabled()
  })
})
