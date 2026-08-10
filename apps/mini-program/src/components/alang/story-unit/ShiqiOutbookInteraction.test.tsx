import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ShiqiOutbookInteraction } from './ShiqiOutbookInteraction'

const mocks = vi.hoisted(() => ({ systemReduceMotion: false }))

vi.mock('@tarojs/taro', () => ({
  default: { getSystemInfoSync: () => ({ windowWidth: 375, reduceMotion: mocks.systemReduceMotion }) },
}))

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

function drag(element: HTMLElement, from: [number, number], to: [number, number]) {
  fireEvent.touchStart(element, { touches: [{ clientX: from[0], clientY: from[1] }] })
  fireEvent.touchMove(element, { touches: [{ clientX: to[0], clientY: to[1] }] })
  fireEvent.touchEnd(element, { changedTouches: [{ clientX: to[0], clientY: to[1] }] })
}

describe('ShiqiOutbookInteraction', () => {
  const onInteractionStart = vi.fn()
  const onFirstMistake = vi.fn()
  const onComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.systemReduceMotion = false
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    })
  })

  it('snaps and locks when the three routes are released inside the threshold', () => {
    render(
      <ShiqiOutbookInteraction
        onInteractionStart={onInteractionStart}
        onFirstMistake={onFirstMistake}
        onComplete={onComplete}
      />,
    )

    const sheet = screen.getByLabelText('拖动上层纸页，让三条路线重合')
    drag(sheet, [100, 100], [132, 80])

    expect(onInteractionStart).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('shiqi-outbook')).toHaveAttribute('data-aligned', 'true')

    drag(sheet, [100, 100], [132, 80])
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('springs back without error copy and only asks for help once', () => {
    render(
      <ShiqiOutbookInteraction
        onInteractionStart={onInteractionStart}
        onFirstMistake={onFirstMistake}
        onComplete={onComplete}
      />,
    )

    const sheet = screen.getByLabelText('拖动上层纸页，让三条路线重合')
    drag(sheet, [100, 100], [108, 104])
    drag(sheet, [100, 100], [108, 104])

    expect(onFirstMistake).toHaveBeenCalledTimes(1)
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.queryByText(/错误|失败|重来/)).not.toBeInTheDocument()
    expect(screen.getByTestId('shiqi-outbook')).toHaveAttribute('data-aligned', 'false')
  })

  it('keeps reduced-motion mode completable without requiring a drag animation', () => {
    render(
      <ShiqiOutbookInteraction
        reduceMotion
        onInteractionStart={onInteractionStart}
        onFirstMistake={onFirstMistake}
        onComplete={onComplete}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '将三条路线对齐' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('shiqi-outbook')).toHaveClass('shiqi-outbook--reduced-motion')
  })

  it('uses the Taro system reduced-motion preference', () => {
    mocks.systemReduceMotion = true
    render(<ShiqiOutbookInteraction onInteractionStart={onInteractionStart} onFirstMistake={onFirstMistake} onComplete={onComplete} />)
    expect(screen.getByRole('button', { name: '将三条路线对齐' })).toBeInTheDocument()
  })

  it('uses and follows the H5 prefers-reduced-motion preference', () => {
    let change: ((event: { matches: boolean }) => void) | undefined
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => { change = listener },
        removeEventListener: vi.fn(),
      })),
    })
    render(<ShiqiOutbookInteraction onInteractionStart={onInteractionStart} onFirstMistake={onFirstMistake} onComplete={onComplete} />)
    expect(screen.getByRole('button', { name: '将三条路线对齐' })).toBeInTheDocument()
    act(() => change?.({ matches: false }))
    expect(screen.queryByRole('button', { name: '将三条路线对齐' })).not.toBeInTheDocument()
  })

  it('keeps normal drag mode when neither platform requests reduced motion', () => {
    render(<ShiqiOutbookInteraction onInteractionStart={onInteractionStart} onFirstMistake={onFirstMistake} onComplete={onComplete} />)
    expect(screen.queryByRole('button', { name: '将三条路线对齐' })).not.toBeInTheDocument()
    expect(screen.getByTestId('shiqi-outbook')).not.toHaveClass('shiqi-outbook--reduced-motion')
  })
})
