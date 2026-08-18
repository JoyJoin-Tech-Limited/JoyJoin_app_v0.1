import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RegistrationSuccessCeremony, {
  CEREMONY_SEAL_LAND_MS,
} from '../RegistrationSuccessCeremony'
import { socialHaptics } from '../../../lib/utils/haptics'

vi.mock('../../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
  socialHaptics: vi.fn(),
}))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
  Image: (props: Record<string, unknown>) => <img {...props} />,
  Button: (props: Record<string, unknown>) => <button {...props} />,
}))

describe('RegistrationSuccessCeremony', () => {
  const baseProps = {
    title: '已加入这场饭局',
    banner: {
      imageSrc: 'https://cdn.example.com/hero.webp',
      badgeText: '饭局',
      title: '周五深夜食堂局',
    },
    meta: [
      { key: 'venue', label: '地点', value: '南山区' },
      { key: 'time', label: '时间', value: '8月21日 周五 19:30', align: 'right' as const },
    ],
    motionEnabled: true,
    onCtaClick: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the headline, the 已留座 seal, and the ticket meta', () => {
    render(<RegistrationSuccessCeremony {...baseProps} />)

    expect(screen.getByText('已加入这场饭局')).toBeInTheDocument()
    expect(screen.getByText('已留座')).toBeInTheDocument()
    expect(screen.getByText('周五深夜食堂局')).toBeInTheDocument()
    expect(screen.getByText('南山区')).toBeInTheDocument()
    expect(screen.getByText('8月21日 周五 19:30')).toBeInTheDocument()
  })

  it('shows the seat line with a real ordinal', () => {
    render(<RegistrationSuccessCeremony {...baseProps} seatOrdinal={5} />)

    expect(screen.getByText('你是第 5 位入座的人')).toBeInTheDocument()
  })

  it('hides the seat line when the ordinal is 0 or unavailable', () => {
    const { rerender } = render(<RegistrationSuccessCeremony {...baseProps} seatOrdinal={0} />)
    expect(screen.queryByText(/位入座的人/)).not.toBeInTheDocument()

    rerender(<RegistrationSuccessCeremony {...baseProps} />)
    expect(screen.queryByText(/位入座的人/)).not.toBeInTheDocument()
  })

  it('tears the 票根 stub only for the paid variant with motion enabled', () => {
    const { container, rerender } = render(
      <RegistrationSuccessCeremony {...baseProps} variant='paid' />,
    )
    expect(container.querySelector('.registration-ceremony__stub')).not.toBeNull()

    // Standard variant skips the tear-off entirely.
    rerender(<RegistrationSuccessCeremony {...baseProps} variant='standard' />)
    expect(container.querySelector('.registration-ceremony__stub')).toBeNull()

    // Degradation ladder: the stub is simply absent without motion.
    rerender(
      <RegistrationSuccessCeremony {...baseProps} variant='paid' motionEnabled={false} />,
    )
    expect(container.querySelector('.registration-ceremony__stub')).toBeNull()
  })

  it('stamps the seal only when motion is enabled', () => {
    const { container, rerender } = render(<RegistrationSuccessCeremony {...baseProps} />)
    expect(container.querySelector('.registration-ceremony__seal--stamp')).not.toBeNull()

    rerender(<RegistrationSuccessCeremony {...baseProps} motionEnabled={false} />)
    expect(container.querySelector('.registration-ceremony__seal--stamp')).toBeNull()
    expect(screen.getByText('已留座')).toBeInTheDocument()
  })

  it('fires the celebration haptic once, timed to the seal landing', () => {
    vi.useFakeTimers()
    render(<RegistrationSuccessCeremony {...baseProps} />)

    // Not on mount — the haptic fires on the visual beat (seal landing).
    expect(socialHaptics).not.toHaveBeenCalled()

    vi.advanceTimersByTime(CEREMONY_SEAL_LAND_MS)
    expect(socialHaptics).toHaveBeenCalledTimes(1)
    expect(socialHaptics).toHaveBeenCalledWith('socialCelebration')

    // Never a second celebration.
    vi.advanceTimersByTime(5000)
    expect(socialHaptics).toHaveBeenCalledTimes(1)
  })

  it('fires the celebration haptic immediately when motion is degraded', () => {
    render(<RegistrationSuccessCeremony {...baseProps} motionEnabled={false} />)

    expect(socialHaptics).toHaveBeenCalledTimes(1)
    expect(socialHaptics).toHaveBeenCalledWith('socialCelebration')
  })

  it('calls onCtaClick from the 查看我的局 CTA', () => {
    render(<RegistrationSuccessCeremony {...baseProps} />)

    fireEvent.click(screen.getByText('查看我的局'))
    expect(baseProps.onCtaClick).toHaveBeenCalledTimes(1)
  })

  it('swaps in the fallback hero asset when the banner image errors', () => {
    render(
      <RegistrationSuccessCeremony
        {...baseProps}
        bannerImageFallbackSrc='https://cdn.example.com/hero.png'
      />,
    )

    const image = document.querySelector('.reservation-ticket__banner-image')
    expect(image).not.toBeNull()
    expect(image!.getAttribute('src')).toBe('https://cdn.example.com/hero.webp')

    fireEvent.error(image!)
    expect(
      document.querySelector('.reservation-ticket__banner-image')!.getAttribute('src'),
    ).toBe('https://cdn.example.com/hero.png')
  })
})
