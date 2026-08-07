import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RegistrationConfirmModal from '../RegistrationConfirmModal'

vi.mock('../../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))

describe('RegistrationConfirmModal', () => {
  const baseProps = {
    visible: true,
    dateTimeLabel: '8月12日 周二 19:30',
    area: '南山区',
    highlights: ['150-200', '交朋友'],
    isRegistering: false,
    reduceMotion: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when not visible', () => {
    const { container } = render(<RegistrationConfirmModal {...baseProps} visible={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the confirmation copy and highlights', () => {
    render(<RegistrationConfirmModal {...baseProps} />)

    expect(screen.getByText('预约确认')).toBeInTheDocument()
    expect(screen.getByText('请确认报名信息')).toBeInTheDocument()
    expect(screen.getByText('8月12日 周二 19:30')).toBeInTheDocument()
    expect(screen.getByText('南山区')).toBeInTheDocument()
    expect(screen.getByText('150-200 · 交朋友')).toBeInTheDocument()
    expect(screen.getByText('确认无误，锁定席位')).toBeInTheDocument()
  })

  it('calls onCancel when the overlay is clicked', () => {
    render(<RegistrationConfirmModal {...baseProps} />)

    // The overlay is the outermost View (class reg-confirm-overlay)
    const overlay = document.querySelector('.reg-confirm-overlay')
    expect(overlay).not.toBeNull()
    fireEvent.click(overlay!)

    expect(baseProps.onCancel).toHaveBeenCalledTimes(1)
    expect(baseProps.onConfirm).not.toHaveBeenCalled()
  })

  it('calls onCancel when the close button is clicked', () => {
    render(<RegistrationConfirmModal {...baseProps} />)

    const closeButton = document.querySelector("[aria-label='关闭']")
    expect(closeButton).not.toBeNull()
    fireEvent.click(closeButton!)

    expect(baseProps.onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm when the primary CTA is clicked', () => {
    render(<RegistrationConfirmModal {...baseProps} />)

    const cta = document.querySelector('.reg-confirm__cta')
    expect(cta).not.toBeNull()
    fireEvent.click(cta!)

    expect(baseProps.onConfirm).toHaveBeenCalledTimes(1)
    expect(baseProps.onCancel).not.toHaveBeenCalled()
  })

  it('does not call handlers while registration is in flight', () => {
    render(<RegistrationConfirmModal {...baseProps} isRegistering />)

    const overlay = document.querySelector('.reg-confirm-overlay')
    const cta = document.querySelector('.reg-confirm__cta')

    fireEvent.click(overlay!)
    fireEvent.click(cta!)

    expect(baseProps.onCancel).not.toHaveBeenCalled()
    expect(baseProps.onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('锁定中…')).toBeInTheDocument()
  })

  it('applies the static modifier when reduceMotion is active', () => {
    const { container } = render(<RegistrationConfirmModal {...baseProps} reduceMotion />)

    expect(container.querySelector('.reg-confirm--static')).not.toBeNull()
  })

  it('renders without highlights when the list is empty', () => {
    render(<RegistrationConfirmModal {...baseProps} highlights={[]} />)

    // Match row should still render; sub-line is omitted.
    expect(screen.getByText('按你的偏好匹配同桌与场地')).toBeInTheDocument()
    expect(screen.queryByText(/150-200/)).not.toBeInTheDocument()
  })
})
